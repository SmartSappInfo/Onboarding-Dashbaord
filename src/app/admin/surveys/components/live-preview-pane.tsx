
'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone, Layout, ArrowRight, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartSappLogo } from '@/components/icons';
import VideoHero from '@/components/video-hero';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function LivePreviewPane() {
    const { watch } = useFormContext();
    const [device, setDevice] = React.useState<'desktop' | 'mobile'>('desktop');

    const watchedValues = watch();
    const { 
        title, 
        description, 
        logoUrl, 
        bannerImageUrl, 
        videoUrl, 
        videoThumbnailUrl, 
        videoCaption,
        backgroundColor, 
        backgroundPattern, 
        patternColor,
        startButtonText,
        showCoverPage
    } = watchedValues;

    const BackgroundPattern = () => {
        if (!backgroundPattern || backgroundPattern === 'none') return null;
        return (
            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ color: patternColor }}>
                {backgroundPattern === 'dots' && (
                    <svg width="100%" height="100%"><defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="currentColor" /></pattern></defs><rect width="100%" height="100%" fill="url(#dots)" /></svg>
                )}
                {backgroundPattern === 'grid' && (
                    <svg width="100%" height="100%"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#grid)" /></svg>
                )}
                {backgroundPattern === 'gradient' && <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />}
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-slate-100 rounded-[2.5rem] border shadow-inner overflow-hidden animate-in fade-in duration-700">
            <div className="p-4 border-b bg-background flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Layout className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Live Simulation</span>
                </div>
                <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border">
                    <button 
                        type="button"
                        onClick={() => setDevice('desktop')}
                        className={cn("p-2 rounded-lg transition-all", device === 'desktop' ? "bg-white shadow-sm text-primary" : "text-muted-foreground opacity-40")}
                    >
                        <Monitor className="h-3.5 w-3.5" />
                    </button>
                    <button 
                        type="button"
                        onClick={() => setDevice('mobile')}
                        className={cn("p-2 rounded-lg transition-all", device === 'mobile' ? "bg-white shadow-sm text-primary" : "text-muted-foreground opacity-40")}
                    >
                        <Smartphone className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-8 flex justify-center">
                <div 
                    className={cn(
                        "transition-all duration-700 bg-white shadow-2xl rounded-[3rem] overflow-hidden relative ring-1 ring-black/5",
                        device === 'mobile' ? "w-[375px] h-[667px]" : "w-full h-full max-w-4xl"
                    )}
                    style={{ backgroundColor: backgroundColor || '#F1F5F9' }}
                >
                    <BackgroundPattern />
                    
                    <ScrollArea className="h-full w-full">
                        <div className="p-8 sm:p-12 space-y-10 text-center relative z-10">
                            {/* Logo */}
                            <div className="flex justify-center">
                                {logoUrl ? (
                                    <div className="relative h-10 w-40"><img src={logoUrl} alt="logo" className="object-contain w-full h-full" /></div>
                                ) : <SmartSappLogo className="h-8" />}
                            </div>

                            {/* Hero Content */}
                            {videoUrl ? (
                                <div className="space-y-6">
                                    <VideoHero 
                                        videoUrl={videoUrl} 
                                        thumbnailUrl={videoThumbnailUrl} 
                                        title={title} 
                                    />
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary animate-pulse">
                                            {videoCaption || 'Click to watch video'}
                                        </span>
                                    </div>
                                </div>
                            ) : bannerImageUrl ? (
                                <div className="relative aspect-video rounded-[2rem] overflow-hidden shadow-xl border-4 border-white bg-white">
                                    <img src={bannerImageUrl} alt="banner" className="w-full h-full object-cover" />
                                </div>
                            ) : null}

                            {/* Text Content */}
                            <div className="space-y-4 max-w-2xl mx-auto">
                                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground leading-tight uppercase">{title || 'Your Survey Title'}</h1>
                                <p className="text-base sm:text-lg text-muted-foreground font-medium leading-relaxed italic">{description || 'Explain why this audit matters to your community.'}</p>
                            </div>

                            {/* Call to Action */}
                            <div className="pt-4 flex justify-center">
                                <Button type="button" size="lg" className="h-14 px-10 rounded-2xl font-black text-lg shadow-2xl gap-3 transition-all hover:scale-105 uppercase tracking-widest">
                                    {startButtonText || "Let's Start"} <ArrowRight className="h-6 w-6" />
                                </Button>
                            </div>
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}
