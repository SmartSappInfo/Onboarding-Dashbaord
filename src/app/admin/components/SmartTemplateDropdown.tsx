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
import { Loader2, Mail, MessageSquare, ShieldCheck, Globe } from 'lucide-react';
import type { TemplateCategory, RecipientType, MessageChannel, MessageTemplate } from '@/lib/types';
import { getFilteredTemplatesAction } from '@/app/actions/get-filtered-templates-action';
import { useTenant } from '@/context/TenantContext';

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

    const fetchTemplates = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getFilteredTemplatesAction({
                category,
                recipientType,
                channel,
                workspaceId: activeWorkspaceId || undefined,
                organizationId: activeOrganizationId || undefined
            });
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

    React.useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    // Phase 4: Auto-refetch if a value is provided but not found in the current list
    const refetchAttemptedForValue = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (value && templates.length > 0 && !templates.some(t => t.id === value)) {
            if (refetchAttemptedForValue.current !== value) {
                refetchAttemptedForValue.current = value;
                fetchTemplates();
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
            <SelectTrigger className={className}>
                <div className="flex items-center">
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : getChannelIcon()}
                    <SelectValue placeholder={isLoading ? "Loading templates..." : placeholder} />
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
