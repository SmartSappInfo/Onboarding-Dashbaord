'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { UserProfile, MessageTemplate } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bell, UserCheck, Users, Mail, Smartphone, Info, PlusCircle, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import QuickTemplateDialog from '@/app/admin/messaging/components/quick-template-dialog';
import { useTenant } from '@/context/TenantContext';

/**
 * Reusable configuration component for Internal Team Notifications.
 * Hooks directly into react-hook-form context.
 */
export default function InternalNotificationConfig({ prefix = "adminAlert", category = "general" }: { prefix?: string, category?: any }) {
    const { control, watch, setValue } = useFormContext();
    const firestore = useFirestore();
    const { activeOrganizationId } = useTenant();

    const enabled = watch(`${prefix}sEnabled`);
    const channel = watch(`${prefix}Channel`);

    const [quickCreateState, setQuickCreateState] = React.useState<{ channel: 'email' | 'sms', open: boolean, templateId?: string } | null>(null);

    const usersQuery = useMemoFirebase(() => {
        if (!firestore || !activeOrganizationId) return null;
        return query(
            collection(firestore, 'users'), 
            where('organizationId', '==', activeOrganizationId),
            where('isAuthorized', '==', true), 
            orderBy('name', 'asc')
        );
    }, [firestore, activeOrganizationId]);

    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_templates'), where('isActive', '==', true));
    }, [firestore]);

    const { data: users } = useCollection<UserProfile>(usersQuery);
    const { data: templates } = useCollection<MessageTemplate>(templatesQuery);

    const userOptions = React.useMemo(() => 
        users?.map(u => ({ label: u.name, value: u.id })) || [], 
    [users]);

    const emailTemplates = templates?.filter(t => t.channel === 'email');
    const smsTemplates = templates?.filter(t => t.channel === 'sms');

    return (
 <div className="space-y-4">
 <div className={cn(
                "rounded-[2rem] border-2 transition-all duration-500",
                enabled ? "border-primary/20 bg-primary/5 shadow-xl shadow-primary/5" : "border-border/50 bg-background"
            )}>
 <div className="flex items-center justify-between p-6">
 <div className="flex items-center gap-4">
 <div className={cn(
                            "p-3 rounded-2xl transition-all duration-500", 
                            enabled ? "bg-primary text-white shadow-lg shadow-primary/20 rotate-3" : "bg-muted text-muted-foreground"
                        )}>
 <Bell className="h-6 w-6" />
                        </div>
 <div className="space-y-0.5">
 <Label className="text-base font-semibold tracking-tight">Internal Team Alerts</Label>
 <p className="text-[10px] text-muted-foreground font-semibold tracking-tighter">Notify your team on completion</p>
                        </div>
                    </div>
                    <Controller
                        name={`${prefix}sEnabled`}
                        control={control}
                        render={({ field }) => (
                            <Switch 
                                checked={!!field.value} 
                                onCheckedChange={field.onChange} 
 className="scale-125"
                            />
                        )}
                    />
                </div>

                {enabled && (
 <div className="p-6 pt-0 space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
 <Separator className="bg-primary/10" />
                        
                        {/* Routing Logic */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div className="space-y-4">
 <Label className="text-[10px] font-semibold text-primary ml-1">1. Recipient Intelligence</Label>
 <div className="space-y-3">
 <div className="flex items-center justify-between p-4 bg-card rounded-2xl border border-primary/10 shadow-sm">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-lg text-primary"><UserCheck className="h-4 w-4" /></div>
 <span className="text-xs font-bold tracking-tight">Notify Assigned Manager</span>
                                        </div>
                                        <Controller
                                            name={`${prefix}NotifyManager`}
                                            control={control}
                                            render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} />}
                                        />
                                    </div>
                                    
 <div className="space-y-2">
 <div className="flex items-center gap-2 mb-1">
 <Users className="h-3 w-3 text-muted-foreground" />
 <span className="text-[10px] font-semibold text-muted-foreground">Additional Subscribers</span>
                                        </div>
                                        <Controller
                                            name={`${prefix}SpecificUserIds`}
                                            control={control}
                                            render={({ field }) => (
                                                <MultiSelect 
                                                    options={userOptions}
                                                    value={field.value || []}
                                                    onChange={field.onChange}
                                                    placeholder="Select team members..."
                                                />
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

 <div className="space-y-4">
 <Label className="text-[10px] font-semibold text-primary ml-1">2. Delivery Medium</Label>
                                <Controller
                                    name={`${prefix}Channel`}
                                    control={control}
                                    render={({ field }) => (
 <div className="grid grid-cols-3 gap-2 bg-muted/30 p-1.5 rounded-2xl border">
                                            {(['email', 'sms', 'both'] as const).map(c => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => field.onChange(c)}
 className={cn(
                                                        "h-10 rounded-xl font-semibold uppercase text-[9px]  transition-all",
                                                        field.value === c ? "bg-card shadow-md text-primary" : "text-muted-foreground opacity-60 hover:opacity-100"
                                                    )}
                                                >
                                                    {c}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                />
 <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
 <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
 <p className="text-[9px] font-bold text-blue-800 leading-relaxed tracking-tighter">
                                        Alerts use professional internal templates to maintain team context and operational clarity.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Template Selection */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-primary/10">
                            {(channel === 'email' || channel === 'both') && (
 <div className="space-y-2">
 <div className="flex justify-between items-center px-1">
 <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-2">
 <Mail className="h-3 w-3" /> Internal Email Template
                                        </Label>
 <div className="flex items-center gap-1">
                                            <Controller
                                                name={`${prefix}EmailTemplateId`}
                                                control={control}
                                                render={({ field }) => (
                                                    <>
                                                        {field.value && field.value !== 'none' ? (
                                                            <Button 
                                                                type="button" 
                                                                variant="ghost" 
 className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg"
                                                                onClick={() => setQuickCreateState({ channel: 'email', open: true, templateId: field.value })}
                                                            >
 <Pencil className="h-3 w-3" /> Edit
                                                            </Button>
                                                        ) : null}
                                                    </>
                                                )}
                                            />
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
 className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg"
                                                onClick={() => setQuickCreateState({ channel: 'email', open: true })}
                                            >
 <PlusCircle className="h-3 w-3" /> New
                                            </Button>
                                        </div>
                                    </div>
                                    <Controller
                                        name={`${prefix}EmailTemplateId`}
                                        control={control}
                                        render={({ field }) => (
                                            <Select value={field.value || 'none'} onValueChange={field.onChange}>
 <SelectTrigger className="h-11 rounded-xl bg-card border-primary/10 font-bold transition-all">
                                                    <SelectValue placeholder="Select template..." />
                                                </SelectTrigger>
 <SelectContent className="rounded-xl">
                                                    <SelectItem value="none">Choose template...</SelectItem>
                                                    {emailTemplates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            )}

                            {(channel === 'sms' || channel === 'both') && (
 <div className="space-y-2">
 <div className="flex justify-between items-center px-1">
 <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-2">
 <Smartphone className="h-3 w-3" /> Internal SMS Alert
                                        </Label>
 <div className="flex items-center gap-1">
                                            <Controller
                                                name={`${prefix}SmsTemplateId`}
                                                control={control}
                                                render={({ field }) => (
                                                    <>
                                                        {field.value && field.value !== 'none' ? (
                                                            <Button 
                                                                type="button" 
                                                                variant="ghost" 
 className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg"
                                                                onClick={() => setQuickCreateState({ channel: 'sms', open: true, templateId: field.value })}
                                                            >
 <Pencil className="h-3 w-3" /> Edit
                                                            </Button>
                                                        ) : null}
                                                    </>
                                                )}
                                            />
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
 className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg"
                                                onClick={() => setQuickCreateState({ channel: 'sms', open: true })}
                                            >
 <PlusCircle className="h-3 w-3" /> New
                                            </Button>
                                        </div>
                                    </div>
                                    <Controller
                                        name={`${prefix}SmsTemplateId`}
                                        control={control}
                                        render={({ field }) => (
                                            <Select value={field.value || 'none'} onValueChange={field.onChange}>
 <SelectTrigger className="h-11 rounded-xl bg-card border-primary/10 font-bold transition-all">
                                                    <SelectValue placeholder="Select template..." />
                                                </SelectTrigger>
 <SelectContent className="rounded-xl">
                                                    <SelectItem value="none">Choose template...</SelectItem>
                                                    {smsTemplates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {quickCreateState && (
                <QuickTemplateDialog 
                    open={quickCreateState.open}
                    onOpenChange={(o) => !o && setQuickCreateState(null)}
                    channel={quickCreateState.channel}
                    category={category}
                    templateId={quickCreateState.templateId}
                    onCreated={(id) => {
                        if (quickCreateState.channel === 'email') {
                            setValue(`${prefix}EmailTemplateId`, id, { shouldDirty: true });
                        } else {
                            setValue(`${prefix}SmsTemplateId`, id, { shouldDirty: true });
                        }
                    }}
                />
            )}
        </div>
    );
}