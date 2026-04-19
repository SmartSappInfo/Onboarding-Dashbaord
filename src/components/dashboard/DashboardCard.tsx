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
      transition={{ duration: 0.4 }}
      className="h-full"
    >
      <Card 
        className={cn(
          "h-full rounded-2xl border border-border bg-transparent shadow-sm ring-1 ring-border hover:shadow-md transition-all duration-300 overflow-hidden relative group",
          className
        )} 
        {...props}
      >
        <CardHeader className="h-14 flex items-center justify-start py-0 px-6 border-b border-border/50 bg-muted/20">
          <CardTitle className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-60 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
            {displayTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow pt-8 p-8">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  )
}
