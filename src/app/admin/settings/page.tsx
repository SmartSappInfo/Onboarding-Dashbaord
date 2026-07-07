import { Suspense } from 'react';
import SettingsClient from './SettingsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Configuration',
  description: 'Initialize platform data, reset dashboard layouts, and configure core system modules.',
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-semibold text-muted-foreground">Loading settings...</div>}>
      <SettingsClient />
    </Suspense>
  );
}
