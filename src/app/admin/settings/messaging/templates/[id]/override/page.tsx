import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import OverrideTemplateClient from './OverrideTemplateClient';

export const metadata = {
  title: 'Override Template | Settings',
  description: 'Create or edit organization template override',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OverrideTemplatePage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="flex-1 space-y-6 p-8">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <OverrideTemplateClient templateId={id} />
      </Suspense>
    </div>
  );
}
