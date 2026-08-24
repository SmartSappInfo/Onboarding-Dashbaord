'use client';

/**
 * SmartSapp Finance 2.0 - Public Invoice Display & PDF Generation
 * Renders immutable point-in-time snapshot data, multi-state settlement badges,
 * and high-fidelity printable / downloadable PDF vouchers.
 */

import * as React from 'react';
import type { Invoice, OrgBranding } from '@/lib/types';
import { format } from 'date-fns';
import { 
    Download, 
    Printer, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    Building, 
    ShieldCheck,
    Loader2,
    AlertTriangle,
    CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SmartSappLogo, SmartSappIcon } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface InvoicePortalClientProps {
    invoice: Invoice;
    orgBranding?: OrgBranding | null;
}

export default function InvoicePortalClient({ invoice, orgBranding }: InvoicePortalClientProps) {
    const { toast } = useToast();
    const [isDownloading, setIsDownloading] = React.useState(false);
    const invoiceRef = React.useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const { PDFDocument } = await import('pdf-lib');
            
            if (!invoiceRef.current) throw new Error('Target not found');

            toast({ title: 'Generating Document', description: 'Preparing high-fidelity PDF...' });

            const canvas = await html2canvas(invoiceRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
            
            const pdfDoc = await PDFDocument.create();
            const image = await pdfDoc.embedJpg(imgBytes);
            
            // Standard A4
            const page = pdfDoc.addPage([595.28, 841.89]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: 595.28,
                height: 841.89,
            });

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Invoice_${invoice.invoiceNumber}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast({ title: 'Download Successful' });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to generate PDF';
            toast({ variant: 'destructive', title: 'Generation Failed', description: message });
        } finally {
            setIsDownloading(false);
        }
    };

    const isVoid = invoice.status === 'void' || invoice.lifecycleStatus === 'void';
    const amountPaid = Number(invoice.amountPaid || 0);
    const balanceDue = Number(invoice.balanceDue ?? Math.max(0, invoice.totalPayable - amountPaid));
    const isPaidInFull = !isVoid && (invoice.paymentStatus === 'paid' || invoice.status === 'paid' || (amountPaid >= invoice.totalPayable && invoice.totalPayable > 0));
    const isPartial = !isVoid && !isPaidInFull && amountPaid > 0;

    const getStatusTheme = () => {
        if (isVoid) {
            return { color: 'text-rose-600', bg: 'bg-rose-50', icon: AlertTriangle, label: 'Voided Document' };
        }
        if (isPaidInFull) {
            return { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2, label: 'Paid in Full' };
        }
        if (isPartial) {
            return { color: 'text-amber-600', bg: 'bg-amber-50', icon: CreditCard, label: `Partially Paid (${invoice.currency} ${amountPaid.toLocaleString()} paid)` };
        }
        if (invoice.status === 'overdue') {
            return { color: 'text-rose-600', bg: 'bg-rose-50', icon: AlertCircle, label: 'Payment Overdue' };
        }
        return { color: 'text-blue-600', bg: 'bg-blue-50', icon: Clock, label: 'Awaiting Settlement' };
    };

    const theme = getStatusTheme();

    // Prefer snapshot line items if present
    const lineItems = invoice.snapshot?.items || invoice.items || [];
    const entityName = invoice.snapshot?.entityName || invoice.entityName || 'Organization';
    const remittanceText = invoice.snapshot?.remittanceInstructions || invoice.paymentInstructions;

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Action Bar */}
                <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-2xl border shadow-sm print:hidden">
                    <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-xl shrink-0', theme.bg, theme.color)}>
                            <theme.icon className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 leading-none mb-1">Settlement Status</p>
                            <p className={cn('text-sm font-black uppercase tracking-tight', theme.color)}>{theme.label}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl font-bold h-11 min-h-[44px] gap-2 border-border/50 active:scale-[0.97]">
                            <Printer className="h-4 w-4" /> Print
                        </Button>
                        <Button size="sm" onClick={handleDownload} disabled={isDownloading} className="rounded-xl font-black h-11 min-h-[44px] px-6 gap-2 shadow-lg active:scale-[0.97]">
                            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Download PDF
                        </Button>
                    </div>
                </div>

                {/* Void Notification Banner */}
                {isVoid && (
                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-left">
                        <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-rose-700">Notice: This Invoice Has Been Voided</p>
                            <p className="text-xs text-rose-600/80">
                                {invoice.voidAudit?.voidReason || 'This billing document has been formally cancelled.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Main Invoice Card */}
                <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white ring-1 ring-black/5 relative">
                    <div ref={invoiceRef}>
                    <CardContent className="p-0">
                        {/* Branded Header */}
                        <div className="p-12 sm:p-16 border-b flex flex-col sm:flex-row justify-between gap-12 bg-slate-50">
                            <div className="space-y-8">
                                {orgBranding?.logoUrl ? (
                                    <div className="relative h-10 w-48">
                                        <Image
                                            src={orgBranding.logoUrl}
                                            alt={`${orgBranding.name} logo`}
                                            fill
                                            className="object-contain object-left"
                                            unoptimized={orgBranding.logoUrl.startsWith('http')}
                                        />
                                    </div>
                                ) : (
                                    <SmartSappLogo className="h-10" />
                                )}
                                <div className="space-y-1">
                                    <h1 className="text-4xl font-black tracking-tighter uppercase text-foreground">Invoice</h1>
                                    <p className="text-lg font-black text-primary tracking-tight">{invoice.invoiceNumber}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-8 pt-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Issue Date</p>
                                        <p className="font-bold text-sm">{format(new Date(invoice.createdAt), 'MMMM d, yyyy')}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Billing Period</p>
                                        <p className="font-bold text-sm uppercase">{invoice.periodName}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="text-left sm:text-right space-y-6">
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black uppercase text-primary tracking-[0.2em]">Billed To</p>
                                    <div className="flex items-center sm:justify-end gap-2">
                                        <Building className="h-4 w-4 text-primary/40" />
                                        <h2 className="text-xl font-black uppercase tracking-tight text-foreground">{entityName}</h2>
                                    </div>
                                    {invoice.snapshot?.entityAddress && (
                                        <p className="text-xs text-muted-foreground">{invoice.snapshot.entityAddress}</p>
                                    )}
                                </div>
                                <div className="pt-4 border-t border-dashed sm:border-none sm:pt-0">
                                    <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Settlement Standing</p>
                                    <Badge variant={isPaidInFull ? 'default' : isVoid ? 'destructive' : 'outline'} className="text-[10px] uppercase font-bold mt-1">
                                        {theme.label}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* Line Items */}
                        <div className="p-12 sm:p-16 space-y-12">
                            <div className="rounded-2xl border border-border/50 overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="pl-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Service Description</TableHead>
                                            <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">Qty</TableHead>
                                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unit Rate</TableHead>
                                            <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subtotal</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lineItems.map((item, idx) => {
                                            const qty = Number(item.quantity) || 1;
                                            const unitRate = Number(item.unitPrice) || 0;
                                            const subtotal = Math.round((qty * unitRate) * 100) / 100;

                                            return (
                                                <TableRow key={idx} className="border-b last:border-0">
                                                    <TableCell className="pl-8 py-6">
                                                        <p className="font-black text-sm uppercase tracking-tight text-foreground">{item.name}</p>
                                                        {item.description && (
                                                            <p className="text-[10px] font-medium text-muted-foreground mt-1">{item.description}</p>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold text-muted-foreground tabular-nums">{qty}</TableCell>
                                                    <TableCell className="text-right font-bold text-muted-foreground tabular-nums">{invoice.currency} {unitRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="text-right pr-8 font-black text-foreground tabular-nums">{invoice.currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Summary & Totals */}
                            <div className="flex flex-col md:flex-row gap-12 pt-8">
                                <div className="flex-1 space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-primary" />
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Remittance Guidelines</h3>
                                        </div>
                                        <div className="p-6 rounded-2xl bg-slate-50 border border-border/50 shadow-inner">
                                            <p className="text-xs font-medium text-muted-foreground leading-relaxed whitespace-pre-wrap">{remittanceText}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full md:w-80 space-y-4">
                                    <div className="flex justify-between items-center px-2">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Base Subtotal</span>
                                        <span className="font-bold tabular-nums">{invoice.currency} {invoice.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    {invoice.levyAmount > 0 && (
                                        <div className="flex justify-between items-center px-2">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Statutory Levy</span>
                                            <span className="font-bold tabular-nums">{invoice.currency} {invoice.levyAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {invoice.vatAmount > 0 && (
                                        <div className="flex justify-between items-center px-2">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">VAT</span>
                                            <span className="font-bold tabular-nums">{invoice.currency} {invoice.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    
                                    {invoice.arrearsAdded > 0 && (
                                        <div className="flex justify-between items-center px-2 py-1 bg-rose-500/10 rounded-lg text-rose-500">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Carried Arrears</span>
                                            <span className="font-black tabular-nums">+{invoice.currency} {invoice.arrearsAdded.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}

                                    {invoice.creditDeducted > 0 && (
                                        <div className="flex justify-between items-center px-2 py-1 bg-emerald-500/10 rounded-lg text-emerald-500">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Applied Credit</span>
                                            <span className="font-black tabular-nums">-{invoice.currency} {invoice.creditDeducted.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}

                                    {invoice.discount > 0 && (
                                        <div className="flex justify-between items-center px-2 py-1 bg-primary/20 rounded-lg text-primary">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Total Discount</span>
                                            <span className="font-black tabular-nums">-{invoice.currency} {invoice.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}

                                    <div className="pt-6 border-t-4 border-double border-slate-200">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-black uppercase tracking-widest text-foreground">Total Invoiced</span>
                                            <span className={cn('text-2xl font-black tabular-nums tracking-tighter', isVoid ? 'line-through text-muted-foreground' : 'text-primary')}>
                                                {invoice.currency} {invoice.totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        {!isVoid && amountPaid > 0 && (
                                            <div className="flex justify-between items-center pt-2 text-emerald-600 font-bold text-xs">
                                                <span>Amount Paid:</span>
                                                <span>-{invoice.currency} {amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                        {!isVoid && (
                                            <div className="flex justify-between items-center pt-2 border-t font-black text-sm text-foreground">
                                                <span>Balance Due:</span>
                                                <span className={cn('tabular-nums', balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                                    {invoice.currency} {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Signatory Section */}
                            <div className="pt-16 flex justify-end">
                                <div className="text-center space-y-4">
                                    <div className="relative h-20 w-48 mx-auto grayscale group-hover:grayscale-0 transition-all">
                                        {invoice.signatureUrl ? (
                                            <Image 
                                                src={invoice.signatureUrl} 
                                                alt="Signature" 
                                                fill 
                                                className="object-contain" 
                                                unoptimized={invoice.signatureUrl.startsWith('http')} 
                                            />
                                        ) : (
                                            <div className="h-full w-full border-b-2 border-slate-300 border-dashed" />
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-black text-sm uppercase text-foreground">{invoice.signatureName}</p>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{invoice.signatureDesignation}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    </div>
                </Card>

                {/* Branding Footer */}
                <div className="text-center space-y-4 opacity-40 pt-12 print:hidden">
                    <div className="flex justify-center items-center gap-3">
                        <SmartSappIcon className="h-6 w-6" />
                        <span className="text-xs font-black uppercase tracking-widest">Secure Institutional Invoicing</span>
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-tighter">Powered by SmartSapp Intelligence Hub &copy; 2026</p>
                </div>
            </div>
        </div>
    );
}
