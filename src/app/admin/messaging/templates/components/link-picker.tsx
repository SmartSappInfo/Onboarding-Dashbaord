'use client';

import * as React from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link, Search, ChevronDown } from 'lucide-react';
import type { Survey, CampaignPage, BookingPage, QRCode } from '@/lib/types';
import { getBaseUrl } from '@/lib/utils/url-helpers';

interface LinkPickerProps {
  onSelect: (url: string) => void;
}

interface ResourceItem {
  id: string;
  name: string;        // Internal Name (Prominent Heading)
  subtitle?: string;   // Page Title / Description (Secondary Subtitle)
  path: string;        // Target URL path (hidden from list view)
}

const PREDEFINED_PAGES: ResourceItem[] = [
  { id: 'static-1', name: 'Collect Fees Within Four Weeks', subtitle: 'Four-week fee collection landing page', path: '/collect-fees-within-four-weeks' },
  { id: 'static-2', name: 'Collecting Fees Without Delays', subtitle: 'Fee collection process page', path: '/collecting-fees-without-delays-and-parental-confrontations' },
  { id: 'static-3', name: 'Number One Choice', subtitle: 'Admissions choice landing page', path: '/number-one-choice' },
  { id: 'static-4', name: 'School Enrollment', subtitle: 'General school enrollment page', path: '/school-enrollment' },
  { id: 'static-5', name: 'School Visibility & Enrollment', subtitle: 'Visibility initiative landing page', path: '/school-visibility-and-enrollment-initiative' },
  { id: 'static-6', name: 'Thank You', subtitle: 'Standard thank you page', path: '/thank-you' },
];

const DYNAMIC_VARIABLES: ResourceItem[] = [
  { id: 'dyn-1', name: 'Personalized Survey Link', subtitle: '{{survey_link}} — Recipient specific survey URL', path: '{{survey_link}}' },
  { id: 'dyn-2', name: 'Personalized Form Link', subtitle: '{{form_link}} — Recipient specific form URL', path: '{{form_link}}' },
  { id: 'dyn-3', name: 'Personalized Agreement Link', subtitle: '{{contract_link}} — Recipient specific agreement URL', path: '{{contract_link}}' },
  { id: 'dyn-4', name: 'Personalized Meeting Link', subtitle: '{{meeting_link}} — Recipient specific meeting URL', path: '{{meeting_link}}' },
  { id: 'dyn-5', name: 'Personalized Dashboard Link', subtitle: '{{dashboard_link}} — Recipient specific dashboard URL', path: '{{dashboard_link}}' },
  { id: 'dyn-6', name: 'Add to Calendar Link', subtitle: '{{calendar_link}} — Calendar event invitation URL', path: '{{calendar_link}}' },
  { id: 'dyn-7', name: 'Unsubscribe Link', subtitle: '{{unsubscribe_link}} — Recipient opt-out URL', path: '{{unsubscribe_link}}' },
  { id: 'dyn-8', name: 'Survey Results Link', subtitle: '{{result_url}} — Live survey analytics URL', path: '{{result_url}}' },
];

export function LinkPicker({ onSelect }: LinkPickerProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const [search, setSearch] = React.useState<string>('');
  const [targetType, setTargetType] = React.useState<string>('dynamic');

  const [surveys, setSurveys] = React.useState<ResourceItem[]>([]);
  const [forms, setForms] = React.useState<ResourceItem[]>([]);
  const [mediaShares, setMediaShares] = React.useState<ResourceItem[]>([]);
  const [pages, setPages] = React.useState<ResourceItem[]>([]);
  const [bookings, setBookings] = React.useState<ResourceItem[]>([]);
  const [qrs, setQrs] = React.useState<ResourceItem[]>([]);

  React.useEffect(() => {
    if (!firestore || !activeWorkspaceId) return;

    const fetchResources = async () => {
      try {
        // 1. Fetch Surveys
        const surveySnap = await getDocs(
          query(collection(firestore, 'surveys'), where('workspaceIds', 'array-contains', activeWorkspaceId))
        );
        const fetchedSurveys = surveySnap.docs.map((d) => {
          const data = d.data() as Survey & { internalName?: string; name?: string };
          const internalName = data.internalName || data.name || data.title || 'Untitled Survey';
          const publicTitle = data.title && data.title !== internalName ? data.title : undefined;
          return {
            id: d.id,
            name: internalName,
            subtitle: publicTitle,
            path: `/surveys/${data.slug || d.id}`,
          };
        });
        setSurveys(fetchedSurveys);

        // 2. Fetch Forms
        const formSnap = await getDocs(
          query(collection(firestore, 'pdfs'), where('workspaceIds', 'array-contains', activeWorkspaceId))
        );
        const fetchedForms = formSnap.docs.map((d) => {
          const data = d.data() as { name?: string; internalName?: string; title?: string; slug?: string };
          const internalName = data.internalName || data.name || data.title || 'Untitled Form';
          const publicTitle = data.title && data.title !== internalName ? data.title : undefined;
          return {
            id: d.id,
            name: internalName,
            subtitle: publicTitle,
            path: `/p/f/${data.slug || d.id}`,
          };
        });
        setForms(fetchedForms);

        // 3. Fetch Pages
        const pageSnap = await getDocs(
          query(collection(firestore, 'campaign_pages'), where('workspaceIds', 'array-contains', activeWorkspaceId))
        );
        const fetchedPages = pageSnap.docs.map((d) => {
          const data = d.data() as CampaignPage & { internalName?: string; headline?: string };
          const internalName = data.internalName || data.name || data.title || 'Untitled Page';
          const publicTitle = (data.title || data.headline) && (data.title || data.headline) !== internalName
            ? (data.title || data.headline)
            : undefined;
          return {
            id: d.id,
            name: internalName,
            subtitle: publicTitle,
            path: `/p/${data.slug || d.id}`,
          };
        });
        setPages(fetchedPages);

        // 4. Fetch Bookings
        const bookingSnap = await getDocs(
          query(collection(firestore, 'booking_pages'), where('workspaceId', '==', activeWorkspaceId))
        );
        const fetchedBookings = bookingSnap.docs.map((d) => {
          const data = d.data() as BookingPage & { internalName?: string; name?: string };
          const internalName = data.internalName || data.name || data.title || 'Untitled Booking Page';
          const publicTitle = data.title && data.title !== internalName ? data.title : undefined;
          return {
            id: d.id,
            name: internalName,
            subtitle: publicTitle,
            path: `/book/${data.slug || d.id}`,
          };
        });
        setBookings(fetchedBookings);

        // 5. Fetch QRs
        if (activeOrganizationId) {
          const qrSnap = await getDocs(
            collection(firestore, 'organizations', activeOrganizationId, 'workspaces', activeWorkspaceId, 'qr_codes')
          );
          const fetchedQrs = qrSnap.docs.map((d) => {
            const data = d.data() as QRCode & { internalName?: string; title?: string };
            const internalName = data.name || data.internalName || 'Untitled QR';
            const publicSubtitle = data.title || data.description || undefined;
            return {
              id: d.id,
              name: internalName,
              subtitle: publicSubtitle,
              path: `/q/${data.shortPath || d.id}`,
            };
          });
          setQrs(fetchedQrs);
        }

        // 6. Fetch Shared Media Pages
        const mediaSnap = await getDocs(
          query(collection(firestore, 'media_shares'), where('workspaceId', '==', activeWorkspaceId))
        );
        const fetchedMedia = mediaSnap.docs.map((d) => {
          const data = d.data() as {
            internalName?: string;
            name?: string;
            assetName?: string;
            title?: string;
            assetId?: string;
            slug?: string;
          };
          const effectiveSlug = data.slug?.trim() || d.id;
          const internalName = data.internalName || data.name || data.assetName || data.title || 'Untitled Media Share';
          const publicTitle = data.title && data.title !== internalName ? data.title : undefined;
          return {
            id: d.id,
            name: internalName,
            subtitle: publicTitle,
            path: `/m/${effectiveSlug}`,
          };
        });
        setMediaShares(fetchedMedia);
      } catch (error) {
        console.error('[LinkPicker] Failed to fetch links:', error);
      }
    };

    fetchResources();
  }, [firestore, activeWorkspaceId, activeOrganizationId]);

  const getItemsForTarget = (): ResourceItem[] => {
    switch (targetType) {
      case 'dynamic':
        return DYNAMIC_VARIABLES;
      case 'surveys':
        return surveys;
      case 'forms':
        return forms;
      case 'media':
        return mediaShares;
      case 'pages':
        return pages;
      case 'bookings':
        return bookings;
      case 'qrs':
        return qrs;
      case 'static':
        return PREDEFINED_PAGES;
      default:
        return [];
    }
  };

  /**
   * PURPOSE: Filters available link items based on search query matching across internal name,
   * subtitle/public title, and URL path.
   *
   * CAUTION: Ensures items can still be searched by URL slug even when URLs are hidden from display.
   * TESTABILITY: Search matches on 'internalName', 'subtitle', or 'path'.
   * RELATED SURFACES: LinkPicker.tsx.
   */
  const filteredItems = getItemsForTarget().filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(search.toLowerCase())) ||
      item.path.toLowerCase().includes(search.toLowerCase())
  );

  /**
   * PURPOSE: Selects a link target and formats internal relative paths as fully-qualified absolute URLs.
   * Internal relative paths starting with '/' (e.g. '/m/9Kmtlz6ncX9Uf9dtWUo2') are automatically
   * prepended with getBaseUrl() (e.g. 'https://go.smartsapp.com/m/9Kmtlz6ncX9Uf9dtWUo2').
   * Dynamic variables starting with '{{' (e.g. '{{survey_link}}') remain variable tokens.
   *
   * CAUTION: Always use getBaseUrl() to resolve domain dynamically in browser context.
   * RELATED SURFACES: PlainTextEditor.tsx, block-inspector.tsx, ComposerWizard.tsx.
   */
  const handleSelect = (path: string) => {
    const fullUrl = path.startsWith('/') ? `${getBaseUrl()}${path}` : path;
    onSelect(fullUrl);
    setSearch('');
  };

  return (
    <div className="w-full p-4 rounded-2xl border border-border/80 bg-muted/10 space-y-4 text-left animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Target Type</label>
        <div className="relative">
          <select
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value);
              setSearch('');
            }}
            className="w-full h-11 px-3.5 pr-10 rounded-xl bg-muted/20 border-none font-semibold text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-800"
          >
            <option value="dynamic">Dynamic Variables (rsvp, survey...)</option>
            <option value="surveys">Published Workspace Surveys</option>
            <option value="forms">Published Forms & PDFs</option>
            <option value="media">Shared Media Pages</option>
            <option value="pages">Published Campaign Pages</option>
            <option value="bookings">Published Booking Pages</option>
            <option value="qrs">QR Studio Codes</option>
            <option value="static">Predefined Static Pages</option>
          </select>
          <div className="absolute right-3.5 top-3.5 pointer-events-none text-muted-foreground/50">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Link Target</label>
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search matching published items..."
            className="pl-9 h-11 rounded-xl bg-muted/20 border-none shadow-none text-sm placeholder:text-muted-foreground/45"
          />
        </div>
        
        <ScrollArea className="h-64 border border-border/50 rounded-2xl p-2 bg-muted/5 mt-2">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground/60">No matching published items found.</div>
          ) : (
            <div className="grid grid-cols-1 gap-1">
              {filteredItems.map((item) => (
                <button
                  key={item.id || item.path}
                  type="button"
                  onClick={() => handleSelect(item.path)}
                  className="flex items-center justify-between text-left p-3 rounded-xl hover:bg-primary/[0.04] active:scale-[0.98] transition-all duration-200 group border border-transparent hover:border-primary/10 min-h-[44px] touch-manipulation"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {item.name}
                    </div>
                    {item.subtitle && (
                      <div className="text-xs text-muted-foreground/80 font-medium line-clamp-1">
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  <Link className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary shrink-0 ml-2 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
