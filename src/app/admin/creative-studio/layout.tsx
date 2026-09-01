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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      <CreativeStudioNav />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
