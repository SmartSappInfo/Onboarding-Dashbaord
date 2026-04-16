'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import type { MessageTemplate, WorkspaceEntity } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bell, UserCheck, Users, Mail, Smartphone, Info, PlusCircle, Pencil, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import QuickTemplateDialog from '@/app/admin/messaging/components/quick-template-dialog';

const CONTACT_ROLE_TYPES = [
    'Champion',
    'Accountant',
    'Administrator',
    'Principal',
    'School Owner'
];

/**
 * Reusable configuration component for External Team Notifications.
 * targets Entity Contacts at the associated Entity.
 */
export default function ExternalNotificationConfig({ prefix = "externalAlert", category = "surveys" }: { prefix?: string, category?: any }) {
    const { control, watch, setValue } = useFormContext();
    const firestore = useFirestore();

    const enabled = watch(`${prefix}sEnabled`);
    const channel = watch(`${prefix}Channel`);
    const entityId = watch('entityId');

    const [quickCreateState, setQuickCreateState] = React.useState<{ channel: 'email' | 'sms', open: boolean, templateId?: string } | null>(null);

    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_templates'), where('isActive', '==', true));
    }, [firestore]);

    const { data: templates } = useCollection<MessageTemplate>(templatesQuery);

    const emailTemplates = templates?.filter(t => t.channel === 'email');
    const smsTemplates = templates?.filter(t => t.channel === 'sms');

    const contactRoleOptions = CONTACT_ROLE_TYPES.map(type => ({ label: type, value: type }));

    return (
 <div className="space-y-4">
 <div className={cn(
                "rounded-[2rem] border-2 transition-all duration-500",
                enabled ? "border-primary/20 bg-primary/5 shadow-xl shadow-primary/5" : "border-border/50 bg-background grayscale opacity-60"
            )}>
 <div className="flex items-center justify-between p-6">
 <div className="flex items-center gap-4 text-left">
 <div className={cn(
                            "p-3 rounded-2xl transition-all duration-500", 
                            enabled ? "bg-primary text-white shadow-lg shadow-primary/20 -rotate-3" : "bg-muted text-muted-foreground"
                        )}>
 <Users className="h-6 w-6" />
                        </div>
 <div className="space-y-0.5">
 <Label className="text-base font-semibold tracking-tight">External Contact Alerts</Label>
 <p className="text-[10px] text-muted-foreground font-semibold tracking-tighter">Notify stakeholders at the campus level</p>
                        </div>
                    </div>
                    <Controller
                        name={`${prefix}sEnabled`}
                        control={control}
                        render={({ field }) => (
                            <Switch 
                                disabled={!entityId}
                                checked={!!field.value && !!entityId} 
                                onCheckedChange={field.onChange} 
 className="scale-125"
                            />
                        )}
                    />
                </div>

                {!entityId && (
 <div className="px-6 pb-6">
 <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 flex items-center gap-3">
 <AlertCircle className="h-4 w-4 text-orange-600 shrink-0" />
 <p className="text-[9px] font-bold text-orange-800 leading-relaxed tracking-tighter">
                                Please associate an entity in Phase 1 to enable external alerts.
                            </p>
                        </div>
                    </div>
                )}

                {enabled && entityId && (
 <div className="p-6 pt-0 space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
 <Separator className="bg-primary/10" />
                        
                        {/* Routing Logic */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
 <div className="space-y-4">
 <Label className="text-[10px] font-semibold text-primary ml-1">1. Stakeholder Filtering</Label>
 <div className="space-y-4">
 <div className="space-y-2">
 <div className="flex items-center gap-2 mb-1">
 <Filter className="h-3 w-3 text-muted-foreground" />
 <span className="text-[10px] font-semibold text-muted-foreground">Contact Roles to Notify</span>
                                        </div>
                                        <Controller
                                            name={`${prefix}ContactTypes`}
                                            control={control}
                                            render={({ field }) => (
                                                <MultiSelect 
                                                    options={contactRoleOptions}
                                                    value={field.value || []}
                                                    onChange={field.onChange}
                                                    placeholder="Select roles (e.g. Principal)..."
                                                />
                                            )}
                                        />
 <p className="text-[9px] font-bold text-muted-foreground/60 tracking-tight leading-relaxed italic">
                                            Anyone listed in the entity metadata with these roles will be alerted.
                                        </p>
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
                                                    disabled={!entityId}
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
 <div className="p-4 rounded-xl bg-purple-50 border border-purple-100 flex items-start gap-3">
 <Info className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
 <p className="text-[9px] font-bold text-purple-800 leading-relaxed tracking-tighter">
                                        External alerts use public-facing templates. Ensure the tone is appropriate for your customers.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Template Selection */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-primary/10 text-left">
                            {(channel === 'email' || channel === 'both') && (
 <div className="space-y-2">
 <div className="flex justify-between items-center px-1">
 <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-2">
 <Mail className="h-3 w-3" /> External Email Template
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
 <Smartphone className="h-3 w-3" /> External SMS Template
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

function AlertCircle(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    )
}
