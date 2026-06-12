import React from 'react';

import { redirect } from 'next/navigation';
import { generateUnsubscribeToken } from '@/lib/services/unsubscribe-service';

export const dynamic = 'force-dynamic';

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ws?: string; c?: string; cmp?: string; v?: string; token?: string; entityId?: string }>;
}) {
  const { id: rawId } = await params;
  const sParams = await searchParams;

  const id = decodeURIComponent(rawId);
  const workspaceId = sParams.ws || 'global';
  const token = sParams.token || generateUnsubscribeToken(id);
  const entityId = sParams.entityId || '';

  // Redirect to the new preferences page securely
  redirect(`/preferences/${encodeURIComponent(id)}?token=${token}&entityId=${entityId}&ws=${workspaceId}`);
}
