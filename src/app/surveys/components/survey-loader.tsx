'use client';

import { SmartSappIcon } from '@/components/icons';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SurveyLoaderProps {
    label?: string;
    className?: string;
}

/**
 * @fileOverview Branded pre-loader for Survey experiences.
 * Features an animated SmartSapp icon and pulsing status indicators.
 */
export default function SurveyLoader({ label = "Preparing your experience...", className }: SurveyLoaderProps) {
    return (
        <div className={cn(
            "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-500",
            className
        )}>
            <div className="relative">
                {/* Glow Effect */}
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full bg-primary/20 blur-2xl"
                />
                
                {/* Icon Container */}
                <div className="relative bg-white rounded-[2.5rem] p-8 shadow-2xl ring-1 ring-black/5">
                    <SmartSappIcon className="h-20 w-20 text-primary animate-pulse" variant="primary" />
                </div>
            </div>

            <div className="mt-10 space-y-3 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary animate-pulse">
                    {label}
                </p>
                
                {/* Pulsing Dots */}
                <div className="flex justify-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            animate={{ 
                                opacity: [0.3, 1, 0.3],
                                scale: [1, 1.2, 1]
                            }}
                            transition={{ 
                                duration: 1.2, 
                                repeat: Infinity, 
                                delay: i * 0.2,
                                ease: "easeInOut"
                            }}
                            className="w-1.5 h-1.5 rounded-full bg-primary/40"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
