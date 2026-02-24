
'use client';

import * as React from 'react';
import type { Survey, SurveyResponse, SurveyResultPage, SurveyResultBlock } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Quote, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import Image from 'next/image';
import VideoEmbed from '@/components/video-embed';
import { SmartSappLogo } from '@/components/icons';

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
        <Card className="relative overflow-hidden bg-primary text-white border-none shadow-2xl rounded-3xl p-8 my-12">
            <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -right-12 -top-12 opacity-10"
            >
                <Trophy size={200} />
            </motion.div>
            
            <CardContent className="relative z-10 flex flex-col items-center text-center">
                <Badge variant="outline" className="mb-6 bg-white/10 text-white border-white/20 px-4 py-1 text-xs font-black tracking-widest uppercase">Your Result</Badge>
                
                <div className="flex flex-col gap-1">
                    <span className="text-7xl sm:text-9xl font-black tabular-nums tracking-tighter">
                        {displayScore}
                    </span>
                    <span className="text-xl sm:text-2xl font-bold opacity-60">out of {maxScore} points</span>
                </div>

                <>
                    <div className="mt-8 w-full h-2 bg-white/20 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(score / maxScore) * 100}%` }}
                            transition={{ duration: 2, ease: "easeOut" }}
                            className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                        />
                    </div>
                    <p className="mt-4 text-sm font-medium text-white/80">
                        That&apos;s better than {Math.round((score / maxScore) * 100 * 0.8)}% of other respondents!
                    </p>
                </>
            </CardContent>
        </Card>
    );
}

function BlockRenderer({ block, score, maxScore }: { block: SurveyResultBlock, score: number, maxScore: number }) {
    const alignment = block.style?.textAlign || 'left';
    
    const containerClasses = cn(
        "w-full my-6",
        alignment === 'center' && "text-center flex flex-col items-center",
        alignment === 'right' && "text-right flex flex-col items-end"
    );

    switch (block.type) {
        case 'heading':
            return <h2 className={cn("text-3xl font-black tracking-tight", containerClasses)} style={{ color: block.style?.color }}>{block.title}</h2>;
        case 'text':
            return <div className={cn("prose prose-slate dark:prose-invert max-w-none text-lg text-muted-foreground leading-relaxed", containerClasses)} dangerouslySetInnerHTML={{ __html: block.content || '' }} />;
        case 'image':
            return block.url ? (
                <div className={cn("relative aspect-video rounded-2xl overflow-hidden shadow-lg border bg-white", containerClasses)}>
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
                        className="h-14 px-8 text-lg font-black rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95"
                    >
                        <a href={block.link || '#'} target={block.openInNewTab ? "_blank" : "_self"} rel="noopener noreferrer">
                            {block.title} <ArrowRight className="ml-2 h-5 w-5" />
                        </a>
                    </Button>
                </div>
            );
        case 'quote':
            return (
                <div className={cn("p-8 bg-muted/50 border-l-4 border-primary rounded-r-2xl italic text-xl", containerClasses)}>
                    <Quote className="h-8 w-8 text-primary/20 mb-4" />
                    {block.content}
                </div>
            );
        case 'divider':
            return <Separator className="my-12" />;
        case 'score-card':
            return <ScoreCard score={score} maxScore={maxScore} style={block.style} />;
        default:
            return null;
    }
}

export default function ResultRenderer({ survey, response, page }: ResultRendererProps) {
    if (!page) {
        return (
            <div className="text-center py-20 bg-white rounded-2xl shadow-xl border p-8">
                <div className="flex justify-center">
                    <SmartSappLogo className="h-12 mb-8" />
                </div>
                <h1 className="text-4xl font-black mb-4">{survey.thankYouTitle || 'Thank You!'}</h1>
                <p className="text-xl text-muted-foreground">{survey.thankYouDescription || 'Your response has been recorded.'}</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex justify-center mb-12">
                <SmartSappLogo className="h-10 opacity-50 grayscale hover:opacity-100 transition-all cursor-pointer" />
            </div>
            {page.blocks.map(block => (
                <BlockRenderer 
                    key={block.id} 
                    block={block} 
                    score={response.score || 0} 
                    maxScore={survey.maxScore || 100} 
                />
            ))}
        </div>
    );
}
