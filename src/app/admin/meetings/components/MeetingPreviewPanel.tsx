
'use client';

import React from 'react';
import { 
    Monitor, 
    Smartphone, 
    Globe, 
    ShieldCheck, 
    Lock,
    ExternalLink,
    Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface MeetingPreviewPanelProps {
    data: {
        title?: string;
        heroTitle?: string;
        heroDescription?: string;
        heroTagline?: string;
        heroCtaLabel?: string;
        heroImageUrl?: string;
        logoUrl?: string;
        brandingEnabled?: boolean;
        heroLayout?: 'image' | 'form';
        type?: { name: string; slug: string };
        entityName?: string;
        registrationEnabled?: boolean;
    };
    className?: string;
}

export default function MeetingPreviewPanel({ data, className }: MeetingPreviewPanelProps) {
    const [viewMode, setViewMode] = React.useState<'desktop' | 'mobile'>('mobile');

    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Live Simulation</span>
                </div>
                <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50">
                    <button 
                        onClick={() => setViewMode('desktop')}
                        className={cn(
                            "p-1.5 rounded-lg transition-all",
                            viewMode === 'desktop' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Monitor className="h-3.5 w-3.5" />
                    </button>
                    <button 
                        onClick={() => setViewMode('mobile')}
                        className={cn(
                            "p-1.5 rounded-lg transition-all",
                            viewMode === 'mobile' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Smartphone className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <div className={cn(
                "relative mx-auto transition-all duration-500 ease-in-out border-8 border-slate-900 rounded-[2.5rem] bg-slate-900 shadow-2xl overflow-hidden ring-1 ring-slate-800",
                viewMode === 'desktop' ? "w-full aspect-video" : "w-[280px] aspect-[9/19]"
            )}>
                {/* Browser Bar */}
                <div className="bg-slate-800/50 px-4 py-2 flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-red-500/50" />
                        <div className="h-2 w-2 rounded-full bg-amber-500/50" />
                        <div className="h-2 w-2 rounded-full bg-emerald-500/50" />
                    </div>
                    <div className="flex-1 bg-slate-900/50 rounded-md px-3 py-1 flex items-center gap-2 border border-slate-700/50">
                        <Lock className="h-2.5 w-2.5 text-emerald-500" />
                        <span className="text-[8px] text-slate-400 font-mono truncate">
                            smartsapp.com/meetings/{data.type?.slug === 'parent' ? 'parent-engagement' : (data.type?.slug || 'session')}/...
                        </span>
                    </div>
                </div>

                {/* Website Content */}
                <div className="bg-white h-full overflow-y-auto hide-scrollbar text-left flex flex-col">
                    {/* Public Header */}
                    <header className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                        {data.brandingEnabled ? (
                            <div className="flex items-center gap-2">
                                {data.logoUrl ? (
                                    <img src={data.logoUrl} className="h-6 w-6 rounded-md object-contain" alt="Logo" />
                                ) : (
                                    <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px]">
                                        S
                                    </div>
                                )}
                                <span className="font-bold text-[10px] tracking-tight text-slate-900 uppercase">{data.entityName || 'Institution'}</span>
                            </div>
                        ) : <div />}
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg">
                            <ExternalLink className="h-3 w-3 text-slate-400" />
                        </Button>
                    </header>

                    {/* Hero Section */}
                    <main className="flex-1">
                        <div className="p-6 space-y-6">
                            <div className="space-y-3">
                                {data.heroTagline && (
                                    <span className="text-[8px] font-bold tracking-[0.2em] text-primary uppercase">
                                        {data.heroTagline}
                                    </span>
                                )}
                                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
                                    {data.heroTitle || 'Your Session Title'}
                                </h1>
                                <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
                                    {data.heroDescription || 'Provide a compelling description of what attendees will learn or achieve during this session.'}
                                </p>
                            </div>

                            {/* Hero Graphic / Form */}
                            <div className="rounded-2xl overflow-hidden border shadow-sm aspect-video bg-slate-50 relative group">
                                {data.heroLayout === 'image' ? (
                                    data.heroImageUrl ? (
                                        <img src={data.heroImageUrl} className="w-full h-full object-cover" alt="Hero" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300">
                                            <Play className="h-8 w-8 opacity-20" />
                                            <span className="text-[8px] font-bold tracking-widest uppercase">Placeholder Media</span>
                                        </div>
                                    )
                                ) : (
                                    <div className="w-full h-full bg-primary/5 p-4 flex flex-col gap-2">
                                        <div className="h-3 w-3/4 bg-white rounded-md border" />
                                        <div className="h-3 w-1/2 bg-white rounded-md border" />
                                        <div className="h-6 w-full bg-primary rounded-md mt-2 shadow-sm" />
                                        <div className="text-[8px] text-center text-primary font-bold mt-1">REGISTRATION MODE</div>
                                    </div>
                                )}
                            </div>

                            <Button className="w-full h-10 rounded-xl font-bold shadow-lg shadow-primary/20">
                                {data.heroCtaLabel || (data.registrationEnabled ? 'Register Now' : 'Join Session')}
                            </Button>
                        </div>

                        {/* Social Proof Placeholder */}
                        <div className="px-6 py-8 bg-slate-50/50 border-t border-slate-100">
                            <div className="flex -space-x-2 mb-3">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className="h-5 w-5 rounded-full border-2 border-white bg-slate-200" />
                                ))}
                                <div className="h-5 w-5 rounded-full border-2 border-white bg-primary flex items-center justify-center text-[6px] font-bold text-white">
                                    +82
                                </div>
                            </div>
                            <p className="text-[8px] font-bold text-slate-400 tracking-wide">TRUSTED BY INSTITUTIONS WORLDWIDE</p>
                        </div>
                    </main>

                    {/* Footer */}
                    <footer className="p-6 text-center border-t border-slate-100">
                        <p className="text-[8px] font-medium text-slate-400">Powered by SmartSapp Enterprise</p>
                    </footer>
                </div>
            </div>

            <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    <ShieldCheck className="h-3 w-3 text-emerald-500" />
                    SSL Encrypted
                </div>
            </div>
        </div>
    );
}
