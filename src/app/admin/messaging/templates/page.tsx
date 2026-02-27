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
    Trophy
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
    DialogDescription 
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SmartSappIcon } from '@/components/icons';

type GroupByOption = 'none' | 'category' | 'channel';

export default function MessageTemplatesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAdding, setIsAdding] = React.useState(false);
    
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
            setName('');
            setBody('');
            setVariables('');
            setSubject('');
            setIsAdding(false);
            toast({ title: 'Template Created', description: 'Message template is ready for use.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to create template.' });
        } finally {
            setIsSubmitting(false);
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
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Engine
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <FileType className="h-8 w-8 text-primary" />
                        Message Templates
                    </h1>
                    <p className="text-muted-foreground">Dynamic content definitions for SMS and Email automation.</p>
                </div>
                <Button onClick={() => setIsAdding(!isAdding)}>
                    {isAdding ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                    {isAdding ? 'Cancel' : 'New Template'}
                </Button>
            </div>

            {/* Filter Bar */}
            {!isAdding && (
                <div className="mb-8 flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-xl border shadow-sm">
                    <div className="relative flex-grow w-full md:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search templates..." 
                            className="pl-10 h-10" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-2">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="h-10 w-[140px] text-xs">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    <SelectItem value="general">General</SelectItem>
                                    <SelectItem value="forms">Doc Signing</SelectItem>
                                    <SelectItem value="surveys">Surveys</SelectItem>
                                    <SelectItem value="meetings">Meetings</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Select value={channelFilter} onValueChange={setChannelFilter}>
                            <SelectTrigger className="h-10 w-[120px] text-xs">
                                <SelectValue placeholder="Channel" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Channels</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                            </SelectContent>
                        </Select>

                        <Separator orientation="vertical" className="h-6 hidden sm:block" />

                        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                            <Button 
                                variant={groupBy === 'none' ? 'secondary' : 'ghost'} 
                                size="sm" 
                                className="h-8 px-2.5 text-[10px] font-bold uppercase tracking-wider"
                                onClick={() => setGroupBy('none')}
                            >
                                <LayoutGrid className="h-3 w-3 mr-1.5" /> Grid
                            </Button>
                            <Button 
                                variant={groupBy === 'category' ? 'secondary' : 'ghost'} 
                                size="sm" 
                                className="h-8 px-2.5 text-[10px] font-bold uppercase tracking-wider"
                                onClick={() => setGroupBy('category')}
                            >
                                <ListTree className="h-3 w-3 mr-1.5" /> By Category
                            </Button>
                            <Button 
                                variant={groupBy === 'channel' ? 'secondary' : 'ghost'} 
                                size="sm" 
                                className="h-8 px-2.5 text-[10px] font-bold uppercase tracking-wider"
                                onClick={() => setGroupBy('channel')}
                            >
                                <Smartphone className="h-3 w-3 mr-1.5" /> By Channel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {isAdding && (
                <Card className="mb-8 border-primary/20 bg-primary/5 animate-in slide-in-from-top-4 duration-300">
                    <CardHeader>
                        <CardTitle>Create Dynamic Template</CardTitle>
                        <CardDescription>Templates support handlebars-style placeholders like &#123;&#123;name&#125;&#125;.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label>Template Name</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome Message" required />
                            </div>
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="general">General Notification</SelectItem>
                                        <SelectItem value="forms">Doc Signing</SelectItem>
                                        <SelectItem value="surveys">Surveys</SelectItem>
                                        <SelectItem value="meetings">Meetings</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Channel</Label>
                                <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sms">SMS (Text only)</SelectItem>
                                        <SelectItem value="email">Email (HTML)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {channel === 'email' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-primary/10">
                                <div className="space-y-2">
                                    <Label>Email Subject</Label>
                                    <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line..." required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Style Wrapper</Label>
                                    <Select value={styleId} onValueChange={setStyleId}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No Wrapper (Plain HTML)</SelectItem>
                                            {styles?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 pt-4 border-t border-primary/10">
                            <div className="flex justify-between items-center">
                                <Label>Message Body</Label>
                                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                    <Info className="h-3 w-3" />
                                    Use &#123;&#123;var_name&#125;&#125; for dynamic data
                                </span>
                            </div>
                            <Textarea 
                                value={body} 
                                onChange={e => setBody(e.target.value)} 
                                className="min-h-[150px] bg-white text-sm" 
                                placeholder={channel === 'sms' ? "Hi {{name}}, welcome to SmartSapp..." : "<h1>Hello {{name}}</h1>..."}
                                required 
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Required Variables (Comma separated)</Label>
                            <Input 
                                value={variables} 
                                onChange={e => setVariables(e.target.value)} 
                                placeholder="name, school_name, date" 
                            />
                            <p className="text-[10px] text-muted-foreground">The composer UI will automatically create input fields for these names.</p>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleAdd} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Template
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-12">
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-40 animate-pulse bg-muted" />)}
                    </div>
                ) : Object.entries(groupedTemplates).map(([groupTitle, groupItems]) => (
                    <div key={groupTitle} className="space-y-6">
                        {groupBy !== 'none' && (
                            <div className="flex items-center gap-3">
                                <h3 className="text-sm font-black uppercase tracking-widest text-primary">{groupTitle}</h3>
                                <div className="h-px flex-1 bg-primary/10" />
                                <Badge variant="outline" className="text-[10px]">{groupItems.length}</Badge>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {groupItems.map((template) => (
                                <Card key={template.id} className="group relative border-border/50 hover:shadow-md transition-all">
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
                                            <div className="flex items-center gap-2">
                                                <div className={cn("p-2 rounded-lg", template.channel === 'sms' ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500")}>
                                                    {template.channel === 'sms' ? <Smartphone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <CardTitle className="text-base">{template.name}</CardTitle>
                                                    <CardDescription className="text-[10px] uppercase font-bold tracking-widest">{template.category}</CardDescription>
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="p-3 bg-muted/30 rounded-lg border border-dashed text-xs text-muted-foreground italic line-clamp-2 min-h-[3rem]">
                                            {template.body}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {template.variables.map(v => (
                                                <Badge key={v} variant="outline" className="text-[9px] h-5 bg-white border-primary/20 text-primary font-bold">
                                                    &#123;&#123;{v}&#125;&#125;
                                                </Badge>
                                            ))}
                                            {template.variables.length === 0 && <span className="text-[10px] text-muted-foreground/50">No variables defined</span>}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))}

                {!isLoading && filteredTemplates.length === 0 && (
                    <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-muted/20">
                        <FileType className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground font-medium">No templates found matching your criteria.</p>
                    </div>
                )}
            </div>

            {/* Template Preview Dialog */}
            <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
                <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b bg-card shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-xl font-black">
                            {previewTemplate?.channel === 'email' ? <Mail className="h-5 w-5 text-primary" /> : <Smartphone className="h-5 w-5 text-primary" />}
                            Preview: {previewTemplate?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Viewing raw template structure. Actual dispatch will resolve placeholders.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden relative bg-slate-100 p-4 sm:p-8">
                        <ScrollArea className="h-full bg-white rounded-2xl shadow-2xl border overflow-hidden">
                            <div className="min-h-full">
                                {previewTemplate?.channel === 'email' ? (
                                    <div className="flex flex-col h-full">
                                        <div className="p-4 bg-muted/30 border-b space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subject</p>
                                            <p className="font-bold text-sm">{previewTemplate.subject || '(No Subject)'}</p>
                                        </div>
                                        <div className="flex-1">
                                            {previewTemplate.styleId ? (
                                                <iframe 
                                                    srcDoc={(styles?.find(s => s.id === previewTemplate.styleId)?.htmlWrapper || '{{content}}').replace('{{content}}', `<div style="font-family: sans-serif;">${previewTemplate.body}</div>`)}
                                                    className="w-full min-h-[500px] border-none"
                                                    title="Email Preview"
                                                />
                                            ) : (
                                                <div className="p-8 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewTemplate.body }} />
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 flex flex-col items-center justify-center min-h-full bg-slate-900">
                                        <div className="w-full max-w-xs space-y-4">
                                            <div className="flex items-center justify-between px-2">
                                                <SmartSappIcon className="h-6 w-6 text-white opacity-20" />
                                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">SMS Preview</p>
                                            </div>
                                            <div className="bg-slate-800 rounded-3xl p-5 relative shadow-xl border border-white/5">
                                                <div className="absolute -left-2 top-6 w-4 h-4 bg-slate-800 border-l border-b border-white/5 rotate-45 rounded-sm" />
                                                <p className="text-sm text-white/90 leading-relaxed font-medium whitespace-pre-wrap">{previewTemplate?.body}</p>
                                            </div>
                                            <div className="pt-2 text-center">
                                                <p className="text-[9px] font-bold uppercase tracking-tighter text-white/30 italic">
                                                    ~ {Math.ceil((previewTemplate?.body.length || 0) / 160)} SMS Message(s)
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    <div className="p-4 border-t bg-card flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest bg-muted/50 h-7">
                                {previewTemplate?.category}
                            </Badge>
                            <Badge className="bg-primary/10 text-primary border-none text-[10px] uppercase font-black tracking-widest h-7 px-3">
                                {previewTemplate?.channel}
                            </Badge>
                        </div>
                        <Button onClick={() => setPreviewTemplate(null)} className="font-bold rounded-xl px-8 shadow-lg">
                            Close Preview
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
