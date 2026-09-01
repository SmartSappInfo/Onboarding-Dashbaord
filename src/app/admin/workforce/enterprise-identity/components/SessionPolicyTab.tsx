'use client';

/**
 * @fileOverview Enterprise Session Policy Tab (Phase 10)
 *
 * Configures idle timeout policies, maximum session duration bounds,
 * concurrent login limits, and step-up authentication triggers.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring easing and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Clock,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import type { EnterpriseSessionConfig } from '@/lib/types';

interface SessionPolicyTabProps {
  config: EnterpriseSessionConfig;
  onSave: (payload: {
    idleTimeoutMinutes: number;
    maxSessionDurationHours: number;
    concurrentSessionLimit: number;
    forceReauthOnSensitiveActions: boolean;
  }) => Promise<void>;
  isSaving: boolean;
}

export function SessionPolicyTab({ config, onSave, isSaving }: SessionPolicyTabProps) {
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = React.useState(config.idleTimeoutMinutes);
  const [maxSessionDurationHours, setMaxSessionDurationHours] = React.useState(config.maxSessionDurationHours);
  const [concurrentSessionLimit, setConcurrentSessionLimit] = React.useState(config.concurrentSessionLimit);
  const [forceReauthOnSensitiveActions, setForceReauthOnSensitiveActions] = React.useState(
    config.forceReauthOnSensitiveActions
  );

  React.useEffect(() => {
    setIdleTimeoutMinutes(config.idleTimeoutMinutes);
    setMaxSessionDurationHours(config.maxSessionDurationHours);
    setConcurrentSessionLimit(config.concurrentSessionLimit);
    setForceReauthOnSensitiveActions(config.forceReauthOnSensitiveActions);
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      idleTimeoutMinutes,
      maxSessionDurationHours,
      concurrentSessionLimit,
      forceReauthOnSensitiveActions,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border bg-card shadow-xs">
        <CardHeader className="p-4 pb-3 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-sm font-bold">Session Governance & Lifetime Policies</CardTitle>
              <CardDescription className="text-xs">
                Configure browser session expiration, idle lockouts, and step-up security
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Idle Timeout (Minutes)</Label>
              <Input
                type="number"
                min={5}
                max={480}
                value={idleTimeoutMinutes}
                onChange={(e) => setIdleTimeoutMinutes(Number(e.target.value))}
                className="h-9 text-xs"
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Inactivity period before browser session locks (5–480m).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Max Session Duration (Hours)</Label>
              <Input
                type="number"
                min={1}
                max={72}
                value={maxSessionDurationHours}
                onChange={(e) => setMaxSessionDurationHours(Number(e.target.value))}
                className="h-9 text-xs"
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Maximum continuous session length before re-authentication is required.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Concurrent Session Limit</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={concurrentSessionLimit}
                onChange={(e) => setConcurrentSessionLimit(Number(e.target.value))}
                className="h-9 text-xs"
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Max active devices allowed per workforce member simultaneously.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-primary" /> Step-Up Re-Authentication
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Require password or biometric re-authentication before modifying security settings or performing bulk exports.
                </p>
              </div>
              <Switch
                checked={forceReauthOnSensitiveActions}
                onCheckedChange={setForceReauthOnSensitiveActions}
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-4 border-t bg-muted/10 flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldAlert className="w-4 h-4 text-primary" /> Enforces Firebase Refresh Token Revocation
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={isSaving}
            className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving Session Policy...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Save Session Policy
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export default SessionPolicyTab;
