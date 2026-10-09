import { Suspense } from 'react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import PromptsLibraryClient from './PromptsLibraryClient';

export const metadata = {
  title: 'AI Prompt Library | Workspace Settings',
};

export default function PromptsLibraryPage() {
  return (
    <PageContainerFluid>
      <div className="flex flex-col gap-6 w-full text-left pb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              AI Prompt Library
            </h1>
            <CardInfoTooltip text="Manage AI capabilities, customize templates, and configure dynamic prompt workflows." />
          </div>
        </div>

        <Suspense fallback={<div className="animate-pulse h-64 bg-muted/20 rounded-2xl" />}>
          <PromptsLibraryClient />
        </Suspense>
      </div>
    </PageContainerFluid>
  );
}
