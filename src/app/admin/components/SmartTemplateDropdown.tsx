'use client';

/**
 * ARCHITECTURAL NOTE (DO NOT DELETE):
 * Future messaging modules should exclusively use the SmartTemplateDropdown component. 
 * If a new blueprint type is added, update the RecipientType and TemplateCategory in types.ts 
 * and the getFilteredTemplatesAction will automatically handle the resolution.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, MessageSquare, ShieldCheck, Globe, AlertCircle, Search, ChevronDown, Check } from 'lucide-react';
import type { TemplateCategory, RecipientType, MessageChannel, MessageTemplate } from '@/lib/types';
import { fetchTemplatesCached } from './template-cache-manager';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';

export interface SmartTemplateDropdownProps {
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

const CATEGORY_LABELS: Record<string, string> = {
    forms: 'Forms',
    surveys: 'Surveys',
    meetings: 'Meetings',
    agreements: 'Agreements',
    campaigns: 'Campaigns',
    reminders: 'Reminders',
    tasks: 'Tasks',
    automations: 'Automations',
    qr_codes: 'QR Codes',
    users: 'Users',
    general: 'General'
};

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
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = React.useState<string>('all');

    const handleValueChange = (val: string) => {
        onValueChange(val);
        if (onSelect) {
            const tmpl = templates.find(t => t.id === val);
            if (tmpl) onSelect(tmpl);
        }
        setIsOpen(false);
    };

    const fetchTemplates = React.useCallback(async (bypassCache = false) => {
        setIsLoading(true);
        try {
            const result = await fetchTemplatesCached(
                channel,
                activeWorkspaceId || undefined,
                activeOrganizationId || undefined,
                bypassCache
            );
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
    }, [channel, templateTypePrefix, activeWorkspaceId, activeOrganizationId]);

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
        if (channel === 'email') return <Mail className="h-3.5 w-3.5 mr-2 text-primary" />;
        if (channel === 'sms') return <MessageSquare className="h-3.5 w-3.5 mr-2 text-green-500" />;
        return null;
    };

    // Group matching templates by category
    const groupedTemplates = React.useMemo(() => {
        const filtered = templates.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.subject || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategoryFilter === 'all' || t.category === selectedCategoryFilter;
            return matchesSearch && matchesCategory;
        });

        const groups: Record<string, MessageTemplate[]> = {};
        filtered.forEach(t => {
            const cat = t.category || 'general';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(t);
        });
        return groups;
    }, [templates, searchQuery, selectedCategoryFilter]);

    const availableCategories = React.useMemo(() => {
        const cats = new Set(templates.map(t => t.category).filter(Boolean));
        return Array.from(cats) as string[];
    }, [templates]);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={isLoading}
                    className={cn(
                        "flex items-center justify-between w-full h-11 px-4 rounded-xl border text-xs font-semibold bg-card text-left transition-all duration-200 outline-none select-none active:scale-[0.99] hover:bg-muted/10 border-border/80 shadow-sm",
                        (!value && !isLoading) && "border-amber-500/50 bg-amber-500/5 focus:ring-amber-500/20 text-amber-600/90 dark:border-amber-500/30",
                        className
                    )}
                >
                    <div className="flex items-center min-w-0 flex-1">
                        {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                        ) : (!value ? (
                            <AlertCircle className="h-3.5 w-3.5 mr-2 text-amber-500 shrink-0" />
                        ) : (
                            getChannelIcon()
                        ))}
                        <span className="truncate">
                            {isLoading ? "Loading templates..." : (!selectedTemplate ? placeholder : selectedTemplate.name)}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                        {selectedTemplate && !isLoading && (
                            <TooltipProvider>
                                <Tooltip delayDuration={200}>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center cursor-help">
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
                        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[380px] p-0 rounded-2xl border border-border bg-popover/98 backdrop-blur-md shadow-2xl overflow-hidden select-text">
                <div className="p-3 border-b flex items-center gap-2 bg-muted/20 shrink-0">
                    <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                    <Input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search templates..."
                        className="h-8 rounded-lg border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 bg-transparent text-xs placeholder:text-muted-foreground/50 font-semibold"
                        autoFocus
                    />
                </div>

                {availableCategories.length > 0 && (
                    <div className="px-3 py-2 border-b bg-muted/10 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setSelectedCategoryFilter('all')}
                            className={cn(
                                "px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase border transition-all active:scale-95",
                                selectedCategoryFilter === 'all'
                                    ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                            )}
                        >
                            All Categories
                        </button>
                        {availableCategories.map(cat => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategoryFilter(cat)}
                                className={cn(
                                    "px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase border transition-all active:scale-95",
                                    selectedCategoryFilter === cat
                                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {CATEGORY_LABELS[cat] || cat}
                            </button>
                        ))}
                    </div>
                )}

                <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-3">
                    {Object.keys(groupedTemplates).length === 0 ? (
                        <div className="px-4 py-8 text-center space-y-1">
                            <AlertCircle className="h-5 w-5 mx-auto text-muted-foreground/45" />
                            <p className="text-xs font-bold text-muted-foreground">No blueprints found</p>
                            <p className="text-[10px] text-muted-foreground/60 leading-normal max-w-[240px] mx-auto">Try typing another query or select a different category filter.</p>
                        </div>
                    ) : (
                        Object.entries(groupedTemplates).map(([catKey, list]) => (
                            <div key={catKey} className="space-y-1">
                                <div className="px-2.5 py-1 text-[8px] font-bold text-primary uppercase tracking-wider bg-primary/5 rounded-md inline-block ml-1">
                                    {CATEGORY_LABELS[catKey] || catKey}
                                </div>
                                <div className="space-y-0.5">
                                    {list.map(tmpl => {
                                        const isSelected = tmpl.id === value;
                                        return (
                                            <button
                                                key={tmpl.id}
                                                type="button"
                                                onClick={() => handleValueChange(tmpl.id)}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 rounded-xl flex flex-col gap-0.5 transition-all outline-none",
                                                    isSelected
                                                        ? "bg-primary/5 text-primary"
                                                        : "hover:bg-muted/40 text-foreground"
                                                )}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-xs truncate max-w-[220px]">{tmpl.name}</span>
                                                        {tmpl.scope === 'organization' ? (
                                                            <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[7px] font-bold h-4 px-1.5 flex items-center gap-1 shrink-0">
                                                                <ShieldCheck className="h-2.5 w-2.5" /> Custom
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-muted-foreground/60 border-muted-foreground/20 text-[7px] font-bold h-4 px-1.5 flex items-center gap-1 shrink-0">
                                                                <Globe className="h-2.5 w-2.5" /> Global
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {isSelected && <Check className="h-4.5 w-4.5 text-primary shrink-0" />}
                                                </div>
                                                {tmpl.subject && (
                                                    <span className={cn(
                                                        "text-[10px] truncate max-w-[320px] leading-none mt-0.5 font-medium",
                                                        isSelected ? "text-primary/80" : "text-muted-foreground"
                                                    )}>
                                                        {tmpl.subject}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
