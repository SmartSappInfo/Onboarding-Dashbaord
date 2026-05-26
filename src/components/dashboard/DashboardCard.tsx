'use client';
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function DashboardCard({
  title,
  children,
  className,
  terminology,
  ...props
}: {
  title: string
  children: React.ReactNode
  className?: string
  terminology?: { singular: string; plural: string }
} & React.HTMLAttributes<HTMLDivElement>) {
  // Process title for dynamic terminology
  const displayTitle = React.useMemo(() => {
    if (!terminology) return title;
    return title
      .replace(/{Entity}/g, terminology.singular)
      .replace(/{Entities}/g, terminology.plural);
  }, [title, terminology]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <Card 
        className={cn(
          "h-full rounded-[1.5rem] border-none bg-background/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5 dark:ring-white/10 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-500 overflow-hidden relative group",
          className
        )} 
        {...props}
      >
        <CardHeader className="h-14 flex items-center justify-start py-0 px-6 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
          <CardTitle className="text-[10px] font-medium tracking-[0.05em] opacity-70 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shadow-[0_0_8px_rgba(var(--primary),0.6)]" />
            {displayTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow pt-8 p-8 relative z-10">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  )
}
