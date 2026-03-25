import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Skeleton that mirrors the full TagsClient layout:
 * header → stats cards → tab bar → search → tag grid
 * Uses animate-pulse (built into shadcn Skeleton) for shimmer effect.
 */
export function TagsSkeleton() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5" aria-busy="true" aria-label="Loading tag management">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 rounded-xl" />
            <Skeleton className="h-4 w-72 rounded" />
          </div>
          <Skeleton className="h-11 w-32 rounded-xl shrink-0" />
        </div>

        {/* Main tab bar */}
        <Skeleton className="h-12 w-full max-w-sm rounded-2xl" />

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-none shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <Skeleton className="h-2.5 w-16 rounded" />
                    <Skeleton className="h-6 w-10 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search bar */}
        <Card className="border-none shadow-sm rounded-2xl">
          <CardContent className="p-4">
            <Skeleton className="h-10 w-full rounded-xl" />
          </CardContent>
        </Card>

        {/* Category tab bar */}
        <Skeleton className="h-12 w-full rounded-2xl" />

        {/* Tag grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-none shadow-sm rounded-2xl">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <Skeleton className="h-3.5 w-24 rounded" />
                    <Skeleton className="h-2.5 w-32 rounded" />
                  </div>
                  {/* Action buttons placeholder */}
                  <div className="flex gap-1 shrink-0">
                    <Skeleton className="h-7 w-7 rounded-lg" />
                    <Skeleton className="h-7 w-7 rounded-lg" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
