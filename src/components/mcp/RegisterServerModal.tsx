'use client';

/**
 * @fileOverview Register External MCP Server Modal (Phase 5 Milestone 4 Task 4)
 *
 * Implements theme.md Section 8 (Standardized Modal Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>`
 * - Zero Raw Descriptions: routed through `<CardInfoTooltip text="..." />` alongside title
 * - Accessible Screen Reader: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]`
 *
 * Security & Governance (Rules 4, 15, 34, 47, 60):
 * - Rule 15: External server registration initiates at `discovered` status.
 * - Rule 34: Explains outbound SSRF protection blocking loopback and GCP metadata.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Server, ShieldCheck, AlertCircle } from 'lucide-react';

export interface RegisterServerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegister: (data: { serverName: string; serverUrl: string; description: string }) => Promise<void>;
  isProcessing?: boolean;
}

export function RegisterServerModal({
  open,
  onOpenChange,
  onRegister,
  isProcessing = false,
}: RegisterServerModalProps) {
  const [serverName, setServerName] = React.useState('');
  const [serverUrl, setServerUrl] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setServerName('');
      setServerUrl('');
      setDescription('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim() || !serverUrl.trim() || !description.trim()) {
      setError('Please provide server name, URL, and description.');
      return;
    }

    try {
      new URL(serverUrl);
    } catch {
      setError('Invalid URL format. Must include protocol (e.g. https://).');
      return;
    }

    setError(null);
    try {
      await onRegister({
        serverName: serverName.trim(),
        serverUrl: serverUrl.trim(),
        description: description.trim(),
      });
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
      >
        {/* Demarcated Header (theme.md §8.2) */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2 pr-8">
            <DialogTitle className="text-base sm:text-lg font-semibold truncate flex items-center gap-2">
              <Server className="h-4 w-4 text-primary shrink-0" />
              <span>Register External MCP Server</span>
            </DialogTitle>
            <CardInfoTooltip
              text="Register an external MCP server into the tenant supply-chain allowlist. All endpoints pass automated SSRF verification blocking private and cloud-internal networks."
            />
          </div>
          <DialogDescription className="sr-only">
            Modal for registering an external Model Context Protocol server.
          </DialogDescription>
        </DialogHeader>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Server Name / Vendor */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Server Name / Vendor
              </label>
              <Input
                placeholder="e.g. Weather Service Gateway"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="text-xs h-10 bg-background rounded-xl"
                disabled={isProcessing}
                required
              />
            </div>

            {/* Server URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Endpoint URL (HTTPS)
              </label>
              <Input
                type="url"
                placeholder="https://api.external-mcp.org/sse"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="text-xs h-10 bg-background font-mono rounded-xl"
                disabled={isProcessing}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Business Description
              </label>
              <Textarea
                placeholder="Describe the capabilities provided and intended use case..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs min-h-[80px] bg-background rounded-xl resize-none"
                disabled={isProcessing}
                required
              />
            </div>

            {/* SSRF Notice */}
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold">Rule 34 SSRF Protection Active</span>
                <p className="text-[11px] leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
                  Requests targeting loopback addresses (127.0.0.1, ::1), RFC 1918 private subnets, and GCP metadata (<code className="font-mono">169.254.169.254</code>) are automatically rejected.
                </p>
              </div>
            </div>
          </div>

          {/* Demarcated Footer (theme.md §8.5) */}
          <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
              className="rounded-xl active:scale-[0.97] min-h-[44px] sm:min-h-[36px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isProcessing || !serverName.trim() || !serverUrl.trim() || !description.trim()}
              className="rounded-xl active:scale-[0.97] min-h-[44px] sm:min-h-[36px]"
            >
              {isProcessing ? 'Validating...' : 'Register Server'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
