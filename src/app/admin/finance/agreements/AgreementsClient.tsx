'use client';

/**
 * SmartSapp Finance 2.0 - Billing Agreements Management Client
 * Institutional contracts registry, pricing bindings, and automated cycle billing manager.
 */

import * as React from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  FileText, 
  PauseCircle, 
  Play, 
  Loader2, 
  TrendingUp, 
  DollarSign, 
  ShieldCheck, 
  Zap 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedEntitySelector } from '@/components/entities/UnifiedEntitySelector';
import { ExecuteRecurringBillingModal } from '@/components/finance/ExecuteRecurringBillingModal';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTerminology } from '@/hooks/use-terminology';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { 
  BillingAgreement, 
  BillingProfile, 
  FinanceProduct, 
  AgreementStatus, 
  BillingFrequency 
} from '@/lib/types';
import { createAgreementAction, updateAgreementAction } from '@/lib/agreement-actions';
import { SearchedEntity } from '@/hooks/use-entity-search';

export function AgreementsClient() {
  const { user } = useUser();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { singular } = useTerminology();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [isCreating, setIsCreating] = React.useState<boolean>(false);
  const [isCycleBillingOpen, setIsCycleBillingOpen] = React.useState<boolean>(false);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  // Form State for New Agreement
  const [selectedEntityId, setSelectedEntityId] = React.useState<string | null>(null);
  const [selectedEntityName, setSelectedEntityName] = React.useState<string>('');
  const [productId, setProductId] = React.useState<string>('standard_subscription');
  const [productName, setProductName] = React.useState<string>('Standard Institutional Subscription');
  const [quantity, setQuantity] = React.useState<number>(100);
  const [ratePerUnit, setRatePerUnit] = React.useState<number>(40);
  const currency = 'GHS';
  const [billingFrequency, setBillingFrequency] = React.useState<BillingFrequency>('termly');
  const [billingProfileId, setBillingProfileId] = React.useState<string>('');
  const [startDate, setStartDate] = React.useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = React.useState<string>('');
  const [paymentTermsDays, setPaymentTermsDays] = React.useState<number>(30);

  // Query Agreements
  const agreementsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'billing_agreements'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: agreements, isLoading: isLoadingAgreements } = useCollection<BillingAgreement>(agreementsQuery);

  // Query Profiles
  const profilesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'billing_profiles'),
      where('workspaceIds', 'array-contains', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);
  const { data: profiles } = useCollection<BillingProfile>(profilesQuery);

  // Set default profile
  React.useEffect(() => {
    if (profiles && profiles.length > 0 && !billingProfileId) {
      setBillingProfileId(profiles[0].id);
    }
  }, [profiles, billingProfileId]);

  // Query Products
  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'finance_products'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      where('isActive', '==', true)
    );
  }, [firestore, activeWorkspaceId]);
  const { data: products } = useCollection<FinanceProduct>(productsQuery);

  // KPI Metrics
  const kpiStats = React.useMemo(() => {
    if (!agreements) return { totalActive: 0, totalCycleValue: 0, averageValue: 0 };
    const activeList = agreements.filter((a: BillingAgreement) => a.status === 'active');
    const totalCycleValue = activeList.reduce((sum: number, a: BillingAgreement) => sum + (Number(a.totalAmountPerCycle) || 0), 0);
    const averageValue = activeList.length > 0 ? totalCycleValue / activeList.length : 0;

    return {
      totalActive: activeList.length,
      totalCycleValue: Math.round(totalCycleValue * 100) / 100,
      averageValue: Math.round(averageValue * 100) / 100,
    };
  }, [agreements]);

  // Filtered Agreements
  const filteredAgreements = React.useMemo(() => {
    if (!agreements) return [];
    let list = agreements;
    if (statusFilter !== 'all') {
      list = list.filter((a: BillingAgreement) => a.status === statusFilter);
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(
        (a: BillingAgreement) =>
          a.agreementNumber.toLowerCase().includes(s) ||
          a.entityName.toLowerCase().includes(s) ||
          a.productName.toLowerCase().includes(s)
      );
    }
    return list;
  }, [agreements, statusFilter, searchTerm]);

  const handleProductSelect = (selectedId: string) => {
    setProductId(selectedId);
    const found = products?.find((p: FinanceProduct) => p.id === selectedId);
    if (found) {
      setProductName(found.name);
      if (found.defaultBillingProfileId) {
        setBillingProfileId(found.defaultBillingProfileId);
      }
    }
  };

  const handleCreateAgreement = async () => {
    if (!selectedEntityId || !billingProfileId || !startDate || !user?.uid || !activeWorkspaceId) {
      toast({
        title: 'Validation Error',
        description: 'Please select an institution, product, and billing profile.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await createAgreementAction({
        workspaceId: activeWorkspaceId,
        userId: user.uid,
        entityId: selectedEntityId,
        entityName: selectedEntityName || 'Organization',
        productId,
        productName,
        quantity,
        ratePerUnit,
        currency,
        billingFrequency,
        billingProfileId,
        startDate,
        endDate: endDate || undefined,
        paymentTermsDays,
      });

      if (res.success && res.agreement) {
        toast({
          title: 'Agreement Created',
          description: `Agreement ${res.agreement.agreementNumber} created successfully.`,
          actionConfig: {
            path: '/admin/finance/agreements',
            label: 'View Agreements',
          },
        });
        setIsCreating(false);
        // Reset form
        setSelectedEntityId(null);
        setSelectedEntityName('');
      } else {
        toast({
          title: 'Creation Failed',
          description: res.error || 'Failed to create billing agreement.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating agreement';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (agreement: BillingAgreement, newStatus: AgreementStatus) => {
    if (!user?.uid || !activeWorkspaceId) return;
    try {
      const res = await updateAgreementAction(agreement.id, activeWorkspaceId, user.uid, {
        status: newStatus,
      });
      if (res.success) {
        toast({
          title: 'Status Updated',
          description: `Agreement ${agreement.agreementNumber} marked as ${newStatus}.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update error';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: AgreementStatus) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">Active</Badge>;
      case 'paused':
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[10px]">Paused</Badge>;
      case 'cancelled':
        return <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold text-[10px]">Cancelled</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="font-bold text-[10px]">Expired</Badge>;
      default:
        return <Badge variant="outline" className="font-bold text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-primary" />
            Billing Agreements
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Institutional recurring contracts, agreed pricing rates, and automated cycle billing for {activeWorkspace?.name || activeWorkspaceId}
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            className="h-11 min-h-[44px] rounded-2xl px-4 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 active:scale-[0.97] flex-1 sm:flex-initial"
            onClick={() => setIsCycleBillingOpen(true)}
          >
            <Zap className="h-4 w-4 mr-1.5 fill-primary/20" /> Run Cycle Invoicing
          </Button>
          <Button
            className="h-11 min-h-[44px] rounded-2xl px-5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] shadow-lg shadow-primary/20 flex-1 sm:flex-initial"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" /> New Agreement
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-3xl border-border bg-card shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Contracts</p>
              <h3 className="text-2xl font-black text-foreground mt-1">{kpiStats.totalActive}</h3>
              <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                Contracted institutions
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Building2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border bg-card shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recurring Value / Cycle</p>
              <h3 className="text-2xl font-black text-foreground mt-1">
                GHS {kpiStats.totalCycleValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] font-medium text-muted-foreground mt-1">
                Per standard term / billing cycle
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border bg-card shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Average Contract Value</p>
              <h3 className="text-2xl font-black text-foreground mt-1">
                GHS {kpiStats.averageValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] font-medium text-muted-foreground mt-1">
                Per active institutional customer
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <DollarSign className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-sm">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
          <TabsList className="bg-muted/50 rounded-xl p-1 h-9">
            <TabsTrigger value="all" className="rounded-lg text-xs font-bold px-3">All</TabsTrigger>
            <TabsTrigger value="active" className="rounded-lg text-xs font-bold px-3">Active</TabsTrigger>
            <TabsTrigger value="paused" className="rounded-lg text-xs font-bold px-3">Paused</TabsTrigger>
            <TabsTrigger value="expired" className="rounded-lg text-xs font-bold px-3">Expired</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${singular.toLowerCase()} or contract #...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 min-h-[40px] rounded-xl text-xs bg-background font-medium"
          />
        </div>
      </div>

      {/* Agreements Registry Table */}
      <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border">
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase pl-6 py-4">Contract #</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase">Target {singular}</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase">Product & Plan</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase">Units × Rate</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase text-right">Cycle Total</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase text-center">Frequency</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase text-center">Status</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingAgreements ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                      <p className="text-xs font-semibold text-muted-foreground mt-2">Loading agreements...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredAgreements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center">
                      <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                      <p className="text-sm font-bold text-foreground mt-2">No billing agreements found</p>
                      <p className="text-xs text-muted-foreground font-medium mt-1">
                        Create recurring contracts to automate termly and monthly billing
                      </p>
                      <Button
                        size="sm"
                        className="mt-4 h-9 rounded-xl text-xs font-bold bg-primary active:scale-[0.97]"
                        onClick={() => setIsCreating(true)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Create First Agreement
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAgreements.map((agreement: BillingAgreement) => (
                    <TableRow key={agreement.id} className="border-border hover:bg-muted/20 transition-colors">
                      <TableCell className="pl-6 py-4 font-mono font-bold text-xs text-foreground">
                        {agreement.agreementNumber}
                      </TableCell>
                      <TableCell className="font-bold text-xs text-foreground">
                        {agreement.entityName}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {agreement.productName}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">
                        {agreement.quantity} × {agreement.currency} {agreement.ratePerUnit.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs font-black text-foreground text-right">
                        {agreement.currency} {agreement.totalAmountPerCycle.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase">
                          {agreement.billingFrequency}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(agreement.status)}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {agreement.status === 'active' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs font-bold text-amber-600 hover:bg-amber-500/10 rounded-lg active:scale-[0.97]"
                              onClick={() => handleToggleStatus(agreement, 'paused')}
                              title="Pause Billing"
                            >
                              <PauseCircle className="h-3.5 w-3.5 mr-1" /> Pause
                            </Button>
                          ) : agreement.status === 'paused' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs font-bold text-emerald-600 hover:bg-emerald-500/10 rounded-lg active:scale-[0.97]"
                              onClick={() => handleToggleStatus(agreement, 'active')}
                              title="Resume Billing"
                            >
                              <Play className="h-3.5 w-3.5 mr-1 fill-emerald-600" /> Resume
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* New Agreement Modal */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-[560px] rounded-3xl p-6 border-border shadow-2xl bg-card">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-lg font-black tracking-tight text-foreground">
              New Institutional Billing Agreement
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground">
              Configure a recurring contract with agreed rates and automated cycle schedule
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Target Entity Selector */}
            <div className="space-y-1.5 text-left">
              <Label className="text-xs font-bold text-foreground">Target {singular} *</Label>
              <UnifiedEntitySelector
                value={selectedEntityId}
                onChange={(val: string, entity?: SearchedEntity) => {
                  setSelectedEntityId(val || null);
                  if (entity) {
                    setSelectedEntityName(entity.displayName || entity.entityName || 'Organization');
                  }
                }}
                valueKey="id"
                placeholder={`Select ${singular.toLowerCase()}...`}
              />
            </div>

            {/* Product & Plan */}
            <div className="space-y-1.5 text-left">
              <Label className="text-xs font-bold text-foreground">Product / Service Package *</Label>
              <Select value={productId} onValueChange={handleProductSelect}>
                <SelectTrigger className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs text-foreground">
                  <SelectValue placeholder="Select Product" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="standard_subscription" className="text-xs">
                    Standard Institutional Subscription
                  </SelectItem>
                  {products?.map((p: FinanceProduct) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name} (SKU: {p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity & Rate */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-bold text-foreground">Headcount / Units *</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                  className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs"
                />
              </div>
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-bold text-foreground">Rate Per Unit ({currency}) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={ratePerUnit}
                  onChange={(e) => setRatePerUnit(Number(e.target.value) || 0)}
                  className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs"
                />
              </div>
            </div>

            {/* Calculated Preview Box */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Estimated Cycle Total</p>
                <p className="text-lg font-black text-foreground">
                  {currency} {(quantity * ratePerUnit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Badge className="bg-primary/15 text-primary font-bold text-xs uppercase px-3 py-1">
                {billingFrequency}
              </Badge>
            </div>

            {/* Billing Frequency & Profile */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-bold text-foreground">Billing Frequency</Label>
                <Select value={billingFrequency} onValueChange={(v) => setBillingFrequency(v as BillingFrequency)}>
                  <SelectTrigger className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="termly" className="text-xs">Termly (3x / year)</SelectItem>
                    <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                    <SelectItem value="quarterly" className="text-xs">Quarterly</SelectItem>
                    <SelectItem value="annual" className="text-xs">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-bold text-foreground">Tax / Billing Profile *</Label>
                <Select value={billingProfileId} onValueChange={setBillingProfileId}>
                  <SelectTrigger className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs">
                    <SelectValue placeholder="Select Profile" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {profiles?.map((p: BillingProfile) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name} (VAT: {p.vatPercent}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Start and End Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-bold text-foreground">Agreement Start Date *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs"
                />
              </div>
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-bold text-foreground">End Date (Optional)</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <Label className="text-xs font-bold text-foreground">Payment Terms (Days)</Label>
              <Input
                type="number"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(Number(e.target.value) || 30)}
                className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="h-11 min-h-[44px] rounded-xl px-5 text-xs font-bold active:scale-[0.97]"
              onClick={() => setIsCreating(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              className="h-11 min-h-[44px] rounded-xl px-6 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
              onClick={handleCreateAgreement}
              disabled={isSaving || !selectedEntityId}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving Contract...
                </>
              ) : (
                'Create Agreement'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cycle Billing Runner Modal */}
      <ExecuteRecurringBillingModal
        isOpen={isCycleBillingOpen}
        onClose={() => setIsCycleBillingOpen(false)}
      />
    </div>
  );
}
