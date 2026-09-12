'use client';

/**
 * @fileOverview The interactive half of the platform controls page (Stage E / Task E2).
 *
 * DESIGN INTENT — this is an incident-time screen.
 * Everything here is optimised for someone reading it under pressure: the current state is
 * a sentence, not a boolean; there is no entrance animation on the status pill; and no
 * technical identifier (env var name, field name, stack trace) is ever rendered.
 *
 * CAUTION FOR FUTURE EDITORS
 * The toggle can only ever ask the server to pause or resume. The environment floor is not
 * settable from here by design — see platform-controls-actions.ts.
 */

import * as React from 'react';
import { AlertTriangle, Loader2, Pause, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  setOutboundPausedAction,
  type PlatformControlsView,
} from '@/lib/platform/platform-controls-actions';

/** Mirrors MAX_REASON_LENGTH on the server, so the field cannot submit what will be cut. */
const MAX_REASON_LENGTH = 200;

/** Renders '' for a missing timestamp rather than "Invalid Date". */
function formatWhen(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function PlatformControlsClient({
  initial,
  canEdit,
}: {
  initial: PlatformControlsView;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [state, setState] = React.useState<PlatformControlsView>(initial);
  const [isSaving, startSaving] = React.useTransition();
  const [dialogFor, setDialogFor] = React.useState<'pause' | 'resume' | null>(null);
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState('');

  // The environment floor wins over the switch. When it blocks, nothing here can send, so
  // the control is shown but inert — hiding it would leave the operator wondering where
  // the switch went.
  const blockedByEnvironment = !state.envFloorAllows;
  const sendingIsOn = state.envFloorAllows && state.outboundEnabled;
  const toggleDisabled = !canEdit || blockedByEnvironment || isSaving;

  const openDialog = (next: boolean) => {
    if (toggleDisabled) return;
    setError('');
    setReason('');
    setDialogFor(next ? 'resume' : 'pause');
  };

  const confirm = () => {
    const paused = dialogFor === 'pause';
    const note = reason.trim();

    // A pause with no note leaves the next operator guessing. Resuming needs none.
    if (paused && !note) {
      setError('Please add a short note saying why.');
      return;
    }

    startSaving(async () => {
      const res = await setOutboundPausedAction(paused, note);
      if (!res.success) {
        // One plain sentence; the reference id is already inside res.error.
        setError(res.error ?? 'That did not save. Please try again.');
        return;
      }

      setState((prev) => ({
        ...prev,
        outboundEnabled: !paused,
        pausedReason: paused ? note.slice(0, MAX_REASON_LENGTH) : '',
        updatedAt: new Date().toISOString(),
      }));
      setDialogFor(null);
      toast({
        title: paused ? 'Sending paused' : 'Sending resumed',
        description: 'It can take up to 30 seconds to apply everywhere.',
      });
    });
  };

  const when = formatWhen(state.updatedAt);

  return (
    <div className="flex flex-col gap-6">
      {/* ═══════════════════════════════════════════
          Status — the first thing read during an incident.
          No entrance animation: only a cross-fade when the state itself changes.
          ═══════════════════════════════════════════ */}
      <section
        className={cn(
          'rounded-xl border p-5 transition-colors duration-150',
          sendingIsOn
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
            : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
        )}
        aria-live="polite"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                sendingIsOn
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
              )}
              aria-hidden="true"
            >
              {sendingIsOn ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </span>
            <div>
              <p className="text-base font-semibold">
                {blockedByEnvironment
                  ? 'Sending is off for this environment'
                  : sendingIsOn
                    ? 'Sending is on'
                    : 'Sending is paused'}
              </p>
              <p className="text-sm text-muted-foreground">
                {blockedByEnvironment
                  ? 'This copy of the app is not allowed to contact customers. Only production can.'
                  : sendingIsOn
                    ? 'Emails, texts, WhatsApp messages and push notifications are going out.'
                    : 'Nothing is going out to customers right now.'}
              </p>
            </div>
          </div>
        </div>

        {!blockedByEnvironment && !state.outboundEnabled && state.pausedReason ? (
          <p className="mt-4 rounded-lg bg-background/70 p-3 text-sm">
            <span className="text-muted-foreground">Reason: </span>
            {state.pausedReason}
          </p>
        ) : null}

        {(state.updatedByName || when) && !blockedByEnvironment ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Last changed{state.updatedByName ? ` by ${state.updatedByName}` : ''}
            {when ? ` on ${when}` : ''}.
          </p>
        ) : null}
      </section>

      {/* ═══════════════════════════════════════════
          The control itself.
          ═══════════════════════════════════════════ */}
      <section className="rounded-xl border border-border p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-prose">
            <Label htmlFor="outbound-toggle" className="text-sm font-medium">
              Send messages to customers
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Turn this off to stop every outgoing email, text, WhatsApp message and push
              notification across the whole platform. Turning it back on resumes them.
              Changes take up to 30 seconds to apply everywhere.
            </p>
          </div>

          {/* 44px tap target on touch screens, per the mobile requirement. */}
          <div className="flex min-h-11 shrink-0 items-center gap-3">
            <Switch
              id="outbound-toggle"
              checked={sendingIsOn}
              disabled={toggleDisabled}
              onCheckedChange={openDialog}
              aria-label="Send messages to customers"
            />
            <span className="text-sm text-muted-foreground sm:hidden">
              {sendingIsOn ? 'On' : 'Off'}
            </span>
          </div>
        </div>

        {!canEdit && !blockedByEnvironment ? (
          <p className="mt-4 text-sm text-muted-foreground">
            You can see this setting but not change it.
          </p>
        ) : null}
      </section>

      {/* Errors raised outside the dialog (rare, but must not be silent). */}
      {error && dialogFor === null ? (
        <p className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <AlertDialog
        open={dialogFor !== null}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            setDialogFor(null);
            setError('');
          }
        }}
      >
        {/* aria-describedby is passed explicitly: the shared AlertDialogContent registers
            its description in an effect, so on the first paint it clears the attribute and
            a screen reader announces the dialog with no explanation. */}
        <AlertDialogContent className="max-w-md" aria-describedby="outbound-dialog-description">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogFor === 'pause' ? 'Stop sending to customers?' : 'Start sending again?'}
            </AlertDialogTitle>
            <AlertDialogDescription id="outbound-dialog-description">
              {dialogFor === 'pause'
                ? 'No emails, texts, WhatsApp messages or push notifications will go out until someone turns this back on.'
                : 'Messages will start going out to customers again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {dialogFor === 'pause' ? (
            <div className="space-y-2">
              <Label htmlFor="pause-reason">Why are you pausing?</Label>
              <Textarea
                id="pause-reason"
                value={reason}
                maxLength={MAX_REASON_LENGTH}
                rows={3}
                placeholder="Short note for whoever looks at this next"
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {MAX_REASON_LENGTH - reason.length} characters left
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={(e) => {
                  // Confirming must not close the dialog before the write lands, otherwise
                  // a failure would be invisible.
                  e.preventDefault();
                  confirm();
                }}
                disabled={isSaving}
                variant={dialogFor === 'pause' ? 'destructive' : 'default'}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {dialogFor === 'pause' ? 'Stop sending' : 'Start sending'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
