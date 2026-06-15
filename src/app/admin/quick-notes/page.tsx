import { Suspense } from 'react';
import type { Metadata } from 'next';
import QuickNotesClient from './components/QuickNotesClient';
import Loading from './loading';

export const metadata: Metadata = {
  title: 'Quick Notes',
  description: 'A consolidated, AI-assisted workspace for all your notes — rich text, categories, linking, and search.',
};

export default function QuickNotesPage() {
  // QuickNotesClient reads useSearchParams (deep-link ?category=…), so it must
  // sit behind a Suspense boundary to avoid a CSR bailout (next-best-practices).
  return (
    <Suspense fallback={<Loading />}>
      <div className="font-figtree">
        <QuickNotesClient />
      </div>
    </Suspense>
  );
}
