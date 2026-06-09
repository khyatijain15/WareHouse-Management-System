import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download, Plus } from "lucide-react";
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { DataTable } from '@/components/data-table';
import type { Row } from '@tanstack/react-table';

const columns = [
  {
    accessorKey: "commodity",
    header: "Commodity",
    cell: ({ row }: { row: Row<any> }) => <span className="font-semibold text-green-800 text-center w-full block">{row.getValue("commodity")}</span>,
  },
  {
    accessorKey: "variety",
    header: "Variety",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-800 text-center w-full block">{row.getValue("variety")}</span>,
  },
  {
    accessorKey: "quantity",
    header: "Quantity (MT)",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-800 text-center w-full block">{row.getValue("quantity")}</span>,
  },
  {
    accessorKey: "aum",
    header: "AUM (Rs/MT)",
    cell: ({ row }: { row: Row<any> }) => {
      const amount = parseFloat(row.getValue("aum"));
      const formatted = amount.toFixed(2);
      return <span className="text-green-800 text-center w-full block">{formatted}</span>;
    },
  },
];

export default function CommoditySummaryTable({ showHeader = false }) {
  const [inwardData, setInwardData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchInward = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'inward'));
        setInwardData(snap.docs.map(doc => doc.data()));
      } catch (err) {
        setError("Failed to fetch inward data");
      } finally {
        setLoading(false);
      }
    };
    fetchInward();
  }, []);

  // Group by commodity + variety, sum quantity and value
  const summaryRows = useMemo(() => {
    const map = new Map();
    inwardData.forEach(entry => {
      const key = `${entry.commodity || ''}__${entry.varietyName || ''}`;
      const prev = map.get(key) || { commodity: entry.commodity || '', variety: entry.varietyName || '', quantity: 0, aum: 0 };
      prev.quantity += parseFloat(entry.totalQuantity || 0);
      prev.aum += parseFloat(entry.totalValue || 0);
      map.set(key, prev);
    });
    let arr = Array.from(map.values());
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      arr = arr.filter(row =>
        row.commodity.toLowerCase().includes(term) ||
        row.variety.toLowerCase().includes(term)
      );
    }
    return arr;
  }, [inwardData, searchTerm]);

  // CSV export
  const handleExportCSV = () => {
    const headers = ["Commodity", "Variety", "Quantity (MT)", "AUM (Rs/MT)"];
    const rows = summaryRows.map(row => [row.commodity, row.variety, row.quantity, row.aum]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "commodity-summary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 md:space-y-6 lg:space-y-8">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-2 md:border-b-4 border-green-500 pb-1 md:pb-2 px-3 md:px-6 py-2 md:py-3 bg-orange-100 rounded-lg">
                Commodity Summary
            </h1>
          </div>
        </div>
      )}
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
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by commodity or variety..."
                className="border-green-300 focus:border-green-500 pl-8 md:pl-10 text-sm md:text-base"
              />
            </div>
              <Button
                onClick={handleExportCSV}
              className="bg-blue-500 hover:bg-blue-700 text-white text-sm md:text-base px-3 md:px-4 py-2"
              disabled={loading || !summaryRows.length}
              >
              <Download className="w-4 h-4 mr-1 md:mr-2 text-white" />
              <span className="hidden sm:inline text-white">Export CSV</span>
              <span className="sm:hidden text-white">Export</span>
              </Button>
            </div>
            {/* Entry Count */}
            <div className="flex justify-start">
              <span className="text-sm text-gray-600 font-medium">
                Total Entries: {summaryRows.length}
              </span>
            </div>
        </CardContent>
      </Card>
      {/* Table */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-green-700 text-lg md:text-xl">Commodity Summary Table</CardTitle>
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
  );
} 