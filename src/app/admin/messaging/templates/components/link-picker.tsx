'use client';

import * as React from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link, Search, ChevronDown } from 'lucide-react';
import type { Survey, CampaignPage, BookingPage, QRCode } from '@/lib/types';

interface LinkPickerProps {
  onSelect: (url: string) => void;
}

interface ResourceItem {
  id: string;
  name: string;
  path: string;
}

const PREDEFINED_PAGES: ResourceItem[] = [
  { id: 'static-1', name: 'Collect Fees Within Four Weeks', path: '/collect-fees-within-four-weeks' },
  { id: 'static-2', name: 'Collecting Fees Without Delays', path: '/collecting-fees-without-delays-and-parental-confrontations' },
  { id: 'static-3', name: 'Number One Choice', path: '/number-one-choice' },
  { id: 'static-4', name: 'School Enrollment', path: '/school-enrollment' },
  { id: 'static-5', name: 'School Visibility & Enrollment', path: '/school-visibility-and-enrollment-initiative' },
  { id: 'static-6', name: 'Thank You', path: '/thank-you' },
];

const DYNAMIC_VARIABLES: ResourceItem[] = [
  { id: 'dyn-1', name: 'Personalized Survey Link', path: '{{survey_link}}' },
  { id: 'dyn-2', name: 'Personalized Form Link', path: '{{form_link}}' },
  { id: 'dyn-3', name: 'Personalized Agreement Link', path: '{{contract_link}}' },
  { id: 'dyn-4', name: 'Personalized Meeting Link', path: '{{meeting_link}}' },
  { id: 'dyn-5', name: 'Add to Calendar Link', path: '{{calendar_link}}' },
  { id: 'dyn-6', name: 'Unsubscribe Link', path: '{{unsubscribe_link}}' },
  { id: 'dyn-7', name: 'Survey Results Link', path: '{{result_url}}' },
];

export function LinkPicker({ onSelect }: LinkPickerProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const [search, setSearch] = React.useState<string>('');
  const [targetType, setTargetType] = React.useState<string>('dynamic');

  const [surveys, setSurveys] = React.useState<ResourceItem[]>([]);
  const [forms, setForms] = React.useState<ResourceItem[]>([]);
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
          const data = d.data() as Survey;
          return {
            id: d.id,
            name: data.internalName || data.title || 'Untitled Survey',
            path: `/surveys/${data.slug || d.id}`,
          };
        });
        setSurveys(fetchedSurveys);

        // 2. Fetch Forms
        const formSnap = await getDocs(
          query(collection(firestore, 'pdfs'), where('workspaceIds', 'array-contains', activeWorkspaceId))
        );
        const fetchedForms = formSnap.docs.map((d) => {
          const data = d.data() as { name?: string; title?: string; slug?: string };
          return {
            id: d.id,
            name: data.name || data.title || 'Untitled Form',
            path: `/p/f/${data.slug || d.id}`,
          };
        });
        setForms(fetchedForms);

        // 3. Fetch Pages
        const pageSnap = await getDocs(
          query(collection(firestore, 'campaign_pages'), where('workspaceIds', 'array-contains', activeWorkspaceId))
        );
        const fetchedPages = pageSnap.docs.map((d) => {
          const data = d.data() as CampaignPage;
          return {
            id: d.id,
            name: data.name || 'Untitled Page',
            path: `/p/${data.slug || d.id}`,
          };
        });
        setPages(fetchedPages);

        // 4. Fetch Bookings
        const bookingSnap = await getDocs(
          query(collection(firestore, 'booking_pages'), where('workspaceId', '==', activeWorkspaceId))
        );
        const fetchedBookings = bookingSnap.docs.map((d) => {
          const data = d.data() as BookingPage;
          return {
            id: d.id,
            name: data.title || 'Untitled Booking Page',
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
            const data = d.data() as QRCode;
            return {
              id: d.id,
              name: data.name || 'Untitled QR',
              path: `/q/${data.shortPath || d.id}`,
            };
          });
          setQrs(fetchedQrs);
        }
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

  const filteredItems = getItemsForTarget().filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.path.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (path: string) => {
    onSelect(path);
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
                  onClick={() => handleSelect(item.path)}
                  className="flex items-center justify-between text-left p-3 rounded-xl hover:bg-primary/[0.04] active:scale-[0.98] transition-all duration-200"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-755">{item.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{item.path}</div>
                  </div>
                  <Link className="h-3.5 w-3.5 text-muted-foreground/30" />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
