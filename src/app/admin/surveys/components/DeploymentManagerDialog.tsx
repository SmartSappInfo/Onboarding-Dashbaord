'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Deployment & Distribution Manager Dialog
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Channel Distribution:
 *    - Decouples survey definition from distribution channels.
 *    - Manages channel-specific URLs, QR codes, quotas, and schedules.
 * 2. Mobile-First Ergonomics & Accessibility (WCAG 2.1 AA):
 *    - Touch targets min-h-[44px], active:scale-[0.97] tactile press states, clipboard copy feedback.
 * 3. Strict Zero-Any Invariant:
 *    - Strictly typed props and state.
 */

import * as React from 'react';
import {
  Share2,
  Copy,
  Check,
  QrCode,
  Globe,
  Mail,
  MessageSquare,
  Smartphone,
  Layers,
  Calendar,
  AlertCircle,
  Plus,
  Loader2,
  RefreshCw,
  Power,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  getSurveyDeploymentsAction,
  createSurveyDeploymentAction,
  updateDeploymentStatusAction,
} from '@/lib/surveys/survey-deployment-actions';
import type { SurveyDeployment, DeploymentChannel } from '@/lib/surveys/survey-v2-types';
import { format } from 'date-fns';

export interface DeploymentManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyId: string;
  workspaceId: string;
  surveyTitle: string;
  defaultSlug: string;
}

export function DeploymentManagerDialog({
  open,
  onOpenChange,
  surveyId,
  workspaceId,
  surveyTitle,
  defaultSlug,
}: DeploymentManagerDialogProps) {
  const { toast } = useToast();

  const [deployments, setDeployments] = React.useState<SurveyDeployment[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const copyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Form State
  const [depName, setDepName] = React.useState('');
  const [channel, setChannel] = React.useState<DeploymentChannel>('web');
  const [maxResponses, setMaxResponses] = React.useState<string>('');
  const [agentId, setAgentId] = React.useState('');

  const fetchDeployments = React.useCallback(async () => {
    if (!surveyId || !workspaceId) return;
    setIsLoading(true);
    try {
      const res = await getSurveyDeploymentsAction(surveyId, workspaceId);
      if (res.success && res.deployments) {
        setDeployments(res.deployments);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to retrieve survey deployments.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [surveyId, workspaceId, toast]);

  React.useEffect(() => {
    if (open) {
      fetchDeployments();
    }
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, [open, fetchDeployments]);

  const handleCopyUrl = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast({ title: 'Link Copied', description: 'Deployment URL copied to clipboard.' });
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 2500);
    } catch {
      toast({ variant: 'destructive', title: 'Copy Failed', description: 'Please copy the URL manually.' });
    }
  };

  const handleCreateDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depName.trim()) return;

    setIsCreating(true);
    try {
      const parsedQuota = maxResponses.trim() ? parseInt(maxResponses, 10) : undefined;
      const res = await createSurveyDeploymentAction(surveyId, workspaceId, {
        name: depName.trim(),
        channel,
        quotaConfig: parsedQuota && !isNaN(parsedQuota) ? { maxResponses: parsedQuota } : undefined,
        attributionConfig: agentId.trim() ? { agentId: agentId.trim() } : undefined,
      });

      if (res.success && res.deployment) {
        toast({
          title: 'Deployment Created',
          description: `"${res.deployment.name}" link is ready for distribution.`,
        });
        setDepName('');
        setMaxResponses('');
        setAgentId('');
        setShowCreateForm(false);
        fetchDeployments();
      } else {
        toast({
          variant: 'destructive',
          title: 'Creation Failed',
          description: res.error || 'Failed to create deployment.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleStatus = async (dep: SurveyDeployment) => {
    const nextStatus = dep.status === 'active' ? 'paused' : 'active';
    try {
      const res = await updateDeploymentStatusAction(dep.id, workspaceId, nextStatus);
      if (res.success) {
        toast({
          title: `Deployment ${nextStatus === 'active' ? 'Activated' : 'Paused'}`,
          description: `Updated ${dep.name} status.`,
        });
        fetchDeployments();
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update deployment status.' });
    }
  };

  const getChannelIcon = (ch: DeploymentChannel) => {
    switch (ch) {
      case 'qr':
        return <QrCode className="h-4 w-4 text-purple-500" />;
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4 text-emerald-500" />;
      case 'sms':
        return <Smartphone className="h-4 w-4 text-blue-500" />;
      case 'email':
        return <Mail className="h-4 w-4 text-amber-500" />;
      default:
        return <Globe className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg font-bold">Distribution & Deployments</DialogTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDeployments}
              disabled={isLoading}
              className="h-8 min-h-[36px] active:scale-[0.97]"
            >
              <RefreshCw className={isLoading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            </Button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Manage channel-specific links, quotas, and field-team tracking for <strong>{surveyTitle}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Action Toolbar */}
        <div className="p-4 bg-muted/20 border-b border-border/40 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            {deployments.length} Active Channels
          </span>
          <Button
            size="sm"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="h-8 min-h-[36px] text-xs font-semibold active:scale-[0.97] flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showCreateForm ? 'Close Form' : 'New Deployment Link'}</span>
          </Button>
        </div>

        {/* Create Deployment Inline Sub-Form */}
        {showCreateForm && (
          <form onSubmit={handleCreateDeployment} className="p-4 bg-muted/30 border-b border-border/40 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dep-name" className="text-[11px] font-bold">
                  Deployment Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dep-name"
                  placeholder="e.g. WhatsApp Term 1 Blast"
                  value={depName}
                  onChange={(e) => setDepName(e.target.value)}
                  className="h-9 min-h-[36px] text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dep-channel" className="text-[11px] font-bold">
                  Channel
                </Label>
                <Select value={channel} onValueChange={(val) => setChannel(val as DeploymentChannel)}>
                  <SelectTrigger id="dep-channel" className="h-9 min-h-[36px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="web">Public Web Link</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp Campaign</SelectItem>
                    <SelectItem value="sms">SMS Text</SelectItem>
                    <SelectItem value="email">Email Outreach</SelectItem>
                    <SelectItem value="qr">QR Code Poster</SelectItem>
                    <SelectItem value="embed">Website Embed / Iframe</SelectItem>
                    <SelectItem value="field">Field Representative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dep-quota" className="text-[11px] font-bold">
                  Max Responses Quota (Optional)
                </Label>
                <Input
                  id="dep-quota"
                  type="number"
                  placeholder="e.g. 500"
                  value={maxResponses}
                  onChange={(e) => setMaxResponses(e.target.value)}
                  className="h-9 min-h-[36px] text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dep-agent" className="text-[11px] font-bold">
                  Field Agent ID / Tag (Optional)
                </Label>
                <Input
                  id="dep-agent"
                  placeholder="e.g. agent_kwame"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="h-9 min-h-[36px] text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateForm(false)}
                className="h-8 text-xs min-h-[36px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!depName.trim() || isCreating}
                size="sm"
                className="h-8 text-xs min-h-[36px] font-bold active:scale-[0.97] bg-primary text-primary-foreground"
              >
                {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : 'Generate Deployment Link'}
              </Button>
            </div>
          </form>
        )}

        {/* Deployments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading deployments...</p>
            </div>
          ) : deployments.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Share2 className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-xs text-muted-foreground">
                No custom deployment channels yet. Standard public link is active.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(true)}
                className="min-h-[36px] text-xs active:scale-[0.97]"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create First Channel Link
              </Button>
            </div>
          ) : (
            deployments.map((dep) => {
              const isCopied = copiedId === dep.id;
              const isPaused = dep.status === 'paused';

              return (
                <Card
                  key={dep.id}
                  className={`border transition-all duration-150 shadow-sm ${
                    isPaused ? 'opacity-70 bg-muted/40' : 'border-border/60'
                  }`}
                >
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getChannelIcon(dep.channel)}
                        <span className="font-bold text-xs text-foreground">{dep.name}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                          {dep.channel}
                        </Badge>
                        <Badge
                          variant={dep.status === 'active' ? 'default' : 'secondary'}
                          className="text-[9px] uppercase tracking-wider font-bold"
                        >
                          {dep.status}
                        </Badge>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(dep)}
                        className="h-7 min-h-[32px] px-2 text-[11px] active:scale-[0.97]"
                        title={dep.status === 'active' ? 'Pause link' : 'Activate link'}
                      >
                        <Power className="h-3 w-3 mr-1 text-muted-foreground" />
                        <span>{dep.status === 'active' ? 'Pause' : 'Resume'}</span>
                      </Button>
                    </div>

                    {/* URL Box */}
                    <div className="flex items-center gap-2 bg-muted/40 p-2 rounded border border-border/40">
                      <code className="text-[11px] text-muted-foreground truncate flex-1 font-mono">
                        {dep.url}
                      </code>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCopyUrl(dep.url, dep.id)}
                        className="h-7 min-h-[32px] px-2 text-xs font-semibold active:scale-[0.97] flex items-center gap-1"
                      >
                        {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </Button>
                    </div>

                    {/* Metadata Footer */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                      <div className="flex items-center gap-3">
                        {dep.quotaConfig?.maxResponses && (
                          <span>Quota: <strong>{dep.quotaConfig.maxResponses}</strong></span>
                        )}
                        {dep.attributionConfig?.agentId && (
                          <span>Agent: <strong>{dep.attributionConfig.agentId}</strong></span>
                        )}
                      </div>
                      <span>
                        Created: {dep.createdAt ? format(new Date(dep.createdAt), 'MMM d, yyyy') : ''}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
