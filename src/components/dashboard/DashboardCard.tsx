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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="h-full"
    >
      <Card 
        className={cn(
          "h-full rounded-[2.5rem] border-none bg-background/50 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden relative group",
          className
        )} 
        {...props}
      >
        {/* Premium internal glow */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        
        <CardHeader className="h-16 flex items-center justify-start py-0 px-6 border-b border-border/5">
          <CardTitle className="text-[11px] font-black tracking-[0.1em] uppercase opacity-50">
            {displayTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow pt-6 p-6">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  )
}
