'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X } from 'lucide-react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import VideoEmbed from '@/components/video-embed';
import { cn } from '@/lib/utils';

interface VideoHeroProps {
    videoUrl: string;
    thumbnailUrl?: string;
    title?: string;
    videoCaption?: string;
    className?: string;
}

/**
 * @fileOverview High-engagement video hero component.
 * Features a pulsing play button aura and modal playback.
 */
export default function VideoHero({ videoUrl, thumbnailUrl, title, videoCaption, className }: VideoHeroProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return null;

    return (
        <>
            <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsOpen(true)}
                className={cn(
                    "relative w-full aspect-video rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white bg-white cursor-pointer group",
                    className
                )}
            >
                {thumbnailUrl ? (
                    <Image
                        src={thumbnailUrl}
                        alt={title || "Video thumbnail"}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                ) : (
                    <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                        <VideoEmbed url={videoUrl} className="w-full h-full opacity-40 pointer-events-none" />
                    </div>
                )}

                {/* Dark Overlay */}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-500" />

                {/* Pulsing Play Button Engine */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className="relative">
                        {/* Aura 1 */}
                        <motion.div
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute inset-0 rounded-full bg-white blur-xl"
                        />
                        {/* Aura 2 */}
                        <motion.div
                            animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                            className="absolute inset-0 rounded-full bg-primary/40 blur-2xl"
                        />
                        
                        <div className="relative bg-white text-primary rounded-full p-6 shadow-2xl transform transition-transform group-hover:scale-110 duration-500">
                            <Play className="h-10 w-10 fill-current ml-1" />
                        </div>
                    </div>
                    
                    <div className="text-center">
                        <p className="text-[12px] font-black uppercase tracking-[0.3em] text-white drop-shadow-md">
                            {videoCaption || 'Click to watch this video'}
                        </p>
                    </div>
                </div>
            </motion.div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-5xl p-0 overflow-hidden border-none bg-black rounded-[2rem] shadow-[0_0_100px_rgba(0,0,0,0.5)]">
                    {/* Accessibility Titles (Visually Hidden) */}
                    <DialogHeader className="sr-only">
                        <DialogTitle>Video: {title || 'Survey Introduction'}</DialogTitle>
                        <DialogDescription>Interactive video player for the survey welcome message.</DialogDescription>
                    </DialogHeader>

                    <div className="relative aspect-video w-full">
                        <VideoEmbed url={videoUrl} className="w-full h-full border-none shadow-none" />
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
