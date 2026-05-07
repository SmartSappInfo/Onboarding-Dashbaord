'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Landmark, Smartphone, ArrowRight } from 'lucide-react';

interface PaymentMethodCardProps {
    type: 'bank' | 'procedure';
    title: string;
    details?: { label: string; value: string }[];
    steps?: string[];
    imageUrl?: string;
    backgroundColor?: string;
    accentColor?: string;
    className?: string;
}

export function PaymentMethodCard({
    type,
    title,
    details,
    steps,
    imageUrl,
    backgroundColor = 'bg-white',
    accentColor = 'text-primary',
    className
}: PaymentMethodCardProps) {
    return (
        <div className={cn(
            "rounded-2xl p-8 border border-border/50 shadow-sm overflow-hidden relative group transition-all duration-300",
            backgroundColor,
            className
        )}>
            <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className={cn("text-xl font-bold tracking-tight text-slate-900")}>
                        {title}
                    </h3>
                    <div className={cn("p-2.5 rounded-xl bg-primary/10 text-primary")}>
                        {type === 'bank' ? <Landmark className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                    </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                {type === 'bank' && details && (
                    <div className="space-y-4">
                        {details.map((detail, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-4 py-1">
                                <span className="text-xs font-bold text-muted-foreground/60">
                                    {detail.label}
                                </span>
                                <span className="text-base font-bold text-slate-900 break-all">
                                    {detail.value}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {type === 'procedure' && (
                    <div className="space-y-6">
                        {imageUrl && (
                            <div className="rounded-xl overflow-hidden shadow-inner bg-slate-50 border border-border/30">
                                <img src={imageUrl} alt={title} className="w-full h-auto" />
                            </div>
                        )}
                        
                        {steps && (
                            <ul className="space-y-3">
                                {steps.map((step, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                                            <CheckCircle2 className="w-3 h-3 text-primary" />
                                        </div>
                                        <p className="text-sm font-medium leading-relaxed text-slate-600" dangerouslySetInnerHTML={{ __html: step }} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
