'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/context/NavigationContext';
import { cn } from '@/lib/utils';

/**
 * @fileOverview High-fidelity Breadcrumb Navigation.
 * Replaces the static page titles in the header. 
 * Maps technical path segments to human-readable labels.
 */

const segmentMap: Record<string, string> = {
  admin: 'Dashboard',
  schools: 'Schools',
  pipeline: 'Pipeline',
  meetings: 'Meetings',
  portals: 'Public Portals',
  media: 'Media',
  surveys: 'Surveys',
  pdfs: 'Doc Signing',
  messaging: 'Messaging Centre',
  activities: 'Activities',
  users: 'Team Management',
  profile: 'Profile',
  settings: 'Settings',
  new: 'New',
  edit: 'Edit',
  results: 'Results',
  composer: 'Composer',
  logs: 'Message Logs',
  scheduled: 'Scheduled Queue',
  variables: 'Variable Registry',
  styles: 'Visual Styles',
  profiles: 'Sender Profiles',
  ai: 'AI Architect',
  submissions: 'Submissions',
};

export function BreadcrumbNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { customLabels } = useNavigation();

  const segments = pathname.split('/').filter(Boolean);
  
  const breadcrumbItems = segments.map((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join('/')}`;
    // Try custom label (from Phase 2 resolution), then mapped label, then capitalized segment
    const label = customLabels[path] || segmentMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    
    return { label, path, isLast: index === segments.length - 1 };
  });

  const handleBack = () => {
    if (segments.length > 1) {
      // Logic: If in a sub-page, go up to parent.
      const parentPath = `/${segments.slice(0, segments.length - 1).join('/')}`;
      router.push(parentPath);
    } else {
      router.push('/admin');
    }
  };

  if (pathname === '/admin') {
    return <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground opacity-40">Operational Hub</span>;
  }

  return (
    <nav className="flex items-center gap-3 overflow-hidden">
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
      
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest overflow-hidden">
        {breadcrumbItems.map((item, index) => {
          // We usually hide the 'admin' (Dashboard) segment in breadcrumbs if we're deeper
          if (item.path === '/admin' && segments.length > 1) return null;

          return (
            <React.Fragment key={item.path}>
              {index > (segments[0] === 'admin' ? 1 : 0) && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
              )}
              {item.isLast ? (
                <span className="truncate text-foreground max-w-[200px] sm:max-w-md">
                  {item.label}
                </span>
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
