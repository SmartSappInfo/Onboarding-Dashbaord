'use client';

import * as React from 'react';
import type { MessageTemplate, TemplateStatus, TemplateTarget } from '@/lib/types';
import { plainTextToHtml } from '@/lib/messaging-utils';
import { 
    Search, 
    FileType, 
    Smartphone, 
    Mail, 
    Eye, 
    Pencil, 
    CopyPlus, 
    Trash2, 
    Zap,
    Share2,
    LayoutGrid,
    List
} from 'lucide-react';
import { Card, CardTitle, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SmartSappIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TemplateCardProps {
    template: MessageTemplate;
    cloningId: string | null;
    onPreview: () => void;
    onEdit: () => void;
    onClone: () => void;
    onDelete: () => void;
    onUpdateStatus: (status: TemplateStatus) => void;
}

function TemplateCard({ template, cloningId, onPreview, onEdit, onClone, onDelete, onUpdateStatus }: TemplateCardProps) {
    const emailSrcDoc = React.useMemo(() => {
        if (template.channel !== 'email') return '';
        return template.contentMode === 'plain_text' ? plainTextToHtml(template.body) : template.body;
    }, [template.channel, template.contentMode, template.body]);

    return (
        <Card className={cn("group relative border-2 transition-all duration-500 rounded-2xl overflow-hidden bg-card shadow-sm hover:shadow-2xl border-border/50 flex flex-col h-[420px]", cloningId === template.id ? "opacity-50 scale-[0.98] grayscale" : "")}>
            <div className="h-12 shrink-0 border-b flex items-center justify-between px-4 bg-background group-hover:bg-background transition-colors duration-500">
                <div className="flex items-center gap-1.5">
                    <div className={cn("p-1.5 rounded-lg border", template.channel === 'sms' ? "bg-orange-500/10 text-orange-500 border-orange-100" : "bg-blue-500/10 text-blue-500 border-blue-100")}>
                        {template.channel === 'sms' ? <Smartphone className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                    </div>
                    <span className="text-[8px] font-semibold text-muted-foreground opacity-60">{template.channel} Template</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onPreview}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", cloningId === template.id ? "animate-spin" : "")} onClick={onClone} disabled={!!cloningId}><CopyPlus className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
                </div>
            </div>
            
            <div className="flex-1 overflow-hidden relative bg-card flex flex-col items-center justify-center p-1.5">
                {template.channel === 'email' ? (
                    <div className="w-full h-full relative overflow-hidden bg-muted/10 border rounded-xl shadow-inner flex items-start justify-center">
                        <div className="relative transform origin-top scale-[0.42] w-[238%] h-[238%] pointer-events-none p-4 shrink-0">
                            <iframe srcDoc={emailSrcDoc} className="w-full h-full border-none bg-card rounded-[2rem] pointer-events-none shadow-2xl" title="preview" />
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full bg-card rounded-xl p-6 flex flex-col justify-center gap-4 relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-500 border border-slate-100 dark:border-slate-800/80 shadow-inner">
                        <div className="absolute -right-4 -top-4 opacity-5 rotate-12 text-blue-600"><Zap size={120} /></div>
                        <div className="p-4 bg-card border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl backdrop-blur-sm">
                            <p className="text-[9px] font-bold text-slate-900 dark:text-slate-100 leading-relaxed line-clamp-[8] italic">&ldquo;{template.body}&rdquo;</p>
                        </div>
                        <div className="flex items-center justify-between opacity-20 border-t border-slate-200 dark:border-slate-800/80 pt-3">
                            <SmartSappIcon className="h-3.5 w-3.5" variant="primary" />
                            <span className="text-[7px] font-semibold text-slate-900 dark:text-slate-100">Handset Simulator</span>
                        </div>
                    </div>
                )}
                <div className="absolute inset-0 bg-transparent z-10" />
            </div>

            <CardHeader className="p-5 shrink-0 bg-background border-t">
                <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <CardTitle className="text-sm font-semibold truncate text-foreground group-hover:text-blue-600 transition-colors leading-tight tracking-tight">{template.name}</CardTitle>
                        {template.workspaceIds && template.workspaceIds.length > 1 ? (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="p-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100 shrink-0 cursor-help">
                                            <Share2 className="h-3 w-3" />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-[8px] font-bold p-2">
                                        Shared with {template.workspaceIds.length} hubs
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ) : null}
                    </div>
                    <p className="text-[8px] font-bold text-muted-foreground opacity-60">{template.category?.replace('_', ' ')}</p>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <Select 
                            value={template.status || 'draft'} 
                            onValueChange={(v: any) => onUpdateStatus(v)}
                        >
                            <SelectTrigger className={cn(
                                "h-5 rounded-full px-2 py-0 border-none shadow-none focus:ring-0 focus:ring-offset-0 text-[7px] w-20 font-bold",
                                template.status === 'active' ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : 
                                template.status === 'archived' ? "bg-slate-500/10 text-slate-600 hover:bg-slate-500/20" : 
                                "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                            )}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl min-w-[100px]">
                                <SelectItem value="active" className="text-[10px] font-semibold">Active</SelectItem>
                                <SelectItem value="draft" className="text-[10px] font-semibold">Draft</SelectItem>
                                <SelectItem value="archived" className="text-[10px] font-semibold">Archived</SelectItem>
                            </SelectContent>
                        </Select>
                        <Badge variant="outline" className="rounded-full h-4 px-1.5 text-[7px] font-bold">{template.contentMode === 'html_code' ? 'HTML' : template.contentMode === 'rich_builder' ? 'Builder' : 'Text'}</Badge>
                        <Badge variant="outline" className="rounded-full h-4 px-1.5 text-[7px] font-bold">{template.target === 'internal_team' ? 'Team' : 'Client'}</Badge>
                    </div>
                </div>
            </CardHeader>
        </Card>
    );
}

interface TemplateRowProps {
    template: MessageTemplate;
    cloningId: string | null;
    onPreview: () => void;
    onEdit: () => void;
    onClone: () => void;
    onDelete: () => void;
    onUpdateStatus: (status: TemplateStatus) => void;
}

function TemplateRow({ template, cloningId, onPreview, onEdit, onClone, onDelete, onUpdateStatus }: TemplateRowProps) {
    const previewTitle = React.useMemo(() => {
        if (template.channel === 'email') {
            return template.subject || template.previewText || 'No Subject';
        }
        return template.body;
    }, [template.channel, template.subject, template.previewText, template.body]);

    return (
        <div className={cn(
            "flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-xl bg-card hover:bg-muted/10 hover:shadow-md transition-all duration-300 gap-4 border-border/50",
            cloningId === template.id ? "opacity-50 scale-[0.98] grayscale" : ""
        )}>
            {/* Title and Subtitle Info */}
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">{template.name}</span>
                    {template.workspaceIds && template.workspaceIds.length > 1 && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="p-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 shrink-0 cursor-help">
                                        <Share2 className="h-2.5 w-2.5" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="text-[8px] font-bold p-2">
                                    Shared with {template.workspaceIds.length} hubs
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                <div className="text-xs text-muted-foreground truncate opacity-80 max-w-xl">
                    {template.channel === 'email' ? (
                        <span className="italic">Subject: {previewTitle}</span>
                    ) : (
                        <span className="italic">Body: &ldquo;{previewTitle}&rdquo;</span>
                    )}
                </div>
            </div>

            {/* Badges / Metadata info */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Channel */}
                <Badge variant="outline" className={cn(
                    "rounded-full px-2 py-0.5 text-[8px] font-bold gap-1",
                    template.channel === 'sms' ? "bg-orange-500/5 text-orange-500 border-orange-200" : "bg-blue-500/5 text-blue-500 border-blue-200"
                )}>
                    {template.channel === 'sms' ? <Smartphone className="h-2.5 w-2.5" /> : <Mail className="h-2.5 w-2.5" />}
                    <span className="capitalize">{template.channel}</span>
                </Badge>

                {/* Category */}
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[8px] font-bold bg-muted/10 capitalize">
                    {template.category?.replace('_', ' ')}
                </Badge>

                {/* Target */}
                <Badge variant="outline" className={cn(
                    "rounded-full px-2 py-0.5 text-[8px] font-bold",
                    template.target === 'internal_team' ? "bg-indigo-500/5 text-indigo-500 border-indigo-200" : "bg-teal-500/5 text-teal-500 border-teal-200"
                )}>
                    {template.target === 'internal_team' ? 'Staff' : 'Client'}
                </Badge>

                {/* Status */}
                <Select 
                    value={template.status || 'draft'} 
                    onValueChange={(v: any) => onUpdateStatus(v)}
                >
                    <SelectTrigger className={cn(
                        "h-6 rounded-full px-2 py-0.5 text-[8px] font-bold border-none shadow-none focus:ring-0 focus:ring-offset-0 w-24 shrink-0",
                        template.status === 'active' ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : 
                        template.status === 'archived' ? "bg-slate-500/10 text-slate-600 hover:bg-slate-500/20" : 
                        "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                    )}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl min-w-[100px]">
                        <SelectItem value="active" className="text-[10px] font-semibold">Active</SelectItem>
                        <SelectItem value="draft" className="text-[10px] font-semibold">Draft</SelectItem>
                        <SelectItem value="archived" className="text-[10px] font-semibold">Archived</SelectItem>
                    </SelectContent>
                </Select>

                {/* Mode Type */}
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[8px] font-bold">
                    {template.contentMode === 'html_code' ? 'HTML' : template.contentMode === 'rich_builder' ? 'Builder' : 'Text'}
                </Badge>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-1.5 shrink-0 border-t pt-3 md:border-none md:pt-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={onPreview} title="Preview">
                    <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={onEdit} title="Edit">
                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg hover:bg-muted", cloningId === template.id ? "animate-spin" : "")} onClick={onClone} disabled={!!cloningId} title="Clone">
                    <CopyPlus className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={onDelete} title="Delete">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

interface TemplateGalleryProps {
    templates: MessageTemplate[];
    isLoading: boolean;
    cloningId: string | null;
    onEdit: (tmpl: MessageTemplate) => void;
    onClone: (tmpl: MessageTemplate) => void;
    onDelete: (tmpl: MessageTemplate) => void;
    onPreview: (tmpl: MessageTemplate) => void;
    onUpdateStatus: (tmpl: MessageTemplate, status: TemplateStatus) => void;
}

export function TemplateGallery({
    templates,
    isLoading,
    cloningId,
    onEdit,
    onClone,
    onDelete,
    onPreview,
    onUpdateStatus
}: TemplateGalleryProps) {
    // 1. Initial State Definition with Requested Default Configurations
    const [searchTerm, setSearchTerm] = React.useState('');
    const [channelFilter, setChannelFilter] = React.useState('all');
    const [categoryFilter, setCategoryFilter] = React.useState('all'); // defaulted to show all types
    const [statusFilter, setStatusFilter] = React.useState<TemplateStatus | 'all'>('all'); // defaulted to show all status
    const [targetFilter, setTargetFilter] = React.useState<TemplateTarget | 'all'>('all'); // defaulted to show all targets
    const [groupBy, setGroupBy] = React.useState<'none' | 'channel' | 'category'>('category'); // defaulted to group by category
    const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');

    // 2. Load User Caching Filters from LocalStorage on mount safely
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedSearch = localStorage.getItem('smartsapp_template_searchTerm');
            const storedChannel = localStorage.getItem('smartsapp_template_channelFilter');
            const storedCategory = localStorage.getItem('smartsapp_template_categoryFilter');
            const storedStatus = localStorage.getItem('smartsapp_template_statusFilter');
            const storedTarget = localStorage.getItem('smartsapp_template_targetFilter');
            const storedGroupBy = localStorage.getItem('smartsapp_template_groupBy');
            const storedViewMode = localStorage.getItem('smartsapp_template_viewMode');

            if (storedSearch !== null) setSearchTerm(storedSearch);
            if (storedChannel !== null) setChannelFilter(storedChannel);
            if (storedCategory !== null) setCategoryFilter(storedCategory);
            if (storedStatus !== null) setStatusFilter(storedStatus as any);
            if (storedTarget !== null) setTargetFilter(storedTarget as any);
            if (storedGroupBy !== null) setGroupBy(storedGroupBy as any);
            if (storedViewMode !== null) setViewMode(storedViewMode as any);
        }
    }, []);

    // 3. Save User Selection to LocalStorage when changed
    React.useEffect(() => {
        localStorage.setItem('smartsapp_template_searchTerm', searchTerm);
    }, [searchTerm]);

    React.useEffect(() => {
        localStorage.setItem('smartsapp_template_channelFilter', channelFilter);
    }, [channelFilter]);

    React.useEffect(() => {
        localStorage.setItem('smartsapp_template_categoryFilter', categoryFilter);
    }, [categoryFilter]);

    React.useEffect(() => {
        localStorage.setItem('smartsapp_template_statusFilter', statusFilter);
    }, [statusFilter]);

    React.useEffect(() => {
        localStorage.setItem('smartsapp_template_targetFilter', targetFilter);
    }, [targetFilter]);

    React.useEffect(() => {
        localStorage.setItem('smartsapp_template_groupBy', groupBy);
    }, [groupBy]);

    React.useEffect(() => {
        localStorage.setItem('smartsapp_template_viewMode', viewMode);
    }, [viewMode]);

    const filteredTemplates = React.useMemo(() => {
        return templates.filter(t => 
            (channelFilter === 'all' || t.channel === channelFilter) &&
            (categoryFilter === 'all' || t.category === categoryFilter) &&
            (statusFilter === 'all' || t.status === statusFilter) &&
            (targetFilter === 'all' || t.target === targetFilter) &&
            (t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.body.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [templates, searchTerm, channelFilter, categoryFilter, statusFilter, targetFilter]);

    const groupedTemplates = React.useMemo(() => {
        if (groupBy === 'none') return { 'All Templates': filteredTemplates };
        
        return filteredTemplates.reduce((acc, template) => {
            const key = groupBy === 'channel' 
                ? (template.channel === 'email' ? 'Email Templates' : 'SMS Templates')
                : (template.category ? (template.category.charAt(0).toUpperCase() + template.category.slice(1).replace('_', ' ') + ' Templates') : 'General Templates');
            
            if (!acc[key]) acc[key] = [];
            acc[key].push(template);
            return acc;
        }, {} as Record<string, MessageTemplate[]>);
    }, [filteredTemplates, groupBy]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-left">
            <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search templates..." 
                        className="pl-9 rounded-xl border-border bg-background h-10 w-full" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <Select value={channelFilter} onValueChange={setChannelFilter}>
                        <SelectTrigger className="w-full sm:w-36 rounded-xl border-border bg-background h-10">
                            <SelectValue placeholder="Channel" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Channels</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-full sm:w-36 rounded-xl border-border bg-background h-10">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Types</SelectItem>
                            {['general', 'surveys', 'meetings', 'forms', 'agreements', 'campaigns', 'reminders', 'tasks', 'automations', 'qr_codes', 'users'].map(c => <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                        <SelectTrigger className="w-full sm:w-36 rounded-xl border-border bg-background h-10">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={targetFilter} onValueChange={(v: any) => setTargetFilter(v)}>
                        <SelectTrigger className="w-full sm:w-40 rounded-xl border-border bg-background h-10">
                            <SelectValue placeholder="Target" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Targets</SelectItem>
                            <SelectItem value="external_client">External Client</SelectItem>
                            <SelectItem value="internal_team">Team / Staff</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                        <SelectTrigger className="w-full sm:w-36 rounded-xl border-border bg-background h-10">
                            <SelectValue placeholder="Group By" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="none">Flat List</SelectItem>
                            <SelectItem value="channel">By Channel</SelectItem>
                            <SelectItem value="category">By Category</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Grid / List View Mode Toggle Button */}
                    <div className="flex items-center border rounded-xl p-0.5 bg-muted/20 shrink-0 h-10">
                        <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className={cn(
                                "h-8 w-8 rounded-lg transition-all",
                                viewMode === 'grid' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className={cn(
                                "h-8 w-8 rounded-lg transition-all",
                                viewMode === 'list' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setViewMode('list')}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className={cn(
                    viewMode === 'grid' 
                        ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6" 
                        : "flex flex-col gap-3"
                )}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton 
                            key={i} 
                            className={cn(
                                viewMode === 'grid' ? "h-[420px]" : "h-20", 
                                "rounded-2xl shadow-sm"
                            )} 
                        />
                    ))}
                </div>
            ) : (
                <div className="space-y-16 pb-32">
                    {Object.entries(groupedTemplates).map(([groupName, groupItems]) => (
                        <section key={groupName} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {groupBy !== 'none' ? (
                                <div className="flex items-center gap-4">
                                    <h2 className="text-xl font-semibold tracking-tight text-foreground/80">{groupName}</h2>
                                    <Badge variant="secondary" className="rounded-full h-6 px-3 font-semibold tabular-nums">{groupItems.length}</Badge>
                                    <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                                </div>
                            ) : null}

                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                    {groupItems.map(template => (
                                        <TemplateCard 
                                            key={template.id} 
                                            template={template} 
                                            cloningId={cloningId}
                                            onPreview={() => onPreview(template)}
                                            onEdit={() => onEdit(template)}
                                            onClone={() => onClone(template)}
                                            onDelete={() => onDelete(template)}
                                            onUpdateStatus={(status) => onUpdateStatus(template, status)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {groupItems.map(template => (
                                        <TemplateRow 
                                            key={template.id} 
                                            template={template} 
                                            cloningId={cloningId}
                                            onPreview={() => onPreview(template)}
                                            onEdit={() => onEdit(template)}
                                            onClone={() => onClone(template)}
                                            onDelete={() => onDelete(template)}
                                            onUpdateStatus={(status) => onUpdateStatus(template, status)}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    ))}
                    
                    {filteredTemplates.length === 0 ? (
                        <div className="col-span-full py-32 text-center border-4 border-dashed rounded-[4rem] bg-background flex flex-col items-center justify-center gap-4 opacity-30">
                            <FileType className="h-16 w-16 text-muted-foreground" />
                            <p className="font-semibold text-sm">No templates found.</p>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
