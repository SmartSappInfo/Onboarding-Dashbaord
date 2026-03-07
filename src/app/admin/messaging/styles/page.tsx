'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MessageStyle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
    Palette, 
    Plus, 
    Trash2, 
    Code,
    Eye,
    X,
    Loader2,
    ArrowLeft,
    AlertCircle,
    Sparkles,
    Check,
    Pencil,
    MoreVertical,
    Star,
    Save,
    Send,
    Info,
    Layout
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateVisualStyle } from '@/ai/flows/generate-visual-style-flow';
import { MediaSelect } from '../../schools/components/media-select';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { 
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { writeBatch } from 'firebase/firestore';

export default function MessageStylesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAdding, setIsAdding] = React.useState(false);
    const [isAiGenerating, setIsAiGenerating] = React.useState(false);
    const [previewStyle, setPreviewStyle] = React.useState<MessageStyle | null>(null);
    
    // Edit State
    const [editingStyle, setEditingStyle] = React.useState<MessageStyle | null>(null);
    const [editName, setEditName] = React.useState('');
    const [editHtml, setEditHtml] = React.useState('');
    const [isUpdating, setIsUpdating] = React.useState(false);

    // Manual Add Form State
    const [name, setName] = React.useState('');
    const [htmlWrapper, setHtmlWrapper] = React.useState('<html>\n  <body style="font-family: sans-serif; padding: 20px;">\n    <div style="border: 1px solid #ddd; padding: 20px; border-radius: 8px;">\n      {{content}}\n    </div>\n  </body>\n</html>');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // AI Form State
    const [aiName, setAiName] = React.useState('');
    const [aiPrompt, setAiPrompt] = React.useState('');
    const [aiInspirationUrl, setAiInspirationUrl] = React.useState('');
    const [isAiProcessing, setIsAiProcessing] = React.useState(false);
    const [generatedHtml, setGeneratedHtml] = React.useState<string | null>(null);

    const stylesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_styles'), orderBy('createdAt', 'desc'));
    }, [firestore]);

    const { data: styles, isLoading } = useCollection<MessageStyle>(stylesQuery);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !name || !htmlWrapper) return;
        
        if (!htmlWrapper.includes('{{content}}')) {
            toast({ variant: 'destructive', title: 'Invalid Wrapper', description: 'HTML must include the {{content}} placeholder.' });
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'message_styles'), {
                name: name.trim(),
                htmlWrapper: htmlWrapper.trim(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            setName('');
            setHtmlWrapper('');
            setIsAdding(false);
            toast({ title: 'Style Added', description: 'Email wrapper has been saved.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to create style.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (style: MessageStyle) => {
        setEditingStyle(style);
        setEditName(style.name);
        setEditHtml(style.htmlWrapper);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !editingStyle || !editName || !editHtml) return;

        if (!editHtml.includes('{{content}}')) {
            toast({ variant: 'destructive', title: 'Invalid Wrapper', description: 'HTML must include the {{content}} placeholder.' });
            return;
        }

        setIsUpdating(true);
        try {
            await updateDoc(doc(firestore, 'message_styles', editingStyle.id), {
                name: editName.trim(),
                htmlWrapper: editHtml.trim(),
                updatedAt: new Date().toISOString(),
            });
            setEditingStyle(null);
            toast({ title: 'Style Updated', description: 'Changes saved successfully.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Update Failed' });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAiGenerate = async () => {
        if (!aiName || !aiPrompt) {
            toast({ variant: 'destructive', title: 'Missing Info', description: 'Please provide a name and instructions for the AI.' });
            return;
        }

        setIsAiProcessing(true);
        try {
            let photoDataUri = undefined;
            if (aiInspirationUrl) {
                const response = await fetch(aiInspirationUrl);
                const blob = await response.blob();
                photoDataUri = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            }

            const result = await generateVisualStyle({
                name: aiName,
                prompt: aiPrompt,
                photoDataUri
            });

            setGeneratedHtml(result.htmlWrapper);
            toast({ title: 'Style Generated', description: 'Preview the design below.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'AI Generation Failed', description: e.message });
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleSaveGenerated = async () => {
        if (!firestore || !aiName || !generatedHtml) return;
        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'message_styles'), {
                name: aiName.trim(),
                htmlWrapper: generatedHtml.trim(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            setAiName('');
            setAiPrompt('');
            setAiInspirationUrl('');
            setGeneratedHtml(null);
            setIsAiGenerating(false);
            toast({ title: 'AI Style Saved' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error Saving Style' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore || !confirm('Are you sure?')) return;
        await deleteDoc(doc(firestore, 'message_styles', id));
        toast({ title: 'Style Deleted' });
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
            <div className="mb-8 flex items-center justify-end flex-wrap gap-4">
                <div className="flex items-center gap-2">
                    <RainbowButton onClick={() => setIsAiGenerating(true)} className="h-10 px-4 gap-2 font-bold shadow-lg">
                        <Sparkles className="h-4 w-4" /> Create with AI
                    </RainbowButton>
                    <Button onClick={() => { setIsAdding(!isAdding); if(!isAdding) { setName(''); setHtmlWrapper('<html>\n  <body style="font-family: sans-serif; padding: 20px;">\n    <div style="border: 1px solid #ddd; padding: 20px; border-radius: 8px;">\n      {{content}}\n    </div>\n  </body>\n</html>'); } }} variant="outline" className="font-bold">
                        {isAdding ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                        {isAdding ? 'Cancel' : 'New Style'}
                    </Button>
                </div>
            </div>

            {isAdding && (
                <Card className="mb-8 border-primary/20 bg-primary/5 animate-in slide-in-from-top-4 duration-300">
                    <CardHeader>
                        <CardTitle>Create Email Wrapper</CardTitle>
                        <CardDescription>Styles provide the layout, header, and footer for multiple templates.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Style Name</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard School Branded" required />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label className="flex items-center gap-2">
                                    <Code className="h-3 w-3" /> HTML Wrapper
                                </Label>
                                <span className="text-[10px] font-black uppercase text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                                    Must include &#123;&#123;content&#125;&#125;
                                </span>
                            </div>
                            <Textarea 
                                value={htmlWrapper} 
                                onChange={e => setHtmlWrapper(e.target.value)} 
                                className="min-h-[250px] font-mono text-xs bg-white" 
                                placeholder="<html>...{{content}}...</html>"
                                required 
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={handleAdd} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Visual Style
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-64 animate-pulse bg-muted rounded-2xl" />)
                ) : styles?.length ? (
                    styles.map((style) => (
                        <Card key={style.id} className="group relative overflow-hidden border-border/50 hover:shadow-xl transition-all rounded-2xl bg-card">
                            <div className="aspect-[4/3] w-full bg-slate-100 relative overflow-hidden border-b">
                                <iframe 
                                    srcDoc={style.htmlWrapper.replace('{{content}}', '<div style="height: 100px; background: #eee; border: 2px dashed #ccc; display: flex; align-items: center; justify-center; font-family: sans-serif; font-size: 12px; color: #999;">Body</div>')}
                                    className="w-[800px] h-[600px] origin-top-left scale-[0.35] sm:scale-[0.4] pointer-events-none border-none"
                                    title={`Preview of ${style.name}`}
                                />
                                <div className="absolute inset-0 bg-transparent" /> {/* Click interceptor */}
                            </div>
                            
                            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                <div className="min-w-0">
                                    <CardTitle className="text-sm font-bold truncate pr-2">{style.name}</CardTitle>
                                    <CardDescription className="text-[10px] uppercase font-black tracking-tighter">Email Wrapper</CardDescription>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setPreviewStyle(style)}>
                                        <Eye className="h-4 w-4 text-primary" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEditClick(style)}>
                                        <Pencil className="h-4 w-4 text-primary" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => handleDelete(style.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center border-2 border-dashed rounded-2xl bg-muted/20">
                        <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground font-medium">No Visual Styles created yet.</p>
                    </div>
                )}
            </div>

            {/* Manual Edit Dialog */}
            <Dialog open={!!editingStyle} onOpenChange={(o) => !o && setEditingStyle(null)}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
                    <DialogHeader className="p-6 border-b bg-card shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <Pencil className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Visual Style</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Modify your institutional email wrapper</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="flex-1 flex flex-col overflow-hidden bg-muted/5">
                        <div className="p-6 border-b bg-background/50">
                            <div className="space-y-2 max-w-md">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Style Label</Label>
                                <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-11 rounded-xl bg-white border-primary/10 shadow-sm font-bold" placeholder="e.g. Primary Branded Layout" />
                            </div>
                        </div>

                        <Tabs defaultValue="code" className="flex-1 flex flex-col min-h-0">
                            <div className="px-6 py-2 border-b bg-muted/10 flex items-center justify-between shrink-0">
                                <TabsList className="bg-background border shadow-sm h-9 p-1 rounded-xl">
                                    <TabsTrigger value="code" className="rounded-lg font-black uppercase text-[9px] tracking-widest px-4 gap-2">
                                        <Code className="h-3.5 w-3.5" /> Code
                                    </TabsTrigger>
                                    <TabsTrigger value="preview" className="rounded-lg font-black uppercase text-[9px] tracking-widest px-4 gap-2">
                                        <Eye className="h-3.5 w-3.5" /> Preview
                                    </TabsTrigger>
                                </TabsList>
                                <Badge className="bg-orange-500/10 text-orange-600 border-none text-[8px] uppercase tracking-widest h-5 px-2">Must contain &#123;&#123;content&#125;&#125;</Badge>
                            </div>
                            
                            <TabsContent value="code" className="flex-1 m-0 bg-background relative border-t">
                                <Textarea 
                                    value={editHtml} 
                                    onChange={e => setEditHtml(e.target.value)} 
                                    className="absolute inset-0 w-full h-full font-mono text-xs p-8 resize-none border-none shadow-none focus-visible:ring-0 leading-relaxed bg-slate-900 text-blue-400" 
                                />
                            </TabsContent>
                            
                            <TabsContent value="preview" className="flex-1 m-0 bg-slate-100 overflow-hidden relative border-t">
                                <ScrollArea className="h-full w-full">
                                    <div className="p-8 flex justify-center min-h-full">
                                        <div className="w-full max-w-[600px] bg-white shadow-2xl rounded-2xl overflow-hidden border">
                                            <iframe 
                                                srcDoc={editHtml.replace('{{content}}', '<div style="background: #f8fafc; border: 2px dashed #cbd5e1; padding: 60px 20px; text-align: center; color: #64748b; font-family: sans-serif; border-radius: 12px; margin: 20px 0;"><p style="margin: 0; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Dynamic Template Content</p><p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.6;">(Questionnaire results or notifications will render here)</p></div>')} 
                                                className="w-full h-[800px] border-none"
                                                title="Visual Style Live Preview"
                                            />
                                        </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </div>

                    <DialogFooter className="p-4 border-t bg-card shrink-0 flex justify-between gap-3 sm:justify-between">
                        <Button variant="ghost" onClick={() => setEditingStyle(null)} className="font-bold rounded-xl px-8 h-12">Discard Changes</Button>
                        <Button onClick={handleUpdate} disabled={isUpdating} className="rounded-xl font-black px-12 shadow-2xl bg-primary text-white h-12 uppercase tracking-widest text-sm transition-all active:scale-95">
                            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Commit Updates
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* AI Generator Dialog */}
            <Dialog open={isAiGenerating} onOpenChange={setIsAiGenerating}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
                    <DialogHeader className="p-6 border-b bg-card shrink-0">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <Sparkles className="h-5 w-5 text-primary" />
                            </div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight">AI Style Architect</DialogTitle>
                        </div>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Generate a responsive wrapper from brand instructions.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                        {/* Input Side */}
                        <div className="w-full lg:w-1/2 p-6 border-r flex flex-col gap-6 overflow-y-auto bg-muted/5">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Style Label</Label>
                                <Input value={aiName} onChange={e => setAiName(e.target.value)} placeholder="e.g. Modern School Dark Theme" className="h-11 rounded-xl bg-white border-primary/10" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Design Directives</Label>
                                <Textarea 
                                    value={aiPrompt} 
                                    onChange={e => setAiPrompt(e.target.value)} 
                                    placeholder="e.g. Create a clean design with a blue header, centered logo, and a simple footer. Make sure it's mobile-first." 
                                    className="min-h-[150px] rounded-xl text-sm leading-relaxed bg-white border-primary/10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Visual Inspiration (Optional)</Label>
                                <MediaSelect value={aiInspirationUrl} onValueChange={setAiInspirationUrl} filterType="image" className="rounded-xl overflow-hidden" />
                            </div>
                            <RainbowButton onClick={handleAiGenerate} disabled={isAiProcessing} className="h-12 w-full font-black text-lg gap-2 uppercase tracking-widest shadow-xl">
                                {isAiProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                                {isAiProcessing ? 'Architecting...' : 'Generate Design'}
                            </RainbowButton>
                        </div>

                        {/* Preview Side */}
                        <div className="w-full lg:w-1/2 p-6 flex flex-col bg-slate-100">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                                <Eye className="h-3 w-3" /> Live Simulation
                            </Label>
                            <div className="flex-1 rounded-[2rem] bg-white border-2 border-dashed flex items-center justify-center relative overflow-hidden shadow-inner">
                                {generatedHtml ? (
                                    <ScrollArea className="h-full w-full">
                                        <div 
                                            className="p-4 origin-top transition-all"
                                            dangerouslySetInnerHTML={{ 
                                                __html: generatedHtml.replace('{{content}}', '<div style="background: #f8fafc; border: 2px dashed #cbd5e1; padding: 40px; text-align: center; color: #64748b; font-weight: bold; border-radius: 12px;">[ Dynamic Template Content ]</div>') 
                                            }} 
                                        />
                                    </ScrollArea>
                                ) : (
                                    <div className="text-center p-8 space-y-3">
                                        <div className="mx-auto w-12 h-12 bg-white rounded-2xl shadow-sm border flex items-center justify-center mb-4">
                                            <Palette className="h-6 w-6 text-muted-foreground/30" />
                                        </div>
                                        <p className="text-sm font-black uppercase tracking-tight text-muted-foreground opacity-40">Awaiting AI Input</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-4 border-t bg-card shrink-0 flex justify-between items-center sm:justify-between">
                        <Button variant="ghost" onClick={() => setIsAiGenerating(false)} className="font-bold">Discard</Button>
                        <Button onClick={handleSaveGenerated} disabled={!generatedHtml || isSubmitting} className="font-bold rounded-xl px-10 shadow-lg h-11 uppercase text-xs tracking-widest">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Save AI Style
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Standard Preview Dialog */}
            <Dialog open={!!previewStyle} onOpenChange={() => setPreviewStyle(null)}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
                    <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <Eye className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-tight">Full Preview</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest">{previewStyle?.name}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden relative bg-slate-100 p-8 flex justify-center">
                        <div className="w-full max-w-[600px] bg-white rounded-2xl shadow-2xl overflow-hidden border">
                            <ScrollArea className="h-full">
                                <div className="p-4">
                                    {previewStyle && (
                                        <div 
                                            dangerouslySetInnerHTML={{ 
                                                __html: previewStyle.htmlWrapper.replace('{{content}}', '<div style="background: #f8fafc; border: 2px dashed #cbd5e1; padding: 60px 20px; text-align: center; color: #64748b; font-family: sans-serif; border-radius: 12px; margin: 20px 0;"><p style="margin: 0; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Resolved Template Content</p></div>') 
                                            }} 
                                        />
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                    <DialogFooter className="p-4 border-t bg-card shrink-0">
                        <Button onClick={() => setPreviewStyle(null)} className="w-full h-12 rounded-xl font-bold uppercase tracking-widest text-xs">Close Preview</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
