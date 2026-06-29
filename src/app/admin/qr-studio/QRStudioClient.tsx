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
  Pencil,
  X,
  Check,
  Link2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Code
} from 'lucide-react';
import ShareEmbedDialog from '@/components/share-embed-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
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
  deleteQRCode,
  duplicateQRCode,
  getQRStudioStats,
  bulkQRAction,
  updateQRCode,
} from '@/lib/qr-actions';
import type { QRCode as QRCodeType, QRStatus, QRCodeMode, QRCodeType as QRCodeTypeEnum } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import BatchImportDialog from './components/batch-import-dialog';
import { PageContainer } from '@/components/ui/page-container';

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

const STATUS_STYLES: Record<QRStatus, { label: string; className: string; dotClassName: string }> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dotClassName: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]',
  },
  paused: {
    label: 'Paused',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dotClassName: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]',
  },
  archived: {
    label: 'Archived',
    className: 'bg-muted text-muted-foreground border-border',
    dotClassName: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]',
  },
};

// ─── Sort types ────────────────────────────────────
type SortField = 'name' | 'type' | 'scans' | 'date';
type SortDirection = 'asc' | 'desc';

// ─── Copy Button with Success State ────────────────
interface CopyButtonProps {
  value: string;
  toastTitle: string;
  className?: string;
  icon?: React.ComponentType<any>;
}

function CopyButton({ value, toastTitle, className, icon: Icon = Copy }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const { toast } = useToast();

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast({
      title: toastTitle,
      description: value,
    });
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-6 w-6 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all shrink-0",
        className
      )}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500 animate-in zoom-in-50 duration-150" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

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
  const [sortField, setSortField] = React.useState<SortField>('date');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isBulkActionLoading, setIsBulkActionLoading] = React.useState(false);
  const [showBatchDialog, setShowBatchDialog] = React.useState(false);

  // Archive confirmation dialog state
  const [archiveTarget, setArchiveTarget] = React.useState<QRCodeType | null>(null);

  // Delete confirmation dialog state (archived links only)
  const [deleteTarget, setDeleteTarget] = React.useState<QRCodeType | null>(null);
  const [shareQR, setShareQR] = React.useState<QRCodeType | null>(null);

  // Rename state
  const [renameId, setRenameId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [isSavingRename, setIsSavingRename] = React.useState(false);
  const renameInputRef = React.useRef<HTMLInputElement>(null);

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

  const handleDeleteConfirmed = async () => {
    if (!activeOrganizationId || !activeWorkspaceId || !deleteTarget) return;
    try {
      await deleteQRCode(activeOrganizationId, activeWorkspaceId, deleteTarget.id);
      toast({ title: 'QR Code deleted', description: `${deleteTarget.name} has been permanently deleted.` });
      fetchData();
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete.' }); }
    finally { setDeleteTarget(null); }
  };

  // ─── Search across name, destination URL, resource name, short path, and type label ───
  const filteredCodes = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const searched = qrCodes.filter((qr) => {
      // When filter is 'all', hide archived links — user must explicitly select 'Archived'
      if (statusFilter === 'all' && qr.status === 'archived') return false;
      if (!q) return true;
      const typeLabel = (QR_TYPE_LABELS[qr.type] || qr.type).toLowerCase();
      return (
        qr.name.toLowerCase().includes(q) ||
        (qr.destination.url || '').toLowerCase().includes(q) ||
        (qr.destination.resourceName || '').toLowerCase().includes(q) ||
        (qr.shortPath || '').toLowerCase().includes(q) ||
        typeLabel.includes(q)
      );
    });

    // ─── Sort ───
    return searched.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'type': {
          const labelA = (QR_TYPE_LABELS[a.type] || a.type).toLowerCase();
          const labelB = (QR_TYPE_LABELS[b.type] || b.type).toLowerCase();
          cmp = labelA.localeCompare(labelB);
          break;
        }
        case 'scans':
          cmp = a.stats.totalScans - b.stats.totalScans;
          break;
        case 'date':
        default:
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [qrCodes, debouncedSearch, sortField, sortDirection]);

  // Toggle sort or switch field
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'name' || field === 'type' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-0 group-hover/sort:opacity-50 transition-opacity" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const startRename = (qr: QRCodeType, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameId(qr.id);
    setRenameValue(qr.name);
    setTimeout(() => renameInputRef.current?.select(), 50);
  };

  const cancelRename = () => {
    setRenameId(null);
    setRenameValue('');
  };

  const commitRename = async (qr: QRCodeType) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === qr.name || !activeOrganizationId || !activeWorkspaceId) {
      cancelRename();
      return;
    }
    setIsSavingRename(true);
    try {
      await updateQRCode(activeOrganizationId, activeWorkspaceId, qr.id, { name: trimmed });
      setQrCodes(prev => prev.map(c => c.id === qr.id ? { ...c, name: trimmed } : c));
      toast({ title: 'Renamed', description: `QR code renamed to "${trimmed}".` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to rename.' });
    } finally {
      setIsSavingRename(false);
      cancelRename();
    }
  };

  const statCards = [
    { label: 'Total QR Codes', value: stats.totalCodes, icon: QrCode, color: 'text-primary' },
    { label: 'Active Dynamic', value: stats.activeDynamic, icon: Zap, color: 'text-emerald-500' },
    { label: 'Total Scans', value: stats.totalScans, icon: ScanLine, color: 'text-violet-500' },
    { label: 'Scan Rate', value: stats.totalCodes > 0 ? `${Math.round(stats.totalScans / stats.totalCodes)}` : '0', icon: BarChart3, color: 'text-amber-500', suffix: '/code' },
  ];

  return (
    <PageContainer>
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
          <Card key={stat.label} className="p-5 rounded-2xl border-none ring-1 ring-border shadow-sm bg-card hover:ring-primary/20 hover:shadow-md transition-all duration-200">
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
      <Card className="p-4 rounded-2xl border-none ring-1 ring-border shadow-sm bg-card">
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, URL, link, type..."
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

            <Select value={`${sortField}-${sortDirection}`} onValueChange={(v) => {
              const [f, d] = v.split('-') as [SortField, SortDirection];
              setSortField(f);
              setSortDirection(d);
            }}>
              <SelectTrigger className="w-full sm:w-44 rounded-xl border-border bg-background h-10">
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Sort by" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="date-desc">Newest first</SelectItem>
                <SelectItem value="date-asc">Oldest first</SelectItem>
                <SelectItem value="name-asc">Name A → Z</SelectItem>
                <SelectItem value="name-desc">Name Z → A</SelectItem>
                <SelectItem value="type-asc">Type A → Z</SelectItem>
                <SelectItem value="type-desc">Type Z → A</SelectItem>
                <SelectItem value="scans-desc">Most scans</SelectItem>
                <SelectItem value="scans-asc">Fewest scans</SelectItem>
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
      <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
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
          <TooltipProvider delayDuration={200}>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-10 pl-4 pr-2">
                    <Checkbox
                      checked={filteredCodes.length > 0 && selectedIds.length === filteredCodes.length}
                      onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    />
                  </TableHead>
                  <TableHead
                    className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground w-[290px] cursor-pointer select-none group/sort hover:text-foreground transition-colors px-2"
                    onClick={() => handleSort('name')}
                  >
                    <span className="flex items-center">Name<SortIcon field="name" /></span>
                  </TableHead>
                  <TableHead
                    className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground w-px whitespace-nowrap hidden lg:table-cell cursor-pointer select-none group/sort hover:text-foreground transition-colors px-2"
                    onClick={() => handleSort('type')}
                  >
                    <span className="flex items-center">Type<SortIcon field="type" /></span>
                  </TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground w-40 hidden md:table-cell px-2">Short Link</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground w-52 hidden sm:table-cell px-2">Destination</TableHead>
                  <TableHead
                    className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground text-center w-12 whitespace-nowrap cursor-pointer select-none group/sort hover:text-foreground transition-colors px-2"
                    onClick={() => handleSort('scans')}
                  >
                    <span className="flex items-center justify-center">Scans<SortIcon field="scans" /></span>
                  </TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground w-px whitespace-nowrap px-2"></TableHead>
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
                        <TableCell onClick={(e) => e.stopPropagation()} className="pl-4 pr-2">
                          <Checkbox
                            checked={selectedIds.includes(qr.id)}
                            onCheckedChange={(checked) => handleSelect(qr.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="font-semibold text-sm text-foreground w-[290px] max-w-[290px] px-2 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                              <QrCode className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              {renameId === qr.id ? (
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <input
                                    ref={renameInputRef}
                                    value={renameValue}
                                    onChange={e => setRenameValue(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') commitRename(qr);
                                      if (e.key === 'Escape') cancelRename();
                                    }}
                                    onBlur={() => commitRename(qr)}
                                    disabled={isSavingRename}
                                    className="flex-1 min-w-0 h-7 px-2 text-sm font-semibold rounded-lg border border-primary/50 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    autoFocus
                                  />
                                  <button type="button" onClick={() => commitRename(qr)} className="h-6 w-6 flex items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-500/10">
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button type="button" onClick={cancelRename} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="group/name flex items-center gap-1.5 min-w-0">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className="font-semibold text-sm truncate cursor-help flex-1 min-w-0">{qr.name}</p>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[300px] break-words">
                                      {qr.name}
                                    </TooltipContent>
                                  </Tooltip>
                                  <button
                                    type="button"
                                    onClick={e => startRename(qr, e)}
                                    className="opacity-0 group-hover/name:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                              {qr.description && <p className="text-[10px] text-muted-foreground truncate">{qr.description}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell w-px whitespace-nowrap px-2 py-3">
                          <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider rounded-lg">
                            {QR_TYPE_LABELS[qr.type] || qr.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell w-40 max-w-[160px] truncate px-2 py-3">
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={cn("h-2.5 w-2.5 rounded-full shrink-0 cursor-help", statusStyle.dotClassName)} />
                              </TooltipTrigger>
                              <TooltipContent>
                                Status: {statusStyle.label}
                              </TooltipContent>
                            </Tooltip>
                            {qr.mode === 'dynamic' && qr.shortPath ? (
                              <div className="flex items-center gap-1.5 group/link min-w-0 flex-1">
                                <span className="text-xs font-mono text-foreground truncate min-w-0 flex-1">{qr.shortPath}</span>
                                <CopyButton
                                  value={`${window.location.origin}/q/${qr.shortPath}`}
                                  toastTitle="Copied Short Link"
                                  icon={Link2}
                                  className="opacity-0 group-hover/link:opacity-100 focus:opacity-100 transition-opacity"
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/45 font-mono select-none flex-1">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell w-52 max-w-[200px] truncate px-2 py-3">
                          <div className="flex items-center gap-1.5 group/dest min-w-0" onClick={e => e.stopPropagation()}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground truncate cursor-help block min-w-0 flex-1">
                                  {qr.destination.resourceName || qr.destination.url || '—'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[400px] break-all">
                                {qr.destination.url || '—'}
                              </TooltipContent>
                            </Tooltip>
                            {qr.destination.url && (
                              <CopyButton
                                value={qr.destination.url}
                                toastTitle="Copied Destination Link"
                                icon={Copy}
                                className="opacity-0 group-hover/dest:opacity-100 focus:opacity-100 transition-opacity"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold text-sm tabular-nums w-12 whitespace-nowrap text-foreground px-2 py-3">
                          {qr.stats.totalScans.toLocaleString()}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} className="w-px whitespace-nowrap px-2 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all duration-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/admin/qr-studio/${qr.id}`);
                              }}
                              title="Edit QR Code"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-48">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/admin/qr-studio/${qr.id}`); }} className="rounded-lg cursor-pointer">
                              <Eye className="h-4 w-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => startRename(qr, e)} className="rounded-lg cursor-pointer">
                              <Pencil className="h-4 w-4 mr-2" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(qr); }} className="rounded-lg cursor-pointer">
                              <Copy className="h-4 w-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShareQR(qr); }} className="rounded-lg cursor-pointer">
                              <Code className="h-4 w-4 mr-2" /> Share & Embed
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
                            {qr.status === 'archived' ? (
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(qr); }}
                                className="rounded-lg cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete Permanently
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); setArchiveTarget(qr); }}
                                className="rounded-lg cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Archive
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
          </TooltipProvider>
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

      {/* Delete Confirmation Dialog (archived links only) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-lg font-bold">Delete QR Code?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              <strong className="text-foreground">{deleteTarget?.name}</strong> will be permanently deleted.
              This action cannot be undone and all scan data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
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

      {shareQR && (
        <ShareEmbedDialog
          isOpen={!!shareQR}
          onOpenChange={(open) => !open && setShareQR(null)}
          title="Share & Embed QR Code Target"
          resourceName="QR Code Target"
          publicUrl={shareQR.mode === 'dynamic' && shareQR.shortPath ? `${window.location.origin}/q/${shareQR.shortPath}` : shareQR.destination.url || ''}
          embedUrl={shareQR.destination.url ? (shareQR.destination.url.includes('?') ? `${shareQR.destination.url}&embed=true` : `${shareQR.destination.url}?embed=true`) : ''}
        />
      )}
    </div>
    </PageContainer>
  );
}
