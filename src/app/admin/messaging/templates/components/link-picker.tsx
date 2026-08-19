'use client';

import * as React from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link, Search, ChevronDown, RefreshCw } from 'lucide-react';
import { getBaseUrl } from '@/lib/utils/url-helpers';

import { useTerminology } from '@/hooks/use-terminology';

interface LinkPickerProps {
  onSelect: (url: string, item?: ResourceItem) => void;
}

export interface ResourceItem {
  id: string;
  name: string;        // Internal Name (Prominent Heading)
  subtitle?: string;   // Page Title / Description (Secondary Subtitle)
  path: string;        // Target URL path (hidden from list view)
  duration?: string;   // Audio/Video duration if available (e.g. "2:15")
  mediaUrl?: string;   // Direct media source URL if available
}

const PREDEFINED_PAGES: ResourceItem[] = [
  { id: 'static-1', name: 'Collect Fees Within Four Weeks', subtitle: 'Four-week fee collection landing page', path: '/collect-fees-within-four-weeks' },
  { id: 'static-2', name: 'Collecting Fees Without Delays', subtitle: 'Fee collection process page', path: '/collecting-fees-without-delays-and-parental-confrontations' },
  { id: 'static-3', name: 'Number One Choice', subtitle: 'Admissions choice landing page', path: '/number-one-choice' },
  { id: 'static-4', name: 'School Enrollment', subtitle: 'General school enrollment page', path: '/school-enrollment' },
  { id: 'static-5', name: 'School Visibility & Enrollment', subtitle: 'Visibility initiative landing page', path: '/school-visibility-and-enrollment-initiative' },
  { id: 'static-6', name: 'Thank You', subtitle: 'Standard thank you page', path: '/thank-you' },
];

export const DYNAMIC_VARIABLES: ResourceItem[] = [
  { id: 'dyn-entity-console', name: 'Target Entity Console', subtitle: '{{entity_console_link}} — Direct link to entity profile in admin console', path: '{{entity_console_link}}' },
  { id: 'dyn-entity-url', name: 'Target Entity Link', subtitle: '{{entity_link}} — Direct URL for recipient entity', path: '{{entity_link}}' },
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
  const { singular } = useTerminology();
  const entityLabel = singular || 'Entity';
  const [search, setSearch] = React.useState<string>('');
  const [targetType, setTargetType] = React.useState<string>('dynamic');
  const [loading, setLoading] = React.useState<boolean>(false);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  // Dynamic variables with active terminology translation
  const dynamicVariables: ResourceItem[] = React.useMemo(() => [
    { id: 'dyn-entity-console', name: `Target ${entityLabel} Console`, subtitle: `{{entity_console_link}} — Direct link to ${entityLabel.toLowerCase()} profile in admin console`, path: '{{entity_console_link}}' },
    { id: 'dyn-entity-url', name: `Target ${entityLabel} Link`, subtitle: `{{entity_link}} — Direct URL for ${entityLabel.toLowerCase()}`, path: '{{entity_link}}' },
    { id: 'dyn-1', name: 'Personalized Survey Link', subtitle: '{{survey_link}} — Recipient specific survey URL', path: '{{survey_link}}' },
    { id: 'dyn-2', name: 'Personalized Form Link', subtitle: '{{form_link}} — Recipient specific form URL', path: '{{form_link}}' },
    { id: 'dyn-3', name: 'Personalized Agreement Link', subtitle: '{{contract_link}} — Recipient specific agreement URL', path: '{{contract_link}}' },
    { id: 'dyn-4', name: 'Personalized Meeting Link', subtitle: '{{meeting_link}} — Recipient specific meeting URL', path: '{{meeting_link}}' },
    { id: 'dyn-5', name: 'Personalized Dashboard Link', subtitle: '{{dashboard_link}} — Recipient specific dashboard URL', path: '{{dashboard_link}}' },
    { id: 'dyn-6', name: 'Add to Calendar Link', subtitle: '{{calendar_link}} — Calendar event invitation URL', path: '{{calendar_link}}' },
    { id: 'dyn-7', name: 'Unsubscribe Link', subtitle: '{{unsubscribe_link}} — Recipient opt-out URL', path: '{{unsubscribe_link}}' },
    { id: 'dyn-8', name: 'Survey Results Link', subtitle: '{{result_url}} — Live survey analytics URL', path: '{{result_url}}' },
  ], [entityLabel]);

  // Cached resource stores to avoid re-fetching on tab switches
  const [resources, setResources] = React.useState<Record<string, ResourceItem[]>>({
    dynamic: dynamicVariables,
    static: PREDEFINED_PAGES,
  });

  React.useEffect(() => {
    setResources(prev => ({
      ...prev,
      dynamic: dynamicVariables,
    }));
  }, [dynamicVariables]);

  /**
   * PURPOSE: Lazy-loads published workspace items for the active targetType tab on demand.
   * Caches results in state so switching tabs avoids expensive network waterfalls or duplicate reads.
   *
   * CAUTION: Always respects isMounted flag to prevent state updates after unmount.
   * TESTABILITY: Fetches only the selected target type dataset and stores in resources[targetType].
   * RELATED SURFACES: PlainTextEditor.tsx, block-inspector.tsx, ComposerWizard.tsx.
   */
  React.useEffect(() => {
    if (!firestore || !activeWorkspaceId) return;
    if (targetType === 'dynamic' || targetType === 'static') return;
    if (resources[targetType]) return; // Already cached in memory

    let isMounted = true;
    setLoading(true);

    const fetchTargetResources = async () => {
      try {
        let fetched: ResourceItem[] = [];

        if (targetType === 'surveys') {
          const snap = await getDocs(
            query(collection(firestore, 'surveys'), where('workspaceIds', 'array-contains', activeWorkspaceId))
          );
          fetched = snap.docs.map((d) => {
            const data = d.data();
            const internalName = (data.internalName as string) || (data.name as string) || (data.title as string) || 'Untitled Survey';
            const publicTitle = data.title && data.title !== internalName ? (data.title as string) : undefined;
            return {
              id: d.id,
              name: internalName,
              subtitle: publicTitle,
              path: `/surveys/${data.slug || d.id}`,
            };
          });
        } else if (targetType === 'forms') {
          const snap = await getDocs(
            query(collection(firestore, 'pdfs'), where('workspaceIds', 'array-contains', activeWorkspaceId))
          );
          fetched = snap.docs.map((d) => {
            const data = d.data();
            const internalName = (data.internalName as string) || (data.name as string) || (data.title as string) || 'Untitled Form';
            const publicTitle = data.title && data.title !== internalName ? (data.title as string) : undefined;
            return {
              id: d.id,
              name: internalName,
              subtitle: publicTitle,
              path: `/p/f/${data.slug || d.id}`,
            };
          });
        } else if (targetType === 'pages') {
          const snap = await getDocs(
            query(collection(firestore, 'campaign_pages'), where('workspaceIds', 'array-contains', activeWorkspaceId))
          );
          fetched = snap.docs.map((d) => {
            const data = d.data();
            const internalName = (data.internalName as string) || (data.name as string) || (data.title as string) || 'Untitled Page';
            const publicTitle = (data.title || data.headline) && (data.title || data.headline) !== internalName
              ? (data.title || data.headline as string)
              : undefined;
            return {
              id: d.id,
              name: internalName,
              subtitle: publicTitle,
              path: `/p/${data.slug || d.id}`,
            };
          });
        } else if (targetType === 'bookings') {
          const snap = await getDocs(
            query(collection(firestore, 'booking_pages'), where('workspaceId', '==', activeWorkspaceId))
          );
          fetched = snap.docs.map((d) => {
            const data = d.data();
            const internalName = (data.internalName as string) || (data.name as string) || (data.title as string) || 'Untitled Booking Page';
            const publicTitle = data.title && data.title !== internalName ? (data.title as string) : undefined;
            return {
              id: d.id,
              name: internalName,
              subtitle: publicTitle,
              path: `/book/${data.slug || d.id}`,
            };
          });
        } else if (targetType === 'flipbooks') {
          const snap = await getDocs(
            query(
              collection(firestore, 'flipbooks'),
              where('workspaceId', '==', activeWorkspaceId),
              where('status', '==', 'published')
            )
          );
          fetched = snap.docs.map((d) => {
            const data = d.data();
            const internalName = (data.title as string) || 'Untitled Flipbook';
            const publicSubtitle = data.description ? (data.description as string) : `Page Count: ${data.pageCount || 1}`;
            return {
              id: d.id,
              name: internalName,
              subtitle: publicSubtitle,
              path: `/f/${data.slug || d.id}`,
            };
          });
        } else if (targetType === 'qrs' && activeOrganizationId) {
          const snap = await getDocs(
            collection(firestore, 'organizations', activeOrganizationId, 'workspaces', activeWorkspaceId, 'qr_codes')
          );
          fetched = snap.docs.map((d) => {
            const data = d.data();
            const internalName = (data.name as string) || (data.internalName as string) || 'Untitled QR';
            const publicSubtitle = (data.title as string) || (data.description as string) || undefined;
            return {
              id: d.id,
              name: internalName,
              subtitle: publicSubtitle,
              path: `/q/${data.shortPath || d.id}`,
            };
          });
        } else if (targetType === 'media') {
          // Fetch media_shares AND workspace media assets in parallel to guarantee accurate internal file reference name resolution
          const [sharesSnap, mediaSnap] = await Promise.all([
            getDocs(query(collection(firestore, 'media_shares'), where('workspaceId', '==', activeWorkspaceId))),
            getDocs(query(collection(firestore, 'media'), where('workspaceIds', 'array-contains', activeWorkspaceId))),
          ]);

          const mediaNameMap = new Map<string, string>();
          const mediaDurationMap = new Map<string, string>();
          const mediaUrlMap = new Map<string, string>();
          mediaSnap.docs.forEach((doc) => {
            const data = doc.data();
            const assetName = (data.name as string) || (data.title as string) || (data.filename as string);
            if (assetName) {
              mediaNameMap.set(doc.id, assetName);
            }
            const assetDuration = (data.duration as string) || (data.mediaDuration as string) || (data.formattedDuration as string);
            if (assetDuration) {
              mediaDurationMap.set(doc.id, assetDuration);
            }
            const directUrl = (data.url as string) || (data.linkUrl as string);
            if (directUrl) {
              mediaUrlMap.set(doc.id, directUrl);
            }
          });

          fetched = sharesSnap.docs.map((d) => {
            const data = d.data();
            const effectiveSlug = (data.slug as string)?.trim() || d.id;
            const assetId = data.assetId as string | undefined;
            const resolvedAssetName = (data.assetName as string) || (assetId ? mediaNameMap.get(assetId) : undefined) || (data.internalName as string) || (data.name as string);
            const publicTitle = (data.title as string)?.trim();
            const duration = (data.duration as string) || (data.mediaDuration as string) || (assetId ? mediaDurationMap.get(assetId) : undefined);
            const mediaUrl = (data.url as string) || (assetId ? mediaUrlMap.get(assetId) : undefined);

            const internalName = resolvedAssetName || publicTitle || 'Untitled Shared Media';
            const subtitle = publicTitle || internalName;

            return {
              id: d.id,
              name: internalName,
              subtitle,
              path: `/m/${effectiveSlug}`,
              duration,
              mediaUrl,
            };
          });
        }

        if (isMounted) {
          setResources((prev) => ({ ...prev, [targetType]: fetched }));
        }
      } catch (error) {
        console.error(`[LinkPicker] Failed to fetch resources for targetType "${targetType}":`, error);
        if (isMounted) {
          setResources((prev) => ({ ...prev, [targetType]: [] }));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTargetResources();

    return () => {
      isMounted = false;
    };
  }, [firestore, activeWorkspaceId, activeOrganizationId, targetType, resources]);

  const activeItems = resources[targetType] || [];

  /**
   * PURPOSE: Filters available link items based on search query matching across internal name,
   * subtitle/public title, and URL path.
   *
   * CAUTION: Ensures items can still be searched by URL slug even when URLs are hidden from display.
   * TESTABILITY: Search matches on 'internalName', 'subtitle', or 'path'.
   * RELATED SURFACES: LinkPicker.tsx.
   */
  const filteredItems = activeItems.filter(
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
   * CAUTION: Passes selected ResourceItem metadata to onSelect to allow auto-populating titles and durations.
   * RELATED SURFACES: PlainTextEditor.tsx, block-inspector.tsx, ComposerWizard.tsx.
   */
  const handleSelect = (item: ResourceItem) => {
    const fullUrl = item.path.startsWith('/') ? `${getBaseUrl()}${item.path}` : item.path;
    onSelect(fullUrl, item);
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
              requestAnimationFrame(() => {
                searchInputRef.current?.focus();
              });
            }}
            className="w-full h-11 px-3.5 pr-10 rounded-xl bg-background border border-border/60 font-semibold text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground dark:bg-zinc-900"
          >
            <option value="dynamic" className="bg-background dark:bg-zinc-900 text-foreground">Dynamic Variables (rsvp, survey...)</option>
            <option value="surveys" className="bg-background dark:bg-zinc-900 text-foreground">Published Workspace Surveys</option>
            <option value="forms" className="bg-background dark:bg-zinc-900 text-foreground">Published Forms & PDFs</option>
            <option value="media" className="bg-background dark:bg-zinc-900 text-foreground">Shared Media Pages</option>
            <option value="flipbooks" className="bg-background dark:bg-zinc-900 text-foreground">Interactive Flipbooks</option>
            <option value="pages" className="bg-background dark:bg-zinc-900 text-foreground">Published Campaign Pages</option>
            <option value="bookings" className="bg-background dark:bg-zinc-900 text-foreground">Published Booking Pages</option>
            <option value="qrs" className="bg-background dark:bg-zinc-900 text-foreground">QR Studio Codes</option>
            <option value="static" className="bg-background dark:bg-zinc-900 text-foreground">Predefined Static Pages</option>
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
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search matching published items..."
            className="pl-9 h-11 rounded-xl bg-muted/20 border-none shadow-none text-sm placeholder:text-muted-foreground/45"
          />
        </div>
        
        <ScrollArea className="h-64 border border-border/50 rounded-2xl p-2 bg-muted/5 mt-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <span className="text-xs font-semibold">Loading published items...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground/60">No matching published items found.</div>
          ) : (
            <div className="grid grid-cols-1 gap-1">
              {filteredItems.map((item) => (
                <button
                  key={item.id || item.path}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="flex items-center justify-between text-left p-3 rounded-xl hover:bg-primary/[0.04] active:scale-[0.98] transition-all duration-200 group border border-transparent hover:border-primary/10 min-h-[44px] touch-manipulation"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {item.name}
                      </span>
                      {item.duration && (
                        <span className="text-[9px] font-black tabular-nums bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md border border-indigo-500/20 shrink-0">
                          {item.duration}
                        </span>
                      )}
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
