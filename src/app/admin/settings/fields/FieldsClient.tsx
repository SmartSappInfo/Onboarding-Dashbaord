'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { AppField, FieldGroup, EntityType } from '@/lib/types';
import { seedNativeFieldsAction, createFieldAction, updateFieldAction, deleteFieldAction, createFieldGroupAction, updateFieldGroupAction, deleteFieldGroupAction, reorderFieldGroupsAction } from '@/lib/fields-actions';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

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
  options: string;
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
  options: '',
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
  onEditGroup, 
  onDeleteGroup, 
  onAddField, 
  onEditField, 
  onDeleteField,
  onCopyVariable
}: { 
  group: FieldGroup; 
  fields: AppField[]; 
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
                <span className="font-semibold text-sm">{group.name}</span>
                <span className="text-xs text-muted-foreground">{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </AccordionTrigger>
        </div>
        <div className="flex items-center gap-2 pr-4">
          <Button variant="outline" size="sm" onClick={() => onAddField(group)}>
            <LucideIcons.Plus className="h-3 w-3 mr-1" /> Add Field
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
          {group.isSystem && <Badge variant="secondary" className="ml-2 font-normal text-xs"><LucideIcons.Lock className="h-3 w-3 mr-1" /> System</Badge>}
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

  const [groups, setGroups] = React.useState<FieldGroup[]>([]);
  React.useEffect(() => {
    if (rawGroups) setGroups(rawGroups);
  }, [rawGroups]);

  // State
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isSeeding, setIsSeeding] = React.useState(false);
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

  const handleSeed = async () => {
    if (!activeWorkspaceId || !activeOrganizationId || !user?.uid) return;
    setIsSeeding(true);
    const result = await seedNativeFieldsAction(activeWorkspaceId, activeOrganizationId, user.uid);
    if (result.success) {
      toast({ title: 'Registry Seeded', description: `Added ${result.seededGroups} groups and ${result.seededFields} fields.` });
    } else {
      toast({ variant: 'destructive', title: 'Seeding Failed', description: result.error });
    }
    setIsSeeding(false);
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
      options: f.options?.map(o => o.label).join(', ') || '',
    });
    setEditingField(f);
    setFieldModalOpen(true);
  };

  const saveField = async () => {
    if (!fieldForm.label.trim() || !fieldForm.groupId || !activeWorkspaceId || !activeOrganizationId || !user?.uid) return;
    setIsSubmitting(true);
    try {
      const variableName = fieldForm.variableName || slugify(fieldForm.label);
      const options = fieldForm.options ? fieldForm.options.split(',').map(o => o.trim()).filter(Boolean).map(o => ({ value: slugify(o), label: o })) : undefined;
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
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fields & Variables Hub</h1>
          <p className="text-muted-foreground mt-1">Manage entity attributes, custom data collection, and system variables.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openNewGroup}>
            <LucideIcons.Plus className="h-4 w-4 mr-2" /> New Group
          </Button>
        </div>
      </div>

      {/* System Maintenance & Seeding (SuperAdmin Only) */}
      {isSuperAdmin && (
        <Card className="border-indigo-100 bg-indigo-50/30 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <LucideIcons.ShieldCheck className="h-24 w-24 text-indigo-600" />
          </div>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">System Registry</span>
            </div>
            <CardTitle className="text-xl text-indigo-950">Native Registry Sync</CardTitle>
            <CardDescription className="max-w-2xl text-indigo-900/70">
              Keep your workspace synchronized with the global SmartSapp variable registry. 
              Seeding adds all platform-standard fields (meetings, surveys, forms) and industry-specific 
              attributes without affecting your existing custom fields.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">Platform Identity</Badge>
                <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">Meetings & Forms</Badge>
                <Badge variant="outline" className="bg-white/50 border-indigo-200 text-indigo-700">Industry Pack</Badge>
              </div>
              <Button 
                onClick={handleSeed} 
                disabled={isSeeding}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 border-none min-w-[160px]"
              >
                {isSeeding ? (
                  <LucideIcons.Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LucideIcons.Zap className="h-4 w-4 mr-2 fill-white" />
                )}
                {isSeeding ? 'Syncing...' : 'Seed Registry'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
        <div className="text-center p-12 border rounded-xl bg-muted/10 border-dashed">
          <LucideIcons.Database className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Field Groups Found</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Start by creating a new group or seeding native groups.</p>
          {isSuperAdmin && (
            <Button onClick={handleSeed} disabled={isSeeding}>
              {isSeeding ? 'Seeding...' : 'Seed Native Groups'}
            </Button>
          )}
        </div>
      )}

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
                <Label>Icon Name</Label>
                <Input value={groupForm.icon} onChange={e => setGroupForm({...groupForm, icon: e.target.value})} placeholder="Lucide Icon (e.g. Heart)" />
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
                <Label>Options</Label>
                <Textarea value={fieldForm.options} onChange={e => setFieldForm({...fieldForm, options: e.target.value})} placeholder="Comma separated (e.g. Yes, No, Maybe)" />
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
  );
}
