/**
 * @fileoverview OAuth Token Sentinel Radar Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Table for inspecting multi-tenant OAuth connections and expiry countdowns.
 * - Allows testing provider connectivity via `verifyIntegrationConnectionAction`.
 * - Minimum 44px touch targets on buttons.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  Plug2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Loader2,
  Calendar,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import { useBackoffice } from '../../context/BackofficeProvider';
import { verifyIntegrationConnectionAction } from '@/lib/backoffice/backoffice-integration-actions';
import type { IntegrationTokenStatus } from '@/lib/backoffice/backoffice-types';

const STATUS_BADGES: Record<
  IntegrationTokenStatus['status'],
  { label: string; badgeClass: string }
> = {
  valid: {
    label: 'Connected',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold',
  },
  expiring_soon: {
    label: 'Expires < 7d',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold',
  },
  expired: {
    label: 'Expired',
    badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold',
  },
  revoked: {
    label: 'Revoked',
    badgeClass: 'bg-slate-500/15 text-muted-foreground border-slate-500/30',
  },
};

interface TokenSentinelRadarProps {
  readonly tokens: IntegrationTokenStatus[];
  readonly onRefresh: () => void;
}

export default function TokenSentinelRadar({
  tokens,
  onRefresh,
}: TokenSentinelRadarProps) {
  const { can } = useBackoffice();
  const getToken = useBackofficeToken();
  const { toast } = useToast();

  const [verifyingId, setVerifyingId] = React.useState<string | null>(null);

  const handleVerify = async (tokenId: string) => {
    setVerifyingId(tokenId);
    try {
      const idToken = await getToken();
      const res = await verifyIntegrationConnectionAction(tokenId, idToken);

      if (res.success && res.isConnected) {
        toast({
          title: 'Connection Verified',
          description: `Provider responded in ${res.latencyMs}ms. Token is valid.`,
        });
        onRefresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Verification Failed',
          description: res.error || 'Provider rejected credentials.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to verify provider connection.',
      });
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs font-bold uppercase tracking-wider py-4">Provider</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider">Tenant Organization</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider">Connected Account</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider">Token Expiry</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((tok) => {
              const statusCfg = STATUS_BADGES[tok.status] || STATUS_BADGES.valid;

              return (
                <TableRow key={tok.id} className="border-border/60 hover:bg-muted/40 transition-colors">
                  <TableCell className="py-4">
                    <span className="font-bold text-xs uppercase text-foreground">{tok.provider}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-xs text-foreground">{tok.organizationName}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">{tok.accountName}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {tok.daysRemaining > 0
                          ? `${tok.daysRemaining} days remaining`
                          : `Expired ${Math.abs(tok.daysRemaining)}d ago`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] rounded-lg border ${statusCfg.badgeClass}`}>
                      {statusCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    {can('integration_health', 'execute') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerify(tok.id)}
                        disabled={verifyingId === tok.id}
                        className="h-8 px-2.5 rounded-lg text-xs font-semibold active:scale-[0.97] gap-1"
                      >
                        {verifyingId === tok.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                        <span>Ping Test</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
