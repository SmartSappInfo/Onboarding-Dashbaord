/**
 * @fileoverview Multi-QR Campaign Association Dialog
 * Allows assigning or removing multiple QR codes to/from an active campaign.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Atomic synchronization guaranteed through addQRCodesToCampaign Server Actions.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  Link,
  Search,
  Check,
  Loader2,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { addQRCodesToCampaign } from '@/lib/qr-campaign-actions';
import type { QRCampaign, QRCode } from '@/lib/types';

interface AddQRsToCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: QRCampaign | null;
  availableQRCodes: QRCode[];
  onSuccess?: () => void;
}

export default function AddQRsToCampaignDialog({
  open,
  onOpenChange,
  campaign,
  availableQRCodes,
  onSuccess,
}: AddQRsToCampaignDialogProps) {
  const { toast } = useToast();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();

  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (campaign && open) {
      setSelectedIds(campaign.qrCodeIds || []);
      setSearch('');
    }
  }, [campaign, open]);

  const filteredQRs = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return availableQRCodes;
    return availableQRCodes.filter((code) =>
      code.name.toLowerCase().includes(q) || code.type.toLowerCase().includes(q)
    );
  }, [availableQRCodes, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!campaign || !activeOrganizationId || !activeWorkspaceId) return;

    setIsSaving(true);
    try {
      await addQRCodesToCampaign(activeOrganizationId, activeWorkspaceId, campaign.id, selectedIds);
      toast({
        title: 'Campaign Updated',
        description: `Associated ${selectedIds.length} QR codes with "${campaign.name}".`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update campaign members.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-card border-border shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Link className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Assign QR Codes to Campaign
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Manage which QR codes feed telemetry and conversions into &quot;{campaign?.name}&quot;.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search QR codes by title or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl text-xs"
            />
          </div>

          {/* QR Code List */}
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            {filteredQRs.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No matching QR codes found.
              </div>
            ) : (
              filteredQRs.map((qr) => {
                const isChecked = selectedIds.includes(qr.id);
                return (
                  <button
                    key={qr.id}
                    type="button"
                    onClick={() => toggleSelect(qr.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${
                      isChecked
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-card hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div
                        className={`h-5 w-5 rounded-md flex items-center justify-center border transition-all ${
                          isChecked
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-muted-foreground/30 bg-background'
                        }`}
                      >
                        {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-foreground truncate">{qr.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{qr.destination.url}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] uppercase font-semibold shrink-0 ml-2">
                      {qr.type}
                    </Badge>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border/50 bg-muted/10 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-semibold">
            {selectedIds.length} QR codes selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-10 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-xl h-10 px-5 text-xs font-semibold shadow-lg shadow-primary/20 active:scale-[0.97]"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
              Save Members
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
