'use client';

import * as React from 'react';
import DashboardCard from "./DashboardCard";
import { Progress } from "@/components/ui/progress";
import { 
    Mail, 
    Smartphone, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    ArrowRight,
    Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MessageLog } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Button } from '../ui/button';

interface MessagingWidgetProps {
    emailSuccess: number;
    smsSuccess: number;
    recentLogs: MessageLog[];
}

export function MessagingWidget({ emailSuccess, smsSuccess, recentLogs }: MessagingWidgetProps) {
    return (
        <DashboardCard title="Communication Health">
            <div className="space-y-8">
                {/* Efficiency Gaugues */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-blue-500">
                                <Mail className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Email</span>
                            </div>
                            <span className="text-sm font-black tabular-nums">{emailSuccess}%</span>
                        </div>
                        <Progress value={emailSuccess} className="h-1.5 bg-blue-100 [&>div]:bg-blue-500 shadow-sm" />
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-orange-500">
                                <Smartphone className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">SMS</span>
                            </div>
                            <span className="text-sm font-black tabular-nums">{smsSuccess}%</span>
                        </div>
                        <Progress value={smsSuccess} className="h-1.5 bg-orange-100 [&>div]:bg-orange-500 shadow-sm" />
                    </div>
                </div>

                <div className="h-px bg-border/50" />

                {/* Recent Dispatches */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recent Dispatches</h4>
                        <Target className="h-3 w-3 text-muted-foreground opacity-40" />
                    </div>
                    
                    <div className="space-y-2">
                        {recentLogs && recentLogs.length > 0 ? recentLogs.map((log) => (
                            <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/20 border border-transparent hover:border-border hover:bg-muted/40 transition-all group">
                                <div className={cn(
                                    "p-2 rounded-lg shrink-0",
                                    log.channel === 'email' ? "bg-blue-500/10 text-blue-500" : "bg-orange-500/10 text-orange-500"
                                )}>
                                    {log.channel === 'email' ? <Mail className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black truncate text-foreground">{log.recipient}</p>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight truncate opacity-60">
                                        {formatDistanceToNow(new Date(log.sentAt), { addSuffix: true })}
                                    </p>
                                </div>
                                <div className="shrink-0">
                                    {log.status === 'sent' ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    ) : log.status === 'failed' ? (
                                        <XCircle className="h-4 w-4 text-rose-500" />
                                    ) : (
                                        <Clock className="h-4 w-4 text-amber-500" />
                                    )}
                                </div>
                            </div>
                        )) : (
                            <p className="text-[10px] text-center text-muted-foreground italic py-4">No recent logs.</p>
                        )}
                    </div>
                </div>

                <Button variant="outline" asChild className="w-full rounded-xl font-bold h-10 border-primary/10 hover:bg-primary/5 hover:text-primary transition-all group mt-2">
                    <Link href="/admin/messaging/logs">
                        Full Audit Trail
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </Button>
            </div>
        </DashboardCard>
    );
}
