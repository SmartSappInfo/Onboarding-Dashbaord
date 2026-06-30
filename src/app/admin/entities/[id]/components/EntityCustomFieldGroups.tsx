'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import { format } from 'date-fns';
import * as LucideIcons from 'lucide-react';
import { 
  Pencil, Save, X, Loader2, Info
} from 'lucide-react';

import type { Entity, AppField, FieldGroup, AppPermissionId } from '@/lib/types';
import { useFirestore, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { updateEntityAction } from '@/lib/entity-actions';

// Dynamic Icon Component mapping Lucide Icons safely without any
interface DynamicIconProps {
  name: string;
  className?: string;
}

export function DynamicIcon({ name, className }: DynamicIconProps) {
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (!IconComponent) {
    return <LucideIcons.Database className={className} />;
  }
  return <IconComponent className={className} />;
}

interface MappedFieldGroup extends FieldGroup {
  fields: AppField[];
}

interface EntityCustomFieldGroupsProps {
  entityId: string;
  entityData: Entity;
  organizationId: string;
  workspaceId: string;
}

export default function EntityCustomFieldGroups({
  entityId,
  entityData,
  organizationId,
  workspaceId,
}: EntityCustomFieldGroupsProps) {
  const firestore = useFirestore();
  const { activeWorkspace, hasPermission } = useWorkspace();
  const canEdit = hasPermission('schools_edit');

  const contactScope = activeWorkspace?.contactScope || 'institution';

  // 1. Query app_fields
  const fieldsQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'app_fields'),
      where('workspaceId', '==', workspaceId),
      where('status', '==', 'active')
    );
  }, [firestore, workspaceId]);
  const { data: appFields, isLoading: isLoadingFields } = useCollection<AppField>(fieldsQuery);

  // 2. Query field_groups
  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'field_groups'),
      where('workspaceId', '==', workspaceId),
      orderBy('order', 'asc')
    );
  }, [firestore, workspaceId]);
  const { data: fieldGroups, isLoading: isLoadingGroups } = useCollection<FieldGroup>(groupsQuery);

  // 3. Memoize grouped custom fields
  const customFieldGroups = React.useMemo(() => {
    if (!fieldGroups || !appFields) return [];

    return fieldGroups
      .map((group) => {
        const groupFields = appFields.filter(
          (f) =>
            f.groupId === group.id &&
            f.status === 'active' &&
            f.type !== 'hidden' &&
            (f.compatibilityScope?.includes('common') || f.compatibilityScope?.includes(contactScope as 'common' | 'institution' | 'family' | 'person' | 'submission-only' | 'internal-only'))
        );

        return {
          ...group,
          fields: groupFields,
        };
      })
      .filter((g) => g.fields.length > 0 && !g.isSystem);
  }, [fieldGroups, appFields, contactScope]);

  if (isLoadingFields || isLoadingGroups) {
    return (
      <div className="space-y-6 text-left">
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48 rounded-2xl w-full" />
          <Skeleton className="h-48 rounded-2xl w-full" />
        </div>
      </div>
    );
  }

  if (customFieldGroups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 text-left">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
          <LucideIcons.LayoutGrid className="h-5 w-5 text-primary" /> Additional Profiles & Attributes
        </h3>
        <p className="text-xs text-muted-foreground">
          Workspace-scoped custom field attributes grouped by category.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {customFieldGroups.map((group) => (
          <CustomFieldGroupCard
            key={group.id}
            group={group}
            entityId={entityId}
            entityData={entityData}
            organizationId={organizationId}
            workspaceId={workspaceId}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
}

interface CustomFieldGroupCardProps {
  group: MappedFieldGroup;
  entityId: string;
  entityData: Entity;
  organizationId: string;
  workspaceId: string;
  canEdit: boolean;
}

function CustomFieldGroupCard({
  group,
  entityId,
  entityData,
  organizationId,
  workspaceId,
  canEdit,
}: CustomFieldGroupCardProps) {
  const { toast } = useToast();
  const { user: currentUser } = useUser();
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Compute default values strictly
  const defaultValues = React.useMemo(() => {
    const defaults: Record<string, string | string[] | number | boolean> = {};
    group.fields.forEach((field) => {
      const val = entityData.customData?.[field.variableName];
      if (field.type === 'multi_select') {
        defaults[field.variableName] = Array.isArray(val) ? val : (val ? [val] : []);
      } else {
        defaults[field.variableName] = val !== undefined && val !== null ? val : '';
      }
    });
    return defaults;
  }, [group.fields, entityData.customData]);

  const { control, handleSubmit, reset } = useForm<Record<string, string | string[] | number | boolean>>({
    defaultValues,
  });

  // Reset form when backend values change
  React.useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const handleCancel = () => {
    reset(defaultValues);
    setIsEditing(false);
  };

  const onSubmit = async (values: Record<string, string | string[] | number | boolean>) => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      const customDataPayload: Record<string, string | string[] | number | boolean> = {};
      group.fields.forEach((field) => {
        customDataPayload[field.variableName] = values[field.variableName];
      });

      const result = await updateEntityAction(
        entityId,
        { customData: customDataPayload },
        currentUser.uid,
        workspaceId,
        organizationId
      );

      if (result.success) {
        toast({
          title: 'Custom fields saved',
          description: `Successfully updated fields in "${group.name}".`,
        });
        setIsEditing(false);
      } else {
        throw new Error(result.error || 'Failed to update custom fields.');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while saving.';
      toast({
        title: 'Save failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const currencyCode = entityData.financeData?.currency || 'GHS';

  const formatDisplayValue = (field: AppField, val: string | string[] | number | boolean | undefined | null) => {
    if (val === undefined || val === null || val === '') return '—';

    if (field.type === 'select' || field.type === 'radio') {
      const option = field.options?.find((opt) => opt.value === val);
      return option ? option.label : String(val);
    }

    if (field.type === 'multi_select') {
      const vals = Array.isArray(val) ? val : [String(val)];
      const labels = vals.map((v) => {
        const option = field.options?.find((opt) => opt.value === v);
        return option ? option.label : v;
      });
      return labels.join(', ') || '—';
    }

    if (field.type === 'yes_no' || field.type === 'checkbox') {
      return val === 'yes' || val === true || val === 'true' ? 'Yes' : 'No';
    }

    if (field.type === 'date') {
      try {
        return format(new Date(String(val)), 'PPP');
      } catch {
        return String(val);
      }
    }

    if (field.type === 'datetime') {
      try {
        return format(new Date(String(val)), 'PPp');
      } catch {
        return String(val);
      }
    }

    if (field.type === 'currency') {
      try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(Number(val));
      } catch {
        return `${currencyCode} ${val}`;
      }
    }

    return String(val);
  };

  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/40 backdrop-blur-md transition-all duration-300 hover:border-border/80 flex flex-col h-full text-left">
      <CardHeader className="bg-transparent border-b border-border/40 pb-4 pt-5 px-6 flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <DynamicIcon name={group.icon || 'Database'} className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold tracking-tight text-foreground">{group.name}</CardTitle>
            {group.description && (
              <CardDescription className="text-[10px] mt-0.5 leading-relaxed">{group.description}</CardDescription>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground active:scale-[0.97] transition-transform"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="default"
                  className="h-7 w-7 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 active:scale-[0.97] transition-transform"
                  onClick={handleSubmit(onSubmit)}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground active:scale-[0.97] transition-transform"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-6 flex-1 text-left">
        {isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-left">
            {group.fields.map((field) => (
              <Controller
                key={field.id}
                control={control}
                name={field.variableName}
                rules={{
                  required: field.validationRules?.required ? `${field.label} is required` : false,
                }}
                render={({ field: formField, fieldState: { error } }) => (
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider ml-0.5 flex items-center gap-1">
                      {field.label}
                      {field.validationRules?.required && <span className="text-destructive">*</span>}
                    </label>

                    {field.type === 'long_text' ? (
                      <Textarea
                        value={String(formField.value || '')}
                        onChange={formField.onChange}
                        placeholder={field.placeholder || ''}
                        disabled={isSaving}
                        className="min-h-[80px] rounded-xl bg-muted/30 border border-border/40 hover:border-border/60 focus-visible:ring-1 focus-visible:ring-primary/30 p-3 placeholder:text-muted-foreground/40 text-sm text-left shadow-none"
                      />
                    ) : field.type === 'select' || field.type === 'radio' ? (
                      <Select
                        onValueChange={formField.onChange}
                        value={String(formField.value || '')}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-muted/30 border border-border/40 hover:border-border/60 focus:ring-1 focus:ring-primary/30 text-sm font-semibold shadow-none text-left">
                          <SelectValue placeholder={field.placeholder || "Select option..."} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-2xl border-none">
                          {(field.options || []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="font-semibold">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === 'multi_select' ? (
                      <MultiSelect
                        options={(field.options || []).map((opt) => ({ label: opt.label, value: opt.value }))}
                        value={Array.isArray(formField.value) ? formField.value : []}
                        onChange={formField.onChange}
                        placeholder={field.placeholder || "Select options..."}
                      />
                    ) : field.type === 'yes_no' || field.type === 'checkbox' ? (
                      <Select
                        onValueChange={(val) => formField.onChange(val === 'yes')}
                        value={formField.value === true || formField.value === 'yes' ? 'yes' : 'no'}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-muted/30 border border-border/40 hover:border-border/60 focus:ring-1 focus:ring-primary/30 text-sm font-semibold shadow-none text-left">
                          <SelectValue placeholder="Select option..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-2xl border-none">
                          <SelectItem value="yes" className="font-semibold">Yes</SelectItem>
                          <SelectItem value="no" className="font-semibold">No</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={String(formField.value || '')}
                        onChange={formField.onChange}
                        disabled={isSaving}
                        type={
                          field.type === 'number' || field.type === 'currency'
                            ? 'number'
                            : field.type === 'date'
                            ? 'date'
                            : field.type === 'datetime'
                            ? 'datetime-local'
                            : field.type === 'email'
                            ? 'email'
                            : field.type === 'phone'
                            ? 'tel'
                            : field.type === 'url'
                            ? 'url'
                            : 'text'
                        }
                        placeholder={field.placeholder || ''}
                        className="h-11 rounded-xl bg-muted/30 border border-border/40 hover:border-border/60 focus:ring-1 focus:ring-primary/30 text-sm font-semibold shadow-none text-left"
                      />
                    )}
                    {error && (
                      <span className="text-[10px] text-destructive font-medium ml-1">
                        {error.message}
                      </span>
                    )}
                  </div>
                )}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
            {group.fields.map((field) => {
              const val = entityData.customData?.[field.variableName];
              return (
                <div key={field.id} className="space-y-1.5 text-left">
                  <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1.5 select-none">
                    {field.label}
                    {field.helpText && (
                      <div className="group relative">
                        <Info className="h-3 w-3 text-muted-foreground/40 hover:text-muted-foreground/70 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block w-48 bg-popover text-popover-foreground border border-border text-[9px] p-2 rounded-lg shadow-xl z-50">
                          {field.helpText}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-bold text-foreground leading-snug break-words">
                    {formatDisplayValue(field, val)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
