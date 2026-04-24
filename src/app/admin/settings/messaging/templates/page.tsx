import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import OrgTemplateListClient from './components/OrgTemplateListClient';

export const metadata = {
  title: 'Message Templates | Settings',
  description: 'Manage organization message templates',
};

export default function OrgTemplatesPage() {
  return (
    <div className="flex-1 space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Message Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View global templates and create organization-specific overrides
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <OrgTemplateListClient />
      </Suspense>
    </div>
  );
}
