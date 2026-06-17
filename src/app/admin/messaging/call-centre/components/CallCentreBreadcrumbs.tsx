'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface CallCentreBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function CallCentreBreadcrumbs({ items }: CallCentreBreadcrumbsProps) {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace() as any;

  const handleNavigate = (href: string) => {
    if (!href) return;
    const separator = href.includes('?') ? '&' : '?';
    const finalHref = activeWorkspaceId ? `${href}${separator}track=${activeWorkspaceId}` : href;
    router.push(finalHref);
  };

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 select-none">
      <span
        onClick={() => handleNavigate('/admin/messaging')}
        className="cursor-pointer hover:text-primary transition-colors duration-200"
      >
        Communication Centre
      </span>
      <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        if (isLast || !item.href) {
          return (
            <React.Fragment key={index}>
              {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
              <span className="text-foreground truncate max-w-[150px] sm:max-w-[250px]">
                {item.label}
              </span>
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={index}>
            {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
            <span
              onClick={() => handleNavigate(item.href!)}
              className="cursor-pointer hover:text-primary transition-colors duration-200 truncate max-w-[150px] sm:max-w-[250px]"
            >
              {item.label}
            </span>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
