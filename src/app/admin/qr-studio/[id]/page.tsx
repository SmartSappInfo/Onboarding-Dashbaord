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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { getQRCode, updateQRCode, updateQRDesign, pauseQRCode, resumeQRCode, updateQRShortPath, saveQRTemplate } from '@/lib/qr-actions';
import { getQRAnalytics, type ScanAnalytics } from '@/lib/qr-scan-actions';
import type { QRCode as QRCodeType, QRDesign } from '@/lib/types';
import QRPreview from '../components/qr-preview';
import QRDownloadDialog from '../components/qr-download-dialog';
import QRDesigner from '../components/designer/qr-designer';

const TYPE_LABELS: Record<string, string> = {
  url: 'External URL', survey: 'Survey', form: 'Form', landing_page: 'Landing Page',
  public_portal: 'Public Portal', doc_signing: 'Doc Signing', meeting: 'Meeting',
  invoice: 'Invoice', vcard: 'vCard', wifi: 'Wi-Fi', email: 'Email', sms: 'SMS',
  whatsapp: 'WhatsApp', text: 'Text', file: 'File',
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
      if (qr.status === 'active') {
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

  const handleCopyLink = () => {
    if (!qr) return;
    const link = qr.mode === 'dynamic' && qr.shortPath
      ? `${window.location.origin}/q/${qr.shortPath}`
      : qr.destination.url || '';
    navigator.clipboard.writeText(link);
    toast({ title: 'Copied!', description: 'Link copied to clipboard.' });
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

  const qrData = qr.mode === 'dynamic' && qr.shortPath
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/q/${qr.shortPath}`
    : qr.destination.url || '';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/qr-studio')} className="rounded-xl shrink-0 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground truncate">{qr.name}</h1>
              <Badge
                variant="outline"
                className={`text-[9px] uppercase font-bold tracking-wider rounded-lg shrink-0 ${
                  qr.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : qr.status === 'paused'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                {qr.status}
              </Badge>
            </div>
            {qr.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{qr.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="rounded-xl h-9 text-xs">
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Link
          </Button>
          <Button variant="outline" size="sm" onClick={handleToggleStatus} className="rounded-xl h-9 text-xs">
            {qr.status === 'active' ? <><Pause className="h-3.5 w-3.5 mr-1.5" /> Pause</> : <><Play className="h-3.5 w-3.5 mr-1.5" /> Resume</>}
          </Button>
          <Button size="sm" onClick={() => setShowDownload(true)} className="rounded-xl h-9 text-xs shadow-lg shadow-primary/20">
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
              <div className="space-y-0.5">
                <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Short Link</p>
                <p className="text-xs font-mono text-primary">{typeof window !== 'undefined' ? window.location.origin : ''}/q/{qr.shortPath}</p>
              </div>
            )}
            <div className="space-y-0.5">
              <p className="text-xl font-bold text-foreground tabular-nums">{qr.stats.totalScans}</p>
              <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Scans</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xl font-bold text-foreground tabular-nums">{qr.stats.uniqueScans || 0}</p>
              <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Unique</p>
            </div>
            {qr.stats.lastScannedAt && (
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">{new Date(qr.stats.lastScannedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Last Scan</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Row 2: Full-width Tabs */}
      <Card className="rounded-2xl border-border bg-card overflow-hidden">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start bg-muted/30 rounded-none border-b border-border p-0 h-12">
              <TabsTrigger value="overview" className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider">
                Overview
              </TabsTrigger>
              <TabsTrigger value="destination" className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider">
                Destination
              </TabsTrigger>
              <TabsTrigger value="design" className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider">
                Design
              </TabsTrigger>
              <TabsTrigger value="analytics" className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider">
                Analytics
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider">
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Created</p>
                  <p className="text-sm text-foreground">{new Date(qr.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Created By</p>
                  <p className="text-sm text-foreground">{qr.createdBy.name || qr.createdBy.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Mode</p>
                  <Badge variant="outline" className={`text-[9px] uppercase font-bold tracking-wider rounded-lg ${
                    qr.mode === 'dynamic' ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' : ''
                  }`}>{qr.mode}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Short Link</p>
                  {qr.shortPath ? (
                    <p className="text-sm font-mono text-primary">/q/{qr.shortPath}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">N/A (static)</p>
                  )}
                </div>
              </div>
              {qr.stats.lastScannedAt && (
                <div className="space-y-1 pt-4 border-t border-border">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Last Scanned</p>
                  <p className="text-sm text-foreground">{new Date(qr.stats.lastScannedAt).toLocaleString()}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="destination" className="p-6 space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Destination URL</p>
                <div className="p-4 rounded-xl bg-muted/20 border border-border flex items-center gap-3">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm font-mono text-foreground break-all flex-1">{qr.destination.url || '—'}</p>
                  {qr.destination.url && (
                    <a href={qr.destination.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                    </a>
                  )}
                </div>
              </div>
              {qr.destination.resourceName && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Resource</p>
                  <p className="text-sm text-foreground">{qr.destination.resourceName}</p>
                </div>
              )}
              {qr.destination.fallbackUrl && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Fallback URL</p>
                  <p className="text-sm font-mono text-foreground">{qr.destination.fallbackUrl}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="design" className="p-6">
              <DesignTab qr={qr} orgId={activeOrganizationId!} wsId={activeWorkspaceId!} onSaved={fetchQR} />
            </TabsContent>

            <TabsContent value="analytics" className="p-6">
              <AnalyticsTab orgId={activeOrganizationId!} wsId={activeWorkspaceId!} qrCodeId={qr.id} mode={qr.mode} />
            </TabsContent>

            <TabsContent value="settings" className="p-6 space-y-4">
              <SettingsTab qr={qr} orgId={activeOrganizationId!} wsId={activeWorkspaceId!} onSaved={fetchQR} />
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
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-center">
        <div className="p-4 rounded-2xl bg-muted">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">Analytics unavailable</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Static QR codes encode the destination directly — scans are not routed through SmartSapp, so tracking is not possible.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!analytics || analytics.totalScans === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-center">
        <div className="p-4 rounded-2xl bg-primary/5">
          <ScanLine className="h-8 w-8 text-primary/40" />
        </div>
        <p className="text-sm font-semibold text-foreground">No scans yet</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Share your QR code and scans will appear here in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-muted/20 border border-border text-center">
          <p className="text-2xl font-bold text-foreground tabular-nums">{analytics.totalScans}</p>
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Total Scans (30d)</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/20 border border-border text-center">
          <p className="text-2xl font-bold text-foreground tabular-nums">{Object.keys(analytics.deviceBreakdown).length}</p>
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Device Types</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/20 border border-border text-center">
          <p className="text-2xl font-bold text-foreground tabular-nums">{analytics.scansByDay.length}</p>
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Active Days</p>
        </div>
      </div>

      {/* Scans Over Time */}
      {analytics.scansByDay.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Scans Over Time</p>
          <div className="h-32 flex items-end gap-1">
            {analytics.scansByDay.map((day) => {
              const maxCount = Math.max(...analytics.scansByDay.map(d => d.count));
              const heightPct = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1" title={`${day.date}: ${day.count} scans`}>
                  <span className="text-[9px] font-bold text-muted-foreground tabular-nums">{day.count}</span>
                  <div
                    className="w-full bg-primary/80 rounded-t-sm min-h-[2px] transition-all"
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Breakdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <BreakdownCard title="Device" data={analytics.deviceBreakdown} />
        <BreakdownCard title="Browser" data={analytics.browserBreakdown} />
        <BreakdownCard title="OS" data={analytics.osBreakdown} />
      </div>

      {/* Recent Scans */}
      {analytics.recentScans.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Recent Scans</p>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {analytics.recentScans.slice(0, 10).map((scan) => (
              <div key={scan.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/10 border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center">
                    <ScanLine className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{scan.browser} on {scan.os}</p>
                    <p className="text-[10px] text-muted-foreground">{scan.deviceType}</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {new Date(scan.scannedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="p-4 rounded-xl bg-muted/10 border border-border space-y-3">
      <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {entries.map(([label, count]) => (
          <div key={label} className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-foreground capitalize">{label}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{count} ({total > 0 ? Math.round((count / total) * 100) : 0}%)</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Design Tab Component
// ─────────────────────────────────────────────────

function DesignTab({ qr, orgId, wsId, onSaved }: { qr: QRCodeType; orgId: string; wsId: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [localDesign, setLocalDesign] = React.useState<QRDesign>(qr.design);
  const [saving, setSaving] = React.useState(false);
  
  // Template saving state
  const [showTemplateDialog, setShowTemplateDialog] = React.useState(false);
  const [templateName, setTemplateName] = React.useState('');
  const [savingTemplate, setSavingTemplate] = React.useState(false);
  
  const hasChanges = JSON.stringify(localDesign) !== JSON.stringify(qr.design);

  const qrData = qr.mode === 'dynamic' && qr.shortPath
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/q/${qr.shortPath}`
    : qr.destination.url || '';

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateQRDesign(orgId, wsId, qr.id, localDesign);
      toast({ title: 'Design saved', description: 'Your QR code design has been updated.' });
      onSaved();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save design.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      await saveQRTemplate(orgId, wsId, {
        name: templateName.trim(),
        category: 'Custom',
        design: localDesign,
        createdBy: qr.createdBy.userId,
      });
      toast({ title: 'Template saved', description: 'Your design has been saved as a template.' });
      setShowTemplateDialog(false);
      setTemplateName('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to save template.' });
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">QR Code Designer</h3>
          <p className="text-xs text-muted-foreground">Customize colors, patterns, logo, and frame.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowTemplateDialog(true)}
            className="rounded-xl h-9 px-5 text-xs font-semibold"
          >
            Save as Template
          </Button>
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl h-9 px-5 text-xs font-semibold shadow-lg shadow-primary/20"
            >
              {saving ? 'Saving...' : 'Save Design'}
            </Button>
          )}
        </div>
      </div>
      <QRDesigner data={qrData} design={localDesign} onDesignChange={setLocalDesign} orgId={orgId} wsId={wsId} />

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Save this design to reuse it for future QR codes in this workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g. Primary Brand, Marketing Campaign"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={savingTemplate || !templateName.trim()} className="rounded-xl">
              {savingTemplate ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Settings Tab Component
// ─────────────────────────────────────────────────

function SettingsTab({ qr, orgId, wsId, onSaved }: { qr: QRCodeType; orgId: string; wsId: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [shortPath, setShortPath] = React.useState(qr.shortPath || '');
  const [savingShortPath, setSavingShortPath] = React.useState(false);

  const [utmSource, setUtmSource] = React.useState(qr.tracking.utmSource || '');
  const [utmMedium, setUtmMedium] = React.useState(qr.tracking.utmMedium || '');
  const [utmCampaign, setUtmCampaign] = React.useState(qr.tracking.utmCampaign || '');
  const [savingUTM, setSavingUTM] = React.useState(false);

  const hasShortPathChanges = qr.mode === 'dynamic' && shortPath !== (qr.shortPath || '');
  const hasUTMChanges = 
    utmSource !== (qr.tracking.utmSource || '') ||
    utmMedium !== (qr.tracking.utmMedium || '') ||
    utmCampaign !== (qr.tracking.utmCampaign || '');

  const handleSaveShortPath = async () => {
    setSavingShortPath(true);
    try {
      await updateQRShortPath(orgId, wsId, qr.id, shortPath);
      toast({ title: 'Shortlink updated', description: 'Your custom shortlink has been saved.' });
      onSaved();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to update shortlink.' });
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
        }
      });
      toast({ title: 'UTM updated', description: 'Your UTM parameters have been saved.' });
      onSaved();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to update UTM parameters.' });
    } finally {
      setSavingUTM(false);
    }
  };

  return (
    <div className="space-y-6">
      {qr.mode === 'dynamic' && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Custom Shortlink</p>
          <div className="flex items-end gap-3 max-w-md">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-10 px-3 rounded-xl bg-muted border border-border flex items-center text-sm text-muted-foreground select-none shrink-0">
                  smartsapp.com/q/
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
                className="rounded-xl h-10 px-4 shrink-0"
              >
                {savingShortPath ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Changing the shortlink will immediately break the old link.</p>
        </div>
      )}

      {qr.tracking.enabled && (
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">UTM Parameters</p>
            {hasUTMChanges && (
              <Button
                onClick={handleSaveUTM}
                disabled={savingUTM}
                className="rounded-xl h-8 px-3 text-xs"
              >
                {savingUTM ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save UTM'}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Source</Label>
              <Input
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value)}
                placeholder="e.g. facebook"
                className="rounded-xl h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Medium</Label>
              <Input
                value={utmMedium}
                onChange={(e) => setUtmMedium(e.target.value)}
                placeholder="e.g. social"
                className="rounded-xl h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Campaign</Label>
              <Input
                value={utmCampaign}
                onChange={(e) => setUtmCampaign(e.target.value)}
                placeholder="e.g. summer_sale"
                className="rounded-xl h-9 text-xs"
              />
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-1 pt-4 border-t border-border">
        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Error Correction</p>
        <p className="text-sm text-foreground">{qr.design.errorCorrection} — {
          { L: '7% recovery', M: '15% recovery', Q: '25% recovery', H: '30% recovery' }[qr.design.errorCorrection]
        }</p>
      </div>
    </div>
  );
}
