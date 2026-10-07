import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { PageContainer } from '@/components/ui/page-container';
import OrgTemplateListClient from './components/OrgTemplateListClient';

export const metadata = {
  title: 'Message Templates | Settings',
  description: 'Manage organization message templates',
};

export default function OrgTemplatesPage() {
  return (
    <PageContainer>
      <div className="space-y-6 pb-24">
        <div className="flex items-center gap-2.5 border-b border-border/80 pb-5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Message Templates</h1>
          <CardInfoTooltip text="View global templates and create organization-specific overrides." />
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
    </PageContainer>
  );
}
