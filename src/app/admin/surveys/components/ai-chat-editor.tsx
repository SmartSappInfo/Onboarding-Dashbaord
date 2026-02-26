'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, Bot, User, BrainCircuit, X, Maximize2, Minimize2 } from 'lucide-react';
import { modifySurvey } from '@/ai/flows/modify-survey-flow';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { RainbowButton } from '@/components/ui/rainbow-button';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function AiChatEditor() {
    const { getValues, reset } = useFormContext();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = React.useState(false);
    const [isFullScreen, setIsFullScreen] = React.useState(false);
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
                    backgroundColor: currentData.backgroundColor,
                    backgroundPattern: currentData.backgroundPattern,
                    patternColor: currentData.patternColor,
                    logoUrl: currentData.logoUrl,
                    bannerImageUrl: currentData.bannerImageUrl,
                    thankYouTitle: currentData.thankYouTitle,
                    thankYouDescription: currentData.thankYouDescription,
                    startButtonText: currentData.startButtonText,
                    showCoverPage: currentData.showCoverPage,
                    showSurveyTitles: currentData.showSurveyTitles,
                }
            });

            if (result.updatedSurvey) {
                // Ensure background pattern is valid
                const VALID_PATTERNS = ['none', 'dots', 'grid', 'circuit', 'topography', 'cubes', 'gradient'];
                const pattern = result.updatedSurvey.backgroundPattern && VALID_PATTERNS.includes(result.updatedSurvey.backgroundPattern) 
                    ? result.updatedSurvey.backgroundPattern 
                    : (currentData.backgroundPattern || 'none');

                // Merge AI architectural changes with current local state to ensure no accidental metadata loss
                const mergedSurvey = {
                    ...currentData,
                    ...result.updatedSurvey,
                    backgroundPattern: pattern,
                };

                reset(mergedSurvey, {
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const toggleFullScreen = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsFullScreen(!isFullScreen);
    };

    return (
        <div className="relative inline-block">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ 
                            opacity: 1, 
                            y: 0, 
                            scale: 1,
                            ...(isFullScreen ? {
                                top: 16,
                                right: 16,
                                bottom: 16,
                                left: 16,
                                width: 'calc(100% - 32px)',
                                height: 'calc(100% - 32px)',
                                position: 'fixed'
                            } : {
                                bottom: 24,
                                right: 24,
                                top: 'auto',
                                left: 'auto',
                                width: 400,
                                height: 500,
                                position: 'fixed'
                            })
                        }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className={cn(
                            "z-[100] max-w-full",
                            !isFullScreen && "max-w-[90vw]"
                        )}
                    >
                        <Card className="shadow-2xl border-primary/20 flex flex-col h-full w-full overflow-hidden bg-card">
                            <CardHeader className="bg-primary text-primary-foreground py-4 px-6 shrink-0 flex flex-row items-center justify-between space-y-0">
                                <div className="flex items-center gap-2">
                                    <BrainCircuit className="h-5 w-5" />
                                    <div>
                                        <CardTitle className="text-sm font-black uppercase tracking-widest leading-none mb-1">Design Partner</CardTitle>
                                        <CardDescription className="text-[10px] text-primary-foreground/70 uppercase font-bold tracking-tight">AI State Architect</CardDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 hover:bg-white/10 text-primary-foreground" 
                                        onClick={toggleFullScreen}
                                        title={isFullScreen ? "Minimize" : "Maximize"}
                                    >
                                        {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                    </Button>
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 hover:bg-white/10 text-primary-foreground" 
                                        onClick={() => {
                                            setIsOpen(false);
                                            setIsFullScreen(false);
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-hidden p-0 bg-slate-50 dark:bg-slate-900/50">
                                <ScrollArea className="h-full p-4" viewportRef={scrollRef}>
                                    <div className={cn(
                                        "space-y-4 mx-auto",
                                        isFullScreen ? "max-w-4xl" : "max-w-full"
                                    )}>
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
                                                        : "bg-white border rounded-tl-none text-foreground dark:bg-slate-800 dark:border-slate-700"
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
                                                <div className="p-3 rounded-2xl rounded-tl-none bg-white border text-sm text-muted-foreground italic dark:bg-slate-800 dark:border-slate-700">
                                                    Analyzing architecture...
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                            <CardFooter className="p-4 border-t bg-white dark:bg-slate-900 shrink-0">
                                <div className={cn(
                                    "flex w-full items-end gap-2 mx-auto",
                                    isFullScreen ? "max-w-4xl" : "max-w-full"
                                )}>
                                    <div className="flex-1 min-w-0">
                                        {isFullScreen ? (
                                            <Textarea
                                                placeholder="Describe your design changes (Shift + Enter for new line)..."
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                disabled={isLoading}
                                                className="min-h-[100px] max-h-[300px] rounded-xl bg-slate-50 dark:bg-slate-800 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 p-4 leading-relaxed"
                                            />
                                        ) : (
                                            <Input
                                                placeholder="Update survey structure..."
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                disabled={isLoading}
                                                className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20"
                                            />
                                        )}
                                    </div>
                                    <Button 
                                        type="button"
                                        size="icon" 
                                        onClick={handleSend}
                                        disabled={!input.trim() || isLoading}
                                        className="h-11 w-11 rounded-xl shrink-0 mb-[1px]"
                                    >
                                        <span className="sr-only">Send message</span>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            <RainbowButton
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="h-9 px-4 gap-2 font-bold"
            >
                {isOpen ? (
                    <X className="h-4 w-4" />
                ) : (
                    <Sparkles className="h-4 w-4" />
                )}
                <span>AI Partner</span>
            </RainbowButton>
        </div>
    );
}
