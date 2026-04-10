'use client';

import * as React from 'react';
import type { School, Invoice, SubscriptionPackage } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Receipt, 
    CreditCard, 
    Wallet, 
    TrendingUp, 
    History, 
    Plus, 
    ArrowRight,
    Loader2,
    Calendar,
    Target,
    ShieldCheck,
    AlertCircle,
    Download,
    Eye,
    FileText,
    Users
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

interface EntityBillingTabProps {
    school: School;
}

export default function EntityBillingTab({ school }: EntityBillingTabProps) {
    const firestore = useFirestore();

    // 1. Fetch Invoices for this school
    const invoicesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'invoices'),
            where('entityId', '==', school.id),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, school.id]);

    const { data: invoices, isLoading: isLoadingInvoices } = useCollection<Invoice>(invoicesQuery);

    // 2. Fetch Subscription Package Details
    const pkgRef = useMemoFirebase(() => {
        if (!firestore || !school.subscriptionPackageId) return null;
        return doc(firestore, 'subscription_packages', school.subscriptionPackageId);
    }, [firestore, school.subscriptionPackageId]);

    const { data: pkg, isLoading: isLoadingPkg } = useDoc<SubscriptionPackage>(pkgRef);

    const totalOutstanding = (school.arrearsBalance || 0) - (school.creditBalance || 0);

    return (
        <div className="space-y-10 animate-in fade-in duration-500 text-left">
            {/* Financial Overview Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    label="Outstanding Arrears" 
                    value={`${school.currency} ${(school.arrearsBalance || 0).toLocaleString()}`} 
                    sub="Unpaid balance from previous terms"
                    icon={CreditCard} 
                    color="text-rose-500" 
                    bg="bg-rose-500/10" 
                />
                <StatCard 
                    label="Available Credit" 
                    value={`${school.currency} ${(school.creditBalance || 0).toLocaleString()}`} 
                    sub="Overpayments and pre-funding"
                    icon={Wallet} 
                    color="text-emerald-500" 
                    bg="bg-emerald-500/10" 
                />
                <StatCard 
                    label="Total Net Balance" 
                    value={`${school.currency} ${totalOutstanding.toLocaleString()}`} 
                    sub="Consolidated financial standing"
                    icon={Target} 
                    color="text-primary" 
                    bg="bg-primary/10" 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Invoice History */}
                <Card className="lg:col-span-2 rounded-[2rem] border-none shadow-sm ring-1 ring-border overflow-hidden bg-card/10 backdrop-blur-md">
                    <CardHeader className="bg-muted/10 border-b pb-6 px-8 pt-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl text-primary"><Receipt className="h-5 w-5" /></div>
                                <div>
                                    <CardTitle className="text-lg font-black uppercase tracking-tight">Invoicing Log</CardTitle>
                                    <CardDescription className="text-xs font-bold uppercase tracking-widest">Historical termly billing records.</CardDescription>
                                </div>
                            </div>
                            <Button size="sm" className="rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg h-9">
                                <Plus className="h-3 w-3" /> Initialize Invoice
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoadingInvoices ? (
                            <div className="p-8 space-y-4">
                                <Skeleton className="h-12 w-full rounded-xl" />
                                <Skeleton className="h-12 w-full rounded-xl" />
                            </div>
                        ) : invoices && invoices.length > 0 ? (
                            <div className="divide-y divide-border/50">
                                {invoices.map((invoice) => (
                                    <div key={invoice.id} className="p-6 flex items-center justify-between group hover:bg-muted/5 transition-colors">
                                        <div className="flex items-center gap-5">
                                            <div className="p-3 bg-muted/10 rounded-2xl border border-border/50 group-hover:bg-card transition-colors">
                                                <FileText className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-black text-sm uppercase tracking-tight">Invoice {invoice.invoiceNumber}</p>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                                    {invoice.periodName} · {format(new Date(invoice.createdAt), 'MMM d, yyyy')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            <div className="text-right">
                                                <p className="font-black text-base tabular-nums">{invoice.currency} {invoice.totalPayable.toLocaleString()}</p>
                                                <Badge variant="outline" className={cn(
                                                    "h-5 text-[8px] font-black uppercase border-none px-2 rounded-full",
                                                    invoice.status === 'paid' ? "bg-emerald-500/10 text-emerald-500" : "bg-orange-500/10 text-orange-500"
                                                )}>
                                                    {invoice.status}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-primary"><Eye className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><Download className="h-4 w-4" /></Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-24 text-center opacity-20 space-y-3">
                                <History className="h-12 w-12 mx-auto" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-foreground">No invoices generated for this campus</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Subscription Meta */}
                <div className="space-y-8">
                    <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-border overflow-hidden bg-white">
                        <CardHeader className="bg-primary/5 border-b pb-6 p-8">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" /> Subscription Protocol
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            {isLoadingPkg ? (
                                <div className="space-y-4">
                                    <Skeleton className="h-4 w-1/2" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : pkg ? (
                                <>
                                    <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border shadow-inner">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60 leading-none">Active Tier</p>
                                            <p className="text-xl font-black uppercase tracking-tight text-foreground">{pkg.name}</p>
                                        </div>
                                        <Badge className="bg-primary text-white border-none font-black text-[8px] h-5 uppercase tracking-widest">PRO</Badge>
                                    </div>
                                    
                                    <div className="space-y-6 px-1">
                                        <DetailRow label="Institutional Rate" value={`${pkg.currency} ${pkg.ratePerStudent}`} sub="Per student / term" />
                                        <DetailRow label="Nominal Target" value={school.nominalRoll?.toLocaleString() || '0'} sub="Total active students" />
                                        <DetailRow label="Billing Term" value={pkg.billingTerm} sub="Resolution cycle" />
                                    </div>
                                </>
                            ) : (
                                <div className="py-10 text-center space-y-4">
                                    <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                                        <AlertCircle className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                                        <p className="text-[10px] font-black uppercase text-orange-500 tracking-tighter">Package Unassigned</p>
                                        <p className="text-[9px] font-bold text-orange-400/60 uppercase leading-relaxed mt-1">Please update the school profile to enable automated billing.</p>
                                    </div>
                                    <Button variant="outline" asChild className="rounded-xl font-bold h-9 border-orange-500/20 text-orange-500 hover:bg-orange-500/10 transition-all text-[10px] uppercase tracking-widest">
                                        <Link href={`/admin/entities/${school.id}/edit`}>Configure Billing Profile</Link>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-border overflow-hidden bg-slate-900 text-white">
                        <CardHeader className="p-8 pb-4">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" /> Financial Integrity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 pt-0">
                            <p className="text-[10px] font-bold text-white/40 leading-relaxed uppercase tracking-tighter italic">
                                "All invoices are snapshotted at the point of creation to ensure historical consistency. Changes to global tax rules or subscription rates will only affect future billing periods."
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, sub, icon: Icon, color, bg }: { label: string, value: string | number, sub: string, icon: any, color: string, bg: string }) {
    return (
        <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-card/10 backdrop-blur-md overflow-hidden group hover:ring-primary/20 transition-all text-left">
            <CardContent className="p-6 flex items-center gap-5">
                <div className={cn("p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-110 shadow-inner", bg, color)}>
                    <Icon className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1.5">{label}</p>
                    <p className="text-2xl font-black tabular-nums tracking-tighter truncate">{value}</p>
                    <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter mt-1 truncate">{sub}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function DetailRow({ label, value, sub }: { label: string, value: string, sub: string }) {
    return (
        <div className="flex justify-between items-start gap-4">
            <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 leading-none">{label}</p>
                <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter">{sub}</p>
            </div>
            <p className="text-sm font-black uppercase tracking-tight text-foreground">{value}</p>
        </div>
    );
}
