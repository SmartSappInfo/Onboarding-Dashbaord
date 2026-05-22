'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { BackgroundPattern } from './survey-background-pattern';
import { Building2, AlertCircle, Lock, Home, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Survey } from '@/lib/types';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from 'next-themes';

interface SurveyUnavailableProps {
    status: 'draft' | 'archived' | 'not_found' | 'closed';
    survey?: Partial<Survey>;
    logoUrl?: string | null;
}

export default function SurveyUnavailable({ status, survey, logoUrl }: SurveyUnavailableProps) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';
    const bgColor = isDark ? '#090d16' : (survey?.backgroundColor || '#F1F5F9');
    
    const content = {
        draft: {
            icon: Lock,
            title: "Under Construction",
            description: "This survey is currently in draft mode and is not yet open for responses. Please check back later.",
            color: "text-amber-500",
            bg: "bg-amber-500/10 dark:bg-amber-500/20"
        },
        archived: {
            icon: AlertCircle,
            title: "Survey Archived",
            description: "This survey has been archived and is no longer accepting responses.",
            color: "text-slate-500 dark:text-slate-400",
            bg: "bg-slate-500/10 dark:bg-slate-500/20"
        },
        closed: {
            icon: AlertCircle,
            title: "Survey Closed",
            description: "This survey is no longer accepting new responses.",
            color: "text-red-500 dark:text-red-400",
            bg: "bg-red-500/10 dark:bg-red-500/20"
        },
        not_found: {
            icon: AlertCircle,
            title: "Survey Not Found",
            description: "The survey you are looking for does not exist or has been moved.",
            color: "text-red-500 dark:text-red-400",
            bg: "bg-red-500/10 dark:bg-red-500/20"
        }
    }[status];

    const Icon = content.icon;

    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: bgColor }}>
            <BackgroundPattern pattern={survey?.backgroundPattern} color={survey?.patternColor} />
            
            <main className="flex-grow flex flex-col items-center justify-center relative z-10 p-4">
                <div className="flex justify-center mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
                    {logoUrl ? (
                        <div className="relative h-12 w-48">
                            <Image src={logoUrl} alt="Logo" fill className="object-contain opacity-40 grayscale" />
                        </div>
                    ) : (
                        <Building2 className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                    )}
                </div>

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="max-w-md w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[3rem] p-8 sm:p-12 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] border border-white/40 dark:border-slate-800/40 text-center space-y-8"
                >
                    <div className={`mx-auto w-24 h-24 rounded-[2rem] ${content.bg} flex items-center justify-center ring-8 ring-white/50 dark:ring-slate-900/50`}>
                        <Icon className={`w-12 h-12 ${content.color}`} />
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
                            {content.title}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed px-2">
                            {content.description}
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 justify-center pt-4">
                        <Button asChild className="rounded-2xl h-14 px-8 font-black gap-3 shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-base">
                            <Link href="/">
                                <Home className="w-5 h-5" />
                                Return Home
                            </Link>
                        </Button>
                        <Button variant="ghost" className="rounded-2xl h-12 px-6 font-bold gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-white/5 transition-all">
                            <MessageCircle className="w-4 h-4" />
                            Contact Support
                        </Button>
                    </div>
                </motion.div>
            </main>

            <footer className="py-12 text-center relative z-10">
                <div className="flex flex-col items-center gap-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">
                        Powered by <span className="text-primary/60">SmartSapp</span>
                    </p>
                    <div className="h-1 w-12 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">&copy; {new Date().getFullYear()} SmartSapp. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}

