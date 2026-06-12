'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, Loader2, AlertTriangle } from 'lucide-react';
import { validateJoinCodeAction } from '@/app/actions/onboarding-actions';
import { safeInternalRedirect } from '@/lib/auth/return-to';

/**
 * Extracts the org join/configuration code from a validated, app-relative
 * `redirect` path like `/profile-setup?code=SS-XXXX`. Returns null when the
 * redirect is absent/unsafe or carries no code.
 */
function extractCodeFromRedirect(rawRedirect: string | null): string | null {
  const safe = safeInternalRedirect(rawRedirect);
  if (!safe) return null;
  try {
    // Base is arbitrary — we only use it to parse the relative path's query.
    const url = new URL(safe, 'http://local');
    if (url.pathname !== '/profile-setup') return null;
    const code = url.searchParams.get('code');
    return code && code.trim() ? code.trim() : null;
  } catch {
    return null;
  }
}

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'valid'; orgName: string; isConfigured: boolean }
  | { kind: 'invalid'; message: string };

/**
 * Shown on the login/signup screens only when the user arrived from an
 * organization invite link (a `redirect` carrying a configuration token).
 * Surfaces which organization they're joining, plus expired/invalid feedback.
 */
export default function InviteContextBanner({ mode }: { mode: 'login' | 'signup' }) {
  const searchParams = useSearchParams();
  const code = React.useMemo(
    () => extractCodeFromRedirect(searchParams.get('redirect')),
    [searchParams]
  );
  const [status, setStatus] = React.useState<Status>({ kind: 'idle' });

  React.useEffect(() => {
    if (!code) {
      setStatus({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setStatus({ kind: 'loading' });
    validateJoinCodeAction(code)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.organizationName) {
          setStatus({ kind: 'valid', orgName: res.organizationName, isConfigured: !!res.isConfigured });
        } else {
          setStatus({ kind: 'invalid', message: res.error || 'This invitation link is invalid.' });
        }
      })
      .catch(() => {
        if (!cancelled) setStatus({ kind: 'invalid', message: 'Could not verify this invitation right now.' });
      });
    return () => { cancelled = true; };
  }, [code]);

  if (!code || status.kind === 'idle') return null;

  if (status.kind === 'loading') {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Verifying your invitation…
      </div>
    );
  }

  if (status.kind === 'invalid') {
    return (
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span><strong>Invitation problem.</strong> {status.message} You can still {mode === 'signup' ? 'create an account' : 'sign in'} below.</span>
      </div>
    );
  }

  // valid
  const verb = mode === 'signup' ? 'Create your account' : 'Sign in';
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
        <Building2 className="h-4 w-4 text-emerald-600" />
      </div>
      <div className="text-xs">
        <p className="font-bold text-emerald-700 dark:text-emerald-400">
          You&apos;ve been invited to {status.isConfigured ? 'join' : 'set up'} {status.orgName}
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {verb} to continue
          {status.isConfigured ? '.' : ' — you’ll configure the organization and become its administrator.'}
        </p>
      </div>
    </div>
  );
}
