'use client';

import * as React from 'react';
import { QrCode, Download, ExternalLink, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';
import { createQRCode } from '@/lib/qr-actions';
import { DEFAULT_QR_DESIGN } from '@/lib/qr-constants';
import type { QRCodeType, QRDesign } from '@/lib/types';
import QRPreview from '@/app/admin/qr-studio/components/qr-preview';
import { downloadQR } from '@/app/admin/qr-studio/components/qr-preview';

interface CreateQRButtonProps {
  resourceType: QRCodeType;
  resourceId: string;
  resourceName: string;
  destinationUrl: string;
  variant?: 'button' | 'icon' | 'compact';
}

/**
 * Reusable "Create QR Code" button + dialog for embedding in share/publish panels
 * across surveys, forms, landing pages, portals, and doc signing modules.
 */
export default function CreateQRButton({
  resourceType,
  resourceId,
  resourceName,
  destinationUrl,
  variant = 'button',
}: CreateQRButtonProps) {
  const { toast } = useToast();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();
  const { user } = useUser();

  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [created, setCreated] = React.useState(false);
  const [isDynamic, setIsDynamic] = React.useState(true);
  const [name, setName] = React.useState(`${resourceName} QR`);
  const [design] = React.useState<QRDesign>({ ...DEFAULT_QR_DESIGN });

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setCreated(false);
      setCreating(false);
      setName(`${resourceName} QR`);
      setIsDynamic(true);
    }
  }, [open, resourceName]);

  const handleCreate = async () => {
    if (!activeOrganizationId || !activeWorkspaceId || !user) return;
    setCreating(true);
    try {
      await createQRCode({
        organizationId: activeOrganizationId,
        workspaceId: activeWorkspaceId,
        name,
        mode: isDynamic ? 'dynamic' : 'static',
        type: resourceType,
        destination: {
          url: destinationUrl,
          resourceType,
          resourceId,
          resourceName,
        },
        design,
        createdBy: {
          userId: user.uid,
          name: user.displayName || '',
          email: user.email || '',
        },
      });
      setCreated(true);
      toast({ title: 'QR Code created!', description: `${name} is ready for download.` });
    } catch (err) {
      console.error('Failed to create QR:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create QR code.' });
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (format: 'png' | 'svg') => {
    const filename = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    await downloadQR(destinationUrl, design, format, filename);
  };

  const TYPE_LABELS: Record<string, string> = {
    survey: 'Survey', form: 'Form', landing_page: 'Landing Page',
    public_portal: 'Portal', doc_signing: 'Doc Signing', meeting: 'Meeting',
  };

  return (
    <>
      {/* Trigger Button */}
      {variant === 'icon' ? (
        <Button variant="outline" size="icon" onClick={() => setOpen(true)} className="rounded-xl h-9 w-9" title="Create QR Code">
          <QrCode className="h-4 w-4" />
        </Button>
      ) : variant === 'compact' ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="rounded-lg h-8 text-xs gap-1.5">
          <QrCode className="h-3.5 w-3.5" />
          QR
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)} className="rounded-xl h-10 gap-2">
          <QrCode className="h-4 w-4" />
          Create QR Code
        </Button>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Create QR Code</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Generate a QR code for this {TYPE_LABELS[resourceType] || resourceType}.
            </DialogDescription>
          </DialogHeader>

          {!created ? (
            <div className="space-y-5 py-2">
              {/* Resource Info */}
              <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider rounded-lg">
                    {TYPE_LABELS[resourceType] || resourceType}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-foreground">{resourceName}</p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">{destinationUrl}</p>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">QR Code Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl h-10 bg-muted/30 border-none"
                />
              </div>

              {/* Mode toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/10 border border-border">
                <div>
                  <p className="text-xs font-semibold text-foreground">Dynamic (Trackable)</p>
                  <p className="text-[10px] text-muted-foreground">Track scans & edit destination later</p>
                </div>
                <Switch checked={isDynamic} onCheckedChange={setIsDynamic} />
              </div>

              {/* Preview */}
              <div className="flex justify-center">
                <div className="p-4 rounded-xl bg-white shadow-sm border border-border/50">
                  <QRPreview data={destinationUrl} design={design} size={160} />
                </div>
              </div>

              {/* Create */}
              <Button
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                className="w-full rounded-xl h-11 font-semibold shadow-lg shadow-primary/20"
              >
                {creating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  <><QrCode className="h-4 w-4 mr-2" /> Create & Download</>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {/* Success state */}
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="p-3 rounded-full bg-emerald-500/10">
                  <Check className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-foreground">QR Code Created!</p>

                <div className="p-4 rounded-xl bg-white shadow-sm border border-border/50">
                  <QRPreview data={destinationUrl} design={design} size={180} />
                </div>
              </div>

              {/* Download buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => handleDownload('png')} className="rounded-xl h-10 text-xs font-semibold">
                  <Download className="h-4 w-4 mr-2" /> Download PNG
                </Button>
                <Button variant="outline" onClick={() => handleDownload('svg')} className="rounded-xl h-10 text-xs font-semibold">
                  <Download className="h-4 w-4 mr-2" /> Download SVG
                </Button>
              </div>

              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                className="w-full rounded-xl h-10 text-xs"
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
