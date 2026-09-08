/**
 * @fileoverview Accessible User Avatar Primitives
 *
 * ARCHITECTURAL CONTEXT & DEPENDENCY QA:
 * - Migrated from the monolithic `radix-ui` meta-package to the modular `@radix-ui/react-avatar` primitive.
 * - Conforms with Vercel React Best Practices (`bundle-barrel-imports`) by eliminating unnecessary umbrella bundles.
 * - Preserves exact `data-slot` selectors and Radix state machine lifecycle (idle -> loading -> loaded / error).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Do not reintroduce imports from the unified `radix-ui` package; all UI components in this workspace
 *   strictly consume scoped `@radix-ui/react-*` packages to optimize bundle tree-shaking.
 * - When passing `src`, empty or falsy strings must evaluate to `undefined` to trigger the fallback slot immediately.
 *
 * @testability Exported components render valid semantic spans/images and pass standard React Testing Library DOM queries.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

const avatarStatusVariants = cva('flex items-center rounded-full size-2 border-2 border-background', {
  variants: {
    variant: {
      online: 'bg-green-600',
      offline: 'bg-zinc-600 dark:bg-zinc-300',
      busy: 'bg-yellow-600',
      away: 'bg-blue-600',
    },
  },
  defaultVariants: {
    variant: 'online',
  },
});

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root data-slot="avatar" className={cn('relative flex shrink-0 size-10', className)} {...props} />
  );
}

function AvatarImage({ className, src, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <div className={cn('relative overflow-hidden rounded-full', className)}>
      <AvatarPrimitive.Image 
        data-slot="avatar-image" 
        className={cn('aspect-square h-full w-full')} 
        {...props} 
        src={src || undefined}
      />
    </div>
  );
}

function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full border border-border bg-accent text-accent-foreground text-xs',
        className,
      )}
      {...props}
    />
  );
}

function AvatarIndicator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="avatar-indicator"
      className={cn('absolute flex size-6 items-center justify-center', className)}
      {...props}
    />
  );
}

function AvatarStatus({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof avatarStatusVariants>) {
  return <div data-slot="avatar-status" className={cn(avatarStatusVariants({ variant }), className)} {...props} />;
}

export { Avatar, AvatarFallback, AvatarImage, AvatarIndicator, AvatarStatus, avatarStatusVariants };