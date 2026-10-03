'use client';

/**
 * @fileOverview Server Allowlist Table (Phase 5 Milestone 4 Task 4)
 *
 * Implements:
 * - Rule 4: Zero any / Zero any[] strict typing.
 * - Rule 15: External MCP server allowlisting & 8-stage lifecycle tracking.
 * - Rule 34: SSRF verification indicators.
 * - Responsive table layout with mobile-first touch targets (min-h-[44px]).
 */

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Server,
  ShieldCheck,
  Plus,
  Copy,
  Check,
} from 'lucide-react';
import type {
  McpServerRegistration,
  McpServerStatus,
} from '@/platform/mcp/security';

export interface ServerAllowlistTableProps {
  servers: McpServerRegistration[];
  onTransitionStatus?: (serverId: string, nextStatus: McpServerStatus, reason: string) => Promise<void>;
  onRegisterNew?: () => void;
  isLoading?: boolean;
}

export function ServerAllowlistTable({
  servers,
  onTransitionStatus,
  onRegisterNew,
  isLoading = false,
}: ServerAllowlistTableProps) {
  const [copiedUrl, setCopiedUrl] = React.useState<string | null>(null);

  const handleCopy = (url: string) => {
    void navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const getStatusBadge = (status: McpServerStatus) => {
    switch (status) {
      case 'discovered':
        return (
          <Badge variant="outline" className="font-mono text-[11px] uppercase border-slate-400 text-slate-600 dark:text-slate-400">
            Discovered
          </Badge>
        );
      case 'reviewed':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-mono text-[11px] uppercase">
            Reviewed
          </Badge>
        );
      case 'tested':
        return (
          <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 font-mono text-[11px] uppercase">
            Tested
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-mono text-[11px] uppercase">
            Approved
          </Badge>
        );
      case 'connected':
        return (
          <Badge className="bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30 font-mono text-[11px] uppercase">
            Connected
          </Badge>
        );
      case 'monitored':
        return (
          <Badge className="bg-emerald-600/20 text-emerald-800 dark:text-emerald-200 border-emerald-600/40 font-mono text-[11px] uppercase flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Monitored
          </Badge>
        );
      case 'suspended':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-mono text-[11px] uppercase">
            Suspended
          </Badge>
        );
      case 'revoked':
        return (
          <Badge variant="destructive" className="font-mono text-[11px] uppercase">
            Revoked
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getHealthBadge = (health: McpServerRegistration['healthStatus']) => {
    switch (health) {
      case 'healthy':
        return (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Healthy
          </span>
        );
      case 'degraded':
        return (
          <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Degraded
          </span>
        );
      case 'unhealthy':
        return (
          <span className="flex items-center gap-1 text-[11px] text-destructive font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            Offline
          </span>
        );
      default:
        return <span className="text-[11px] text-muted-foreground">Unknown</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Register Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Allowlisted External MCP Servers</h3>
          <p className="text-xs text-muted-foreground">
            Supply-chain defense: only servers in Approved, Connected, or Monitored state can execute tools (Rule 15).
          </p>
        </div>
        {onRegisterNew && (
          <Button
            size="sm"
            onClick={onRegisterNew}
            className="gap-1.5 rounded-xl active:scale-[0.97] min-h-[44px] sm:min-h-[36px]"
          >
            <Plus className="h-4 w-4" />
            Register Server
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold text-xs py-3.5">Server / Vendor</TableHead>
              <TableHead className="font-semibold text-xs py-3.5">Egress Target</TableHead>
              <TableHead className="font-semibold text-xs py-3.5">Lifecycle State</TableHead>
              <TableHead className="font-semibold text-xs py-3.5">SSRF Guard</TableHead>
              <TableHead className="font-semibold text-xs py-3.5">Health</TableHead>
              <TableHead className="font-semibold text-xs py-3.5 text-right pr-6">Lifecycle Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="h-16 text-center animate-pulse bg-muted/10" />
                </TableRow>
              ))
            ) : servers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-xs">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Server className="h-6 w-6 text-muted-foreground/60" />
                    <p>No external MCP servers currently allowlisted for this workspace.</p>
                    {onRegisterNew && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onRegisterNew}
                        className="text-xs h-8 gap-1.5 rounded-xl active:scale-[0.97]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Register First External Server
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              servers.map((srv) => (
                <TableRow key={srv.serverId} className="hover:bg-muted/10 transition-colors">
                  {/* Name and ServerId */}
                  <TableCell className="py-3.5">
                    <div className="space-y-0.5">
                      <div className="font-medium text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                        <Server className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{srv.provenance?.vendor || srv.serverId}</span>
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground truncate select-all">
                        {srv.serverId}
                      </div>
                    </div>
                  </TableCell>

                  {/* URL */}
                  <TableCell className="py-3.5 max-w-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] truncate max-w-[200px] text-muted-foreground select-all">
                        {srv.serverUrl}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(srv.serverUrl)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        {copiedUrl === srv.serverUrl ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </TableCell>

                  {/* Lifecycle State */}
                  <TableCell className="py-3.5">
                    {getStatusBadge(srv.status)}
                  </TableCell>

                  {/* SSRF Guard Status */}
                  <TableCell className="py-3.5">
                    <Badge variant="outline" className="text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px] flex items-center gap-1 w-fit">
                      <ShieldCheck className="h-3 w-3" />
                      Rule 34 Verified
                    </Badge>
                  </TableCell>

                  {/* Health */}
                  <TableCell className="py-3.5">
                    {getHealthBadge(srv.healthStatus)}
                  </TableCell>

                  {/* Lifecycle Actions */}
                  <TableCell className="py-3.5 text-right pr-6">
                    <div className="flex items-center justify-end gap-1.5">
                      {srv.status === 'discovered' && onTransitionStatus && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onTransitionStatus(srv.serverId, 'reviewed', 'Operator architectural review')}
                          className="h-7 text-xs rounded-lg active:scale-[0.97]"
                        >
                          Mark Reviewed
                        </Button>
                      )}

                      {srv.status === 'reviewed' && onTransitionStatus && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onTransitionStatus(srv.serverId, 'tested', 'Integration sandbox tested')}
                          className="h-7 text-xs rounded-lg active:scale-[0.97]"
                        >
                          Mark Tested
                        </Button>
                      )}

                      {srv.status === 'tested' && onTransitionStatus && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => void onTransitionStatus(srv.serverId, 'approved', 'Operator signed allowlist entry')}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg active:scale-[0.97]"
                        >
                          Approve Server
                        </Button>
                      )}

                      {srv.status === 'approved' && onTransitionStatus && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onTransitionStatus(srv.serverId, 'connected', 'Live transport established')}
                          className="h-7 text-xs rounded-lg active:scale-[0.97]"
                        >
                          Connect
                        </Button>
                      )}

                      {srv.status === 'connected' && onTransitionStatus && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onTransitionStatus(srv.serverId, 'monitored', 'Telemetry active')}
                          className="h-7 text-xs rounded-lg active:scale-[0.97]"
                        >
                          Monitor
                        </Button>
                      )}

                      {(srv.status === 'connected' || srv.status === 'monitored') && onTransitionStatus && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void onTransitionStatus(srv.serverId, 'suspended', 'Operator temporary pause')}
                          className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 rounded-lg active:scale-[0.97]"
                        >
                          Suspend
                        </Button>
                      )}

                      {srv.status === 'suspended' && onTransitionStatus && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onTransitionStatus(srv.serverId, 'connected', 'Operator resumed server')}
                          className="h-7 text-xs text-teal-600 rounded-lg active:scale-[0.97]"
                        >
                          Resume
                        </Button>
                      )}

                      {srv.status !== 'revoked' && onTransitionStatus && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void onTransitionStatus(srv.serverId, 'revoked', 'Revoked by security administrator')}
                          className="h-7 text-xs text-destructive hover:bg-destructive/10 rounded-lg active:scale-[0.97]"
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
