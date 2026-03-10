'use client';

import * as React from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Send, 
    Mail, 
    Smartphone, 
    Loader2, 
    CheckCircle2, 
    AlertCircle,
    FlaskConical,
    Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendMessage, sendRawMessage } from '@/lib/messaging-engine';
import { cn } from '@/lib/utils';

interface TestDispatchDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Context data for the test
    channel: 'email' | 'sms';
    templateId?: string; // If provided, uses the saved template
    // Raw data for testing unsaved drafts
    rawBody?: string;
    rawSubject?: string;
    senderProfileId?: string;
    variables?: Record<string, any>;
    schoolId?: string;
}

/**
 * @fileOverview Reusable Test Dispatch Dialog.
 * Allows administrators to send a real sample of their current design to verify delivery.
 */
export default function TestDispatchDialog({ 
    open, 
    onOpenChange, 
    channel, 
    templateId, 
    rawBody, 
    rawSubject, 
    senderProfileId, 
    variables = {},
    schoolId
}: TestDispatchDialogProps) {
    const { toast } = useToast();
    const [recipient, setRecipient] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);

    const handleSend = async () => {
        if (!recipient.trim()) {
            toast({ variant: 'destructive', title: 'Recipient Required', description: 'Please enter a test target.' });
            return;
        }

        setIsSending(true);
        try {
            if (templateId) {
                // Testing a saved template with context
                const result = await sendMessage({
                    templateId,
                    senderProfileId: senderProfileId || 'default',
                    recipient: recipient.trim(),
                    variables,
                    schoolId
                });
                if (!result.success) throw new Error(result.error);
            } else if (rawBody) {
                // Testing an unsaved draft (Workshop mode)
                const result = await sendRawMessage({
                    channel,
                    recipient: recipient.trim(),
                    body: rawBody,
                    subject: rawSubject,
                    senderProfileId
                });
                if (!result.success) throw new Error(result.error);
            } else {
                throw new Error("Missing content for test dispatch.");
            }

            toast({ 
                title: 'Test Dispatch Successful', 
                description: `A sample ${channel} has been sent to ${recipient}.` 
            });
            onOpenChange(false);
            setRecipient('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Test Failed', description: e.message });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-[2rem] overflow-hidden p-0 border-none shadow-2xl">
                <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "p-3 rounded-2xl shadow-xl",
                            channel === 'email' ? "bg-blue-500 text-white shadow-blue-200" : "bg-orange-500 text-white shadow-orange-200"
                        )}>
                            <FlaskConical className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight">Test Delivery</DialogTitle>
                            <DialogDescription className="text-xs font-bold uppercase tracking-widest">Verify ${channel} fidelity before launch.</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 space-y-6">
                    <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-4">
                        <div className="p-2 bg-white rounded-xl text-primary shadow-sm border border-primary/10"><Info className="h-4 w-4" /></div>
                        <p className="text-[10px] font-bold text-primary leading-relaxed uppercase tracking-tighter">
                            This is a real dispatch using our production gateway. All variable tags in your current view will be resolved using the active simulation context.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                            {channel === 'email' ? 'Test Inbox Address' : 'Test Handset Number'}
                        </Label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors">
                                {channel === 'email' ? <Mail className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                            </div>
                            <Input 
                                value={recipient} 
                                onChange={e => setRecipient(e.target.value)}
                                placeholder={channel === 'email' ? 'you@example.com' : 'e.g. 024XXXXXXX'}
                                className="h-14 pl-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold text-lg"
                                autoFocus
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="bg-muted/30 p-6 border-t flex flex-col sm:flex-row gap-3">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSending} className="font-bold rounded-xl h-12 flex-1">Discard</Button>
                    <Button 
                        onClick={handleSend} 
                        disabled={isSending || !recipient.trim()}
                        className="rounded-xl font-black h-12 px-10 shadow-xl bg-primary text-white flex-[2] uppercase tracking-widest text-xs gap-2"
                    >
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {isSending ? 'Launching...' : 'Execute Test'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
