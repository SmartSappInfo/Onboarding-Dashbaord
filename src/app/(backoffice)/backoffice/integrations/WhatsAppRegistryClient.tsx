'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageCircle, Loader2, Unplug, RefreshCw } from 'lucide-react';
import {
  listAllWhatsAppConnections,
  forceDisconnectWhatsApp,
} from '@/lib/whatsapp-backoffice-actions';
import type { WhatsAppConnectionPublic } from '@/lib/whatsapp/whatsapp-types';
import { PageContainerFluid } from '@/components/ui/page-container';

const STATUS_CLS: Record<string, string> = {
  connected: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  error: 'bg-red-500/10 text-red-600 border-red-500/20',
  disconnected: 'bg-muted text-muted-foreground border-border',
};
const QUALITY_CLS: Record<string, string> = {
  GREEN: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  YELLOW: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  RED: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export default function WhatsAppRegistryClient() {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<WhatsAppConnectionPublic[]>([]);
  const [busyOrg, setBusyOrg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await listAllWhatsAppConnections(idToken);
      if (res.success) setRows(res.data);
      else toast({ variant: 'destructive', title: 'Load failed', description: res.error });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleForceDisconnect = async (organizationId: string) => {
    if (!user) return;
    if (!confirm(`Force-disconnect WhatsApp for ${organizationId}? Their credentials will be deleted.`)) return;
    setBusyOrg(organizationId);
    try {
      const idToken = await user.getIdToken();
      const res = await forceDisconnectWhatsApp(idToken, organizationId);
      if (res.success) {
        setRows((prev) => prev.filter((r) => r.organizationId !== organizationId));
        toast({ title: 'Disconnected', description: `Removed WhatsApp connection for ${organizationId}.` });
      } else {
        toast({ variant: 'destructive', title: 'Failed', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setBusyOrg(null);
    }
  };

  return (
    <PageContainerFluid>
      <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden">
        <CardHeader className="p-8 border-b">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
                WhatsApp Connections
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                Every organization's WhatsApp Business connection. Credentials are encrypted and never shown here.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="rounded-xl font-bold">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading connections…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground p-8">No organizations have configured WhatsApp yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Last check</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.organizationId}>
                    <TableCell className="font-semibold">
                      {r.businessName || r.organizationId}
                      <div className="text-[10px] text-muted-foreground">{r.organizationId}</div>
                    </TableCell>
                    <TableCell className="font-medium">{r.displayPhoneNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-bold ${STATUS_CLS[r.status] ?? ''}`}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.qualityRating ? (
                        <Badge variant="outline" className={`text-[10px] font-bold ${QUALITY_CLS[r.qualityRating] ?? ''}`}>
                          {r.qualityRating}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{r.messagingLimit ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.lastHealthCheckAt ? new Date(r.lastHealthCheckAt).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleForceDisconnect(r.organizationId)}
                        disabled={busyOrg === r.organizationId}
                        className="rounded-xl font-bold text-red-600 hover:text-red-700 hover:bg-red-500/5"
                      >
                        {busyOrg === r.organizationId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Unplug className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageContainerFluid>
  );
}
