'use client';

import * as React from 'react';
import { collection, doc, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { AppField, FieldGroup, EntityType, Workspace } from '@/lib/types';
import { seedNativeFieldsAction, createFieldAction, updateFieldAction, deleteFieldAction, createFieldGroupAction, updateFieldGroupAction, deleteFieldGroupAction, reorderFieldGroupsAction, listIndustryPredefinedGroupsAction, installPredefinedIndustryGroupsAction } from '@/lib/fields-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATIC_VARIABLES } from '@/lib/template-variable-registry-data';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { PageContainer } from '@/components/ui/page-container';

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const FIELD_TYPES: { value: AppField['type']; label: string; icon: React.ElementType }[] = [
  { value: 'short_text', label: 'Short Text', icon: LucideIcons.CaseSensitive },
  { value: 'long_text', label: 'Long Text', icon: LucideIcons.FileText },
  { value: 'email', label: 'Email', icon: LucideIcons.Mail },
  { value: 'phone', label: 'Phone', icon: LucideIcons.Phone },
  { value: 'number', label: 'Number', icon: LucideIcons.Hash },
  { value: 'currency', label: 'Currency', icon: LucideIcons.Hash },
  { value: 'date', label: 'Date', icon: LucideIcons.Calendar },
  { value: 'datetime', label: 'Date & Time', icon: LucideIcons.Calendar },
  { value: 'select', label: 'Dropdown', icon: LucideIcons.ListFilter },
  { value: 'multi_select', label: 'Multi-Select', icon: LucideIcons.ListFilter },
  { value: 'radio', label: 'Radio', icon: LucideIcons.ToggleLeft },
  { value: 'checkbox', label: 'Checkbox', icon: LucideIcons.ToggleLeft },
  { value: 'yes_no', label: 'Yes / No', icon: LucideIcons.ToggleLeft },
  { value: 'address', label: 'Address', icon: LucideIcons.MapPin },
  { value: 'url', label: 'URL', icon: LucideIcons.LinkIcon },
  { value: 'hidden', label: 'Hidden', icon: LucideIcons.EyeOff },
];

const COMMON_GROUP_ICONS = [
  'Database', 'User', 'Users', 'Briefcase', 'Heart', 'Stethoscope',
  'FileText', 'File', 'MapPin', 'CreditCard', 'Shield', 'Settings',
  'GraduationCap', 'Book', 'Wallet', 'Activity', 'Badge', 'Landmark',
  'Building', 'Folder', 'List', 'CheckSquare', 'Tag', 'Hash', 'Globe',
  'Monitor', 'Smartphone', 'Mail', 'Calendar', 'BriefcaseMedical', 'ShieldAlert'
];

const SCOPE_OPTIONS = [
  { value: 'common', label: 'Common (All)' },
  { value: 'institution', label: 'Institution/Company' },
  { value: 'family', label: 'Family' },
  { value: 'person', label: 'Person/Contact' },
  { value: 'submission-only', label: 'Submission Only' },
];

type FieldFormData = {
  groupId: string;
  label: string;
  variableName: string;
  type: AppField['type'];
  helpText: string;
  placeholder: string;
  compatibilityScope: string[];
  validationRequired: boolean;
  options: { label: string; value: string }[];
};

const defaultFieldData: FieldFormData = {
  groupId: '',
  label: '',
  variableName: '',
  type: 'short_text',
  helpText: '',
  placeholder: '',
  compatibilityScope: ['common'],
  validationRequired: false,
  options: [],
};

type GroupFormData = {
  name: string;
  description: string;
  icon: string;
  color: string;
  entityTypes: EntityType[];
};

const defaultGroupData: GroupFormData = {
  name: '',
  description: '',
  icon: 'Database',
  color: '#3b82f6',
  entityTypes: ['institution', 'person'],
};

// ────────────────────────────────────────────
// Helper Components
// ────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 50);
}
function SortableGroupAccordionItem({ 
  group, 
  fields, 
  singularTerm = 'Entity',
  onEditGroup, 
  onDeleteGroup, 
  onAddField, 
  onEditField, 
  onDeleteField,
  onCopyVariable
}: { 
  group: FieldGroup; 
  fields: AppField[]; 
  singularTerm?: string;
  onEditGroup: (g: FieldGroup) => void;
  onDeleteGroup: (g: FieldGroup) => void;
  onAddField: (g: FieldGroup) => void;
  onEditField: (f: AppField) => void;
  onDeleteField: (f: AppField) => void;
  onCopyVariable: (v: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : 0, position: isDragging ? 'relative' : 'static' as any };
  
  const Icon = (LucideIcons as any)[group.icon] || LucideIcons.Database;

  return (
    <AccordionItem ref={setNodeRef} style={style} value={group.id} className={cn("bg-card border rounded-lg mb-3 overflow-hidden shadow-sm", isDragging && "opacity-50 ring-2 ring-primary")}>
      <div className="flex items-center px-2 border-b bg-muted/20">
        <div {...attributes} {...listeners} className="cursor-grab p-2 hover:bg-muted rounded text-muted-foreground touch-none">
          <LucideIcons.GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <AccordionTrigger className="hover:no-underline py-3 px-2">
            <div className="flex items-center gap-3 w-full">
              <div className="p-2 rounded-md flex-shrink-0" style={{ backgroundColor: `${group.color}20`, color: group.color }}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="font-semibold text-sm">
                  {group.slug === 'entity_details' ? `${singularTerm} Details` : group.name}
                </span>
                <span className="text-xs text-muted-foreground">{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </AccordionTrigger>
        </div>
        <div className="flex items-center gap-2 pr-4">
          <Button variant="outline" size="sm" onClick={() => onAddField(group)} className="h-8 px-2 md:px-3 text-xs">
            <LucideIcons.Plus className="h-3.5 w-3.5 md:mr-1" />
            <span className="hidden md:inline">Add Field</span>
          </Button>
          {!group.isSystem && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditGroup(group)}>
                <LucideIcons.Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDeleteGroup(group)}>
                <LucideIcons.Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {group.isSystem && (
            <Badge variant="secondary" className="ml-1 md:ml-2 font-normal text-[10px] md:text-xs py-0.5 px-1.5 md:px-2">
              <LucideIcons.Lock className="h-3 w-3 md:mr-1" />
              <span className="hidden md:inline">System</span>
            </Badge>
          )}
        </div>
      </div>
      <AccordionContent className="p-0 border-t-0">
        {fields.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm bg-muted/10">
            No fields in this group.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[250px]">Field Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Variable Tag</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map(field => {
                const FieldIcon = FIELD_TYPES.find(t => t.value === field.type)?.icon || LucideIcons.CaseSensitive;
                return (
                  <TableRow key={field.id} className={cn(!field.isNative && "bg-muted/5")}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {field.isNative && <LucideIcons.Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                        {field.label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FieldIcon className="h-3.5 w-3.5" />
                        {FIELD_TYPES.find(t => t.value === field.type)?.label || field.type}
                      </div>
                    </TableCell>
                    <TableCell>
                      <button 
                        onClick={() => onCopyVariable(`{{${field.variableName}}}`)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-muted hover:bg-primary/10 hover:text-primary transition-colors text-xs font-mono"
                      >
                        {`{{${field.variableName}}}`}
                        <LucideIcons.Copy className="h-3 w-3" />
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {field.compatibilityScope.map(scope => (
                          <Badge key={scope} variant="outline" className="text-[10px] uppercase">{scope}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditField(field)}>
                        <LucideIcons.Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!field.isNative && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => onDeleteField(field)}>
                          <LucideIcons.Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

// ────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────

export default function FieldsClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId, activeOrganizationId, isSuperAdmin } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();

  // Queries
  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'field_groups'), where('workspaceId', '==', activeWorkspaceId), orderBy('order', 'asc'));
  }, [firestore, activeWorkspaceId]);

  const fieldsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'app_fields'), where('workspaceId', '==', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);

  const { data: rawGroups, isLoading: loadingGroups } = useCollection<FieldGroup>(groupsQuery);
  const { data: fields, isLoading: loadingFields } = useCollection<AppField>(fieldsQuery);

  // Load workspace enabled features
  const workspaceDocRef = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return doc(firestore, 'workspaces', activeWorkspaceId);
  }, [firestore, activeWorkspaceId]);

  const { data: workspace } = useDoc<Workspace>(workspaceDocRef);
  const enabledFeatures = (workspace?.enabledFeatures || {}) as Record<string, boolean | undefined>;

  const [isSyncing, setIsSyncing] = React.useState(false);

  React.useEffect(() => {
    if (loadingGroups || !rawGroups || !activeWorkspaceId || !activeOrganizationId || !user?.uid || isSyncing) return;

    // Check if any restructured system groups are missing
    const existingSlugs = new Set(rawGroups.map(g => g.slug));
    const expectedSlugs = ['entity_details', 'location_data', 'billing_profile', 'entity_contacts'];
    const hasMissing = expectedSlugs.some(slug => !existingSlugs.has(slug));

    if (hasMissing) {
      async function runAutoSeed() {
        setIsSyncing(true);
        try {
          console.log('[AUTO-SEED] Seeding missing platform/system groups...');
          await seedNativeFieldsAction(activeWorkspaceId!, activeOrganizationId!, user!.uid, true);
        } catch (e) {
          console.error('[AUTO-SEED] Seeding failed:', e);
        } finally {
          setIsSyncing(false);
        }
      }
      runAutoSeed();
    }
  }, [rawGroups, loadingGroups, activeWorkspaceId, activeOrganizationId, user?.uid, isSyncing]);

  const [systemVarContext, setSystemVarContext] = React.useState<string>('all');

  const filteredStaticVariables = React.useMemo(() => {
    const contextToFeatureMap: Record<string, string> = {
      meeting: 'meetings',
      survey: 'surveys',
      form: 'forms',
      agreement: 'agreements',
      users: 'users',
    };

    return STATIC_VARIABLES.filter(v => {
      // 1. Filter by workspace feature toggle
      const featureId = contextToFeatureMap[v.context];
      if (featureId && enabledFeatures[featureId] === false) {
        return false;
      }
      // 2. Filter by selected context tab/dropdown
      if (systemVarContext !== 'all' && v.context !== systemVarContext) {
        return false;
      }
      return true;
    });
  }, [enabledFeatures, systemVarContext]);

  const [groups, setGroups] = React.useState<FieldGroup[]>([]);
  React.useEffect(() => {
    if (rawGroups) setGroups(rawGroups);
  }, [rawGroups]);

  // Predefined industry groups states
  const [predefinedGroups, setPredefinedGroups] = React.useState<any[]>([]);
  const [selectedGroupSlugs, setSelectedGroupSlugs] = React.useState<string[]>([]);
  const [loadingPredefined, setLoadingPredefined] = React.useState(false);
  const [isInitializing, setIsInitializing] = React.useState(false);

  React.useEffect(() => {
    if (!loadingGroups && groups.length === 0) {
      async function fetchPredefined() {
        setLoadingPredefined(true);
        try {
          const industry = workspace?.industry || 'SchoolEnrollment';
          const res = await listIndustryPredefinedGroupsAction(industry as any);
          if (res.success && res.data) {
            setPredefinedGroups(res.data);
            setSelectedGroupSlugs(res.data.map(g => g.slug));
          }
        } catch (e) {
          console.error('Failed to fetch predefined groups:', e);
        } finally {
          setLoadingPredefined(false);
        }
      }
      fetchPredefined();
    }
  }, [loadingGroups, groups.length, workspace?.industry]);

  const handleInitializeGroups = async () => {
    if (!activeWorkspaceId || !activeOrganizationId || !user?.uid || selectedGroupSlugs.length === 0) return;
    setIsInitializing(true);
    try {
      const res = await installPredefinedIndustryGroupsAction(
        activeWorkspaceId,
        activeOrganizationId,
        selectedGroupSlugs,
        user.uid
      );
      if (res.success) {
        toast({ title: 'Workspace Initialized', description: 'Selected field groups have been installed.' });
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Initialization Failed', description: err.message });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleToggleGroupSlug = (slug: string) => {
    setSelectedGroupSlugs(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  // State
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Modals
  const [fieldModalOpen, setFieldModalOpen] = React.useState(false);
  const [editingField, setEditingField] = React.useState<AppField | null>(null);
  const [fieldForm, setFieldForm] = React.useState<FieldFormData>(defaultFieldData);

  const [groupModalOpen, setGroupModalOpen] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<FieldGroup | null>(null);
  const [groupForm, setGroupForm] = React.useState<GroupFormData>(defaultGroupData);

  const [deletingField, setDeletingField] = React.useState<AppField | null>(null);
  const [deletingGroup, setDeletingGroup] = React.useState<FieldGroup | null>(null);

  // Options Dialog for select/multiselect fields (themed blue for Admin)
  const [optionsDialogOpen, setOptionsDialogOpen] = React.useState(false);
  const [newOptionLabel, setNewOptionLabel] = React.useState('');
  const [newOptionValue, setNewOptionValue] = React.useState('');

  const handleAddOption = () => {
    if (!newOptionLabel || !newOptionValue) return;
    const currentOptions = fieldForm.options || [];
    const updatedOptions = [...currentOptions, { label: newOptionLabel, value: newOptionValue }];
    setFieldForm(prev => ({ ...prev, options: updatedOptions }));
    setNewOptionLabel('');
    setNewOptionValue('');
  };

  const handleRemoveOption = (optionIdx: number) => {
    const updatedOptions = [...(fieldForm.options || [])];
    updatedOptions.splice(optionIdx, 1);
    setFieldForm(prev => ({ ...prev, options: updatedOptions }));
  };

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Computed
  const filteredGroups = React.useMemo(() => {
    if (!searchTerm) return groups;
    const s = searchTerm.toLowerCase();
    return groups.filter(g => 
      g.name.toLowerCase().includes(s) || 
      (fields || []).some(f => f.groupId === g.id && (f.label.toLowerCase().includes(s) || f.variableName.toLowerCase().includes(s)))
    );
  }, [groups, fields, searchTerm]);

  // Handlers
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = groups.findIndex(g => g.id === active.id);
      const newIndex = groups.findIndex(g => g.id === over?.id);
      
      const newGroups = arrayMove(groups, oldIndex, newIndex);
      setGroups(newGroups);
      
      // Update order in firestore
      const updates = newGroups.map((g, idx) => ({ id: g.id, order: idx * 10 }));
      if (activeWorkspaceId && user?.uid) {
        await reorderFieldGroupsAction(updates, activeWorkspaceId, user.uid);
      }
    }
  };

  const handleCopyVariable = (val: string) => {
    navigator.clipboard.writeText(val);
    toast({ title: 'Copied to Clipboard', description: val });
  };

  // Group Form
  const openNewGroup = () => {
    setGroupForm(defaultGroupData);
    setEditingGroup(null);
    setGroupModalOpen(true);
  };

  const openEditGroup = (g: FieldGroup) => {
    setGroupForm({
      name: g.name,
      description: g.description || '',
      icon: g.icon,
      color: g.color,
      entityTypes: g.entityTypes,
    });
    setEditingGroup(g);
    setGroupModalOpen(true);
  };

  const saveGroup = async () => {
    if (!groupForm.name.trim() || !activeWorkspaceId || !activeOrganizationId || !user?.uid) return;
    setIsSubmitting(true);
    try {
      if (editingGroup) {
        const res = await updateFieldGroupAction(editingGroup.id, groupForm, user.uid);
        if (res.success) {
          toast({ title: 'Group Updated' });
          setGroupModalOpen(false);
        } else throw new Error(res.error);
      } else {
        const res = await createFieldGroupAction({ ...groupForm, workspaceId: activeWorkspaceId, organizationId: activeOrganizationId }, user.uid);
        if (res.success) {
          toast({ title: 'Group Created' });
          setGroupModalOpen(false);
        } else throw new Error(res.error);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
    setIsSubmitting(false);
  };

  const executeDeleteGroup = async () => {
    if (!deletingGroup || !user?.uid) return;
    const res = await deleteFieldGroupAction(deletingGroup.id, user.uid);
    if (res.success) {
      toast({ title: 'Group Deleted' });
      setDeletingGroup(null);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: res.error });
    }
  };

  // Field Form
  const openNewField = (g?: FieldGroup) => {
    setFieldForm({ ...defaultFieldData, groupId: g?.id || (groups.length > 0 ? groups[0].id : '') });
    setEditingField(null);
    setFieldModalOpen(true);
  };

  const openEditField = (f: AppField) => {
    setFieldForm({
      groupId: f.groupId || '',
      label: f.label,
      variableName: f.variableName,
      type: f.type,
      helpText: f.helpText || '',
      placeholder: f.placeholder || '',
      compatibilityScope: f.compatibilityScope || ['common'],
      validationRequired: f.validationRules?.required || false,
      options: f.options || [],
    });
    setEditingField(f);
    setFieldModalOpen(true);
  };

  const saveField = async () => {
    if (!fieldForm.label.trim() || !fieldForm.groupId || !activeWorkspaceId || !activeOrganizationId || !user?.uid) return;
    setIsSubmitting(true);
    try {
      const variableName = fieldForm.variableName || slugify(fieldForm.label);
      const options = ['select', 'multi_select', 'radio'].includes(fieldForm.type) && fieldForm.options && fieldForm.options.length > 0
        ? fieldForm.options
        : undefined;
      const payload: Partial<AppField> = {
        label: fieldForm.label,
        variableName,
        type: fieldForm.type,
        groupId: fieldForm.groupId,
        section: 'common', // legacy fallback
        helpText: fieldForm.helpText || undefined,
        placeholder: fieldForm.placeholder || undefined,
        compatibilityScope: fieldForm.compatibilityScope as any,
        validationRules: { required: fieldForm.validationRequired },
        options,
      };

      if (editingField) {
        const res = await updateFieldAction(editingField.id, payload, user.uid);
        if (res.success) {
          toast({ title: 'Field Updated' });
          setFieldModalOpen(false);
        } else throw new Error(res.error);
      } else {
        const createPayload = { ...payload, workspaceId: activeWorkspaceId, organizationId: activeOrganizationId, isNative: false, status: 'active' as const, name: fieldForm.label };
        const res = await createFieldAction(createPayload as any, user.uid);
        if (res.success) {
          toast({ title: 'Field Created' });
          setFieldModalOpen(false);
        } else throw new Error(res.error);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
    setIsSubmitting(false);
  };

  const executeDeleteField = async () => {
    if (!deletingField || !user?.uid) return;
    const res = await deleteFieldAction(deletingField.id, user.uid);
    if (res.success) {
      toast({ title: 'Field Deleted' });
      setDeletingField(null);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: res.error });
    }
  };

  if (loadingGroups || loadingFields) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-32" /></div>
        <Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-8 pb-32 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Fields & Variables Hub</h1>
          <p className="text-muted-foreground font-medium text-sm mt-1">Manage entity attributes, custom data collection, and system variables.</p>
        </div>
      </div>

      <Tabs defaultValue="custom" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <TabsList className="bg-muted/50 border border-border rounded-xl p-1 h-auto flex flex-wrap gap-1">
            <TabsTrigger value="custom" className="rounded-lg text-sm font-semibold data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-400 cursor-pointer flex-1 sm:flex-none">
              <LucideIcons.Database className="h-4 w-4 mr-2" /> Custom Fields
            </TabsTrigger>
            <TabsTrigger value="system" className="rounded-lg text-sm font-semibold data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-400 cursor-pointer flex-1 sm:flex-none">
              <LucideIcons.Terminal className="h-4 w-4 mr-2" /> System Variables
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Link href="/admin/settings/fields/diagnostics">
              <Button variant="outline" className="border-blue-500/20 text-blue-600 hover:bg-blue-50/50 gap-2">
                <LucideIcons.ShieldAlert className="h-4 w-4" /> Audit Templates
              </Button>
            </Link>
            <Button onClick={openNewGroup}>
              <LucideIcons.Plus className="h-4 w-4 mr-2" /> New Group
            </Button>
          </div>
        </div>

        <TabsContent value="custom" className="space-y-8 mt-4">

      {/* Search Bar */}
      <div className="relative max-w-md">
        <LucideIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search fields or groups..." 
          className="pl-9" 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
        />
      </div>

      {/* Main Accordion */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filteredGroups.map(g => g.id)} strategy={verticalListSortingStrategy}>
          <Accordion type="multiple" className="w-full space-y-4" defaultValue={groups.map(g => g.id)}>
            {filteredGroups.map(group => (
              <SortableGroupAccordionItem
                key={group.id}
                group={group}
                fields={(fields || []).filter(f => f.groupId === group.id)}
                singularTerm={workspace?.terminology?.singular || 'Entity'}
                onEditGroup={openEditGroup}
                onDeleteGroup={setDeletingGroup}
                onAddField={openNewField}
                onEditField={openEditField}
                onDeleteField={setDeletingField}
                onCopyVariable={handleCopyVariable}
              />
            ))}
          </Accordion>
        </SortableContext>
      </DndContext>

      {groups.length === 0 && (
        <div className="rounded-2xl border border-border bg-muted/20 backdrop-blur-md p-8 max-w-3xl mx-auto space-y-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
              <LucideIcons.Sparkles className="h-6 w-6" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-bold text-foreground">Initialize Workspace Fields</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                We detected that this workspace has no field groups configured. Choose which predefined parameters from the backoffice template for the <span className="font-semibold text-blue-400">{workspace?.industry || 'SchoolEnrollment'}</span> industry vertical you would like to initialize:
              </p>
            </div>
          </div>

          {loadingPredefined ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-20 bg-accent/30 rounded-xl border border-border animate-pulse" />
              ))}
            </div>
          ) : predefinedGroups.length === 0 ? (
            <div className="text-center py-8 bg-muted/30 border border-dashed border-border rounded-xl">
              <LucideIcons.AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No predefined field groups found for this industry.</p>
              <Button onClick={openNewGroup} className="mt-4 h-9 bg-primary text-primary-foreground rounded-xl">
                Create Custom Group
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {predefinedGroups.map(pg => {
                const isSelected = selectedGroupSlugs.includes(pg.slug);
                const GroupIcon = (LucideIcons as any)[pg.icon] || LucideIcons.Database;
                return (
                  <div
                    key={pg.slug}
                    onClick={() => handleToggleGroupSlug(pg.slug)}
                    className={cn(
                      "p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 text-left select-none",
                      isSelected
                        ? "bg-blue-500/5 border-blue-500/30 text-foreground"
                        : "bg-muted/10 border-border text-muted-foreground hover:bg-muted/20 hover:border-slate-500"
                    )}
                  >
                    <div className="mt-1">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {}} // handled by div onClick
                        className={cn(
                          "rounded border-border pointer-events-none data-[state=checked]:bg-blue-500 data-[state=checked]:text-blue-950"
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <GroupIcon className={cn("h-4 w-4 shrink-0", isSelected ? "text-blue-400" : "text-muted-foreground")} />
                        <span className="font-semibold text-sm">{pg.name}</span>
                        <Badge variant="outline" className="text-[8px] uppercase tracking-wider h-4 border-border text-muted-foreground">
                          {pg.slug}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{pg.description}</p>
                      
                      {/* Fields inside the group */}
                      {pg.fields && pg.fields.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {pg.fields.map((f: any) => (
                            <Badge
                              key={f.variableName}
                              variant="outline"
                              className={cn(
                                "text-[9px] px-1.5 py-0 border-border/50 font-normal",
                                isSelected ? "bg-blue-500/5 text-blue-400" : "bg-muted text-muted-foreground"
                              )}
                            >
                              {f.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGroupSlugs(predefinedGroups.map(g => g.slug));
                    }}
                    className="h-8 border-border text-xs rounded-lg"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGroupSlugs([]);
                    }}
                    className="h-8 border-border text-xs rounded-lg"
                  >
                    Unselect All
                  </Button>
                </div>

                <div className="flex items-center gap-3 justify-end flex-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openNewGroup();
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    Skip and Create Custom Group
                  </button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInitializeGroups();
                    }}
                    disabled={isInitializing || selectedGroupSlugs.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white h-9 rounded-xl px-6 text-xs flex items-center gap-2"
                  >
                    {isInitializing ? (
                      <>
                        <LucideIcons.Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      <>
                        <LucideIcons.Sparkles className="h-3.5 w-3.5" />
                        Initialize Selected ({selectedGroupSlugs.length})
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          <Card className="border-border">
            <CardHeader className="bg-muted/30 border-b border-border pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
                <div className="space-y-1">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <LucideIcons.Terminal className="h-5 w-5 text-blue-500" />
                    System & Organization Variables
                  </CardTitle>
                  <CardDescription>
                    These variables are automatically available in the messaging engine and templates.
                    Use the <code className="bg-muted px-1.5 py-0.5 rounded text-blue-500">{"{{"}variable_name{"}}"}</code> syntax to inject them into content.
                  </CardDescription>
                </div>
                <div className="shrink-0 min-w-[180px]">
                  <Select value={systemVarContext} onValueChange={setSystemVarContext}>
                    <SelectTrigger className="w-full bg-background border shadow-sm rounded-xl">
                      <SelectValue placeholder="Filter Context..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">All Contexts</SelectItem>
                      <SelectItem value="common">Common</SelectItem>
                      {enabledFeatures.meetings !== false && <SelectItem value="meeting">Meetings</SelectItem>}
                      {enabledFeatures.surveys !== false && <SelectItem value="survey">Surveys</SelectItem>}
                      {enabledFeatures.forms !== false && <SelectItem value="form">Forms</SelectItem>}
                      {enabledFeatures.agreements !== false && <SelectItem value="agreement">Agreements</SelectItem>}
                      {enabledFeatures.users !== false && <SelectItem value="users">Users</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-1/4">Variable</TableHead>
                    <TableHead className="w-1/4">Context</TableHead>
                    <TableHead className="w-1/2">Description & Example</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaticVariables.map(variable => (
                    <TableRow key={variable.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm text-blue-600 dark:text-blue-400">
                        {"{{"}{variable.name}{"}}"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize bg-muted">
                          {variable.context}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{variable.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{variable.description}</p>
                        {variable.exampleValue && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            <span className="font-semibold">Example:</span> {variable.exampleValue}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredStaticVariables.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center p-8 text-muted-foreground">
                        No variables found for this filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Group Modal */}
      <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Field Group' : 'Create Field Group'}</DialogTitle>
            <DialogDescription>Group fields together for organization in forms and entity pages.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})} placeholder="e.g. Health Profile" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={groupForm.description} onChange={e => setGroupForm({...groupForm, description: e.target.value})} placeholder="Optional description..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select value={groupForm.icon} onValueChange={v => setGroupForm({...groupForm, icon: v})}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an icon">
                      {groupForm.icon && (
                        <div className="flex items-center gap-2">
                          {React.createElement((LucideIcons as any)[groupForm.icon] || LucideIcons.Database, { className: "h-4 w-4" })}
                          <span className="truncate">{groupForm.icon}</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-64">
                      <div className="grid grid-cols-2 gap-1 p-1">
                        {COMMON_GROUP_ICONS.map(iconName => {
                          const IconComponent = (LucideIcons as any)[iconName];
                          if (!IconComponent) return null;
                          return (
                            <SelectItem key={iconName} value={iconName} className="cursor-pointer">
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                <span className="text-xs truncate max-w-[80px]">{iconName}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="flex gap-2">
                  <Input type="color" className="w-12 p-1 h-10" value={groupForm.color} onChange={e => setGroupForm({...groupForm, color: e.target.value})} />
                  <Input value={groupForm.color} onChange={e => setGroupForm({...groupForm, color: e.target.value})} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupModalOpen(false)}>Cancel</Button>
            <Button onClick={saveGroup} disabled={isSubmitting || !groupForm.name}>{isSubmitting ? 'Saving...' : 'Save Group'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Modal */}
      <Dialog open={fieldModalOpen} onOpenChange={setFieldModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit Field' : 'Create Field'}</DialogTitle>
            <DialogDescription>Add a data collection field to a group.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <div className="space-y-2">
              <Label>Field Group</Label>
              <Select value={fieldForm.groupId} onValueChange={v => setFieldForm({...fieldForm, groupId: v})} disabled={editingField?.isNative}>
                <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                <SelectContent>
                  {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Field Label</Label>
              <Input value={fieldForm.label} onChange={e => setFieldForm({...fieldForm, label: e.target.value})} placeholder="e.g. Allergies" disabled={editingField?.isNative} />
            </div>
            {!editingField?.isNative && (
              <>
                <div className="space-y-2">
                  <Label>Variable Name</Label>
                  <Input value={fieldForm.variableName} onChange={e => setFieldForm({...fieldForm, variableName: e.target.value})} placeholder="e.g. student_allergies" />
                  <p className="text-xs text-muted-foreground">Used as {'{{variable_name}}'} in templates.</p>
                </div>
                <div className="space-y-2">
                  <Label>Field Type</Label>
                  <Select value={fieldForm.type} onValueChange={v => setFieldForm({...fieldForm, type: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          <div className="flex items-center gap-2"><t.icon className="h-4 w-4" />{t.label}</div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {['select', 'multi_select', 'radio'].includes(fieldForm.type) && !editingField?.isNative && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Options</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOptionsDialogOpen(true)}
                    className="h-8 border-blue-500/30 text-xs flex items-center justify-center gap-1 bg-blue-500/5 hover:bg-blue-500/15 text-blue-400 rounded-lg"
                  >
                    <LucideIcons.List className="h-3 w-3" /> Configure Options ({(fieldForm.options || []).length})
                  </Button>
                </div>
                {fieldForm.options && fieldForm.options.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 border border-border/50 rounded-lg">
                    {fieldForm.options.map((opt, optIdx) => (
                      <Badge key={optIdx} variant="outline" className="bg-muted text-foreground/80 border-border text-[9px] px-1.5 py-0.5">
                        {opt.label} <span className="opacity-60 ml-0.5">({opt.value})</span>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No options configured yet.</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Help Text</Label>
              <Input value={fieldForm.helpText} onChange={e => setFieldForm({...fieldForm, helpText: e.target.value})} placeholder="Optional hint text" />
            </div>
            <div className="space-y-2">
              <Label>Placeholder</Label>
              <Input value={fieldForm.placeholder} onChange={e => setFieldForm({...fieldForm, placeholder: e.target.value})} placeholder="e.g. Enter value..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldModalOpen(false)}>Cancel</Button>
            <Button onClick={saveField} disabled={isSubmitting || !fieldForm.label || !fieldForm.groupId}>{isSubmitting ? 'Saving...' : 'Save Field'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select Options Config Dialog (Themed Blue for Admin) */}
      <Dialog open={optionsDialogOpen} onOpenChange={setOptionsDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border rounded-xl">
          <DialogHeader>
            <DialogTitle>Configure Options</DialogTitle>
            <DialogDescription>Add value options for selecting the dropdown values.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Label</Label>
                <Input
                  value={newOptionLabel}
                  onChange={e => {
                    setNewOptionLabel(e.target.value);
                    setNewOptionValue(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
                  }}
                  placeholder="e.g. Premium Tier"
                  className="h-8 bg-muted/50 border-border text-xs rounded-lg"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Value</Label>
                <Input
                  value={newOptionValue}
                  onChange={e => setNewOptionValue(e.target.value)}
                  placeholder="e.g. premium_tier"
                  className="h-8 bg-muted border-border font-mono text-xs rounded-lg"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleAddOption}
                  className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg"
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="border border-border rounded-lg bg-muted/20 p-3 min-h-[100px] max-h-[200px] overflow-y-auto space-y-1.5">
              {fieldForm.options && fieldForm.options.length > 0 ? (
                fieldForm.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center justify-between p-1.5 bg-accent/20 border border-border/50 rounded-lg">
                    <div className="text-xs text-foreground font-medium">
                      {opt.label} <span className="text-[10px] text-muted-foreground font-mono">({opt.value})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(oIdx)}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <LucideIcons.X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">No options configured.</div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs rounded-xl"
              onClick={() => setOptionsDialogOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alerts */}
      <AlertDialog open={!!deletingGroup} onOpenChange={open => !open && setDeletingGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{deletingGroup?.name}" group? Any fields inside it will be moved to a default system group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteGroup} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete Group</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingField} onOpenChange={open => !open && setDeletingField(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{deletingField?.label}" field? This variable will stop resolving in templates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteField} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete Field</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PageContainer>
  );
}
