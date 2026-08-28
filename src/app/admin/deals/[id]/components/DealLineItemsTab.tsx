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
  CreditCard
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import type { Deal, DealLineItem, DealQuote } from '@/lib/types';
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
  const [isSaving, setIsSaving] = React.useState(false);

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
    return calculateLineItemsTotals(items);
  }, [items]);

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
    };
    setItems(prev => [...prev, newItem]);
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
      const res = await saveDealLineItemsAction(deal.id, items, user?.uid);
      if (res.success) {
        toast({
          title: 'Line Items Saved',
          description: `Deal value synchronized to ${formatCurrency(res.grandTotal || totals.grandTotal)}.`,
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
      const saveRes = await saveDealLineItemsAction(deal.id, items, user?.uid);
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
        <CardHeader className="border-b bg-card/20 pb-4 px-6 pt-5 flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <span>Products & Commercial Line Items ({items.length})</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Manage billable goods, subscription licenses, discounts, and generate formal customer quotes.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCreatedQuote(null);
                setIsQuoteModalOpen(true);
              }}
              disabled={items.length === 0}
              className="h-9 rounded-xl font-bold text-xs border-border/80 hover:bg-primary/5 gap-1.5"
            >
              <Receipt className="h-3.5 w-3.5 text-primary" />
              Generate Quote
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleAddItem}
              className="h-9 rounded-xl font-bold text-xs bg-primary text-primary-foreground shadow-sm gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {items.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground font-extrabold uppercase text-[10px] tracking-wider">
                      <th className="pb-3 text-left pl-1">Item / Description</th>
                      <th className="pb-3 text-center w-20">Qty</th>
                      <th className="pb-3 text-right w-28">Unit Price ({getCurrencySymbol()})</th>
                      <th className="pb-3 text-center w-20">Disc %</th>
                      <th className="pb-3 text-center w-20">Tax %</th>
                      <th className="pb-3 text-right w-28">Total ({getCurrencySymbol()})</th>
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
                        <td className="py-2.5 px-2 text-center">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                            className="h-8 text-xs text-center rounded-lg"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                            className="h-8 text-xs text-right rounded-lg"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center">
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
                        <td className="py-2.5 px-2 text-center">
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
                          {formatCurrency(item.total)}
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

              {/* Financial Calculation Summary Card */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-border/50">
                <Button
                  type="button"
                  onClick={handleSaveItems}
                  disabled={isSaving}
                  className="h-9 px-5 rounded-xl font-bold text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5 shadow-sm"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save Line Items
                </Button>

                <div className="w-full sm:w-72 p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {totals.totalDiscount > 0 && (
                    <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Total Discounts:</span>
                      <span className="font-semibold">-{formatCurrency(totals.totalDiscount)}</span>
                    </div>
                  )}
                  {totals.totalTax > 0 && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Total Taxes:</span>
                      <span className="font-semibold">+{formatCurrency(totals.totalTax)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 font-black text-sm text-foreground">
                    <span>Grand Total:</span>
                    <span className="text-primary font-black">{formatCurrency(totals.grandTotal)}</span>
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
              <Button
                type="button"
                size="sm"
                onClick={handleAddItem}
                className="mt-1 h-9 px-4 rounded-xl font-bold text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add First Item
              </Button>
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
