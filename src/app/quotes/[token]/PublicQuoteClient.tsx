'use client';

/**
 * @fileoverview Customer-Facing Commercial Proposal & Quote Viewer
 *
 * ARCHITECTURAL POINTER (Public Client Proposal Viewer):
 * Serves public recipients accessing `/quotes/[token]` without requiring authentication:
 * - Clean executive proposal layout with organization metadata and line items schedule.
 * - Digital sign-off flow executing `acceptPublicQuoteAction` with signatory verification.
 * - Print-ready `@media print` stylesheet for 1-click PDF download and crisp paper printing.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Public routes must never expose internal database IDs or workspace secrets.
 * - All monetary amounts must route through formatCurrency or local Intl.NumberFormat.
 * - Zero 'any' or 'any[]' in types.
 *
 * TESTABILITY POINTER:
 * Verify print button triggers window.print() and acceptance modal switches status to 'accepted'.
 */

import * as React from 'react';
import type { DealQuote } from '@/lib/types';
import { 
  Printer, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Building2, 
  Receipt,
  Loader2,
  Check,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { acceptPublicQuoteAction, updateQuoteStatusAction } from '@/app/actions/deal-line-item-actions';

interface PublicQuoteClientProps {
  initialQuote: DealQuote;
  token: string;
}

export default function PublicQuoteClient({ initialQuote, token }: PublicQuoteClientProps) {
  const { toast } = useToast();
  const [quote, setQuote] = React.useState<DealQuote>(initialQuote);

  // Acceptance Modal State
  const [isAcceptModalOpen, setIsAcceptModalOpen] = React.useState(false);
  const [isAccepting, setIsAccepting] = React.useState(false);
  const [signatoryName, setSignatoryName] = React.useState(quote.recipientName || '');
  const [signatoryEmail, setSignatoryEmail] = React.useState(quote.recipientEmail || '');

  // Decline Modal State
  const [isDeclineModalOpen, setIsDeclineModalOpen] = React.useState(false);
  const [isDeclining, setIsDeclining] = React.useState(false);

  const formatPrice = (amount: number, currencyCode: string = 'USD') => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode || 'USD',
      }).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAcceptQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatoryName.trim()) {
      toast({ variant: 'destructive', title: 'Name Required', description: 'Please enter your full name to accept this proposal.' });
      return;
    }

    setIsAccepting(true);
    try {
      const res = await acceptPublicQuoteAction(token, signatoryName, signatoryEmail);
      if (res.success) {
        setQuote(prev => ({
          ...prev,
          status: 'accepted',
          recipientName: signatoryName.trim(),
          recipientEmail: signatoryEmail.trim() || prev.recipientEmail,
        }));
        setIsAcceptModalOpen(false);
        toast({
          title: 'Proposal Accepted!',
          description: 'Thank you. Your acceptance has been digitally recorded.',
        });
      } else {
        throw new Error(res.error || 'Failed to record acceptance.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({ variant: 'destructive', title: 'Acceptance Failed', description: msg });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineQuote = async () => {
    setIsDeclining(true);
    try {
      const res = await updateQuoteStatusAction(quote.id, 'declined');
      if (res.success) {
        setQuote(prev => ({ ...prev, status: 'declined' }));
        setIsDeclineModalOpen(false);
        toast({
          title: 'Proposal Declined',
          description: 'Your response has been submitted to the provider.',
        });
      } else {
        throw new Error(res.error || 'Failed to decline proposal.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({ variant: 'destructive', title: 'Action Failed', description: msg });
    } finally {
      setIsDeclining(false);
    }
  };

  const isExpired = quote.validUntil && new Date(quote.validUntil).getTime() < Date.now();
  const currentStatus = isExpired && quote.status === 'draft' ? 'expired' : quote.status;

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4 sm:px-6 lg:px-8 font-sans antialiased text-foreground print:bg-white print:p-0">
      {/* Top Floating Action Bar (Hidden in Print) */}
      <div className="max-w-4xl mx-auto mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-foreground">SmartSapp Commercial Proposal</h2>
            <p className="text-[11px] text-muted-foreground">Reference #{quote.quoteNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-10 sm:h-9 rounded-xl font-bold text-xs gap-1.5 border-border/80 hover:bg-muted/50"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print / Save PDF</span>
          </Button>

          {currentStatus === 'accepted' ? (
            <Badge className="h-10 sm:h-9 px-4 rounded-xl bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" /> Accepted Proposal
            </Badge>
          ) : currentStatus === 'declined' ? (
            <Badge variant="destructive" className="h-10 sm:h-9 px-4 rounded-xl font-bold text-xs gap-1.5 shadow-sm">
              <XCircle className="h-3.5 w-3.5" /> Declined
            </Badge>
          ) : isExpired ? (
            <Badge variant="secondary" className="h-10 sm:h-9 px-4 rounded-xl font-bold text-xs gap-1.5 shadow-sm">
              <Clock className="h-3.5 w-3.5" /> Expired
            </Badge>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeclineModalOpen(true)}
                className="h-10 sm:h-9 rounded-xl font-bold text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5"
              >
                Decline
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsAcceptModalOpen(true)}
                className="h-10 sm:h-9 px-5 rounded-xl font-bold text-xs bg-primary text-primary-foreground gap-1.5 shadow-md"
              >
                <Check className="h-3.5 w-3.5" /> Accept Proposal
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Proposal Document Paper */}
      <div className="max-w-4xl mx-auto rounded-3xl bg-background border border-border/80 shadow-2xl overflow-hidden print:border-none print:shadow-none print:rounded-none">
        {/* Status Alert Banner */}
        {currentStatus === 'accepted' && (
          <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-between text-xs font-bold px-8">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>This proposal was accepted on {new Date(quote.updatedAt).toLocaleDateString()}</span>
            </div>
            {quote.recipientName && <span>Signed by: {quote.recipientName}</span>}
          </div>
        )}

        <div className="p-8 sm:p-12 space-y-10">
          {/* Header & Meta */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-8 border-b border-border/60">
            <div className="space-y-2">
              <div className="inline-block p-2 rounded-2xl bg-primary text-primary-foreground font-black text-sm tracking-wider uppercase shadow-sm">
                SmartSapp
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                Commercial Proposal
              </h1>
              <p className="text-xs text-muted-foreground">
                Formal quote reference: <strong className="text-foreground">{quote.quoteNumber}</strong>
              </p>
            </div>

            <div className="text-left sm:text-right space-y-1 text-xs text-muted-foreground bg-muted/20 p-4 rounded-2xl border border-border/40 min-w-[220px]">
              <div className="flex sm:justify-end gap-2">
                <span className="font-semibold text-foreground">Issue Date:</span>
                <span>{new Date(quote.createdAt).toLocaleDateString()}</span>
              </div>
              {quote.validUntil && (
                <div className="flex sm:justify-end gap-2">
                  <span className="font-semibold text-foreground">Valid Until:</span>
                  <span>{new Date(quote.validUntil).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex sm:justify-end gap-2 pt-1 border-t border-border/30">
                <span className="font-semibold text-foreground">Status:</span>
                <span className="capitalize font-black text-foreground">{currentStatus}</span>
              </div>
            </div>
          </div>

          {/* Parties Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
            <div className="p-5 rounded-2xl bg-muted/10 border border-border/40 space-y-2">
              <div className="font-extrabold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Prepared For
              </div>
              <div className="text-sm font-black text-foreground">
                {quote.entityName || 'Valued Client'}
              </div>
              {quote.recipientName && (
                <div className="text-muted-foreground font-medium">
                  Attention: <strong className="text-foreground">{quote.recipientName}</strong>
                </div>
              )}
              {quote.recipientEmail && (
                <div className="text-muted-foreground">
                  Email: {quote.recipientEmail}
                </div>
              )}
            </div>

            <div className="p-5 rounded-2xl bg-muted/10 border border-border/40 space-y-2">
              <div className="font-extrabold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Commercial Authority
              </div>
              <div className="text-sm font-black text-foreground">
                SmartSapp Enterprise Operations
              </div>
              <div className="text-muted-foreground">
                Verified Digital Commercial Schedule
              </div>
              <div className="text-muted-foreground text-[11px]">
                Currency: <strong className="text-foreground">{quote.currency || 'USD'}</strong>
              </div>
            </div>
          </div>

          {/* Line Items Schedule */}
          <div className="space-y-4">
            <div className="font-black text-sm text-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <span>Schedule of Products & Services</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/60 text-muted-foreground font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4 text-left">Item & Description</th>
                    <th className="py-3 px-3 text-center w-20">Qty</th>
                    <th className="py-3 px-3 text-right w-28">Unit Price</th>
                    {quote.totalDiscount > 0 && <th className="py-3 px-3 text-center w-20">Disc %</th>}
                    {quote.totalTax > 0 && <th className="py-3 px-3 text-center w-20">Tax %</th>}
                    <th className="py-3 px-4 text-right w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {quote.lineItems && quote.lineItems.length > 0 ? (
                    quote.lineItems.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-muted/5 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-foreground text-xs">{item.name}</div>
                          {item.description && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">{item.description}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center font-semibold text-foreground">
                          {item.quantity}
                        </td>
                        <td className="py-3.5 px-3 text-right text-muted-foreground">
                          {formatPrice(item.unitPrice, quote.currency)}
                        </td>
                        {quote.totalDiscount > 0 && (
                          <td className="py-3.5 px-3 text-center text-muted-foreground">
                            {item.discountPercent ? `${item.discountPercent}%` : '—'}
                          </td>
                        )}
                        {quote.totalTax > 0 && (
                          <td className="py-3.5 px-3 text-center text-muted-foreground">
                            {item.taxRate ? `${item.taxRate}%` : '—'}
                          </td>
                        )}
                        <td className="py-3.5 px-4 text-right font-black text-foreground">
                          {formatPrice(item.total, quote.currency)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        No line items detailed in this quote schedule.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Totals & Commercial Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-8 pt-4">
            <div className="sm:col-span-7 space-y-4">
              {quote.notes && (
                <div className="p-4 rounded-2xl bg-muted/15 border border-border/40 space-y-1.5 text-xs">
                  <div className="font-extrabold text-[10px] uppercase text-muted-foreground tracking-wider">
                    Proposal Notes
                  </div>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
                </div>
              )}

              {quote.terms && (
                <div className="p-4 rounded-2xl bg-muted/15 border border-border/40 space-y-1.5 text-xs">
                  <div className="font-extrabold text-[10px] uppercase text-muted-foreground tracking-wider">
                    Commercial Terms & Conditions
                  </div>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{quote.terms}</p>
                </div>
              )}
            </div>

            <div className="sm:col-span-5">
              <div className="p-6 rounded-2xl bg-muted/20 border border-border/60 space-y-3 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-bold text-foreground">{formatPrice(quote.subtotal, quote.currency)}</span>
                </div>
                {quote.totalDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount Savings:</span>
                    <span className="font-bold">-{formatPrice(quote.totalDiscount, quote.currency)}</span>
                  </div>
                )}
                {quote.totalTax > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Estimated Tax:</span>
                    <span className="font-bold text-foreground">+{formatPrice(quote.totalTax, quote.currency)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-border/60 text-base font-black text-foreground">
                  <span>Total Amount:</span>
                  <span className="text-primary font-black">{formatPrice(quote.grandTotal, quote.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Signature Block */}
          <div className="pt-8 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <div>
              Generated via SmartSapp Commercial Engine • Proposal Reference #{quote.quoteNumber}
            </div>
            <div className="flex items-center gap-1 font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Verified Commercial Document</span>
            </div>
          </div>
        </div>
      </div>

      {/* Digital Acceptance Dialog */}
      <Dialog open={isAcceptModalOpen} onOpenChange={setIsAcceptModalOpen}>
        <DialogContent className="rounded-3xl max-w-md bg-background border border-border shadow-2xl p-6 z-[200]">
          <form onSubmit={handleAcceptQuote}>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span>Accept Commercial Proposal</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                You are digitally accepting quote #{quote.quoteNumber} for {formatPrice(quote.grandTotal, quote.currency)}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Signatory Full Name *</Label>
                <Input
                  required
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Email Address</Label>
                <Input
                  type="email"
                  value={signatoryEmail}
                  onChange={(e) => setSignatoryEmail(e.target.value)}
                  placeholder="e.g. jane@company.com"
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAcceptModalOpen(false)}
                className="h-10 text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isAccepting}
                className="h-10 text-xs rounded-xl font-bold bg-primary text-primary-foreground gap-1.5 shadow-md"
              >
                {isAccepting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Confirm Acceptance
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Decline Confirmation Dialog */}
      <Dialog open={isDeclineModalOpen} onOpenChange={setIsDeclineModalOpen}>
        <DialogContent className="rounded-3xl max-w-sm bg-background border border-border shadow-2xl p-6 z-[200]">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span>Decline Proposal</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you wish to decline commercial quote #{quote.quoteNumber}?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeclineModalOpen(false)}
              className="h-10 text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeclineQuote}
              disabled={isDeclining}
              className="h-10 text-xs rounded-xl font-bold gap-1.5"
            >
              {isDeclining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
