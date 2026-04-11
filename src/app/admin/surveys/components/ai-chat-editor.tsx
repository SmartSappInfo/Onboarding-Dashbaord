'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, Bot, User, BrainCircuit, X, Maximize2, Minimize2, ChevronDown } from 'lucide-react';
import { modifySurvey } from '@/ai/flows/modify-survey-flow';
import { createSurveyFromAiAction } from '@/lib/ai-survey-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addDoc, collection } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Button as MovingButton } from '@/components/ui/moving-border';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Paperclip, FileText } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import * as pdfjs from 'pdfjs-dist';
import { getDoc, doc } from 'firebase/firestore';
import AiModelSelector from '@/components/ai/AiModelSelector';
import type { UserProfile } from '@/lib/types';
import { createPortal } from 'react-dom';
import { onSnapshot } from 'firebase/firestore';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface AiChatEditorProps {
    variant?: 'default' | 'icon';
    className?: string;
}

function AiChatPanel() {
    const { getValues, reset, watch } = useFormContext();
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const firestore = useFirestore();
    const { user } = useUser();
    const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
    const storage = getStorage();

    const [isOpen, setIsOpen] = React.useState(false);
    const [isFullScreen, setIsFullScreen] = React.useState(false);
    const [input, setInput] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [isUploadingFile, setIsUploadingFile] = React.useState(false);
    const [stagedFile, setStagedFile] = React.useState<{ name: string; url: string; content?: string; dataUri?: string } | null>(null);
    const [unreadCount, setUnreadCount] = React.useState(0);

    // Live model preferences — updated in real time when user changes model in AiModelSelector
    const [liveProvider, setLiveProvider] = React.useState('openrouter');
    const [liveModelId, setLiveModelId] = React.useState('openrouter/free');

    const [messages, setMessages] = React.useState<Message[]>([
        { role: 'assistant', content: "Hello! I'm your AI Design Partner. Describe changes, paste a link, or upload a document to build your survey blueprint." }
    ]);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const surveyId = params?.id as string;
    const isNew = !surveyId;

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
        }
    }, []);

    // Real-time subscription to the user's model preferences
    React.useEffect(() => {
        if (!user || !firestore) return;
        const userRef = doc(firestore, 'users', user.uid);
        const unsubscribe = onSnapshot(userRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data() as UserProfile;
                if (data.preferredAiProvider) setLiveProvider(data.preferredAiProvider);
                if (data.preferredAiModel) setLiveModelId(data.preferredAiModel);
            }
        });
        return () => unsubscribe();
    }, [user, firestore]);

    React.useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    // Track unread messages when panel is closed
    React.useEffect(() => {
        if (!isOpen && messages.length > 1) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === 'assistant') {
                setUnreadCount(prev => prev + 1);
            }
        }
    }, [messages]);

    const handleOpen = () => {
        setIsOpen(true);
        setUnreadCount(0);
    };

    const extractTextFromPdf = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
        }
        return fullText;
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user || !firestore) return;

        const isAllowed = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type) ||
                         file.name.endsWith('.docx') || file.name.endsWith('.doc');
        
        if (!isAllowed) {
            toast({ variant: 'destructive', title: 'Unsupported File', description: 'Please upload PDF, TXT or DOCX files.' });
            return;
        }

        setIsUploadingFile(true);
        try {
            const storagePath = `media/documents/${Date.now()}-${file.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, file);

            const downloadUrl = await new Promise<string>((resolve, reject) => {
                uploadTask.on('state_changed', null, reject, async () => {
                    resolve(await getDownloadURL(uploadTask.snapshot.ref));
                });
            });

            const assetData = {
                name: file.name, url: downloadUrl, fullPath: storagePath,
                type: 'document', mimeType: file.type, size: file.size,
                uploadedBy: user.uid, workspaceIds: [activeWorkspaceId],
                createdAt: new Date().toISOString()
            };
            await addDoc(collection(firestore, 'media'), assetData);

            let content = '';
            let dataUri = '';
            if (file.type === 'application/pdf') {
                content = await extractTextFromPdf(file);
                const reader = new FileReader();
                dataUri = await new Promise((resolve) => {
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.readAsDataURL(file);
                });
            } else if (file.type === 'text/plain') {
                content = await file.text();
            }

            setStagedFile({ name: file.name, url: downloadUrl, content, dataUri });
            toast({ title: 'Document Prepared', description: `${file.name} ready for analysis.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
        } finally {
            setIsUploadingFile(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const currentData = getValues();
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const foundUrl = input.match(urlRegex)?.[0];

            // Use live model preferences tracked via onSnapshot
            const provider = liveProvider;
            const modelId = liveModelId;

            const result = await modifySurvey({
                userMessage: userMsg,
                docContent: stagedFile?.content,
                docDataUri: stagedFile?.dataUri,
                docUrl: stagedFile?.url,
                sourceUrl: foundUrl,
                organizationId: activeOrganizationId,
                provider,
                modelId,
                currentSurvey: {
                    title: currentData.title || '',
                    description: currentData.description || '',
                    elements: currentData.elements || [],
                    scoringEnabled: currentData.scoringEnabled,
                    maxScore: currentData.maxScore,
                    resultRules: currentData.resultRules || [],
                    resultPages: currentData.resultPages || [],
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
                const mergedSurvey = { ...currentData, ...result.updatedSurvey };

                if (isNew && result.updatedSurvey.elements.length > 0) {
                    setMessages(prev => [...prev, { role: 'assistant', content: "Building your blueprint... 🚀" }]);
                    const saveResult = await createSurveyFromAiAction({
                        surveyData: result.updatedSurvey as any,
                        resultPages: result.updatedSurvey.resultPages as any,
                        workspaceId: activeWorkspaceId!,
                        userId: user!.uid
                    });

                    if (saveResult.success) {
                        toast({ title: 'Blueprint Composed!', description: 'Redirecting to Edit Studio...' });
                        router.push(`/admin/surveys/${saveResult.id}/edit`);
                        return;
                    } else {
                        toast({ variant: 'destructive', title: 'Persistence Failed', description: saveResult.error });
                    }
                }

                reset(mergedSurvey, { keepDirty: true, keepTouched: true });
                setMessages(prev => [...prev, { role: 'assistant', content: result.aiSummary }]);
                setStagedFile(null);
                toast({ title: 'Architecture Updated', description: 'AI has applied your requested changes.' });
            }

        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: "I encountered an error while modifying the survey. Please try rephrasing your request." }]);
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

    const panelVariants = {
        hidden: { opacity: 0, y: 24, scale: 0.94 },
        visible: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 16, scale: 0.96 },
    };

    const fullscreenVariants = {
        hidden: { opacity: 0, scale: 0.97 },
        visible: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.97 },
    };

    return (
        <>
            {/* Chat Panel Portal */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop for fullscreen */}
                        {isFullScreen && (
                            <motion.div
                                key="backdrop"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
                                onClick={() => setIsFullScreen(false)}
                            />
                        )}

                        <motion.div
                            key="chat-panel"
                            variants={isFullScreen ? fullscreenVariants : panelVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                            style={isFullScreen ? {
                                position: 'fixed',
                                inset: '5%',
                                width: 'auto',
                                height: 'auto',
                                zIndex: 9999,
                            } : {
                                position: 'fixed',
                                bottom: '96px',
                                right: '24px',
                                width: '400px',
                                height: '540px',
                                zIndex: 9999,
                                maxWidth: 'calc(100vw - 48px)',
                            }}
                        >
                            <Card className="shadow-2xl border border-primary/20 flex flex-col h-full w-full overflow-hidden bg-card rounded-[1.5rem]">
                                {/* Header */}
                                <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-3 px-5 shrink-0 flex flex-row items-center justify-between space-y-0 gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                            <BrainCircuit className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <CardTitle className="text-xs font-black uppercase tracking-widest leading-none mb-0.5 truncate">AI Design Partner</CardTitle>
                                            <CardDescription className="text-[9px] text-primary-foreground/60 uppercase font-bold tracking-tight">Survey Architect</CardDescription>
                                        </div>
                                    </div>

                                    {/* Model selector — only in fullscreen or mini */}
                                    <div className="flex-1 flex justify-center px-2">
                                        <AiModelSelector className={cn("origin-center", isFullScreen ? "scale-90" : "scale-75")} />
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 hover:bg-white/10 text-primary-foreground rounded-lg"
                                            onClick={() => setIsFullScreen(!isFullScreen)}
                                            title={isFullScreen ? 'Minimize' : 'Maximize'}
                                        >
                                            {isFullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 hover:bg-white/10 text-primary-foreground rounded-lg"
                                            onClick={() => { setIsOpen(false); setIsFullScreen(false); }}
                                        >
                                            <ChevronDown className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardHeader>

                                {/* Messages */}
                                <CardContent className="flex-1 overflow-hidden p-0 bg-background/30">
                                    <ScrollArea className="h-full px-4 py-4" viewportRef={scrollRef}>
                                        <div className={cn("space-y-4 mx-auto", isFullScreen ? "max-w-3xl" : "max-w-full")}>
                                            {messages.map((m, i) => (
                                                <div key={i} className={cn(
                                                    "flex gap-2.5 max-w-[88%]",
                                                    m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                                                )}>
                                                    <div className={cn(
                                                        "h-7 w-7 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-0.5",
                                                        m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-card border border-border text-primary"
                                                    )}>
                                                        {m.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                                                    </div>
                                                    <div className={cn(
                                                        "px-3.5 py-2.5 rounded-2xl text-sm shadow-sm leading-relaxed",
                                                        m.role === 'user'
                                                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                                                            : "bg-card border border-border/60 rounded-tl-sm text-foreground"
                                                    )}>
                                                        {m.content}
                                                    </div>
                                                </div>
                                            ))}

                                            {isLoading && (
                                                <div className="flex gap-2.5 mr-auto max-w-[88%]">
                                                    <div className="h-7 w-7 rounded-full bg-card border border-border flex items-center justify-center text-primary shrink-0 mt-0.5">
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    </div>
                                                    <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-card border border-border/60 text-sm text-muted-foreground italic flex items-center gap-2">
                                                        <span className="flex gap-1">
                                                            <span className="animate-bounce delay-0 h-1.5 w-1.5 bg-primary/40 rounded-full inline-block" />
                                                            <span className="animate-bounce delay-100 h-1.5 w-1.5 bg-primary/60 rounded-full inline-block" />
                                                            <span className="animate-bounce delay-200 h-1.5 w-1.5 bg-primary/80 rounded-full inline-block" />
                                                        </span>
                                                        Analyzing...
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </CardContent>

                                {/* Footer */}
                                <CardFooter className="p-3 border-t bg-card/60 backdrop-blur-md shrink-0">
                                    <div className={cn("flex flex-col w-full gap-2 mx-auto", isFullScreen ? "max-w-3xl" : "max-w-full")}>
                                        {stagedFile && (
                                            <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg border border-primary/20 self-start animate-in fade-in slide-in-from-bottom-1">
                                                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                                                <span className="text-[10px] font-bold text-primary truncate max-w-[180px]">{stagedFile.name}</span>
                                                <Button variant="ghost" size="icon" className="h-4 w-4 text-primary/60 hover:text-primary" onClick={() => setStagedFile(null)}>
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}

                                        <div className="flex items-end gap-2 w-full">
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileUpload}
                                                className="hidden"
                                                accept=".pdf,.docx,.doc,.txt"
                                            />
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={isLoading || isUploadingFile}
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="h-10 w-10 rounded-xl shrink-0 border border-border/60 hover:bg-accent/10"
                                                        >
                                                            {isUploadingFile ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Paperclip className="h-4 w-4 text-muted-foreground" />}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">Attach Document (PDF, DOCX, TXT)</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            <div className="flex-1 min-w-0">
                                                {isFullScreen ? (
                                                    <Textarea
                                                        placeholder="Describe your design, paste a link, or send an attachment..."
                                                        value={input}
                                                        onChange={(e) => setInput(e.target.value)}
                                                        onKeyDown={handleKeyDown}
                                                        disabled={isLoading}
                                                        className="min-h-[80px] max-h-[200px] rounded-xl bg-background/50 border-border/60 shadow-none focus-visible:ring-1 focus-visible:ring-primary/30 p-3 leading-relaxed"
                                                    />
                                                ) : (
                                                    <Input
                                                        placeholder="Ask me to build a survey from..."
                                                        value={input}
                                                        onChange={(e) => setInput(e.target.value)}
                                                        onKeyDown={handleKeyDown}
                                                        disabled={isLoading}
                                                        className="h-10 rounded-xl bg-background/50 border-border/60 shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
                                                    />
                                                )}
                                            </div>

                                            <MovingButton
                                                type="button"
                                                onClick={handleSend}
                                                disabled={(!input.trim() && !stagedFile) || isLoading || isUploadingFile}
                                                containerClassName="h-10 w-10 rounded-xl shrink-0"
                                                className="h-full w-full bg-slate-900"
                                            >
                                                <span className="sr-only">Send</span>
                                                <Send className="h-3.5 w-3.5" />
                                            </MovingButton>
                                        </div>
                                    </div>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Fixed Floating Trigger Button */}
            <motion.button
                type="button"
                onClick={isOpen ? () => { setIsOpen(false); setIsFullScreen(false); } : handleOpen}
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                    "fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4",
                    "h-14 rounded-full shadow-2xl shadow-primary/30",
                    "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
                    "font-black text-xs uppercase tracking-widest",
                    "border border-primary/30",
                    "transition-shadow hover:shadow-primary/50 hover:shadow-2xl"
                )}
                aria-label="Toggle AI Design Partner"
            >
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                            <ChevronDown className="h-5 w-5" />
                        </motion.span>
                    ) : (
                        <motion.span key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                            <Sparkles className="h-5 w-5" />
                        </motion.span>
                    )}
                </AnimatePresence>
                <span>AI Partner</span>
                {/* Unread badge */}
                {!isOpen && unreadCount > 0 && (
                    <motion.span
                        key="badge"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-red-500/40"
                    >
                        {unreadCount}
                    </motion.span>
                )}
            </motion.button>
        </>
    );
}

export default function AiChatEditor({ variant = 'default', className }: AiChatEditorProps) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    // Always render as a portal so it escapes any parent stacking context and sits globally
    return createPortal(<AiChatPanel />, document.body);
}
