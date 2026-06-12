import React from 'react';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { getOrgBranding } from '@/lib/org-branding';
import { verifyUnsubscribeToken } from '@/lib/services/unsubscribe-service';
import PreferenceForm from '../components/PreferenceForm';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Communication Preferences | SmartSapp',
    description: 'Manage your email subscription preferences securely.',
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; entityId?: string; ws?: string }>;
}

export default async function PreferenceCenterPage({ params, searchParams }: PageProps) {
  const { id: rawId } = await params;
  const sParams = await searchParams;

  const recipient = decodeURIComponent(rawId).toLowerCase().trim();
  const token = sParams.token || '';
  const entityId = sParams.entityId || '';
  const workspaceId = sParams.ws || 'global';

  // 1. Verify token to prevent IDOR (Insecure Direct Object Reference)
  const isValid = verifyUnsubscribeToken(recipient, token);
  if (!isValid) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-white">
        <div className="max-w-md w-full bg-slate-800/80 backdrop-blur border border-slate-700/60 p-8 rounded-2xl shadow-xl text-center">
          <div className="mx-auto w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-100 mb-2">Invalid or Expired Link</h1>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            This unsubscribe link is invalid or has expired. Please check the link in your email and try again.
          </p>
          <div className="text-xs text-slate-500">Security Guard verification failed</div>
        </div>
      </div>
    );
  }

  // 2. Fetch Contact details & current preferences
  let contactName = '';
  let currentPreferences = {
    emailStatus: 'valid' as 'valid' | 'bounced' | 'unsubscribed' | 'complained' | 'snoozed' | 'opt-down',
    unsubscribedCategories: [] as string[],
    snoozedUntil: '',
    optDownFrequency: 'default' as 'weekly' | 'monthly' | 'default',
  };

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
      console.error('Error fetching workspace branding:', err);
    }
  }

  if (entityId) {
    try {
      const entitySnap = await adminDb.collection('entities').doc(entityId).get();
      if (entitySnap.exists) {
        const entityData = entitySnap.data() || {};
        const contacts = entityData.entityContacts || [];
        const contact = contacts.find(
          (c: any) => c.email?.toLowerCase().trim() === recipient || c.id === recipient
        );
        
        if (contact) {
          contactName = contact.name || '';
          currentPreferences = {
            emailStatus: contact.emailStatus || 'valid',
            unsubscribedCategories: contact.unsubscribedCategories || [],
            snoozedUntil: contact.snoozedUntil || '',
            optDownFrequency: contact.optDownFrequency || 'default',
          };
        }
      }
    } catch (err) {
      console.error('Error fetching contact preferences:', err);
    }
  }

  const orgBranding = await getOrgBranding(organizationId);
  const primaryColor = orgBranding?.brandPrimaryColor || '#6366f1'; // Violet-500 default
  const secondaryColor = orgBranding?.brandSecondaryColor || '#a855f7'; // Purple-500 default
  const brandFont = orgBranding?.brandFontFamily || 'Outfit';

  const themeStyles = `
    :root {
      --primary: ${primaryColor};
      --secondary: ${secondaryColor};
      --font-brand: ${brandFont};
    }
    body {
      font-family: var(--font-brand), sans-serif;
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeStyles }} />
      <PreferenceForm
        recipient={recipient}
        contactName={contactName}
        entityId={entityId}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        orgBranding={orgBranding}
        initialPreferences={currentPreferences}
      />
    </>
  );
}
