'use client';

/**
 * @fileoverview Deal Line Items & Products/Services Management Tab
 *
 * ARCHITECTURAL POINTER (Revenue & Line Items Engine):
 * Manages product/service line items attached to a Deal:
 * - Real-time calculation of subtotals, discounts, tax, and grand total.
 * - Atomic persistence to Firestore via `saveDealLineItemsAction` with live `deal.value` synchronization.
 * - Quote generator creating formal commercial proposals with unique quote tokens.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All monetary inputs must be validated numbers >= 0.
 * - Currency formatting must exclusively route through `formatCurrency()`.
 * - Zero 'any' or 'any[]' in types or handlers.
 *
 * TESTABILITY POINTER:
 * Verify editing rows updates subtotal and saving triggers toast with updated grandTotal.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  FileText, 
  Check, 
  Loader2, 
  ShoppingBag, 
  Receipt,
  Copy,
  ExternalLink,
  MoreVertical,
  Calendar,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  CreditCard,
  Package,
  TrendingUp,
  Repeat
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency-utils';
import { calculateLineItemsTotals } from '@/lib/deals/deal-health-engine';
import { 
  saveDealLineItemsAction, 
  createDealQuoteAction,
  updateQuoteStatusAction,
  convertQuoteToInvoiceAction,
  deleteDealQuoteAction
} from '@/app/actions/deal-line-item-actions';
import { listProductsAction } from '@/app/actions/product-actions';
import type { Deal, DealLineItem, DealQuote, Product } from '@/lib/types';
import { nanoid } from 'nanoid';

interface DealLineItemsTabProps {
  deal: Deal;
  onDealUpdated?: () => void;
}

export default function DealLineItemsTab({ deal, onDealUpdated }: DealLineItemsTabProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();

  const [items, setItems] = React.useState<DealLineItem[]>(() => {
    return Array.isArray(deal.lineItems) ? deal.lineItems : [];
  });
  const [contractTermMonths, setContractTermMonths] = React.useState<number>(() => {
    return deal.contractTermMonths || 12;
  });
  const [isSaving, setIsSaving] = React.useState(false);

  // Catalog Products state
  const [catalogProducts, setCatalogProducts] = React.useState<Product[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = React.useState(false);

  React.useEffect(() => {
    if (!deal.workspaceId) return;
    setIsLoadingCatalog(true);
    listProductsAction(deal.workspaceId, false)
      .then(res => {
        if (res.success && res.products) {
          setCatalogProducts(res.products);
        }
      })
      .catch(err => console.error('Failed to load catalog products:', err))
      .finally(() => setIsLoadingCatalog(false));
  }, [deal.workspaceId]);

  // Quotes Real-Time Subscription
  const quotesQuery = useMemoFirebase(() => {
    if (!firestore || !deal.id) return null;
    return query(
      collection(firestore, 'deal_quotes'),
      where('dealId', '==', deal.id)
    );
  }, [firestore, deal.id]);

  const { data: quotesData, isLoading: isLoadingQuotes } = useCollection<DealQuote>(quotesQuery);

  const sortedQuotes = React.useMemo(() => {
    if (!quotesData) return [];
    return [...quotesData].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [quotesData]);

  // Quote Generation Modal state
  const [isQuoteModalOpen, setIsQuoteModalOpen] = React.useState(false);
  const [isGeneratingQuote, setIsGeneratingQuote] = React.useState(false);
  const [quoteNotes, setQuoteNotes] = React.useState('');
  const [quoteTerms, setQuoteTerms] = React.useState('Payment due within 30 days of invoice.');
  const [createdQuote, setCreatedQuote] = React.useState<DealQuote | null>(null);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  // Sync state if deal.lineItems change externally
  React.useEffect(() => {
    if (Array.isArray(deal.lineItems)) {
      setItems(deal.lineItems);
    }
  }, [deal.lineItems]);

  const totals = React.useMemo(() => {
    return calculateLineItemsTotals(items, contractTermMonths);
  }, [items, contractTermMonths]);

  const handleAddItem = () => {
    const newItem: DealLineItem = {
      id: `item_${nanoid(8)}`,
      name: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
      taxRate: 0,
      total: 0,
      isRecurring: false,
      billingInterval: 'one_time',
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleAddProductFromCatalog = (product: Product) => {
    const newItem: DealLineItem = {
      id: `item_${nanoid(8)}`,
      productId: product.id,
      name: product.name,
      description: product.description || '',
      quantity: 1,
      unitPrice: product.unitPrice || 0,
      discountPercent: 0,
      taxRate: product.taxRate || 0,
      isRecurring: product.isRecurring,
      billingInterval: product.billingInterval || (product.isRecurring ? 'monthly' : 'one_time'),
      total: product.unitPrice || 0,
    };
    setItems(prev => [...prev, newItem]);
    toast({
      title: 'Product Added',
      description: `Added "${product.name}" from catalog.`,
    });
  };

  const handleUpdateItem = (id: string, updates: Partial<DealLineItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };

      // Recalculate row total
      const rowSubtotal = (updated.quantity || 1) * (updated.unitPrice || 0);
      let rowDiscount = updated.discount || 0;
      if (updated.discountPercent && updated.discountPercent > 0) {
        rowDiscount += (rowSubtotal * updated.discountPercent) / 100;
      }
      const taxable = Math.max(0, rowSubtotal - rowDiscount);
      const tax = updated.taxRate ? (taxable * updated.taxRate) / 100 : 0;
      updated.total = Math.max(0, Math.round((rowSubtotal - rowDiscount + tax) * 100) / 100);

      return updated;
    }));
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveItems = async () => {
    if (!deal.id) return;
    setIsSaving(true);

    try {
      const res = await saveDealLineItemsAction(deal.id, items, user?.uid, contractTermMonths, deal.priceBookId);
      if (res.success) {
        toast({
          title: 'Line Items Saved',
          description: `Deal value synchronized to ${formatCurrency(res.grandTotal || totals.grandTotal)} (MRR: ${formatCurrency(res.mrr || totals.mrr)}).`,
        });
        if (onDealUpdated) onDealUpdated();
      } else {
        throw new Error(res.error || 'Failed to save line items');
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      toast({ variant: 'destructive', title: 'Save Failed', description: error });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateQuote = async () => {
    if (!deal.id) return;
    setIsGeneratingQuote(true);

    try {
      // ARCHITECTURAL POINTER (Rule 10 - Auto-Save Pre-Flight):
      // Automatically persist current in-memory line items before quote creation
      // to guarantee the generated commercial quote reflects the latest UI inputs.
      const saveRes = await saveDealLineItemsAction(deal.id, items, user?.uid, contractTermMonths, deal.priceBookId);
      if (!saveRes.success) {
        throw new Error(saveRes.error || 'Failed to synchronize line items before quote generation.');
      }
      onDealUpdated?.();

      const res = await createDealQuoteAction(deal.id, {
        notes: quoteNotes,
        terms: quoteTerms,
        validDays: 30,
      }, user?.uid);

      if (res.success && res.quote) {
        setCreatedQuote(res.quote);
        toast({
          title: 'Commercial Quote Generated',
          description: `Quote #${res.quote.quoteNumber} created successfully.`,
        });
      } else {
        throw new Error(res.error || 'Failed to generate quote');
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      toast({ variant: 'destructive', title: 'Quote Failed', description: error });
    } finally {
      setIsGeneratingQuote(false);
    }
  };

  const handleCopyQuoteLink = (token?: string) => {
    if (!token) return;
    const url = `${window.location.origin}/quotes/${token}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link Copied to Clipboard',
      description: 'Customer can view, download PDF, and digitally accept this proposal.',
    });
  };

  const handleUpdateQuoteStatus = async (quoteId: string, status: DealQuote['status']) => {
    setActionLoadingId(quoteId);
    try {
      const res = await updateQuoteStatusAction(quoteId, status, undefined, user?.uid);
      if (res.success) {
        toast({
          title: 'Quote Status Updated',
          description: `Quote marked as ${status}.`,
        });
      } else {
        throw new Error(res.error || 'Failed to update quote status.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update status';
      toast({ variant: 'destructive', title: 'Update Failed', description: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConvertToInvoice = async (quoteId: string) => {
    if (!activeWorkspaceId) return;
    setActionLoadingId(quoteId);
    try {
      const res = await convertQuoteToInvoiceAction(quoteId, activeWorkspaceId, user?.uid);
      if (res.success && res.invoiceId) {
        toast({
          title: 'Invoice Generated',
          description: 'Commercial quote successfully converted to draft invoice.',
        });
      } else {
        throw new Error(res.error || 'Failed to convert quote to invoice.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to convert';
      toast({ variant: 'destructive', title: 'Conversion Failed', description: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!activeWorkspaceId) return;
    if (!window.confirm('Are you sure you want to delete this commercial quote?')) return;
    setActionLoadingId(quoteId);
    try {
      const res = await deleteDealQuoteAction(quoteId, activeWorkspaceId, user?.uid);
      if (res.success) {
        toast({ title: 'Quote Deleted', description: 'Commercial quote removed.' });
      } else {
        throw new Error(res.error || 'Failed to delete quote.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete quote';
      toast({ variant: 'destructive', title: 'Delete Failed', description: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: DealQuote['status']) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold gap-1"><CheckCircle2 className="h-3 w-3" /> Accepted</Badge>;
      case 'sent':
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] font-bold gap-1"><Send className="h-3 w-3" /> Sent</Badge>;
      case 'declined':
        return <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px] font-bold gap-1"><XCircle className="h-3 w-3" /> Declined</Badge>;
      case 'expired':
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold gap-1"><Clock className="h-3 w-3" /> Expired</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground text-[10px] font-bold gap-1">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Products & Line Items Editor Card */}
      <Card className="border-border/50 rounded-2xl bg-card shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-card/20 pb-4 px-6 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <span>Products & Commercial Line Items ({items.length})</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Manage billable goods, subscription licenses, discounts, and generate formal customer quotes.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {catalogProducts.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl font-bold text-xs border-primary/30 text-primary hover:bg-primary/5 gap-1.5 cursor-pointer min-h-[38px]"
                  >
                    <Package className="h-3.5 w-3.5" />
                    <span>From Catalog</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 max-h-72 overflow-y-auto rounded-xl p-1 shadow-xl">
                  {catalogProducts.map(prod => (
                    <DropdownMenuItem
                      key={prod.id}
                      onClick={() => handleAddProductFromCatalog(prod)}
                      className="flex flex-col items-start gap-0.5 p-2 rounded-lg cursor-pointer hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-xs text-foreground truncate">{prod.name}</span>
                        <span className="text-[11px] font-black text-primary">{formatCurrency(prod.unitPrice, prod.currency)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        {prod.isRecurring ? (
                          <Badge className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-600 border-none">
                            Recurring ({prod.billingInterval})
                          </Badge>
                        ) : (
                          <span>One-time</span>
                        )}
                        {prod.sku && <span>• {prod.sku}</span>}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCreatedQuote(null);
                setIsQuoteModalOpen(true);
              }}
              disabled={items.length === 0}
              className="h-9 rounded-xl font-bold text-xs border-border/80 hover:bg-primary/5 gap-1.5 min-h-[38px] cursor-pointer"
            >
              <Receipt className="h-3.5 w-3.5 text-primary" />
              Generate Quote
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleAddItem}
              className="h-9 rounded-xl font-bold text-xs bg-primary text-primary-foreground shadow-sm gap-1.5 min-h-[38px] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Custom Item
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {items.length > 0 ? (
            <div className="space-y-4">
              {/* Recurring Revenue Breakdown Matrix Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-gradient-to-r from-primary/5 via-muted/20 to-primary/5 border border-border/60">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">One-Time Value</p>
                  <p className="text-sm font-black text-foreground">{formatCurrency(totals.oneTimeValue, deal.currency)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-1">
                    <Repeat className="h-3 w-3" /> Monthly (MRR)
                  </p>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.mrr, deal.currency)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-primary uppercase flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Annual (ARR)
                  </p>
                  <p className="text-sm font-black text-primary">{formatCurrency(totals.arr, deal.currency)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                    Total Contract Value ({contractTermMonths}mo)
                  </p>
                  <p className="text-sm font-black text-purple-600 dark:text-purple-400">{formatCurrency(totals.tcv, deal.currency)}</p>
                </div>
              </div>

              {/* Table of Items */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground font-extrabold uppercase text-[10px] tracking-wider">
                      <th className="pb-3 text-left pl-1">Item / Description</th>
                      <th className="pb-3 text-center w-28">Billing</th>
                      <th className="pb-3 text-center w-16">Qty</th>
                      <th className="pb-3 text-right w-24">Unit Price</th>
                      <th className="pb-3 text-center w-16">Disc %</th>
                      <th className="pb-3 text-center w-16">Tax %</th>
                      <th className="pb-3 text-right w-24">Total</th>
                      <th className="pb-3 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {items.map(item => (
                      <tr key={item.id} className="group hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 pr-3 pl-1">
                          <Input
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                            placeholder="Product or service name..."
                            className="h-8 text-xs font-semibold rounded-lg mb-1"
                          />
                          <Input
                            value={item.description || ''}
                            onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                            placeholder="Optional details or specifications..."
                            className="h-6 text-[10px] text-muted-foreground rounded-md border-transparent hover:border-border/60 focus:border-border/80"
                          />
                        </td>
                        <td className="py-2.5 px-1 text-center">
                          <Select 
                            value={item.billingInterval || (item.isRecurring ? 'monthly' : 'one_time')}
                            onValueChange={(val: 'one_time' | 'monthly' | 'quarterly' | 'annual') => {
                              const isRec = val !== 'one_time';
                              handleUpdateItem(item.id, { billingInterval: val, isRecurring: isRec });
                            }}
                          >
                            <SelectTrigger className="h-8 text-[11px] font-semibold rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="one_time">One-Time</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="annual">Annual</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2.5 px-1 text-center">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                            className="h-8 text-xs text-center rounded-lg"
                          />
                        </td>
                        <td className="py-2.5 px-1 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                            className="h-8 text-xs text-right rounded-lg"
                          />
                        </td>
                        <td className="py-2.5 px-1 text-center">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discountPercent || ''}
                            placeholder="0"
                            onChange={(e) => handleUpdateItem(item.id, { discountPercent: parseFloat(e.target.value) || 0 })}
                            className="h-8 text-xs text-center rounded-lg"
                          />
                        </td>
                        <td className="py-2.5 px-1 text-center">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={item.taxRate || ''}
                            placeholder="0"
                            onChange={(e) => handleUpdateItem(item.id, { taxRate: parseFloat(e.target.value) || 0 })}
                            className="h-8 text-xs text-center rounded-lg"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right font-black text-foreground">
                          {formatCurrency(item.total, deal.currency)}
                        </td>
                        <td className="py-2.5 pl-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-60 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Summary Card & Contract Term Selector */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-3 flex-wrap">
                  <Button
                    type="button"
                    onClick={handleSaveItems}
                    disabled={isSaving}
                    className="h-10 px-5 rounded-xl font-bold text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5 shadow-sm min-h-[40px] cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save Line Items & Sync Deal
                  </Button>

                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase">Contract Term:</Label>
                    <Select value={contractTermMonths.toString()} onValueChange={v => setContractTermMonths(parseInt(v) || 12)}>
                      <SelectTrigger className="w-36 h-9 text-xs font-bold rounded-xl min-h-[38px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="3">3 Months</SelectItem>
                        <SelectItem value="6">6 Months</SelectItem>
                        <SelectItem value="12">12 Months (1 yr)</SelectItem>
                        <SelectItem value="24">24 Months (2 yrs)</SelectItem>
                        <SelectItem value="36">36 Months (3 yrs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="w-full sm:w-72 p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="font-semibold">{formatCurrency(totals.subtotal, deal.currency)}</span>
                  </div>
                  {totals.totalDiscount > 0 && (
                    <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Total Discounts:</span>
                      <span className="font-semibold">-{formatCurrency(totals.totalDiscount, deal.currency)}</span>
                    </div>
                  )}
                  {totals.totalTax > 0 && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Total Taxes:</span>
                      <span className="font-semibold">+{formatCurrency(totals.totalTax, deal.currency)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 font-black text-sm text-foreground">
                    <span>Period Total:</span>
                    <span className="text-primary font-black">{formatCurrency(totals.grandTotal, deal.currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/10 rounded-2xl border border-dashed flex flex-col items-center justify-center gap-3">
              <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">No Line Items Added</p>
                <p className="text-[11px] text-muted-foreground max-w-sm">
                  Add products, service fees, or license subscriptions to itemize this deal and automatically synchronize its total revenue.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {catalogProducts.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddProductFromCatalog(catalogProducts[0])}
                    className="h-9 px-4 rounded-xl font-bold text-xs border-primary/30 text-primary"
                  >
                    <Package className="h-3.5 w-3.5 mr-1" /> Add from Catalog
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-9 px-4 rounded-xl font-bold text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Custom Item
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Generated Commercial Quotes History Section */}
      <Card className="border-border/50 rounded-2xl bg-card shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-card/20 pb-4 px-6 pt-5 flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <FileText className="h-4 w-4 text-primary" />
              <span>Commercial Quotes & Client Proposals ({sortedQuotes.length})</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Formal customer quotes with shareable links, digital sign-off, and invoice conversion.
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {isLoadingQuotes ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Loading commercial quotes...</span>
            </div>
          ) : sortedQuotes.length > 0 ? (
            <div className="space-y-3">
              {sortedQuotes.map((quote) => (
                <div
                  key={quote.id}
                  className="p-4 rounded-2xl bg-background border border-border/70 hover:border-primary/30 transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-extrabold text-xs text-foreground tracking-tight">
                        {quote.quoteNumber}
                      </span>
                      {getStatusBadge(quote.status)}
                      <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                        <Calendar className="h-3 w-3 opacity-60" />
                        {new Date(quote.createdAt).toLocaleDateString()}
                      </span>
                      {quote.validUntil && (
                        <span className="text-[10px] text-muted-foreground">
                          • Valid until {new Date(quote.validUntil).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{quote.lineItems?.length || 0} items</span>
                      <span>•</span>
                      {quote.recipientName && (
                        <>
                          <span>Recipient: <strong className="text-foreground">{quote.recipientName}</strong></span>
                          <span>•</span>
                        </>
                      )}
                      <span className="font-black text-foreground text-sm">
                        {formatCurrency(quote.grandTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Action Toolbar */}
                  <div className="flex items-center gap-2 shrink-0">
                    {quote.token && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyQuoteLink(quote.token)}
                          className="h-8 rounded-xl font-bold text-xs gap-1.5 border-border/80 hover:bg-primary/5"
                        >
                          <Copy className="h-3 w-3" />
                          <span className="hidden sm:inline">Copy Link</span>
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-8 rounded-xl font-bold text-xs gap-1.5 border-border/80 hover:bg-primary/5"
                        >
                          <a href={`/quotes/${quote.token}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                            <span>View</span>
                          </a>
                        </Button>
                      </>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={actionLoadingId === quote.id}
                          className="h-8 w-8 rounded-xl"
                        >
                          {actionLoadingId === quote.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl text-xs z-[200]">
                        <DropdownMenuItem onClick={() => handleUpdateQuoteStatus(quote.id, 'draft')}>
                          Mark as Draft
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateQuoteStatus(quote.id, 'sent')}>
                          Mark as Sent
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateQuoteStatus(quote.id, 'accepted')}>
                          Mark as Accepted
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateQuoteStatus(quote.id, 'declined')}>
                          Mark as Declined
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateQuoteStatus(quote.id, 'expired')}>
                          Mark as Expired
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleConvertToInvoice(quote.id)} className="gap-2">
                          <CreditCard className="h-3.5 w-3.5 text-primary" />
                          <span>Convert to Invoice</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteQuote(quote.id)} 
                          className="text-destructive focus:text-destructive gap-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete Quote</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/10 rounded-2xl border border-dashed flex flex-col items-center justify-center gap-2">
              <FileText className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs font-bold text-foreground">No Quotes Generated Yet</p>
              <p className="text-[11px] text-muted-foreground max-w-sm">
                Click &quot;Generate Quote&quot; above to produce formal, branded commercial proposals for your client.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commercial Quote Generation Dialog */}
      <Dialog open={isQuoteModalOpen} onOpenChange={setIsQuoteModalOpen}>
        <DialogContent className="rounded-3xl max-w-lg bg-background border border-border shadow-2xl p-6 z-[200]">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-foreground">
              <Receipt className="h-4 w-4 text-primary" />
              <span>Generate Commercial Quote</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a formal, timestamped commercial quote for {deal.name}.
            </DialogDescription>
          </DialogHeader>

          {createdQuote ? (
            <div className="space-y-4 my-3">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <Check className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-bold text-foreground">Quote Generated Successfully!</h4>
                <p className="text-xs text-muted-foreground">
                  Quote Reference: <strong className="text-foreground">{createdQuote.quoteNumber}</strong>
                </p>
                <div className="text-lg font-black text-primary">
                  {formatCurrency(createdQuote.grandTotal)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border text-xs space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Line Items:</span>
                  <span className="font-bold text-foreground">{createdQuote.lineItems.length} items</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Valid Until:</span>
                  <span className="font-bold text-foreground">{new Date(createdQuote.validUntil).toLocaleDateString()}</span>
                </div>
              </div>

              {createdQuote.token && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCopyQuoteLink(createdQuote.token)}
                    className="flex-1 h-9 rounded-xl font-bold text-xs gap-1.5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy Public Link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    className="flex-1 h-9 rounded-xl font-bold text-xs gap-1.5"
                  >
                    <a href={`/quotes/${createdQuote.token}`} target="_blank" rel="noopener noreferrer">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      View Proposal
                    </a>
                  </Button>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="w-full h-10 rounded-xl font-bold text-xs bg-primary text-primary-foreground"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 my-3">
              <div className="p-3 rounded-2xl bg-muted/20 border space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items Count:</span>
                  <span className="font-bold">{items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Grand Total:</span>
                  <span className="font-black text-primary">{formatCurrency(totals.grandTotal)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Notes / Proposal Summary</Label>
                <Input
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  placeholder="e.g. Special pricing valid for Q3 rollout..."
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Commercial Terms</Label>
                <Input
                  value={quoteTerms}
                  onChange={(e) => setQuoteTerms(e.target.value)}
                  placeholder="e.g. Net 30 days upon invoicing..."
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="h-9 text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCreateQuote}
                  disabled={isGeneratingQuote}
                  className="h-9 text-xs rounded-xl font-bold bg-primary text-primary-foreground gap-1.5 shadow-md"
                >
                  {isGeneratingQuote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                  Confirm & Create Quote
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
