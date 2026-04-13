'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
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
    Sparkles,
    Check,
    Pencil,
    Save,
    Share2,
    Layout,
    AlertCircle,
    ShieldCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateVisualStyle } from '@/ai/flows/generate-visual-style-flow';
import { MediaSelect } from '../../entities/components/media-select';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import { MultiSelect } from '@/components/ui/multi-select';
import { Skeleton } from '@/components/ui/skeleton';

export default function MessageStylesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();
    
    const [isAdding, setIsAdding] = React.useState(false);
    const [isAiGenerating, setIsAiGenerating] = React.useState(false);
    const [previewStyle, setPreviewStyle] = React.useState<MessageStyle | null>(null);
    
    const [editingStyle, setEditingStyle] = React.useState<MessageStyle | null>(null);
    const [editName, setEditName] = React.useState('');
    const [editHtml, setEditHtml] = React.useState('');
    const [editWorkspaceIds, setEditWorkspaceIds] = React.useState<string[]>([]);
    const [isUpdating, setIsUpdating] = React.useState(false);

    const [name, setName] = React.useState('');
    const [workspaceIds, setWorkspaceIds] = React.useState<string[]>([activeWorkspaceId]);
    const [htmlWrapper, setHtmlWrapper] = React.useState('<html>\n  <body style="font-family: sans-serif; padding: 20px;">\n    <div style="border: 1px solid #ddd; padding: 20px; border-radius: 8px;">\n      {{content}}\n    </div>\n  </body>\n</html>');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const [aiName, setAiName] = React.useState('');
    const [aiPrompt, setAiPrompt] = React.useState('');
    const [aiInspirationUrl, setAiInspirationUrl] = React.useState('');
    const [isAiProcessing, setIsAiProcessing] = React.useState(false);
    const [generatedHtml, setGeneratedHtml] = React.useState<string | null>(null);

    const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

    const stylesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'message_styles'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, activeWorkspaceId]);

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
                workspaceIds: workspaceIds.length > 0 ? workspaceIds : [activeWorkspaceId],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            setName('');
            setWorkspaceIds([activeWorkspaceId]);
            setIsAdding(false);
            toast({ title: 'Style Protocol Initialized' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (style: MessageStyle) => {
        setEditingStyle(style);
        setEditName(style.name);
        setEditHtml(style.htmlWrapper);
        setEditWorkspaceIds(style.workspaceIds || [activeWorkspaceId]);
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
                workspaceIds: editWorkspaceIds,
                updatedAt: new Date().toISOString(),
            });
            setEditingStyle(null);
            toast({ title: 'Style Synchronized' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAiGenerate = async () => {
        if (!aiName || !aiPrompt) return;
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
            toast({ title: 'AI Architect Complete', description: result.explanation });
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
                workspaceIds: [activeWorkspaceId],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            setGeneratedHtml(null);
            setIsAiGenerating(false);
            toast({ title: 'AI Architecture Initialized' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore || !confirm('Permanently purge this style? Templates using it may render incorrectly.')) return;
        await deleteDoc(doc(firestore, 'message_styles', id));
        toast({ title: 'Style Purged' });
    };

    return (
 <div className="h-full overflow-y-auto  bg-background text-left">
 <div className=" space-y-8">
 <div className="flex items-center justify-end flex-wrap gap-4">
 <div className="flex items-center gap-2">
 <RainbowButton onClick={() => setIsAiGenerating(true)} className="h-11 px-6 gap-2 font-semibold text-[10px] shadow-xl">
 <Sparkles className="h-4 w-4" /> AI Style Architect
                        </RainbowButton>
 <Button onClick={() => setIsAdding(!isAdding)} variant="outline" className="h-11 rounded-xl font-bold border-primary/20 text-primary">
 {isAdding ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                            {isAdding ? 'Discard' : 'Manual Blueprint'}
                        </Button>
                    </div>
                </div>

                {isAdding && (
 <Card className="mb-8 border-primary/20 bg-primary/5 animate-in slide-in-from-top-4 duration-300 rounded-[2.5rem] overflow-hidden shadow-xl">
 <CardHeader className="bg-primary/5 border-b p-8">
 <CardTitle className="text-xl font-semibold tracking-tight">Manual Style Studio</CardTitle>
 <CardDescription className="text-[10px] font-bold text-primary/60">Configure high-compatibility email wrappers.</CardDescription>
                        </CardHeader>
 <CardContent className="p-8 space-y-8">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Style Label</Label>
 <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Branded Hub" className="h-12 rounded-xl bg-card border-none shadow-inner font-bold" />
                                </div>
 <div className="space-y-4">
 <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2"><Share2 className="h-3 w-3" /> Shared Context</Label>
                                    <MultiSelect options={workspaceOptions} value={workspaceIds} onChange={setWorkspaceIds} />
                                </div>
                            </div>
 <div className="space-y-2">
 <div className="flex justify-between items-center px-1">
 <Label className="text-[10px] font-semibold text-muted-foreground">HTML Gateway Blueprint</Label>
                                    <Badge className="bg-orange-500/10 text-orange-600 border-none text-[8px] font-semibold uppercase h-5 px-2">Must include &#123;&#123;content&#125;&#125;</Badge>
                                </div>
                                <Textarea 
                                    value={htmlWrapper} 
                                    onChange={e => setHtmlWrapper(e.target.value)} 
 className="min-h-[300px] font-mono text-xs bg-slate-900 text-blue-400 p-8 rounded-[2rem] border-none shadow-2xl" 
                                />
                            </div>
 <div className="flex justify-end">
 <Button onClick={handleAdd} disabled={isSubmitting || !name || !htmlWrapper.includes('{{content}}')} className="rounded-xl h-12 px-12 font-semibold text-[10px] shadow-xl">
 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                    Initialize Style
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-32">
                    {isLoading ? (
 Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-[2.5rem]" />)
                    ) : styles?.length ? (
                        styles.map((style) => (
 <Card key={style.id} className="group relative overflow-hidden border-none ring-1 ring-border hover:ring-primary/20 hover:shadow-2xl transition-all duration-500 rounded-[2rem] bg-card flex flex-col h-[320px]">
 <div className="aspect-video w-full bg-slate-100 relative overflow-hidden border-b">
                                    <iframe 
                                        srcDoc={style.htmlWrapper.replace('{{content}}', '<div style="height: 100px; background: #f1f5f9; border: 2px dashed #cbd5e1; padding: 40px; text-align: center; color: #64748b; font-family: sans-serif; font-size: 12px; color: #94a3b8; border-radius: 12px; margin: 20px;">[ Content Gateway ]</div>')}
 className="w-[800px] h-[600px] origin-top-left scale-[0.45] pointer-events-none border-none"
                                        title={`Preview of ${style.name}`}
                                    />
 <div className="absolute inset-0 bg-transparent" />
                                    {style.workspaceIds?.length > 1 && (
 <div className="absolute top-3 left-3">
                                            <Badge className="bg-primary/80 backdrop-blur-md border-none text-[8px] font-semibold uppercase h-5"><Share2 className="h-2.5 w-2.5 mr-1" /> Shared</Badge>
                                        </div>
                                    )}
                                </div>
                                
 <CardHeader className="p-5 flex flex-row items-center justify-between space-y-0 bg-card grow">
 <div className="min-w-0">
 <CardTitle className="text-sm font-semibold truncate pr-2 text-foreground group-hover:text-primary transition-colors">{style.name}</CardTitle>
 <CardDescription className="text-[8px] font-bold mt-1">{style.workspaceIds?.length || 1} Workspace(s)</CardDescription>
                                    </div>
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setPreviewStyle(style)}><Eye className="h-4 w-4" /></Button>
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEditClick(style)}><Pencil className="h-4 w-4" /></Button>
 <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => handleDelete(style.id)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))
                    ) : (
 <div className="col-span-full py-32 text-center border-4 border-dashed rounded-[4rem] bg-background flex flex-col items-center justify-center gap-4 opacity-30">
 <Palette className="h-16 w-16" />
 <p className="font-semibold text-xs">No styles in this workspace hub</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingStyle} onOpenChange={(o) => !o && setEditingStyle(null)}>
 <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
 <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-primary text-white rounded-2xl shadow-xl"><Pencil size={24} /></div>
 <div className="text-left">
 <DialogTitle className="text-xl font-semibold tracking-tight">Modify Style Architecture</DialogTitle>
 <DialogDescription className="text-xs font-bold opacity-60">Updating shared layout protocol</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
 <div className="flex-1 flex flex-col overflow-hidden bg-background">
 <div className="p-8 border-b grid grid-cols-1 md:grid-cols-2 gap-8 shrink-0">
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Internal Reference</Label>
 <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-11 rounded-xl bg-muted/20 border-none font-bold" />
                            </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2"><Share2 className="h-3 w-3" /> Target Workspaces</Label>
                                <MultiSelect options={workspaceOptions} value={editWorkspaceIds} onChange={setEditWorkspaceIds} />
                            </div>
                        </div>

 <Tabs defaultValue="code" className="flex-1 flex flex-col min-h-0">
 <div className="px-8 py-2 bg-background border-b shrink-0 flex items-center justify-between">
 <TabsList className="bg-background border p-1 h-9 rounded-xl shadow-sm">
 <TabsTrigger value="code" className="text-[9px] font-semibold px-4 gap-2"><Code size={14} /> Source</TabsTrigger>
 <TabsTrigger value="preview" className="text-[9px] font-semibold px-4 gap-2"><Eye size={14} /> Render</TabsTrigger>
                                </TabsList>
                                <Badge className="bg-orange-500/10 text-orange-600 border-none text-[8px] font-semibold uppercase h-5">Fidelity Assurance Active</Badge>
                            </div>
                            
 <TabsContent value="code" className="flex-1 m-0 bg-slate-900 relative">
 <Textarea value={editHtml} onChange={e => setEditHtml(e.target.value)} className="absolute inset-0 w-full h-full font-mono text-xs p-8 resize-none border-none shadow-none focus-visible:ring-0 leading-relaxed text-blue-400 bg-slate-900" />
                            </TabsContent>
                            
 <TabsContent value="preview" className="flex-1 m-0 bg-slate-100 overflow-hidden relative">
 <ScrollArea className="h-full w-full">
 <div className="p-12 flex justify-center min-h-full">
 <div className="w-full max-w-[600px] bg-card shadow-2xl rounded-3xl overflow-hidden border">
 <iframe srcDoc={editHtml.replace('{{content}}', '<div style="background: #f8fafc; border: 2px dashed #cbd5e1; padding: 60px; text-align: center; color: #64748b; font-family: sans-serif; border-radius: 12px; margin: 20px;"><p style="margin: 0; font-size: 14px; font-weight: 900; text-transform: ; letter-spacing: 1px;">Resolved Content Block</p></div>')} className="w-full h-[800px] border-none" title="Live Sync Preview" />
                                        </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </div>

 <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex justify-between items-center sm:justify-between">
 <Button variant="ghost" onClick={() => setEditingStyle(null)} disabled={isUpdating} className="font-bold rounded-xl h-12 px-8">Discard Changes</Button>
 <Button onClick={handleUpdate} disabled={isUpdating || !editName.trim() || editWorkspaceIds.length === 0} className="rounded-xl font-semibold px-12 shadow-2xl h-12 text-sm transition-all active:scale-95">
 {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Sync Architecture
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* AI Generator Dialog */}
            <Dialog open={isAiGenerating} onOpenChange={setIsAiGenerating}>
 <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
 <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
 <div className="flex items-center gap-3">
 <div className="p-3 bg-primary/10 rounded-xl"><Sparkles size={24} className="text-primary" /></div>
 <div className="text-left">
 <DialogTitle className="text-xl font-semibold tracking-tight">AI Style Architect</DialogTitle>
 <DialogDescription className="text-xs font-bold opacity-60">Generate responsive brand wrappers via AI</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
 <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
 <div className="w-full lg:w-1/2 p-8 border-r flex flex-col gap-8 overflow-y-auto bg-muted/10">
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Identity Label</Label>
 <Input value={aiName} onChange={e => setAiName(e.target.value)} placeholder="e.g. Modern Campus Dark Theme" className="h-12 rounded-xl bg-card border-primary/10 shadow-sm font-bold" />
                            </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Design Directives</Label>
 <Textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="e.g. Create a clean design with a deep blue header, centered white logo, and a minimal footer." className="min-h-[180px] rounded-2xl text-sm leading-relaxed bg-card border-primary/10 shadow-inner p-4" />
                            </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Visual Inspiration (Optional)</Label>
 <MediaSelect value={aiInspirationUrl} onValueChange={setAiInspirationUrl} filterType="image" className="rounded-2xl" />
                            </div>
 <RainbowButton onClick={handleAiGenerate} disabled={isAiProcessing} className="h-14 w-full font-semibold text-lg gap-2 shadow-2xl">
 {isAiProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                                {isAiProcessing ? 'Architecting...' : 'Generate Protocol'}
                            </RainbowButton>
                        </div>

 <div className="w-full lg:w-1/2 p-8 flex flex-col bg-card">
 <div className="flex items-center justify-between mb-6">
 <Label className="text-[10px] font-semibold text-primary flex items-center gap-2"><Eye className="h-3 w-3" /> Live Render</Label>
                                {generatedHtml && <Badge className="bg-emerald-50 text-emerald-600 border-none font-semibold text-[8px] uppercase ">Logic Verified</Badge>}
                            </div>
 <div className="flex-1 rounded-[2.5rem] bg-muted/10 border-2 border-dashed border-border flex items-center justify-center relative overflow-hidden shadow-inner p-4">
                                {generatedHtml ? (
 <div className="w-full h-full bg-card rounded-2xl shadow-xl overflow-hidden" dangerouslySetInnerHTML={{ __html: generatedHtml.replace('{{content}}', '<div style="background: #f1f5f9; border: 2px dashed #cbd5e1; padding: 40px; text-align: center; color: #64748b; font-weight: 900; border-radius: 12px; margin: 20px;">[ PROTOTYPE CONTENT ]</div>') }} />
                                ) : (
 <div className="text-center space-y-4 opacity-20">
 <Palette size={64} className="mx-auto" />
 <p className="text-[10px] font-semibold tracking-[0.3em]">Awaiting Simulation</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

 <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex justify-between items-center sm:justify-between">
 <Button variant="ghost" onClick={() => setIsAiGenerating(false)} className="font-bold rounded-xl h-12 px-8">Discard</Button>
 <Button onClick={handleSaveGenerated} disabled={!generatedHtml || isSubmitting} className="rounded-xl font-semibold px-12 shadow-2xl h-12 text-xs active:scale-95 transition-all">
 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Commit AI Style
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Standard Preview Dialog */}
            <Dialog open={!!previewStyle} onOpenChange={() => setPreviewStyle(null)}>
 <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
 <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl"><Eye className="h-5 w-5 text-primary" /></div>
                            <div>
 <DialogTitle className="text-xl font-semibold tracking-tight">Atmospheric Preview</DialogTitle>
 <DialogDescription className="text-xs font-bold ">{previewStyle?.name}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
 <div className="flex-1 overflow-hidden relative bg-slate-100 p-12 flex justify-center">
 <div className="w-full max-w-[600px] bg-card rounded-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] overflow-hidden border">
 <ScrollArea className="h-full">
 <div className="p-4">
                                    {previewStyle && (
                                        <div dangerouslySetInnerHTML={{ __html: previewStyle.htmlWrapper.replace('{{content}}', '<div style="background: #f8fafc; border: 2px dashed #cbd5e1; padding: 60px; text-align: center; color: #64748b; font-family: sans-serif; border-radius: 12px; margin: 20px 0;"><p style="margin: 0; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Resolved Template Payload</p></div>') }} />
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
 <DialogFooter className="p-4 bg-card border-t shrink-0">
 <Button onClick={() => setPreviewStyle(null)} className="w-full h-14 rounded-2xl font-semibold text-xs">Exit Preview</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
