'use client';

import * as React from 'react';
import type { Survey, SurveyResponse, SurveyResultPage, SurveyResultBlock } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Quote, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import Image from 'next/image';
import VideoEmbed from '@/components/video-embed';
import { SmartSappLogo } from '@/components/icons';
import { Badge } from '@/components/ui/badge';

interface ResultRendererProps {
    survey: Survey;
    response: SurveyResponse;
    page: SurveyResultPage | null;
}

function ScoreCard({ score, maxScore, style }: { score: number, maxScore: number, style?: any }) {
    const [displayScore, setDisplayScore] = React.useState(0);
    const hasCelebrated = React.useRef(false);

    React.useEffect(() => {
        let start = 0;
        const duration = 2000;
        const increment = score / (duration / 16);
        
        const timer = setInterval(() => {
            start += increment;
            if (start >= score) {
                setDisplayScore(score);
                clearInterval(timer);
                if (!hasCelebrated.current && style?.animate !== false) {
                    confetti({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: ['#3B5FFF', '#f72585', '#7209b7']
                    });
                    hasCelebrated.current = true;
                }
            } else {
                setDisplayScore(Math.floor(start));
            }
        }, 16);

        return () => clearInterval(timer);
    }, [score, style?.animate]);

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
                <Badge variant="outline" className="mb-6 sm:mb-8 bg-white/10 text-white border-white/20 px-4 py-1.5 text-xs font-bold tracking-widest uppercase">Your Result</Badge>
                
                <div className="flex flex-col gap-1">
                    <span className="text-6xl sm:text-7xl md:text-8xl font-bold tabular-nums tracking-tighter">
                        {displayScore}
                    </span>
                    <span className="text-base sm:text-lg font-bold opacity-60 uppercase tracking-wide">out of {maxScore} points</span>
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

function BlockRenderer({ block, score, maxScore }: { block: SurveyResultBlock, score: number, maxScore: number }) {
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
            return <div className={cn("prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-muted-foreground leading-relaxed whitespace-pre-wrap", containerClasses)} dangerouslySetInnerHTML={{ __html: block.content || '' }} />;
        case 'list':
            return (
                <div className={containerClasses}>
                    {block.listStyle === 'ordered' ? (
                        <ol className="list-decimal list-inside space-y-3 text-lg font-medium text-slate-700 dark:text-slate-300 text-left">
                            {block.items?.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: item }} />)}
                        </ol>
                    ) : (
                        <ul className="list-disc list-inside space-y-3 text-lg font-medium text-slate-700 dark:text-slate-300 text-left">
                            {block.items?.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: item }} />)}
                        </ul>
                    )}
                </div>
            );
        case 'image':
            return block.url ? (
                <div className={cn("relative aspect-video rounded-xl sm:rounded-2xl overflow-hidden shadow-lg border bg-white", containerClasses)}>
                    <Image src={block.url} alt="Result content" fill className="object-cover" />
                </div>
            ) : null;
        case 'video':
            return block.url ? <div className={containerClasses}><VideoEmbed url={block.url} /></div> : null;
        case 'button':
            return (
                <div className={containerClasses}>
                    <Button 
                        asChild 
                        size="lg" 
                        variant={block.style?.variant as any} 
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
            return <hr className="w-full my-8 border-t-2 border-slate-200" />;
        case 'score-card':
            return <ScoreCard score={score} maxScore={maxScore} style={block.style} />;
        default:
            return null;
    }
}

export default function ResultRenderer({ survey, response, page }: ResultRendererProps) {
    if (!page) {
        return (
            <div className="text-center py-16 sm:py-20 bg-white rounded-2xl shadow-xl border p-6 sm:p-10">
                <div className="flex justify-center">
                    <SmartSappLogo className="h-10 sm:h-12 mb-8" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-4">{survey.thankYouTitle || 'Thank You!'}</h1>
                <p className="text-lg sm:text-xl text-muted-foreground">{survey.thankYouDescription || 'Your response has been recorded.'}</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex justify-center mb-8 sm:mb-12">
                <SmartSappLogo className="h-8 sm:h-10 opacity-50 grayscale hover:opacity-100 transition-all cursor-pointer" />
            </div>
            <div className="space-y-4 sm:space-y-5">
                {page.blocks.map(block => (
                    <BlockRenderer 
                        key={block.id} 
                        block={block} 
                        score={response.score || 0} 
                        maxScore={survey.maxScore || 100} 
                    />
                ))}
            </div>
        </div>
    );
}