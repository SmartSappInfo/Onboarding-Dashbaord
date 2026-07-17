'use client';

import * as React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Mail, 
  Smartphone, 
  Search, 
  Activity, 
  CheckCircle2, 
  Eye, 
  MousePointer2, 
  ExternalLink,
  Loader2,
  AlertCircle,
  Download,
  FileSpreadsheet,
  FileText,
  ArrowUpRight,
  Sparkles,
  Trash2
} from 'lucide-react';
import { CleanContactEmailDialog } from '@/components/shared/CleanContactEmailDialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getMessageNodeLogsAction, getMessageNodeStatsAction, reconcilePendingSmsLogsAction } from '@/lib/automation-actions';
import type { MessageLog, MessageNodeStats } from '@/lib/types';
import { useUser } from '@/firebase';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as ChartTooltip 
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/context/TenantContext';

interface MessageNodeLogsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  automationId: string;
  nodeId: string;
  nodeLabel: string;
  channel: 'email' | 'sms' | 'whatsapp';
  initialTab?: string;
}

// Separate component to asynchronously resolve and render Entity Name + Contact Person details per row
interface MessageContactRowDetailsProps {
  log: MessageLog;
  workspaceId: string;
}

interface ResolvedExportLog extends MessageLog {
  resolvedEntityName: string;
  resolvedContactPerson: string;
}

function MessageContactRowDetails({ log, workspaceId }: MessageContactRowDetailsProps) {
  const [entityName, setEntityName] = React.useState<string>('-');
  const [contactPerson, setContactPerson] = React.useState<string>('-');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function resolve() {
      try {
        const identifier = log.entityId;
        if (!identifier) {
          setEntityName(log.entityName || log.displayName || '-');
          setContactPerson(log.displayName || '-');
          setIsLoading(false);
          return;
        }

        const { resolveContact } = await import('@/lib/contact-adapter');
        const contact = await resolveContact(identifier, workspaceId);

        if (contact) {
          setEntityName(contact.name || '-');
          
          // Match recipient to contacts list
          const cleanRecipient = log.recipient.toLowerCase().trim();
          const matchedContact = contact.contacts?.find(
            c => c.email?.toLowerCase().trim() === cleanRecipient ||
                 c.phone?.replace(/[+\s-]/g, '') === cleanRecipient.replace(/[+\s-]/g, '')
          );
          
          setContactPerson(matchedContact?.name || contact.primaryContactName || '-');
        } else {
          setEntityName(log.entityName || log.displayName || '-');
          setContactPerson(log.displayName || '-');
        }
      } catch (error) {
        setEntityName(log.entityName || log.displayName || '-');
        setContactPerson(log.displayName || '-');
      } finally {
        setIsLoading(false);
      }
    }
    void resolve();
  }, [log, workspaceId]);

  if (isLoading) {
    return (
      <>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
      </>
    );
  }

  return (
    <>
      <TableCell className="font-semibold text-foreground truncate max-w-[200px]" title={entityName}>
        {entityName}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]" title={contactPerson}>
        {contactPerson}
      </TableCell>
    </>
  );
}

function MagicTrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <div className="relative inline-flex items-center justify-center">
      <Trash2 className={className} />
      <Sparkles className="h-2 w-2 text-indigo-400 absolute -top-0.5 -right-0.5 animate-pulse" />
    </div>
  );
}

export function MessageNodeLogsDialog({
  isOpen,
  onClose,
  automationId,
  nodeId,
  nodeLabel,
  channel,
  initialTab = 'sent'
}: MessageNodeLogsDialogProps) {
  const { toast } = useToast();
  const { activeWorkspaceId, activeOrganization } = useTenant();
  const [logs, setLogs] = React.useState<MessageLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState(initialTab);
  const [search, setSearch] = React.useState('');
  const [isExporting, setIsExporting] = React.useState(false);
  const [selectedCleanEmail, setSelectedCleanEmail] = React.useState('');
  const [selectedCleanEntityId, setSelectedCleanEntityId] = React.useState('');
  const [isCleanDialogOpen, setIsCleanDialogOpen] = React.useState(false);
  
  // Bulk clean state
  const [isBulkCleanConfirmOpen, setIsBulkCleanConfirmOpen] = React.useState(false);
  const [isBulkCleaning, setIsBulkCleaning] = React.useState(false);
  const [bulkCleanMode, setBulkCleanMode] = React.useState<'archive' | 'delete'>('archive');

  const [nodeStats, setNodeStats] = React.useState<MessageNodeStats | null>(null);
  const { user } = useUser();
  const [isReconciling, setIsReconciling] = React.useState(false);
  const [reconcileResult, setReconcileResult] = React.useState<{ updatedCount: number } | null>(null);
  
  // Fetch logs on mount or when id changes
  React.useEffect(() => {
    if (!isOpen || !automationId || !nodeId) return;

    async function loadLogs() {
      setIsLoading(true);
      setError(null);
      try {
        const [logsData, statsData] = await Promise.all([
          getMessageNodeLogsAction(automationId, nodeId),
          getMessageNodeStatsAction(automationId, nodeId)
        ]);
        setLogs(logsData);
        setNodeStats(statsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load delivery logs');
      } finally {
        setIsLoading(false);
      }
    }

    void loadLogs();
  }, [isOpen, automationId, nodeId]);

  // Background reconciliation on mount/open
  React.useEffect(() => {
    const uid = user?.uid;
    const wsId = activeWorkspaceId;
    if (!isOpen || !automationId || !nodeId || channel !== 'sms' || !uid || !wsId) return;

    async function triggerReconciliation() {
      if (!uid || !wsId) return;
      setIsReconciling(true);
      try {
        const res = await reconcilePendingSmsLogsAction(automationId, nodeId, uid, wsId);
        if (res && res.success && 'updatedCount' in res) {
          const count = res.updatedCount || 0;
          setReconcileResult({ updatedCount: count });
          if (count > 0) {
            const [logsData, statsData] = await Promise.all([
              getMessageNodeLogsAction(automationId, nodeId),
              getMessageNodeStatsAction(automationId, nodeId)
            ]);
            setLogs(logsData);
            setNodeStats(statsData);
          }
        }
      } catch (err) {
        console.warn('[RECONCILIATION] Failed background reconciliation sync:', err);
      } finally {
        setIsReconciling(false);
      }
    }

    void triggerReconciliation();
  }, [isOpen, automationId, nodeId, channel, user?.uid, activeWorkspaceId]);

  // Sync active tab to initialTab if dialog opens with a specific metric clicked
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Counts and metrics
  const stats = React.useMemo(() => {
    if (nodeStats) {
      return {
        sent: nodeStats.sent ?? 0,
        delivered: nodeStats.delivered ?? 0,
        opened: nodeStats.opened ?? 0,
        clicked: nodeStats.clicked ?? 0,
        bounced: nodeStats.bounced ?? 0,
        unsubscribed: nodeStats.unsubscribed ?? 0,
        replied: nodeStats.replied ?? 0,
        pending: Math.max(0, (nodeStats.sent ?? 0) - ((nodeStats.delivered ?? 0) + (nodeStats.bounced ?? 0)))
      };
    }

    const res = {
      sent: logs.length,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      replied: 0,
      pending: 0
    };

    logs.forEach(log => {
      const isClicked = !!log.clickedAt || (log.clickedCount ?? 0) > 0 || log.providerStatus === 'clicked';
      const isOpened = !!log.openedAt || (log.openedCount ?? 0) > 0 || log.providerStatus === 'opened';
      const isDelivered = !!log.deliveredAt || log.providerStatus === 'delivered';
      const isFailed = log.status === 'failed' || log.providerStatus === 'bounced';

      if (isClicked) res.clicked++;
      if (isOpened || isClicked) res.opened++; // Opened includes clicked
      if (isDelivered || isOpened || isClicked) res.delivered++; // Delivered includes opened/clicked
      if (isFailed) res.bounced++;
      if (log.providerStatus === 'unsubscribed') res.unsubscribed++;
      if (log.direction === 'inbound' || log.providerStatus === 'replied') res.replied++;

      // Sent but pending delivery
      if (!isDelivered && !isOpened && !isClicked && !isFailed) {
        res.pending++;
      }
    });

    return res;
  }, [logs, nodeStats]);

  // Chart data distribution (mutually exclusive slices)
  const chartData = React.useMemo(() => {
    const distribution = {
      clicked: stats.clicked,
      opened: Math.max(0, stats.opened - stats.clicked), // Opened but not clicked
      delivered: Math.max(0, stats.delivered - stats.opened), // Delivered but not opened
      failed: stats.bounced,
      pending: stats.pending
    };

    return [
      { name: 'Clicked', value: distribution.clicked, color: '#6366f1' }, // Indigo
      { name: channel === 'email' ? 'Opened' : 'Read', value: distribution.opened, color: '#10b981' }, // Emerald
      { name: 'Delivered', value: distribution.delivered, color: '#3b82f6' }, // Blue
      { name: 'Sent / Pending', value: distribution.pending, color: '#64748b' }, // Slate
      { name: 'Failed', value: distribution.failed, color: '#ef4444' }, // Red
    ].filter(item => item.value > 0);
  }, [stats, channel]);

  // Filter logs based on active tab and search query
  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      // 1. Search filter
      const term = search.toLowerCase().trim();
      const matchesSearch = !term || 
        log.recipient.toLowerCase().includes(term) ||
        (log.displayName || '').toLowerCase().includes(term) ||
        (log.entityName || '').toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // 2. Status/Milestone filter
      switch (activeTab) {
        case 'sent':
          return true;
        case 'delivered':
          return !!log.deliveredAt || log.providerStatus === 'delivered';
        case 'opened':
          return !!log.openedAt || (log.openedCount ?? 0) > 0 || log.providerStatus === 'opened';
        case 'clicked':
          return !!log.clickedAt || (log.clickedCount ?? 0) > 0 || log.providerStatus === 'clicked';
        case 'bounced':
          return !!log.bouncedAt || log.status === 'failed' || log.providerStatus === 'bounced';
        case 'unsubscribed':
          return log.providerStatus === 'unsubscribed';
        case 'replied':
          return log.direction === 'inbound' || log.providerStatus === 'replied';
        default:
          return true;
      }
    });
  }, [logs, activeTab, search]);

  // Paginated Rendering
  const [visibleCount, setVisibleCount] = React.useState(20);

  // Reset pagination limit on tab or search query changes
  React.useEffect(() => {
    setVisibleCount(20);
  }, [activeTab, search]);

  const visibleLogs = React.useMemo(() => {
    return filteredLogs.slice(0, visibleCount);
  }, [filteredLogs, visibleCount]);

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 20);
  };

  // Metrics helper
  const sentCount = stats.sent;
  const openRate = sentCount > 0 ? Math.round((stats.opened / sentCount) * 100) : 0;
  const clickRate = sentCount > 0 ? Math.round((stats.clicked / sentCount) * 100) : 0;
  const bounceRate = sentCount > 0 ? Math.round((stats.bounced / sentCount) * 100) : 0;
  const replyRate = sentCount > 0 ? Math.round((stats.replied / sentCount) * 100) : 0;

  const ChannelIcon = channel === 'email' ? Mail : Smartphone;

  // Batch resolve Entity Names and Contact Names for export
  const resolveAllNames = async (logsToExport: MessageLog[]): Promise<ResolvedExportLog[]> => {
    const { resolveContact } = await import('@/lib/contact-adapter');
    const cache = new Map<string, import('@/lib/types').ResolvedContact>();

    const resolved: ResolvedExportLog[] = [];
    for (const log of logsToExport) {
      let entityName = log.entityName || log.displayName || '-';
      let contactPerson = log.displayName || '-';

      if (log.entityId) {
        let contact = cache.get(log.entityId);
        if (!contact) {
          const res = await resolveContact(log.entityId, activeWorkspaceId || 'global');
          if (res) {
            contact = res;
            cache.set(log.entityId, res);
          }
        }

        if (contact) {
          entityName = contact.name || '-';
          const cleanRecipient = log.recipient.toLowerCase().trim();
          const matchedContact = contact.contacts?.find(
            c => c.email?.toLowerCase().trim() === cleanRecipient ||
                 c.phone?.replace(/[+\s-]/g, '') === cleanRecipient.replace(/[+\s-]/g, '')
          );
          contactPerson = matchedContact?.name || contact.primaryContactName || '-';
        }
      }

      resolved.push({
        ...log,
        resolvedEntityName: entityName,
        resolvedContactPerson: contactPerson
      });
    }
    return resolved;
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = async () => {
    if (filteredLogs.length === 0) return;
    setIsExporting(true);
    try {
      const XLSX = await import('xlsx');
      const resolved = await resolveAllNames(filteredLogs);

      const sheetData = resolved.map(log => ({
        'Recipient Address': log.recipient,
        'Entity Name': log.resolvedEntityName,
        'Contact Person': log.resolvedContactPerson,
        'Dispatched At': log.sentAt ? format(new Date(log.sentAt), 'yyyy-MM-dd HH:mm:ss') : '-',
        'Delivery Status': log.providerStatus || log.status || 'Sent'
      }));

      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Delivery Ledger');

      // Autofit columns
      const maxColLen = sheetData.reduce((acc, row) => {
        Object.keys(row).forEach((key, idx) => {
          const val = String(row[key as keyof typeof row] || '');
          acc[idx] = Math.max(acc[idx] || 10, val.length + 2);
        });
        return acc;
      }, [] as number[]);
      worksheet['!cols'] = maxColLen.map(w => ({ wch: w }));

      XLSX.writeFile(workbook, `delivery_ledger_${nodeLabel.replace(/\s+/g, '_').toLowerCase()}.xlsx`);
    } catch (err) {
      console.error('Excel Export Failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = async () => {
    if (filteredLogs.length === 0) return;
    setIsExporting(true);
    try {
      const resolved = await resolveAllNames(filteredLogs);

      const headers = ['Recipient Address', 'Entity Name', 'Contact Person', 'Dispatched At', 'Delivery Status'];
      const rows = resolved.map(log => [
        log.recipient,
        log.resolvedEntityName,
        log.resolvedContactPerson,
        log.sentAt ? format(new Date(log.sentAt), 'yyyy-MM-dd HH:mm:ss') : '-',
        log.providerStatus || log.status || 'Sent'
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `delivery_ledger_${nodeLabel.replace(/\s+/g, '_').toLowerCase()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('CSV Export Failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Helper to load logo URL into base64 (with CORS handling)
  const getBase64ImageFromUrl = async (imageUrl: string): Promise<string | null> => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn('Failed to load image as base64 (likely CORS):', err);
      return null;
    }
  };

  // Export to PDF
  const handleExportPDF = async () => {
    if (filteredLogs.length === 0) return;
    setIsExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const resolved = await resolveAllNames(filteredLogs);

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      let y = 15;

      // Draw Logo Header
      if (activeOrganization?.logoUrl) {
        const base64 = await getBase64ImageFromUrl(activeOrganization.logoUrl);
        if (base64) {
          doc.addImage(base64, 'PNG', 15, y, 14, 14);
        } else {
          // Circular Initials Logo Badge
          doc.setFillColor(99, 102, 241);
          doc.circle(22, y + 7, 7, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text(activeOrganization.name.charAt(0).toUpperCase(), 22, y + 9.5, { align: 'center' });
        }
      } else {
        // Fallback Initials Logo Badge
        doc.setFillColor(99, 102, 241);
        doc.circle(22, y + 7, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        const letter = activeOrganization?.name ? activeOrganization.name.charAt(0).toUpperCase() : 'S';
        doc.text(letter, 22, y + 9.5, { align: 'center' });
      }

      // Organization name and details
      doc.setTextColor(15, 23, 42); // Slate-900
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(activeOrganization?.name || 'SmartSapp CRM', 34, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text(`Report generated on: ${format(new Date(), 'PPP p')}`, 34, y + 9);
      doc.text(`Channel: ${channel.toUpperCase()}  |  Automation ID: ${automationId}`, 34, y + 13);

      y += 20;

      // Report Header Banner
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y, 180, 10, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, y, 180, 10, 'S');

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`DELIVERY AUDIT REPORT: "${nodeLabel.toUpperCase()}"`, 19, y + 6.5);

      y += 15;

      // KPI Metrics Cards Block (4 cards)
      const cardW = 42.5;
      const cardGap = 3.3;
      const cardH = 16;

      const cards = [
        { label: 'Total Dispatched', val: stats.sent.toString(), sub: 'messages', col: [15, 23, 42] },
        { label: 'Engagement Rate', val: `${openRate}%`, sub: `${stats.opened} read`, col: [16, 185, 129] },
        { label: channel === 'email' ? 'CTR' : 'Reply Rate', val: `${channel === 'email' ? clickRate : replyRate}%`, sub: `${channel === 'email' ? stats.clicked : stats.replied} active`, col: [99, 102, 241] },
        { label: 'Bounce / Failed', val: `${bounceRate}%`, sub: `${stats.bounced} failed`, col: [239, 68, 68] }
      ];

      cards.forEach((card, idx) => {
        const cardX = 15 + idx * (cardW + cardGap);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.rect(cardX, y, cardW, cardH, 'FD');

        // Card Label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(card.label.toUpperCase(), cardX + 3.5, y + 4.5);

        // Card Value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        doc.setTextColor(card.col[0], card.col[1], card.col[2]);
        doc.text(card.val, cardX + 3.5, y + 10);

        // Card Subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(148, 163, 184);
        doc.text(card.sub, cardX + 3.5, y + 13.5);
      });

      y += cardH + 10;

      // Table Header
      doc.setFillColor(241, 245, 249);
      doc.rect(15, y, 180, 8, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(15, y, 195, y);
      doc.line(15, y + 8, 195, y + 8);

      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('RECIPIENT', 18, y + 5.5);
      doc.text('ENTITY NAME', 78, y + 5.5);
      doc.text('CONTACT PERSON', 134, y + 5.5);
      doc.text('STATUS', 176, y + 5.5);

      y += 8;

      // Rows render
      const drawRow = (log: ResolvedExportLog, index: number, yPos: number) => {
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(15, yPos, 180, 8, 'F');
        }

        doc.setDrawColor(241, 245, 249);
        doc.line(15, yPos + 8, 195, yPos + 8);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);

        // Recipient
        const rec = log.recipient.length > 32 ? log.recipient.substring(0, 30) + '...' : log.recipient;
        doc.text(rec, 18, yPos + 5.5);

        // Entity Name
        const entName = log.resolvedEntityName.length > 30 ? log.resolvedEntityName.substring(0, 28) + '...' : log.resolvedEntityName;
        doc.text(entName, 78, yPos + 5.5);

        // Contact Person
        const conName = log.resolvedContactPerson.length > 22 ? log.resolvedContactPerson.substring(0, 20) + '...' : log.resolvedContactPerson;
        doc.text(conName, 134, yPos + 5.5);

        // Status badge
        const hasOpened = log.openedAt || (log.openedCount ?? 0) > 0 || log.providerStatus === 'opened';
        const hasClicked = log.clickedAt || (log.clickedCount ?? 0) > 0 || log.providerStatus === 'clicked';
        const hasFailed = log.status === 'failed' || log.providerStatus === 'bounced';

        let statusText = 'Sent';
        let textCol = [100, 116, 139]; // Muted
        if (hasFailed) {
          statusText = 'Failed';
          textCol = [239, 68, 68]; // Red
        } else if (hasClicked) {
          statusText = 'Clicked';
          textCol = [99, 102, 241]; // Indigo
        } else if (hasOpened) {
          statusText = channel === 'email' ? 'Opened' : 'Read';
          textCol = [16, 185, 129]; // Emerald
        } else if (log.deliveredAt || log.providerStatus === 'delivered') {
          statusText = 'Delivered';
          textCol = [59, 130, 246]; // Blue
        }

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(textCol[0], textCol[1], textCol[2]);
        doc.text(statusText, 176, yPos + 5.5);
      };

      const drawFooter = (pageNum: number, totalPages: number) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text('SmartSapp CRM - Delivery Report', 15, 287);
        doc.text(`Page ${pageNum} of ${totalPages}`, 195, 287, { align: 'right' });
      };

      let pageNum = 1;
      resolved.forEach((log, index) => {
        if (y > 268) {
          drawFooter(pageNum, 99); // placeholder
          doc.addPage();
          pageNum++;
          y = 15;

          // Header on new page
          doc.setFillColor(241, 245, 249);
          doc.rect(15, y, 180, 8, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.line(15, y, 195, y);
          doc.line(15, y + 8, 195, y + 8);

          doc.setTextColor(71, 85, 105);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text('RECIPIENT', 18, y + 5.5);
          doc.text('ENTITY NAME', 78, y + 5.5);
          doc.text('CONTACT PERSON', 134, y + 5.5);
          doc.text('STATUS', 176, y + 5.5);

          y += 8;
        }

        drawRow(log, index, y);
        y += 8;
      });

      // Update footers page numbers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(i, totalPages);
      }

      doc.save(`delivery_report_${nodeLabel.replace(/\s+/g, '_').toLowerCase()}.pdf`);
    } catch (err) {
      console.error('PDF Export Failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkCleanLogs = async () => {
    const failedTargets = filteredLogs
      .filter(log => log.entityId && log.recipient)
      .map(log => ({
        entityId: log.entityId!,
        email: log.recipient
      }));

    if (failedTargets.length === 0) return;

    setIsBulkCleaning(true);
    try {
      const { bulkCleanContactsAction } = await import('@/lib/automation-actions');
      const res = await bulkCleanContactsAction(failedTargets, bulkCleanMode);
      if (res.success) {
        toast({
          title: 'Bulk Clean Success',
          description: `Successfully cleaned ${res.count} bounced contacts.`,
        });
        setIsBulkCleanConfirmOpen(false);
        // Refresh logs list
        const updated = await getMessageNodeLogsAction(automationId, nodeId);
        setLogs(updated);
      } else {
        toast({
          title: 'Bulk Clean Failed',
          description: res.error || 'Clean failed',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsBulkCleaning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-6 overflow-hidden bg-background border border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <ChannelIcon className="h-5 w-5 text-primary" />
              <span>Delivery Analytics: &quot;{nodeLabel}&quot;</span>
            </DialogTitle>

            {/* Export Toolbar */}
            {!isLoading && logs.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0 pr-6">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95"
                  onClick={handleExportPDF}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>Export PDF</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95"
                  onClick={handleExportExcel}
                  disabled={isExporting}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                  <span>XLSX</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95"
                  onClick={handleExportCSV}
                  disabled={isExporting}
                >
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                  <span>CSV</span>
                </Button>
              </div>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Drill down into recipient engagement, delivery distribution, and contact logs.
          </DialogDescription>
        </DialogHeader>

        {isReconciling && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-2.5 text-xs text-indigo-700 animate-pulse my-1 dark:border-indigo-950 dark:bg-indigo-950/20 dark:text-indigo-300 transition-all shrink-0">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
              <span className="font-semibold">Reconciling live SMS delivery statuses from gateway...</span>
            </div>
            <span className="text-[10px] text-indigo-500/70 font-medium text-right whitespace-nowrap">Please wait</span>
          </div>
        )}

        {reconcileResult && reconcileResult.updatedCount > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-2.5 text-xs text-emerald-700 my-1 dark:border-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-300 transition-all shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="font-semibold">Reconciliation complete! Updated {reconcileResult.updatedCount} pending messages.</span>
            </div>
            <button 
              type="button" 
              onClick={() => setReconcileResult(null)} 
              className="text-[10px] text-emerald-500/80 hover:text-emerald-500 underline font-medium cursor-pointer shrink-0 active:scale-[0.97] focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1 transition-all"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive my-2 shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Statistics & Chart Section */}
        {!isLoading && logs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-4 rounded-xl border border-border/50 bg-muted/20 my-2 shrink-0">
            {/* Summary Cards */}
            <div className="md:col-span-7 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/50 bg-card p-3.5 shadow-sm">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total Dispatched</p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <p className="text-2xl font-extrabold tracking-tight text-foreground">{stats.sent}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">messages</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-card p-3.5 shadow-sm">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  {channel === 'email' ? 'Engagement Rate' : 'Read Rate'}
                </p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <p className="text-2xl font-extrabold tracking-tight text-emerald-500">{openRate}%</p>
                  <p className="text-[10px] text-muted-foreground font-medium">({stats.opened} read)</p>
                </div>
              </div>

              {channel === 'email' ? (
                <div className="rounded-xl border border-border/50 bg-card p-3.5 shadow-sm">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Click Rate (CTR)</p>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <p className="text-2xl font-extrabold tracking-tight text-indigo-500">{clickRate}%</p>
                    <p className="text-[10px] text-muted-foreground font-medium">({stats.clicked} clicked)</p>
                  </div>
                </div>
              ) : channel === 'whatsapp' ? (
                <div className="rounded-xl border border-border/50 bg-card p-3.5 shadow-sm">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Reply Rate</p>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <p className="text-2xl font-extrabold tracking-tight text-indigo-500">{replyRate}%</p>
                    <p className="text-[10px] text-muted-foreground font-medium">({stats.replied} replied)</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border/50 bg-card p-3.5 shadow-sm">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Delivered</p>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <p className="text-2xl font-extrabold tracking-tight text-blue-500">
                      {stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0}%
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium">({stats.delivered} delivered)</p>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border/50 bg-card p-3.5 shadow-sm">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Bounce / Failed</p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <p className="text-2xl font-extrabold tracking-tight text-rose-500">{bounceRate}%</p>
                  <p className="text-[10px] text-muted-foreground font-medium">({stats.bounced} failed)</p>
                </div>
              </div>
            </div>

            {/* Distribution Donut Chart */}
            <div className="md:col-span-5 flex flex-row items-center gap-4 border-l border-border/50 pl-6">
              <div className="h-[120px] w-[120px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={55}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border rounded-lg p-2 shadow-md text-[10px] font-semibold">
                              {data.name}: {data.value}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Legend */}
              <div className="flex-1 space-y-1.5 min-w-0">
                {chartData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-muted-foreground truncate">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-foreground pl-2 shrink-0">
                      {item.value} ({stats.sent > 0 ? Math.round((item.value / stats.sent) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs and search bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 mb-4 shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="bg-muted/80 p-0.5 rounded-lg border border-border/40">
              <TabsTrigger value="sent" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                Sent ({stats.sent})
              </TabsTrigger>
              <TabsTrigger value="delivered" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                Delivered ({stats.delivered})
              </TabsTrigger>
              {channel === 'email' ? (
                <>
                  <TabsTrigger value="opened" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Opened ({stats.opened})
                  </TabsTrigger>
                  <TabsTrigger value="clicked" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Clicked ({stats.clicked})
                  </TabsTrigger>
                  <TabsTrigger value="unsubscribed" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Unsub ({stats.unsubscribed})
                  </TabsTrigger>
                </>
              ) : channel === 'whatsapp' ? (
                <>
                  <TabsTrigger value="opened" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Read ({stats.opened})
                  </TabsTrigger>
                  <TabsTrigger value="replied" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Replied ({stats.replied})
                  </TabsTrigger>
                </>
              ) : null}
              <TabsTrigger value="bounced" className="text-xs font-semibold px-3 py-1.5 rounded-md text-red-500 data-[state=active]:text-red-600">
                Failed ({stats.bounced})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {activeTab === 'bounced' && filteredLogs.length > 0 && channel === 'email' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkCleanConfirmOpen(true)}
                className="h-9 px-3 rounded-lg text-xs font-bold border-indigo-500/20 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/5 transition-all duration-150 active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <MagicTrashIcon className="h-3.5 w-3.5 animate-pulse" />
                <span>Bulk Clean Bounced</span>
              </Button>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by recipient, entity or contact..."
                className="pl-9 h-9 rounded-lg text-xs border border-border/80 bg-background"
              />
            </div>
          </div>
        </div>

        {/* Drill-down Table view */}
        <div className="flex-1 overflow-auto border border-border/60 rounded-xl bg-card shadow-inner">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground font-medium">Fetching history...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <Activity className="h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-xs font-semibold text-foreground">No matching logs found</p>
              <p className="text-[11px] text-muted-foreground/80 mt-1 max-w-xs">
                No outbound sends matched this category and search filter.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b border-border/50">
                <TableRow>
                  <TableHead className="w-[180px] text-xs">Recipient</TableHead>
                  <TableHead className="w-[200px] text-xs">Entity Name</TableHead>
                  <TableHead className="w-[160px] text-xs">Contact Person</TableHead>
                  <TableHead className="w-[140px] text-xs">Sent At</TableHead>
                  <TableHead className="w-[110px] text-xs text-center">Status</TableHead>
                  <TableHead className="w-[50px] text-xs text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleLogs.map((log) => {
                  const hasOpened = log.openedAt || (log.openedCount ?? 0) > 0 || log.providerStatus === 'opened';
                  const hasClicked = log.clickedAt || (log.clickedCount ?? 0) > 0 || log.providerStatus === 'clicked';
                  const hasFailed = log.status === 'failed' || log.providerStatus === 'bounced';

                  // Build status badge
                  let statusBadge = (
                    <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/20 text-[10px]">
                      Sent
                    </Badge>
                  );
                  if (hasFailed) {
                    const failReason = log.error || 'Bounce / Delivery Failure';
                    const bounceLabel = log.bounceType 
                      ? (log.bounceType === 'permanent' ? 'Hard Bounce' : 'Soft Bounce')
                      : (failReason.toLowerCase().includes('permanent') ? 'Hard Bounce' : failReason.toLowerCase().includes('temporary') ? 'Soft Bounce' : 'Failed');

                    statusBadge = (
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] whitespace-nowrap">
                          {bounceLabel}
                        </Badge>
                        {log.error && (
                          <span className="text-[9px] text-muted-foreground/60 max-w-[130px] truncate block text-center" title={log.error}>
                            {log.error}
                          </span>
                        )}
                      </div>
                    );
                  } else if (hasClicked) {
                    statusBadge = (
                      <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 text-[10px] flex items-center gap-1 justify-center">
                        <MousePointer2 className="h-2.5 w-2.5" /> Clicked
                      </Badge>
                    );
                  } else if (hasOpened) {
                    statusBadge = (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] flex items-center gap-1 justify-center">
                        <Eye className="h-2.5 w-2.5" /> {channel === 'email' ? 'Opened' : 'Read'}
                      </Badge>
                    );
                  } else if (log.deliveredAt || log.providerStatus === 'delivered') {
                    statusBadge = (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] flex items-center gap-1 justify-center">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Delivered
                      </Badge>
                    );
                  }

                  const entityId = log.entityId;

                  return (
                    <TableRow key={log.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-[11px] truncate max-w-[180px]" title={log.recipient}>
                        {log.recipient}
                      </TableCell>
                      
                      {/* Async Entity details */}
                      <MessageContactRowDetails log={log} workspaceId={log.workspaceId || 'global'} />

                      <TableCell className="text-[11px] text-muted-foreground">
                        {log.sentAt ? format(new Date(log.sentAt), 'MMM dd, yyyy HH:mm') : '-'}
                      </TableCell>
                      <TableCell className="text-center align-middle">
                        {statusBadge}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {entityId && channel === 'email' && hasFailed && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-md hover:bg-indigo-500/10 text-indigo-400 hover:text-indigo-300"
                              onClick={() => {
                                setSelectedCleanEmail(log.recipient);
                                setSelectedCleanEntityId(entityId);
                                setIsCleanDialogOpen(true);
                              }}
                              title="Clean Bounced Email"
                            >
                              <MagicTrashIcon className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {entityId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-md hover:bg-primary/5 text-muted-foreground hover:text-primary"
                              asChild
                            >
                              <a
                                href={`/admin/entities/${entityId}`}
                                target="_blank"
                                rel="noreferrer"
                                title="View Contact Profile"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {filteredLogs.length > visibleCount && (
            <div className="p-4 flex items-center justify-between border-t border-border/50 bg-muted/5 sticky bottom-0 z-10 backdrop-blur">
              <span className="text-[10px] text-muted-foreground font-semibold">
                Showing {visibleCount} of {filteredLogs.length} logs
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[10px] font-bold px-3.5 h-7 rounded-lg border-border/80 shadow-sm transition-all hover:bg-muted active:scale-95 flex items-center gap-1"
                onClick={handleLoadMore}
              >
                <span>Load More</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </div>
          )}
        </div>

        <CleanContactEmailDialog
          email={selectedCleanEmail}
          entityId={selectedCleanEntityId}
          isOpen={isCleanDialogOpen}
          onClose={() => setIsCleanDialogOpen(false)}
          onSuccess={() => {
            // Re-load logs to update states
            void (async () => {
              try {
                const data = await getMessageNodeLogsAction(automationId, nodeId);
                setLogs(data);
              } catch (err) {
                console.error(err);
              }
            })();
          }}
        />

        {/* Bulk Clean Bounced Confirmation Dialog */}
        <Dialog open={isBulkCleanConfirmOpen} onOpenChange={setIsBulkCleanConfirmOpen}>
          <DialogContent className="rounded-2xl max-w-md bg-slate-900 border border-slate-800 text-slate-100 z-[300]">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-indigo-400 flex items-center gap-2">
                <MagicTrashIcon className="h-5 w-5 text-indigo-400" />
                <span>Bulk Clean Bounced Emails</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                You are about to perform a bulk cleanup for <span className="font-bold text-slate-200">{filteredLogs.length}</span> bounced emails in this log.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-3 text-xs text-slate-300">
              <p>
                Choose how you want to handle these bounced contacts:
              </p>

              <div className="space-y-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="bulkCleanLogsMode"
                    value="archive"
                    checked={bulkCleanMode === 'archive'}
                    onChange={() => setBulkCleanMode('archive')}
                    className="mt-1 accent-indigo-500"
                  />
                  <div>
                    <span className="font-bold text-slate-200 block">Bulk Archive Contacts (Recommended)</span>
                    <span className="text-[10px] text-slate-400">Mark contact status as archived to prevent future sends, keeping logs.</span>
                  </div>
                </label>
              </div>

              <div className="space-y-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="bulkCleanLogsMode"
                    value="delete"
                    checked={bulkCleanMode === 'delete'}
                    onChange={() => setBulkCleanMode('delete')}
                    className="mt-1 accent-red-500"
                  />
                  <div>
                    <span className="font-bold text-red-400 block">Bulk Delete Contacts</span>
                    <span className="text-[10px] text-slate-400">Permanently delete these contact records from their respective companies.</span>
                  </div>
                </label>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button 
                variant="ghost" 
                onClick={() => setIsBulkCleanConfirmOpen(false)} 
                className="h-9 rounded-lg text-xs font-bold active:scale-[0.97] hover:bg-slate-800 text-slate-400"
                disabled={isBulkCleaning}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleBulkCleanLogs} 
                className={`h-9 rounded-lg text-xs font-bold text-white active:scale-[0.97] ${bulkCleanMode === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                disabled={isBulkCleaning}
              >
                {isBulkCleaning ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Cleaning...
                  </>
                ) : (
                  'Confirm Cleanup'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
