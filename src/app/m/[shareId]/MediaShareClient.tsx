'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { 
    Music, Link2, Download, ExternalLink, 
    Play, Pause, Volume2, ArrowRight, ChevronRight, X 
} from 'lucide-react';
import type { MediaAsset, OrgBranding } from '@/lib/types';
import Footer from '@/components/footer';

interface MediaShareClientProps {
    asset: MediaAsset;
    title: string;
    description: string;
    ctaText: string;
    ctaTargetUrl: string;
    ctaType: 'none' | 'survey' | 'form' | 'page' | 'external';
    ctaMode: 'modal' | 'redirect' | 'replace';
    ctaPretext: string;
    orgBranding: OrgBranding | null;
    isEmbed: boolean;
    searchParams: Record<string, string>;
}

export default function MediaShareClient({
    asset,
    title,
    description,
    ctaText,
    ctaTargetUrl,
    ctaType,
    ctaMode,
    ctaPretext,
    orgBranding,
    isEmbed,
    searchParams,
}: MediaShareClientProps) {
    const [isPlaying, setIsPlaying] = React.useState(false);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [volume, setVolume] = React.useState(0.8);
    const [isCtaModalOpen, setIsCtaModalOpen] = React.useState(false);
    const [isVideoPlaying, setIsVideoPlaying] = React.useState(false);

    // Audio handlers
    const toggleAudioPlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleAudioTimeUpdate = () => {
        if (!audioRef.current) return;
        setCurrentTime(audioRef.current.currentTime);
    };

    const handleAudioLoadedMetadata = () => {
        if (!audioRef.current) return;
        setDuration(audioRef.current.duration);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (audioRef.current) {
            audioRef.current.volume = val;
        }
    };

    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Embed parser helper for third-party videos
    const parseEmbedUrl = (url: string) => {
        if (!url) return { isEmbeddable: false, embedUrl: null };
        const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const ytMatch = url.match(ytRegex);
        if (ytMatch) {
            return { isEmbeddable: true, embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };
        }
        const vimeoRegex = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)(?:$|\/|\?)/;
        const vimeoMatch = url.match(vimeoRegex);
        if (vimeoMatch) {
            return { isEmbeddable: true, embedUrl: `https://player.vimeo.com/video/${vimeoMatch[3]}` };
        }
        const loomRegex = /loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/;
        const loomMatch = url.match(loomRegex);
        if (loomMatch) {
            return { isEmbeddable: true, embedUrl: `https://www.loom.com/embed/${loomMatch[1]}` };
        }
        return { isEmbeddable: false, embedUrl: null };
    };

    const { isEmbeddable, embedUrl } = parseEmbedUrl(asset.url);

    // YouTube / Vimeo preview image resolve
    const videoId = React.useMemo(() => {
        const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = asset.url.match(ytRegex);
        return match ? match[1] : null;
    }, [asset.url]);

    const [thumbUrl, setThumbUrl] = React.useState<string | null>(asset.previewImageUrl || null);

    React.useEffect(() => {
        if (asset.previewImageUrl) {
            setThumbUrl(asset.previewImageUrl);
        } else if (videoId) {
            setThumbUrl(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
        }
    }, [videoId, asset.previewImageUrl]);

    // Call-To-Action Link Resolver with query params propagation
    const getFinalCtaUrl = () => {
        if (!ctaTargetUrl) return '';
        try {
            const urlObj = ctaTargetUrl.startsWith('http')
                ? new URL(ctaTargetUrl)
                : new URL(ctaTargetUrl, window.location.origin);

            // Copy forward search params
            Object.entries(searchParams).forEach(([key, val]) => {
                if (key !== 'embed') {
                    urlObj.searchParams.set(key, val);
                }
            });

            return urlObj.toString();
        } catch {
            return ctaTargetUrl;
        }
    };

    const handleCtaClick = () => {
        if (ctaType === 'none' || !ctaTargetUrl) return;
        const finalUrl = getFinalCtaUrl();

        if (ctaMode === 'modal') {
            setIsCtaModalOpen(true);
        } else if (ctaMode === 'replace') {
            window.location.href = finalUrl;
        } else {
            window.open(finalUrl, '_blank');
        }
    };

    const fallbackInitials = (orgBranding?.name || 'Workspace').substring(0, 2).toUpperCase();

    // Render 1: Chromeless Iframe Embed Mode
    if (isEmbed) {
        return (
            <div className="w-full h-full min-h-screen bg-[#0B0F19] text-white flex flex-col justify-between overflow-hidden relative group">
                <div className="flex-1 w-full h-full relative flex items-center justify-center">
                    {asset.type === 'image' && (
                        <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
                            <img
                                src={asset.url}
                                alt={title}
                                className="max-w-full max-h-full object-contain"
                            />
                        </div>
                    )}

                    {asset.type === 'video' && (
                        !isVideoPlaying ? (
                            <div 
                                onClick={() => setIsVideoPlaying(true)}
                                className="relative w-full h-full bg-[#0B0F19] flex items-center justify-center cursor-pointer overflow-hidden"
                            >
                                {thumbUrl ? (
                                    <img
                                        src={thumbUrl}
                                        alt={title}
                                        className="absolute inset-0 w-full h-full object-cover opacity-80"
                                    />
                                ) : (
                                    <video
                                        src={asset.url}
                                        preload="metadata"
                                        className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
                                    />
                                )}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                    <div className="relative">
                                        <div className="absolute inset-0 rounded-full bg-primary/35 animate-ping" />
                                        <div className="absolute -inset-4 rounded-full bg-primary/20 animate-pulse duration-1000" />
                                        <div className="relative h-16 w-16 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(59,95,255,0.4)]">
                                            <Play className="w-8 h-8 fill-current ml-1" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            isEmbeddable && embedUrl ? (
                                <iframe
                                    src={`${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1`}
                                    className="w-full h-full border-none"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            ) : (
                                <video
                                    src={asset.url}
                                    controls
                                    autoPlay
                                    className="w-full h-full object-contain"
                                />
                            )
                        )
                    )}

                    {asset.type === 'audio' && (
                        <div className="p-8 w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl backdrop-blur-xl flex flex-col items-center gap-4">
                            <audio
                                ref={audioRef}
                                src={asset.url}
                                onTimeUpdate={handleAudioTimeUpdate}
                                onLoadedMetadata={handleAudioLoadedMetadata}
                            />
                            <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                                <Music className="h-8 w-8" />
                            </div>
                            <h4 className="text-sm font-bold truncate text-center w-full">{title}</h4>
                            <div className="flex items-center gap-3 w-full mt-2">
                                <button
                                    onClick={toggleAudioPlay}
                                    className="p-3 bg-primary text-white rounded-xl active:scale-95 transition-all"
                                >
                                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                </button>
                                <div className="flex-1 space-y-1">
                                    <div className="relative w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className="absolute left-0 top-0 h-full bg-primary transition-all duration-100"
                                            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                                        <span>{formatTime(currentTime)}</span>
                                        <span>{formatTime(duration)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {asset.type === 'document' && (
                        <iframe
                            src={
                                asset.url.endsWith('.pdf')
                                    ? asset.url
                                    : `https://docs.google.com/gview?url=${encodeURIComponent(asset.url)}&embedded=true`
                            }
                            className="w-full h-full border-none bg-white"
                        />
                    )}

                    {asset.type === 'link' && (
                        <div className="p-6 max-w-sm bg-slate-900/80 border border-slate-800 rounded-3xl text-center space-y-4">
                            <div className="p-3 bg-muted rounded-2xl w-fit mx-auto">
                                <Link2 className="h-6 w-6 text-primary" />
                            </div>
                            <h4 className="text-sm font-black truncate">{title}</h4>
                            <p className="text-xs text-muted-foreground truncate w-full">{asset.url}</p>
                            <Button size="sm" onClick={() => window.open(asset.url, '_blank')} className="rounded-xl w-full text-xs font-bold gap-2">
                                Open Reference Link <ExternalLink className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Overlaid Title/CTA Bar on Hover */}
                <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto">
                    <div className="truncate pr-4 text-left">
                        <p className="text-xs font-bold truncate">{title}</p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{description}</p>
                    </div>
                    {ctaType !== 'none' && (
                        <Button 
                            size="sm" 
                            onClick={handleCtaClick} 
                            className="rounded-xl text-[10px] font-black h-8 px-4 bg-primary text-white hover:bg-primary/90 flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                            {ctaText || 'Get Started'} <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>

                {/* Render the iframe modal inside embed frame */}
                {isCtaModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
                        <div className="relative w-full max-w-4xl h-[90vh] bg-[#070913] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                            <div className="p-4 border-b border-slate-900 flex justify-between items-center bg-[#070913]">
                                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Target Action Window</h3>
                                <button
                                    onClick={() => setIsCtaModalOpen(false)}
                                    className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-slate-100 text-[10px] font-bold flex items-center gap-1"
                                >
                                    <X className="h-3.5 w-3.5" /> Close
                                </button>
                            </div>
                            <div className="flex-1 w-full bg-white relative">
                                <iframe src={getFinalCtaUrl()} className="w-full h-full border-none" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Render 2: Premium Public Media Viewing Page Layout
    return (
        <div className="min-h-screen bg-[#070913] text-slate-100 flex flex-col font-sans selection:bg-primary selection:text-white">
            {/* Header Banner */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-900 bg-[#070913]/80 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <a
                        href={orgBranding?.website || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 hover:opacity-85 transition-opacity"
                    >
                        {orgBranding?.logoUrl ? (
                            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-800">
                                <img
                                    src={orgBranding.logoUrl}
                                    alt={orgBranding.name || 'Organization Logo'}
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        ) : (
                            <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-primary font-black text-xs">
                                {fallbackInitials}
                            </div>
                        )}
                        <span className="font-extrabold text-sm tracking-tight text-slate-200">
                            {orgBranding?.name || 'Workspace Media Hub'}
                        </span>
                    </a>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(asset.url, '_blank')}
                        className="rounded-xl text-xs font-black text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-slate-800/40 gap-1.5 h-9 cursor-pointer"
                    >
                        <Download className="h-3.5 w-3.5" /> Direct Download
                    </Button>
                </div>
            </header>

            {/* Main Visual Arena */}
            <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 md:py-12 flex flex-col items-center gap-8 text-center">
                {/* 1. Typography and Meta Context - NOW AT THE TOP */}
                <div className="w-full max-w-3xl space-y-3">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-50 leading-tight whitespace-pre-line">
                        {title}
                    </h1>
                    {description && (
                        <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed whitespace-pre-line">
                            {description}
                        </p>
                    )}
                </div>

                {/* 2. Media Presentation Viewport - IN THE MIDDLE */}
                <div className="w-full relative rounded-[2rem] border border-slate-900 bg-slate-950/40 shadow-2xl overflow-hidden min-h-[300px] md:min-h-[500px] flex items-center justify-center">
                    {/* Glowing Accent Backdrop */}
                    <div className="absolute -inset-10 bg-gradient-to-tr from-primary/10 via-transparent to-primary/5 blur-3xl opacity-40 pointer-events-none" />

                    {asset.type === 'image' && (
                        <div className="relative w-full aspect-video md:aspect-[16/9] group/view flex items-center justify-center bg-slate-950">
                            <img
                                src={asset.url}
                                alt={title}
                                className="max-w-full max-h-full object-contain rounded-2xl transition-transform duration-500 group-hover/view:scale-[1.01]"
                            />
                        </div>
                    )}

                    {asset.type === 'video' && (
                        !isVideoPlaying ? (
                            <div 
                                onClick={() => setIsVideoPlaying(true)}
                                className="relative w-full aspect-video md:aspect-[16/9] bg-slate-950 group cursor-pointer flex items-center justify-center overflow-hidden z-10"
                            >
                                {thumbUrl ? (
                                    <img
                                        src={thumbUrl}
                                        alt={title}
                                        className="absolute inset-0 w-full h-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
                                    />
                                ) : (
                                    <video
                                        src={asset.url}
                                        preload="metadata"
                                        className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
                                    />
                                )}
                                
                                {/* Animated Premium Play Button */}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <div className="relative">
                                        <div className="absolute inset-0 rounded-full bg-primary/35 animate-ping" />
                                        <div className="absolute -inset-4 rounded-full bg-primary/20 animate-pulse duration-1000" />
                                        <div className="relative h-20 w-20 sm:h-24 sm:w-24 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(59,95,255,0.4)] transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_60px_rgba(59,95,255,0.6)]">
                                            <Play className="w-10 h-10 sm:w-12 sm:h-12 fill-current ml-1" />
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute bottom-6 left-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-left">
                                    <p className="text-white text-xs font-black uppercase tracking-wider drop-shadow-md">Click to play video</p>
                                </div>
                            </div>
                        ) : (
                            isEmbeddable && embedUrl ? (
                                <div className="w-full aspect-video md:aspect-[16/9] relative z-10">
                                    <iframe
                                        src={`${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1`}
                                        className="w-full h-full border-none"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                            ) : (
                                <div className="w-full aspect-video md:aspect-[16/9] relative z-10 flex items-center justify-center bg-slate-950">
                                    <video
                                        src={asset.url}
                                        controls
                                        autoPlay
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            )
                        )
                    )}

                    {asset.type === 'audio' && (
                        <div className="p-8 md:p-12 w-full max-w-lg relative z-10 space-y-6">
                            <audio
                                ref={audioRef}
                                src={asset.url}
                                onTimeUpdate={handleAudioTimeUpdate}
                                onLoadedMetadata={handleAudioLoadedMetadata}
                            />
                            
                            <div className="mx-auto w-24 h-24 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center text-primary shadow-xl shadow-primary/5 relative">
                                <div className="absolute inset-0 bg-primary/5 rounded-full animate-ping opacity-60" />
                                <Music className="h-10 w-10 relative z-10" />
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-lg font-black tracking-tight text-slate-100">{title}</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Audio Broadcast File</p>
                            </div>

                            {/* Soundwave graphic animation */}
                            <div className="flex items-center justify-center gap-1 h-6 py-1">
                                {[...Array(12)].map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={`w-1 bg-primary/80 rounded-full transition-all duration-300 ${isPlaying ? 'animate-pulse' : 'h-1.5'}`}
                                        style={{ 
                                            height: isPlaying ? `${Math.max(15, Math.sin(i + currentTime) * 24)}px` : '6px',
                                            animationDelay: `${i * 100}ms`
                                        }}
                                    />
                                ))}
                            </div>

                            <div className="flex items-center gap-4 bg-slate-900/40 border border-slate-800/60 p-4 rounded-2xl backdrop-blur-md">
                                <button
                                    onClick={toggleAudioPlay}
                                    className="p-3 bg-primary text-white rounded-xl active:scale-95 transition-all hover:bg-primary/90 shadow-lg shadow-primary/20 cursor-pointer"
                                >
                                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                                </button>

                                <div className="flex-1 space-y-2 text-left">
                                    <div className="relative w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className="absolute left-0 top-0 h-full bg-primary transition-all duration-100"
                                            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                        <span>{formatTime(currentTime)}</span>
                                        <span>{formatTime(duration)}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
                                    <Volume2 className="h-4 w-4 text-slate-500" />
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={volume}
                                        onChange={handleVolumeChange}
                                        className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {asset.type === 'document' && (
                        <div className="w-full aspect-video md:aspect-[16/9] relative z-10 bg-slate-950 flex flex-col">
                            <iframe
                                src={
                                    asset.url.endsWith('.pdf')
                                        ? asset.url
                                        : `https://docs.google.com/gview?url=${encodeURIComponent(asset.url)}&embedded=true`
                                }
                                className="w-full flex-1 border-none bg-white"
                            />
                        </div>
                    )}

                    {asset.type === 'link' && (
                        <div className="p-8 md:p-12 w-full max-w-md relative z-10 space-y-6">
                            <div className="mx-auto w-16 h-16 bg-muted rounded-2xl flex items-center justify-center text-primary shadow-lg border border-border">
                                <Link2 className="h-7 w-7" />
                            </div>
                            <div className="space-y-1.5">
                                <h3 className="text-lg font-black text-slate-100 leading-tight">{title}</h3>
                                <p className="text-xs text-slate-400 font-medium truncate w-full px-4">{asset.url}</p>
                            </div>
                            <Button 
                                onClick={() => window.open(asset.url, '_blank')} 
                                className="w-full h-11 rounded-xl text-xs font-bold gap-2 bg-slate-900 border hover:bg-slate-800 cursor-pointer"
                            >
                                Navigate to Link <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* 3. CTA Pre-text & CTA Button Layout - AT THE BOTTOM */}
                {ctaType !== 'none' && (
                    <div className="w-full max-w-2xl space-y-5 flex flex-col items-center pt-2">
                        {ctaPretext && (
                            <p className="text-sm md:text-base text-slate-300 font-medium leading-relaxed whitespace-pre-line text-center max-w-xl">
                                {ctaPretext}
                            </p>
                        )}
                        <Button
                            onClick={handleCtaClick}
                            className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/95 hover:to-primary/85 text-white font-extrabold h-12 px-8 shadow-xl hover:shadow-primary/10 transition-all active:scale-[0.97] flex items-center gap-2 group text-xs tracking-wider uppercase cursor-pointer"
                        >
                            {ctaText || 'Get Started'}
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                    </div>
                )}
            </main>

            {/* Custom Brand Footer */}
            <Footer orgBranding={orgBranding} className="w-full mt-auto" />

            {/* Render the iframe modal inside public landing layout */}
            {isCtaModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
                    <div className="relative w-full max-w-4xl h-[90vh] bg-[#070913] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-900 flex justify-between items-center bg-[#070913]">
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Action View</h3>
                            <button
                                onClick={() => setIsCtaModalOpen(false)}
                                className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-slate-100 text-xs font-bold flex items-center gap-1"
                            >
                                <X className="h-4 w-4" /> Close Window
                            </button>
                        </div>
                        <div className="flex-1 w-full bg-white relative">
                            <iframe src={getFinalCtaUrl()} className="w-full h-full border-none" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
