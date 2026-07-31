import * as React from 'react';
import { notFound } from 'next/navigation';
import { getBookingPageBySlugAction, getAvailableSlotsAction } from '@/app/actions/scheduler-actions';
import BookingSlotsClient from './BookingSlotsClient';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string>>;
}

/**
 * PURPOSE: Renders public booking pages for scheduling appointments.
 * Resolves recipient identity across ref tokens, searchParams, and __onb_context session cookies
 * to auto-populate contact details.
 *
 * CAUTION: bookingPage.workspaceId supplies tenant context for entity verification.
 * TESTABILITY: Accessible via /book/[slug].
 * RELATED SURFACES: BookingSlotsClient.tsx, FieldsVariablesService.ts.
 */
export default async function PublicBookingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sParams = await searchParams;

  // Retrieve published booking page by slug
  const pageRes = await getBookingPageBySlugAction(slug);
  if (!pageRes.success || !pageRes.data) {
    notFound();
  }

  const bookingPage = pageRes.data;
  const targetDateStr = sParams.date || new Date().toISOString().split('T')[0];

  // Resolve recipient identity via SSOT FieldsVariablesService
  let preloadedVariables: Record<string, string> = {};
  if (bookingPage.workspaceId) {
    try {
      const { FieldsVariablesService } = await import('@/lib/services/fields-variables-service-impl');
      const entityCtx = await FieldsVariablesService.resolveEntityContextFromParams(
        [bookingPage.workspaceId],
        sParams
      );
      if (entityCtx.entityId || entityCtx.recipientContact) {
        const { getVariableValuesMapAction } = await import('@/lib/services/fields-variables-service');
        preloadedVariables = await getVariableValuesMapAction({
          workspaceId: bookingPage.workspaceId,
          entityId: entityCtx.entityId || undefined,
          recipientContact: entityCtx.recipientContact || undefined,
        });
      }
    } catch (err) {
      console.warn('[PublicBookingPage] Failed to resolve recipient context:', err);
    }
  }

  // Fetch available slots
  const slotsRes = await getAvailableSlotsAction(bookingPage.availabilityId, targetDateStr);
  const slots = slotsRes.success && slotsRes.data ? slotsRes.data : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black text-slate-100 flex flex-col justify-center items-center p-6 md:p-12 relative overflow-hidden">
      {/* Dynamic ambient gradient meshes */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <BookingSlotsClient 
        bookingPage={bookingPage} 
        initialDate={targetDateStr} 
        initialSlots={slots} 
        preloadedVariables={preloadedVariables}
      />
    </div>
  );
}
