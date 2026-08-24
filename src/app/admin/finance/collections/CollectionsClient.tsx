'use client';

/**
 * SmartSapp Finance 2.0 - Collections Pipeline Command Center
 * Dedicated workspace for managing active debt collection cases, promise-to-pay tracking,
 * and stage transitions.
 */

import * as React from 'react';
import { 
  Building2, 
  Search, 
  Handshake, 
  Split, 
  PhoneCall, 
  TrendingDown, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { CollectionCase, CollectionStage, CollectionPriority } from '@/lib/types';
import { 
  updateCaseStageAction, 
  evaluatePromisesAction 
} from '@/lib/collection-actions';
import { RecordPromiseToPayModal } from '@/components/finance/RecordPromiseToPayModal';
import { CreatePaymentPlanModal } from '@/components/finance/CreatePaymentPlanModal';
import { LogCollectionActivityModal } from '@/components/finance/LogCollectionActivityModal';
import Link from 'next/link';

export function CollectionsClient() {
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [stageFilter, setStageFilter] = React.useState<string>('all');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [isEvaluating, setIsEvaluating] = React.useState<boolean>(false);

  // Modals state
  const [activeCaseForPtp, setActiveCaseForPtp] = React.useState<CollectionCase | null>(null);
  const [activeCaseForPlan, setActiveCaseForPlan] = React.useState<CollectionCase | null>(null);
  const [activeCaseForActivity, setActiveCaseForActivity] = React.useState<CollectionCase | null>(null);

  // Query collection cases
  const casesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'collection_cases'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: rawCases, isLoading } = useCollection<CollectionCase>(casesQuery);
  const cases = React.useMemo(() => rawCases || [], [rawCases]);

  // Aggregate Metrics
  const metrics = React.useMemo(() => {
    let totalDebt = 0;
    let activeCases = 0;
    let criticalCases = 0;
    let resolvedCases = 0;

    for (const c of cases) {
      if (c.stage === 'resolved') {
        resolvedCases++;
      } else {
        activeCases++;
        totalDebt += Number(c.totalDebt || 0);
        if (c.priority === 'critical' || c.priority === 'high') {
          criticalCases++;
        }
      }
    }

    return {
      totalDebt: Math.round(totalDebt * 100) / 100,
      activeCases,
      criticalCases,
      resolvedCases,
    };
  }, [cases]);

  // Filtered cases
  const filteredCases = React.useMemo(() => {
    return cases.filter((c) => {
      const matchesStage = stageFilter === 'all' || c.stage === stageFilter;
      const matchesPriority = priorityFilter === 'all' || c.priority === priorityFilter;
      const matchesSearch =
        !searchTerm.trim() ||
        c.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.caseNumber.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStage && matchesPriority && matchesSearch;
    });
  }, [cases, stageFilter, priorityFilter, searchTerm]);

  // Stage change handler
  const handleStageChange = async (caseId: string, newStage: CollectionStage) => {
    if (!user || !activeWorkspaceId) return;

    const res = await updateCaseStageAction(
      caseId,
      newStage,
      activeWorkspaceId,
      user.uid,
      user.displayName || user.email || 'Collection Officer'
    );

    if (res.success) {
      toast({
        title: 'Stage Updated',
        description: `Case advanced to stage '${newStage}'.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to update stage',
        description: res.error,
      });
    }
  };

  // Evaluate promises monitor
  const handleRunPtpMonitor = async () => {
    if (!user || !activeWorkspaceId) return;
    setIsEvaluating(true);
    const res = await evaluatePromisesAction(
      activeWorkspaceId,
      user.uid,
      user.displayName || user.email || 'Collection Officer'
    );
    setIsEvaluating(false);

    if (res.success) {
      toast({
        title: 'PTP Audit Complete',
        description: `${res.brokenCount || 0} broken commitments identified and escalated.`,
      });
    }
  };

  const getStageBadge = (stage: CollectionStage) => {
    switch (stage) {
      case 'upcoming': return <Badge variant="outline" className="text-muted-foreground">Upcoming</Badge>;
      case 'reminder': return <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20">Stage 1: Reminder</Badge>;
      case 'follow_up': return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Stage 2: Follow-up</Badge>;
      case 'active_collection': return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Stage 3: Active</Badge>;
      case 'escalation': return <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 font-bold">Stage 4: Escalation</Badge>;
      case 'final_notice': return <Badge className="bg-red-600 text-white font-bold">Stage 5: Final Notice</Badge>;
      case 'payment_arrangement': return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 font-bold">Stage 6: Arrangement</Badge>;
      case 'legal_external': return <Badge className="bg-slate-900 text-white font-bold">Stage 7: Legal</Badge>;
      case 'resolved': return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold">Stage 8: Resolved</Badge>;
    }
  };

  const getPriorityBadge = (priority: CollectionPriority) => {
    switch (priority) {
      case 'critical': return <Badge variant="destructive" className="font-bold">Critical</Badge>;
      case 'high': return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 font-semibold">High</Badge>;
      case 'medium': return <Badge variant="outline" className="text-amber-600">Medium</Badge>;
      case 'low': return <Badge variant="outline" className="text-muted-foreground">Low</Badge>;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <ShieldAlert className="h-4 w-4" />
            Recovery & Risk Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Debt Collections Pipeline
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage multi-invoice delinquent accounts, promise-to-pay commitments, and recovery milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunPtpMonitor}
            disabled={isEvaluating}
            className="rounded-xl h-10 min-h-[44px] text-xs font-semibold active:scale-[0.97]"
          >
            {isEvaluating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Audit PTP Commitments
          </Button>

          <Button
            size="sm"
            asChild
            className="rounded-xl h-10 min-h-[44px] text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.97]"
          >
            <Link href="/admin/finance/receivables">
              <TrendingDown className="h-3.5 w-3.5 mr-1.5" />
              View Receivables
            </Link>
          </Button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            Debt in Collection
          </div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-rose-600">
            GHS {metrics.totalDebt.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Across all open collection cases</p>
        </Card>

        <Card className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ShieldAlert className="h-4 w-4 text-orange-500" />
            Active Collection Cases
          </div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
            {metrics.activeCases}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Requiring ongoing recovery outreach</p>
        </Card>

        <Card className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Clock className="h-4 w-4 text-amber-500" />
            High / Critical Priority
          </div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-amber-600">
            {metrics.criticalCases}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Stages 4+ or &gt;60d overdue debt</p>
        </Card>

        <Card className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Resolved Cases
          </div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-emerald-600">
            {metrics.resolvedCases}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Successfully settled or recovered</p>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="rounded-2xl border shadow-sm">
        <div className="p-4 border-b space-y-4">
          {/* Controls Header */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search case # or debtor name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl h-10 min-h-[44px] text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px] rounded-xl h-10 min-h-[44px] text-xs">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stage Tabs */}
          <Tabs value={stageFilter} onValueChange={setStageFilter} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto h-11 bg-muted/60 p-1 rounded-xl">
              <TabsTrigger value="all" className="rounded-lg text-xs font-semibold">All Cases ({cases.length})</TabsTrigger>
              <TabsTrigger value="reminder" className="rounded-lg text-xs font-semibold">Reminder</TabsTrigger>
              <TabsTrigger value="follow_up" className="rounded-lg text-xs font-semibold">Follow-up</TabsTrigger>
              <TabsTrigger value="active_collection" className="rounded-lg text-xs font-semibold">Active</TabsTrigger>
              <TabsTrigger value="escalation" className="rounded-lg text-xs font-semibold">Escalation</TabsTrigger>
              <TabsTrigger value="payment_arrangement" className="rounded-lg text-xs font-semibold">Arrangement</TabsTrigger>
              <TabsTrigger value="resolved" className="rounded-lg text-xs font-semibold">Resolved</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs font-medium">Loading collection cases...</p>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto opacity-70" />
              <p className="text-sm font-semibold text-foreground">No Collection Cases Found</p>
              <p className="text-xs max-w-sm mx-auto">
                No active delinquent cases match your filter criteria. Delinquent accounts can be escalated directly from the Receivables Hub.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-bold">Case #</TableHead>
                    <TableHead className="text-xs font-bold">Debtor Entity</TableHead>
                    <TableHead className="text-xs font-bold text-right">Total Debt</TableHead>
                    <TableHead className="text-xs font-bold text-center">Oldest Age</TableHead>
                    <TableHead className="text-xs font-bold text-center">Stage</TableHead>
                    <TableHead className="text-xs font-bold text-center">Priority</TableHead>
                    <TableHead className="text-xs font-bold">Next Action</TableHead>
                    <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCases.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        <Link 
                          href={`/admin/finance/collections/${c.id}`}
                          className="hover:underline text-primary flex items-center gap-1"
                        >
                          {c.caseNumber}
                          <ArrowRight className="h-3 w-3 opacity-60" />
                        </Link>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Building2 className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="font-semibold text-xs text-foreground line-clamp-1">{c.entityName}</p>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {c.invoiceNumbers?.length || 0} Invoices linked
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-bold text-xs text-rose-600 font-mono">
                        {c.currency} {Number(c.totalDebt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>

                      <TableCell className="text-center text-xs font-semibold">
                        <span className={c.oldestInvoiceDays > 60 ? 'text-rose-600 font-bold' : 'text-foreground'}>
                          {c.oldestInvoiceDays}d
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        {getStageBadge(c.stage)}
                      </TableCell>

                      <TableCell className="text-center">
                        {getPriorityBadge(c.priority)}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {c.nextAction || 'Outreach pending'}
                        {c.nextActionDate && (
                          <span className="block text-[10px] text-foreground font-medium">
                            Due: {c.nextActionDate}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 active:scale-[0.97]"
                            onClick={() => setActiveCaseForActivity(c)}
                            title="Log Activity"
                          >
                            <PhoneCall className="h-3.5 w-3.5 mr-1" /> Log
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 rounded-lg text-xs font-bold text-purple-600 hover:bg-purple-500/10 active:scale-[0.97]"
                            onClick={() => setActiveCaseForPtp(c)}
                            title="Record Promise-to-Pay"
                          >
                            <Handshake className="h-3.5 w-3.5 mr-1" /> PTP
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 rounded-lg text-xs font-bold text-amber-600 hover:bg-amber-500/10 active:scale-[0.97]"
                            onClick={() => setActiveCaseForPlan(c)}
                            title="Payment Plan"
                          >
                            <Split className="h-3.5 w-3.5 mr-1" /> Plan
                          </Button>

                          <Select 
                            value={c.stage} 
                            onValueChange={(val) => handleStageChange(c.id, val as CollectionStage)}
                          >
                            <SelectTrigger className="h-8 w-24 rounded-lg text-[10px] font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                              <SelectItem value="reminder">Reminder</SelectItem>
                              <SelectItem value="follow_up">Follow-up</SelectItem>
                              <SelectItem value="active_collection">Active</SelectItem>
                              <SelectItem value="escalation">Escalate</SelectItem>
                              <SelectItem value="final_notice">Final Notice</SelectItem>
                              <SelectItem value="payment_arrangement">Arrangement</SelectItem>
                              <SelectItem value="legal_external">Legal</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {activeCaseForPtp && (
        <RecordPromiseToPayModal
          isOpen={Boolean(activeCaseForPtp)}
          onClose={() => setActiveCaseForPtp(null)}
          caseId={activeCaseForPtp.id}
          accountId={activeCaseForPtp.accountId}
          entityId={activeCaseForPtp.entityId}
          entityName={activeCaseForPtp.entityName}
          defaultAmount={activeCaseForPtp.totalDebt}
          currency={activeCaseForPtp.currency}
        />
      )}

      {activeCaseForPlan && (
        <CreatePaymentPlanModal
          isOpen={Boolean(activeCaseForPlan)}
          onClose={() => setActiveCaseForPlan(null)}
          caseId={activeCaseForPlan.id}
          accountId={activeCaseForPlan.accountId}
          entityId={activeCaseForPlan.entityId}
          entityName={activeCaseForPlan.entityName}
          totalDebt={activeCaseForPlan.totalDebt}
          currency={activeCaseForPlan.currency}
        />
      )}

      {activeCaseForActivity && (
        <LogCollectionActivityModal
          isOpen={Boolean(activeCaseForActivity)}
          onClose={() => setActiveCaseForActivity(null)}
          caseId={activeCaseForActivity.id}
          entityId={activeCaseForActivity.entityId}
          entityName={activeCaseForActivity.entityName}
        />
      )}
    </div>
  );
}
