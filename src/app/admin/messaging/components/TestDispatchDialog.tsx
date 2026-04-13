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
    FlaskConical,
    Info,
    Database,
    ChevronDown,
    Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendMessage, sendRawMessage } from '@/lib/messaging-engine';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface TestDispatchDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    channel: 'email' | 'sms';
    templateId?: string;
    rawBody?: string;
    rawSubject?: string;
    senderProfileId?: string;
    variables?: Record<string, any>;
    entityId?: string;
}

/**
 * @fileOverview Upgraded Test Dispatch Dialog.
 * Automatically extracts variable tags from content and provides an interactive form
 * to populate them before delivery.
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
    entityId
}: TestDispatchDialogProps) {
    const { toast } = useToast();
    const [recipient, setRecipient] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);
    const [localVariables, setLocalVariables] = React.useState<Record<string, string>>({});
    const [detectedTags, setDetectedTags] = React.useState<string[]>([]);

    // 1. Tag Discovery Logic
    React.useEffect(() => {
        if (!open) return;

        const contentToScan = `${rawSubject || ''} ${rawBody || ''}`;
        const matches = contentToScan.match(/\{\{(.*?)\}\}/g);
        const tags = matches ? [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];
        
        setDetectedTags(tags);
        
        // Initialize local values from simulation context
        const initial: Record<string, string> = {};
        tags.forEach(tag => {
            initial[tag] = variables[tag] !== undefined ? String(variables[tag]) : '';
        });
        setLocalVariables(initial);
    }, [open, rawBody, rawSubject, variables]);

    const handleSend = async () => {
        if (!recipient.trim()) {
            toast({ variant: 'destructive', title: 'Recipient Required', description: 'Please enter a test target.' });
            return;
        }

        setIsSending(true);
        try {
            // Merge test-specific overrides into context
            const finalVars = { ...variables, ...localVariables };

            if (templateId) {
                const result = await sendMessage({
                    templateId,
                    senderProfileId: senderProfileId || 'default',
                    recipient: recipient.trim(),
                    variables: finalVars,
                    entityId
                });
                if (!result.success) throw new Error(result.error);
            } else if (rawBody) {
                const result = await sendRawMessage({
                    channel,
                    recipient: recipient.trim(),
                    body: rawBody,
                    subject: rawSubject,
                    senderProfileId,
                    variables: finalVars
                });
                if (!result.success) throw new Error(result.error);
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
 <DialogContent className="sm:max-w-2xl h-[85vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden rounded-[2.5rem]">
 <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
 <div className="flex items-center gap-4">
 <div className={cn(
                            "p-3 rounded-2xl shadow-xl",
                            channel === 'email' ? "bg-blue-500 text-white shadow-blue-200" : "bg-orange-500 text-white shadow-orange-200"
                        )}>
 <FlaskConical className="h-6 w-6" />
                        </div>
 <div className="text-left">
 <DialogTitle className="text-2xl font-semibold tracking-tight">Test Delivery Hub</DialogTitle>
 <DialogDescription className="text-xs font-bold text-muted-foreground">Populate context and verify resolution.</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

 <div className="flex-1 overflow-hidden relative bg-background">
 <ScrollArea className="h-full">
 <div className="p-8 space-y-10">
                            {/* RECIPIENT BLOCK */}
 <div className="space-y-4">
 <Label className="text-[10px] font-semibold text-primary ml-1">1. Target Terminal</Label>
 <div className="relative group">
 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors">
 {channel === 'email' ? <Mail className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                                    </div>
                                    <Input 
                                        value={recipient} 
                                        onChange={e => setRecipient(e.target.value)}
                                        placeholder={channel === 'email' ? 'your-email@example.com' : 'e.g. 024XXXXXXX'}
 className="h-14 pl-12 rounded-2xl bg-muted/20 border-none shadow-inner font-semibold text-xl"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* VARIABLE RESOLUTION BLOCK */}
                            {detectedTags.length > 0 && (
 <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
 <div className="flex items-center justify-between px-1">
 <Label className="text-[10px] font-semibold text-primary flex items-center gap-2">
 <Database className="h-3 w-3" /> 2. Contextual Resolution
                                        </Label>
                                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] font-semibold uppercase h-5">{detectedTags.length} Dynamic Tags</Badge>
                                    </div>
                                    
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 rounded-3xl bg-muted/10 border-2 border-dashed border-border shadow-inner">
                                        {detectedTags.map(tag => (
 <div key={tag} className="space-y-2">
 <Label className="text-[9px] font-semibold text-muted-foreground flex items-center gap-1.5 ml-1">
 <div className="w-1 h-1 rounded-full bg-primary" />
                                                    {tag.replace(/_/g, ' ')}
                                                </Label>
                                                <Input 
                                                    value={localVariables[tag] || ''} 
                                                    onChange={e => setLocalVariables(prev => ({ ...prev, [tag]: e.target.value }))}
                                                    placeholder={`Value for {{${tag}}}`}
 className="h-10 rounded-xl bg-white border border-primary/5 shadow-sm font-bold text-sm px-4"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

 <div className="p-6 rounded-3xl bg-blue-50 border border-blue-100 flex items-start gap-5 shadow-sm">
 <div className="p-3 bg-white rounded-2xl text-blue-600 shadow-sm border border-blue-100"><Zap className="h-6 w-6" /></div>
 <div className="space-y-1">
 <p className="text-sm font-semibold text-blue-900 tracking-tight">Institutional Fidelity</p>
 <p className="text-[10px] text-blue-700 leading-relaxed font-bold opacity-80">
                                        This test will resolve all tags using the values above. Emails will be delivered with premium Figtree typography and high-density line spacing.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </div>

 <DialogFooter className="bg-muted/30 p-8 border-t shrink-0 flex flex-col sm:flex-row gap-4">
 <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSending} className="font-bold rounded-xl h-14 px-10 flex-1">Discard</Button>
                    <Button 
                        onClick={handleSend} 
                        disabled={isSending || !recipient.trim()}
 className="rounded-2xl font-semibold h-14 px-12 shadow-2xl bg-primary text-white flex-[2] tracking-[0.1em] text-sm gap-3 active:scale-95 transition-all"
                    >
 {isSending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}
                        {isSending ? 'Launching Test...' : 'Execute Dispatch'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
