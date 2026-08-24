'use client';

/**
 * SmartSapp Finance 2.0 - Generic Report Data Table Component
 * Reusable, sortable, and responsive table for modular financial reporting.
 */

import * as React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReportColumn } from '@/lib/types';

export interface ReportDataTableProps<TRow> {
  columns: ReportColumn<TRow>[];
  rows: TRow[];
  pageSize?: number;
  emptyMessage?: string;
  summaryRow?: React.ReactNode;
}

export function ReportDataTable<TRow>({
  columns,
  rows,
  pageSize = 25,
  emptyMessage = 'No matching report records found for this period.',
  summaryRow,
}: ReportDataTableProps<TRow>) {
  const [currentPage, setCurrentPage] = React.useState<number>(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const paginatedRows = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  return (
    <Card className="rounded-2xl border shadow-sm overflow-hidden">
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-xs font-medium">
            {emptyMessage}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {columns.map((col) => (
                    <TableHead
                      key={col.id}
                      className={`text-xs font-bold ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      } ${col.className || ''}`}
                    >
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedRows.map((row, rowIdx) => (
                  <TableRow key={rowIdx} className="hover:bg-muted/40 text-xs">
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={`${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        } ${col.className || ''}`}
                      >
                        {col.accessor(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

                {summaryRow}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {Math.min((currentPage - 1) * pageSize + 1, rows.length)} to{' '}
              {Math.min(currentPage * pageSize, rows.length)} of {rows.length} records
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-mono text-xs px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
