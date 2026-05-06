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
            "rounded-[2.5rem] p-8 md:p-12 shadow-2xl ring-1 ring-black/5 overflow-hidden relative group transition-all duration-500 hover:-translate-y-2",
            backgroundColor,
            className
        )}>
            {/* Background Decorative Element */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-black/[0.03] rounded-full blur-3xl group-hover:bg-black/[0.05] transition-colors" />

            <div className="relative z-10 space-y-8">
                <div className="flex items-center justify-between">
                    <h3 className={cn("text-2xl font-black tracking-tight", accentColor)}>
                        {title}
                    </h3>
                    <div className={cn("p-3 rounded-2xl bg-black/5", accentColor)}>
                        {type === 'bank' ? <Landmark className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
                    </div>
                </div>

                <div className="h-px bg-black/5 w-full" />

                {type === 'bank' && details && (
                    <div className="space-y-6">
                        {details.map((detail, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-4">
                                <span className="text-sm font-bold uppercase tracking-widest text-black/40">
                                    {detail.label}
                                </span>
                                <span className="text-lg font-black text-slate-900 break-all">
                                    {detail.value}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {type === 'procedure' && (
                    <div className="space-y-8">
                        {imageUrl && (
                            <div className="rounded-3xl overflow-hidden shadow-lg ring-1 ring-black/5 animate-in zoom-in duration-700">
                                <img src={imageUrl} alt={title} className="w-full h-auto" />
                            </div>
                        )}
                        
                        {steps && (
                            <ul className="space-y-4">
                                {steps.map((step, idx) => (
                                    <li key={idx} className="flex items-start gap-4">
                                        <div className={cn("mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center", accentColor === 'text-white' ? 'bg-white/20' : 'bg-black/5')}>
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <p className={cn("text-base font-bold leading-relaxed", accentColor === 'text-white' ? 'text-white' : 'text-slate-700')} dangerouslySetInnerHTML={{ __html: step }} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Accent */}
            <div className={cn("absolute bottom-0 left-0 right-0 h-2 opacity-20", accentColor.replace('text-', 'bg-'))} />
        </div>
    );
}
