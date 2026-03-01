'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';

// Define CardContext
type CardContextType = {
  variant: 'default' | 'accent';
};

const CardContext = React.createContext<CardContextType>({
  variant: 'default', // Default value
});

// Hook to use CardContext
const useCardContext = () => {
  const context = React.useContext(CardContext);
  if (!context) {
    throw new Error('useCardContext must be used within a Card component');
  }
  return context;
};

// Variants
const cardVariants = cva('flex flex-col items-stretch text-card-foreground rounded-xl', {
  variants: {
    variant: {
      default: 'bg-card border border-border shadow-xs black/5',
      accent: 'bg-muted shadow-xs p-1',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const cardHeaderVariants = cva('flex items-center justify-between flex-wrap px-5 min-h-14 gap-2.5', {
  variants: {
    variant: {
      default: 'border-b border-border',
      accent: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const cardContentVariants = cva('grow p-5', {
  variants: {
    variant: {
      default: '',
      accent: 'bg-card rounded-t-xl [&:last-child]:rounded-b-xl',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const cardTableVariants = cva('grid grow', {
  variants: {
    variant: {
      default: '',
      accent: 'bg-card rounded-xl',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const cardFooterVariants = cva('flex items-center px-5 min-h-14', {
  variants: {
    variant: {
      default: 'border-t border-border',
      accent: 'bg-card rounded-b-xl mt-[2px]',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

// Card Component
function Card({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'div';
  return (
    <CardContext.Provider value={{ variant: variant || 'default' }}>
      <Comp data-slot="card" className={cn(cardVariants({ variant }), className)} {...props} />
    </CardContext.Provider>
  );
}

// CardHeader Component
function CardHeader({ className, asChild = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const { variant } = useCardContext();
  const Comp = asChild ? Slot : 'div';
  return <Comp data-slot="card-header" className={cn(cardHeaderVariants({ variant }), className)} {...props} />;
}

// CardContent Component
function CardContent({ className, asChild = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const { variant } = useCardContext();
  const Comp = asChild ? Slot : 'div';
  return <Comp data-slot="card-content" className={cn(cardContentVariants({ variant }), className)} {...props} />;
}

// CardTable Component
function CardTable({ className, asChild = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const { variant } = useCardContext();
  const Comp = asChild ? Slot : 'div';
  return <Comp data-slot="card-table" className={cn(cardTableVariants({ variant }), className)} {...props} />;
}

// CardFooter Component
function CardFooter({ className, asChild = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const { variant } = useCardContext();
  const Comp = asChild ? Slot : 'div';
  return <Comp data-slot="card-footer" className={cn(cardFooterVariants({ variant }), className)} {...props} />;
}

// Other Components
function CardHeading({ className, asChild = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'div';
  return <Comp data-slot="card-heading" className={cn('space-y-1', className)} {...props} />;
}

function CardToolbar({ className, asChild = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'div';
  return <Comp data-slot="card-toolbar" className={cn('flex items-center gap-2.5', className)} {...props} />;
}

function CardTitle({ className, asChild = false, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'h3';
  return (
    <Comp
      data-slot="card-title"
      className={cn('text-base font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

function CardDescription({ className, asChild = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'div';
  return <Comp data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

// Exports
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardHeading, CardTable, CardTitle, CardToolbar };
