'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, ArrowLeft, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/context/NavigationContext';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * @fileOverview High-fidelity Breadcrumb Navigation with Adaptive Truncation.
 * Maps technical path segments to human-readable labels and collapses 
 * intermediate steps on mobile to prevent overflow.
 */

const segmentMap: Record<string, string> = {
  admin: 'Operational Hub',
  schools: 'Schools Directory',
  pipeline: 'Onboarding Pipeline',
  meetings: 'Session Registry',
  portals: 'Public Portals',
  media: 'Media Repository',
  surveys: 'Survey Intelligence',
  pdfs: 'Doc Signing Studio',
  messaging: 'Communications Centre',
  activities: 'Platform Audit Trail',
  users: 'Team Access Control',
  profile: 'Account Profile',
  settings: 'System Configuration',
  new: 'Initialization',
  edit: 'Design Studio',
  results: 'Analytics',
  composer: 'Message Composer',
  logs: 'Audit Logs',
  scheduled: 'Delivery Queue',
  variables: 'Contextual Registry',
  styles: 'Visual Styles',
  profiles: 'Sender Profiles',
  ai: 'AI Architect',
  submissions: 'Records',
};

export function BreadcrumbNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { customLabels } = useNavigation();

  const segments = pathname.split('/').filter(Boolean);
  
  const breadcrumbItems = segments.map((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join('/')}`;
    const label = customLabels[path] || segmentMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    
    return { label, path, isLast: index === segments.length - 1 };
  });

  // ADAPTIVE LOGIC: Collapse intermediate steps on mobile if path is deep
  const displayItems = React.useMemo(() => {
    if (!isMobile || breadcrumbItems.length <= 3) return breadcrumbItems;
    
    return [
      breadcrumbItems[0],
      { label: '...', path: '#', isLast: false, isCollapsed: true },
      ...breadcrumbItems.slice(-1)
    ];
  }, [breadcrumbItems, isMobile]);

  const handleBack = () => {
    if (segments.length > 1) {
      const parentPath = `/${segments.slice(0, segments.length - 1).join('/')}`;
      router.push(parentPath);
    } else {
      router.push('/admin');
    }
  };

  if (pathname === '/admin') {
    return <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground opacity-40">System Dashboard</span>;
  }

  return (
    <nav className="flex items-center gap-2 sm:gap-3 overflow-hidden">
      <Button 
        variant="ghost" 
        size="icon" 
        type="button"
        onClick={handleBack}
        className="h-8 w-8 rounded-lg shrink-0 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all active:scale-95"
        aria-label="Go back"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      
      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] font-black uppercase tracking-widest overflow-hidden">
        {displayItems.map((item, index) => {
          // Hide 'admin' segment in breadcrumbs if we're deeper
          if (item.path === '/admin' && segments.length > 1) return null;

          const showSeparator = index > (segments[0] === 'admin' ? 1 : 0);

          return (
            <React.Fragment key={index}>
              {showSeparator && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
              )}
              
              {item.isLast ? (
                <span className="truncate text-foreground max-w-[120px] sm:max-w-md">
                  {item.label}
                </span>
              ) : (item as any).isCollapsed ? (
                <span className="text-muted-foreground/30"><MoreHorizontal className="h-3 w-3" /></span>
              ) : (
                <Link 
                  href={item.path}
                  className="text-muted-foreground/60 hover:text-primary transition-colors whitespace-nowrap"
                >
                  {item.label}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}
