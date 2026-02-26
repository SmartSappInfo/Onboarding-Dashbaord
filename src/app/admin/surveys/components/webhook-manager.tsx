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
        <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-2xl border bg-muted/30">
                <div className="space-y-0.5">
                    <Label className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        {webhookEnabled ? <Zap className="h-4 w-4 text-primary fill-primary" /> : <ZapOff className="h-4 w-4 text-muted-foreground" />}
                        External Webhook Integration
                    </Label>
                    <p className="text-xs text-muted-foreground font-medium">Push data to an external automation on every submission.</p>
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
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Select from Library</Label>
                                <Controller
                                    name="webhookId"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                            <SelectTrigger className="h-11 bg-white rounded-xl shadow-sm border-border/50">
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
                                className="h-11 rounded-xl font-bold border-dashed border-2 gap-2"
                            >
                                <Plus className="h-4 w-4" /> Create New Webhook
                            </Button>
                        </div>

                        {selectedWebhook && (
                            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Active Endpoint URL</p>
                                <p className="text-xs font-mono break-all text-foreground/80">{selectedWebhook.url}</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black tracking-tight">Create Webhook</DialogTitle>
                        <DialogDescription>Save this endpoint to your library for use in other surveys.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Endpoint Name</Label>
                            <Input 
                                placeholder="e.g., Pabbly Onboarding Workflow" 
                                value={newWebhookName} 
                                onChange={(e) => setNewWebhookName(e.target.value)}
                                className="h-11 rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">URL</Label>
                            <Input 
                                type="url" 
                                placeholder="https://connect.pabbly.com/..." 
                                value={newWebhookUrl} 
                                onChange={(e) => setNewWebhookUrl(e.target.value)}
                                className="h-11 rounded-xl font-mono text-xs"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                        <Button 
                            onClick={handleCreateWebhook} 
                            disabled={isSaving || !newWebhookName || !newWebhookUrl}
                            className="font-bold rounded-xl"
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