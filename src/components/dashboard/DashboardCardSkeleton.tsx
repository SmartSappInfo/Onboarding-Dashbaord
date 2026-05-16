import * as React from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DashboardCardSkeleton({ className }: { className?: string }) {
  return (
    <Card 
      className={cn(
        "h-full rounded-[1.5rem] border-none bg-background/40 backdrop-blur-md shadow-sm ring-1 ring-black/5 dark:ring-white/5 overflow-hidden animate-pulse",
        className
      )}
    >
      <CardHeader className="h-14 flex items-center justify-start py-0 px-6 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
          <div className="h-2 w-24 bg-muted-foreground/20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="flex-grow pt-8 p-8 flex flex-col gap-4">
        <div className="h-12 w-full bg-muted-foreground/10 rounded-2xl" />
        <div className="h-12 w-full bg-muted-foreground/10 rounded-2xl" />
        <div className="h-12 w-full bg-muted-foreground/10 rounded-2xl" />
      </CardContent>
    </Card>
  );
}
