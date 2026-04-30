import { Suspense } from 'react';
import DeveloperClient from './DeveloperClient';
import { adminDb } from '@/lib/firebase-admin';

export const metadata = {
  title: 'Developer & API | Backoffice',
};

// Force dynamic rendering - this page requires Firebase Admin credentials
export const dynamic = 'force-dynamic';

export default async function DeveloperPage() {
  // Pre-fetch workspaces to pass to the client component for dropdowns
  const workspacesSnap = await adminDb.collection('workspaces').get();
  const workspaces = workspacesSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || 'Unknown Workspace',
      organizationId: data.organizationId || 'Unknown Org'
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Developer & API</h1>
        <p className="text-muted-foreground mt-2">
          Manage platform API keys and view endpoint documentation for integrations.
        </p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <DeveloperClient workspaces={workspaces} />
      </Suspense>
    </div>
  );
}
