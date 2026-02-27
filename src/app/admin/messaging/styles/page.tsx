'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MessageStyle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
    Palette, 
    Plus, 
    Trash2, 
    Code,
    Eye,
    X,
    Loader2,
    ArrowLeft,
    AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function MessageStylesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAdding, setIsAdding] = React.useState(false);
    const [previewStyle, setPreviewStyle] = React.useState<MessageStyle | null>(null);
    
    // Form State
    const [name, setName] = React.useState('');
    const [htmlWrapper, setHtmlWrapper] = React.useState('<html>\n  <body style="font-family: sans-serif; padding: 20px;">\n    <div style="border: 1px solid #ddd; padding: 20px; border-radius: 8px;">\n      {{content}}\n    </div>\n  </body>\n</html>');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

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

    const handleDelete = async (id: string) => {
        if (!firestore || !confirm('Are you sure?')) return;
        await deleteDoc(doc(firestore, 'message_styles', id));
        toast({ title: 'Style Deleted' });
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <Button asChild variant="ghost" className="-ml-2 mb-2">
                        <Link href="/admin/messaging">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Engine
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <Palette className="h-8 w-8 text-primary" />
                        Visual Styles
                    </h1>
                    <p className="text-muted-foreground">Manage HTML wrappers for branded email communications.</p>
                </div>
                <Button onClick={() => setIsAdding(!isAdding)}>
                    {isAdding ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                    {isAdding ? 'Cancel' : 'New Style'}
                </Button>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-48 animate-pulse bg-muted" />)
                ) : styles?.length ? (
                    styles.map((style) => (
                        <Card key={style.id} className="group relative overflow-hidden border-border/50 hover:shadow-lg transition-all">
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => setPreviewStyle(style)}>
                                    <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDelete(style.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <CardHeader className="bg-muted/20 pb-4">
                                <CardTitle className="text-lg">{style.name}</CardTitle>
                                <CardDescription className="text-xs">HTML Email Wrapper</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="text-[10px] font-mono text-muted-foreground line-clamp-3 bg-muted/30 p-2 rounded border border-dashed">
                                    {style.htmlWrapper}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center border-2 border-dashed rounded-2xl bg-muted/20">
                        <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground font-medium">No Visual Styles created yet.</p>
                    </div>
                )}
            </div>

            <Dialog open={!!previewStyle} onOpenChange={() => setPreviewStyle(null)}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
                    <DialogHeader className="p-6 border-b bg-white">
                        <DialogTitle>Preview: {previewStyle?.name}</DialogTitle>
                        <DialogDescription>This shows the layout wrapper with sample content.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden relative bg-slate-100 p-8">
                        <ScrollArea className="h-full bg-white rounded-lg shadow-inner">
                            <div className="p-4">
                                {previewStyle && (
                                    <div 
                                        dangerouslySetInnerHTML={{ 
                                            __html: previewStyle.htmlWrapper.replace('{{content}}', '<div style="background: #f0f0f0; border: 2px dashed #ccc; padding: 40px; text-align: center; color: #666; font-weight: bold;">[ Dynamic Template Content Will Appear Here ]</div>') 
                                        }} 
                                    />
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
