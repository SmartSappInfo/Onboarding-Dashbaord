import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  noPadding?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  '3xl': 'max-w-[1920px]',
  '4xl': 'max-w-[2048px]',
  '5xl': 'max-w-[2560px]',
  '6xl': 'max-w-[3072px]',
  '7xl': 'max-w-[3840px]',
  full: 'max-w-full',
};

/**
 * PageContainer - Standard container for page content
 * 
 * Provides consistent padding and max-width across all pages.
 * Should be the first child of every page component.
 * 
 * @example
 * ```tsx
 * export default function MyPage() {
 *   return (
 *     <PageContainer>
 *       <h1>Page Title</h1>
 *       // ... page content
 *     </PageContainer>
 *   );
 * }
 * ```
 */
export function PageContainer({ 
  children, 
  className, 
  maxWidth = '2xl',
  noPadding = false 
}: PageContainerProps) {
  return (
    <div 
      className={cn(
        'mx-auto w-full',
        maxWidthClasses[maxWidth],
        !noPadding && 'p-4 sm:p-6 lg:p-8',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * PageContainerFluid - Full-width container without max-width constraint
 * 
 * Use for pages that need to span the full viewport width (dashboards, tables, etc.)
 */
export function PageContainerFluid({ 
  children, 
  className,
  noPadding = false 
}: Omit<PageContainerProps, 'maxWidth'>) {
  return (
    <div 
      className={cn(
        'w-full',
        !noPadding && 'p-4 sm:p-6 lg:p-8',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * PageContainerNarrow - Narrow container for focused content (forms, articles, etc.)
 */
export function PageContainerNarrow({ 
  children, 
  className,
  noPadding = false 
}: Omit<PageContainerProps, 'maxWidth'>) {
  return (
    <div 
      className={cn(
        'mx-auto w-full max-w-3xl',
        !noPadding && 'p-4 sm:p-6 lg:p-8',
        className
      )}
    >
      {children}
    </div>
  );
}
