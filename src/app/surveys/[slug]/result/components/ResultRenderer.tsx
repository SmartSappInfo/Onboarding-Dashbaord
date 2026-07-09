'use client';

import * as React from 'react';
import type { Survey, SurveyResponse, SurveyResultPage, SurveyResultBlock } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Quote, Trophy, Building2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import Image from 'next/image';
import VideoEmbed from '@/components/video-embed';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { executeSurveyResultButtonActions, getWorkspaceEntitiesForSimulationAction } from '@/lib/survey-actions';
import { getVariableValuesMapAction } from '@/lib/services/fields-variables-service';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';

interface ResultRendererProps {
    survey: Survey;
    response: SurveyResponse;
    page: SurveyResultPage | null;
    logoUrl?: string | null;
    allowResubmission?: boolean;
    resultPages?: SurveyResultPage[];
    preview?: boolean;
    workspaceId?: string;
}

function ScoreCard({ score, maxScore, style, displayMode = 'points' }: { score: number, maxScore: number, style?: { animate?: boolean }, displayMode?: 'points' | 'percentage' }) {
    const [displayValue, setDisplayValue] = React.useState(0);
    const hasCelebrated = React.useRef(false);

    const isPercentage = displayMode === 'percentage';
    const targetValue = isPercentage ? Math.round((score / maxScore) * 100) : score;

    React.useEffect(() => {
        let start = 0;
        const duration = 2000;
        const frames = duration / 16;
        const increment = targetValue / frames;
        let active = true;
        
        const timer = setInterval(() => {
            start += increment;
            if (start >= targetValue) {
                setDisplayValue(targetValue);
                clearInterval(timer);
                if (!hasCelebrated.current && style?.animate !== false) {
                    import('canvas-confetti').then(({ default: confetti }) => {
                        if (!active) return;
                        confetti({
                            particleCount: 150,
                            spread: 70,
                            origin: { y: 0.6 },
                            colors: ['#3B5FFF', '#f72585', '#7209b7']
                        });
                    }).catch(console.error);
                    hasCelebrated.current = true;
                }
            } else {
                setDisplayValue(Math.floor(start));
            }
        }, 16);

        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [targetValue, style?.animate]);

    return (
        <Card className="relative overflow-hidden bg-primary text-white border-none shadow-2xl rounded-2xl sm:rounded-3xl p-6 sm:p-10 my-6 sm:my-8">
            <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -right-8 sm:-right-12 -top-8 sm:-top-12 opacity-10"
            >
                <Trophy size={200} className="sm:w-[220px] sm:h-[220px]" />
            </motion.div>
            
            <CardContent className="relative z-10 flex flex-col items-center text-center p-0">
                <Badge variant="outline" className="mb-6 sm:mb-8 bg-white/10 text-white border-white/20 px-4 py-1.5 text-xs font-bold tracking-widest uppercase">Assessment Result</Badge>
                
                <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-center">
                        <span className="text-6xl sm:text-7xl md:text-8xl font-bold tabular-nums tracking-tighter">
                            {displayValue}
                        </span>
                        {isPercentage && <span className="text-4xl sm:text-5xl font-black ml-1">%</span>}
                    </div>
                    <span className="text-base sm:text-lg font-bold opacity-60 uppercase tracking-wide">
                        {isPercentage ? 'Overall Accuracy' : `out of ${maxScore} points`}
                    </span>
                </div>

                <div className="w-full max-w-lg mx-auto">
                    <div className="mt-6 sm:mt-8 w-full h-2.5 bg-white/20 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(score / maxScore) * 100}%` }}
                            transition={{ duration: 2, ease: "easeOut" }}
                            className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.6)]"
                        />
                    </div>
                    <p className="mt-5 text-base sm:text-lg font-medium text-white/80">
                        That&apos;s better than {Math.round((score / maxScore) * 100 * 0.8)}% of other respondents!
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

function ActionButton({ 
    block, 
    surveyId, 
    responseId, 
    entityId 
}: { 
    block: SurveyResultBlock, 
    surveyId: string, 
    responseId: string, 
    entityId?: string | null 
}) {
    const router = useRouter();
    const [loading, setLoading] = React.useState(false);

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
        const hasSideEffects = 
            (block.addTagIds && block.addTagIds.length > 0) || 
            (block.triggerAutomationId && block.triggerAutomationId !== 'none') || 
            (block.fireWebhookEnabled && block.fireWebhookUrl);

        if (hasSideEffects && entityId) {
            e.preventDefault();
            setLoading(true);
            try {
                await executeSurveyResultButtonActions({
                    surveyId,
                    responseId,
                    entityId,
                    addTagIds: block.addTagIds,
                    triggerAutomationId: block.triggerAutomationId,
                    fireWebhookUrl: block.fireWebhookEnabled ? block.fireWebhookUrl : undefined
                });
            } catch (err) {
                console.error('Failed to execute results button actions:', err);
            } finally {
                setLoading(false);
            }
        }
        
        // Complete navigation
        if (block.link) {
            if (block.openInNewTab) {
                window.open(block.link, '_blank', 'noopener,noreferrer');
            } else {
                router.push(block.link);
            }
        }
    };

    return (
        <Button 
            disabled={loading}
            onClick={handleClick}
            size="lg" 
            variant={block.style?.variant as 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | null | undefined} 
            className="h-12 px-8 text-base font-bold rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 w-full sm:w-auto uppercase tracking-wide flex items-center justify-center gap-2"
        >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {block.title} 
            {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
        </Button>
    );
}

function CustomCodeRenderer({ code, containerClasses }: { code: string; containerClasses?: string }) {
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!containerRef.current) return;
        
        containerRef.current.innerHTML = '';
        
        try {
            const range = document.createRange();
            range.selectNode(containerRef.current);
            const fragment = range.createContextualFragment(code);
            containerRef.current.appendChild(fragment);
        } catch (err) {
            console.error("Error embedding custom code block:", err);
            containerRef.current.innerHTML = code;
        }
    }, [code]);

    return <div ref={containerRef} className={containerClasses} />;
}

function BlockRenderer({ 
    block, 
    score, 
    maxScore, 
    displayMode,
    surveyId,
    responseId,
    entityId,
    resultPages,
    survey,
    simulatedValues
}: { 
    block: SurveyResultBlock, 
    score: number, 
    maxScore: number, 
    displayMode?: 'points' | 'percentage',
    surveyId: string,
    responseId: string,
    entityId?: string | null,
    resultPages?: SurveyResultPage[],
    survey: Survey,
    simulatedValues?: Record<string, string>
}) {
    const alignment = block.style?.textAlign || 'left';
    
    const containerClasses = cn(
        "w-full my-5 sm:my-6 px-2 sm:px-0",
        alignment === 'center' && "text-center flex flex-col items-center",
        alignment === 'right' && "text-right flex flex-col items-end",
        alignment === 'justify' && "text-justify"
    );

    const interpolateText = (text: string | undefined | null): string => {
        if (!text) return '';
        if (simulatedValues && Object.keys(simulatedValues).length > 0) {
            return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
                const trimmed = key.trim();
                return simulatedValues[trimmed] !== undefined ? simulatedValues[trimmed] : match;
            });
        }
        return text;
    };

    const interpolateArray = (items: string[] | undefined | null): string[] => {
        if (!items) return [];
        return items.map(item => interpolateText(item));
    };

    switch (block.type) {
        case 'heading': {
            const Tag = block.variant || 'h2';
            const sizeClass = Tag === 'h1' ? "text-3xl sm:text-4xl font-bold" : Tag === 'h3' ? "text-xl font-bold" : "text-2xl font-bold";
            return (
                <Tag 
                    className={cn(sizeClass, "tracking-tight whitespace-pre-wrap", containerClasses)} 
                    style={{ color: block.style?.color }}
                >
                    {interpolateText(block.title)}
                </Tag>
            );
        }
        case 'text':
            return <div className={cn("prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-muted-foreground leading-relaxed whitespace-pre-wrap", containerClasses)}>{interpolateText(block.content) || ''}</div>;
        case 'list':
            return (
                <div className={containerClasses}>
                    {block.listStyle === 'ordered' ? (
                        <ol className="list-decimal list-inside space-y-3 text-lg font-medium text-slate-700 dark:text-slate-300 text-left">
                            {interpolateArray(block.items)?.map((item, i) => <li key={i}>{item}</li>)}
                        </ol>
                    ) : (
                        <ul className="list-disc list-inside space-y-3 text-lg font-medium text-slate-700 dark:text-slate-300 text-left">
                            {interpolateArray(block.items)?.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                    )}
                </div>
            );
        case 'image':
            return block.url ? (
                <div className={cn("relative aspect-video rounded-xl sm:rounded-2xl overflow-hidden shadow-lg border border-border/50 bg-card", containerClasses)}>
                    <Image src={block.url} alt="Result content" fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" />
                </div>
            ) : null;
        case 'video':
            return block.url ? <div className={containerClasses}><VideoEmbed url={block.url} thumbnailUrl={block.thumbnailUrl} /></div> : null;
        case 'audio':
            return block.url ? (
                <div className={cn("p-4 sm:p-6 bg-muted/20 border rounded-2xl shadow-sm w-full", containerClasses)}>
                    <audio controls src={block.url} className="w-full" />
                </div>
            ) : null;
        case 'button':
            return (
                <div className={containerClasses}>
                    <ActionButton 
                        block={block} 
                        surveyId={surveyId} 
                        responseId={responseId} 
                        entityId={entityId} 
                    />
                </div>
            );
        case 'quote':
            return (
                <div className={cn("p-6 sm:p-8 bg-muted/50 border-l-4 border-primary rounded-r-2xl italic text-lg sm:text-xl whitespace-pre-wrap", containerClasses)}>
                    <Quote className="h-6 w-6 sm:h-8 sm:w-8 text-primary/20 mb-4" />
                    {interpolateText(block.content)}
                </div>
            );
        case 'divider':
            return <hr className="w-full my-8 border-t-2 border-border/30" />;
        case 'score-card':
            return <ScoreCard score={score} maxScore={maxScore} style={block.style} displayMode={displayMode} />;
        case 'outcome-categories': {
            if (!survey.resultRules || survey.resultRules.length === 0) return null;

            const sortedRules = [...survey.resultRules].sort((a, b) => b.minScore - a.minScore);

            return (
                <div className={cn("w-full border rounded-2xl bg-card/65 backdrop-blur-md p-6 sm:p-8 shadow-md flex flex-col gap-4 text-left border-border/80", containerClasses)}>
                    {block.title && (
                        <h4 className="text-base sm:text-lg font-bold text-foreground opacity-90 tracking-tight">
                            {block.title}
                        </h4>
                    )}
                    <div className="flex flex-col gap-3">
                        {sortedRules.map((rule) => {
                            const isCurrent = score >= rule.minScore && score <= rule.maxScore;
                            const matchedPage = resultPages?.find(p => p.id === rule.pageId);
                            const categoryName = rule.label || matchedPage?.name || 'Untitled Category';

                            return (
                                <motion.div
                                    key={rule.id}
                                    initial={isCurrent ? { scale: 0.98, opacity: 0.9 } : undefined}
                                    animate={isCurrent ? { scale: 1, opacity: 1 } : undefined}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                    className={cn(
                                        "flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-all duration-300",
                                        isCurrent 
                                            ? "bg-primary/10 border-primary text-foreground font-semibold shadow-sm ring-1 ring-primary/20"
                                            : "bg-muted/10 border-transparent text-muted-foreground opacity-60"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Badge 
                                            variant={isCurrent ? "default" : "secondary"} 
                                            className={cn(
                                                "font-mono text-sm tracking-tight px-3 py-1 font-bold shrink-0",
                                                isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                            )}
                                        >
                                            {rule.minScore}–{rule.maxScore}
                                        </Badge>
                                        <span className="text-sm select-none">→</span>
                                        <span className={cn("text-base", isCurrent ? "text-foreground font-bold" : "text-muted-foreground")}>
                                            {categoryName}
                                        </span>
                                    </div>
                                    {isCurrent && (
                                        <div className="sm:ml-auto flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-primary animate-pulse shrink-0">
                                            <span>← You Are Here</span>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        case 'code':
            return block.content ? (
                <CustomCodeRenderer code={block.content} containerClasses={containerClasses} />
            ) : null;
        default:
            return null;
    }
}

export default function ResultRenderer({ 
    survey, 
    response, 
    page, 
    logoUrl, 
    allowResubmission, 
    resultPages,
    preview = false,
    workspaceId = ''
}: ResultRendererProps) {
    const [entities, setEntities] = React.useState<any[]>([]);
    const [selectedEntityId, setSelectedEntityId] = React.useState<string>('none');
    const [selectedContactEmail, setSelectedContactEmail] = React.useState<string>('none');
    const [simulatedValues, setSimulatedValues] = React.useState<Record<string, string>>({});
    const [isLoadingSimulation, setIsLoadingSimulation] = React.useState(false);

    React.useEffect(() => {
        if (preview && workspaceId) {
            getWorkspaceEntitiesForSimulationAction(workspaceId).then((data) => {
                setEntities(data);
                if (data.length > 0) {
                    setSelectedEntityId(data[0].id);
                    if (data[0].contacts && data[0].contacts.length > 0) {
                        setSelectedContactEmail(data[0].contacts[0].email);
                    }
                }
            }).catch(err => {
                console.error("Failed to load workspace entities for simulation:", err);
            });
        }
    }, [workspaceId, preview]);

    React.useEffect(() => {
        if (preview && workspaceId && selectedEntityId && selectedEntityId !== 'none') {
            setIsLoadingSimulation(true);
            getVariableValuesMapAction({
                workspaceId,
                entityId: selectedEntityId,
                recipientContact: selectedContactEmail && selectedContactEmail !== 'none' ? selectedContactEmail : undefined,
                surveyId: survey.id
            }).then((values) => {
                const mergedValues = {
                    ...values,
                    survey_score: String(response.score ?? 0),
                    score: String(response.score ?? 0),
                    max_score: String(survey.maxScore || 100),
                    survey_title: survey.title || ''
                };
                setSimulatedValues(mergedValues);
                setIsLoadingSimulation(false);
            }).catch(err => {
                console.error("Failed to fetch simulated variable values:", err);
                setIsLoadingSimulation(false);
            });
        } else {
            setSimulatedValues({});
        }
    }, [selectedEntityId, selectedContactEmail, workspaceId, survey.id, preview, response.score]);

    const handleEntityChange = (entityId: string) => {
        setSelectedEntityId(entityId);
        const match = entities.find(e => e.id === entityId);
        if (match && match.contacts && match.contacts.length > 0) {
            setSelectedContactEmail(match.contacts[0].email);
        } else {
            setSelectedContactEmail('none');
        }
    };

    const activeEntity = entities.find(e => e.id === selectedEntityId);
    const activeContacts = activeEntity?.contacts || [];

    React.useEffect(() => {
        if (page?.confettiEnabled) {
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduceMotion) return;

            let active = true;
            let sidesTimer: NodeJS.Timeout;

            import('canvas-confetti').then(({ default: confetti }) => {
                if (!active) return;
                const burst = (opts: Record<string, unknown>) =>
                    confetti({
                        disableForReducedMotion: true,
                        colors: ['#5f30e2', '#ffc629', '#10b981', '#3B5FFF', '#e63946'],
                        ...opts,
                    });

                burst({ particleCount: 160, spread: 100, startVelocity: 45, origin: { x: 0.5, y: 0.55 } });
                sidesTimer = setTimeout(() => {
                    burst({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
                    burst({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
                }, 350);
            }).catch(console.error);

            return () => {
                active = false;
                if (sidesTimer) clearTimeout(sidesTimer);
            };
        }
    }, [page?.id, page?.confettiEnabled]);

    const LogoBanner = () => (
        <div className="flex justify-center">
            {logoUrl ? (
                <div className="relative h-10 w-40 sm:h-12 sm:w-48">
                    <Image src={logoUrl} alt="Logo" fill sizes="(max-width: 640px) 160px, 192px" className="object-contain" />
                </div>
            ) : (
                <Building2 className="h-10 w-10 sm:h-12 sm:w-12 text-primary/40" />
            )}
        </div>
    );

    const ResubmitButton = () => {
        if (!allowResubmission) return null;
        return (
            <div className="mt-10 flex justify-center">
                <Button 
                    asChild
                    variant="outline" 
                    size="lg" 
                    className="rounded-xl font-semibold gap-2"
                >
                    <a href={`/surveys/${survey.slug}`}>
                        <RotateCcw className="h-4 w-4" />
                        Submit Another Response
                    </a>
                </Button>
            </div>
        );
    };

    const renderSimulationBar = () => {
        if (!preview) return null;
        return (
            <div className="fixed top-0 left-0 w-full z-50 bg-slate-900 border-b border-slate-800 text-white px-4 py-3 shadow-md flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Simulation Mode</span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                        {survey.title}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400">Simulate Entity:</span>
                        {entities.length > 0 ? (
                            <Select value={selectedEntityId} onValueChange={handleEntityChange}>
                                <SelectTrigger className="w-[180px] h-8 bg-slate-800 border-slate-700 text-white rounded-lg text-xs font-semibold focus:ring-0 focus:ring-offset-0">
                                    <SelectValue placeholder="Select Entity" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700 text-white rounded-xl">
                                    {entities.map((e) => (
                                        <SelectItem key={e.id} value={e.id} className="text-xs focus:bg-slate-700 focus:text-white rounded-lg">
                                            {e.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <span className="text-xs text-slate-500 italic">No workspace entities found</span>
                        )}
                    </div>

                    {selectedEntityId !== 'none' && activeContacts.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-400">Contact:</span>
                            <Select value={selectedContactEmail} onValueChange={setSelectedContactEmail}>
                                <SelectTrigger className="w-[180px] h-8 bg-slate-800 border-slate-700 text-white rounded-lg text-xs font-semibold focus:ring-0 focus:ring-offset-0">
                                    <SelectValue placeholder="Select Contact" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700 text-white rounded-xl">
                                    {activeContacts.map((c: any) => (
                                        <SelectItem key={c.email || c.phone} value={c.email} className="text-xs focus:bg-slate-700 focus:text-white rounded-lg">
                                            {c.name} ({c.typeLabel || c.typeKey || 'Contact'})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (!page) {
        return (
            <>
                {renderSimulationBar()}
                <div className={cn("text-center py-16 sm:py-20 bg-card rounded-2xl shadow-xl border border-border/50 p-6 sm:p-10", preview && "mt-16")}>
                    <div className="mb-8">
                        <LogoBanner />
                    </div>
                    <div className="space-y-6 max-w-2xl mx-auto">
                        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground leading-tight whitespace-pre-wrap">
                            {survey.thankYouTitle || 'Thank you!'}
                        </h1>
                        <div 
                            className="text-lg sm:text-xl text-muted-foreground leading-relaxed font-medium whitespace-pre-wrap prose prose-slate max-w-none" 
                            dangerouslySetInnerHTML={{ __html: survey.thankYouDescription || 'Your submission has been securely processed.' }} 
                        />
                    </div>
                    <ResubmitButton />
                </div>
            </>
        );
    }

    return (
        <>
            {renderSimulationBar()}
            <div className={cn("animate-in fade-in slide-in-from-bottom-4 duration-1000", preview && "pt-16")}>
                <div className="flex justify-center mb-8 sm:mb-12">
                    <LogoBanner />
                </div>
                <div className="space-y-4 sm:space-y-5">
                    {page.blocks.map(block => (
                        <BlockRenderer 
                            key={block.id} 
                            block={block} 
                            score={response.score || 0} 
                            maxScore={survey.maxScore || 100} 
                            displayMode={survey.scoreDisplayMode}
                            surveyId={survey.id}
                            responseId={response.id}
                            entityId={preview && selectedEntityId !== 'none' ? selectedEntityId : response.entityId}
                            resultPages={resultPages}
                            survey={survey}
                            simulatedValues={simulatedValues}
                        />
                    ))}
                </div>
                <ResubmitButton />
            </div>
        </>
    );
}
