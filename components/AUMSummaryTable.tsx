import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download } from "lucide-react";
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { DataTable } from '@/components/data-table';
import type { Row } from '@tanstack/react-table';

const columns = [
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }: { row: Row<any> }) => <span className="font-semibold text-green-800 w-full flex justify-center">{row.getValue("state")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "commodity",
    header: "Commodity",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-800 w-full flex justify-center">{row.getValue("commodity")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "quantity",
    header: "Quantity (MT)",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-800 w-full flex justify-center">{row.getValue("quantity")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "aum",
    header: "AUM (Rs/MT)",
    cell: ({ row }: { row: Row<any> }) => {
      const amount = parseFloat(row.getValue("aum"));
      const formatted = amount.toFixed(2);
      return <span className="text-green-800 w-full flex justify-center">{formatted}</span>;
    },
    meta: { align: 'center' },
  },
];

export default function AUMSummaryTable({ showHeader = false }) {
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

  // Group by state + commodity, sum quantity and value
  const summaryRows = useMemo(() => {
    const map = new Map();
    inwardData.forEach(entry => {
      const key = `${entry.state || ''}__${entry.commodity || ''}`;
      const prev = map.get(key) || { state: entry.state || '', commodity: entry.commodity || '', quantity: 0, aum: 0 };
      prev.quantity += parseFloat(entry.totalQuantity || 0);
      prev.aum += parseFloat(entry.totalValue || 0);
      map.set(key, prev);
    });
    let arr = Array.from(map.values());
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      arr = arr.filter(row =>
        row.state.toLowerCase().includes(term) ||
        row.commodity.toLowerCase().includes(term)
      );
    }
    return arr;
  }, [inwardData, searchTerm]);

  // CSV export
  const handleExportCSV = () => {
    const headers = ["State", "Commodity", "Quantity (MT)", "AUM (Rs/MT)"];
    const rows = summaryRows.map(row => [row.state, row.commodity, row.quantity, row.aum]);
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
    <div className="space-y-8">
      {showHeader && (
        <div className="flex items-center justify-center">
          <h1 className="text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-6 py-3 bg-orange-100 rounded-lg">
            AUM Summary
          </h1>
        </div>
      )}
      {/* Search & Export Card */}
      <Card className="border-green-300">
        <CardHeader className="bg-green-50">
          <CardTitle className="text-green-700">Search & Export</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by state or commodity..."
                className="border-green-300 focus:border-green-500 pl-10"
              />
            </div>
            <Button
              onClick={handleExportCSV}
              className="bg-blue-500 hover:bg-blue-700 text-white"
              disabled={loading || !summaryRows.length}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
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
        <CardHeader>
          <CardTitle className="text-green-700 text-xl text-left">AUM Summary Table</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
        </CardContent>
      </Card>
    </div>
  );
} 