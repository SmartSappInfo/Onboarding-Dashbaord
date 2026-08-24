'use client';

/**
 * SmartSapp Finance 2.0 - Invoice Snapshot View
 * Displays point-in-time immutable audit data for finalized/issued invoices.
 */

import * as React from 'react';
import { InvoiceSnapshot, InvoiceVoidAudit } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Building2, Landmark, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export interface InvoiceSnapshotViewProps {
  snapshot?: InvoiceSnapshot | null;
  voidAudit?: InvoiceVoidAudit | null;
  currency?: string;
}

export const InvoiceSnapshotView: React.FC<InvoiceSnapshotViewProps> = ({
  snapshot,
  voidAudit,
  currency = 'GHS',
}) => {
  if (!snapshot) {
    return (
      <div className="p-4 rounded-xl border border-dashed text-center text-xs text-muted-foreground bg-muted/20">
        Draft Invoice — Snapshot will be frozen permanently upon issuance.
      </div>
    );
  }

  let formattedDate = snapshot.snapshotAt;
  try {
    formattedDate = format(new Date(snapshot.snapshotAt), 'dd MMM yyyy, HH:mm');
  } catch {
    // Fallback to raw string
  }

  return (
    <div className="space-y-4 text-left">
      {voidAudit && (
        <Card className="rounded-2xl border-rose-500/30 bg-rose-500/5 shadow-xs overflow-hidden">
          <CardHeader className="p-4 bg-rose-500/10 border-b border-rose-500/20 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <CardTitle className="text-xs font-bold text-rose-700 dark:text-rose-300">
                Voided Invoice Audit Record
              </CardTitle>
            </div>
            <Badge variant="destructive" className="text-[10px] uppercase font-bold">
              Voided
            </Badge>
          </CardHeader>
          <CardContent className="p-4 space-y-1.5 text-xs text-rose-900 dark:text-rose-200">
            <div>
              <span className="font-semibold text-muted-foreground">Reason: </span>
              <span className="font-medium text-foreground">{voidAudit.voidReason}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Voided on {format(new Date(voidAudit.voidedAt), 'dd MMM yyyy, HH:mm')} by user {voidAudit.voidedBy}.
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-4 bg-muted/20 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Immutable Issuance Snapshot
            </CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">
              Frozen point-in-time institutional snapshot
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold">
            <Clock className="h-3 w-3" />
            {formattedDate}
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3.5 text-xs">
          {/* Institutional Info & Billing Profile Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3 text-primary" /> Entity Snapshot
              </div>
              <div className="font-bold text-foreground">{snapshot.entityName}</div>
              {snapshot.entityAddress && (
                <div className="text-[11px] text-muted-foreground">{snapshot.entityAddress}</div>
              )}
              {snapshot.entityPhone && (
                <div className="text-[11px] text-muted-foreground">{snapshot.entityPhone}</div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Landmark className="h-3 w-3 text-primary" /> Billing Protocol
              </div>
              <div className="font-bold text-foreground">{snapshot.billingProfileName}</div>
              <div className="text-[11px] text-muted-foreground">
                VAT: {snapshot.vatPercent}% | Levy: {snapshot.levyPercent}%
              </div>
              {snapshot.bankName && (
                <div className="text-[11px] text-muted-foreground font-medium">
                  {snapshot.bankName} {snapshot.bankAccountNumber ? `(${snapshot.bankAccountNumber})` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Frozen Line Items Table */}
          <div className="border rounded-xl overflow-hidden divide-y">
            <div className="bg-muted/40 px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground flex justify-between">
              <span>Item Description</span>
              <span>Subtotal</span>
            </div>
            {snapshot.items.map((item, idx) => (
              <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                <div>
                  <div className="font-semibold text-foreground">{item.name}</div>
                  {item.description && (
                    <div className="text-[11px] text-muted-foreground">{item.description}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    {item.quantity} × {currency} {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="font-bold tabular-nums text-foreground">
                  {currency} {(item.quantity * item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>

          {/* Snapshot Calculations */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1 text-xs">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Subtotal:</span>
              <span className="font-semibold text-foreground">
                {currency} {snapshot.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            {snapshot.levyAmount > 0 && (
              <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                <span>Levy ({snapshot.levyPercent}%):</span>
                <span>{currency} {snapshot.levyAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {snapshot.vatAmount > 0 && (
              <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                <span>VAT ({snapshot.vatPercent}%):</span>
                <span>{currency} {snapshot.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {snapshot.discount > 0 && (
              <div className="flex justify-between items-center text-primary text-[11px]">
                <span>Discount:</span>
                <span>-{currency} {snapshot.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1.5 border-t border-primary/20 font-bold text-foreground text-sm">
              <span>Total Payable:</span>
              <span className="text-primary tabular-nums">
                {currency} {snapshot.totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
