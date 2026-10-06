'use client';
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardInfoTooltip } from "@/components/shared/CardInfoTooltip";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function DashboardCard({
  title,
  children,
  className,
  terminology,
  subtitle,
  icon: Icon,
  badge,
  action,
  ...props
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  terminology?: { singular: string; plural: string };
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  action?: React.ReactNode;
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
          "h-full rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden relative group",
          className
        )} 
        {...props}
      >
        <CardHeader className="min-h-14 flex flex-row items-center justify-between py-3 px-6 border-b border-border/80 bg-muted/20">
          <div className="flex items-center gap-3">
            {Icon ? (
              <Icon className="w-4 h-4 text-primary" />
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shadow-[0_0_8px_rgba(var(--primary),0.6)]" />
            )}
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                {displayTitle}
                {badge}
              </CardTitle>
              {subtitle && (
                <CardInfoTooltip text={subtitle} />
              )}
            </div>
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </CardHeader>
        <CardContent className="flex-grow p-6 bg-card relative z-10">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export { DashboardCard };
