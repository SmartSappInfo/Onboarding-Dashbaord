import { Suspense } from 'react';
import PromptsLibraryClient from './PromptsLibraryClient';

export const metadata = {
  title: 'AI Prompt Library | Workspace Settings',
};

export default function PromptsLibraryPage() {
  return (
    <div className="flex flex-col gap-6 w-full text-left">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">AI Prompt Library</h1>
        <p className="text-muted-foreground mt-2">
          Manage AI capabilities, customize templates, and configure dynamic prompt workflows.
        </p>
      </div>

      <Suspense fallback={<div className="animate-pulse h-64 bg-muted/20 rounded-2xl" />}>
        <PromptsLibraryClient />
      </Suspense>
    </div>
  );
}
