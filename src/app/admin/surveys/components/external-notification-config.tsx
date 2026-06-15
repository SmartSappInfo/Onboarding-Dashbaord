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
import { Bell, UserCheck, Users, Mail, Smartphone, MessageCircle, Info, PlusCircle, Pencil, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TagInput } from '@/components/ui/tag-input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { TemplateWorkshopSheet } from '@/app/admin/messaging/components/TemplateWorkshopSheet';
import { MessagingTemplateSelector } from '../../components/MessagingTemplateSelector';

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
                                                <TagInput 
                                                    value={field.value || []}
                                                    onChange={field.onChange}
                                                    placeholder="Enter emails, phones, or roles..."
                                                />
                                            )}
                                        />
                                        <p className="text-[9px] font-bold text-muted-foreground/60 tracking-tight leading-relaxed italic">
                                            Add comma or semicolon-separated custom contacts or workspace roles.
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
                                        <div className="grid grid-cols-4 gap-2 bg-muted/30 p-1.5 rounded-2xl border">
                                            {(['email', 'sms', 'whatsapp', 'both'] as const).map(c => (
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
                                            <MessagingTemplateSelector 
                                                category={category}
                                                recipientType={prefix === 'externalAlert' ? 'external_alert' : 'internal_alert'}
                                                channel="email"
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                placeholder="Select email blueprint..."
                                                compact
                                            />
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
                                            <MessagingTemplateSelector 
                                                category={category}
                                                recipientType={prefix === 'externalAlert' ? 'external_alert' : 'internal_alert'}
                                                channel="sms"
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                placeholder="Select SMS blueprint..."
                                                compact
                                            />
                                        )}
                                    />
                                </div>
                            )}

                            {channel === 'whatsapp' && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-2 px-1">
                                        <MessageCircle className="h-3 w-3" /> WhatsApp Template
                                    </Label>
                                    <Controller
                                        name={`${prefix}WhatsappTemplateId`}
                                        control={control}
                                        render={({ field }) => (
                                            <MessagingTemplateSelector
                                                category={category}
                                                recipientType={prefix === 'externalAlert' ? 'external_alert' : 'internal_alert'}
                                                channel="whatsapp"
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                placeholder="Select approved WhatsApp template..."
                                                compact
                                            />
                                        )}
                                    />
                                    <p className="text-[9px] font-semibold text-muted-foreground px-1">
                                        Only approved templates send. Adopt one from Messaging → Templates.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {quickCreateState && (
                <TemplateWorkshopSheet 
                    open={quickCreateState.open}
                    onOpenChange={(o) => !o && setQuickCreateState(null)}
                    templateId={quickCreateState.templateId}
                    initialContext={{
                        channel: quickCreateState.channel,
                        category: category,
                        recipientType: prefix === 'externalAlert' ? 'external_alert' : 'internal_alert'
                    }}
                    onCreated={(template) => {
                        if (quickCreateState.channel === 'email') {
                            setValue(`${prefix}EmailTemplateId`, template.id, { shouldDirty: true });
                        } else {
                            setValue(`${prefix}SmsTemplateId`, template.id, { shouldDirty: true });
                        }
                    }}
                />
            )}
        </div>
    );
}
