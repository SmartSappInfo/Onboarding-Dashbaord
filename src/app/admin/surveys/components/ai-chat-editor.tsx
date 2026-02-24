'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, Bot, User, BrainCircuit, X, MessageSquarePlus } from 'lucide-react';
import { modifySurvey } from '@/ai/flows/modify-survey-flow';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function AiChatEditor() {
    const { getValues, reset } = useFormContext();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = React.useState(false);
    const [input, setInput] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [messages, setMessages] = React.useState<Message[]>([
        { role: 'assistant', content: "Hello! I'm your AI Design Partner. Describe any changes you'd like to make to your survey, logic, or results, and I'll handle the architecture for you." }
    ]);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const currentData = getValues();
            
            const result = await modifySurvey({
                userMessage: userMsg,
                currentSurvey: {
                    title: currentData.title,
                    description: currentData.description,
                    elements: currentData.elements,
                    scoringEnabled: currentData.scoringEnabled,
                    maxScore: currentData.maxScore,
                    resultRules: currentData.resultRules,
                    resultPages: currentData.resultPages,
                }
            });

            if (result.updatedSurvey) {
                // Apply changes to the form
                // Using reset with the new data allows the undo/redo history to track it
                reset(result.updatedSurvey, {
                    keepDirty: true,
                    keepTouched: true,
                });

                setMessages(prev => [...prev, { role: 'assistant', content: result.aiSummary }]);
                toast({ title: 'Survey Architecture Updated', description: 'AI has applied your requested changes.' });
            }

        } catch (error: any) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm sorry, I encountered an error while trying to modify the survey. Please try rephrasing your request." }]);
            toast({ variant: 'destructive', title: 'AI Modification Failed', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-4">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="w-[400px] max-w-[90vw]"
                    >
                        <Card className="shadow-2xl border-primary/20 flex flex-col h-[500px] overflow-hidden">
                            <CardHeader className="bg-primary text-primary-foreground py-4 px-6 shrink-0 flex flex-row items-center justify-between space-y-0">
                                <div className="flex items-center gap-2">
                                    <BrainCircuit className="h-5 w-5" />
                                    <div>
                                        <CardTitle className="text-sm font-black uppercase tracking-widest leading-none mb-1">Design Partner</CardTitle>
                                        <CardDescription className="text-[10px] text-primary-foreground/70 uppercase font-bold tracking-tight">AI State Architect</CardDescription>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 text-primary-foreground" onClick={() => setIsOpen(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-hidden p-0 bg-slate-50 dark:bg-slate-900/50">
                                <ScrollArea className="h-full p-4" viewportRef={scrollRef}>
                                    <div className="space-y-4">
                                        {messages.map((m, i) => (
                                            <div key={i} className={cn(
                                                "flex gap-3 max-w-[85%]",
                                                m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                                            )}>
                                                <div className={cn(
                                                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                                                    m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-white border text-primary"
                                                )}>
                                                    {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                                </div>
                                                <div className={cn(
                                                    "p-3 rounded-2xl text-sm shadow-sm",
                                                    m.role === 'user' 
                                                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                                                        : "bg-white border rounded-tl-none text-foreground"
                                                )}>
                                                    {m.content}
                                                </div>
                                            </div>
                                        ))}
                                        {isLoading && (
                                            <div className="flex gap-3 mr-auto max-w-[85%] animate-pulse">
                                                <div className="h-8 w-8 rounded-full bg-white border flex items-center justify-center text-primary shrink-0">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                </div>
                                                <div className="p-3 rounded-2xl rounded-tl-none bg-white border text-sm text-muted-foreground italic">
                                                    Analyzing architecture...
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                            <CardFooter className="p-4 border-t bg-white shrink-0">
                                <form 
                                    className="flex w-full items-center gap-2"
                                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                >
                                    <Input
                                        placeholder="e.g., Add a section for dietary requirements..."
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        disabled={isLoading}
                                        className="h-11 rounded-xl bg-slate-50 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20"
                                    />
                                    <Button 
                                        type="submit" 
                                        size="icon" 
                                        disabled={!input.trim() || isLoading}
                                        className="h-11 w-11 rounded-xl shrink-0"
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </form>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            <Button
                size="lg"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "h-14 px-6 rounded-2xl font-black gap-3 shadow-2xl transition-all hover:scale-105 active:scale-95",
                    isOpen ? "bg-white text-primary hover:bg-slate-50 border" : "bg-primary text-primary-foreground"
                )}
            >
                {isOpen ? (
                    <>
                        <X className="h-5 w-5" />
                        <span>Close AI Partner</span>
                    </>
                ) : (
                    <>
                        <Sparkles className="h-5 w-5 animate-pulse" />
                        <span>Ask AI Design Partner</span>
                    </>
                )}
            </Button>
        </div>
    );
}
