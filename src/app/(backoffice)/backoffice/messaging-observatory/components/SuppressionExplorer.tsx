/**
 * @fileoverview Suppression & Bounce Explorer Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Displays cross-tenant email and phone suppressions to maintain high sender reputation.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import { ShieldX, Search, Mail, Smartphone, AlertCircle, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { listSuppressionRecordsAction } from '@/lib/backoffice/backoffice-messaging-observatory-actions';
import type { SuppressionEntry } from '@/lib/backoffice/backoffice-types';

export default function SuppressionExplorer() {
  const getToken = useBackofficeToken();
  const [records, setRecords] = React.useState<SuppressionEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    getToken().then((idToken) => {
      listSuppressionRecordsAction(idToken).then((res) => {
        if (!cancelled && res.success && res.records) {
          setRecords(res.records);
        }
        if (!cancelled) setIsLoading(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      return (
        search === '' ||
        r.recipient.toLowerCase().includes(search.toLowerCase()) ||
        r.reason.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [records, search]);

  return (
    <div className="space-y-4">
      {/* Search Toolbar */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search suppressed emails or phone numbers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 rounded-xl bg-card border-border text-xs"
        />
      </div>

      {/* Suppression Records Table */}
      <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-xs font-medium">Loading suppression registry...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-center">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ShieldX className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-foreground">Zero Suppressions</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              No recipients are currently suppressed or blocked in the global delivery pool.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-4">Channel</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Recipient Target</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Suppression Reason</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Suppressed Since</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((rec) => (
                  <TableRow key={rec.id} className="border-border/60 hover:bg-muted/40 transition-colors">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        {rec.channel === 'email' ? (
                          <Mail className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Smartphone className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="font-semibold text-xs capitalize text-foreground">{rec.channel}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-bold text-foreground">{rec.recipient}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-[10px] rounded-lg border-border">
                        {rec.reason.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(rec.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
