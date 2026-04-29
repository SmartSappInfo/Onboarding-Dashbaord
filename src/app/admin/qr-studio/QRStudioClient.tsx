'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  QrCode,
  ExternalLink,
  MoreHorizontal,
  Pause,
  Play,
  Copy,
  Trash2,
  Download,
  Eye,
  Search,
  Filter,
  BarChart3,
  Zap,
  ScanLine,
  AlertTriangle,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import {
  listQRCodes,
  pauseQRCode,
  resumeQRCode,
  archiveQRCode,
  duplicateQRCode,
  getQRStudioStats,
  bulkQRAction,
} from '@/lib/qr-actions';
import type { QRCode as QRCodeType, QRStatus, QRCodeMode, QRCodeType as QRCodeTypeEnum } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import BatchImportDialog from './components/batch-import-dialog';

const QR_TYPE_LABELS: Record<string, string> = {
  url: 'External URL',
  survey: 'Survey',
  form: 'Form',
  landing_page: 'Landing Page',
  public_portal: 'Public Portal',
  doc_signing: 'Doc Signing',
  meeting: 'Meeting',
  invoice: 'Invoice',
  vcard: 'vCard',
  wifi: 'Wi-Fi',
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  text: 'Text',
  file: 'File',
};

const STATUS_STYLES: Record<QRStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  paused: { label: 'Paused', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  archived: { label: 'Archived', className: 'bg-muted text-muted-foreground border-border' },
};

/**
 * Debounce hook — delays value updates by `delay` ms.
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function QRStudioClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();

  const [qrCodes, setQrCodes] = React.useState<QRCodeType[]>([]);
  const [stats, setStats] = React.useState({ totalCodes: 0, activeDynamic: 0, totalScans: 0 });
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [modeFilter, setModeFilter] = React.useState<string>('all');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isBulkActionLoading, setIsBulkActionLoading] = React.useState(false);
  const [showBatchDialog, setShowBatchDialog] = React.useState(false);

  // Archive confirmation dialog state
  const [archiveTarget, setArchiveTarget] = React.useState<QRCodeType | null>(null);

  // Debounced search for performance
  const debouncedSearch = useDebounce(searchQuery, 300);

  const fetchData = React.useCallback(async () => {
    if (!activeOrganizationId || !activeWorkspaceId) return;
    setLoading(true);
    try {
      const [codes, studioStats] = await Promise.all([
        listQRCodes(activeOrganizationId, activeWorkspaceId, {
          status: statusFilter !== 'all' ? statusFilter as QRStatus : undefined,
          mode: modeFilter !== 'all' ? modeFilter as QRCodeMode : undefined,
          type: typeFilter !== 'all' ? typeFilter as QRCodeTypeEnum : undefined,
        }),
        getQRStudioStats(activeOrganizationId, activeWorkspaceId),
      ]);
      setQrCodes(codes);
      setStats(studioStats);
    } catch (err) {
      console.error('Failed to fetch QR codes:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load QR codes.' });
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, activeWorkspaceId, statusFilter, modeFilter, typeFilter, toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePause = async (qr: QRCodeType) => {
    if (!activeOrganizationId || !activeWorkspaceId) return;
    try {
      await pauseQRCode(activeOrganizationId, activeWorkspaceId, qr.id);
      toast({ title: 'QR Code paused', description: `${qr.name} has been paused.` });
      fetchData();
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to pause QR code.' }); }
  };

  const handleBulkAction = async (action: 'pause' | 'resume' | 'archive' | 'delete') => {
    if (!activeOrganizationId || !activeWorkspaceId || selectedIds.length === 0) return;
    setIsBulkActionLoading(true);
    try {
      await bulkQRAction(activeOrganizationId, activeWorkspaceId, selectedIds, action);
      toast({ title: 'Success', description: `Successfully performed bulk action on ${selectedIds.length} items.` });
      setSelectedIds([]);
      fetchData();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to perform bulk action.' });
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredCodes.map(qr => qr.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id));
    }
  };

  const handleResume = async (qr: QRCodeType) => {
    if (!activeOrganizationId || !activeWorkspaceId) return;
    try {
      await resumeQRCode(activeOrganizationId, activeWorkspaceId, qr.id);
      toast({ title: 'QR Code resumed', description: `${qr.name} is now active.` });
      fetchData();
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to resume QR code.' }); }
  };

  const handleDuplicate = async (qr: QRCodeType) => {
    if (!activeOrganizationId || !activeWorkspaceId) return;
    try {
      await duplicateQRCode(activeOrganizationId, activeWorkspaceId, qr.id, qr.createdBy);
      toast({ title: 'QR Code duplicated', description: `Copy of ${qr.name} created.` });
      fetchData();
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to duplicate.' }); }
  };

  const handleArchiveConfirmed = async () => {
    if (!activeOrganizationId || !activeWorkspaceId || !archiveTarget) return;
    try {
      await archiveQRCode(activeOrganizationId, activeWorkspaceId, archiveTarget.id);
      toast({ title: 'QR Code archived', description: `${archiveTarget.name} has been archived.` });
      fetchData();
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to archive.' }); }
    finally { setArchiveTarget(null); }
  };

  const filteredCodes = qrCodes.filter((qr) =>
    qr.name.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const statCards = [
    { label: 'Total QR Codes', value: stats.totalCodes, icon: QrCode, color: 'text-primary' },
    { label: 'Active Dynamic', value: stats.activeDynamic, icon: Zap, color: 'text-emerald-500' },
    { label: 'Total Scans', value: stats.totalScans, icon: ScanLine, color: 'text-violet-500' },
    { label: 'Scan Rate', value: stats.totalCodes > 0 ? `${Math.round(stats.totalScans / stats.totalCodes)}` : '0', icon: BarChart3, color: 'text-amber-500', suffix: '/code' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">QR Studio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create branded, trackable QR codes for your links and campaigns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowBatchDialog(true)}
            className="rounded-xl h-11 px-4 font-semibold text-sm"
          >
            <Upload className="h-4 w-4 mr-2" />
            Batch Import
          </Button>
          <Button
            onClick={() => router.push('/admin/qr-studio/new')}
            className="rounded-xl h-11 px-6 font-semibold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create QR Code
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-5 rounded-xl border-border bg-card hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-primary/5 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground tracking-tight">
                  {stat.value}{stat.suffix && <span className="text-sm font-medium text-muted-foreground">{stat.suffix}</span>}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters Bar */}
      <Card className="p-4 rounded-xl border-border bg-card">
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search QR codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl border-border bg-background h-10 w-full"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36 rounded-xl border-border bg-background h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-full sm:w-36 rounded-xl border-border bg-background h-10">
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="dynamic">Dynamic</SelectItem>
                <SelectItem value="static">Static</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40 rounded-xl border-border bg-background h-10">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[280px]">
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(QR_TYPE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 p-3 bg-card border border-primary/20 rounded-2xl shadow-2xl flex items-center gap-6 min-w-[400px]"
            >
              <div className="flex items-center gap-2 pl-2 border-r border-border pr-6">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary">{selectedIds.length}</span>
                </div>
                <span className="text-xs font-bold text-foreground">Items selected</span>
              </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg"
                disabled={isBulkActionLoading}
                onClick={() => handleBulkAction('resume')}
              >
                <Play className="h-4 w-4 mr-1" /> Resume
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg"
                disabled={isBulkActionLoading}
                onClick={() => handleBulkAction('pause')}
              >
                <Pause className="h-4 w-4 mr-1" /> Pause
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-destructive hover:bg-destructive/10"
                disabled={isBulkActionLoading}
                onClick={() => handleBulkAction('archive')}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Archive
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </Card>

      {/* QR Codes Table */}
      <Card className="rounded-xl border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-4">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading QR codes...</p>
          </div>
        ) : filteredCodes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-16 flex flex-col items-center gap-4 text-center"
          >
            <div className="p-6 rounded-2xl bg-primary/5">
              <QrCode className="h-12 w-12 text-primary/40" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">No QR codes yet</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Create your first QR code to start tracking scans and driving engagement.
              </p>
            </div>
            <Button
              onClick={() => router.push('/admin/qr-studio/new')}
              className="mt-2 rounded-xl h-11 px-6 font-semibold shadow-lg shadow-primary/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First QR Code
            </Button>
          </motion.div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={filteredCodes.length > 0 && selectedIds.length === filteredCodes.length}
                    onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                  />
                </TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Name</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Type</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground hidden md:table-cell">Destination</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Mode</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Status</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground text-right">Scans</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {filteredCodes.map((qr) => {
                  const statusStyle = STATUS_STYLES[qr.status];
                  return (
                    <motion.tr
                      key={qr.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-border cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => router.push(`/admin/qr-studio/${qr.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(qr.id)}
                          onCheckedChange={(checked) => handleSelect(qr.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-semibold text-sm text-foreground">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                            <QrCode className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{qr.name}</p>
                            {qr.description && <p className="text-[10px] text-muted-foreground truncate">{qr.description}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider rounded-lg">
                          {QR_TYPE_LABELS[qr.type] || qr.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {qr.destination.resourceName || qr.destination.url || '—'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase font-bold tracking-wider rounded-lg ${
                            qr.mode === 'dynamic'
                              ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {qr.mode}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] uppercase font-bold tracking-wider rounded-lg ${statusStyle.className}`}>
                          {statusStyle.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm tabular-nums">
                        {qr.stats.totalScans.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-48">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/admin/qr-studio/${qr.id}`); }} className="rounded-lg cursor-pointer">
                              <Eye className="h-4 w-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(qr); }} className="rounded-lg cursor-pointer">
                              <Copy className="h-4 w-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {qr.status === 'active' ? (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePause(qr); }} className="rounded-lg cursor-pointer">
                                <Pause className="h-4 w-4 mr-2" /> Pause
                              </DropdownMenuItem>
                            ) : qr.status === 'paused' ? (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleResume(qr); }} className="rounded-lg cursor-pointer">
                                <Play className="h-4 w-4 mr-2" /> Resume
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); setArchiveTarget(qr); }}
                              className="rounded-lg cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-lg font-bold">Archive QR Code?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              <strong className="text-foreground">{archiveTarget?.name}</strong> will be archived.
              {archiveTarget?.mode === 'dynamic' && (
                <> Scans will return a &quot;no longer active&quot; message. This action can be undone by an admin.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveConfirmed}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Import Dialog */}
      <BatchImportDialog
        open={showBatchDialog}
        onOpenChange={setShowBatchDialog}
        onSuccess={fetchData}
      />
    </div>
  );
}
