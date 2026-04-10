
'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Globe, AlertCircle, ShieldCheck, Zap, Layout } from 'lucide-react';
import WebhookManager from './webhook-manager';
import InternalNotificationConfig from '@/app/admin/components/internal-notification-config';
import ExternalNotificationConfig from './external-notification-config';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import { MultiSelect } from '@/components/ui/multi-select';

export default function Step4Publish() {
    const { control, watch } = useFormContext();
    const { allowedWorkspaces } = useWorkspace();

    const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="shadow-sm border-none ring-1 ring-border overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6 px-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-tight">Endpoint Connectivity</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Configure public accessibility and data streams.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-10 bg-background text-left">
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary ml-1 flex items-center gap-2">
                            <Layout className="h-3 w-3" /> Shared Context (Workspaces)
                        </Label>
                        <Controller 
                            name="workspaceIds"
                            control={control}
                            render={({ field }) => (
                                <MultiSelect 
                                    options={workspaceOptions}
                                    value={field.value || []}
                                    onChange={field.onChange}
                                    placeholder="Share across hubs..."
                                />
                            )}
                        />
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight leading-relaxed">
                            Determines which workspace directories this survey blueprint is visible in.
                        </p>
                    </div>

                    <Separator className="bg-border/50" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Lifecycle State</Label>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 transition-all font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="draft">Draft (Internal)</SelectItem>
                                            <SelectItem value="published">Published (Live)</SelectItem>
                                            <SelectItem value="archived">Archived</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        />
                        <Controller
                            name="slug"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Portal URL Backhalf</Label>
                                    <div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-muted/20 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-inner">
                                        <div className="bg-muted px-3 flex items-center text-[10px] font-black uppercase text-muted-foreground/60 border-r">/surveys/</div>
                                        <Input {...field} className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent font-bold" />
                                    </div>
                                </div>
                            )}
                        />
                    </div>

                    <div className="h-px bg-border/50" />

                    <div className={cn(
                        "rounded-2xl border-2 transition-all duration-300",
                        watch('showDebugProcessingModal') ? "border-primary/20 bg-primary/5" : "border-border/50 bg-background"
                    )}>
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3 text-left">
                                <div className={cn("p-2 rounded-lg transition-colors", watch('showDebugProcessingModal') ? "bg-primary text-white shadow-lg" : "bg-muted text-muted-foreground")}>
                                    <AlertCircle className="h-4 w-4" />
                                </div>
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-black uppercase tracking-tight">Technical Diagnostics</Label>
                                    <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">Surface real-time automation status to the public user</p>
                                </div>
                            </div>
                            <Controller
                                name="showDebugProcessingModal"
                                control={control}
                                render={({ field }) => (
                                    <Switch 
                                        checked={field.value} 
                                        onCheckedChange={field.onChange} 
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <div className="h-px bg-border/50" />

                    <WebhookManager />
                </CardContent>
            </Card>

            <div className="space-y-8">
                <InternalNotificationConfig prefix="adminAlert" category="surveys" />
                <ExternalNotificationConfig prefix="externalAlert" category="surveys" />
            </div>
        </div>
    );
}

function Separator({ className }: { className?: string }) { return <div className={cn("h-px w-full bg-border", className)} />; }
