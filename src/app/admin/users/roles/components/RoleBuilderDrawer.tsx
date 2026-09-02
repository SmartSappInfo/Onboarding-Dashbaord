'use client';

/**
 * @fileOverview Role Builder & Blueprint Cloner Drawer (Authorization 2.0)
 *
 * Slide-over editor for authoring custom roles, cloning from the 22 canonical platform presets,
 * inspecting live capability metrics, and validating DAG permission dependencies.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Sheet with Emil Kowalski animation physics (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Enforces privilege escalation ceilings on server action submission.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { Shield, Sparkles, Save, Loader2, Copy, Check } from 'lucide-react';
import type { Role, PermissionsSchema } from '@/lib/types';
import { PermissionEditor } from '../PermissionEditor';
import { CANONICAL_ROLE_BLUEPRINTS } from '@/lib/role-blueprint-presets';
import { normalizePermissionsSchema, getBlankPermissions } from '@/lib/permissions-engine';
import { PermissionRegistryService } from '@/lib/services/authorization/permission-registry-service';
import { createOrUpdateRoleAction } from '@/app/actions/authorization-actions';

interface RoleBuilderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  existingRole?: Role | null;
  onRoleSaved?: (role: Role) => void;
}

const COLOR_OPTIONS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#6366F1', // Indigo
  '#EF4444', // Red
  '#64748B', // Slate
];

export function RoleBuilderDrawer({
  isOpen,
  onClose,
  existingRole,
  onRoleSaved,
}: RoleBuilderDrawerProps) {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [isSaving, setIsSaving] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [color, setColor] = React.useState('#3B82F6');
  const [category, setCategory] = React.useState('Custom');
  const [schema, setSchema] = React.useState<PermissionsSchema>(getBlankPermissions());
  const [selectedBlueprintId, setSelectedBlueprintId] = React.useState('builtin-operations-lead');

  // Initialize or reset state
  React.useEffect(() => {
    if (!isOpen) return;

    if (existingRole) {
      setName(existingRole.name);
      setDescription(existingRole.description || '');
      setColor(existingRole.color || '#3B82F6');
      setCategory(existingRole.category || 'Custom');
      setSchema(
        existingRole.permissionsSchema
          ? normalizePermissionsSchema(existingRole.permissionsSchema)
          : getBlankPermissions()
      );
    } else {
      setName('');
      setDescription('');
      setColor('#3B82F6');
      setCategory('Custom');
      // Default to cloned blueprint
      const defaultBp = CANONICAL_ROLE_BLUEPRINTS.find((b) => b.id === 'builtin-operations-lead');
      setSchema(
        defaultBp?.content
          ? normalizePermissionsSchema(defaultBp.content)
          : getBlankPermissions()
      );
    }
  }, [existingRole, isOpen]);

  // Clone from blueprint preset
  const handleApplyBlueprint = (blueprintId: string) => {
    setSelectedBlueprintId(blueprintId);
    const bp = CANONICAL_ROLE_BLUEPRINTS.find((b) => b.id === blueprintId);
    if (bp?.content) {
      const cloned = normalizePermissionsSchema(bp.content);
      setSchema(cloned);
      if (!name) setName(bp.name);
      if (!description) setDescription(bp.description || '');
      if (bp.category) setCategory(bp.category);
    }
  };

  // Compute live capability summary and risk metrics
  const metrics = React.useMemo(() => {
    return PermissionRegistryService.calculateRiskMetrics(schema);
  }, [schema]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !activeOrganizationId) return;

    if (!name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Role name is required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await createOrUpdateRoleAction({
        idToken,
        organizationId: activeOrganizationId,
        roleId: existingRole?.id,
        data: {
          name: name.trim(),
          description: description.trim(),
          color,
          category,
          permissionsSchema: schema,
        },
      });

      if (res.success && res.role) {
        toast({
          title: existingRole ? 'Role Updated' : 'Role Created',
          description: `Successfully saved role '${res.role.name}' with ${metrics.totalActive} active permissions.`,
        });
        if (onRoleSaved) onRoleSaved(res.role);
        onClose();
      } else {
        throw new Error(res.error || 'Failed to save role');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Operation Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col justify-between bg-card border-l shadow-2xl z-[100]"
      >
        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-y-auto">
          {/* Header */}
          <SheetHeader className="p-5 pb-4 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <SheetTitle className="text-base font-semibold">
                    {existingRole ? `Edit Role: ${existingRole.name}` : 'Create Custom Role'}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">
                    Define granular operational capabilities and permission boundaries
                  </SheetDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {metrics.totalActive} Active Grants
              </Badge>
            </div>
          </SheetHeader>

          {/* Form Body */}
          <div className="p-5 space-y-5">
            {/* Blueprint Cloner (only for new roles) */}
            {!existingRole && (
              <div className="p-3.5 rounded-xl border bg-primary/5 border-primary/20 space-y-2">
                <Label className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Start from Canonical Preset Blueprint
                </Label>
                <div className="flex items-center gap-2">
                  <Select value={selectedBlueprintId} onValueChange={handleApplyBlueprint}>
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue placeholder="Choose a preset..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {CANONICAL_ROLE_BLUEPRINTS.map((bp) => (
                        <SelectItem key={bp.id} value={bp.id} className="text-xs">
                          {bp.name} ({bp.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Role Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Role Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Admissions Lead"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Category</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Sales, Operations, Finance"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of what team members in this role are responsible for..."
                className="text-xs min-h-[60px] resize-none"
              />
            </div>

            {/* Color Tagging */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Badge Color</Label>
              <div className="flex items-center gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={cn(
                      'w-6 h-6 rounded-full transition-transform active:scale-90 flex items-center justify-center',
                      color === c && 'ring-2 ring-primary ring-offset-2'
                    )}
                  >
                    {color === c && <Check className="w-3 h-3 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Capability Summary Metrics */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              <div className="p-2 rounded-lg border bg-muted/20 text-center text-xs">
                <span className="text-[10px] text-muted-foreground block">Operations</span>
                <span className="font-bold text-foreground">{metrics.capabilitySummary.operations}</span>
              </div>
              <div className="p-2 rounded-lg border bg-muted/20 text-center text-xs">
                <span className="text-[10px] text-muted-foreground block">Finance</span>
                <span className="font-bold text-foreground">{metrics.capabilitySummary.finance}</span>
              </div>
              <div className="p-2 rounded-lg border bg-muted/20 text-center text-xs">
                <span className="text-[10px] text-muted-foreground block">Studios</span>
                <span className="font-bold text-foreground">{metrics.capabilitySummary.studios}</span>
              </div>
              <div className="p-2 rounded-lg border bg-muted/20 text-center text-xs">
                <span className="text-[10px] text-muted-foreground block">Management</span>
                <span className="font-bold text-foreground">{metrics.capabilitySummary.management}</span>
              </div>
            </div>

            {/* Permission Editor Matrix Component */}
            <div className="pt-2 border-t space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Fine-Grained Permission Schema
              </Label>
              <PermissionEditor schema={schema} onChange={setSchema} />
            </div>
          </div>

          {/* Footer */}
          <SheetFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs h-9 px-4 active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="text-xs h-9 px-5 font-semibold active:scale-[0.97]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving Role...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" /> Save Role Architecture
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default RoleBuilderDrawer;
