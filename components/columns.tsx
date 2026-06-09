"use client";

import { ColumnDef } from "@tanstack/react-table";

export type Warehouse = {
  id: string;
  srNo: number;
  state: string;
  commodity: string;
  aum: string;
  quantity: number;
};

export const columns: ColumnDef<Warehouse>[] = [
  {
    accessorKey: "srNo",
    header: "Sr. No",
    cell: ({ row }) => <span className="text-green-800 text-center w-full block">{row.getValue("srNo")}</span>,
  },
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }) => <span className="font-semibold text-green-800 text-center w-full block">{row.getValue("state")}</span>,
  },
  {
    accessorKey: "commodity",
    header: "Commodity",
    cell: ({ row }) => <span className="text-green-800 text-center w-full block">{row.getValue("commodity")}</span>,
  },
  {
    accessorKey: "aum",
    header: "AUM (₹)",
    cell: ({ row }) => <span className="text-green-800 text-center w-full block">{row.getValue("aum")}</span>,
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
    cell: ({ row }) => {
      const quantity = parseFloat(row.getValue("quantity"));
      return <span className="text-green-800 text-center w-full block font-medium">{quantity.toLocaleString()} Units</span>;
    },
  },
];