'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';

export default function ScriptsRedirectPage() {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace() as any;

  useEffect(() => {
    const track = activeWorkspaceId ? `?track=${activeWorkspaceId}` : '';
    router.replace(`/admin/messaging/call-centre${track}`);
  }, [router, activeWorkspaceId]);

  return null;
}
