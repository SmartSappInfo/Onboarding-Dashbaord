'use client';

/**
 * SmartSapp Forms 2.0: Response Center & Submissions Inbox Master Client
 * 
 * Centralized command center managing qualification lifecycles, custom column
 * visibility presets, instant search/filtering, floating bulk actions, and deep
 * respondent intelligence drawers.
 */

import * as React from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { useToast } from '@/hooks/use-toast';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import type { Form, FormSubmission } from '@/lib/types';
import type { 
  SubmissionStatus, 
  ColumnDefinition 
} from '@/lib/forms/form-response-types';
import { 
  updateSubmissionStatusAction, 
  bulkUpdateSubmissionsAction, 
} from '@/lib/forms/form-response-actions';
import { sanitizeCsvCell } from '@/lib/forms/form-utils';
import { getFormSubmissionsAction } from '@/lib/forms-actions';

import ResponseCenterHeader from './components/ResponseCenterHeader';
import ResponseCenterStats from './components/ResponseCenterStats';
import FormTopicClustersCard from './components/FormTopicClustersCard';
import ResponseCenterGrid from './components/ResponseCenterGrid';
import ResponseBulkToolbar from './components/ResponseBulkToolbar';
import ColumnCustomizerModal from './components/ColumnCustomizerModal';
import SubmissionProfileDrawer from './components/SubmissionProfileDrawer';
import { Button } from '@/components/ui/button';

interface SubmissionsClientProps {
  form: Form;
  initialSubmissions: FormSubmission[];
  initialNextCursor: string | null;
}

export default function SubmissionsClient({
  form,
  initialSubmissions = [],
  initialNextCursor,
}: SubmissionsClientProps) {
  const { toast } = useToast();

  const [submissions, setSubmissions] = React.useState<FormSubmission[]>(initialSubmissions);
  const [nextCursor, setNextCursor] = React.useState<string | null>(initialNextCursor);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  const [activeStatus, setActiveStatus] = React.useState<SubmissionStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [activeSubmission, setActiveSubmission] = React.useState<FormSubmission | null>(null);
  const [isCustomizerOpen, setIsCustomizerOpen] = React.useState(false);
  const [isProcessingBulk, setIsProcessingBulk] = React.useState(false);

  useSetBreadcrumb('Submissions', `/admin/forms/${form.id}/submissions`);

  // Initialize Default Columns
  const defaultColumns = React.useMemo<ColumnDefinition[]>(() => {
    const cols: ColumnDefinition[] = [
      { key: 'respondent', label: 'Respondent', type: 'avatar', isVisible: true, order: 0 },
      { key: 'status', label: 'Status', type: 'badge', isVisible: true, order: 1 },
      { key: 'score', label: 'Lead Score', type: 'score', isVisible: true, order: 2 },
      { key: 'crm', label: 'CRM Record', type: 'text', isVisible: true, order: 3 },
      { key: 'submittedAt', label: 'Submitted At', type: 'date', isVisible: true, order: 4 },
    ];

    // Append custom form fields as optional columns
    if (form.fields && form.fields.length > 0) {
      form.fields.forEach((f, idx) => {
        cols.push({
          key: f.id,
          label: f.labelOverride || f.appFieldId || `Field ${idx + 1}`,
          type: 'text',
          isCustomField: true,
          isVisible: idx < 3, // Default first 3 visible
          order: 5 + idx,
        });
      });
    }

    return cols;
  }, [form.fields]);

  const [columns, setColumns] = React.useState<ColumnDefinition[]>(defaultColumns);

  // Restore column preferences from LocalStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(`form_cols_${form.id}`);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        setColumns(prev => prev.map(c => ({
          ...c,
          isVisible: parsed[c.key] !== undefined ? parsed[c.key] : c.isVisible,
        })));
      }
    } catch {
      // Fallback to defaults
    }
  }, [form.id]);

  const handleToggleColumn = (key: string) => {
    setColumns(prev => {
      const updated = prev.map(c => c.key === key ? { ...c, isVisible: !c.isVisible } : c);
      try {
        const prefMap: Record<string, boolean> = {};
        updated.forEach(c => { prefMap[c.key] = c.isVisible; });
        localStorage.setItem(`form_cols_${form.id}`, JSON.stringify(prefMap));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    try {
      localStorage.removeItem(`form_cols_${form.id}`);
    } catch {
      // ignore
    }
  };

  // Filtered Submissions (instant client search & status tabs)
  const filteredSubmissions = React.useMemo(() => {
    return submissions.filter((sub) => {
      // Status filter
      if (activeStatus !== 'all') {
        const subStatus = sub.status || 'new';
        if (subStatus !== activeStatus) return false;
      }

      // Search term filter across all keys
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const dataStr = sub.data ? JSON.stringify(sub.data).toLowerCase() : '';
        const idStr = (sub.id || '').toLowerCase();
        const entityStr = (sub.entityId || '').toLowerCase();
        if (!dataStr.includes(q) && !idStr.includes(q) && !entityStr.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [submissions, activeStatus, searchTerm]);

  // Row Selection Handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredSubmissions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSubmissions.map(s => s.id));
    }
  };

  // Status Update Handlers
  const handleSingleStatusUpdate = async (submissionId: string, status: SubmissionStatus) => {
    setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status } : s));
    if (activeSubmission?.id === submissionId) {
      setActiveSubmission(prev => prev ? { ...prev, status } : null);
    }
    const res = await updateSubmissionStatusAction(submissionId, status);
    if (!res.success) {
      toast({
        title: 'Status update failed',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  // Single Delete Handler
  const handleSingleDelete = async (submissionId: string) => {
    setSubmissions(prev => prev.filter(s => s.id !== submissionId));
    setSelectedIds(prev => prev.filter(id => id !== submissionId));
    if (activeSubmission?.id === submissionId) setActiveSubmission(null);

    const res = await bulkUpdateSubmissionsAction({
      formId: form.id,
      workspaceId: form.workspaceId,
      submissionIds: [submissionId],
      action: 'delete',
    });

    if (res.success) {
      toast({
        title: 'Submission Deleted',
        description: 'Submission removed successfully.',
      });
    } else {
      toast({
        title: 'Delete Failed',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  // Bulk Actions
  const handleBulkStatusChange = async (status: SubmissionStatus) => {
    if (selectedIds.length === 0) return;
    setIsProcessingBulk(true);
    try {
      const res = await bulkUpdateSubmissionsAction({
        formId: form.id,
        workspaceId: form.workspaceId,
        submissionIds: selectedIds,
        action: 'status',
        status,
      });

      if (res.success) {
        setSubmissions(prev => prev.map(s => selectedIds.includes(s.id) ? { ...s, status } : s));
        setSelectedIds([]);
        toast({
          title: 'Bulk Update Complete',
          description: `Updated status to ${status} for ${res.updatedCount} submissions.`,
        });
      } else {
        toast({
          title: 'Bulk Update Failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessingBulk(true);
    try {
      const res = await bulkUpdateSubmissionsAction({
        formId: form.id,
        workspaceId: form.workspaceId,
        submissionIds: selectedIds,
        action: 'delete',
      });

      if (res.success) {
        setSubmissions(prev => prev.filter(s => !selectedIds.includes(s.id)));
        setSelectedIds([]);
        toast({
          title: 'Bulk Deletion Complete',
          description: `Permanently removed ${res.updatedCount} submissions.`,
        });
      } else {
        toast({
          title: 'Deletion Failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkAiClassify = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessingBulk(true);
    try {
      const { batchClassifySubmissionsAction } = await import('@/lib/forms/form-intelligence-actions');
      const res = await batchClassifySubmissionsAction({
        formId: form.id,
        submissionIds: selectedIds,
      });

      if (res.success) {
        const resultMap = new Map(res.results.map(r => [r.submissionId, r.classification]));
        setSubmissions(prev => prev.map(s => {
          const classified = resultMap.get(s.id);
          return classified ? { ...s, aiClassification: classified } : s;
        }));
        setSelectedIds([]);
        toast({
          title: 'AI Batch Classification Complete ✨',
          description: `Classified ${res.successCount} submissions.`,
        });
      } else {
        toast({
          title: 'Batch Classification Failed',
          description: res.error || 'Could not classify selected submissions.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // CSV Export
  const handleExportCsv = (exportSubs: FormSubmission[]) => {
    if (exportSubs.length === 0) {
      toast({ title: 'Nothing to Export', description: 'No submissions found to export.' });
      return;
    }

    const fieldKeys = form.fields?.map(f => f.id) || [];
    const fieldHeaders = form.fields?.map(f => f.labelOverride || f.appFieldId || f.id) || [];

    let csv = `Submission ID,Status,Lead Score,CRM Entity ID,Submitted At,${fieldHeaders.map(sanitizeCsvCell).join(',')}\n`;

    exportSubs.forEach((s) => {
      const baseCols = [
        sanitizeCsvCell(s.id),
        sanitizeCsvCell(s.status || 'new'),
        sanitizeCsvCell(s.totalScore !== undefined ? s.totalScore : ''),
        sanitizeCsvCell(s.entityId || ''),
        sanitizeCsvCell(s.submittedAt),
      ];

      const fieldVals = fieldKeys.map(k => sanitizeCsvCell(s.data ? s.data[k] : ''));
      csv += `${baseCols.join(',')},${fieldVals.join(',')}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `submissions-${form.slug || form.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Export Downloaded',
      description: `Exported ${exportSubs.length} submissions to CSV.`,
    });
  };

  // Pagination / Load More
  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await getFormSubmissionsAction(form.id, { limit: 50, cursor: nextCursor });
      setSubmissions(prev => [...prev, ...(result.submissions || [])]);
      setNextCursor(result.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <PageContainer>
      <div className="space-y-6 pb-20">
        {/* ── 1. Top Header Bar & Search / Filter Controls ── */}
        <ResponseCenterHeader
          form={form}
          totalSubmissions={submissions.length}
          filteredCount={filteredSubmissions.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          activeStatus={activeStatus}
          onStatusChange={setActiveStatus}
          onOpenColumnCustomizer={() => setIsCustomizerOpen(true)}
          onExportCsv={() => handleExportCsv(filteredSubmissions)}
        />

        {/* ── 2. Status Distribution Metric Pills ── */}
        <ResponseCenterStats
          submissions={submissions}
          activeStatus={activeStatus}
          onSelectStatus={setActiveStatus}
        />

        {/* ── 2b. AI Topic Clusters & Qualitative Research Synthesis (Phase 10) ── */}
        <FormTopicClustersCard
          form={form}
          totalSubmissions={submissions.length}
        />

        {/* ── 3. Submissions Table Grid ── */}
        <ResponseCenterGrid
          submissions={filteredSubmissions}
          form={form}
          columns={columns}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onSelectSubmission={setActiveSubmission}
          onUpdateStatus={handleSingleStatusUpdate}
          onDeleteSubmission={handleSingleDelete}
          onClearFilters={() => {
            setActiveStatus('all');
            setSearchTerm('');
          }}
        />

        {/* ── 4. Load More Button (Cursor Pagination) ── */}
        {nextCursor && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              className="rounded-2xl font-bold px-6 h-10 min-h-[44px] sm:min-h-0"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? 'Loading More Responses...' : 'Load More Responses'}
            </Button>
          </div>
        )}

        {/* ── 5. Floating Bulk Actions Toolbar ── */}
        <ResponseBulkToolbar
          selectedCount={selectedIds.length}
          onClearSelection={() => setSelectedIds([])}
          onBulkStatusChange={handleBulkStatusChange}
          onBulkDelete={handleBulkDelete}
          onBulkExport={() => {
            const selectedSubs = submissions.filter(s => selectedIds.includes(s.id));
            handleExportCsv(selectedSubs);
          }}
          onBulkAiClassify={handleBulkAiClassify}
          isProcessing={isProcessingBulk}
        />

        {/* ── 6. Column Customizer Modal ── */}
        <ColumnCustomizerModal
          isOpen={isCustomizerOpen}
          onClose={() => setIsCustomizerOpen(false)}
          columns={columns}
          onToggleColumn={handleToggleColumn}
          onResetColumns={handleResetColumns}
        />

        {/* ── 7. Full Respondent Detail Drawer ── */}
        <SubmissionProfileDrawer
          submission={activeSubmission}
          form={form}
          onClose={() => setActiveSubmission(null)}
          onStatusUpdated={handleSingleStatusUpdate}
        />
      </div>
    </PageContainer>
  );
}
