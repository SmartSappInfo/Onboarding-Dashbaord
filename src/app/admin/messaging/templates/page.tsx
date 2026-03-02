'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MessageTemplate, MessageStyle, VariableDefinition } from '@/lib/types';
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
    X,
    Loader2,
    ArrowLeft,
    Info,
    Search,
    LayoutGrid,
    ListTree,
    Eye,
    Sparkles,
    Check,
    Pencil,
    Database,
    Tag,
    Library,
    Save
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type GroupByOption = 'none' | 'category' | 'channel';

export default function MessageTemplatesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAdding, setIsAdding] = React.useState(false);
    const [isAiGenerating, setIsAiGenerating] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
    
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
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // AI Form State
    const [aiPrompt, setAiPrompt] = React.useState('');
    const [isAiProcessing, setIsAiProcessing] = React.useState(false);

    // Refs for cursor tracking
    const bodyRef = React.useRef<HTMLTextAreaElement>(null);
    const subjectRef = React.useRef<HTMLInputElement>(null);

    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_templates'), orderBy('createdAt', 'desc'));
    }, [firestore]);

    const stylesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_styles'), orderBy('name', 'asc'));
    }, [firestore]);

    const varsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'messaging_variables'));
    }, [firestore]);

    const { data: templates, isLoading } = useCollection<MessageTemplate>(templatesQuery);
    const { data: styles } = useCollection<MessageStyle>(stylesQuery);
    const { data: variables } = useCollection<VariableDefinition>(varsQuery);

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

    // Intelligent Variable Filtering logic
    const contextVariables = React.useMemo(() => {
        if (!variables) return [];
        const activeCategory = editingTemplate ? editingTemplate.category : category;
        
        // Always include general variables
        const generalVars = variables.filter(v => v.category === 'general');
        
        // Include context specific variables
        let specificVars: VariableDefinition[] = [];
        if (activeCategory === 'meetings') specificVars = variables.filter(v => v.category === 'meetings');
        if (activeCategory === 'surveys') specificVars = variables.filter(v => v.category === 'surveys');
        if (activeCategory === 'forms') specificVars = variables.filter(v => v.category === 'forms');

        return [...generalVars, ...specificVars];
    }, [variables, category, editingTemplate]);

    // Helper to extract unique variables from body/subject
    const extractVariables = (text: string) => {
        const matches = text.match(/\{\{(.*?)\}\}/g);
        if (!matches) return [];
        return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))];
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !name || !body) return;
        
        const variableList = extractVariables(`${subject} ${body}`);

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

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !editingTemplate || !name || !body) return;

        const variableList = extractVariables(`${subject} ${body}`);
        setIsSubmitting(true);

        try {
            await updateDoc(doc(firestore, 'message_templates', editingTemplate.id), {
                name: name.trim(),
                category,
                channel,
                subject: channel === 'email' ? subject.trim() : undefined,
                body: body.trim(),
                styleId: channel === 'email' && styleId !== 'none' ? styleId : undefined,
                variables: variableList,
                updatedAt: new Date().toISOString(),
            });
            setEditingTemplate(null);
            resetForm();
            toast({ title: 'Template Updated' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Update Failed' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setName('');
        setBody('');
        setSubject('');
        setStyleId('none');
        setCategory('general');
        setChannel('sms');
    };

    const handleEditClick = (template: MessageTemplate) => {
        setEditingTemplate(template);
        setName(template.name);
        setCategory(template.category);
        setChannel(template.channel);
        setSubject(template.subject || '');
        setBody(template.body);
        setStyleId(template.styleId || 'none');
    };

    const handleInsertVariable = (key: string, target: 'body' | 'subject') => {
        const tag = `{{${key}}}`;
        if (target === 'body') {
            const el = bodyRef.current;
            if (!el) return;
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const newBody = body.substring(0, start) + tag + body.substring(end);
            setBody(newBody);
            // Re-focus and set cursor after tag
            setTimeout(() => {
                el.focus();
                el.setSelectionRange(start + tag.length, start + tag.length);
            }, 0);
        } else {
            const el = subjectRef.current;
            if (!el) return;
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const newSubject = subject.substring(0, start) + tag + subject.substring(end);
            setSubject(newSubject);
            setTimeout(() => {
                el.focus();
                el.setSelectionRange(start + tag.length, start + tag.length);
            }, 0);
        }
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setIsAiProcessing(true);
        try {
            // Pass available variables to AI for intelligent injection
            const availableTags = contextVariables.map(v => v.key);

            const result = await generateEmailTemplate({
                prompt: aiPrompt,
                channel: channel,
                availableVariables: availableTags,
                schoolContext: "General SmartSapp partner school context."
            });

            setName(result.name);
            if (result.subject) setSubject(result.subject);
            setBody(result.body);
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

    const VariableLibrarySection = ({ target }: { target: 'body' | 'subject' }) => (
        <Card className="border-none ring-1 ring-border shadow-inner bg-muted/30 rounded-2xl overflow-hidden h-full">
            <CardHeader className="bg-primary/5 border-b py-3 px-4">
                <div className="flex items-center gap-2">
                    <Database className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Variable Library</span>
                </div>
            </CardHeader>
            <ScrollArea className="h-[400px]">
                <div className="p-3 space-y-4">
                    {contextVariables.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                            {contextVariables.map(v => (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => handleInsertVariable(v.key, target)}
                                    className="flex flex-col items-start gap-1 p-2.5 rounded-xl bg-background border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-[9px] font-black uppercase text-primary/60 tracking-tighter">{v.sourceName || 'Core'}</span>
                                        <Plus className="h-2.5 w-2.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <p className="text-xs font-bold leading-tight line-clamp-1">{v.label}</p>
                                    <code className="text-[9px] font-mono text-muted-foreground bg-muted/50 px-1.5 rounded uppercase mt-1">{"{{" + v.key + "}}"}</code>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 text-center opacity-30">
                            <Tag className="h-8 w-8 mx-auto mb-2" />
                            <p className="text-[9px] font-black uppercase">No Registry Links</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </Card>
    );

    const TemplateFormContent = () => (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Template Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome Message" className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" required />
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
                            <Input 
                                ref={subjectRef}
                                value={subject} 
                                onChange={e => setSubject(e.target.value)} 
                                placeholder="Subject line..." 
                                className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" 
                                required 
                            />
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
                            Library tags are strictly preserved
                        </span>
                    </div>
                    <Textarea 
                        ref={bodyRef}
                        value={body} 
                        onChange={e => setBody(e.target.value)} 
                        className="min-h-[250px] bg-muted/20 border-none rounded-2xl p-4 text-base leading-relaxed font-medium" 
                        placeholder={channel === 'sms' ? "Hi {{name}}, welcome to SmartSapp..." : "<h1>Hello {{name}}</h1>..."}
                        required 
                    />
                </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
                <VariableLibrarySection target={document.activeElement === subjectRef.current ? 'subject' : 'body'} />
                
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-3 shadow-inner">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Required Context</p>
                    <div className="flex flex-wrap gap-1.5">
                        {extractVariables(`${subject} ${body}`).map(v => (
                            <Badge key={v} variant="outline" className="text-[8px] bg-white border-primary/20 text-primary uppercase font-black">{v}</Badge>
                        ))}
                        {extractVariables(`${subject} ${body}`).length === 0 && <span className="text-[9px] text-muted-foreground/40 italic font-medium">None detected.</span>}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
            <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
                <div>
                    <Button asChild variant="ghost" className="-ml-2 mb-2">
                        <Link href="/admin/messaging">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Engine
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-foreground uppercase">
                        Message Templates
                    </h1>
                    <p className="text-muted-foreground font-medium">Define context-aware logic for SMS and Email automation.</p>
                </div>
                <div className="flex items-center gap-2">
                    <RainbowButton onClick={() => setIsAiGenerating(true)} className="h-10 px-4 gap-2 font-bold shadow-lg">
                        <Sparkles className="h-4 w-4" /> Create with AI
                    </RainbowButton>
                    <Button onClick={() => { setIsAdding(!isAdding); if(!isAdding) resetForm(); }} variant={isAdding ? "ghost" : "default"} className="font-bold rounded-xl h-10 px-6 shadow-xl">
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
                <Card className="mb-8 border-primary/20 bg-primary/5 animate-in slide-in-from-top-4 duration-300 rounded-[2.5rem] overflow-hidden shadow-2xl bg-white ring-1 ring-border">
                    <CardHeader className="bg-muted/30 border-b pb-6 p-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                <Library className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black uppercase tracking-tight">Create Dynamic Template</CardTitle>
                                <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Compose multi-channel logic with Registry variables.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 bg-background">
                        <form onSubmit={handleAdd} className="space-y-8">
                            <TemplateFormContent />
                            <div className="flex justify-end pt-8 border-t border-border/50 gap-4">
                                <Button type="button" variant="ghost" onClick={() => setIsAdding(false)} className="font-bold h-12 rounded-xl px-8">Discard</Button>
                                <Button type="submit" disabled={isSubmitting} className="h-12 px-12 rounded-[1.25rem] font-black shadow-2xl active:scale-95 transition-all text-base uppercase tracking-widest bg-primary text-white">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                    Commit Template
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {!isAdding && (
                <div className="mb-12 flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-3xl border border-border/50 shadow-sm">
                    <div className="relative flex-grow w-full md:w-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                        <Input 
                            placeholder="Filter by name or content..." 
                            className="pl-11 h-12 rounded-2xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="h-12 w-[160px] text-[10px] font-black uppercase tracking-widest border-none bg-muted/20 rounded-2xl">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                                <SelectItem value="all">All Categories</SelectItem>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="forms">Doc Signing</SelectItem>
                                <SelectItem value="surveys">Surveys</SelectItem>
                                <SelectItem value="meetings">Meetings</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex items-center gap-1 bg-muted/30 p-1.5 rounded-2xl border border-border/50 shadow-inner">
                            <Button 
                                variant={groupBy === 'none' ? 'secondary' : 'ghost'} 
                                size="sm" 
                                className={cn("h-9 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", groupBy === 'none' && "bg-white shadow-md text-primary")}
                                onClick={() => setGroupBy('none')}
                            >
                                <LayoutGrid className="h-3.5 w-3.5 mr-2" /> Grid
                            </Button>
                            <Button 
                                variant={groupBy === 'category' ? 'secondary' : 'ghost'} 
                                size="sm" 
                                className={cn("h-9 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", groupBy === 'category' && "bg-white shadow-md text-primary")}
                                onClick={() => setGroupBy('category')}
                            >
                                <ListTree className="h-3.5 w-3.5 mr-2" /> Context
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-16">
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-64 animate-pulse bg-muted rounded-[2.5rem]" />)}
                    </div>
                ) : Object.entries(groupedTemplates).map(([groupTitle, groupItems]) => (
                    <div key={groupTitle} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {groupBy !== 'none' && (
                            <div className="flex items-center gap-4 px-2">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{groupTitle}</h3>
                                <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
                                <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 h-6 px-3 font-black rounded-lg">{groupItems.length}</Badge>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {groupItems.map((template) => (
                                <Card key={template.id} className="group relative border-border/50 hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] transition-all duration-500 rounded-[2.5rem] overflow-hidden bg-card">
                                    <div className="absolute top-4 right-4 flex items-center gap-3 z-20">
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 text-primary" onClick={() => setPreviewTemplate(template)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Preview Rendering</TooltipContent>
                                                </Tooltip>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 text-primary" onClick={() => handleEditClick(template)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Modify Logic</TooltipContent>
                                                </Tooltip>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => handleDelete(template.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Purge Template</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <Switch 
                                            checked={template.isActive} 
                                            onCheckedChange={() => toggleActive(template)}
                                            className="scale-90"
                                        />
                                    </div>
                                    <CardHeader className="p-6 pb-4">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "p-3 rounded-2xl border shadow-sm transition-transform group-hover:scale-110 group-hover:rotate-3 duration-500", 
                                                template.channel === 'sms' ? "bg-orange-500/10 text-orange-500 border-orange-100" : "bg-blue-500/10 text-blue-500 border-blue-100"
                                            )}>
                                                {template.channel === 'sms' ? <Smartphone className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                                            </div>
                                            <div className="min-w-0">
                                                <CardTitle className="text-lg font-black truncate text-foreground group-hover:text-primary transition-colors leading-tight">{template.name}</CardTitle>
                                                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-60 mt-1">{template.category}</p>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="px-6 pb-6 space-y-6">
                                        <div className="p-5 bg-muted/20 rounded-[1.5rem] border border-dashed border-border/50 text-[13px] text-muted-foreground/80 italic line-clamp-3 min-h-[5.5rem] leading-relaxed shadow-inner">
                                            &ldquo;{template.body.replace(/<[^>]*>?/gm, '')}&rdquo;
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {template.variables.map(v => (
                                                <Badge key={v} variant="outline" className="text-[9px] h-6 bg-white border-primary/10 text-primary font-black uppercase tracking-tight px-2.5 rounded-lg shadow-sm">
                                                    &#123;&#123;{v}&#125;&#125;
                                                </Badge>
                                            ))}
                                            {template.variables.length === 0 && <span className="text-[10px] text-muted-foreground/30 italic px-1 font-medium">Static Content Only</span>}
                                        </div>
                                    </CardContent>
                                    <div className="bg-muted/30 p-3 px-6 border-t flex justify-between items-center group-hover:bg-primary/5 transition-colors">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">{template.channel === 'email' ? 'HTML Ready' : 'Text Compliant'}</span>
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-1.5 w-1.5 rounded-full bg-primary/20" />
                                            <span className="text-[9px] font-black uppercase text-primary/60 tracking-tighter">{template.variables.length} Tags Attached</span>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))}

                {!isLoading && filteredTemplates.length === 0 && (
                    <div className="py-32 text-center border-4 border-dashed rounded-[4rem] bg-muted/10 border-muted-foreground/5 shadow-inner">
                        <div className="mx-auto bg-white/50 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-xl">
                            <FileType className="h-12 w-12 text-muted-foreground/20" />
                        </div>
                        <p className="text-muted-foreground font-black uppercase tracking-widest text-sm opacity-60">No templates found in this registry</p>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground/40 mt-2">Try adjusting your filters or create a new logic architecture</p>
                    </div>
                )}
            </div>

            {/* Template Preview Dialog */}
            <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
                <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-[3rem] border-none shadow-2xl">
                    <DialogHeader className="p-8 border-b bg-muted/30 shrink-0">
                        <div className="flex items-center justify-between pr-8">
                            <div className="flex items-center gap-4">
                                <div className={cn("p-3 rounded-2xl border shadow-xl transition-transform", previewTemplate?.channel === 'email' ? "bg-blue-500/10 text-blue-500 border-blue-100" : "bg-orange-500/10 text-orange-500 border-orange-100")}>
                                    {previewTemplate?.channel === 'email' ? <Mail className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Visual Simulation</DialogTitle>
                                    <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Authorized rendering for &ldquo;{previewTemplate?.name}&rdquo;</DialogDescription>
                                </div>
                            </div>
                            <Badge className="bg-primary text-white border-none h-7 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg">{previewTemplate?.category}</Badge>
                        </div>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden relative bg-slate-100 p-4 sm:p-10">
                        <ScrollArea className="h-full bg-white rounded-[2.5rem] shadow-2xl border-[12px] border-white overflow-hidden relative ring-1 ring-border/50">
                            <div className="min-h-full">
                                {previewTemplate?.channel === 'email' ? (
                                    <div className="flex flex-col h-full">
                                        <div className="p-8 bg-muted/30 border-b space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">Handset Subject</p>
                                            <p className="font-black text-xl text-foreground">{previewTemplate.subject || '(No Subject)'}</p>
                                        </div>
                                        <div className="flex-1 p-1">
                                            {previewTemplate.styleId ? (
                                                <iframe 
                                                    srcDoc={(styles?.find(s => s.id === previewTemplate.styleId)?.htmlWrapper || '{{content}}').replace('{{content}}', `<div style="font-family: sans-serif; line-height: 1.8; color: #334155; font-size: 16px;">${previewTemplate.body}</div>`)}
                                                    className="w-full min-h-[600px] border-none"
                                                    title="Email Rendering"
                                                />
                                            ) : (
                                                <div className="p-10 prose prose-slate max-w-none text-slate-700 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: previewTemplate.body }} />
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-12 flex flex-col items-center justify-center min-h-full bg-[#0A1427]">
                                        <div className="w-full max-w-xs space-y-10">
                                            <div className="flex items-center justify-between px-2">
                                                <SmartSappIcon className="h-8 w-8 text-white opacity-20" />
                                                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Handset SMS Simulator</p>
                                            </div>
                                            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 relative shadow-inner group">
                                                <div className="absolute -left-3 top-10 w-6 h-6 bg-[#0A1427] rotate-45 rounded-sm border-l border-b border-white/10" />
                                                <p className="text-[15px] text-white/95 leading-relaxed font-bold whitespace-pre-wrap">{previewTemplate?.body}</p>
                                            </div>
                                            <div className="pt-8 text-center border-t border-white/5">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-white/20">
                                                    Estimated: {Math.ceil((previewTemplate?.body.length || 0) / 160)} SMS SEGMENT(S)
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    <DialogFooter className="p-6 bg-muted/30 border-t shrink-0">
                        <Button onClick={() => setPreviewTemplate(null)} className="w-full h-16 rounded-[1.5rem] font-black text-xl uppercase tracking-widest shadow-2xl active:scale-95 transition-all bg-foreground text-background hover:bg-foreground/90">Acknowledge Rendering</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Template Dialog */}
            <Dialog open={!!editingTemplate} onOpenChange={(o) => !o && setEditingTemplate(null)}>
                <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-[3rem] border-none shadow-2xl">
                    <DialogHeader className="p-8 border-b bg-muted/30 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl">
                                <Pencil className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Modify Template Logic</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Updating: &ldquo;{editingTemplate?.name}&rdquo;</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <ScrollArea className="flex-1 bg-background">
                        <div className="p-8">
                            <form onSubmit={handleUpdate} className="space-y-8">
                                <TemplateFormContent />
                            </form>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex justify-end gap-4">
                        <Button type="button" variant="ghost" onClick={() => setEditingTemplate(null)} className="font-bold h-12 rounded-xl px-8">Discard</Button>
                        <Button 
                            onClick={handleUpdate} 
                            disabled={isSubmitting} 
                            className="h-12 px-12 rounded-[1.25rem] font-black shadow-2xl active:scale-95 transition-all text-base uppercase tracking-widest bg-primary text-white"
                        >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Update Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
