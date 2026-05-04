
'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Globe, AlertCircle, ShieldCheck, Zap, Layout, Link2, Copy, Check, QrCode, Eye, RotateCcw } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { MultiSelect } from '@/components/ui/multi-select';
import AttributionQRSheet from './attribution-qr-sheet';
import { useUser } from '@/firebase';

export default function Step4Publish() {
    const { allowedWorkspaces } = useWorkspace();
    const { activeOrganizationId, activeWorkspaceId } = useTenant();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const { watch, control } = useFormContext();

    const [qrSheetUser, setQrSheetUser] = React.useState<{ id: string; name: string } | null>(null);

    const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

    // Fetch assigned users data for display
    const assignedUserIds = watch('assignedUsers') || [];
    const assignmentEnabled = watch('assignmentEnabled');
    const slug = watch('slug');
    const surveyTitle = watch('title') || watch('internalName') || 'Survey';
    const organizationId = watch('organizationId') || '';
    const workspaceIds = watch('workspaceIds') || [];

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('isAuthorized', '==', true));
    }, [firestore]);
    const { data: users } = useCollection<any>(usersQuery);

    const filteredUsers = React.useMemo(() => {
        return (users || []).filter((u: any) => assignedUserIds.includes(u.id));
    }, [users, assignedUserIds]);

    const userOptions = React.useMemo(() => {
        return (users || []).map((u: any) => ({ label: u.name || u.email, value: u.id }));
    }, [users]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'Link Copied', description: 'Attribution link copied to clipboard.' });
    };

    const getFullUrl = (refId?: string) => {
        if (typeof window === 'undefined') return '';
        const base = `${window.location.origin}/surveys/${slug}`;
        return refId ? `${base}?ref=${refId}` : base;
    };

    const selectedAutomations = watch('autoAutomations') || [];

    const automationsQuery = useMemoFirebase(() => {
        if (!firestore || selectedAutomations.length === 0) return null;
        return query(collection(firestore, 'automations'), where('__name__', 'in', selectedAutomations));
    }, [firestore, selectedAutomations.length]);
    const { data: automations } = useCollection<any>(automationsQuery);

    const draftAutomations = React.useMemo(() => {
        return (automations || []).filter(a => a.status === 'draft' || !a.isActive);
    }, [automations]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {draftAutomations.length > 0 && (
                <div className="p-6 rounded-[2rem] bg-amber-500/10 border-2 border-dashed border-amber-500/20 flex flex-col md:flex-row items-center gap-6 text-left group">
                    <div className="p-4 bg-amber-500 text-white rounded-2xl shadow-xl shadow-amber-500/20 group-hover:scale-110 transition-transform">
                        <Zap className="h-6 w-6 animate-pulse" />
                    </div>
                    <div className="flex-1 space-y-1">
                        <h4 className="text-sm font-black uppercase tracking-tight text-amber-700">Incomplete Workflows Detected</h4>
                        <p className="text-[10px] font-bold text-amber-600/80 leading-relaxed italic">
                            You've selected {draftAutomations.length} automation(s) that are still in "Draft" mode. 
                            These will <span className="font-black underline italic uppercase">not execute</span> until you finalize their node logic.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3 text-[10px]">
                            {draftAutomations.map(a => (
                                <Badge key={a.id} variant="secondary" className="bg-amber-500/20 text-amber-700 font-bold border-none px-2 py-0.5">
                                    {a.name}
                                </Badge>
                            ))}
                        </div>
                    </div>
                    <Button 
                        variant="secondary" 
                        className="rounded-2xl font-black text-[10px] uppercase tracking-widest bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/20 h-10 px-6 shrink-0"
                        onClick={() => window.open('/admin/automations', '_blank')}
                    >
                        Complete Flow Builder
                    </Button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
 <Card className="rounded-2xl border border-border bg-card overflow-hidden">
 <CardHeader className="bg-muted/10 border-b py-5 px-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl">
 <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-sm font-semibold tracking-tight">Endpoint Connectivity</CardTitle>
                    </div>
                </CardHeader>
 <CardContent className="p-6 space-y-10 text-left">
 <div className="space-y-4">
 <Label className="text-sm font-semibold flex items-center gap-2">
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
 <Label className="text-sm font-semibold">Lifecycle State</Label>
                                    <Select onValueChange={field.onChange} value={field.value}>
 <SelectTrigger className="h-11 rounded-xl bg-card border border-border/50 shadow-sm transition-all focus-visible:ring-1 focus-visible:ring-primary/30">
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
 <Label className="text-sm font-semibold">Portal URL Backhalf</Label>
 <div className="flex h-11 border border-border rounded-xl overflow-hidden bg-muted/30 transition-all">
 <div className="bg-muted px-3 flex items-center text-[10px] font-semibold text-muted-foreground/60 border-r">/surveys/</div>
 <Input {...field} className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent flex-1" />
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-full w-11 rounded-none border-l hover:bg-primary/5 hover:text-primary shrink-0"
                                            onClick={() => copyToClipboard(getFullUrl())}
                                        >
                                            <Copy className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                        </Button>
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
                </CardContent>
            </Card>

            <div className="space-y-8">
                {/* Cross-Visibility Toggle */}
                <div className={cn(
                    "rounded-2xl border-2 transition-all duration-300",
                    watch('allowCrossVisibility') ? "border-blue-500/20 bg-blue-500/5" : "border-border/50 bg-background"
                )}>
                    <div className="flex items-center justify-between p-5">
                        <div className="flex items-center gap-3 text-left">
                            <div className={cn("p-2 rounded-lg transition-colors", watch('allowCrossVisibility') ? "bg-blue-500 text-white shadow-lg" : "bg-muted text-muted-foreground")}>
                                <Eye className="h-4 w-4" />
                            </div>
                            <div className="space-y-0.5">
                                <Label className="text-xs font-semibold tracking-tight">Cross-Visibility</Label>
                                <p className="text-[9px] text-muted-foreground font-medium tracking-tighter">Allow assigned users to view all team submissions, not just their own</p>
                            </div>
                        </div>
                        <Controller
                            name="allowCrossVisibility"
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

                {/* Resubmission Toggle */}
                <div className={cn(
                    "rounded-2xl border-2 transition-all duration-300",
                    watch('allowResubmission') ? "border-blue-500/20 bg-blue-500/5" : "border-border/50 bg-background"
                )}>
                    <div className="flex items-center justify-between p-5">
                        <div className="flex items-center gap-3 text-left">
                            <div className={cn("p-2 rounded-lg transition-colors", watch('allowResubmission') ? "bg-blue-500 text-white shadow-lg" : "bg-muted text-muted-foreground")}>
                                <RotateCcw className="h-4 w-4" />
                            </div>
                            <div className="space-y-0.5">
                                <Label className="text-xs font-semibold tracking-tight">Allow Resubmission</Label>
                                <p className="text-[9px] text-muted-foreground font-medium tracking-tighter">Permit respondents to submit multiple entries to this survey</p>
                            </div>
                        </div>
                        <Controller
                            name="allowResubmission"
                            control={control}
                            render={({ field }) => (
                                <Switch 
                                    checked={!!field.value} 
                                    onCheckedChange={field.onChange} 
                                />
                            )}
                        />
                    </div>
                </div>

                <Card className="rounded-2xl border border-border bg-card overflow-hidden">
                    <CardHeader className="bg-muted/10 border-b py-5 px-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600">
                                <Link2 className="h-5 w-5" />
                            </div>
                            <CardTitle className="text-sm font-semibold tracking-tight">Team Assignment & Attribution Links</CardTitle>
                        </div>
                        <Controller
                            name="assignmentEnabled"
                            control={control}
                            render={({ field }) => (
                                <Switch 
                                    checked={!!field.value} 
                                    onCheckedChange={field.onChange} 
                                    className="scale-110"
                                />
                            )}
                        />
                    </CardHeader>
                    {assignmentEnabled && (
                        <CardContent className="p-6 space-y-6 max-h-[500px] overflow-y-auto no-scrollbar">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Assign Team Members</Label>
                                <Controller 
                                    name="assignedUsers"
                                    control={control}
                                    render={({ field }) => (
                                        <MultiSelect 
                                            options={userOptions}
                                            value={field.value || []}
                                            onChange={field.onChange}
                                            placeholder="Select representatives..."
                                        />
                                    )}
                                />
                                <p className="text-[9px] font-bold text-muted-foreground/60 tracking-tight leading-relaxed italic">
                                    Links will generate automatically as you select team members.
                                </p>
                            </div>
                            
                            <Separator className="bg-border/50" />

                            {filteredUsers.length === 0 ? (
                                <div className="p-8 text-center bg-muted/20 rounded-2xl border border-dashed">
                                    <p className="text-[10px] font-bold text-muted-foreground/50 italic">No representatives selected yet.</p>
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
                                                <button 
                                                    type="button"
                                                    onClick={() => setQrSheetUser({ id: user.id, name: user.name || user.email || 'User' })}
                                                    className="p-1.5 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all"
                                                >
                                                    <QrCode className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    )}
                </Card>
            </div>
            </div>

            {/* Attribution QR Sheet */}
            {qrSheetUser && (
                <AttributionQRSheet
                    open={!!qrSheetUser}
                    onOpenChange={(open) => !open && setQrSheetUser(null)}
                    url={getFullUrl(qrSheetUser.id)}
                    userName={qrSheetUser.name}
                    surveyTitle={surveyTitle}
                    workspaceId={workspaceIds[0] || activeWorkspaceId || ''}
                    organizationId={organizationId || activeOrganizationId || ''}
                    currentUser={{
                        userId: user?.uid || '',
                        name: user?.displayName || '',
                        email: user?.email || '',
                    }}
                />
            )}
        </div>
    );
}

function Separator({ className }: { className?: string }) { return <div className={cn("h-px w-full bg-border", className)} />; }
