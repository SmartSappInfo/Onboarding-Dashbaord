/**
 * @fileoverview Custom Short Domains Manager Modal Dialog
 * Allows enterprise users to configure, verify DNS CNAME records, and set default domains.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Domain validation strips protocols (http/https) and path segments.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  Globe,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Star,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  Loader2,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';
import {
  addCustomDomain,
  getCustomDomains,
  verifyCustomDomain,
  setDefaultCustomDomain,
  deleteCustomDomain,
} from '@/lib/qr-domain-security-actions';
import type { QRCustomDomain } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomDomainsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CustomDomainsDialog({ open, onOpenChange }: CustomDomainsDialogProps) {
  const { toast } = useToast();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();
  const { user } = useUser();

  const [domains, setDomains] = React.useState<QRCustomDomain[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [newDomainInput, setNewDomainInput] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);
  const [verifyingId, setVerifyingId] = React.useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = React.useState(false);

  const fetchDomains = React.useCallback(async () => {
    if (!activeOrganizationId || !activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const data = await getCustomDomains(activeOrganizationId, activeWorkspaceId);
      setDomains(data);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load custom domains.' });
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganizationId, activeWorkspaceId, toast]);

  React.useEffect(() => {
    if (open) {
      fetchDomains();
    }
  }, [open, fetchDomains]);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainInput.trim() || !activeOrganizationId || !activeWorkspaceId || !user) return;

    setIsAdding(true);
    try {
      const created = await addCustomDomain(
        activeOrganizationId,
        activeWorkspaceId,
        newDomainInput.trim(),
        {
          userId: user.uid,
          name: user.displayName || 'User',
          email: user.email || '',
        }
      );
      setDomains((prev) => [created, ...prev]);
      setNewDomainInput('');
      toast({
        title: 'Domain Added',
        description: 'Configure your DNS CNAME record and click Verify to activate.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add domain';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsAdding(false);
    }
  };

  const handleVerify = async (domain: QRCustomDomain) => {
    if (!activeOrganizationId || !activeWorkspaceId) return;
    setVerifyingId(domain.id);
    try {
      const res = await verifyCustomDomain(activeOrganizationId, activeWorkspaceId, domain.id);
      if (res.verified) {
        setDomains((prev) =>
          prev.map((d) => (d.id === domain.id ? { ...d, status: 'verified', sslActive: true } : d))
        );
        toast({ title: 'Domain Verified', description: res.message });
      } else {
        setDomains((prev) =>
          prev.map((d) => (d.id === domain.id ? { ...d, status: 'failed' } : d))
        );
        toast({ variant: 'destructive', title: 'Verification Failed', description: res.message });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSetDefault = async (domainId: string) => {
    if (!activeOrganizationId || !activeWorkspaceId) return;
    try {
      await setDefaultCustomDomain(activeOrganizationId, activeWorkspaceId, domainId);
      setDomains((prev) =>
        prev.map((d) => ({
          ...d,
          isDefault: d.id === domainId,
        }))
      );
      toast({ title: 'Default Domain Updated', description: 'New QR codes will use this custom domain.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update default domain.' });
    }
  };

  const handleDelete = async (domainId: string) => {
    if (!activeOrganizationId || !activeWorkspaceId) return;
    try {
      await deleteCustomDomain(activeOrganizationId, activeWorkspaceId, domainId);
      setDomains((prev) => prev.filter((d) => d.id !== domainId));
      toast({ title: 'Domain Removed', description: 'Custom domain deleted.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete domain.' });
    }
  };

  const copyCname = () => {
    navigator.clipboard.writeText('cname.smartsapp.com');
    setCopiedTarget(true);
    setTimeout(() => setCopiedTarget(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border shadow-2xl p-6 rounded-3xl overflow-hidden">
        <DialogHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Custom Short Domains
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Serve dynamic QR codes from your own branded domain (e.g. <code>go.myschool.com/q/...</code>).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2 max-h-[70vh] overflow-y-auto pr-1">
          {/* Add Domain Input Form */}
          <form onSubmit={handleAddDomain} className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="go.myschool.com or link.mybrand.com"
                value={newDomainInput}
                onChange={(e) => setNewDomainInput(e.target.value)}
                disabled={isAdding}
                className="pl-9 h-11 rounded-2xl text-xs font-mono"
              />
            </div>
            <Button
              type="submit"
              disabled={isAdding || !newDomainInput.trim()}
              className="h-11 px-5 rounded-2xl font-bold text-xs shadow-md shadow-primary/20 active:scale-[0.97]"
            >
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Add Domain
            </Button>
          </form>

          {/* CNAME DNS Instruction Card */}
          <Card className="p-4 rounded-2xl border-none ring-1 ring-border bg-muted/20 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Info className="h-4 w-4 text-primary" />
              <span>DNS Configuration Instructions</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add a <strong>CNAME</strong> record at your domain DNS provider (Cloudflare, GoDaddy, Namecheap) pointing to:
            </p>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border font-mono text-xs">
              <span className="text-foreground font-semibold">cname.smartsapp.com</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyCname}
                className="h-7 px-2 text-xs rounded-lg active:scale-[0.95]"
              >
                {copiedTarget ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Configured Domains List */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Configured Domains ({domains.length})
            </span>

            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading domain records...</p>
              </div>
            ) : domains.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No custom domains added yet. Enter your branded subdomain above to get started.
              </p>
            ) : (
              <div className="space-y-2.5">
                <AnimatePresence>
                  {domains.map((dom) => (
                    <motion.div
                      key={dom.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-3.5 rounded-2xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">{dom.domain}</span>
                          {dom.isDefault && (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold">
                              Default
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {dom.status === 'verified' ? (
                            <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Verified & SSL Active
                            </span>
                          ) : dom.status === 'failed' ? (
                            <span className="flex items-center gap-1 text-rose-500 font-semibold">
                              <AlertCircle className="h-3.5 w-3.5" /> DNS Not Detected
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-500 font-semibold">
                              <Clock className="h-3.5 w-3.5" /> Pending Verification
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={verifyingId === dom.id}
                          onClick={() => handleVerify(dom)}
                          className="h-8 px-3 rounded-xl text-xs font-semibold active:scale-[0.97]"
                        >
                          {verifyingId === dom.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          )}
                          Verify
                        </Button>

                        {dom.status === 'verified' && !dom.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(dom.id)}
                            className="h-8 px-2.5 rounded-xl text-xs text-muted-foreground hover:text-primary active:scale-[0.97]"
                            title="Set as workspace default"
                          >
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(dom.id)}
                          className="h-8 px-2.5 rounded-xl text-xs text-muted-foreground hover:text-destructive active:scale-[0.97]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
