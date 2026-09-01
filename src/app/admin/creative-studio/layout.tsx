import * as React from 'react';
import { CreativeStudioNav } from './components/CreativeStudioNav';

export const metadata = {
  title: 'Creative Studio 2.0 | SmartSapp CRM',
  description: 'AI-native visual creative production and brand governance platform.',
};

export default function CreativeStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-emerald-500 selection:text-white dark:selection:text-slate-950 transition-colors">
      <CreativeStudioNav />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
