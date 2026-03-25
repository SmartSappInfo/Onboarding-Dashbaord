import { Skeleton } from '@/components/ui/skeleton';

interface TagSelectorSkeletonProps {
  /** Number of tag badge placeholders to show */
  count?: number;
}

/**
 * Skeleton for the TagSelector component.
 * Mirrors the inline badge + "Add Tag" button layout.
 */
export function TagSelectorSkeleton({ count = 2 }: TagSelectorSkeletonProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-busy="true"
      aria-label="Loading tags"
    >
      {Array.from({ length: count }).map((_, i) => (
        // Mimic colored badge shape: rounded-full, varying widths
        <Skeleton
          key={i}
          className="h-5 rounded-full"
          style={{ width: `${56 + i * 16}px` }}
        />
      ))}
      {/* "Add Tag" button placeholder */}
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  );
}
