"use client";

import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Download, Plus } from "lucide-react";
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { DataTable } from '@/components/data-table';

const columns = [
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }: any) => <span className="font-semibold text-green-800 text-center w-full block">{row.getValue("state")}</span>,
  },
  {
    accessorKey: "commodity",
    header: "Commodity",
    cell: ({ row }: any) => <span className="text-green-800 text-center w-full block">{row.getValue("commodity")}</span>,
  },
  {
    accessorKey: "quantity",
    header: "Quantity (MT)",
    cell: ({ row }: any) => <span className="text-green-800 text-center w-full block">{row.getValue("quantity")}</span>,
  },
  {
    accessorKey: "aum",
    header: "AUM (₹)",
    cell: ({ row }: any) => {
      const amount = parseFloat(row.getValue("aum"));
      const formatted = amount.toFixed(2);
      return <span className="text-green-800 text-center w-full block">{formatted}</span>;
    },
  },
];

export default function AUMSummaryPage() {
  const [inwardData, setInwardData] = useState([] as any[]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null as string | null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchInward = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'inward'));
        setInwardData(snap.docs.map((doc: any) => doc.data()));
      } catch (err) {
        setError("Failed to fetch inward data");
      } finally {
        setLoading(false);
      }
    };
    fetchInward();
  }, []);

  // Group by state + commodity, sum quantity and value
  const summaryRows = useMemo(() => {
    const map = new Map();
    inwardData.forEach((entry: any) => {
      const key = `${entry.state || ''}__${entry.commodity || ''}`;
      const prev = map.get(key) || { state: entry.state || '', commodity: entry.commodity || '', quantity: 0, aum: 0 };
      prev.quantity += parseFloat(entry.totalQuantity || 0);
      prev.aum += parseFloat(entry.totalValue || 0);
      map.set(key, prev);
    });
    let arr = Array.from(map.values());
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      arr = arr.filter((row: any) =>
        row.state.toLowerCase().includes(term) ||
        row.commodity.toLowerCase().includes(term)
      );
    }
    return arr;
  }, [inwardData, searchTerm]);

  // CSV export
  const handleExportCSV = () => {
  const headers = ["State", "Commodity", "Quantity (MT)", "AUM (₹/MT)"];
  const rows = summaryRows.map((row: any) => [row.state, row.commodity, row.quantity, row.aum]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "aum-summary.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6 lg:space-y-8">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-4">
          <button className="inline-block text-sm md:text-lg font-semibold tracking-tight bg-orange-500 text-white px-3 md:px-4 py-2 rounded-md hover:bg-orange-600 transition-colors">
            ← Dashboard
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-2 md:border-b-4 border-green-500 pb-1 md:pb-2 px-3 md:px-6 py-2 md:py-3 bg-orange-100 rounded-lg">
              AUM Summary
            </h1>
          </div>
          <Button className="bg-green-500 hover:bg-green-600 text-white px-3 md:px-6 py-2 md:py-3 shadow-lg text-sm md:text-base">
            <Plus className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Add New AUM</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

        {/* Search & Export Card */}
        <Card className="border-green-300">
          <CardHeader className="bg-green-50 p-3 md:p-6">
            <CardTitle className="text-green-700 text-sm md:text-base">Search & Export</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-4 space-y-3 md:space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  placeholder="Search by state or commodity..."
                  className="border-green-300 focus:border-green-500 pl-8 md:pl-10 text-sm md:text-base"
                />
              </div>
              <Button
                onClick={handleExportCSV}
                className="bg-blue-500 hover:bg-blue-700 text-white text-sm md:text-base px-3 md:px-4 py-2"
                disabled={loading || !summaryRows.length}
              >
                <Download className="w-4 h-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-green-700 text-lg md:text-xl text-left">AUM Summary Table</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <DataTable
                columns={columns}
                data={summaryRows}
                isLoading={loading}
                error={error || undefined}
                wrapperClassName="border-green-300"
                headClassName="bg-orange-100 text-orange-600 font-bold text-center"
                cellClassName="text-green-800 text-center"
                stickyHeader={true}
                stickyFirstColumn={false}
                showGridLines={true}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
