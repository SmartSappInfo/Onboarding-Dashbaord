'use client';

/**
 * @fileoverview Persistent Meetings Shell Layout Component (Meetings 2.0).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Keeps MeetingsNavigation permanently mounted across all 16 meetings views,
 *   enabling instantaneous client-side SPA tab switching with zero full-page reload flicker.
 * - Suppresses the top navigation bar automatically on distraction-free studio pages
 *   (e.g., live webinar stage and full-page canvas editors).
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { PageContainerFluid } from '@/components/ui/page-container';
import { MeetingsNavigation } from './MeetingsNavigation';

interface MeetingsShellProps {
  children: React.ReactNode;
}

export function MeetingsShell({ children }: MeetingsShellProps) {
  const pathname = usePathname();

  // Check if current route is a distraction-free studio or full-screen wizard
  const isDistractionFreeStudio = React.useMemo(() => {
    return (
      pathname.includes('/webinar') ||
      pathname.endsWith('/edit')
    );
  }, [pathname]);

  if (isDistractionFreeStudio) {
    return <div className="w-full min-h-screen">{children}</div>;
  }

  return (
    <PageContainerFluid>
      <MeetingsNavigation />
      <div className="w-full">{children}</div>
    </PageContainerFluid>
  );
}
