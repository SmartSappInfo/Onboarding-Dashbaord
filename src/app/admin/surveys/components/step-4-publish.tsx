
'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Globe, AlertCircle, ShieldCheck, Zap, Layout, Link2, Copy, Check } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import WebhookManager from './webhook-manager';
import InternalNotificationConfig from '@/app/admin/components/internal-notification-config';
import ExternalNotificationConfig from './external-notification-config';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import { MultiSelect } from '@/components/ui/multi-select';

export default function Step4Publish() {
    const { allowedWorkspaces } = useWorkspace();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { watch, control } = useFormContext();

    const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

    // Fetch assigned users data for display
    const assignedUserIds = watch('assignedUsers') || [];
    const assignmentEnabled = watch('assignmentEnabled');
    const slug = watch('slug');

    const usersQuery = useMemoFirebase(() => {
        if (!firestore || assignedUserIds.length === 0) return null;
        return query(collection(firestore, 'users'), where('isAuthorized', '==', true));
    }, [firestore, assignedUserIds.length]);
    const { data: users } = useCollection<any>(usersQuery);

    const filteredUsers = React.useMemo(() => {
        return (users || []).filter(u => assignedUserIds.includes(u.id));
    }, [users, assignedUserIds]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'Link Copied', description: 'Attribution link copied to clipboard.' });
    };

    const getFullUrl = (refId?: string) => {
        if (typeof window === 'undefined') return '';
        const base = `${window.location.origin}/surveys/${slug}`;
        return refId ? `${base}?ref=${refId}` : base;
    };

    return (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
 <Card className="shadow-sm border-none ring-1 ring-border overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6 px-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl">
 <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <div>
 <CardTitle className="text-sm font-semibold tracking-tight">Endpoint Connectivity</CardTitle>
 <CardDescription className="text-[10px] font-bold text-muted-foreground/60">Configure public accessibility and data streams.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
 <CardContent className="p-6 space-y-10 bg-background text-left">
 <div className="space-y-4">
 <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
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
 <p className="text-[9px] font-bold text-muted-foreground tracking-tight leading-relaxed">
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
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Lifecycle State</Label>
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
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Portal URL Backhalf</Label>
 <div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-muted/20 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-inner">
 <div className="bg-muted px-3 flex items-center text-[10px] font-semibold text-muted-foreground/60 border-r">/surveys/</div>
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
 <Label className="text-xs font-semibold tracking-tight">Technical Diagnostics</Label>
 <p className="text-[9px] text-muted-foreground font-medium tracking-tighter">Surface real-time automation status to the public user</p>
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
                {assignmentEnabled && (
                    <Card className="shadow-sm border-none ring-1 ring-border rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
                        <CardHeader className="bg-blue-500/5 border-b pb-6 px-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600">
                                    <Link2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-semibold tracking-tight">Assigned Attribution Links</CardTitle>
                                    <CardDescription className="text-[10px] font-bold text-muted-foreground/60 tracking-tight">Unique tracking links for your representatives.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
                            {filteredUsers.length === 0 ? (
                                <div className="p-8 text-center bg-muted/20 rounded-2xl border border-dashed">
                                    <p className="text-[10px] font-bold text-muted-foreground/50 italic">No users selected in the "Behavior" step yet.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {filteredUsers.map(user => (
                                        <div key={user.id} className="group p-4 rounded-xl border border-border/50 bg-muted/10 hover:bg-primary/5 hover:border-primary/20 transition-all text-left">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <span className="text-[10px] font-black text-primary uppercase">{user.name?.[0] || user.email?.[0]}</span>
                                                    </div>
                                                    <span className="text-[11px] font-black text-foreground">{user.name || user.email}</span>
                                                </div>
                                                <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary bg-primary/5">Assigned Link</Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-lg border border-border/50 text-[10px] font-mono text-muted-foreground truncate">
                                                    {getFullUrl(user.id)}
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => copyToClipboard(getFullUrl(user.id))}
                                                    className="p-1.5 rounded-lg bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
                <InternalNotificationConfig prefix="adminAlert" category="surveys" />
                <ExternalNotificationConfig prefix="externalAlert" category="surveys" />
            </div>
        </div>
    );
}

function Separator({ className }: { className?: string }) { return <div className={cn("h-px w-full bg-border", className)} />; }
