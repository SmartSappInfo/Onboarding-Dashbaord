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
import { createSurveyFromAiAction } from '@/lib/ai-survey-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addDoc, collection } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Paperclip, FileText, CheckCircle2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import * as pdfjs from 'pdfjs-dist';
import { getDoc, doc } from 'firebase/firestore';
import AiModelSelector from '@/components/ai/AiModelSelector';
import type { UserProfile } from '@/lib/types';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface AiChatEditorProps {
    variant?: 'default' | 'icon';
    className?: string;
}

export default function AiChatEditor({ variant = 'default', className }: AiChatEditorProps) {
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

    const [messages, setMessages] = React.useState<Message[]>([
        { role: 'assistant', content: "Hello! I'm your AI Design Partner. You can describe changes, paste a link, or upload a document (PDF, TXT, DOCX) to build your survey blueprint." }
    ]);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Dynamic survey ID detection
    const surveyId = params?.id as string;
    const isNew = !surveyId;

    React.useEffect(() => {
        // Configure PDF.js worker
        if (typeof window !== 'undefined') {
            pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
        }
    }, []);

    React.useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, isLoading]);

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
            // 1. Upload to Storage
            const storagePath = `media/documents/${Date.now()}-${file.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, file);

            const downloadUrl = await new Promise<string>((resolve, reject) => {
                uploadTask.on('state_changed', null, reject, async () => {
                    resolve(await getDownloadURL(uploadTask.snapshot.ref));
                });
            });

            // 2. Create Media Asset Record
            const assetData = {
                name: file.name,
                url: downloadUrl,
                fullPath: storagePath,
                type: 'document',
                mimeType: file.type,
                size: file.size,
                uploadedBy: user.uid,
                workspaceIds: [activeWorkspaceId],
                createdAt: new Date().toISOString()
            };
            await addDoc(collection(firestore, 'media'), assetData);

            // 3. Extract content for AI
            let content = '';
            let dataUri = '';

            if (file.type === 'application/pdf') {
                content = await extractTextFromPdf(file);
                // Convert to Data URI for multimodal
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
            console.error("File upload failed:", error);
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
            
            // Extract URL from input if present
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const foundUrl = input.match(urlRegex)?.[0];

            // Fetch user preferences for model and provider
            let provider = 'googleai';
            let modelId = 'gemini-1.5-flash';
            
            if (user && firestore) {
                const userRef = doc(firestore, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const profile = userSnap.data() as UserProfile;
                    provider = profile.preferredAiProvider || 'googleai';
                    modelId = profile.preferredAiModel || 'gemini-1.5-flash';
                }
            }

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
                const mergedSurvey = {
                    ...currentData,
                    ...result.updatedSurvey,
                };

                // AUTO-SAVE LOGIC (Requirement 11)
                if (isNew && result.updatedSurvey.elements.length > 0) {
                    setMessages(prev => [...prev, { role: 'assistant', content: "Building your blueprint and persisting to the hub... 🚀" }]);
                    
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

                // Normal state update for existing surveys or manual edits
                reset(mergedSurvey, { keepDirty: true, keepTouched: true });
                setMessages(prev => [...prev, { role: 'assistant', content: result.aiSummary }]);
                setStagedFile(null); // Clear file after processing
                toast({ title: 'Architecture Updated', description: 'AI has applied your requested changes.' });
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
        <div className={cn("relative inline-block", className)}>
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

                                {/* AI Model Selection integrated into header */}
                                {isOpen && (
                                    <div className="flex-1 flex justify-center px-4">
                                        <AiModelSelector className="scale-75 origin-top" />
                                    </div>
                                )}

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
                                    "flex flex-col w-full gap-2 mx-auto",
                                    isFullScreen ? "max-w-4xl" : "max-w-full"
                                )}>
                                    {stagedFile && (
                                        <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/20 self-start animate-in fade-in slide-in-from-bottom-1">
                                            <FileText className="h-4 w-4 text-primary" />
                                            <span className="text-[10px] font-bold text-primary truncate max-w-[200px]">{stagedFile.name}</span>
                                            <Button variant="ghost" size="icon" className="h-4 w-4 text-primary/60 hover:text-primary" onClick={() => setStagedFile(null)}>
                                                <X className="h-3 h-3" />
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
                                                        className="h-11 w-11 rounded-xl shrink-0 border border-slate-100 hover:bg-slate-50"
                                                    >
                                                        {isUploadingFile ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Paperclip className="h-4 w-4 text-slate-500" />}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Attach Document (PDF, DOCX, TXT)</TooltipContent>
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
                                                    className="min-h-[100px] max-h-[300px] rounded-xl bg-slate-50 dark:bg-slate-800 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 p-4 leading-relaxed"
                                                />
                                            ) : (
                                                <Input
                                                    placeholder="Build a survey from..."
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
                                            disabled={(!input.trim() && !stagedFile) || isLoading || isUploadingFile}
                                            className="h-11 w-11 rounded-xl shrink-0 mb-[1px]"
                                        >
                                            <span className="sr-only">Send message</span>
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {variant === 'icon' ? (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setIsOpen(!isOpen)}
                                className="h-10 w-10 rounded-xl hover:bg-primary/10 transition-colors"
                            >
                                {isOpen ? <X className="h-5 w-5 text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">AI Design Partner</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ) : (
                <RainbowButton
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="h-9 px-4 gap-2 font-bold"
                >
                    {isOpen ? <X className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    <span>AI Partner</span>
                </RainbowButton>
            )}
        </div>
    );
}
