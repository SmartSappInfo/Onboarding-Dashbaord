'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Copy,
  ExternalLink,
  Pause,
  Play,
  Pencil,
  Check,
  Loader2,
  QrCode,
  BarChart3,
  Link2,
  Palette,
  Settings,
  ScanLine,
  Code,
  Calendar,
  Clock,
  Hash,
  CornerDownRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import ShareEmbedDialog from '@/components/share-embed-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import {
  getQRCode,
  updateQRCode,
  updateQRDesign,
  updateQRLifecycle,
  pauseQRCode,
  resumeQRCode,
  expireQRCode,
  updateQRShortPath,
  saveQRTemplate,
} from '@/lib/qr-actions';
import { getQRAnalytics, type ScanAnalytics } from '@/lib/qr-scan-actions';
import type { QRCode as QRCodeType, QRDesign, QRStatus, QRLifecycleConfig } from '@/lib/types';
import QRPreview from '../components/qr-preview';
import QRDownloadDialog from '../components/qr-download-dialog';
import QRDesigner from '../components/designer/qr-designer';
import { QRNotificationSettings } from '../components/qr-notification-settings';

const TYPE_LABELS: Record<string, string> = {
  url: 'External URL',
  survey: 'Survey',
  form: 'Form',
  landing_page: 'Landing Page',
  portal: 'Portal',
  public_portal: 'Public Portal',
  doc_signing: 'Doc Signing',
  document: 'Document',
  meeting: 'Meeting',
  payment: 'Payment',
  invoice: 'Invoice',
  vcard: 'vCard',
  wifi: 'Wi-Fi',
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  text: 'Text',
  file: 'File',
  attendance: 'Attendance',
  event: 'Event',
  campaign: 'Campaign',
  custom: 'Custom',
};

const STATUS_STYLES: Record<QRStatus, { label: string; className: string; dotClassName: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    dotClassName: 'bg-slate-400',
  },
  active: {
    label: 'Active',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dotClassName: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]',
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    dotClassName: 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.4)]',
  },
  paused: {
    label: 'Paused',
    className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    dotClassName: 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.4)]',
  },
  expired: {
    label: 'Expired',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dotClassName: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]',
  },
  suspended: {
    label: 'Suspended',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    dotClassName: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]',
  },
  archived: {
    label: 'Archived',
    className: 'bg-muted text-muted-foreground border-border',
    dotClassName: 'bg-zinc-500',
  },
};

export default function QRDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();
  const qrId = params.id as string;

  const [qr, setQr] = React.useState<QRCodeType | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showDownload, setShowDownload] = React.useState(false);
  const [isShareOpen, setIsShareOpen] = React.useState(false);

  // Inline rename state
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState('');
  const [isSavingRename, setIsSavingRename] = React.useState(false);
  const renameInputRef = React.useRef<HTMLInputElement>(null);

  // Destination URL edit state
  const [isEditingDestination, setIsEditingDestination] = React.useState(false);
  const [destinationValue, setDestinationValue] = React.useState('');
  const [isSavingDestination, setIsSavingDestination] = React.useState(false);

  const startEditDestination = () => {
    if (!qr) return;
    setDestinationValue(qr.destination.url || '');
    setIsEditingDestination(true);
  };

  const handleSaveDestination = async () => {
    if (!qr || !activeOrganizationId || !activeWorkspaceId) return;
    const trimmed = destinationValue.trim();
    if (!trimmed) {
      toast({ variant: 'destructive', title: 'Invalid URL', description: 'Destination URL cannot be empty.' });
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      toast({ variant: 'destructive', title: 'Invalid Protocol', description: 'Destination URL must start with http:// or https://' });
      return;
    }
    setIsSavingDestination(true);
    try {
      await updateQRCode(activeOrganizationId, activeWorkspaceId, qr.id, {
        destination: {
          ...qr.destination,
          url: trimmed,
        },
      });
      setQr((prev) => (prev ? { ...prev, destination: { ...prev.destination, url: trimmed } } : prev));
      setIsEditingDestination(false);
      toast({ title: 'Destination Updated', description: 'The redirect target has been successfully updated.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update destination URL.';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setIsSavingDestination(false);
    }
  };

  const startRename = () => {
    if (!qr) return;
    setRenameValue(qr.name);
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.select(), 50);
  };

  const commitRename = async () => {
    if (!qr || !activeOrganizationId || !activeWorkspaceId) {
      setIsRenaming(false);
      return;
    }
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === qr.name) {
      setIsRenaming(false);
      return;
    }
    setIsSavingRename(true);
    try {
      await updateQRCode(activeOrganizationId, activeWorkspaceId, qr.id, { name: trimmed });
      setQr((prev) => (prev ? { ...prev, name: trimmed } : prev));
      toast({ title: 'Renamed', description: `Renamed to "${trimmed}".` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to rename.' });
    } finally {
      setIsSavingRename(false);
      setIsRenaming(false);
    }
  };

  const fetchQR = React.useCallback(async () => {
    if (!activeOrganizationId || !activeWorkspaceId || !qrId) return;
    setLoading(true);
    try {
      const data = await getQRCode(activeOrganizationId, activeWorkspaceId, qrId);
      setQr(data);
    } catch (err) {
      console.error('Failed to fetch QR code:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load QR code.' });
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, activeWorkspaceId, qrId, toast]);

  React.useEffect(() => {
    fetchQR();
  }, [fetchQR]);

  const handleToggleStatus = async () => {
    if (!qr || !activeOrganizationId || !activeWorkspaceId) return;
    try {
      if (qr.status === 'active' || qr.status === 'scheduled') {
        await pauseQRCode(activeOrganizationId, activeWorkspaceId, qr.id);
        toast({ title: 'Paused', description: `${qr.name} has been paused.` });
      } else {
        await resumeQRCode(activeOrganizationId, activeWorkspaceId, qr.id);
        toast({ title: 'Resumed', description: `${qr.name} is now active.` });
      }
      fetchQR();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update status.' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <QrCode className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">QR Code not found</p>
        <Button variant="outline" onClick={() => router.push('/admin/qr-studio')} className="rounded-xl">
          Back to QR Studio
        </Button>
      </div>
    );
  }

  const qrData =
    qr.mode === 'dynamic' && qr.shortPath
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/q/${qr.shortPath}`
      : qr.destination.url || '';

  const statusStyle = STATUS_STYLES[qr.status] || STATUS_STYLES.active;

  return (
    <div className="space-y-5 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin/qr-studio')}
            className="rounded-xl shrink-0 text-muted-foreground hover:text-foreground active:scale-[0.97]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isRenaming ? (
                <div className="flex items-center gap-1.5">
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setIsRenaming(false);
                    }}
                    onBlur={commitRename}
                    disabled={isSavingRename}
                    className="text-xl font-bold tracking-tight bg-transparent border-b-2 border-primary focus:outline-none min-w-0 w-[280px] max-w-full"
                    autoFocus
                  />
                  {isSavingRename && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                </div>
              ) : (
                <div className="group/title flex items-center gap-2 min-w-0">
                  <h1 className="text-xl font-bold tracking-tight text-foreground truncate">{qr.name}</h1>
                  <button
                    type="button"
                    onClick={startRename}
                    className="opacity-0 group-hover/title:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                    title="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <Badge variant="outline" className={`text-[9px] uppercase font-bold tracking-wider rounded-lg shrink-0 ${statusStyle.className}`}>
                {statusStyle.label}
              </Badge>
            </div>
            {qr.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{qr.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsShareOpen(true)}
            className="rounded-xl h-9 text-xs active:scale-[0.97]"
          >
            <Code className="h-3.5 w-3.5 mr-1.5" /> Share & Embed
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            className="rounded-xl h-9 text-xs active:scale-[0.97]"
          >
            {qr.status === 'active' || qr.status === 'scheduled' ? (
              <>
                <Pause className="h-3.5 w-3.5 mr-1.5" /> Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-1.5" /> Resume
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowDownload(true)}
            className="rounded-xl h-9 text-xs shadow-lg shadow-primary/20 active:scale-[0.97]"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download
          </Button>
        </div>
      </div>

      {/* Row 1: Compact Preview Strip */}
      <Card className="p-4 rounded-2xl border-border bg-card">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          {/* QR Preview */}
          <div className="shrink-0 p-3 rounded-xl bg-white shadow-lg border border-border/50">
            <QRPreview data={qrData} design={qr.design} size={120} />
          </div>

          {/* Info + Stats */}
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="space-y-1">
              <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider rounded-lg">
                {TYPE_LABELS[qr.type] || qr.type}
              </Badge>
              <p className="text-[10px] text-muted-foreground">
                {qr.mode === 'dynamic' ? 'Dynamic — Trackable' : 'Static — Permanent'}
              </p>
            </div>
            {qr.shortPath && (
              <div className="space-y-1">
                <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Short Link</p>
                <div className="flex items-center gap-2 bg-muted/30 border border-border/80 rounded-xl px-3 py-1.5 shadow-sm max-w-md backdrop-blur-sm hover:border-primary/20 transition-all duration-200 group">
                  <Link2 className="h-3.5 w-3.5 text-primary shrink-0 animate-pulse" />
                  <span className="text-xs font-mono text-foreground font-medium truncate select-all">
                    {typeof window !== 'undefined' ? window.location.origin : ''}/q/{qr.shortPath}
                  </span>
                  <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-border/50 ml-auto">
                    <button
                      type="button"
                      onClick={() => {
                        const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/q/${qr.shortPath}`;
                        navigator.clipboard.writeText(link);
                        toast({ title: 'Short Link Copied!', description: link });
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200"
                      title="Copy Short Link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                        `Check this out: ${typeof window !== 'undefined' ? window.location.origin : ''}/q/${qr.shortPath}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-md text-[#25D366] hover:bg-[#25D366]/10 transition-all duration-200 flex items-center justify-center"
                      title="Share on WhatsApp"
                    >
                      <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.456h.004c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-0.5">
              <p className="text-xl font-bold text-foreground tabular-nums">{qr.stats.totalScans.toLocaleString()}</p>
              <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Scans</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xl font-bold text-foreground tabular-nums">{(qr.stats.uniqueScans || 0).toLocaleString()}</p>
              <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Unique</p>
            </div>
            {qr.stats.lastScannedAt && (
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">
                  {new Date(qr.stats.lastScannedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                </p>
                <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Last Scan</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Row 2: Full-width Tabs */}
      <Card className="rounded-2xl border-border bg-card overflow-hidden">
        <Tabs defaultValue="configure" className="w-full">
          <TabsList className="w-full justify-start bg-muted/30 rounded-none border-b border-border p-0 h-12">
            <TabsTrigger
              value="configure"
              className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider"
            >
              Configure
            </TabsTrigger>
            <TabsTrigger
              value="design"
              className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider"
            >
              Design
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider"
            >
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="configure" className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Section 1: Overview & Metadata */}
              <div className="space-y-4 p-5 rounded-2xl bg-muted/10 border border-border/60">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Metadata & Info</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Details about creation and operations</p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Created</p>
                    <p className="text-sm text-foreground font-medium">
                      {new Date(qr.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Created By</p>
                    <p className="text-sm text-foreground font-medium">{qr.createdBy.name || qr.createdBy.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Mode</p>
                    <div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] uppercase font-bold tracking-wider rounded-lg ${
                          qr.mode === 'dynamic' ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' : ''
                        }`}
                      >
                        {qr.mode}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Destination Target */}
              <div className="space-y-4 p-5 rounded-2xl bg-muted/10 border border-border/60 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Destination Target</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Configure where this QR code redirects</p>
                  </div>
                  {qr.mode === 'dynamic' ? (
                    !isEditingDestination ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={startEditDestination}
                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                      >
                        <Pencil className="h-3 w-3 mr-1.5" /> Edit URL
                      </Button>
                    ) : null
                  ) : (
                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider rounded-lg text-amber-600 border-amber-500/20 bg-amber-500/5">
                      Static — Non-Editable
                    </Badge>
                  )}
                </div>

                {isEditingDestination ? (
                  <div className="space-y-3 p-4 rounded-xl border border-primary/20 bg-primary/5/10">
                    <div className="flex items-center gap-2">
                      <Input
                        value={destinationValue}
                        onChange={(e) => setDestinationValue(e.target.value)}
                        placeholder="https://example.com/your-promo-page"
                        className="rounded-xl h-10 flex-1 font-mono text-sm"
                        disabled={isSavingDestination}
                      />
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingDestination(false)}
                        className="rounded-xl h-9 text-xs"
                        disabled={isSavingDestination}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveDestination}
                        className="rounded-xl h-9 text-xs"
                        disabled={isSavingDestination}
                      >
                        {isSavingDestination ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                        Save Destination
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-muted/20 border border-border flex items-center gap-3">
                      <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-sm font-mono text-foreground break-all flex-1">{qr.destination.url || '—'}</p>
                      {qr.destination.url && (
                        <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-border/50">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(qr.destination.url || '');
                              toast({ title: 'Destination URL Copied!', description: qr.destination.url });
                            }}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200"
                            title="Copy Destination URL"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <a
                            href={qr.destination.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      )}
                    </div>
                    {qr.destination.resourceName && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Resource</p>
                        <p className="text-sm text-foreground font-semibold">{qr.destination.resourceName}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Lifecycle, UTM, Shortlink & Notifications */}
            <div className="pt-6 border-t border-border space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Advanced Configuration</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">Customize lifecycle timing, shortlink paths, UTM tags, and scan alerts</p>
              </div>
              <SettingsTab qr={qr} orgId={activeOrganizationId!} wsId={activeWorkspaceId!} onSaved={fetchQR} />
            </div>
          </TabsContent>

          <TabsContent value="design" className="p-6">
            <DesignTab qr={qr} orgId={activeOrganizationId!} wsId={activeWorkspaceId!} onSaved={fetchQR} />
          </TabsContent>

          <TabsContent value="analytics" className="p-6">
            <AnalyticsTab orgId={activeOrganizationId!} wsId={activeWorkspaceId!} qrCodeId={qr.id} mode={qr.mode} />
          </TabsContent>
        </Tabs>
      </Card>

      {/* Download Dialog */}
      {showDownload && (
        <QRDownloadDialog
          data={qrData}
          design={qr.design}
          name={qr.name}
          onClose={() => setShowDownload(false)}
        />
      )}

      {isShareOpen && qr && (
        <ShareEmbedDialog
          isOpen={isShareOpen}
          onOpenChange={setIsShareOpen}
          title="Share & Embed QR Code Target"
          resourceName="QR Code Target"
          publicUrl={
            qr.mode === 'dynamic' && qr.shortPath
              ? `${typeof window !== 'undefined' ? window.location.origin : ''}/q/${qr.shortPath}`
              : qr.destination.url || ''
          }
          embedUrl={
            qr.destination.url
              ? qr.destination.url.includes('?')
                ? `${qr.destination.url}&embed=true`
                : `${qr.destination.url}?embed=true`
              : ''
          }
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Analytics Tab Component
// ─────────────────────────────────────────────────

function AnalyticsTab({ orgId, wsId, qrCodeId, mode }: { orgId: string; wsId: string; qrCodeId: string; mode: string }) {
  const [analytics, setAnalytics] = React.useState<ScanAnalytics | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const data = await getQRAnalytics(orgId, wsId, qrCodeId, 30);
        setAnalytics(data);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orgId, wsId, qrCodeId]);

  if (mode === 'static') {
    return (
      <div className="p-8 text-center space-y-2">
        <p className="text-sm font-semibold text-foreground">Analytics are only available for dynamic QR codes</p>
        <p className="text-xs text-muted-foreground">Static QR codes encode the URL directly and cannot track scans.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!analytics || analytics.totalScans === 0) {
    return (
      <div className="p-12 text-center space-y-3">
        <div className="p-4 rounded-2xl bg-primary/5 w-fit mx-auto">
          <ScanLine className="h-8 w-8 text-primary/40" />
        </div>
        <h3 className="text-base font-semibold text-foreground">No scan data yet</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Scan activity will appear here once users start scanning this QR code.
        </p>
      </div>
    );
  }

  const dailyScans = analytics.scansByDay || [];
  const maxDayScans = Math.max(...dailyScans.map((d: { date: string; count: number }) => d.count), 1);
  const deviceBreakdown = analytics.deviceBreakdown || {};
  const osBreakdown = analytics.osBreakdown || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-muted/20 border border-border">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Total Scans</p>
          <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{analytics.totalScans.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/20 border border-border">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Recent Scans</p>
          <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{(analytics.recentScans?.length || 0).toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/20 border border-border">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">30-Day Period</p>
          <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
            {dailyScans.reduce((s: number, d: { date: string; count: number }) => s + d.count, 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-muted/10 border border-border space-y-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Daily Scan Activity (Last 30 Days)</h4>
        </div>
        <div className="flex items-end gap-1.5 h-36 pt-4">
          {dailyScans.map((day: { date: string; count: number }) => {
            const heightPct = Math.max((day.count / maxDayScans) * 100, 4);
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full bg-primary/70 group-hover:bg-primary rounded-t transition-all"
                  style={{ height: `${heightPct}%` }}
                />
                <span className="text-[8px] text-muted-foreground rotate-45 origin-left hidden sm:block">
                  {day.date.slice(5)}
                </span>
                <div className="absolute -top-8 bg-card border border-border shadow-lg px-2 py-1 rounded text-[10px] font-semibold text-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {day.date}: {day.count} scans
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-muted/10 border border-border space-y-3">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Devices</p>
          <div className="space-y-2">
            {Object.entries(deviceBreakdown).map(([dev, cnt]) => (
              <div key={dev} className="flex items-center justify-between text-xs">
                <span className="capitalize text-muted-foreground">{dev}</span>
                <span className="font-bold tabular-nums text-foreground">{String(cnt)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-muted/10 border border-border space-y-3">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Operating Systems</p>
          <div className="space-y-2">
            {Object.entries(osBreakdown).map(([os, cnt]) => (
              <div key={os} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{os}</span>
                <span className="font-bold tabular-nums text-foreground">{String(cnt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Design Tab Component
// ─────────────────────────────────────────────────

function DesignTab({ qr, orgId, wsId, onSaved }: { qr: QRCodeType; orgId: string; wsId: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [design, setDesign] = React.useState<QRDesign>(qr.design);
  const [saving, setSaving] = React.useState(false);

  const qrData =
    qr.mode === 'dynamic' && qr.shortPath
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/q/${qr.shortPath}`
      : qr.destination.url || 'https://smartsapp.com';

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateQRDesign(orgId, wsId, qr.id, design);
      toast({ title: 'Design Saved!', description: 'Your custom QR design is now live.' });
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save design.';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    const templateName = prompt('Enter a name for this template:');
    if (!templateName) return;
    try {
      await saveQRTemplate(orgId, wsId, {
        name: templateName,
        category: 'Custom',
        design,
        createdBy: qr.createdBy.name || qr.createdBy.email,
      });
      toast({ title: 'Template Saved', description: `"${templateName}" is saved to your templates.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save template.';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Visual Customization</h3>
          <p className="text-xs text-muted-foreground">Adjust patterns, colors, gradients, frames, and logos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSaveAsTemplate} className="rounded-xl h-9 text-xs active:scale-[0.97]">
            Save as Template
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="rounded-xl h-9 text-xs shadow-lg shadow-primary/20 active:scale-[0.97]">
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
            Save Changes
          </Button>
        </div>
      </div>

      <QRDesigner data={qrData} design={design} onDesignChange={setDesign} />
    </div>
  );
}

// ─────────────────────────────────────────────────
// Settings Tab Component (Lifecycle & Alerts)
// ─────────────────────────────────────────────────

function SettingsTab({ qr, orgId, wsId, onSaved }: { qr: QRCodeType; orgId: string; wsId: string; onSaved: () => void }) {
  const { toast } = useToast();

  // Shortlink State
  const [shortPath, setShortPath] = React.useState(qr.shortPath || '');
  const [savingShortPath, setSavingShortPath] = React.useState(false);

  // UTM State
  const [utmSource, setUtmSource] = React.useState(qr.tracking.utmSource || '');
  const [utmMedium, setUtmMedium] = React.useState(qr.tracking.utmMedium || '');
  const [utmCampaign, setUtmCampaign] = React.useState(qr.tracking.utmCampaign || '');
  const [savingUTM, setSavingUTM] = React.useState(false);

  // Lifecycle State
  const [startAt, setStartAt] = React.useState(qr.lifecycleConfig?.startAt ? qr.lifecycleConfig.startAt.slice(0, 16) : '');
  const [expiresAt, setExpiresAt] = React.useState(qr.lifecycleConfig?.expiresAt ? qr.lifecycleConfig.expiresAt.slice(0, 16) : '');
  const [maxScans, setMaxScans] = React.useState<number | undefined>(qr.lifecycleConfig?.maxScans);
  const [fallbackUrl, setFallbackUrl] = React.useState(qr.lifecycleConfig?.fallbackUrl || '');
  const [savingLifecycle, setSavingLifecycle] = React.useState(false);

  const hasShortPathChanges = qr.mode === 'dynamic' && shortPath !== (qr.shortPath || '');
  const hasUTMChanges =
    utmSource !== (qr.tracking.utmSource || '') ||
    utmMedium !== (qr.tracking.utmMedium || '') ||
    utmCampaign !== (qr.tracking.utmCampaign || '');
  const hasLifecycleChanges =
    startAt !== (qr.lifecycleConfig?.startAt ? qr.lifecycleConfig.startAt.slice(0, 16) : '') ||
    expiresAt !== (qr.lifecycleConfig?.expiresAt ? qr.lifecycleConfig.expiresAt.slice(0, 16) : '') ||
    maxScans !== qr.lifecycleConfig?.maxScans ||
    fallbackUrl !== (qr.lifecycleConfig?.fallbackUrl || '');

  const handleSaveShortPath = async () => {
    setSavingShortPath(true);
    try {
      const result = await updateQRShortPath(orgId, wsId, qr.id, shortPath);
      if (result && !result.success) {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to update shortlink.' });
        return;
      }
      toast({ title: 'Shortlink updated', description: 'Your custom shortlink has been saved.' });
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update shortlink.';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setSavingShortPath(false);
    }
  };

  const handleSaveUTM = async () => {
    setSavingUTM(true);
    try {
      await updateQRCode(orgId, wsId, qr.id, {
        tracking: {
          ...qr.tracking,
          utmSource: utmSource || undefined,
          utmMedium: utmMedium || undefined,
          utmCampaign: utmCampaign || undefined,
        },
      });
      toast({ title: 'UTM updated', description: 'Your UTM tracking tags have been saved.' });
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update UTM parameters.';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setSavingUTM(false);
    }
  };

  const handleSaveLifecycle = async () => {
    setSavingLifecycle(true);
    try {
      const lifecycleConfig: QRLifecycleConfig = {
        ...qr.lifecycleConfig,
        startAt: startAt ? new Date(startAt).toISOString() : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        maxScans: typeof maxScans === 'number' && maxScans > 0 ? maxScans : undefined,
        fallbackUrl: fallbackUrl || undefined,
      };
      await updateQRLifecycle(orgId, wsId, qr.id, lifecycleConfig);
      toast({ title: 'Lifecycle updated', description: 'Campaign schedule and expiration rules saved.' });
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update lifecycle configuration.';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setSavingLifecycle(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Shortlink Section */}
      {qr.mode === 'dynamic' && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Custom Shortlink</p>
          <div className="flex items-end gap-3 max-w-md">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-10 px-3 rounded-xl bg-muted border border-border flex items-center text-sm text-muted-foreground select-none shrink-0 font-mono text-xs">
                  {typeof window !== 'undefined' ? window.location.host : 'smartsapp.com'}/q/
                </div>
                <Input
                  value={shortPath}
                  onChange={(e) => setShortPath(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase())}
                  className="flex-1 rounded-xl h-10"
                  maxLength={30}
                  placeholder="my-campaign"
                />
              </div>
            </div>
            {hasShortPathChanges && (
              <Button
                onClick={handleSaveShortPath}
                disabled={savingShortPath || !shortPath}
                className="rounded-xl h-10 px-4 shrink-0 active:scale-[0.97]"
              >
                {savingShortPath ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Changing the shortlink will immediately update the redirect target.</p>
        </div>
      )}

      {/* Campaign Lifecycle Section */}
      {qr.mode === 'dynamic' && (
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              Campaign Lifecycle & Expiration Rules
            </p>
            {hasLifecycleChanges && (
              <Button
                onClick={handleSaveLifecycle}
                disabled={savingLifecycle}
                className="rounded-xl h-8 px-3 text-xs active:scale-[0.97]"
              >
                {savingLifecycle ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Save Lifecycle
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Scheduled Start
              </Label>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="rounded-xl h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Expiration Date
              </Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="rounded-xl h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Hash className="h-3 w-3" /> Max Scans Cap
              </Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 500"
                value={maxScans || ''}
                onChange={(e) => setMaxScans(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                className="rounded-xl h-9 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1 pt-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <CornerDownRight className="h-3 w-3" /> Fallback URL (when scheduled, expired, or paused)
            </Label>
            <Input
              type="url"
              placeholder="https://example.com/expired-landing-page"
              value={fallbackUrl}
              onChange={(e) => setFallbackUrl(e.target.value)}
              className="rounded-xl h-9 text-xs"
            />
          </div>
        </div>
      )}

      {/* UTM Section */}
      {qr.tracking.enabled && (
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">UTM Tracking Parameters</p>
            {hasUTMChanges && (
              <Button onClick={handleSaveUTM} disabled={savingUTM} className="rounded-xl h-8 px-3 text-xs active:scale-[0.97]">
                {savingUTM ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Save UTM
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Source</Label>
              <Input
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value)}
                placeholder="e.g. print_poster"
                className="rounded-xl h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Medium</Label>
              <Input
                value={utmMedium}
                onChange={(e) => setUtmMedium(e.target.value)}
                placeholder="e.g. physical_flyer"
                className="rounded-xl h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Campaign</Label>
              <Input
                value={utmCampaign}
                onChange={(e) => setUtmCampaign(e.target.value)}
                placeholder="e.g. open_day_2026"
                className="rounded-xl h-9 text-xs"
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1 pt-4 border-t border-border">
        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Error Correction Level</p>
        <p className="text-sm text-foreground">
          {qr.design.errorCorrection} —{' '}
          {{ L: '7% recovery', M: '15% recovery', Q: '25% recovery', H: '30% recovery' }[qr.design.errorCorrection]}
        </p>
      </div>

      <div className="pt-8 border-t border-border">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-foreground">Scan Notification Alerts</h3>
          <p className="text-xs text-muted-foreground">Configure email, SMS, or in-app alerts when this QR code is scanned.</p>
        </div>
        <QRNotificationSettings
          internalAlerts={qr.notifications?.internalAlerts}
          onChangeInternal={async (val) => {
            try {
              await updateQRCode(orgId, wsId, qr.id, {
                notifications: {
                  ...qr.notifications,
                  internalAlerts: val,
                },
              });
              onSaved();
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Failed to update notifications.';
              toast({ variant: 'destructive', title: 'Error', description: message });
            }
          }}
        />
      </div>
    </div>
  );
}
