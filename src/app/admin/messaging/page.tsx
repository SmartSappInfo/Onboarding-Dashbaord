'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Fingerprint, 
    Palette, 
    FileType, 
    Send, 
    ArrowRight,
    MessageSquareText,
    Mail,
    Smartphone,
    History,
    Activity
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function MessagingHubPage() {
    const operations = [
        {
            title: 'Message Composer',
            description: 'Manually send one-off or bulk messages using your saved templates.',
            icon: Send,
            href: '/admin/messaging/composer',
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            border: 'hover:border-emerald-500/50'
        },
        {
            title: 'Message Logs',
            description: 'Audit trail of all sent communications, status tracking, and error reports.',
            icon: History,
            href: '/admin/messaging/logs',
            color: 'text-slate-500',
            bg: 'bg-slate-500/10',
            border: 'hover:border-slate-500/50'
        }
    ];

    const infrastructure = [
        {
            title: 'Sender Profiles',
            description: 'Manage verified identities for SMS Sender IDs and Email addresses.',
            icon: Fingerprint,
            href: '/admin/messaging/profiles',
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            border: 'hover:border-blue-500/50'
        },
        {
            title: 'Visual Styles',
            description: 'Design HTML wrappers and branded layouts for your email communications.',
            icon: Palette,
            href: '/admin/messaging/styles',
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
            border: 'hover:border-purple-500/50'
        },
        {
            title: 'Message Templates',
            description: 'Define reusable message content with dynamic placeholders for automation.',
            icon: FileType,
            href: '/admin/messaging/templates',
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            border: 'hover:border-orange-500/50'
        }
    ];

    const ModuleCard = ({ mod }: { mod: any }) => (
        <Link href={mod.href} className="group block h-full outline-none">
            <Card className={cn(
                "h-full transition-all duration-300 border-border/50 group-hover:shadow-xl group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-primary relative overflow-hidden",
                mod.border
            )}>
                <CardHeader className="p-6">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110", mod.bg)}>
                        <mod.icon className={cn("h-6 w-6", mod.color)} />
                    </div>
                    <CardTitle className="text-xl font-black tracking-tight flex items-center justify-between">
                        {mod.title}
                        <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-primary" />
                    </CardTitle>
                    <CardDescription className="text-xs leading-relaxed font-medium mt-2 text-muted-foreground/80">
                        {mod.description}
                    </CardDescription>
                </CardHeader>
                <div className={cn("absolute bottom-0 left-0 h-1 bg-transparent group-hover:bg-primary/20 w-full transition-colors")} />
            </Card>
        </Link>
    );

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <MessageSquareText className="h-6 w-6 text-primary" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">
                        Messaging Engine
                    </h1>
                </div>
                <p className="text-muted-foreground text-lg font-medium">Centralized control for automated and manual school communications.</p>
            </div>

            <div className="space-y-16 max-w-7xl">
                {/* Section 1: Operations */}
                <section>
                    <div className="flex items-center gap-3 mb-8">
                        <Badge variant="outline" className="bg-background font-black text-[10px] uppercase tracking-widest px-3 py-1 border-primary/20 text-primary">Daily Operations</Badge>
                        <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:max-w-4xl">
                        {operations.map((mod) => (
                            <ModuleCard key={mod.title} mod={mod} />
                        ))}
                    </div>
                </section>

                {/* Section 2: Infrastructure */}
                <section>
                    <div className="flex items-center gap-3 mb-8">
                        <Badge variant="outline" className="bg-background font-black text-[10px] uppercase tracking-widest px-3 py-1 border-border text-muted-foreground">Configuration & Assets</Badge>
                        <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {infrastructure.map((mod) => (
                            <ModuleCard key={mod.title} mod={mod} />
                        ))}
                    </div>
                </section>

                {/* Section 3: System Channels */}
                <section className="pt-8">
                    <Card className="bg-primary/5 border-primary/20 shadow-none rounded-[2rem] overflow-hidden">
                        <CardHeader className="p-8 pb-4">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Activity className="h-4 w-4" /> System Health & Channels
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-8 pt-0">
                            <div className="flex items-center gap-5 p-5 rounded-2xl bg-background border border-border/50 shadow-sm transition-all hover:shadow-md">
                                <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500 shrink-0">
                                    <Mail className="h-6 w-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-sm text-foreground">Email Channel</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tight mt-1">Stateless SMTP Gateway</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </div>
                                    <Badge className="bg-green-500/10 text-green-600 border-none text-[10px] font-black uppercase tracking-tighter px-2">Online</Badge>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-5 p-5 rounded-2xl bg-background border border-border/50 shadow-sm transition-all hover:shadow-md">
                                <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-500 shrink-0">
                                    <Smartphone className="h-6 w-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-sm text-foreground">SMS Channel</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tight mt-1">Branded Alphanumeric ID</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </div>
                                    <Badge className="bg-green-500/10 text-green-600 border-none text-[10px] font-black uppercase tracking-tighter px-2">Online</Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </div>
        </div>
    );
}
