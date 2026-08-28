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
import { 
  Plus, 
  Trash2, 
  FileText, 
  Check, 
  Loader2, 
  ShoppingBag, 
  Receipt 
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency-utils';
import { calculateLineItemsTotals } from '@/lib/deals/deal-health-engine';
import { saveDealLineItemsAction, createDealQuoteAction } from '@/app/actions/deal-line-item-actions';
import type { Deal, DealLineItem, DealQuote } from '@/lib/types';
import { nanoid } from 'nanoid';

interface DealLineItemsTabProps {
  deal: Deal;
  onDealUpdated?: () => void;
}

export default function DealLineItemsTab({ deal, onDealUpdated }: DealLineItemsTabProps) {
  const { user } = useUser();
  const { toast } = useToast();

  const [items, setItems] = React.useState<DealLineItem[]>(() => {
    return Array.isArray(deal.lineItems) ? deal.lineItems : [];
  });
  const [isSaving, setIsSaving] = React.useState(false);

  // Quote Generation Modal state
  const [isQuoteModalOpen, setIsQuoteModalOpen] = React.useState(false);
  const [isGeneratingQuote, setIsGeneratingQuote] = React.useState(false);
  const [quoteNotes, setQuoteNotes] = React.useState('');
  const [quoteTerms, setQuoteTerms] = React.useState('Payment due within 30 days of invoice.');
  const [createdQuote, setCreatedQuote] = React.useState<DealQuote | null>(null);

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

  return (
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
                          onChange={(e) => handleUpdateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="h-8 text-xs font-bold text-center rounded-lg"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateItem(item.id, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className="h-8 text-xs font-bold text-right rounded-lg"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discountPercent || ''}
                          onChange={(e) => handleUpdateItem(item.id, { discountPercent: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          placeholder="0"
                          className="h-8 text-xs font-semibold text-center rounded-lg"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={item.taxRate || ''}
                          onChange={(e) => handleUpdateItem(item.id, { taxRate: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          placeholder="0"
                          className="h-8 text-xs font-semibold text-center rounded-lg"
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
                          className="h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-500/10 opacity-60 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary Card & Save Button */}
            <div className="flex flex-col sm:flex-row items-end justify-between gap-4 pt-4 border-t border-border/60">
              <Button
                type="button"
                onClick={handleSaveItems}
                disabled={isSaving}
                className="h-10 px-6 rounded-xl font-bold bg-primary text-primary-foreground shadow-md hover:opacity-95 text-xs flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Line Items & Sync Value
              </Button>

              <div className="w-full sm:w-72 p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-2 text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(totals.subtotal)}</span>
                </div>
                {totals.totalDiscount > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                    <span>Discounts:</span>
                    <span className="font-semibold">-{formatCurrency(totals.totalDiscount)}</span>
                  </div>
                )}
                {totals.totalTax > 0 && (
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Taxes:</span>
                    <span className="font-semibold text-foreground">+{formatCurrency(totals.totalTax)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-border/60 flex justify-between items-center">
                  <span className="font-bold text-foreground">Grand Total:</span>
                  <span className="text-base font-black text-primary">{formatCurrency(totals.grandTotal)}</span>
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

      {/* Commercial Quote Generation Dialog */}
      <Dialog open={isQuoteModalOpen} onOpenChange={setIsQuoteModalOpen}>
        <DialogContent className="rounded-3xl max-w-lg bg-background border border-border shadow-2xl p-6">
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

              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="w-full h-10 rounded-xl font-bold text-xs"
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
    </Card>
  );
}
