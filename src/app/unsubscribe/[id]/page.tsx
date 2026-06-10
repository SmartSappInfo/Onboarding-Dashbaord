import React from 'react';
import { adminDb } from '@/lib/firebase-admin';
import { getOrgBranding } from '@/lib/org-branding';
import UnsubscribeClient from './UnsubscribeClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Communication Preferences | SmartSapp',
    description: 'Manage your email and SMS preferences.',
  };
}

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ws?: string; c?: string }>;
}) {
  const { id: rawId } = await params;
  const sParams = await searchParams;

  const id = decodeURIComponent(rawId);
  const workspaceId = sParams.ws || 'global';
  const initialChannel = sParams.c || 'all';

  let organizationId: string | null = null;
  let workspaceName = '';

  if (workspaceId && workspaceId !== 'global') {
    try {
      const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
      if (wsSnap.exists) {
        const wsData = wsSnap.data()!;
        organizationId = wsData.organizationId || null;
        workspaceName = wsData.name || '';
      }
    } catch (err) {
      console.error('Error fetching workspace for unsubscribe branding:', err);
    }
  }

  const orgBranding = await getOrgBranding(organizationId);
  const primaryColor = orgBranding?.brandPrimaryColor || '#3B5FFF';
  const secondaryColor = orgBranding?.brandSecondaryColor || '#8B5CF6';
  const brandFont = orgBranding?.brandFontFamily || 'Inter';

  const themeStyles = `
    :root {
      --primary: ${primaryColor};
      --secondary: ${secondaryColor};
      --radius: 1rem;
    }
    body {
      font-family: ${brandFont}, sans-serif;
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeStyles }} />
      <UnsubscribeClient
        id={id}
        workspaceId={workspaceId}
        initialChannel={initialChannel}
        workspaceName={workspaceName}
        orgBranding={orgBranding}
      />
    </>
  );
}
