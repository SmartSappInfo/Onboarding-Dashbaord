'use client';

/**
 * ARCHITECTURAL NOTE (DO NOT DELETE):
 * Future messaging modules should exclusively use the SmartTemplateDropdown component. 
 * If a new blueprint type is added, update the RecipientType and TemplateCategory in types.ts 
 * and the getFilteredTemplatesAction will automatically handle the resolution.
 */

import * as React from 'react';
import { 
    Select, 
    SelectContent, 
    SelectGroup, 
    SelectItem, 
    SelectLabel, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, MessageSquare, ShieldCheck, Globe, AlertCircle } from 'lucide-react';
import type { TemplateCategory, RecipientType, MessageChannel, MessageTemplate } from '@/lib/types';
import { getFilteredTemplatesAction } from '@/app/actions/get-filtered-templates-action';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SmartTemplateDropdownProps {
    category: TemplateCategory;
    recipientType: RecipientType;
    channel: MessageChannel;
    /** Optional prefix to further filter templates by their templateType field (client-side). */
    templateTypePrefix?: string;
    value?: string;
    onValueChange: (value: string) => void;
    onSelect?: (template: MessageTemplate) => void;
    placeholder?: string;
    className?: string;
}

// Simple global cache to prevent duplicate fetches across concurrent dropdown selectors
const dropdownCache: Record<string, Promise<MessageTemplate[]>> = {};

/**
 * PHASE 4: UI Integration (No-Bloat Dropdown)
 * A context-aware template selector that only shows relevant blueprints.
 */
export function SmartTemplateDropdown({
    category,
    recipientType,
    channel,
    templateTypePrefix,
    value,
    onValueChange,
    onSelect,
    placeholder = "Select a template...",
    className
}: SmartTemplateDropdownProps) {
    const { activeWorkspaceId, activeOrganizationId } = useTenant();
    const [templates, setTemplates] = React.useState<MessageTemplate[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const handleValueChange = (val: string) => {
        onValueChange(val);
        if (onSelect) {
            const tmpl = templates.find(t => t.id === val);
            if (tmpl) onSelect(tmpl);
        }
    };

    const fetchTemplates = React.useCallback(async (bypassCache = false) => {
        const cacheKey = `${category}_${recipientType}_${channel}_${activeWorkspaceId || ''}_${activeOrganizationId || ''}`;
        setIsLoading(true);
        try {
            let promise = dropdownCache[cacheKey];
            if (!promise || bypassCache) {
                promise = getFilteredTemplatesAction({
                    category,
                    recipientType,
                    channel,
                    workspaceId: activeWorkspaceId || undefined,
                    organizationId: activeOrganizationId || undefined
                });
                dropdownCache[cacheKey] = promise;
            }

            const result = await promise;
            // Apply optional client-side templateType prefix filter (rerender-derived-state)
            const filtered = templateTypePrefix
                ? result.filter(t => t.templateType?.startsWith(templateTypePrefix))
                : result;
            setTemplates(filtered);
            return filtered;
        } catch (error) {
            console.error('Failed to load filtered templates:', error);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [category, recipientType, channel, templateTypePrefix, activeWorkspaceId, activeOrganizationId]);

    const selectedTemplate = React.useMemo(() => 
        templates.find(t => t.id === value),
    [templates, value]);

    const hasAutoSelectedRef = React.useRef(false);

    // If an initial value is provided on load, mark as auto-selected to skip triggering again
    React.useEffect(() => {
        if (value) {
            hasAutoSelectedRef.current = true;
        }
    }, [value]);

    // Fetch templates when filters change (never when selection value changes)
    React.useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    // Auto-select first template if no value is set, only after templates are fetched
    React.useEffect(() => {
        if (templates.length > 0 && !value && !hasAutoSelectedRef.current) {
            hasAutoSelectedRef.current = true;
            const defaultTemplate = templates[0];
            handleValueChange(defaultTemplate.id);
        }
    }, [templates, value]);

    // Phase 4: Auto-refetch if a value is provided but not found in the current list (e.g. newly created custom template)
    const refetchAttemptedForValue = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (value && templates.length > 0 && !templates.some(t => t.id === value)) {
            if (refetchAttemptedForValue.current !== value) {
                refetchAttemptedForValue.current = value;
                fetchTemplates(true); // Bypass cache to get newly created templates
            }
        }
    }, [value, templates, fetchTemplates]);

    const getChannelIcon = () => {
        if (channel === 'email') return <Mail className="h-3 w-3 mr-2 text-primary" />;
        if (channel === 'sms') return <MessageSquare className="h-3 w-3 mr-2 text-green-500" />;
        return null;
    };

    return (
        <Select value={value} onValueChange={handleValueChange} disabled={isLoading}>
            <SelectTrigger className={cn(
                className,
                "transition-all duration-300",
                (!value && !isLoading) && "border-amber-500/50 bg-amber-500/5 focus:ring-amber-500/20 text-amber-600/90 dark:border-amber-500/30"
            )}>
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center min-w-0 flex-1">
                        {isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-2" />
                        ) : (!value ? (
                            <AlertCircle className="h-3.5 w-3.5 mr-2 text-amber-500 shrink-0" />
                        ) : (
                            getChannelIcon()
                        ))}
                        <span className="truncate">
                            <SelectValue placeholder={isLoading ? "Loading templates..." : placeholder} />
                        </span>
                    </div>
                    {selectedTemplate && !isLoading && (
                        <TooltipProvider>
                            <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                    <div className="ml-2 shrink-0 flex items-center cursor-help">
                                        {selectedTemplate.scope === 'organization' ? (
                                            <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[8px] font-bold h-4 px-1.5 flex items-center gap-0.5 animate-pulse">
                                                <ShieldCheck className="h-2 w-2" /> Auto Custom
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-blue-500/10 text-blue-600 border-none text-[8px] font-bold h-4 px-1.5 flex items-center gap-0.5 animate-pulse">
                                                <Globe className="h-2 w-2" /> Auto Default
                                            </Badge>
                                        )}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" align="end" className="w-80 p-4 rounded-2xl border bg-popover text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 border-b border-border pb-2">
                                            {channel === 'email' ? <Mail className="h-3.5 w-3.5 text-primary" /> : <MessageSquare className="h-3.5 w-3.5 text-green-500" />}
                                            <span className="font-bold text-xs truncate max-w-[220px]">{selectedTemplate.name}</span>
                                        </div>
                                        {selectedTemplate.subject && (
                                            <div className="space-y-0.5">
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Subject</span>
                                                <p className="text-[10px] font-bold leading-normal text-foreground/90">{selectedTemplate.subject}</p>
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Body Preview</span>
                                            <p className="text-[10px] text-muted-foreground whitespace-pre-wrap line-clamp-4 font-mono leading-relaxed bg-muted/40 p-2.5 rounded-xl border border-border/40 max-h-28 overflow-y-auto">
                                                {selectedTemplate.body}
                                            </p>
                                        </div>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border shadow-2xl">
                <SelectGroup>
                    <SelectLabel className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-2">
                        {category.replace('_', ' ')} Blueprints
                    </SelectLabel>
                    {templates.length === 0 && !isLoading ? (
                        <div className="px-4 py-8 text-center space-y-2">
                            <p className="text-xs text-muted-foreground">No templates found for this context.</p>
                            <Badge variant="outline" className="text-[8px] font-bold uppercase">Check Blueprint Seeder</Badge>
                        </div>
                    ) : (
                        templates.map((tmpl) => (
                            <SelectItem 
                                key={tmpl.id} 
                                value={tmpl.id} 
                                className="rounded-xl px-4 py-3 cursor-pointer focus:bg-primary/5 group"
                            >
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs">{tmpl.name}</span>
                                        {tmpl.scope === 'organization' ? (
                                            <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[7px] font-bold h-4 px-1.5 flex items-center gap-1">
                                                <ShieldCheck className="h-2 w-2" /> Custom
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground/60 border-muted-foreground/20 text-[7px] font-bold h-4 px-1.5 flex items-center gap-1">
                                                <Globe className="h-2 w-2" /> Global
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground line-clamp-1 group-focus:text-primary/70">{tmpl.subject || 'No subject'}</span>
                                </div>
                            </SelectItem>
                        ))
                    )}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}
