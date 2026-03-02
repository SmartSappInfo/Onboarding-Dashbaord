
'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MessageTemplate, MessageStyle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
    FileType, 
    Plus, 
    Trash2, 
    Mail, 
    Smartphone, 
    Code,
    X,
    Loader2,
    ArrowLeft,
    AlertCircle,
    Info,
    Search,
    Filter,
    LayoutGrid,
    ListTree,
    Eye,
    Sparkles,
    Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SmartSappIcon } from '@/components/icons';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { generateEmailTemplate } from '@/ai/flows/generate-email-template-flow';

type GroupByOption = 'none' | 'category' | 'channel';

export default function MessageTemplatesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAdding, setIsAdding] = React.useState(false);
    const [isAiGenerating, setIsAiGenerating] = React.useState(false);
    
    // Filters & View State
    const [searchTerm, setSearchTerm] = React.useState('');
    const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
    const [channelFilter, setChannelFilter] = React.useState<string>('all');
    const [groupBy, setGroupBy] = React.useState<GroupByOption>('none');
    const [previewTemplate, setPreviewTemplate] = React.useState<MessageTemplate | null>(null);

    // Form State
    const [name, setName] = React.useState('');
    const [category, setCategory] = React.useState<MessageTemplate['category']>('general');
    const [channel, setChannel] = React.useState<'sms' | 'email'>('sms');
    const [subject, setSubject] = React.useState('');
    const [body, setBody] = React.useState('');
    const [styleId, setStyleId] = React.useState('none');
    const [variables, setVariables] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // AI Form State
    const [aiPrompt, setAiPrompt] = React.useState('');
    const [isAiProcessing, setIsAiProcessing] = React.useState(false);

    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_templates'), orderBy('createdAt', 'desc'));
    }, [firestore]);

    const stylesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_styles'), orderBy('name', 'asc'));
    }, [firestore]);

    const { data: templates, isLoading } = useCollection<MessageTemplate>(templatesQuery);
    const { data: styles } = useCollection<MessageStyle>(stylesQuery);

    const filteredTemplates = React.useMemo(() => {
        if (!templates) return [];
        return templates.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 t.body.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
            const matchesChannel = channelFilter === 'all' || t.channel === channelFilter;
            return matchesSearch && matchesCategory && matchesChannel;
        });
    }, [templates, searchTerm, categoryFilter, channelFilter]);

    const groupedTemplates = React.useMemo(() => {
        if (groupBy === 'none') return { 'All Templates': filteredTemplates };
        
        return filteredTemplates.reduce((acc, t) => {
            const key = groupBy === 'category' ? t.category : t.channel;
            const groupKey = key.charAt(0).toUpperCase() + key.slice(1);
            if (!acc[groupKey]) acc[groupKey] = [];
            acc[groupKey].push(t);
            return acc;
        }, {} as Record<string, MessageTemplate[]>);
    }, [filteredTemplates, groupBy]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !name || !body) return;
        
        const variableList = variables.split(',').map(v => v.trim()).filter(Boolean);

        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'message_templates'), {
                name: name.trim(),
                category,
                channel,
                subject: channel === 'email' ? subject.trim() : undefined,
                body: body.trim(),
                styleId: channel === 'email' && styleId !== 'none' ? styleId : undefined,
                variables: variableList,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            resetForm();
            setIsAdding(false);
            toast({ title: 'Template Created', description: 'Message template is ready for use.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to create template.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setName('');
        setBody('');
        setVariables('');
        setSubject('');
        setStyleId('none');
    }

    const handleAiGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setIsAiProcessing(true);
        try {
            const result = await generateEmailTemplate({
                prompt: aiPrompt,
                channel: channel,
                schoolContext: "General SmartSapp partner school context."
            });

            setName(result.name);
            if (result.subject) setSubject(result.subject);
            setBody(result.body);
            setVariables(result.variables.join(', '));
            setIsAiGenerating(false);
            setAiPrompt('');
            setIsAdding(true);
            toast({ title: 'AI Generation Complete', description: 'Review and save the generated template.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'AI Generation Failed', description: e.message });
        } finally {
            setIsAiProcessing(false);
        }
    };

    const toggleActive = async (template: MessageTemplate) => {
        if (!firestore) return;
        const docRef = doc(firestore, 'message_templates', template.id);
        await updateDoc(docRef, { isActive: !template.isActive, updatedAt: new Date().toISOString() });
    };

    const handleDelete = async (id: string) => {
        if (!firestore || !confirm('Are you sure?')) return;
        await deleteDoc(doc(firestore, 'message_templates', id));
        toast({ title: 'Template Deleted' });
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
                <div>
                    <Button asChild variant="ghost" className="-ml-2 mb-2">
                        <Link href="/admin/messaging">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Hub
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <FileType className="h-8 w-8 text-primary" />
                        Message Templates
                    </h1>
                    <p className="text-muted-foreground">Dynamic content definitions for SMS and Email automation.</p>
                </div>
                <div className="flex items-center gap-2">
                    <RainbowButton onClick={() => setIsAiGenerating(true)} className="h-10 px-4 gap-2 font-bold shadow-lg">
                        <Sparkles className="h-4 w-4" /> Create with AI
                    </RainbowButton>
                    <Button onClick={() => { setIsAdding(!isAdding); if(!isAdding) resetForm(); }} variant="outline" className="font-bold rounded-xl">
                        {isAdding ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                        {isAdding ? 'Cancel' : 'New Template'}
                    </Button>
                </div>
            </div>

            {/* AI Generator Dialog */}
            <Dialog open={isAiGenerating} onOpenChange={setIsAiGenerating}>
                <DialogContent className="sm:max-w-md rounded-[2rem]">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-xl"><Sparkles className="h-5 w-5 text-primary" /></div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight">AI Template Architect</DialogTitle>
                        </div>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Describe the communication context</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Channel</Label>
                            <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1 rounded-xl">
                                <Button variant={channel === 'email' ? 'secondary' : 'ghost'} size="sm" onClick={() => setChannel('email')} className={cn("h-9 rounded-lg font-bold uppercase text-[10px]", channel === 'email' && "bg-white shadow-sm text-primary")}>Email</Button>
                                <Button variant={channel === 'sms' ? 'secondary' : 'ghost'} size="sm" onClick={() => setChannel('sms')} className={cn("h-9 rounded-lg font-bold uppercase text-[10px]", channel === 'sms' && "bg-white shadow-sm text-primary")}>SMS</Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Generation Prompt</Label>
                            <Textarea 
                                value={aiPrompt} 
                                onChange={e => setAiPrompt(e.target.value)} 
                                placeholder="e.g. Write a welcome email for new parents that includes their child's name and a link to the handbook." 
                                className="min-h-[120px] rounded-2xl bg-muted/20 border-none p-4 text-sm leading-relaxed"
                            />
                        </div>
                    </div>
                    <DialogFooter className="bg-muted/30 p-4 -mx-6 -mb-6 mt-2">
                        <Button variant="ghost" onClick={() => setIsAiGenerating(false)} className="font-bold">Cancel</Button>
                        <Button onClick={handleAiGenerate} disabled={isAiProcessing || !aiPrompt.trim()} className="rounded-xl font-bold px-8 shadow-lg min-w-[140px]">
                            {isAiProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Architect Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {isAdding && (
                <Card className="mb-8 border-primary/20 bg-primary/5 animate-in slide-in-from-top-4 duration-300 rounded-[2rem] overflow-hidden shadow-xl">
                    <CardHeader className="bg-muted/30 border-b pb-6">
                        <CardTitle className="text-lg font-black uppercase tracking-tight">Create Dynamic Template</CardTitle>
                        <CardDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">Templates support placeholders like &#123;&#123;name&#125;&#125;.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8 bg-background">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Template Name</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome Message" className="h-11 rounded-xl bg-muted/20 border-none font-bold" required />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Category</Label>
                                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                                    <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="general">General Notification</SelectItem>
                                        <SelectItem value="forms">Doc Signing</SelectItem>
                                        <SelectItem value="surveys">Surveys</SelectItem>
                                        <SelectItem value="meetings">Meetings</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Channel</Label>
                                <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
                                    <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="sms">SMS (Text only)</SelectItem>
                                        <SelectItem value="email">Email (HTML)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {channel === 'email' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Subject</Label>
                                    <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line..." className="h-11 rounded-xl bg-muted/20 border-none font-bold" required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Style Wrapper</Label>
                                    <Select value={styleId} onValueChange={setStyleId}>
                                        <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="none">No Wrapper (Plain HTML)</SelectItem>
                                            {styles?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 pt-4 border-t border-border/50">
                            <div className="flex justify-between items-center mb-1">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Message Body</Label>
                                <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Info className="h-3 w-3" />
                                    Use &#123;&#123;var_name&#125;&#125; for dynamic logic
                                </span>
                            </div>
                            <Textarea 
                                value={body} 
                                onChange={e => setBody(e.target.value)} 
                                className="min-h-[180px] bg-muted/20 border-none rounded-2xl p-4 text-sm leading-relaxed" 
                                placeholder={channel === 'sms' ? "Hi {{name}}, welcome to SmartSapp..." : "<h1>Hello {{name}}</h1>..."}
                                required 
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Required Variables (Comma separated)</Label>
                            <Input 
                                value={variables} 
                                onChange={e => setVariables(e.target.value)} 
                                placeholder="name, school_name, date" 
                                className="h-11 rounded-xl bg-muted/20 border-none font-mono text-xs"
                            />
                            <p className="text-[10px] text-muted-foreground italic px-1">The composer UI will automatically create input fields for these names during dispatch.</p>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button onClick={handleAdd} disabled={isSubmitting} className="h-12 px-10 rounded-xl font-black shadow-lg">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                Commit Template
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!isAdding && (
                <div className="mb-8 flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
                    <div className="relative flex-grow w-full md:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search templates..." 
                            className="pl-10 h-10 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-medium" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="h-10 w-[140px] text-[10px] font-black uppercase tracking-widest border-none bg-muted/20 rounded-xl">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">All Categories</SelectItem>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="forms">Doc Signing</SelectItem>
                                <SelectItem value="surveys">Surveys</SelectItem>
                                <SelectItem value="meetings">Meetings</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={channelFilter} onValueChange={setChannelFilter}>
                            <SelectTrigger className="h-10 w-[120px] text-[10px] font-black uppercase tracking-widest border-none bg-muted/20 rounded-xl">
                                <SelectValue placeholder="Channel" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">All Channels</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                            </SelectContent>
                        </Select>

                        <Separator orientation="vertical" className="h-6 hidden sm:block" />

                        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border">
                            <Button 
                                variant={groupBy === 'none' ? 'secondary' : 'ghost'} 
                                size="sm" 
                                className={cn("h-8 px-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg", groupBy === 'none' && "bg-white shadow-sm")}
                                onClick={() => setGroupBy('none')}
                            >
                                <LayoutGrid className="h-3 w-3 mr-1.5" /> Grid
                            </Button>
                            <Button 
                                variant={groupBy === 'category' ? 'secondary' : 'ghost'} 
                                size="sm" 
                                className={cn("h-8 px-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg", groupBy === 'category' && "bg-white shadow-sm")}
                                onClick={() => setGroupBy('category')}
                            >
                                <ListTree className="h-3 w-3 mr-1.5" /> Category
                            </Button>
                            <Button 
                                variant={groupBy === 'channel' ? 'secondary' : 'ghost'} 
                                size="sm" 
                                className={cn("h-8 px-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg", groupBy === 'channel' && "bg-white shadow-sm")}
                                onClick={() => setGroupBy('channel')}
                            >
                                <Smartphone className="h-3 w-3 mr-1.5" /> Channel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-12">
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-40 animate-pulse bg-muted rounded-[1.5rem]" />)}
                    </div>
                ) : Object.entries(groupedTemplates).map(([groupTitle, groupItems]) => (
                    <div key={groupTitle} className="space-y-6">
                        {groupBy !== 'none' && (
                            <div className="flex items-center gap-3">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">{groupTitle}</h3>
                                <div className="h-px flex-1 bg-primary/10" />
                                <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter h-5">{groupItems.length}</Badge>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {groupItems.map((template) => (
                                <Card key={template.id} className="group relative border-border/50 hover:shadow-xl transition-all rounded-[1.5rem] overflow-hidden bg-card">
                                    <div className="absolute top-3 right-3 flex items-center gap-3 z-20">
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setPreviewTemplate(template)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => handleDelete(template.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <Switch 
                                            checked={template.isActive} 
                                            onCheckedChange={() => toggleActive(template)}
                                            className="scale-75"
                                        />
                                    </div>
                                    <CardHeader className="py-4">
                                        <div className="flex items-center justify-between pr-12">
                                            <div className="flex items-center gap-3">
                                                <div className={cn("p-2.5 rounded-xl border shadow-sm transition-transform group-hover:scale-110", template.channel === 'sms' ? "bg-orange-500/10 text-orange-500 border-orange-100" : "bg-blue-500/10 text-blue-500 border-blue-100")}>
                                                    {template.channel === 'sms' ? <Smartphone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <CardTitle className="text-base font-black truncate max-w-[200px]">{template.name}</CardTitle>
                                                    <CardDescription className="text-[9px] uppercase font-bold tracking-widest opacity-60">{template.category}</CardDescription>
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="p-4 bg-muted/20 rounded-2xl border border-dashed text-xs text-muted-foreground italic line-clamp-2 min-h-[4rem] leading-relaxed">
                                            &ldquo;{template.body.replace(/<[^>]*>?/gm, '')}&rdquo;
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {template.variables.map(v => (
                                                <Badge key={v} variant="outline" className="text-[8px] h-5 bg-white border-primary/20 text-primary font-black uppercase tracking-tighter px-2">
                                                    &#123;&#123;{v}&#125;&#125;
                                                </Badge>
                                            ))}
                                            {template.variables.length === 0 && <span className="text-[10px] text-muted-foreground/40 italic">No dynamic logic points defined</span>}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))}

                {!isLoading && filteredTemplates.length === 0 && (
                    <div className="py-24 text-center border-4 border-dashed rounded-[3rem] bg-muted/10 border-muted-foreground/10">
                        <FileType className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                        <p className="text-muted-foreground font-black uppercase tracking-widest text-xs opacity-60">No templates found matching your criteria.</p>
                    </div>
                )}
            </div>

            {/* Template Preview Dialog */}
            <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
                <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-[3rem]">
                    <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
                        <div className="flex items-center justify-between pr-8">
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-xl border shadow-sm", previewTemplate?.channel === 'email' ? "bg-blue-500/10 text-blue-500 border-blue-100" : "bg-orange-500/10 text-orange-500 border-orange-100")}>
                                    {previewTemplate?.channel === 'email' ? <Mail className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Visual Preview</DialogTitle>
                                    <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Internal reference for &ldquo;{previewTemplate?.name}&rdquo;</DialogDescription>
                                </div>
                            </div>
                            <Badge className="bg-primary text-white border-none h-6 px-3 text-[10px] font-black uppercase tracking-widest">{previewTemplate?.category}</Badge>
                        </div>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden relative bg-slate-100 p-4 sm:p-8">
                        <ScrollArea className="h-full bg-white rounded-[2rem] shadow-2xl border-4 border-white overflow-hidden relative">
                            <div className="min-h-full">
                                {previewTemplate?.channel === 'email' ? (
                                    <div className="flex flex-col h-full">
                                        <div className="p-5 bg-muted/30 border-b space-y-1">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Handset Subject</p>
                                            <p className="font-black text-sm">{previewTemplate.subject || '(No Subject)'}</p>
                                        </div>
                                        <div className="flex-1">
                                            {previewTemplate.styleId ? (
                                                <iframe 
                                                    srcDoc={(styles?.find(s => s.id === previewTemplate.styleId)?.htmlWrapper || '{{content}}').replace('{{content}}', `<div style="font-family: sans-serif; line-height: 1.6; color: #334155;">${previewTemplate.body}</div>`)}
                                                    className="w-full min-h-[500px] border-none"
                                                    title="Email Preview"
                                                />
                                            ) : (
                                                <div className="p-8 prose prose-sm max-w-none text-slate-700 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: previewTemplate.body }} />
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 flex flex-col items-center justify-center min-h-full bg-[#0A1427]">
                                        <div className="w-full max-w-xs space-y-6">
                                            <div className="flex items-center justify-between px-2">
                                                <SmartSappIcon className="h-7 w-7 text-white opacity-20" />
                                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Handset SMS Mock-up</p>
                                            </div>
                                            <div className="bg-white/5 border border-white/10 rounded-[1.5rem] p-5 relative shadow-inner">
                                                <div className="absolute -left-2 top-6 w-4 h-4 bg-[#1a243a] rotate-45 rounded-sm border-l border-b border-white/10" />
                                                <p className="text-sm text-white/90 leading-relaxed font-bold whitespace-pre-wrap">{previewTemplate?.body}</p>
                                            </div>
                                            <div className="pt-4 text-center border-t border-white/5">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-white/20">
                                                    ~ {Math.ceil((previewTemplate?.body.length || 0) / 160)} SMS SEGMENT(S)
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    <DialogFooter className="p-4 bg-muted/30 border-t shrink-0">
                        <Button onClick={() => setPreviewTemplate(null)} className="w-full h-14 rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl active:scale-95 transition-all">Dismiss Preview</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
