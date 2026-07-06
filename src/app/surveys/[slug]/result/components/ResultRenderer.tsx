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

interface ResultRendererProps {
    survey: Survey;
    response: SurveyResponse;
    page: SurveyResultPage | null;
    logoUrl?: string | null;
    allowResubmission?: boolean;
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

function BlockRenderer({ block, score, maxScore, displayMode }: { block: SurveyResultBlock, score: number, maxScore: number, displayMode?: 'points' | 'percentage' }) {
    const alignment = block.style?.textAlign || 'left';
    
    const containerClasses = cn(
        "w-full my-5 sm:my-6 px-2 sm:px-0",
        alignment === 'center' && "text-center flex flex-col items-center",
        alignment === 'right' && "text-right flex flex-col items-end",
        alignment === 'justify' && "text-justify"
    );

    switch (block.type) {
        case 'heading': {
            const Tag = block.variant || 'h2';
            const sizeClass = Tag === 'h1' ? "text-3xl sm:text-4xl font-bold" : Tag === 'h3' ? "text-xl font-bold" : "text-2xl font-bold";
            return (
                <Tag 
                    className={cn(sizeClass, "tracking-tight whitespace-pre-wrap", containerClasses)} 
                    style={{ color: block.style?.color }}
                >
                    {block.title}
                </Tag>
            );
        }
        case 'text':
            return <div className={cn("prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-muted-foreground leading-relaxed whitespace-pre-wrap", containerClasses)}>{block.content || ''}</div>;
        case 'list':
            return (
                <div className={containerClasses}>
                    {block.listStyle === 'ordered' ? (
                        <ol className="list-decimal list-inside space-y-3 text-lg font-medium text-slate-700 dark:text-slate-300 text-left">
                            {block.items?.map((item, i) => <li key={i}>{item}</li>)}
                        </ol>
                    ) : (
                        <ul className="list-disc list-inside space-y-3 text-lg font-medium text-slate-700 dark:text-slate-300 text-left">
                            {block.items?.map((item, i) => <li key={i}>{item}</li>)}
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
                    <Button 
                        asChild 
                        size="lg" 
                        variant={block.style?.variant as 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | null | undefined} 
                        className="h-12 px-8 text-base font-bold rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 w-full sm:w-auto uppercase tracking-wide"
                    >
                        <a href={block.link || '#'} target={block.openInNewTab ? "_blank" : "_self"} rel="noopener noreferrer">
                            {block.title} <ArrowRight className="ml-2 h-5 w-5" />
                        </a>
                    </Button>
                </div>
            );
        case 'quote':
            return (
                <div className={cn("p-6 sm:p-8 bg-muted/50 border-l-4 border-primary rounded-r-2xl italic text-lg sm:text-xl whitespace-pre-wrap", containerClasses)}>
                    <Quote className="h-6 w-6 sm:h-8 sm:w-8 text-primary/20 mb-4" />
                    {block.content}
                </div>
            );
        case 'divider':
            return <hr className="w-full my-8 border-t-2 border-border/30" />;
        case 'score-card':
            return <ScoreCard score={score} maxScore={maxScore} style={block.style} displayMode={displayMode} />;
        default:
            return null;
    }
}

export default function ResultRenderer({ survey, response, page, logoUrl, allowResubmission }: ResultRendererProps) {
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

    if (!page) {
        return (
            <div className="text-center py-16 sm:py-20 bg-card rounded-2xl shadow-xl border border-border/50 p-6 sm:p-10">
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
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
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
                    />
                ))}
            </div>
            <ResubmitButton />
        </div>
    );
}
