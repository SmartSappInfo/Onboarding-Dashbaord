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

    // ── Rate Limiter: 5 dispatches per 60 seconds sliding window ──────────
    const MAX_DISPATCHES = 5;
    const WINDOW_MS = 60_000;
    const dispatchTimestampsRef = React.useRef<number[]>([]);
    const [cooldownSeconds, setCooldownSeconds] = React.useState(0);
    const cooldownIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    const isRateLimited = cooldownSeconds > 0;

    const checkRateLimit = React.useCallback((): boolean => {
        const now = Date.now();
        // Purge timestamps outside the sliding window
        dispatchTimestampsRef.current = dispatchTimestampsRef.current.filter(
            ts => now - ts < WINDOW_MS
        );
        if (dispatchTimestampsRef.current.length >= MAX_DISPATCHES) {
            // Calculate cooldown from oldest timestamp in window
            const oldestInWindow = dispatchTimestampsRef.current[0];
            const remainingMs = WINDOW_MS - (now - oldestInWindow);
            const remainingSec = Math.ceil(remainingMs / 1000);
            setCooldownSeconds(remainingSec);

            // Start countdown timer
            if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = setInterval(() => {
                setCooldownSeconds(prev => {
                    if (prev <= 1) {
                        if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
                        cooldownIntervalRef.current = null;
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return true; // rate limited
        }
        return false;
    }, []);

    // Cleanup interval on unmount
    React.useEffect(() => {
        return () => {
            if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
        };
    }, []);

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

        // Enforce rate limit before dispatching
        if (checkRateLimit()) {
            toast({
                variant: 'destructive',
                title: 'Rate Limit Reached',
                description: `Maximum ${MAX_DISPATCHES} test dispatches per minute. Please wait ${cooldownSeconds}s.`
            });
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

            // Record successful dispatch timestamp
            dispatchTimestampsRef.current.push(Date.now());

            toast({ 
                title: 'Test Sent Successfully', 
                description: `A test ${channel} has been sent to ${recipient}.` 
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
          <DialogHeader className="p-8 bg-muted/30 border-b shrink-0 text-left">
            <div className="flex flex-col items-start gap-2">
              <div className={cn(
                "p-3 rounded-2xl shadow-sm mb-2",
                channel === 'email' ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-500"
              )}>
                <FlaskConical className="h-6 w-6" aria-hidden="true" />
              </div>
              <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground">Send Test Message</DialogTitle>
              <DialogDescription className="text-xs font-bold text-muted-foreground opacity-90">Preview and test your message before sending.</DialogDescription>
            </div>
          </DialogHeader>

 <div className="flex-1 overflow-hidden relative bg-background">
 <ScrollArea className="h-full">
 <div className="p-8 space-y-10">
                            {/* RECIPIENT BLOCK */}
 <div className="space-y-4">
 <Label className="text-[10px] font-semibold text-primary ml-1">Recipient</Label>
 <div className="relative group">
 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors">
 {channel === 'email' ? <Mail className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                                    </div>
                                    <Input 
                                        value={recipient} 
                                        onChange={e => setRecipient(e.target.value)}
                                        placeholder={channel === 'email' ? 'your-email@example.com' : 'e.g. 024XXXXXXX…'}
 className="h-14 pl-12 rounded-2xl bg-muted/20 border-none shadow-inner font-semibold text-xl"
                                        autoFocus
                                        type={channel === 'email' ? 'email' : 'tel'}
                                        inputMode={channel === 'email' ? 'email' : 'tel'}
                                    />
                                </div>
                            </div>

                            {/* VARIABLE RESOLUTION BLOCK */}
                            {detectedTags.length > 0 && (
 <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
 <div className="flex items-center justify-between px-1">
 <Label className="text-[10px] font-semibold text-primary flex items-center gap-2">
 <Database className="h-3 w-3" /> Template Variables
                                        </Label>
                                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] font-semibold uppercase h-5">{detectedTags.length} Variables</Badge>
                                    </div>
                                    
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 rounded-3xl bg-background border-2 border-dashed border-border shadow-inner">
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
 className="h-10 rounded-xl bg-card border border-primary/5 shadow-sm font-bold text-sm px-4"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

 <div className="p-6 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-5 shadow-sm">
 <div className="p-3 bg-card rounded-2xl text-blue-600 dark:text-blue-400 shadow-sm border border-blue-500/20"><Zap className="h-6 w-6" /></div>
 <div className="space-y-1">
 <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 tracking-tight">Test Environment</p>
 <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 leading-relaxed font-bold opacity-80">
                                        This test will resolve all variables using the values above. The message will be delivered exactly as it would appear to a real recipient.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </div>

          <DialogFooter className="bg-muted/30 p-6 border-t shrink-0 flex flex-col sm:flex-row gap-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSending} className="font-bold rounded-xl h-12 px-10 flex-1 cursor-pointer hover:bg-muted/50 transition-colors duration-200">Discard</Button>
            <Button 
              onClick={handleSend} 
              disabled={isSending || !recipient.trim() || isRateLimited}
              className={cn(
                "rounded-2xl font-semibold h-12 px-12 shadow-lg flex-[2] tracking-[0.1em] text-sm gap-3 cursor-pointer active:scale-95 transition-all duration-200",
                isRateLimited
                  ? "bg-amber-500/80 text-white hover:bg-amber-500/90"
                  : "bg-primary text-white"
              )}
            >
              {isRateLimited ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Wait ({cooldownSeconds}s)
                </>
              ) : isSending ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-6 w-6" aria-hidden="true" />
                  Send Test
                </>
              )}
            </Button>
          </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
