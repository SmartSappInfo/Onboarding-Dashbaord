'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { 
    Music, Link2, Download, ExternalLink, 
    Play, Pause, Volume2, ArrowRight, ChevronRight, X, Lock 
} from 'lucide-react';
import type { MediaAsset, OrgBranding } from '@/lib/types';
import Footer from '@/components/footer';
import { ThemeToggle } from '@/components/theme-toggle';
import { nanoid } from 'nanoid';
import { recordMediaPageEventAction } from '@/lib/media-analytics-actions';

interface MediaShareClientProps {
    shareId: string;
    asset: MediaAsset;
    title: string;
    description: string;
    ctaText: string;
    ctaTargetUrl: string;
    ctaType: 'none' | 'survey' | 'form' | 'page' | 'external';
    ctaMode: 'modal' | 'redirect' | 'replace';
    ctaPretext: string;
    ctaPopoverEnabled: boolean;
    ctaActivationGate?: 'immediate' | 'quarter' | 'half' | 'threequarters' | 'complete';
    orgBranding: OrgBranding | null;
    isEmbed: boolean;
    searchParams: Record<string, string>;
    contactId?: string;
}

export default function MediaShareClient({
    shareId,
    asset,
    title,
    description,
    ctaText,
    ctaTargetUrl,
    ctaType,
    ctaMode,
    ctaPretext,
    ctaPopoverEnabled,
    ctaActivationGate = 'immediate',
    orgBranding,
    isEmbed,
    searchParams,
    contactId,
}: MediaShareClientProps) {
    const [isPlaying, setIsPlaying] = React.useState(false);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const embedVideoRef = React.useRef<HTMLVideoElement | null>(null);
    
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [volume, setVolume] = React.useState(0.8);
    const [isCtaModalOpen, setIsCtaModalOpen] = React.useState(false);
    const [isVideoPlaying, setIsVideoPlaying] = React.useState(false);
    const [isPlaybackFinished, setIsPlaybackFinished] = React.useState(false);

    const sessionId = React.useMemo(() => nanoid(), []);
    const startTimeRef = React.useRef<number>(Date.now());
    const loggedPlay = React.useRef(false);
    const loggedQuarter = React.useRef(false);
    const loggedHalf = React.useRef(false);
    const loggedThreeQuarters = React.useRef(false);
    const loggedComplete = React.useRef(false);

    const logEvent = React.useCallback(async (
        type: 'view' | 'cta_click' | 'download' | 'media_play' | 'media_progress' | 'media_complete',
        progressPercent?: number
    ) => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        await recordMediaPageEventAction({
            shareId,
            workspaceId: asset.workspaceIds?.[0] || 'default',
            assetId: asset.id,
            type,
            sessionId,
            contactId,
            progressPercent,
            sessionTimeSeconds: elapsed,
        });
    }, [shareId, asset.id, asset.workspaceIds, sessionId, contactId]);

    React.useEffect(() => {
        logEvent('view');
    }, [logEvent]);

    React.useEffect(() => {
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            recordMediaPageEventAction({
                shareId,
                workspaceId: asset.workspaceIds?.[0] || 'default',
                assetId: asset.id,
                type: 'media_progress',
                sessionId,
                contactId,
                sessionTimeSeconds: elapsed,
            }).catch(() => {});
        }, 15000);

        return () => clearInterval(interval);
    }, [shareId, asset.id, asset.workspaceIds, sessionId, contactId]);

    React.useEffect(() => {
        const sendBeacon = () => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const payload = JSON.stringify({
                shareId,
                sessionId,
                elapsed,
                contactId: contactId || null,
            });
            
            if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
                navigator.sendBeacon('/api/media-tracker', new Blob([payload], { type: 'application/json' }));
            } else {
                fetch('/api/media-tracker', {
                    method: 'POST',
                    body: payload,
                    headers: { 'Content-Type': 'application/json' },
                    keepalive: true,
                }).catch(() => {});
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                sendBeacon();
            }
        };

        window.addEventListener('beforeunload', sendBeacon);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', sendBeacon);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [shareId, sessionId, contactId]);

    // Audio handlers
    const toggleAudioPlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            setIsPlaybackFinished(false);
            audioRef.current.play();
            if (!loggedPlay.current) {
                loggedPlay.current = true;
                logEvent('media_play');
            }
        }
        setIsPlaying(!isPlaying);
    };

    const handleAudioTimeUpdate = () => {
        if (!audioRef.current) return;
        const curr = audioRef.current.currentTime;
        const dur = audioRef.current.duration || 0;
        setCurrentTime(curr);

        if (dur > 0) {
            // 25% milestone
            if (curr >= dur * 0.25) {
                if (ctaActivationGate === 'quarter') {
                    setIsCtaUnlocked(true);
                }
                if (!loggedQuarter.current) {
                    loggedQuarter.current = true;
                    logEvent('media_progress', 25);
                }
            }
            // 50% milestone
            if (curr >= dur * 0.5) {
                if (ctaActivationGate === 'half') {
                    setIsCtaUnlocked(true);
                }
                if (!loggedHalf.current) {
                    loggedHalf.current = true;
                    logEvent('media_progress', 50);
                }
            }
            // 75% milestone
            if (curr >= dur * 0.75) {
                if (ctaActivationGate === 'threequarters') {
                    setIsCtaUnlocked(true);
                }
                if (!loggedThreeQuarters.current) {
                    loggedThreeQuarters.current = true;
                    logEvent('media_progress', 75);
                }
            }
        }
    };

    const handleAudioLoadedMetadata = () => {
        if (!audioRef.current) return;
        setDuration(audioRef.current.duration);
    };

    const handleAudioEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        setIsPlaybackFinished(true);
        if (ctaActivationGate === 'complete' || ctaActivationGate === 'threequarters' || ctaActivationGate === 'half' || ctaActivationGate === 'quarter') {
            setIsCtaUnlocked(true);
        }
        if (!loggedComplete.current) {
            loggedComplete.current = true;
            logEvent('media_complete');
            logEvent('media_progress', 100);
        }
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

    const [isCtaUnlocked, setIsCtaUnlocked] = React.useState(false);

    const shouldUnlockImmediately = React.useMemo(() => {
        return (
            ctaActivationGate === 'immediate' ||
            (asset.type !== 'video' && asset.type !== 'audio') ||
            (asset.type === 'video' && isEmbeddable)
        );
    }, [ctaActivationGate, asset.type, isEmbeddable]);

    React.useEffect(() => {
        if (shouldUnlockImmediately) {
            setIsCtaUnlocked(true);
        } else {
            setIsCtaUnlocked(false);
        }
    }, [shouldUnlockImmediately]);

    const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = e.currentTarget;
        const curr = video.currentTime;
        const dur = video.duration || 0;
        
        if (dur > 0) {
            // 25% milestone
            if (curr >= dur * 0.25) {
                if (ctaActivationGate === 'quarter') {
                    setIsCtaUnlocked(true);
                }
                if (!loggedQuarter.current) {
                    loggedQuarter.current = true;
                    logEvent('media_progress', 25);
                }
            }
            // 50% milestone
            if (curr >= dur * 0.5) {
                if (ctaActivationGate === 'half') {
                    setIsCtaUnlocked(true);
                }
                if (!loggedHalf.current) {
                    loggedHalf.current = true;
                    logEvent('media_progress', 50);
                }
            }
            // 75% milestone
            if (curr >= dur * 0.75) {
                if (ctaActivationGate === 'threequarters') {
                    setIsCtaUnlocked(true);
                }
                if (!loggedThreeQuarters.current) {
                    loggedThreeQuarters.current = true;
                    logEvent('media_progress', 75);
                }
            }
        }
    };

    const handleVideoEnded = () => {
        setIsPlaybackFinished(true);
        setIsVideoPlaying(false);
        if (ctaActivationGate === 'complete' || ctaActivationGate === 'threequarters' || ctaActivationGate === 'half' || ctaActivationGate === 'quarter') {
            setIsCtaUnlocked(true);
        }
        if (!loggedComplete.current) {
            loggedComplete.current = true;
            logEvent('media_complete');
            logEvent('media_progress', 100);
        }
    };

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
        logEvent('cta_click');
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
                        <div className="relative w-full h-full bg-[#0B0F19] flex items-center justify-center overflow-hidden">
                            {isEmbeddable && embedUrl ? (
                                !isVideoPlaying ? (
                                    <div 
                                        onClick={() => {
                                            setIsPlaybackFinished(false);
                                            setIsVideoPlaying(true);
                                        }}
                                        className="absolute inset-0 w-full h-full cursor-pointer flex items-center justify-center bg-black/35 z-20"
                                    >
                                        {thumbUrl && (
                                            <img
                                                src={thumbUrl}
                                                alt={title}
                                                className="absolute inset-0 w-full h-full object-cover opacity-80"
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
                                    <iframe
                                        src={`${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1`}
                                        className="w-full h-full border-none"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                )
                            ) : (
                                <>
                                    <video
                                        ref={embedVideoRef}
                                        src={asset.url}
                                        controls
                                        preload="metadata"
                                        onTimeUpdate={handleVideoTimeUpdate}
                                        onEnded={handleVideoEnded}
                                        className="w-full h-full object-contain"
                                    />
                                    {!isVideoPlaying && !isPlaybackFinished && (
                                        <div 
                                            onClick={() => {
                                                setIsPlaybackFinished(false);
                                                setIsVideoPlaying(true);
                                                if (embedVideoRef.current) {
                                                    embedVideoRef.current.play().catch(err => {
                                                        console.warn('Autoplay blocked:', err);
                                                    });
                                                }
                                            }}
                                            className="absolute inset-0 w-full h-full cursor-pointer flex items-center justify-center bg-black/30 z-20"
                                        >
                                            {thumbUrl && (
                                                <img
                                                    src={thumbUrl}
                                                    alt={title}
                                                    className="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none"
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
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {asset.type === 'audio' && (
                        <div className="p-8 w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl backdrop-blur-xl flex flex-col items-center gap-4">
                            <audio
                                ref={audioRef}
                                src={asset.url}
                                onTimeUpdate={handleAudioTimeUpdate}
                                onLoadedMetadata={handleAudioLoadedMetadata}
                                onEnded={handleAudioEnded}
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

                    {/* Popover overlay for CTA in Embed Mode */}
                    {ctaPopoverEnabled && isPlaybackFinished && ctaType !== 'none' ? (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-[#0B0F19]/95 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                            <div className="max-w-xs space-y-4 text-center">
                                {ctaPretext && (
                                    <p className="text-xs text-slate-200 font-bold leading-normal line-clamp-3">
                                        {ctaPretext}
                                    </p>
                                )}
                                <Button
                                    onClick={handleCtaClick}
                                    className="rounded-xl bg-primary hover:bg-primary/90 text-white font-extrabold h-9 px-6 text-[10px] uppercase tracking-wider cursor-pointer mx-auto flex items-center gap-1.5"
                                >
                                    {ctaText || 'Get Started'}
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                                <div>
                                    <button
                                        onClick={() => {
                                            setIsPlaybackFinished(false);
                                            if (asset.type === 'video') {
                                                setIsVideoPlaying(true);
                                                if (embedVideoRef.current) {
                                                    embedVideoRef.current.currentTime = 0;
                                                    embedVideoRef.current.play().catch(err => {
                                                        console.warn('Playback block:', err);
                                                    });
                                                }
                                            } else if (asset.type === 'audio' && audioRef.current) {
                                                audioRef.current.currentTime = 0;
                                                audioRef.current.play();
                                                setIsPlaying(true);
                                            }
                                        }}
                                        className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                                    >
                                        Replay
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Overlaid Title/CTA Bar on Hover */}
                {ctaType !== 'none' && !(ctaPopoverEnabled && isPlaybackFinished) && (
                    <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto">
                        <div className="truncate pr-4 text-left">
                            <p className="text-xs font-bold truncate">{title}</p>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                {!isCtaUnlocked 
                                    ? (
                                        ctaActivationGate === 'quarter' ? '🔒 Unlocks 25% through playback' :
                                        ctaActivationGate === 'half' ? '🔒 Unlocks halfway through' :
                                        ctaActivationGate === 'threequarters' ? '🔒 Unlocks 75% through playback' :
                                        '🔒 Unlocks on playback complete'
                                      ) 
                                    : description}
                            </p>
                        </div>
                        <Button 
                            disabled={!isCtaUnlocked}
                            size="sm" 
                            onClick={handleCtaClick} 
                            className={`rounded-xl text-[10px] font-black h-8 px-4 flex items-center gap-1 shrink-0 cursor-pointer ${
                                !isCtaUnlocked 
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60 border border-slate-700' 
                                    : 'bg-primary text-white hover:bg-primary/90'
                            }`}
                        >
                            {!isCtaUnlocked && <Lock className="h-3.5 w-3.5" />}
                            {ctaText || 'Get Started'} 
                            {isCtaUnlocked && <ChevronRight className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                )}

                {/* Render the iframe modal inside embed frame */}
                {isCtaModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                        <div className="relative w-full max-w-4xl h-[90vh] bg-white dark:bg-[#070913] border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col">
                            {/* Absolute positioned close button at top-right corner */}
                            <button
                                onClick={() => setIsCtaModalOpen(false)}
                                className="absolute top-4 right-4 z-50 p-2.5 bg-slate-100 dark:bg-slate-950/70 hover:bg-slate-200 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full transition-all cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 shadow-lg hover:scale-105 active:scale-95"
                                aria-label="Close Modal"
                            >
                                <X className="h-4 w-4" />
                            </button>
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
        <div className="min-h-screen bg-slate-50 dark:bg-[#070913] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-primary selection:text-white transition-colors duration-300">
            {/* Header Banner */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-900 bg-white/80 dark:bg-[#070913]/80 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <a
                        href={orgBranding?.website || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 hover:opacity-85 transition-opacity"
                    >
                        {orgBranding?.logoUrl ? (
                            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-white">
                                <img
                                    src={orgBranding.logoUrl}
                                    alt={orgBranding.name || 'Organization Logo'}
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        ) : (
                            <div className="p-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-primary font-black text-xs">
                                {fallbackInitials}
                            </div>
                        )}
                        <span className="font-extrabold text-sm tracking-tight text-slate-700 dark:text-slate-200">
                            {orgBranding?.name || 'Workspace Media Hub'}
                        </span>
                    </a>

                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                logEvent('download');
                                window.open(asset.url, '_blank');
                            }}
                            className="rounded-xl text-xs font-black text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800/40 gap-1.5 h-9 cursor-pointer"
                        >
                            <Download className="h-3.5 w-3.5" /> Save
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Visual Arena */}
            <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 md:py-12 flex flex-col items-center gap-8 text-center animate-in fade-in slide-in-from-bottom-3 duration-500">
                {/* 1. Typography and Meta Context - NOW AT THE TOP */}
                <div className="w-full max-w-3xl space-y-3">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50 leading-tight whitespace-pre-line">
                        {title}
                    </h1>
                    {description && (
                        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 font-medium leading-relaxed whitespace-pre-line">
                            {description}
                        </p>
                    )}
                </div>

                {/* 2. Media Presentation Viewport - IN THE MIDDLE */}
                <div className="w-full relative rounded-[2rem] border border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950/40 shadow-2xl dark:shadow-none overflow-hidden min-h-[300px] md:min-h-[500px] flex items-center justify-center">
                    {/* Glowing Accent Backdrop */}
                    <div className="absolute -inset-10 bg-gradient-to-tr from-primary/10 via-transparent to-primary/5 blur-3xl opacity-40 pointer-events-none" />

                    {asset.type === 'image' && (
                        <div className="relative w-full aspect-video md:aspect-[16/9] group/view flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                            <img
                                src={asset.url}
                                alt={title}
                                className="max-w-full max-h-full object-contain rounded-2xl transition-transform duration-500 group-hover/view:scale-[1.01]"
                            />
                        </div>
                    )}

                    {asset.type === 'video' && (
                        <div className="relative w-full aspect-video md:aspect-[16/9] bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden z-10">
                            {isEmbeddable && embedUrl ? (
                                !isVideoPlaying ? (
                                    <div 
                                        onClick={() => {
                                            setIsPlaybackFinished(false);
                                            setIsVideoPlaying(true);
                                        }}
                                        className="absolute inset-0 w-full h-full cursor-pointer flex items-center justify-center bg-slate-950 z-20"
                                    >
                                        {thumbUrl && (
                                            <img
                                                src={thumbUrl}
                                                alt={title}
                                                className="absolute inset-0 w-full h-full object-cover opacity-80"
                                            />
                                        )}
                                        {/* Play Overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                                            <div className="relative">
                                                <div className="absolute inset-0 rounded-full bg-primary/35 animate-ping" />
                                                <div className="absolute -inset-4 rounded-full bg-primary/20 animate-pulse duration-1000" />
                                                <div className="relative h-20 w-20 sm:h-24 sm:w-24 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(59,95,255,0.4)]">
                                                    <Play className="w-10 h-10 sm:w-12 sm:h-12 fill-current ml-1" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <iframe
                                        src={`${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1`}
                                        className="w-full h-full border-none"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                )
                            ) : (
                                <>
                                    <video
                                        ref={videoRef}
                                        src={asset.url}
                                        controls
                                        preload="metadata"
                                        onTimeUpdate={handleVideoTimeUpdate}
                                        onEnded={handleVideoEnded}
                                        className="w-full h-full object-contain"
                                    />
                                    {!isVideoPlaying && !isPlaybackFinished && (
                                        <div 
                                            onClick={() => {
                                                setIsPlaybackFinished(false);
                                                setIsVideoPlaying(true);
                                                if (videoRef.current) {
                                                    videoRef.current.play().catch(err => {
                                                        console.warn('Autoplay blocked:', err);
                                                    });
                                                }
                                            }}
                                            className="absolute inset-0 w-full h-full cursor-pointer flex items-center justify-center bg-slate-950/45 z-20"
                                        >
                                            {thumbUrl && (
                                                <img
                                                    src={thumbUrl}
                                                    alt={title}
                                                    className="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none"
                                                />
                                            )}
                                            {/* Play Overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                <div className="relative">
                                                    <div className="absolute inset-0 rounded-full bg-primary/35 animate-ping" />
                                                    <div className="absolute -inset-4 rounded-full bg-primary/20 animate-pulse duration-1000" />
                                                    <div className="relative h-20 w-20 sm:h-24 sm:w-24 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(59,95,255,0.4)]">
                                                        <Play className="w-10 h-10 sm:w-12 sm:h-12 fill-current ml-1" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {asset.type === 'audio' && (
                        <div className="p-8 md:p-12 w-full max-w-lg relative z-10 space-y-6">
                            <audio
                                ref={audioRef}
                                src={asset.url}
                                onTimeUpdate={handleAudioTimeUpdate}
                                onLoadedMetadata={handleAudioLoadedMetadata}
                                onEnded={handleAudioEnded}
                            />
                            
                            <div className="mx-auto w-24 h-24 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center text-primary shadow-xl shadow-primary/5 relative">
                                <div className="absolute inset-0 bg-primary/5 rounded-full animate-ping opacity-60" />
                                <Music className="h-10 w-10 relative z-10" />
                            </div>

                            <div className="space-y-1">
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

                            <div className="flex items-center gap-4 bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 p-4 rounded-2xl backdrop-blur-md">
                                <button
                                    onClick={toggleAudioPlay}
                                    className="p-3 bg-primary text-white rounded-xl active:scale-95 transition-all hover:bg-primary/90 shadow-lg shadow-primary/20 cursor-pointer"
                                >
                                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                                </button>

                                <div className="flex-1 space-y-2 text-left">
                                    <div className="relative w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className="absolute left-0 top-0 h-full bg-primary transition-all duration-100"
                                            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-550">
                                        <span>{formatTime(currentTime)}</span>
                                        <span>{formatTime(duration)}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-800 pl-3">
                                    <Volume2 className="h-4 w-4 text-slate-500" />
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={volume}
                                        onChange={handleVolumeChange}
                                        className="w-16 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
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
                            <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-muted rounded-2xl flex items-center justify-center text-primary shadow-lg border border-slate-200 dark:border-border">
                                <Link2 className="h-7 w-7" />
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate w-full px-4">{asset.url}</p>
                            </div>
                            <Button 
                                onClick={() => window.open(asset.url, '_blank')} 
                                className="w-full h-11 rounded-xl text-xs font-bold gap-2 bg-slate-100 dark:bg-slate-900 border hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                            >
                                Navigate to Link <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}

                    {/* Popover overlay for CTA */}
                    {ctaPopoverEnabled && isPlaybackFinished && ctaType !== 'none' ? (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 md:p-12 bg-white/95 dark:bg-[#070913]/95 backdrop-blur-md animate-in fade-in zoom-in-95 duration-300">
                            <div className="max-w-md space-y-6 text-center">
                                {ctaPretext && (
                                    <p className="text-sm md:text-base text-slate-800 dark:text-slate-200 font-bold leading-relaxed whitespace-pre-line">
                                        {ctaPretext}
                                    </p>
                                )}
                                <Button
                                    onClick={handleCtaClick}
                                    className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/95 hover:to-primary/85 text-white font-extrabold h-12 px-8 shadow-xl hover:shadow-primary/10 transition-all active:scale-[0.97] flex items-center gap-2 group text-xs tracking-wider uppercase cursor-pointer mx-auto"
                                >
                                    {ctaText || 'Get Started'}
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Button>
                                <div>
                                    <button
                                        onClick={() => {
                                            setIsPlaybackFinished(false);
                                            if (asset.type === 'video') {
                                                setIsVideoPlaying(true);
                                                const activeVideoRef = isEmbed ? embedVideoRef : videoRef;
                                                if (activeVideoRef.current) {
                                                    activeVideoRef.current.currentTime = 0;
                                                    activeVideoRef.current.play().catch(err => {
                                                        console.warn('Playback block:', err);
                                                    });
                                                }
                                            } else if (asset.type === 'audio' && audioRef.current) {
                                                audioRef.current.currentTime = 0;
                                                audioRef.current.play();
                                                setIsPlaying(true);
                                            }
                                        }}
                                        className="text-xs font-bold text-primary hover:underline cursor-pointer"
                                    >
                                        {asset.type === 'video' ? 'Watch again' : 'Listen again'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* 3. CTA Pre-text & CTA Button Layout - AT THE BOTTOM */}
                {ctaType !== 'none' && !(ctaPopoverEnabled && isPlaybackFinished) && (
                    <div className="w-full max-w-2xl space-y-5 flex flex-col items-center pt-2 animate-in fade-in duration-300">
                        {ctaPretext && (
                            <p className="text-sm md:text-base text-slate-750 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-line text-center max-w-xl">
                                {ctaPretext}
                            </p>
                        )}
                        <Button
                            disabled={!isCtaUnlocked}
                            onClick={handleCtaClick}
                            className={`rounded-2xl font-extrabold h-12 px-8 shadow-xl transition-all flex items-center gap-2 group text-xs tracking-wider uppercase cursor-pointer ${
                                !isCtaUnlocked 
                                    ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-500 cursor-not-allowed opacity-75 shadow-none border border-slate-300 dark:border-slate-800' 
                                    : 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/95 hover:to-primary/85 text-white hover:shadow-primary/10 active:scale-[0.97]'
                            }`}
                        >
                            {!isCtaUnlocked && <Lock className="h-4 w-4 mr-0.5 animate-pulse" />}
                            {ctaText || 'Get Started'}
                            {isCtaUnlocked && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                        </Button>
                        {!isCtaUnlocked && (
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-450 flex items-center gap-1">
                                {ctaActivationGate === 'quarter' && 'Unlocks 25% through playback'}
                                {ctaActivationGate === 'half' && 'Unlocks halfway through playback'}
                                {ctaActivationGate === 'threequarters' && 'Unlocks 75% through playback'}
                                {ctaActivationGate === 'complete' && 'Unlocks on playback complete'}
                            </p>
                        )}
                    </div>
                )}
            </main>

            {/* Custom Brand Footer */}
            <Footer orgBranding={orgBranding} className="w-full mt-auto" />

            {/* Render the iframe modal inside public landing layout */}
            {isCtaModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                    <div className="relative w-full max-w-4xl h-[90vh] bg-white dark:bg-[#070913] border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Absolute positioned close button at top-right corner */}
                        <button
                            onClick={() => setIsCtaModalOpen(false)}
                            className="absolute top-4 right-4 z-50 p-2.5 bg-slate-100 dark:bg-slate-950/70 hover:bg-slate-200 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full transition-all cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 shadow-lg hover:scale-105 active:scale-95"
                            aria-label="Close Modal"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <div className="flex-1 w-full bg-white relative">
                            <iframe src={getFinalCtaUrl()} className="w-full h-full border-none" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
