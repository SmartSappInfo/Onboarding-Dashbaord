
'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

/**
 * @fileOverview Decorative background animation for hero sections.
 * Features a central pulsing aura and three wiggling shapes for depth.
 */
export default function AnimatedHeroShapes() {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
            {/* Central Pulsing Aura */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.1, 0.25, 0.1],
                }}
                transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/20 blur-3xl"
            />

            {/* Wiggling Shape 1 - Large Circle */}
            <motion.div
                animate={{
                    x: [0, 30, -20, 0],
                    y: [0, -40, 20, 0],
                    scale: [1, 1.1, 0.9, 1],
                }}
                transition={{
                    duration: 15,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute top-[10%] left-[15%] w-64 h-64 rounded-full border border-primary/10 bg-primary/5 opacity-30"
            />

            {/* Wiggling Shape 2 - Blob */}
            <motion.div
                animate={{
                    x: [0, -50, 20, 0],
                    y: [0, 30, -40, 0],
                    rotate: [0, 45, -20, 0],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute bottom-[20%] right-[10%] w-80 h-80 rounded-[3rem] border border-primary/10 bg-primary/5 opacity-20"
            />

            {/* Wiggling Shape 3 - Small Circle */}
            <motion.div
                animate={{
                    x: [0, 40, -40, 0],
                    y: [0, 20, 50, 0],
                }}
                transition={{
                    duration: 12,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute top-[40%] right-[20%] w-32 h-32 rounded-full border border-primary/5 bg-primary/5 opacity-40"
            />
        </div>
    );
}
