/**
 * @fileOverview CompanyBrain 2.0 Phase 6: MCP Audit Log Viewer
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Observability & Telemetry Trail:
 *    - Real-time audit log of all tool calls, status, durations, and outputs.
 * 2. Mobile Accessibility & Touch Targets:
 *    - Minimum interactive target >= 44px (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Smooth expand/collapse animations with `active:scale-[0.97]`.
 * 4. Strict Zero-`any` & Zero-`unknown` Standard:
 *    - Fully typed props and log records.
 */

'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Activity, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import type { McpAuditLog } from '@/lib/mcp/types';

export interface McpAuditLogViewerProps {
  logs: McpAuditLog[];
  isLoading?: boolean;
}

export function McpAuditLogViewer({ logs, isLoading: _isLoading = false }: McpAuditLogViewerProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');
  const [expandedLogId, setExpandedLogId] = React.useState<string | null>(null);

  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.toolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.callerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.outputSummary.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        selectedStatus === 'all' || log.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [logs, searchQuery, selectedStatus]);

  const getStatusBadge = (status: McpAuditLog['status']) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold">
            SUCCESS
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold">
            ERROR
          </Badge>
        );
      case 'pending_approval':
        return (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold">
            PENDING APPROVAL
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700 text-xs font-semibold">
            REJECTED
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit trail by tool, caller, or summary..."
            className="pl-9 min-h-[44px] bg-white border-slate-200 text-sm focus:border-indigo-500 rounded-lg"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'success', 'error', 'pending_approval', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-all min-h-[44px] shrink-0 active:scale-[0.97] ${
                selectedStatus === status
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {status.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-200">
            <TableRow>
              <TableHead className="w-[160px] text-xs font-semibold uppercase text-slate-500">Timestamp</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Tool Name</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Caller</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Latency</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Output Summary</TableHead>
              <TableHead className="w-[80px] text-right text-xs font-semibold uppercase text-slate-500">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-500 text-sm">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Activity className="w-8 h-8 text-slate-300" />
                    <p className="font-medium text-slate-700">No telemetry recorded</p>
                    <p className="text-xs text-slate-400">Tool execution events will stream here automatically.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <TableRow className="hover:bg-slate-50/70 transition-colors cursor-pointer" onClick={() => setExpandedLogId(isExpanded ? null : log.id)}>
                      <TableCell className="py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </TableCell>

                      <TableCell className="py-3">
                        <span className="font-mono text-xs font-bold text-slate-900">{log.toolName}</span>
                      </TableCell>

                      <TableCell className="py-3 font-mono text-xs text-slate-600">
                        {log.callerId.slice(0, 12)} ({log.callerType})
                      </TableCell>

                      <TableCell className="py-3">
                        {getStatusBadge(log.status)}
                      </TableCell>

                      <TableCell className="py-3 font-mono text-xs text-slate-600">
                        {log.durationMs}ms
                      </TableCell>

                      <TableCell className="py-3 text-xs text-slate-700 max-w-xs truncate">
                        {log.errorMessage ? (
                          <span className="text-rose-600 font-medium">{log.errorMessage}</span>
                        ) : (
                          log.outputSummary
                        )}
                      </TableCell>

                      <TableCell className="text-right py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedLogId(isExpanded ? null : log.id);
                          }}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-[0.97]"
                          aria-label={isExpanded ? 'Collapse log details' : 'Expand log details'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-slate-50/60 border-t border-slate-100">
                        <TableCell colSpan={7} className="p-4 space-y-3">
                          <div>
                            <span className="text-[11px] font-semibold uppercase text-slate-500 block mb-1">
                              Sanitized Input Arguments
                            </span>
                            <pre className="p-3 bg-slate-900 text-slate-100 font-mono text-xs rounded-lg overflow-x-auto max-h-48">
                              {JSON.stringify(log.inputPayload, null, 2)}
                            </pre>
                          </div>

                          {log.errorMessage && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
                              <span className="font-semibold flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" /> Full Error Message:
                              </span>
                              <p className="font-mono">{log.errorMessage}</p>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
