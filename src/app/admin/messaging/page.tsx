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
    History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function MessagingHubPage() {
    const modules = [
        {
            title: 'Sender Profiles',
            description: 'Manage verified identities for SMS Sender IDs and Email addresses.',
            icon: Fingerprint,
            href: '/admin/messaging/profiles',
            color: 'text-blue-500',
            bg: 'bg-blue-500/10'
        },
        {
            title: 'Visual Styles',
            description: 'Design HTML wrappers and branded layouts for your email communications.',
            icon: Palette,
            href: '/admin/messaging/styles',
            color: 'text-purple-500',
            bg: 'bg-purple-500/10'
        },
        {
            title: 'Message Templates',
            description: 'Define reusable message content with dynamic placeholders for automation.',
            icon: FileType,
            href: '/admin/messaging/templates',
            color: 'text-orange-500',
            bg: 'bg-orange-500/10'
        },
        {
            title: 'Message Composer',
            description: 'Manually send one-off or bulk messages using your saved templates.',
            icon: Send,
            href: '/admin/messaging/composer',
            color: 'text-green-500',
            bg: 'bg-green-500/10'
        },
        {
            title: 'Message Logs',
            description: 'Audit trail of all sent communications, status tracking, and error reports.',
            icon: History,
            href: '/admin/messaging/logs',
            color: 'text-slate-500',
            bg: 'bg-slate-500/10'
        }
    ];

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-foreground">
                    <MessageSquareText className="h-8 w-8 text-primary" />
                    Messaging Engine
                </h1>
                <p className="text-muted-foreground text-lg">Centralized registry for automated and manual communications.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {modules.map((mod) => (
                    <Card key={mod.title} className="group hover:shadow-xl transition-all duration-300 border-border/50">
                        <CardHeader>
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-2", mod.bg)}>
                                <mod.icon className={cn("h-6 w-6", mod.color)} />
                            </div>
                            <CardTitle className="text-xl font-bold">{mod.title}</CardTitle>
                            <CardDescription className="min-h-[3rem] text-xs">{mod.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button 
                                asChild 
                                variant="ghost" 
                                className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                            >
                                <Link href={mod.href}>
                                    Manage
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="mt-12">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader>
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Smartphone className="h-4 w-4" /> System Channels
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-background border shadow-xs">
                            <div className="p-3 bg-blue-500/10 rounded-lg"><Mail className="text-blue-500 h-5 w-5" /></div>
                            <div>
                                <p className="font-bold">Email Channel</p>
                                <p className="text-xs text-muted-foreground italic">Stateless via Admin Dispatcher</p>
                            </div>
                            <Badge className="ml-auto bg-green-500 text-white border-none">Active</Badge>
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-background border shadow-xs">
                            <div className="p-3 bg-orange-500/10 rounded-lg"><Smartphone className="text-orange-500 h-5 w-5" /></div>
                            <div>
                                <p className="font-bold">SMS Channel</p>
                                <p className="text-xs text-muted-foreground italic">Branded Sender ID Support</p>
                            </div>
                            <Badge className="ml-auto bg-green-500 text-white border-none">Active</Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
