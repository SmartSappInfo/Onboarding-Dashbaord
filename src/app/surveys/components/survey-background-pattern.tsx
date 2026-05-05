'use client';

import * as React from 'react';
import type { Survey } from '@/lib/types';

export const BackgroundPattern = ({ pattern, color }: { pattern?: Survey['backgroundPattern'], color?: string }) => {
    if (!pattern || pattern === 'none') return null;

    if (pattern === 'gradient') {
        return (
            <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1] via-[#a855f7] to-[#ec4899] opacity-90" />
        );
    }

    const patterns: Record<string, React.ReactNode> = {
        dots: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1" fill={color || "currentColor"} opacity="0.1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
        ),
        grid: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke={color || "currentColor"} strokeWidth="1" opacity="0.05" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
        ),
        circuit: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="circuit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path d="M0 10h20v10H0zM30 30h40v10H30zM80 50h20v10H80zM10 70h30v10H10zM60 80h20v10H60z" fill="none" stroke={color || "currentColor"} strokeWidth="0.5" opacity="0.05" />
                        <circle cx="20" cy="15" r="2" fill={color || "currentColor"} opacity="0.1" />
                        <circle cx="70" cy="35" r="2" fill={color || "currentColor"} opacity="0.1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#circuit)" />
            </svg>
        ),
        topography: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="topo" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path d="M0 50c20-10 40-10 60 0s40 10 60 0M0 20c20-10 40-10 60 0s40 10 60 0M0 80c20-10 40-10 60 0s40 10 60 0" fill="none" stroke={color || "currentColor"} strokeWidth="1" opacity="0.05" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#topo)" />
            </svg>
        ),
        cubes: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="cubes" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                        <path d="M30 0l30 15v30L30 60 0 45V15z" fill="none" stroke={color || "currentColor"} strokeWidth="1" opacity="0.05" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#cubes)" />
            </svg>
        )
    };

    return (
        <div className="absolute inset-0 pointer-events-none text-foreground/20">
            {patterns[pattern]}
        </div>
    );
};
