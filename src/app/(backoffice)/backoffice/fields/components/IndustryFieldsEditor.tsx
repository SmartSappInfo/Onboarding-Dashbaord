'use client';

import * as React from 'react';
import { Briefcase, Plus, Pencil, Trash2, ShieldAlert, Check, Layers, Users, FolderOpen, Save, X, HelpCircle, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { INDUSTRY_METADATA } from '@/lib/industry-field-registry';
import { listPlatformIndustryFieldGroups, savePlatformIndustryFieldGroup, deletePlatformIndustryFieldGroup } from '@/lib/backoffice/backoffice-field-actions';
import { useBackoffice } from '../../context/BackofficeProvider';
import type { IndustryVertical, EntityType } from '@/lib/types';
import type { IndustryGroupDef, IndustryFieldDef } from '@/lib/industry-field-registry';

const INDUSTRIES = Object.keys(INDUSTRY_METADATA) as IndustryVertical[];
const ENTITY_TYPES: EntityType[] = ['institution', 'person', 'family'];

const FIELD_TYPES = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'select', label: 'Select Dropdown' },
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'yes_no', label: 'Yes/No Toggle' },
  { value: 'address', label: 'Address' },
  { value: 'url', label: 'URL / Link' },
  { value: 'hidden', label: 'Hidden Value' },
];

export default function IndustryFieldsEditor() {
  const { profile, can } = useBackoffice();
  const [selectedIndustry, setSelectedIndustry] = React.useState<IndustryVertical>('SaaS');
  const [groups, setGroups] = React.useState<IndustryGroupDef[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Modal / Dialog States
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<IndustryGroupDef | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Group Form State
  const [groupName, setGroupName] = React.useState('');
  const [groupSlug, setGroupSlug] = React.useState('');
  const [groupDesc, setGroupDesc] = React.useState('');
  const [groupOrder, setGroupOrder] = React.useState(10);
  const [groupEntities, setGroupEntities] = React.useState<EntityType[]>(['institution']);
  const [groupFields, setGroupFields] = React.useState<IndustryFieldDef[]>([]);

  // Warning Confirm dialog
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<'save' | 'delete' | null>(null);

  // Options Dialog for select/multiselect fields
  const [optionsEditingFieldIndex, setOptionsEditingFieldIndex] = React.useState<number | null>(null);
  const [newOptionLabel, setNewOptionLabel] = React.useState('');
  const [newOptionValue, setNewOptionValue] = React.useState('');

  const loadGroups = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listPlatformIndustryFieldGroups(selectedIndustry);
      if (res.success && res.data) {
        setGroups(res.data);
      }
    } catch (e) {
      console.error('Failed to load groups:', e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedIndustry]);

  React.useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Open editor for creating new group
  const handleCreateGroup = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupSlug('');
    setGroupDesc('');
    setGroupOrder((groups.length + 1) * 10);
    setGroupEntities(['institution']);
    setGroupFields([]);
    setIsEditorOpen(true);
  };

  // Open editor for modifying existing group
  const handleEditGroup = (group: IndustryGroupDef) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupSlug(group.slug);
    setGroupDesc(group.description || '');
    setGroupOrder(group.order);
    setGroupEntities(group.entityTypes || []);
    setGroupFields(JSON.parse(JSON.stringify(group.fields || []))); // deep clone
    setIsEditorOpen(true);
  };

  // Add field row to the current group
  const handleAddField = () => {
    const newField: IndustryFieldDef = {
      name: 'New Field',
      variableName: 'new_field_' + Math.floor(Math.random() * 1000),
      type: 'short_text',
      compatibilityScope: ['institution'],
      helpText: '',
      placeholder: '',
    };
    setGroupFields([...groupFields, newField]);
  };

  // Update specific field attribute
  const handleUpdateField = (index: number, updates: Partial<IndustryFieldDef>) => {
    const updated = [...groupFields];
    updated[index] = { ...updated[index], ...updates };
    setGroupFields(updated);
  };

  // Remove field row
  const handleRemoveField = (index: number) => {
    const updated = [...groupFields];
    updated.splice(index, 1);
    setGroupFields(updated);
  };

  // Manage Select options dialog
  const openOptionsDialog = (index: number) => {
    setOptionsEditingFieldIndex(index);
    setNewOptionLabel('');
    setNewOptionValue('');
  };

  const handleAddOption = () => {
    if (optionsEditingFieldIndex === null || !newOptionLabel || !newOptionValue) return;
    const field = groupFields[optionsEditingFieldIndex];
    const currentOptions = field.options || [];
    const updatedOptions = [...currentOptions, { label: newOptionLabel, value: newOptionValue }];

    handleUpdateField(optionsEditingFieldIndex, { options: updatedOptions });
    setNewOptionLabel('');
    setNewOptionValue('');
  };

  const handleRemoveOption = (fieldIdx: number, optionIdx: number) => {
    const field = groupFields[fieldIdx];
    const updatedOptions = [...(field.options || [])];
    updatedOptions.splice(optionIdx, 1);
    handleUpdateField(fieldIdx, { options: updatedOptions });
  };

  // Save/Delete workflow triggers confirmation gates
  const triggerSaveConfirm = () => {
    if (!groupName || !groupSlug) {
      alert('Group Name and Slug are required.');
      return;
    }
    setConfirmAction('save');
    setIsConfirmOpen(true);
  };

  const triggerDeleteConfirm = () => {
    setConfirmAction('delete');
    setIsConfirmOpen(true);
  };

  const executeConfirmedAction = async () => {
    if (!profile?.id) return;
    setIsConfirmOpen(false);
    setIsSaving(true);

    const actor = {
      userId: profile.id,
      name: profile.name || 'System Admin',
      email: profile.email || '',
      role: 'super_admin' as const,
    };

    try {
      if (confirmAction === 'save') {
        const payload: IndustryGroupDef = {
          name: groupName,
          slug: groupSlug,
          description: groupDesc,
          order: Number(groupOrder) || 10,
          entityTypes: groupEntities,
          fields: groupFields,
        };

        const res = await savePlatformIndustryFieldGroup(selectedIndustry, groupSlug, payload, actor);
        if (res.success) {
          setIsEditorOpen(false);
          await loadGroups();
        } else {
          alert('Error: ' + res.error);
        }
      } else if (confirmAction === 'delete' && editingGroup) {
        const res = await deletePlatformIndustryFieldGroup(selectedIndustry, editingGroup.slug, actor);
        if (res.success) {
          setIsEditorOpen(false);
          await loadGroups();
        } else {
          alert('Error: ' + res.error);
        }
      }
    } catch (e: any) {
      console.error(e);
      alert('Unexpected error: ' + e.message);
    } finally {
      setIsSaving(false);
      setConfirmAction(null);
    }
  };

  const toggleEntityType = (type: EntityType) => {
    setGroupEntities(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const activeIndustryMeta = INDUSTRY_METADATA[selectedIndustry];

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-6 flex flex-col lg:flex-row gap-8">
      {/* Sidebar for Industry Verticals */}
      <div className="w-full lg:w-72 shrink-0 space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-foreground">Industry Verticals</h3>
        </div>
        <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-2 pb-2 lg:pb-0">
          {INDUSTRIES.map(industry => {
            const meta = INDUSTRY_METADATA[industry];
            const isActive = selectedIndustry === industry;
            return (
              <button
                key={industry}
                onClick={() => setSelectedIndustry(industry)}
                className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all min-w-[200px] lg:min-w-0 ${
                  isActive
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5'
                    : 'bg-muted/30 border-border text-muted-foreground hover:border-emerald-500/20 hover:bg-muted/50'
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-wider">{meta.name}</div>
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{meta.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Console Area */}
      <div className="flex-1 bg-muted/50 border border-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
          <div>
            <h4 className="text-foreground font-semibold text-lg flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-400" />
              {activeIndustryMeta.name} Fields
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Configure parameters automatically inherited by workspaces belonging to this vertical.
            </p>
          </div>
          {can('fields', 'create') && (
            <Button
              onClick={handleCreateGroup}
              className="bg-emerald-600 hover:bg-emerald-700 text-foreground h-9 rounded-xl px-4 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Create Field Group
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="h-32 bg-accent/40 rounded-xl border border-border animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 bg-accent/10 rounded-xl border border-dashed border-border/50">
            <FolderOpen className="h-8 w-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No industry field groups found.</p>
            <p className="text-xs text-slate-600">Dynamic groups will self-seed from defaults if listed.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map(group => (
              <div
                key={group.slug}
                className="p-5 rounded-xl border border-border bg-accent/20 flex flex-col justify-between hover:border-slate-500 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-foreground">{group.name}</span>
                    <Badge variant="outline" className="bg-muted text-muted-foreground text-[8px] uppercase tracking-wider h-5 font-bold">
                      {group.slug}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{group.description}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-emerald-500/5 text-emerald-400 border-emerald-500/10 text-[9px] uppercase">
                      {group.fields?.length || 0} Fields
                    </Badge>
                    <div className="flex gap-1">
                      {group.entityTypes?.map(entity => (
                        <span key={entity} className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">
                          {entity === 'institution' ? 'ORG' : entity === 'person' ? 'PSN' : 'FAM'}
                        </span>
                      ))}
                    </div>
                  </div>
                  {can('fields', 'edit') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditGroup(group)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-slate-700/50 rounded-lg"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor Sheet / Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl bg-card border-border rounded-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit' : 'Create'} Industry Field Group</DialogTitle>
            <DialogDescription>
              Updates to this group structure and fields propagate automatically to all workspaces of the {activeIndustryMeta.name} industry.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
            {/* Metadata Fields */}
            <div className="space-y-4 md:col-span-1 border-r border-border/30 pr-0 md:pr-6">
              <div className="space-y-2">
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  value={groupName}
                  onChange={e => {
                    setGroupName(e.target.value);
                    if (!editingGroup) {
                      setGroupSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, ''));
                    }
                  }}
                  placeholder="e.g. Sales Metrics"
                  className="bg-muted/50 border-border rounded-xl h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="group-slug">Slug (Immutable on Edit)</Label>
                <Input
                  id="group-slug"
                  value={groupSlug}
                  onChange={e => !editingGroup && setGroupSlug(e.target.value)}
                  disabled={!!editingGroup}
                  placeholder="e.g. sales_metrics"
                  className="bg-muted border-border rounded-xl h-9 font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="group-desc">Description</Label>
                <Textarea
                  id="group-desc"
                  value={groupDesc}
                  onChange={e => setGroupDesc(e.target.value)}
                  placeholder="Describe the scope of fields..."
                  className="bg-muted/50 border-border rounded-xl min-h-[80px] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="group-order">Sort Order</Label>
                  <Input
                    id="group-order"
                    type="number"
                    value={groupOrder}
                    onChange={e => setGroupOrder(parseInt(e.target.value) || 10)}
                    className="bg-muted/50 border-border rounded-xl h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Entity Applicability</Label>
                <div className="flex flex-col gap-2">
                  {ENTITY_TYPES.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleEntityType(type)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                        groupEntities.includes(type)
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <span className="capitalize">{type === 'institution' ? 'Organization' : type}</span>
                      {groupEntities.includes(type) && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Field Elements Configurator */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Fields Registry</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddField}
                  className="h-8 border-border hover:bg-slate-700/50 text-xs rounded-lg"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Field
                </Button>
              </div>

              {groupFields.length === 0 ? (
                <div className="text-center py-10 bg-muted/20 border border-dashed border-border rounded-xl">
                  <p className="text-xs text-muted-foreground">No fields defined in this group. Click Add Field to start.</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-[45vh] pr-1">
                  {groupFields.map((field, idx) => (
                    <div key={idx} className="p-3 bg-accent/20 border border-border rounded-xl space-y-3 relative group">
                      <button
                        type="button"
                        onClick={() => handleRemoveField(idx)}
                        className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Field Label</Label>
                          <Input
                            value={field.name}
                            onChange={e => handleUpdateField(idx, { name: e.target.value })}
                            placeholder="e.g. Total Revenue"
                            className="h-8 bg-muted/50 border-border text-xs rounded-lg mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Variable Name (Liquid Token)</Label>
                          <Input
                            value={field.variableName}
                            onChange={e => handleUpdateField(idx, { variableName: e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '') })}
                            placeholder="e.g. total_revenue"
                            className="h-8 bg-muted/50 border-border text-xs font-mono rounded-lg mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Data Type</Label>
                          <Select
                            value={field.type}
                            onValueChange={val => handleUpdateField(idx, { type: val as any })}
                          >
                            <SelectTrigger className="h-8 bg-muted/50 border-border text-xs rounded-lg mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_TYPES.map(ft => (
                                <SelectItem key={ft.value} value={ft.value} className="text-xs">
                                  {ft.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end pb-1 gap-2">
                          {(field.type === 'select' || field.type === 'multi_select') && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openOptionsDialog(idx)}
                              className="h-8 w-full border-border text-xs flex items-center justify-center gap-1 bg-muted/40 hover:bg-slate-700/50 rounded-lg"
                            >
                              <List className="h-3 w-3" /> Options ({(field.options || []).length})
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Display select option badges if exists */}
                      {(field.type === 'select' || field.type === 'multi_select') && field.options && field.options.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 border border-border/50 rounded-lg">
                          {field.options.map((opt, optIdx) => (
                            <Badge key={optIdx} variant="outline" className="bg-muted text-foreground/80 border-border text-[9px] px-1.5 py-0.5">
                              {opt.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="bg-muted/30 p-4 -mx-6 -mb-6 border-t border-border flex justify-between">
            <div className="flex gap-2">
              {editingGroup && (
                <Button
                  variant="destructive"
                  onClick={triggerDeleteConfirm}
                  disabled={isSaving}
                  className="rounded-xl h-9 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Group
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsEditorOpen(false)} className="rounded-xl h-9 text-xs">
                Cancel
              </Button>
              <Button
                onClick={triggerSaveConfirm}
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-9 px-6 text-xs flex items-center gap-1.5"
              >
                <Save className="h-3.5 w-3.5" /> Save and Sync Group
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select Options Config Dialog */}
      <Dialog open={optionsEditingFieldIndex !== null} onOpenChange={val => !val && setOptionsEditingFieldIndex(null)}>
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
                  className="h-8 bg-emerald-600 hover:bg-emerald-700 text-foreground text-xs rounded-lg"
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="border border-border rounded-lg bg-muted/20 p-3 min-h-[100px] max-h-[200px] overflow-y-auto space-y-1.5">
              {optionsEditingFieldIndex !== null &&
              groupFields[optionsEditingFieldIndex]?.options &&
              groupFields[optionsEditingFieldIndex].options!.length > 0 ? (
                groupFields[optionsEditingFieldIndex].options!.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center justify-between p-1.5 bg-accent/20 border border-border/50 rounded-lg">
                    <div className="text-xs text-foreground font-medium">
                      {opt.label} <span className="text-[10px] text-muted-foreground font-mono">({opt.value})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(optionsEditingFieldIndex, oIdx)}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <X className="h-3 w-3" />
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
              className="bg-emerald-600 hover:bg-emerald-700 text-foreground h-8 text-xs rounded-xl"
              onClick={() => setOptionsEditingFieldIndex(null)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning Propagation Confirmation Modal */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md bg-card border-amber-500/30 rounded-2xl">
          <DialogHeader className="flex flex-row gap-3 items-start">
            <ShieldAlert className="h-8 w-8 text-amber-500 shrink-0 mt-1" />
            <div>
              <DialogTitle className="text-amber-500 font-bold">Safety Confirmation Required</DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed">
                {confirmAction === 'save'
                  ? `Saving these changes will immediately execute a background sync to propagate group and field updates to ALL active workspaces configured under the "${activeIndustryMeta.name}" vertical.`
                  : `Deletions are destructive. This will permanently remove the "${groupName}" group and all its corresponding fields from all "${activeIndustryMeta.name}" workspaces, which may break active templates.`}
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogFooter className="bg-muted/30 p-4 -mx-6 -mb-6 border-t border-border mt-6">
            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)} className="rounded-xl h-9 text-xs">
              Cancel
            </Button>
            <Button
              onClick={executeConfirmedAction}
              className={`rounded-xl h-9 px-6 text-xs font-semibold ${
                confirmAction === 'save' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              } text-foreground`}
            >
              Confirm and Sync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
