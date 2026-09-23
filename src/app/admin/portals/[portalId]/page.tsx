/**
 * {{Org_name}} Experience Platform — Portal Studio Page
 *
 * Async server component adhering to Next.js 15+ async params convention.
 * Pre-hydrates the portal server-side with zero-flicker and provides
 * a graceful "Portal Not Found" fallback screen.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import PortalStudioClient from './PortalStudioClient';
import { getPortalByIdAction } from '@/app/actions/portal-actions';

interface PortalStudioPageProps {
  params: Promise<{
    portalId: string;
  }>;
}

export async function generateMetadata({ params }: PortalStudioPageProps): Promise<Metadata> {
  const { portalId } = await params;
  try {
    const res = await getPortalByIdAction(portalId);
    const title = res.success && res.data ? `${res.data.name} | Portal Studio` : `Portal Studio | Experience Platform`;
    return {
      title,
      description: `Configure Experience Portal ${portalId}`,
    };
  } catch {
    return {
      title: `Portal Studio | Experience Platform`,
      description: `Configure Experience Portal ${portalId}`,
    };
  }
}

export default async function PortalStudioPage({ params }: PortalStudioPageProps) {
  const { portalId } = await params;
  const res = await getPortalByIdAction(portalId);

  if (!res.success || !res.data) {
    return (
      <div className="flex h-full min-h-[500px] w-full flex-col items-center justify-center p-6 text-center">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm max-w-md w-full space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Portal Not Found
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The Experience Portal you requested does not exist or may have been removed.
            </p>
          </div>
          <div className="pt-2">
            <Button asChild className="h-10 min-h-[44px] px-5 rounded-xl font-bold gap-2 text-xs active:scale-[0.98]">
              <Link href="/admin/portals">
                <ArrowLeft className="h-4 w-4" /> Back to Portals
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <PortalStudioClient portalId={portalId} initialPortal={res.data} />;
}
