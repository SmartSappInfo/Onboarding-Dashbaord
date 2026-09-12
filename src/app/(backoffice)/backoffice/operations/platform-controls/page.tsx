/**
 * @fileOverview Platform controls (Stage E / Task E2).
 *
 * A server component so the current state is in the first paint. During an incident an
 * operator should not watch a spinner to find out whether sending is already paused.
 *
 * Authorization is enforced by the actions themselves (settings:view to read,
 * settings:edit to change) — this page only decides what to render when they refuse.
 */
import PlatformControlsClient from './PlatformControlsClient';
import {
  getPlatformControlsAction,
  type PlatformControlsView,
} from '@/lib/platform/platform-controls-actions';
import { authorizeBackofficeSession } from '@/lib/backoffice/backoffice-auth';

// Operator state must never come from a cached render.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Platform Controls',
};

/** Renders the no-access state rather than throwing into an error boundary. */
function NoAccess() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-semibold">Platform controls</h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        You do not have access to this page. Ask a platform administrator if you need it.
      </p>
    </div>
  );
}

export default async function PlatformControlsPage() {
  let view: PlatformControlsView;
  try {
    view = await getPlatformControlsAction();
  } catch {
    // Deliberately swallowed: the reason is already reported server-side, and telling a
    // caller *why* authorization failed tells them what exists.
    return <NoAccess />;
  }

  // Second check, separate from the read: view and edit are different permissions, and a
  // read-only auditor should see the state without a control they cannot use.
  let canEdit = false;
  try {
    await authorizeBackofficeSession('settings', 'edit');
    canEdit = true;
  } catch {
    canEdit = false;
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold">Platform controls</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Stop or start all messages to customers, for the whole platform, without a code
          change.
        </p>
      </header>

      {/* Post-isolation the admin site runs on its own deployment. Seeing this page served
          by the customer app means the split has regressed — worth saying, quietly. */}
      {view.surface !== 'backoffice' ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          This page is being served by the customer app rather than the admin site. It still
          works, but tell an engineer.
        </p>
      ) : null}

      <PlatformControlsClient initial={view} canEdit={canEdit} />
    </div>
  );
}
