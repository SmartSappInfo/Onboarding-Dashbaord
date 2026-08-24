'use client';

/**
 * SmartSapp Finance 2.0 - Product & Service Catalogue Client
 * Manages product taxonomy, SKUs, billing units, and tax bindings.
 */

import * as React from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Loader2 
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
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { FinanceProduct, BillingProfile } from '@/lib/types';
import { createProductAction, updateProductAction } from '@/lib/product-actions';

export function ProductsClient() {
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [isCreating, setIsCreating] = React.useState<boolean>(false);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  // Form State
  const [name, setName] = React.useState<string>('');
  const [sku, setSku] = React.useState<string>('');
  const [description, setDescription] = React.useState<string>('');
  const [category, setCategory] = React.useState<FinanceProduct['category']>('subscription');
  const [unitName, setUnitName] = React.useState<string>('student');
  const currency = 'GHS';
  const [defaultBillingProfileId, setDefaultBillingProfileId] = React.useState<string>('');

  // Query Products
  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'finance_products'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: products, isLoading } = useCollection<FinanceProduct>(productsQuery);

  // Query Profiles
  const profilesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'billing_profiles'),
      where('workspaceIds', 'array-contains', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);
  const { data: profiles } = useCollection<BillingProfile>(profilesQuery);

  const filteredProducts = React.useMemo(() => {
    if (!products) return [];
    if (!searchTerm) return products;
    const s = searchTerm.toLowerCase();
    return products.filter(
      (p: FinanceProduct) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s)
    );
  }, [products, searchTerm]);

  const handleCreate = async () => {
    if (!name.trim() || !sku.trim() || !user?.uid || !activeWorkspaceId) {
      toast({
        title: 'Validation Error',
        description: 'Product name and SKU are required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await createProductAction({
        workspaceId: activeWorkspaceId,
        userId: user.uid,
        name,
        sku,
        description,
        category,
        unitName,
        currency,
        defaultBillingProfileId: defaultBillingProfileId || undefined,
      });

      if (res.success) {
        toast({
          title: 'Product Created',
          description: `Product ${name} added to catalogue.`,
        });
        setIsCreating(false);
        setName('');
        setSku('');
        setDescription('');
      } else {
        toast({
          title: 'Creation Failed',
          description: res.error || 'Failed to create product.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating product';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (prod: FinanceProduct) => {
    if (!user?.uid || !activeWorkspaceId) return;
    try {
      await updateProductAction(prod.id, activeWorkspaceId, user.uid, {
        isActive: !prod.isActive,
      });
      toast({
        title: 'Status Updated',
        description: `${prod.name} is now ${!prod.isActive ? 'active' : 'inactive'}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update error';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Package className="h-7 w-7 text-primary" />
            Product & Service Catalogue
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Institutional billing products, SKUs, units of measure, and default tax configurations
          </p>
        </div>

        <Button
          className="h-11 min-h-[44px] rounded-2xl px-5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] shadow-lg shadow-primary/20"
          onClick={() => setIsCreating(true)}
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Product / Service
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 min-h-[40px] rounded-xl text-xs bg-background font-medium"
          />
        </div>
      </div>

      {/* Products Table */}
      <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border">
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase pl-6 py-4">Product Name</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase">SKU</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase">Category</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase">Unit Name</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase">Currency</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase text-center">Status</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                      <p className="text-xs font-semibold text-muted-foreground mt-2">Loading catalogue...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <Package className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                      <p className="text-sm font-bold text-foreground mt-2">No products in catalogue</p>
                      <p className="text-xs text-muted-foreground font-medium mt-1">
                        Add institutional software subscriptions, assessments, and services
                      </p>
                      <Button
                        size="sm"
                        className="mt-4 h-9 rounded-xl text-xs font-bold bg-primary active:scale-[0.97]"
                        onClick={() => setIsCreating(true)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Product
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((prod: FinanceProduct) => (
                    <TableRow key={prod.id} className="border-border hover:bg-muted/20 transition-colors">
                      <TableCell className="pl-6 py-4 font-bold text-xs text-foreground">
                        {prod.name}
                        {prod.description && (
                          <p className="text-[11px] font-normal text-muted-foreground line-clamp-1">{prod.description}</p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-xs text-primary">
                        {prod.sku}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase">
                          {prod.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {prod.unitName}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-foreground">
                        {prod.currency}
                      </TableCell>
                      <TableCell className="text-center">
                        {prod.isActive ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="font-bold text-[10px]">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-bold text-muted-foreground hover:text-foreground rounded-lg active:scale-[0.97]"
                          onClick={() => handleToggleActive(prod)}
                        >
                          {prod.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* New Product Modal */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl p-6 border-border shadow-2xl bg-card">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-lg font-black tracking-tight text-foreground">
              Add New Product / Service
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground">
              Register a billable product or subscription tier in the catalogue
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5 text-left">
              <Label className="text-xs font-bold text-foreground">Product / Service Name *</Label>
              <Input
                placeholder="e.g. SmartSapp Enterprise SIS Access"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-bold text-foreground">SKU Code *</Label>
                <Input
                  placeholder="e.g. SS-SIS-001"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  className="rounded-xl h-11 min-h-[44px] bg-background font-mono font-bold text-xs uppercase"
                />
              </div>
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-bold text-foreground">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as FinanceProduct['category'])}>
                  <SelectTrigger className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="subscription" className="text-xs">Subscription</SelectItem>
                    <SelectItem value="service" className="text-xs">Professional Service</SelectItem>
                    <SelectItem value="assessment" className="text-xs">Assessment Fee</SelectItem>
                    <SelectItem value="hardware" className="text-xs">Hardware / Device</SelectItem>
                    <SelectItem value="other" className="text-xs">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-bold text-foreground">Unit Name (Metric)</Label>
                <Input
                  placeholder="e.g. student, seat, school"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs"
                />
              </div>
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-bold text-foreground">Default Tax Profile</Label>
                <Select value={defaultBillingProfileId} onValueChange={setDefaultBillingProfileId}>
                  <SelectTrigger className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs">
                    <SelectValue placeholder="Standard Profile" />
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

            <div className="space-y-1.5 text-left">
              <Label className="text-xs font-bold text-foreground">Description (Optional)</Label>
              <Input
                placeholder="Institutional subscription terms and coverage details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl h-11 min-h-[44px] bg-background font-medium text-xs"
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
              onClick={handleCreate}
              disabled={isSaving || !name || !sku}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Save Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
