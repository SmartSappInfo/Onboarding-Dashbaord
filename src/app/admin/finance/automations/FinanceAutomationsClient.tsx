'use client';

/**
 * SmartSapp Finance 2.0 - Finance Automations & Reminders Command Center
 * Multi-channel dunning policies, manual cycle trigger, and real-time delivery logs.
 */

import * as React from 'react';
import { 
  Zap, 
  Send, 
  MessageSquare, 
  Mail, 
  Smartphone, 
  CheckCircle2, 
  Clock, 
  Loader2, 
  Play, 
  TrendingDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { FinanceReminderLog, ReminderChannel, ReminderStage } from '@/lib/types';
import { runReminderCycleAction } from '@/lib/finance-automation-actions';
import Link from 'next/link';

export function FinanceAutomationsClient() {
  const { user } = useUser();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [isRunningCycle, setIsRunningCycle] = React.useState<boolean>(false);

  // Query live reminder logs
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'finance_reminder_logs'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }, [firestore, activeWorkspaceId]);

  const { data: rawLogs, isLoading } = useCollection<FinanceReminderLog>(logsQuery);
  const logs = React.useMemo(() => rawLogs || [], [rawLogs]);

  const handleRunCycle = async () => {
    if (!user || !activeWorkspaceId) return;
    setIsRunningCycle(true);

    const res = await runReminderCycleAction(
      activeWorkspaceId,
      user.uid,
      user.displayName || user.email || 'Finance Administrator'
    );

    setIsRunningCycle(false);

    if (res.success && res.result) {
      toast({
        title: 'Reminder Cycle Completed',
        description: `Scanned ${res.result.invoicesScanned} invoices: ${res.result.remindersDispatched} reminders dispatched, ${res.result.casesEscalated} collection cases auto-escalated.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Cycle Execution Failed',
        description: res.error || 'Failed to complete reminder run.',
      });
    }
  };

  const getChannelBadge = (ch: ReminderChannel) => {
    switch (ch) {
      case 'whatsapp':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1 w-fit">
            <MessageSquare className="h-3 w-3" /> WhatsApp
          </Badge>
        );
      case 'email':
        return (
          <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 flex items-center gap-1 w-fit">
            <Mail className="h-3 w-3" /> Email
          </Badge>
        );
      case 'sms':
        return (
          <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20 flex items-center gap-1 w-fit">
            <Smartphone className="h-3 w-3" /> SMS
          </Badge>
        );
    }
  };

  const getStageBadge = (stage: ReminderStage) => {
    switch (stage) {
      case 't_minus_7': return <Badge variant="outline" className="text-muted-foreground text-[10px]">T-7d (Upcoming)</Badge>;
      case 't_minus_3': return <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20 text-[10px]">T-3d (Reminder)</Badge>;
      case 'due_date': return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-bold text-[10px]">Due Today</Badge>;
      case 't_plus_3': return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">T+3d (Grace)</Badge>;
      case 't_plus_7': return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-[10px]">T+7d (1st Overdue)</Badge>;
      case 't_plus_14': return <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 font-bold text-[10px]">T+14d (2nd Overdue)</Badge>;
      case 't_plus_30': return <Badge className="bg-red-600 text-white font-bold text-[10px]">T+30d (Demand)</Badge>;
      default: return <Badge variant="outline" className="text-purple-600 text-[10px]">Manual</Badge>;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Zap className="h-4 w-4" />
            Automation & Communications
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Finance Automations & Reminders
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Multi-channel payment reminder policies, automated dunning schedules, and delivery logs for {activeWorkspace?.name || activeWorkspaceId}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleRunCycle}
            disabled={isRunningCycle}
            className="rounded-xl h-10 min-h-[44px] text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md active:scale-[0.97]"
          >
            {isRunningCycle ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Executing Cycle...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1.5" />
                Run Reminder Cycle
              </>
            )}
          </Button>

          <Button variant="outline" size="sm" asChild className="rounded-xl h-10 min-h-[44px] text-xs font-semibold">
            <Link href="/admin/finance/receivables">
              <TrendingDown className="h-4 w-4 mr-1.5" />
              Receivables
            </Link>
          </Button>
        </div>
      </div>

      {/* Reminder Schedule Policy Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Active Reminder Milestones & Dunning Policies
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="rounded-2xl border bg-card p-4 shadow-sm space-y-2 border-l-4 border-l-sky-500">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-600 uppercase tracking-wider">T-7d &amp; T-3d</span>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/20">Active</Badge>
            </div>
            <h3 className="text-sm font-bold text-foreground">Pre-Due Notices</h3>
            <p className="text-[11px] text-muted-foreground">
              Friendly courtesy reminders sent 7 days and 3 days before invoice maturity.
            </p>
            <div className="flex gap-1 pt-1">
              <Badge className="bg-emerald-500/10 text-emerald-600 text-[9px]">WhatsApp</Badge>
              <Badge className="bg-indigo-500/10 text-indigo-600 text-[9px]">Email</Badge>
            </div>
          </Card>

          <Card className="rounded-2xl border bg-card p-4 shadow-sm space-y-2 border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Day 0 (Due Date)</span>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/20">Active</Badge>
            </div>
            <h3 className="text-sm font-bold text-foreground">Maturity Notice</h3>
            <p className="text-[11px] text-muted-foreground">
              Payment due today notification with short-link to public invoice portal.
            </p>
            <div className="flex gap-1 pt-1">
              <Badge className="bg-emerald-500/10 text-emerald-600 text-[9px]">WhatsApp</Badge>
              <Badge className="bg-sky-500/10 text-sky-600 text-[9px]">SMS</Badge>
            </div>
          </Card>

          <Card className="rounded-2xl border bg-card p-4 shadow-sm space-y-2 border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">T+3d &amp; T+7d</span>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/20">Active</Badge>
            </div>
            <h3 className="text-sm font-bold text-foreground">Grace &amp; 1st Overdue</h3>
            <p className="text-[11px] text-muted-foreground">
              Grace period expiry notice followed by initial delinquent debt alert.
            </p>
            <div className="flex gap-1 pt-1">
              <Badge className="bg-emerald-500/10 text-emerald-600 text-[9px]">WhatsApp</Badge>
              <Badge className="bg-indigo-500/10 text-indigo-600 text-[9px]">Email</Badge>
            </div>
          </Card>

          <Card className="rounded-2xl border bg-card p-4 shadow-sm space-y-2 border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">T+14d &amp; T+30d</span>
              <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-500/20 font-bold">Auto-Escalate</Badge>
            </div>
            <h3 className="text-sm font-bold text-foreground">Demand &amp; Collection</h3>
            <p className="text-[11px] text-muted-foreground">
              Final demand letter. 30d invoices automatically open a collection case.
            </p>
            <div className="flex gap-1 pt-1">
              <Badge className="bg-red-600 text-white text-[9px]">All Channels</Badge>
            </div>
          </Card>
        </div>
      </div>

      {/* Live Delivery Logs Card */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="p-4 border-b flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <Send className="h-4 w-4 text-primary" />
              Recent Dispatch &amp; Delivery Telemetry
            </CardTitle>
            <CardDescription className="text-xs">
              Live log of all automated and manual outreach notifications.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs font-medium">Loading reminder logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto opacity-70" />
              <p className="text-sm font-semibold text-foreground">No Delivery Logs Recorded</p>
              <p className="text-xs max-w-sm mx-auto">
                Trigger a reminder cycle or dispatch a manual reminder to see live telemetry.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-bold">Sent Date</TableHead>
                    <TableHead className="text-xs font-bold">Debtor Entity</TableHead>
                    <TableHead className="text-xs font-bold">Invoice #</TableHead>
                    <TableHead className="text-xs font-bold">Channel</TableHead>
                    <TableHead className="text-xs font-bold text-center">Milestone Stage</TableHead>
                    <TableHead className="text-xs font-bold text-right">Amount Due</TableHead>
                    <TableHead className="text-xs font-bold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/40">
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {log.sentDate}
                      </TableCell>

                      <TableCell className="font-semibold text-xs text-foreground">
                        {log.entityName}
                      </TableCell>

                      <TableCell className="font-mono text-xs font-bold text-primary">
                        <Link href={`/admin/finance/invoices/${log.invoiceId}`} className="hover:underline">
                          {log.invoiceNumber}
                        </Link>
                      </TableCell>

                      <TableCell>
                        {getChannelBadge(log.channel)}
                      </TableCell>

                      <TableCell className="text-center">
                        {getStageBadge(log.stage)}
                      </TableCell>

                      <TableCell className="text-right font-bold text-xs font-mono text-rose-600">
                        {log.currency} {Number(log.amountDue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] uppercase font-bold">
                          {log.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
