import React, { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export interface WidgetWrapperProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function WidgetWrapper({ title, children, className, noPadding }: WidgetWrapperProps) {
  return (
    <Card className={`h-full w-full flex flex-col overflow-hidden ${className || ''}`}>
      {title && (
        <CardHeader className="py-3 px-4 flex-none border-b bg-muted/20 drag-handle cursor-move">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={`flex-1 overflow-auto ${noPadding ? 'p-0' : 'p-4'}`}>
        <Suspense fallback={<WidgetSkeleton />}>
          {children}
        </Suspense>
      </CardContent>
    </Card>
  );
}

export function WidgetSkeleton() {
  return (
    <div className="w-full h-full flex flex-col space-y-3">
      <Skeleton className="h-[20px] w-[100px] rounded-full" />
      <Skeleton className="flex-1 rounded-md" />
    </div>
  );
}
