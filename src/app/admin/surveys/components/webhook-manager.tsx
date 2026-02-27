'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { collection, query, orderBy, addDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Webhook } from '@/lib/types';
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { 
    Plus, Loader2, Zap, ZapOff, Save 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function WebhookManager() {
    const { control, setValue, watch } = useFormContext();
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [newWebhookName, setNewWebhookName] = React.useState('');
    const [newWebhookUrl, setNewWebhookUrl] = React.useState('');

    const webhooksQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'webhooks'), orderBy('name', 'asc'));
    }, [firestore]);

    const { data: webhooks, isLoading } = useCollection<Webhook>(webhooksQuery);

    const webhookId = watch('webhookId');
    const webhookEnabled = watch('webhookEnabled');

    const handleCreateWebhook = async () => {
        if (!firestore || !user || !newWebhookName || !newWebhookUrl) return;
        setIsSaving(true);
        try {
            const data = {
                name: newWebhookName.trim(),
                url: newWebhookUrl.trim(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: user.uid
            };
            const docRef = await addDoc(collection(firestore, 'webhooks'), data);
            setValue('webhookId', docRef.id, { shouldDirty: true });
            setValue('webhookEnabled', true, { shouldDirty: true });
            setIsCreateModalOpen(false);
            setNewWebhookName('');
            setNewWebhookUrl('');
            toast({ title: 'Webhook Saved', description: 'The new endpoint is now available in your library.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error Saving Webhook' });
        } finally {
            setIsSaving(false);
        }
    };

    const selectedWebhook = React.useMemo(() => 
        webhooks?.find(w => w.id === webhookId), 
    [webhooks, webhookId]);

    return (
        <div className="space-y-4">
            <div className={cn(
                "rounded-2xl border-2 transition-all duration-300",
                webhookEnabled ? "border-primary/20 bg-primary/5" : "border-border/50 bg-background"
            )}>
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg transition-colors", webhookEnabled ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground")}>
                            {webhookEnabled ? <Zap className="h-4 w-4 fill-white" /> : <ZapOff className="h-4 w-4" />}
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-sm font-black uppercase tracking-tight">External Webhook Integration</Label>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Push data to an external automation endpoint</p>
                        </div>
                    </div>
                    <Controller
                        name="webhookEnabled"
                        control={control}
                        render={({ field }) => (
                            <Switch 
                                checked={!!field.value} 
                                onCheckedChange={field.onChange} 
                            />
                        )}
                    />
                </div>

                <AnimatePresence>
                    {webhookEnabled && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="px-4 pb-4 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end pt-2 border-t border-primary/10">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60 ml-1">Select from Library</Label>
                                        <Controller
                                            name="webhookId"
                                            control={control}
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                    <SelectTrigger className="h-10 bg-white rounded-xl shadow-sm border-primary/10 font-bold transition-all">
                                                        <SelectValue placeholder="Choose a webhook..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="none">No Webhook Selected</SelectItem>
                                                        {isLoading ? (
                                                            <div className="p-4 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                                                        ) : webhooks?.map(w => (
                                                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        onClick={() => setIsCreateModalOpen(true)}
                                        className="h-10 rounded-xl font-bold border-dashed border-2 gap-2 text-[10px] uppercase tracking-widest"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Create New
                                    </Button>
                                </div>

                                {selectedWebhook && (
                                    <div className="p-3 rounded-xl bg-white/50 border border-primary/10 space-y-1 shadow-inner">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">Active Endpoint URL</p>
                                        <p className="text-[10px] font-mono break-all text-foreground/80 leading-relaxed">{selectedWebhook.url}</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black tracking-tight">Create Webhook</DialogTitle>
                        <DialogDescription className="text-xs font-medium">Save this endpoint to your library for reuse.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Endpoint Name</Label>
                            <Input 
                                placeholder="e.g., Pabbly Onboarding Workflow" 
                                value={newWebhookName} 
                                onChange={(e) => setNewWebhookName(e.target.value)}
                                className="h-11 rounded-xl bg-muted/20 border-none shadow-none font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target URL</Label>
                            <Input 
                                type="url" 
                                placeholder="https://connect.pabbly.com/..." 
                                value={newWebhookUrl} 
                                onChange={(e) => setNewWebhookUrl(e.target.value)}
                                className="h-11 rounded-xl font-mono text-xs bg-muted/20 border-none shadow-none"
                            />
                        </div>
                    </div>
                    <DialogFooter className="bg-muted/30 p-4 -mx-6 -mb-6 mt-4">
                        <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)} className="font-bold">Cancel</Button>
                        <Button 
                            onClick={handleCreateWebhook} 
                            disabled={isSaving || !newWebhookName || !newWebhookUrl}
                            className="font-black rounded-xl px-8 shadow-lg"
                        >
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save to Library
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
