'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, ArrowLeft, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/context/NavigationContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTerminology } from '@/hooks/use-terminology';
import { useWorkspace } from '@/context/WorkspaceContext';

/**
 * @fileOverview High-fidelity Breadcrumb Navigation with Adaptive Truncation and ID Filtering.
 * Maps technical path segments to human-readable labels. Technical IDs (like Firestore UIDs)
 * are automatically suppressed unless they have a resolved custom label (e.g. School Name).
 */

interface BreadcrumbItem {
  label: string;
  path: string;
  isLast: boolean;
  isCollapsed?: boolean;
}

const segmentMap: Record<string, string> = {
  admin: 'Dashboard',
  intelligence: 'Intelligence',
  agents: 'Agent Persona Studio',
  runs: 'Mission Control',
  webhooks: 'Webhooks',
  approvals: 'Approvals',
  workflows: 'Workflows',
  tasks: 'Tasks',
  calendar: 'Calendar',
  forms: 'Forms',
  workforce: 'AI Workforce',
  'command-center': 'Command Center',
  'creative-studio': 'Creative Studio',
  projects: 'Projects',
  brand: 'Brand Studio',
  publishing: 'Publishing',
  experiments: 'Experiments',
  social: 'Social',
  listening: 'Social Listening',
  composer: 'Composer',
  coaching: 'Coaching',
  documents: 'Documents',
  governance: 'Governance',
  'sales-performance': 'Sales Performance',
  'sales-orchestration': 'Sales Orchestration',
  'lead-intelligence': 'Lead Intelligence',
  'deal-intelligence': 'Deal Intelligence',
  'verify-studio': 'Verify Studio',
  'qr-studio': 'QR Studio',
  mcp: 'MCP',
  seeds: 'Seeds',
  knowledge: 'Knowledge',
  roles: 'Roles',
  organizations: 'Organizations',
  developer: 'Developer',
  invitation: 'Invitations',
  whatsapp: 'WhatsApp',
  fields: 'Fields & Variables',
  optimize: 'Optimize',
  tags: 'Tags',
  contacts: 'Contacts',
  metrics: 'Contact Metrics',
  imports: 'Imports',
  upload: 'Bulk Upload',
  entities: 'Directory',
  schools: 'Directory',
  prospects: 'Lead Pipeline',
  pipeline: 'Pipeline',
  deals: 'Pipeline',
  meetings: 'Meetings',
  portals: 'Portals',
  media: 'Media',
  surveys: 'Surveys',
  pdfs: 'PDF Studio',
  messaging: 'Messaging',
  templates: 'Templates',
  'call-centre': 'Call Centre',
  activities: 'Audit Trail',
  users: 'Users',
  profile: 'Profile',
  settings: 'Settings',
  new: 'New',
  edit: 'Edit',
  results: 'Analytics',
  logs: 'Logs',
  scheduled: 'Queue',
  variables: 'Variables',
  styles: 'Styles',
  profiles: 'Profiles',
  ai: 'AI Architect',
  submissions: 'Records',
  finance: 'Finance',
  automations: 'Automations',
  reports: 'Reports',
  invoices: 'Invoices',
  packages: 'Pricing Tiers',
  periods: 'Billing Cycles',
  pages: 'Landing Pages',
  builder: 'Builder',
  crm: 'CRM',
  'enterprise-identity': 'Enterprise Identity',
  'revenue-forecasting': 'Revenue Forecasting',
  'revenue-operating-system': 'Revenue OS',
  'sales-command': 'Sales Command',
  'quick-notes': 'Quick Notes',
  'booking-pages': 'Booking Pages',
  'my-day': 'My Day',
  companybrain: 'Company Brain',
  'ai-sales-workforce': 'AI Sales Workforce',
  flipbooks: 'Flipbooks',
};

function formatSegmentTitle(segment: string): string {
  if (/^[a-zA-Z0-9_-]{20,}$/.test(segment)) return '';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(segment)) return '';
  if (/^[0-9]+$/.test(segment)) return '';
  return segment
    .split(/[-_]/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function BreadcrumbNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { customLabels } = useNavigation();
  const { plural } = useTerminology();
  const { activeWorkspace } = useWorkspace();

  const workspacePipelineLabel = React.useMemo(() => {
    const wsName = activeWorkspace?.name?.trim();
    if (!wsName) return 'Pipeline';
    if (wsName.toLowerCase().endsWith('pipeline')) {
      return wsName;
    }
    return `${wsName} Pipeline`;
  }, [activeWorkspace?.name]);

  const segments = pathname.split('/').filter(Boolean);
  const track = searchParams.get('track');
  
  // LOGIC: Build items while filtering out technical IDs
  const breadcrumbItems = React.useMemo(() => {
    const rawItems: BreadcrumbItem[] = [];
    let currentPath = '';
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath += `/${segment}`;
      
      // Omit the redundant root '/admin' / 'Dashboard' segment so breadcrumbs
      // begin directly with the functional module (saving critical width on mobile)
      if (currentPath === '/admin') {
        continue;
      }

      const customLabel = customLabels[currentPath];
      let fallbackLabel = segmentMap[segment] || formatSegmentTitle(segment);
      if (segment === 'schools' || segment === 'entities') {
        fallbackLabel = plural.toLowerCase().endsWith('contacts') ? plural : `${plural} Contacts`;
      } else if (segment === 'pipeline' || segment === 'deals') {
        fallbackLabel = workspacePipelineLabel;
      }
      
      const resolvedLabel = customLabel || fallbackLabel;
      
      // If we have a human-readable label (from map or resolved from DB/slug), include it.
      if (resolvedLabel) {
        let path = currentPath;
        if (currentPath === '/admin/deals') {
          path = '/admin/pipeline';
        } else if (currentPath === '/admin/call-centre' || currentPath === '/admin/messaging/call-centre') {
          if (pathname.includes('/scripts/')) {
            path = '/admin/call-centre?tab=scripts';
          } else if (pathname.includes('/campaigns/') || pathname.includes('/workspace/') || pathname.includes('/analytics/')) {
            path = '/admin/call-centre?tab=campaigns';
          } else {
            path = '/admin/call-centre';
          }
        }
        if (track) {
          const separator = path.includes('?') ? '&' : '?';
          path = `${path}${separator}track=${track}`;
        }

        rawItems.push({
          label: resolvedLabel,
          path,
          isLast: false,
        });
      }
    }

    const mode = searchParams.get('mode');
    if (pathname === '/admin/messaging/templates' && (mode === 'edit' || mode === 'new')) {
      rawItems.push({
        label: mode === 'new' ? 'New' : 'Edit',
        path: pathname + '?' + searchParams.toString(),
        isLast: false,
      });
    }

    // Defensive filter: Guarantee root '/admin' / 'Dashboard' is never shown as a leading item
    const visibleItems = rawItems.filter((item, idx) => {
      if (idx === 0 && (item.label === 'Dashboard' || item.path.replace(/\?.*$/, '') === '/admin')) {
        return false;
      }
      return true;
    });

    if (visibleItems.length > 0) {
      visibleItems[visibleItems.length - 1].isLast = true;
    }

    return visibleItems;
  }, [segments, customLabels, pathname, track, plural, searchParams, workspacePipelineLabel]);

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
      let parentPath = `/${segments.slice(0, segments.length - 1).join('/')}`;
      if (parentPath === '/admin/deals') {
        parentPath = '/admin/pipeline';
      }
      router.push(parentPath);
    } else {
      router.push('/admin');
    }
  };

  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath === '/admin' || breadcrumbItems.length === 0) {
    return <span className="text-xs font-semibold text-foreground opacity-40 truncate whitespace-nowrap block">System Dashboard</span>;
  }

  return (
    <nav className="flex items-center gap-2 sm:gap-3 overflow-hidden">
      <Button 
        variant="ghost" 
        size="icon" 
        type="button"
        onClick={handleBack}
        className="h-8 w-8 rounded-lg shrink-0 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all active:scale-[0.97]"
        aria-label="Go back"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold overflow-hidden">
        {displayItems.map((item, index) => {
          const showSeparator = index > 0;

          return (
            <React.Fragment key={`${item.path}-${index}`}>
              {showSeparator && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
              )}
              
              {item.isLast ? (
                <span className="truncate text-foreground max-w-[120px] sm:max-w-md font-medium">
                  {item.label}
                </span>
              ) : item.isCollapsed ? (
                <span className="text-muted-foreground/30 inline-flex items-center" aria-label="More segments" role="img">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </span>
              ) : (
                <Link 
                  href={item.path}
                  className="text-muted-foreground/60 hover:text-primary transition-colors whitespace-nowrap font-medium"
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
