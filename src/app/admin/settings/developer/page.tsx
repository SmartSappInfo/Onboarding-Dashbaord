import { Suspense } from 'react';
import DeveloperClient from './DeveloperClient';

export const metadata = {
  title: 'Developer API | Workspace Settings',
};

export default function DeveloperPage() {
  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Developer API</h1>
        <p className="text-muted-foreground mt-2">
          Manage your workspace API keys and access developer documentation for system integrations.
        </p>
      </div>

      <Suspense fallback={<div className="animate-pulse h-64 bg-muted/20 rounded-2xl" />}>
        <DeveloperClient />
      </Suspense>
    </div>
  );
}
