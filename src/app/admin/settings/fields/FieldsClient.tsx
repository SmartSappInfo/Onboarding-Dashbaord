'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { AppField } from '@/lib/types';
import { seedNativeFieldsAction, createFieldAction, updateFieldAction, deleteFieldAction } from '@/lib/fields-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Database,
  Search,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Lock,
  Loader2,
  Save,
  Hash,
  FileText,
  BookOpen,
  Layers,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  ListFilter,
  Code,
  Zap,
  Calendar,
  Mail,
  Phone,
  CaseSensitive,
  ToggleLeft,
  Link as LinkIcon,
  MapPin,
  Eye,
  EyeOff,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const FIELD_TYPES: { value: AppField['type']; label: string; icon: React.ElementType }[] = [
  { value: 'short_text', label: 'Short Text', icon: CaseSensitive },
  { value: 'long_text', label: 'Long Text', icon: FileText },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'currency', label: 'Currency', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'datetime', label: 'Date & Time', icon: Calendar },
  { value: 'select', label: 'Dropdown', icon: ListFilter },
  { value: 'multi_select', label: 'Multi-Select', icon: ListFilter },
  { value: 'radio', label: 'Radio', icon: ToggleLeft },
  { value: 'checkbox', label: 'Checkbox', icon: ToggleLeft },
  { value: 'yes_no', label: 'Yes / No', icon: ToggleLeft },
  { value: 'address', label: 'Address', icon: MapPin },
  { value: 'url', label: 'URL', icon: LinkIcon },
  { value: 'hidden', label: 'Hidden', icon: EyeOff },
];

const SECTION_OPTIONS = [
  { value: 'common', label: 'Common' },
  { value: 'institution', label: 'Institution' },
  { value: 'family', label: 'Family' },
  { value: 'child', label: 'Child' },
  { value: 'custom_admissions', label: 'Admissions' },
  { value: 'custom_marketing', label: 'Marketing' },
];

const SCOPE_OPTIONS = [
  { value: 'common', label: 'Common' },
  { value: 'institution', label: 'Institution' },
  { value: 'family', label: 'Family' },
  { value: 'person', label: 'Person' },
  { value: 'submission-only', label: 'Submission Only' },
  { value: 'internal-only', label: 'Internal Only' },
];

const CONTEXTUAL_VARIABLES = [
  { key: 'agreement_url', label: 'Institutional Signing Link', category: 'Finance', description: 'Link to the agreement signing page for the entity.' },
  { key: 'subscription_total', label: 'Total Amount', category: 'Finance', description: 'Computed as nominal roll × subscription rate.' },
  { key: 'meeting_time', label: 'Meeting Time', category: 'Meetings', description: 'Scheduled date/time for the meeting.' },
  { key: 'meeting_link', label: 'Meeting Link', category: 'Meetings', description: 'Virtual meeting URL (Zoom, Google Meet, etc).' },
  { key: 'meeting_type', label: 'Meeting Type', category: 'Meetings', description: 'Type/category of the meeting.' },
  { key: 'survey_score', label: 'Respondent Score', category: 'Surveys', description: 'The score achieved by a survey respondent.' },
  { key: 'max_score', label: 'Survey Max Points', category: 'Surveys', description: 'Maximum possible score for a survey.' },
  { key: 'outcome_label', label: 'Logic Result Name', category: 'Surveys', description: 'The outcome label from conditional survey logic.' },
  { key: 'result_url', label: 'Public Result Link', category: 'Surveys', description: 'Shareable URL for survey results.' },
];

type FieldFormData = {
  label: string;
  variableName: string;
  type: AppField['type'];
  section: string;
  helpText: string;
  placeholder: string;
  compatibilityScope: string[];
  validationRequired: boolean;
  options: string; // Comma-separated for select/radio
};

const defaultFormData: FieldFormData = {
  label: '',
  variableName: '',
  type: 'short_text',
  section: 'common',
  helpText: '',
  placeholder: '',
  compatibilityScope: ['common'],
  validationRequired: false,
  options: '',
};

// ────────────────────────────────────────────
// Helper Functions 
// ────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
}

function getTypeIcon(type: AppField['type']): React.ElementType {
  return FIELD_TYPES.find(ft => ft.value === type)?.icon || CaseSensitive;
}

function getTypeLabel(type: AppField['type']): string {
  return FIELD_TYPES.find(ft => ft.value === type)?.label || type;
}

// ────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────

export default function FieldsClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId, activeOrganizationId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();

  // State
  const [mainTab, setMainTab] = React.useState<'native' | 'custom' | 'sections' | 'variables'>('native');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingField, setEditingField] = React.useState<AppField | null>(null);
  const [deletingField, setDeletingField] = React.useState<AppField | null>(null);
  const [formData, setFormData] = React.useState<FieldFormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Live Firestore subscription
  const fieldsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'app_fields'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('section', 'asc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: fields, isLoading } = useCollection<AppField>(fieldsQuery);

  // Derived data
  const nativeFields = React.useMemo(() => fields?.filter(f => f.isNative) || [], [fields]);
  const customFields = React.useMemo(() => fields?.filter(f => !f.isNative) || [], [fields]);

  const sections = React.useMemo(() => {
    if (!fields) return [];
    const sectionMap = new Map<string, { count: number; native: number; custom: number }>();
    fields.forEach(f => {
      const sec = sectionMap.get(f.section) || { count: 0, native: 0, custom: 0 };
      sec.count++;
      if (f.isNative) sec.native++; else sec.custom++;
      sectionMap.set(f.section, sec);
    });
    return Array.from(sectionMap.entries()).map(([name, stats]) => ({ name, ...stats }));
  }, [fields]);

  const filteredFields = React.useMemo(() => {
    const source = mainTab === 'native' ? nativeFields : customFields;
    if (!searchTerm) return source;
    const s = searchTerm.toLowerCase();
    return source.filter(f =>
      f.label.toLowerCase().includes(s) ||
      f.variableName.toLowerCase().includes(s) ||
      f.section.toLowerCase().includes(s)
    );
  }, [mainTab, nativeFields, customFields, searchTerm]);

  // Handlers
  const handleSeed = async () => {
    if (!activeWorkspaceId || !activeOrganizationId) return;
    setIsSeeding(true);
    const result = await seedNativeFieldsAction(activeWorkspaceId, activeOrganizationId);
    if (result.success) {
      toast({ title: 'Registry Seeded', description: `${result.seeded} native fields added, ${result.skipped} already existed.` });
    } else {
      toast({ variant: 'destructive', title: 'Seeding Failed', description: result.error });
    }
    setIsSeeding(false);
  };

  const openCreate = () => {
    setFormData(defaultFormData);
    setEditingField(null);
    setIsCreateOpen(true);
  };

  const openEdit = (field: AppField) => {
    setFormData({
      label: field.label,
      variableName: field.variableName,
      type: field.type,
      section: field.section,
      helpText: field.helpText || '',
      placeholder: field.placeholder || '',
      compatibilityScope: field.compatibilityScope || ['common'],
      validationRequired: field.validationRules?.required || false,
      options: field.options?.map(o => o.label).join(', ') || '',
    });
    setEditingField(field);
    setIsCreateOpen(true);
  };

  const handleSave = async () => {
    if (!formData.label.trim() || !activeWorkspaceId || !activeOrganizationId) return;
    setIsSubmitting(true);
    try {
      const variableName = formData.variableName || slugify(formData.label);
      const options = formData.options
        ? formData.options.split(',').map(o => o.trim()).filter(Boolean).map(o => ({ value: slugify(o), label: o }))
        : undefined;

      if (editingField) {
        const result = await updateFieldAction(editingField.id, {
          label: formData.label,
          variableName,
          type: formData.type,
          section: formData.section,
          helpText: formData.helpText || undefined,
          placeholder: formData.placeholder || undefined,
          compatibilityScope: formData.compatibilityScope as AppField['compatibilityScope'],
          validationRules: { required: formData.validationRequired },
          options,
        }, user?.uid ?? '');
        if (result.success) {
          toast({ title: 'Field Updated', description: `"${formData.label}" has been saved.` });
          setIsCreateOpen(false);
          setEditingField(null);
        } else {
          toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
        }
      } else {
        const result = await createFieldAction({
          workspaceId: activeWorkspaceId,
          organizationId: activeOrganizationId,
          name: slugify(formData.label),
          label: formData.label,
          variableName,
          type: formData.type,
          section: formData.section,
          isNative: false,
          compatibilityScope: formData.compatibilityScope as AppField['compatibilityScope'],
          helpText: formData.helpText || undefined,
          placeholder: formData.placeholder || undefined,
          validationRules: { required: formData.validationRequired },
          options,
          status: 'active',
        }, user?.uid ?? '');
        if (result.success) {
          toast({ title: 'Field Created', description: `"${formData.label}" has been added to your registry.` });
          setIsCreateOpen(false);
        } else {
          toast({ variant: 'destructive', title: 'Creation Failed', description: result.error });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingField) return;
    setIsSubmitting(true);
    try {
      const result = await deleteFieldAction(deletingField.id, user?.uid ?? '');
      if (result.success) {
        toast({ title: 'Field Deleted', description: `"${deletingField.label}" has been removed.` });
        setDeletingField(null);
      } else {
        toast({ variant: 'destructive', title: 'Delete Failed', description: result.error });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyVariable = (variableName: string) => {
    navigator.clipboard.writeText(`{{${variableName}}}`);
    toast({ title: 'Variable Copied', description: `{{${variableName}}} is ready to paste.` });
  };

  const handleToggleStatus = async (field: AppField) => {
    const newStatus = field.status === 'active' ? 'inactive' : 'active';
    const result = await updateFieldAction(field.id, { status: newStatus }, user?.uid ?? '');
    if (result.success) {
      toast({ title: newStatus === 'active' ? 'Field Activated' : 'Field Deactivated' });
    } else {
      toast({ variant: 'destructive', title: 'Status Update Failed' });
    }
  };

  // Auto-generate variableName from label
  React.useEffect(() => {
    if (!editingField && formData.label && !formData.variableName) {
      // Don't override if user manually set it
    }
  }, [formData.label, editingField, formData.variableName]);

  const handleLabelChange = (newLabel: string) => {
    const updates: Partial<FieldFormData> = { label: newLabel };
    // Auto-slug only for new custom fields
    if (!editingField || !editingField.isNative) {
      updates.variableName = slugify(newLabel);
    }
    setFormData(prev => ({ ...prev, ...updates }));
  };

  if (!activeWorkspaceId) {
    return (
      <div className="h-full overflow-y-auto bg-background">
        <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
          <div className="p-6 bg-card rounded-2xl shadow-inner border border-border/50">
            <Database className="h-12 w-12 text-muted-foreground/20" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">No workspace selected. Please select a workspace to manage fields.</p>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────
  // Render
  // ────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Fields & Variables</h1>
            <p className="text-sm text-muted-foreground font-medium mt-1">
              Manage data capture fields, template variables, and workspace-scoped sections
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleSeed}
              disabled={isSeeding || isLoading}
              className="rounded-xl font-semibold h-11 gap-2 shadow-sm border-primary/20 hover:bg-primary/5"
            >
              {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Seed Defaults
            </Button>
            <Button
              onClick={openCreate}
              className="rounded-xl font-bold shadow-lg h-11 px-6"
            >
              <Plus className="mr-2 h-5 w-5" /> New Field
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm rounded-2xl bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl"><Database className="h-4 w-4 text-primary" /></div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground">Total Fields</p>
                  <p className="text-2xl font-semibold tabular-nums">{isLoading ? '—' : (fields?.length || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm rounded-2xl bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl"><ShieldCheck className="h-4 w-4 text-emerald-600" /></div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground">Native</p>
                  <p className="text-2xl font-semibold tabular-nums">{isLoading ? '—' : nativeFields.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm rounded-2xl bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-xl"><Pencil className="h-4 w-4 text-amber-600" /></div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground">Custom</p>
                  <p className="text-2xl font-semibold tabular-nums">{isLoading ? '—' : customFields.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm rounded-2xl bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl"><Layers className="h-4 w-4 text-blue-600" /></div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground">Sections</p>
                  <p className="text-2xl font-semibold tabular-nums">{isLoading ? '—' : sections.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={mainTab} onValueChange={v => setMainTab(v as any)}>
          <TabsList className="bg-background border shadow-sm p-1 h-12 rounded-2xl gap-1">
            <TabsTrigger value="native" className="rounded-xl font-semibold text-[10px] px-4 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
              <ShieldCheck className="h-3.5 w-3.5" /> Native Fields
            </TabsTrigger>
            <TabsTrigger value="custom" className="rounded-xl font-semibold text-[10px] px-4 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
              <Pencil className="h-3.5 w-3.5" /> Custom Fields
            </TabsTrigger>
            <TabsTrigger value="sections" className="rounded-xl font-semibold text-[10px] px-4 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
              <Layers className="h-3.5 w-3.5" /> Sections
            </TabsTrigger>
            <TabsTrigger value="variables" className="rounded-xl font-semibold text-[10px] px-4 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
              <Code className="h-3.5 w-3.5" /> Variables Reference
            </TabsTrigger>
          </TabsList>

          {/* Search Bar */}
          {(mainTab === 'native' || mainTab === 'custom') && (
            <Card className="border-none shadow-sm rounded-2xl bg-card mt-6">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by label, variable name, or section…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 h-10 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Native Fields Tab */}
          <TabsContent value="native" className="mt-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
              </div>
            ) : filteredFields.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-background">
                <Database className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-[10px] font-semibold text-muted-foreground">
                  {searchTerm ? 'No native fields match your search' : 'No native fields yet. Click "Seed Defaults" to populate.'}
                </p>
                {!searchTerm && (
                  <Button variant="outline" size="sm" onClick={handleSeed} disabled={isSeeding} className="mt-4 rounded-xl font-bold">
                    {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Seed Native Fields
                  </Button>
                )}
              </div>
            ) : (
              <FieldsTable fields={filteredFields} onEdit={openEdit} onDelete={setDeletingField} onCopy={handleCopyVariable} onToggle={handleToggleStatus} />
            )}
          </TabsContent>

          {/* Custom Fields Tab */}
          <TabsContent value="custom" className="mt-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
              </div>
            ) : filteredFields.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-background">
                <Pencil className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-[10px] font-semibold text-muted-foreground">
                  {searchTerm ? 'No custom fields match your search' : 'No custom fields created yet.'}
                </p>
                {!searchTerm && (
                  <Button variant="outline" size="sm" onClick={openCreate} className="mt-4 rounded-xl font-bold">
                    <Plus className="mr-2 h-4 w-4" /> Create Custom Field
                  </Button>
                )}
              </div>
            ) : (
              <FieldsTable fields={filteredFields} onEdit={openEdit} onDelete={setDeletingField} onCopy={handleCopyVariable} onToggle={handleToggleStatus} />
            )}
          </TabsContent>

          {/* Sections Tab */}
          <TabsContent value="sections" className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
              </div>
            ) : sections.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-background">
                <Layers className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-[10px] font-semibold text-muted-foreground">No sections yet. Create fields to auto-generate sections.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sections.map(sec => (
                  <Card key={sec.name} className="border-border/50 shadow-sm rounded-2xl bg-card hover:shadow-md transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-primary/10 rounded-xl">
                          <Layers className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm tracking-tight capitalize">{sec.name.replace(/_/g, ' ')}</p>
                          <p className="text-[10px] text-muted-foreground font-medium">{sec.count} fields</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
                          {sec.native} Native
                        </Badge>
                        <Badge variant="outline" className="text-[9px] font-semibold bg-amber-50 text-amber-700 border-amber-200">
                          {sec.custom} Custom
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Variables Reference Tab */}
          <TabsContent value="variables" className="mt-6 space-y-6">
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <CardHeader className="bg-primary/10 border-b pb-4">
                <CardTitle className="text-[10px] font-semibold text-primary flex items-center gap-2">
                  <BookOpen className="h-3 w-3" /> Contextual Variables Reference
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <p className="text-xs text-muted-foreground font-medium p-6 pb-0 text-left">
                  These variables are available in messaging templates but are not data-capture fields. They are resolved at send time from contextual data (meetings, finance, surveys).
                </p>
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="pl-6 text-[10px] font-semibold py-4">Variable Tag</TableHead>
                      <TableHead className="text-[10px] font-semibold py-4">Label</TableHead>
                      <TableHead className="text-[10px] font-semibold py-4">Category</TableHead>
                      <TableHead className="text-[10px] font-semibold py-4">Description</TableHead>
                      <TableHead className="text-right pr-6 text-[10px] font-semibold py-4">Copy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {CONTEXTUAL_VARIABLES.map(v => (
                      <TableRow key={v.key} className="group hover:bg-accent/5 transition-colors">
                        <TableCell className="pl-6">
                          <code className="text-[10px] font-mono font-semibold text-primary opacity-70 bg-primary/5 px-2 py-1 rounded-md">
                            {'{{' + v.key + '}}'}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm font-semibold">{v.label}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[9px] font-semibold uppercase h-5 bg-primary/10 border-border/50">
                            {v.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground font-medium text-left max-w-[250px]">{v.description}</TableCell>
                        <TableCell className="text-right pr-6">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:text-primary"
                            onClick={() => handleCopyVariable(v.key)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={o => { if (!o) { setIsCreateOpen(false); setEditingField(null); } }}>
        <DialogContent className="sm:max-w-lg rounded-2xl bg-card border shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-xl"><Database className="h-5 w-5 text-primary" /></div>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {editingField ? 'Edit Field' : 'Create Custom Field'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs font-bold text-muted-foreground text-left">
              {editingField?.isNative
                ? 'Native fields have limited edit options. You can update the label and help text.'
                : 'Define a new data capture point for forms and templates.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4 text-left">
            {/* Label */}
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Field Label *</Label>
              <Input
                value={formData.label}
                onChange={e => handleLabelChange(e.target.value)}
                placeholder="e.g. Parent Name"
                className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"
              />
            </div>

            {/* Variable Name */}
            {(!editingField || !editingField.isNative) && (
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Variable Name</Label>
                <div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-background/50 focus-within:ring-1 focus-within:ring-primary/20 shadow-inner">
                  <div className="bg-muted px-3 flex items-center text-[10px] font-semibold text-muted-foreground/60 border-r">{'{{'}</div>
                  <Input
                    value={formData.variableName}
                    onChange={e => setFormData(p => ({ ...p, variableName: e.target.value.replace(/\s+/g, '_').toLowerCase() }))}
                    placeholder="auto_generated"
                    className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent font-mono font-semibold"
                  />
                  <div className="bg-muted px-3 flex items-center text-[10px] font-semibold text-muted-foreground/60 border-l">{'}}'}</div>
                </div>
              </div>
            )}

            {/* Type & Section */}
            {(!editingField || !editingField.isNative) && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Field Type</Label>
                  <Select value={formData.type} onValueChange={v => setFormData(p => ({ ...p, type: v as AppField['type'] }))}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {FIELD_TYPES.map(ft => (
                        <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Section</Label>
                  <Select value={formData.section} onValueChange={v => setFormData(p => ({ ...p, section: v }))}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {SECTION_OPTIONS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Options (for select/radio types) */}
            {(['select', 'multi_select', 'radio'].includes(formData.type)) && (!editingField || !editingField.isNative) && (
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Options (comma-separated)</Label>
                <Input
                  value={formData.options}
                  onChange={e => setFormData(p => ({ ...p, options: e.target.value }))}
                  placeholder="e.g. Option A, Option B, Option C"
                  className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-medium"
                />
              </div>
            )}

            {/* Help Text */}
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Help Text</Label>
              <Textarea
                value={formData.helpText}
                onChange={e => setFormData(p => ({ ...p, helpText: e.target.value }))}
                placeholder="Optional guidance shown beneath the field..."
                className="min-h-[60px] rounded-xl bg-background/50 border-none p-4 font-medium resize-none"
                rows={2}
              />
            </div>

            {/* Placeholder */}
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Placeholder</Label>
              <Input
                value={formData.placeholder}
                onChange={e => setFormData(p => ({ ...p, placeholder: e.target.value }))}
                placeholder="e.g. Enter your full name"
                className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-medium"
              />
            </div>

            {/* Required toggle */}
            {(!editingField || !editingField.isNative) && (
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                <Label className="text-xs font-semibold">Required by default</Label>
                <Switch
                  checked={formData.validationRequired}
                  onCheckedChange={v => setFormData(p => ({ ...p, validationRequired: v }))}
                />
              </div>
            )}
          </div>

          <DialogFooter className="bg-muted/30 p-4 -mx-6 -mb-6 mt-4">
            <Button variant="ghost" onClick={() => { setIsCreateOpen(false); setEditingField(null); }} className="font-bold">Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={isSubmitting || !formData.label.trim()}
              className="rounded-xl font-bold px-8 shadow-lg min-w-[140px]"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {editingField ? 'Save Changes' : 'Create Field'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingField} onOpenChange={open => !open && setDeletingField(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold">Delete Field?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-bold">&quot;{deletingField?.label}&quot;</span> and its variable <code className="text-primary font-mono text-xs">{'{{'}{deletingField?.variableName}{'}}'}</code> from the registry. Any forms using this field will need to be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold"
            >
              {isSubmitting ? 'Deleting...' : 'Delete Field'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────

function FieldsTable({
  fields,
  onEdit,
  onDelete,
  onCopy,
  onToggle,
}: {
  fields: AppField[];
  onEdit: (f: AppField) => void;
  onDelete: (f: AppField) => void;
  onCopy: (variableName: string) => void;
  onToggle: (f: AppField) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden ring-1 ring-border/50">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="pl-6 text-[10px] font-semibold py-4">Field Label & Variable</TableHead>
            <TableHead className="text-[10px] font-semibold py-4">Type</TableHead>
            <TableHead className="text-[10px] font-semibold py-4">Section</TableHead>
            <TableHead className="text-center text-[10px] font-semibold py-4">Scope</TableHead>
            <TableHead className="text-center text-[10px] font-semibold py-4">Status</TableHead>
            <TableHead className="text-right pr-6 text-[10px] font-semibold py-4">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map(field => {
            const TypeIcon = getTypeIcon(field.type);
            const isInactive = field.status === 'inactive';
            return (
              <TableRow key={field.id} className={cn('group hover:bg-accent/5 transition-colors', isInactive && 'opacity-50')}>
                <TableCell className="pl-6 w-[300px]">
                  <div className="flex flex-col gap-0.5 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{field.label}</span>
                      {field.isNative && (
                        <Badge variant="secondary" className="h-4 text-[8px] uppercase px-1.5 gap-0.5">
                          <Lock className="h-2.5 w-2.5" /> Native
                        </Badge>
                      )}
                    </div>
                    <code className="text-[10px] font-mono text-primary font-semibold opacity-60">
                      {'{{' + field.variableName + '}}'}
                    </code>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-semibold text-muted-foreground">{getTypeLabel(field.type)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[9px] font-semibold capitalize h-5 bg-primary/5 border-border/50">
                    {field.section.replace(/_/g, ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-wrap gap-1 justify-center">
                    {field.compatibilityScope?.slice(0, 2).map(s => (
                      <Badge key={s} variant="outline" className="text-[8px] font-medium h-4 capitalize">
                        {s}
                      </Badge>
                    ))}
                    {(field.compatibilityScope?.length || 0) > 2 && (
                      <Badge variant="outline" className="text-[8px] font-medium h-4">
                        +{field.compatibilityScope.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    className={cn(
                      'text-[9px] font-semibold uppercase h-5 px-2',
                      isInactive
                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    )}
                  >
                    {field.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex items-center justify-end gap-1">
                    <Switch
                      checked={field.status === 'active'}
                      onCheckedChange={() => onToggle(field)}
                      className="scale-75"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-primary" onClick={() => onCopy(field.variableName)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onEdit(field)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!field.isNative && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => onDelete(field)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
