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
    accessorKey: "branch",
    header: "Branch",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-800 w-full flex justify-center">{row.getValue("branch")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "location",
    header: "Location",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-800 w-full flex justify-center">{row.getValue("location")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "warehouseName",
    header: "Warehouse Name",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-800 w-full flex justify-center">{row.getValue("warehouseName")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "warehouseCode",
    header: "Warehouse Code",
    cell: ({ row }: { row: Row<any> }) => <span className="text-green-800 w-full flex justify-center">{row.getValue("warehouseCode")}</span>,
    meta: { align: 'center' },
  },
  {
    accessorKey: "status",
    header: "Warehouse Status",
    cell: ({ row }: { row: Row<any> }) => {
      let status = row.getValue("status");
      let color = "";
      let displayStatus = "";
      
      switch (String(status || "").toLowerCase()) {
        case "activated":
        case "active":
          color = "bg-green-100 text-green-800";
          displayStatus = "Activated";
          break;
        case "pending":
          color = "bg-yellow-100 text-yellow-800";
          displayStatus = "Pending";
          break;
        case "closed":
          // Brown font on yellow background (same as pending)
          color = "bg-yellow-100 text-yellow-800";
          displayStatus = "Closed";
          break;
        case "reactivate":
        case "reactivated":
        case "reactive":
          // Dark green font on light green background
          color = "bg-green-100 text-green-800";
          displayStatus = "Reactivate";
          break;
        case "rejected":
        case "reject":
          // Red font on light red background
          color = "bg-red-100 text-red-600";
          displayStatus = "Rejected";
          break;
        case "resubmit":
        case "resubmitted":
          // Red font on light red background
          color = "bg-red-100 text-red-600";
          displayStatus = "Resubmit";
          break;
        case "submitted":
          color = "bg-blue-100 text-blue-800";
          displayStatus = "Submitted";
          break;
        default:
          color = "bg-gray-100 text-gray-700";
          displayStatus = String(status);
      }
      return <span className={`px-2 py-1 rounded w-full flex justify-center ${color}`}>{displayStatus}</span>;
    },
    meta: { align: 'center' },
  },
];

export default function WarehouseStatusTable({ showHeader = false }) {
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchInspections = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'inspections'));
        setInspections(snap.docs.map(doc => doc.data()));
      } catch (err) {
        setError("Failed to fetch warehouse inspections");
      } finally {
        setLoading(false);
      }
    };
    fetchInspections();
  }, []);

  // Warehouse categorization functions
  const getWarehouseCategorization = useMemo(() => {
    const categorization = {
      active: 0, // ACTIVATED + REACTIVATE
      pending: 0, // PENDING + SUBMITTED + RESUBMITTED  
      rejected: 0, // REJECTED
      closed: 0 // CLOSED
    };

    inspections.forEach(entry => {
      const status = (entry.status || '').toLowerCase().trim();
      
      if (status === 'activated' || status === 'active' || status === 'reactivate' || status === 'reactivated') {
        categorization.active++;
      } else if (!status || status === 'pending' || status === 'submitted' || status === 'resubmit' || status === 'resubmitted') {
        categorization.pending++;
      } else if (status === 'rejected' || status === 'reject') {
        categorization.rejected++;
      } else if (status === 'closed') {
        categorization.closed++;
      }
    });

    return categorization;
  }, [inspections]);

  // Prepare rows for the table
  const summaryRows = useMemo(() => {
    let arr = inspections.map(entry => ({
      state: entry.state || (entry.warehouseInspectionData && entry.warehouseInspectionData.state) || '',
      branch: entry.branch || (entry.warehouseInspectionData && entry.warehouseInspectionData.branch) || '',
      location: entry.location || (entry.warehouseInspectionData && entry.warehouseInspectionData.location) || '',
      warehouseName: entry.warehouseName || (entry.warehouseInspectionData && entry.warehouseInspectionData.warehouseName) || '',
      warehouseCode: entry.warehouseCode || (entry.warehouseInspectionData && entry.warehouseInspectionData.warehouseCode) || '',
      status: entry.status && entry.status.trim() ? entry.status : 'Pending',
    }));
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      arr = arr.filter(row =>
        row.state.toLowerCase().includes(term) ||
        row.branch.toLowerCase().includes(term) ||
        row.location.toLowerCase().includes(term) ||
        row.warehouseName.toLowerCase().includes(term) ||
        row.warehouseCode.toLowerCase().includes(term) ||
        row.status.toLowerCase().includes(term)
      );
    }
    return arr;
  }, [inspections, searchTerm]);

  // CSV export
  const handleExportCSV = () => {
    const normalizeStatusForCSV = (status: string) => {
      const normalizedStatus = String(status || "").toLowerCase();
      switch (normalizedStatus) {
        case "activated":
        case "active":
          return "Activated";
        case "pending":
          return "Pending";
        case "closed":
          return "Closed";
        case "reactivate":
        case "reactivated":
        case "reactive":
          return "Reactivate";
        case "rejected":
        case "reject":
          return "Rejected";
        case "resubmit":
        case "resubmitted":
          return "Resubmit";
        case "submitted":
          return "Submitted";
        default:
          return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
      }
    };

    const headers = ["State", "Branch", "Location", "Warehouse Name", "Warehouse Code", "Warehouse Status"];
    const rows = summaryRows.map(row => [
      row.state, 
      row.branch, 
      row.location, 
      row.warehouseName, 
      row.warehouseCode, 
      normalizeStatusForCSV(row.status)
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "warehouse-status.csv");
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
            Warehouse Status
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
                placeholder="Search by state, branch, location, warehouse name, code, or status..."
                className="border-green-300 focus:border-green-500 pl-10"
              />
            </div>
            <Button
              onClick={handleExportCSV}
              className="bg-blue-500 hover:bg-blue-600 text-white"
              disabled={loading || !summaryRows.length}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Entry Count Display */}
      <div className="w-full py-2">
        <div className="flex justify-start gap-4 flex-wrap">
          <div className="bg-blue-50 border-2 border-blue-500 px-4 py-2 rounded-lg shadow-sm">
            <span className="text-lg font-semibold text-blue-800">
              📊 Total Entries: {summaryRows?.length || 0}
            </span>
          </div>
          <div className="bg-green-50 border-2 border-green-500 px-4 py-2 rounded-lg shadow-sm">
            <span className="text-sm font-semibold text-green-800">
              🟢 Active: {getWarehouseCategorization.active}
            </span>
          </div>
          <div className="bg-yellow-50 border-2 border-yellow-500 px-4 py-2 rounded-lg shadow-sm">
            <span className="text-sm font-semibold text-yellow-800">
              ⏳ Pending: {getWarehouseCategorization.pending}
            </span>
          </div>
          <div className="bg-red-50 border-2 border-red-500 px-4 py-2 rounded-lg shadow-sm">
            <span className="text-sm font-semibold text-red-800">
              ❌ Rejected: {getWarehouseCategorization.rejected}
            </span>
          </div>
          <div className="bg-gray-50 border-2 border-gray-500 px-4 py-2 rounded-lg shadow-sm">
            <span className="text-sm font-semibold text-gray-800">
              🔒 Closed: {getWarehouseCategorization.closed}
            </span>
          </div>
        </div>
      </div>
      
      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-green-700 text-xl text-left">Warehouse Status Table</CardTitle>
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
            stickyFirstColumn={true}
            showGridLines={true}
          />
        </CardContent>
      </Card>
    </div>
  );
} 