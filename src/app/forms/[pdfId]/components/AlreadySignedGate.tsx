'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SmartSappIcon } from '@/components/icons';
import { ShieldCheck, Eye, X, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface AlreadySignedGateProps {
    entityName?: string | null;
    logoUrl?: string;
    pdfName: string;
    onView: () => void;
}

export default function AlreadySignedGate({ entityName, logoUrl, pdfName, onView }: AlreadySignedGateProps) {
    return (
        <div className="flex flex-col items-center justify-center p-4 text-left">
            <Card className="max-w-md w-full rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                <div className="p-10 bg-emerald-500 text-white text-center relative overflow-hidden">
                    {/* Background Aura */}
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 opacity-90" />
                    <div className="absolute -right-8 -top-8 opacity-10">
                        <ShieldCheck size={200} />
                    </div>

                    <div className="relative z-10 space-y-6">
                        <div className="mx-auto bg-white/20 w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-2xl backdrop-blur-md border border-white/30">
                            <CheckCircle2 size={40} className="text-white" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black uppercase tracking-tight">Submitted!</h2>
                            <p className="text-sm font-bold text-white/80 uppercase tracking-widest leading-none">Agreement Fully Signed</p>
                        </div>
                    </div>
                </div>

                <CardContent className="p-10 space-y-10">
                    <div className="flex items-center gap-5 p-5 rounded-2xl bg-slate-50 border border-border/50 shadow-inner">
                        <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-white border border-border/50 shrink-0">
                            {logoUrl ? (
                                <Image src={logoUrl} alt="Logo" fill className="object-contain p-2" />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center bg-primary/5 text-primary font-black text-xs">SS</div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">Institutional Hub</p>
                            <p className="font-black text-foreground uppercase truncate tracking-tight">{entityName || 'SmartSapp Academy'}</p>
                        </div>
                    </div>

                    <div className="space-y-2 text-center sm:text-left">
                        <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                            Our records indicate that the <span className="font-black text-foreground">"{pdfName}"</span> for this campus has been legally signed and submitted. No further modifications are permitted at this time.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <Button 
                            onClick={onView}
                            className="h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20 gap-3"
                        >
                            <Eye className="h-5 w-5" />
                            View & Download Document
                        </Button>
                        <Button 
                            variant="ghost" 
                            onClick={() => window.close()}
                            className="h-12 rounded-xl font-bold text-muted-foreground"
                        >
                            Exit Now
                        </Button>
                    </div>
                </CardContent>

                <div className="bg-slate-50 p-4 border-t text-center">
                    <div className="flex items-center justify-center gap-2 opacity-40">
                        <SmartSappIcon className="h-4 w-4" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Secure Legal Registry</span>
                    </div>
                </div>
            </Card>
        </div>
    );
}
