'use client';

import * as React from 'react';
import { Users, Tag, Target, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAudiences } from '@/lib/audience-hooks';
import { FilterBuilder } from '@/app/admin/messaging/audiences/components/filter-builder';
import { ContactScopeSelector } from './ContactScopeSelector';
import { ManualContactSelector } from './ManualContactSelector';
import { previewCampaignAudience } from '@/lib/messaging-actions';
import { EmailHygieneBadge } from '@/app/admin/components/EmailHygieneBadge';
import type { AudienceFilter } from '@/lib/types';
import type { ConditionGroup } from '@/lib/automation-condition';

export interface AudienceSelectorProps {
    workspaceId: string;
    organizationId: string;
    channel: 'email' | 'sms' | 'call';
    
    // State
    audienceMode: 'all' | 'advanced' | 'saved' | 'manual';
    filters: AudienceFilter[];
    filterLogic: 'AND' | 'OR';
    groups?: ConditionGroup[];
    savedAudienceId: string;
    selectedContacts: Array<{
        entityId: string;
        contactId: string;
        name?: string;
        email?: string;
        phone?: string;
        entityName?: string;
    }>;
    contactScope: 'primary' | 'signatories' | 'all' | (string & {});
    
    // Updates
    onChange: (updates: {
        audienceMode?: 'all' | 'advanced' | 'saved' | 'manual';
        filters?: AudienceFilter[];
        filterLogic?: 'AND' | 'OR';
        groups?: ConditionGroup[];
        savedAudienceId?: string;
        selectedContacts?: any[];
        contactScope?: any;
    }) => void;
    onReachCalculated?: (count: number, contactCount: number) => void;
}

export function AudienceSelector({
    workspaceId,
    organizationId,
    channel,
    audienceMode,
    filters,
    filterLogic,
    groups = [],
    savedAudienceId,
    selectedContacts,
    contactScope,
    onChange,
    onReachCalculated
}: AudienceSelectorProps) {
    const { audiences: savedAudiences } = useAudiences(workspaceId);
    
    // Reach Preview state
    const [previewResult, setPreviewResult] = React.useState<{
        count: number;
        contactCount: number;
        preview: any[];
        contactsPreview: any[];
    } | null>(null);
    const [isPreviewing, setIsPreviewing] = React.useState(false);
    const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

    // Fetch projected reach preview with debouncing
    const fetchPreview = React.useCallback(async () => {
        if (!workspaceId) return;
        setIsPreviewing(true);

        try {
            let activeFilters = filters;
            if (audienceMode === 'all') activeFilters = [];

            const result = await previewCampaignAudience({
                workspaceId,
                filters: audienceMode === 'manual' ? [] : (activeFilters as any),
                filterLogic,
                groups: audienceMode === 'advanced' || audienceMode === 'saved' ? groups : [],
                limit: 10,
                contactScope,
                channel,
                selectedContacts,
                audienceMode,
            });
            
            if (result.success) {
                const count = result.count ?? 0;
                const contactCount = result.contactCount ?? 0;
                setPreviewResult({ 
                    count, 
                    contactCount, 
                    preview: result.preview ?? [],
                    contactsPreview: result.contactsPreview ?? []
                });
                if (onReachCalculated) {
                    onReachCalculated(count, contactCount);
                }
            }
        } catch (err) {
            console.error('[AudienceSelectorReachPreview] Failed:', err);
        } finally {
            setIsPreviewing(false);
        }
    }, [workspaceId, audienceMode, filters, filterLogic, groups, contactScope, channel, selectedContacts]);

    React.useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        
        debounceRef.current = setTimeout(() => {
            fetchPreview();
        }, 800);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [fetchPreview]);

    const handleModeChange = (mode: 'all' | 'advanced' | 'saved' | 'manual') => {
        onChange({ audienceMode: mode });
    };

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Campaign Segment Mode</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { value: 'all' as const, icon: Users, label: 'All Contacts', desc: 'Broadcast to everyone' },
                        { value: 'advanced' as const, icon: Tag, label: 'By Filters', desc: 'Advanced rules' },
                        { value: 'saved' as const, icon: Target, label: 'Saved Audience', desc: 'Reuse a segment' },
                        { value: 'manual' as const, icon: Target, label: 'Manual Pick', desc: 'Select specific' },
                    ].map(m => (
                        <button 
                            key={m.value} 
                            type="button" 
                            onClick={() => handleModeChange(m.value)} 
                            className={cn(
                                "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center",
                                audienceMode === m.value 
                                    ? "border-primary bg-primary/5 text-foreground" 
                                    : "border-border/50 hover:border-primary/20 bg-background/50 text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <m.icon className={cn("h-4 w-4", audienceMode === m.value ? "text-primary" : "text-muted-foreground")} />
                            <p className="text-[10px] font-bold">{m.label}</p>
                            <p className="text-[8px] font-semibold text-muted-foreground">{m.desc}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* All mode info */}
            {audienceMode === 'all' && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <Users className="h-5 w-5 text-emerald-600 shrink-0" />
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        All entities in your workspace will receive this campaign.
                    </p>
                </div>
            )}

            {/* Advanced filter builder mode */}
            {audienceMode === 'advanced' && (
                <FilterBuilder
                    contactScope={contactScope}
                    channel={channel === 'email' || channel === 'sms' ? channel : undefined}
                    filters={filters}
                    filterLogic={filterLogic}
                    groups={groups}
                    showPreview={false}
                    onChange={(f, l, g) => { 
                        onChange({ filters: f, filterLogic: l, groups: g || [] });
                    }}
                />
            )}

            {/* Saved audience select mode */}
            {audienceMode === 'saved' && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Select Saved Audience</Label>
                        <Select 
                            value={savedAudienceId} 
                            onValueChange={v => {
                                const aud = savedAudiences.find(a => a.id === v);
                                onChange({
                                    savedAudienceId: v,
                                    filters: aud?.filters || [],
                                    filterLogic: aud?.filterLogic || 'AND',
                                    groups: aud?.groups || []
                                });
                            }}
                        >
                            <SelectTrigger className="h-10 rounded-xl font-bold text-xs bg-card border-border/50">
                                <SelectValue placeholder="Choose an audience..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                {savedAudiences.map(a => (
                                    <SelectItem key={a.id} value={a.id} className="text-xs font-semibold">
                                        {a.name} ({a.filters?.length || 0} filters)
                                    </SelectItem>
                                ))}
                                {savedAudiences.length === 0 && (
                                    <SelectItem value="_none" disabled className="text-xs text-muted-foreground">No saved audiences</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {/* Manual Pick mode */}
            {audienceMode === 'manual' && (
                <div className="space-y-2">
                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Select Contacts</Label>
                    <ManualContactSelector
                        channel={channel}
                        selectedContacts={selectedContacts}
                        onChange={updated => onChange({ selectedContacts: updated })}
                    />
                </div>
            )}

            {/* Contact scope selection (only for All, Advanced, and Saved modes) */}
            {audienceMode !== 'saved' && audienceMode !== 'manual' && (
                <div className="space-y-2">
                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Contact Scope</Label>
                    <ContactScopeSelector 
                        value={contactScope} 
                        onChange={v => onChange({ contactScope: v })} 
                    />
                </div>
            )}

            {/* Projected Reach Summary Box */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                            <Users className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <p className="text-xs font-bold">Projected Reach</p>
                    </div>
                    {isPreviewing ? (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ) : (
                        <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary border-none">
                            {previewResult?.contactCount || 0} Recipients
                        </Badge>
                    )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-tight">Entities Matched</p>
                        <p className="text-sm font-bold">{previewResult?.count || 0}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-tight">Scope Coverage</p>
                        <p className="text-sm font-bold">
                            {previewResult?.count ? Math.round(((previewResult.contactCount || 0) / previewResult.count) * 100) : 0}%
                        </p>
                    </div>
                </div>

                {previewResult?.contactsPreview && previewResult.contactsPreview.length > 0 && (
                    <div className="pt-2 border-t border-border/50 space-y-2">
                        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-tight">Sample Targets (Resolved Contacts)</p>
                        <div className="space-y-2">
                            {previewResult.contactsPreview.slice(0, 5).map(cp => {
                                const initials = cp.name
                                    ? cp.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                                    : '?';
                                return (
                                    <div key={cp.id} className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/30 hover:border-border/60 transition-all">
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-[10px] uppercase shrink-0">
                                                {initials}
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-xs font-bold text-foreground">{cp.name}</p>
                                                <p className="text-[9px] font-semibold text-muted-foreground">{cp.entityName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-muted-foreground">{cp.contactVal}</span>
                                            {channel === 'email' && cp.verificationStatus && (
                                                <EmailHygieneBadge status={cp.verificationStatus as any} size="sm" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
