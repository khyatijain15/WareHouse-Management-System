"use client";

import { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  error?: string;
  wrapperClassName?: string;
  headClassName?: string;
  cellClassName?: string;
  stickyHeader?: boolean;
  stickyFirstColumn?: boolean;
  showGridLines?: boolean;
  pageSize?: number;
  showPagination?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  error,
  wrapperClassName,
  headClassName,
  cellClassName,
  stickyHeader = false,
  stickyFirstColumn = false,
  showGridLines = false,
  pageSize = 10,
  showPagination = true,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: showPagination ? getPaginationRowModel() : undefined,
    initialState: {
      pagination: {
        pageSize: pageSize,
      },
    },
  });

  if (isLoading) {
    return (
      <div className="w-full h-32 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-32 flex items-center justify-center text-destructive">
        {error}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="w-full h-32 flex items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="relative">
      <div 
        className={cn(
          "rounded-md border", 
          wrapperClassName,
          stickyHeader ? "table-container" : "overflow-auto"
        )}
        style={stickyHeader ? { 
          maxHeight: '70vh', 
          overflowY: 'auto',
          overflowX: 'auto',
          position: 'relative'
        } : {}}
      >
        {stickyHeader ? (
          // Custom table structure for sticky headers
          <table className={cn("w-full caption-bottom text-sm", showGridLines ? "border-collapse" : "", "relative")}>
            <thead className="sticky-header">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b">
                  {headerGroup.headers.map((header, index) => {
                    return (
                      <th 
                        key={header.id} 
                        className={cn(
                          "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
                          headClassName,
                          showGridLines ? "border border-gray-300" : "",
                          stickyFirstColumn && index === 0 ? "sticky-first-column header sticky left-0 z-20 bg-orange-100 border-r border-gray-300" : "",
                          "sticky top-0 z-10 bg-orange-100 border-b-2 border-orange-200"
                        )}
                        style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#fed7aa' }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    {row.getVisibleCells().map((cell, index) => (
                      <td 
                        key={cell.id} 
                        className={cn(
                          "p-4 align-middle [&:has([role=checkbox])]:pr-0",
                          cellClassName,
                          showGridLines ? "border border-gray-300" : "",
                          stickyFirstColumn && index === 0 ? "sticky-first-column sticky left-0 z-10 bg-white border-r border-gray-300" : ""
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <Table className={cn(showGridLines ? "border-collapse" : "", "relative")}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => {
                    return (
                      <TableHead 
                        key={header.id} 
                        className={cn(
                          headClassName,
                          showGridLines ? "border border-gray-300" : "",
                          stickyFirstColumn && index === 0 ? "sticky-first-column header sticky left-0 z-20 bg-orange-100 border-r border-gray-300" : ""
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <TableCell 
                      key={cell.id} 
                      className={cn(
                        cellClassName,
                        showGridLines ? "border border-gray-300" : "",
                        stickyFirstColumn && index === 0 ? "sticky-first-column sticky left-0 z-10 bg-white border-r border-gray-300" : ""
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        )}
      </div>
      {showPagination && (
        <div className="mt-4">
          <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  table.previousPage();
                }}
                className={
                  !table.getCanPreviousPage()
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>
            {table.getPageCount() > 0 && (
              <PaginationItem>
                <PaginationLink
                  href="#"
                  isActive={table.getState().pagination.pageIndex === 0}
                  onClick={(e) => {
                    e.preventDefault();
                    table.setPageIndex(0);
                  }}
                >
                  1
                </PaginationLink>
              </PaginationItem>
            )}
            {table.getPageCount() > 3 &&
              table.getState().pagination.pageIndex > 1 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
            {table.getState().pagination.pageIndex > 0 &&
              table.getState().pagination.pageIndex < table.getPageCount() - 1 && (
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    isActive={true}
                    onClick={(e) => {
                      e.preventDefault();
                    }}
                  >
                    {table.getState().pagination.pageIndex + 1}
                  </PaginationLink>
                </PaginationItem>
              )}
            {table.getPageCount() > 3 &&
              table.getState().pagination.pageIndex < table.getPageCount() - 2 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
            {table.getPageCount() > 1 && (
              <PaginationItem>
                <PaginationLink
                  href="#"
                  isActive={
                    table.getState().pagination.pageIndex ===
                    table.getPageCount() - 1
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    table.setPageIndex(table.getPageCount() - 1);
                  }}
                >
                  {table.getPageCount()}
                </PaginationLink>
              </PaginationItem>
            )}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  table.nextPage();
                }}
                className={
                  !table.getCanNextPage()
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        </div>
      )}
    </div>
  );
}