'use client';

import * as React from 'react';
import type { MessageTemplate, MessageStyle } from '@/lib/types';
import { 
    Search, 
    FileType, 
    Plus, 
    Smartphone, 
    Mail, 
    Eye, 
    Pencil, 
    CopyPlus, 
    Trash2, 
    Zap 
} from 'lucide-react';
import { Card, CardTitle, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SmartSappIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface TemplateCardProps {
    template: MessageTemplate;
    cloningId: string | null;
    onPreview: () => void;
    onEdit: () => void;
    onClone: () => void;
    onDelete: () => void;
}

function TemplateCard({ template, cloningId, onPreview, onEdit, onClone, onDelete }: TemplateCardProps) {
    return (
        <Card className="group relative border-2 transition-all duration-500 rounded-2xl overflow-hidden bg-card shadow-sm hover:shadow-2xl border-border/50 flex flex-col h-[420px]">
            <div className="h-12 shrink-0 border-b flex items-center justify-between px-4 bg-muted/5 group-hover:bg-background transition-colors duration-500">
                <div className="flex items-center gap-1.5">
                    <div className={cn("p-1.5 rounded-lg border", template.channel === 'sms' ? "bg-orange-500/10 text-orange-500 border-orange-100" : "bg-blue-500/10 text-blue-500 border-blue-100")}>
                        {template.channel === 'sms' ? <Smartphone className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{template.channel} Template</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onPreview}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", cloningId === template.id && "animate-spin")} onClick={onClone} disabled={!!cloningId}><CopyPlus className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
                </div>
            </div>
            
            <div className="flex-1 overflow-hidden relative bg-white flex flex-col items-center justify-center p-1.5">
                {template.channel === 'email' ? (
                    <div className="w-full h-full relative overflow-hidden bg-slate-50 border rounded-xl shadow-inner flex items-start justify-center">
                        <div className="relative transform origin-top scale-[0.42] w-[238%] h-[238%] pointer-events-none p-4 shrink-0">
                            <iframe srcDoc={template.body} className="w-full h-full border-none bg-white rounded-[2rem] pointer-events-none shadow-2xl" title="preview" />
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full bg-white rounded-xl p-6 flex flex-col justify-center gap-4 relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-500 border border-slate-100 shadow-inner">
                        <div className="absolute -right-4 -top-4 opacity-5 rotate-12 text-primary"><Zap size={120} /></div>
                        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xl backdrop-blur-sm">
                            <p className="text-[9px] font-bold text-slate-900 leading-relaxed line-clamp-[8] italic">&ldquo;{template.body}&rdquo;</p>
                        </div>
                        <div className="flex items-center justify-between opacity-20 border-t border-slate-200 pt-3">
                            <SmartSappIcon className="h-3.5 w-3.5" variant="primary" />
                            <span className="text-[7px] font-black uppercase tracking-widest text-slate-900">Handset Simulator</span>
                        </div>
                    </div>
                )}
                <div className="absolute inset-0 bg-transparent z-10" />
            </div>

            <CardHeader className="p-5 shrink-0 bg-background border-t">
                <div className="min-w-0">
                    <CardTitle className="text-sm font-black truncate text-foreground group-hover:text-primary transition-colors leading-tight uppercase">{template.name}</CardTitle>
                    <p className="text-[8px] uppercase font-bold tracking-[0.2em] text-muted-foreground opacity-60 mt-1">{template.category}</p>
                </div>
            </CardHeader>
        </Card>
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
}

export function TemplateGallery({
    templates,
    isLoading,
    cloningId,
    onEdit,
    onClone,
    onDelete,
    onPreview
}: TemplateGalleryProps) {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [channelFilter, setChannelFilter] = React.useState('all');
    const [categoryFilter, setCategoryFilter] = React.useState('all');
    const [groupBy, setGroupBy] = React.useState<'none' | 'channel' | 'category'>('none');

    const filteredTemplates = React.useMemo(() => {
        return templates.filter(t => 
            (channelFilter === 'all' || t.channel === channelFilter) &&
            (categoryFilter === 'all' || t.category === categoryFilter) &&
            (t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.body.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [templates, searchTerm, channelFilter, categoryFilter]);

    const groupedTemplates = React.useMemo(() => {
        if (groupBy === 'none') return { 'All Protocols': filteredTemplates };
        
        return filteredTemplates.reduce((acc, template) => {
            const key = groupBy === 'channel' 
                ? (template.channel === 'email' ? 'Email Protocols' : 'SMS Protocols')
                : (template.category.charAt(0).toUpperCase() + template.category.slice(1) + ' Protocols');
            
            if (!acc[key]) acc[key] = [];
            acc[key].push(template);
            return acc;
        }, {} as Record<string, MessageTemplate[]>);
    }, [filteredTemplates, groupBy]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-3xl border shadow-sm ring-1 ring-black/5">
                <div className="relative flex-grow w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                    <Input 
                        placeholder="Filter protocol blueprints..." 
                        className="pl-11 h-12 rounded-2xl bg-muted/20 border-none font-bold shadow-none focus:ring-1 focus:ring-primary/20" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Select value={channelFilter} onValueChange={setChannelFilter}>
                        <SelectTrigger className="h-12 w-full md:w-[140px] rounded-2xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest">
                            <SelectValue placeholder="Channel" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Channels</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="h-12 w-full md:w-[140px] rounded-2xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Types</SelectItem>
                            {['general', 'meetings', 'surveys', 'forms'].map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <div className="h-12 w-px bg-border mx-1 hidden md:block" />
                    <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                        <SelectTrigger className="h-12 w-full md:w-[140px] rounded-2xl bg-primary/10 border-none font-black uppercase text-[10px] tracking-widest text-primary">
                            <SelectValue placeholder="Group By" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="none">Flat List</SelectItem>
                            <SelectItem value="channel">By Channel</SelectItem>
                            <SelectItem value="category">By Category</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[420px] rounded-2xl shadow-sm" />)}
                </div>
            ) : (
                <div className="space-y-16 pb-32">
                    {Object.entries(groupedTemplates).map(([groupName, groupItems]) => (
                        <section key={groupName} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {groupBy !== 'none' && (
                                <div className="flex items-center gap-4">
                                    <h2 className="text-xl font-black uppercase tracking-tight text-foreground/80">{groupName}</h2>
                                    <Badge variant="secondary" className="rounded-full h-6 px-3 font-black tabular-nums">{groupItems.length}</Badge>
                                    <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {groupItems.map(template => (
                                    <TemplateCard 
                                        key={template.id} 
                                        template={template} 
                                        cloningId={cloningId}
                                        onPreview={() => onPreview(template)}
                                        onEdit={() => onEdit(template)}
                                        onClone={() => onClone(template)}
                                        onDelete={() => onDelete(template)}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                    
                    {filteredTemplates.length === 0 && (
                        <div className="col-span-full py-32 text-center border-4 border-dashed rounded-[4rem] bg-muted/5 flex flex-col items-center justify-center gap-4 opacity-30">
                            <FileType className="h-16 w-16 text-muted-foreground" />
                            <p className="font-black uppercase tracking-widest text-sm">No protocol blueprints found.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
