'use client';

/**
 * @fileOverview People Filter Drawer (Identity & Access 2.0)
 *
 * Slide-over drawer providing multi-dimensional filtering across Status, Workspaces,
 * Roles, and Departments with preset shortcuts and Emil Kowalski animation physics.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Sheet with custom cubic-bezier transitions (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Mobile ergonomics: full-width on mobile, responsive form controls with `min-h-[44px]`.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Filter, X, RotateCcw, Check, Sparkles, Building, Shield, UserCheck } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PeopleDirectoryFilter, MembershipStatus, Workspace, Role } from '@/lib/types';

interface PeopleFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: PeopleDirectoryFilter;
  onApplyFilters: (filters: PeopleDirectoryFilter) => void;
  onResetFilters: () => void;
  workspaces: Workspace[];
  roles: Role[];
  departments: string[];
}

export function PeopleFilterDrawer({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
  workspaces,
  roles,
  departments,
}: PeopleFilterDrawerProps) {
  const [localFilters, setLocalFilters] = React.useState<PeopleDirectoryFilter>(filters);

  // Sync state when opened
  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters, isOpen]);

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (localFilters.status && localFilters.status !== 'all') count++;
    if (localFilters.workspaceId) count++;
    if (localFilters.roleId) count++;
    if (localFilters.departmentId) count++;
    if (localFilters.memberType) count++;
    return count;
  }, [localFilters]);

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    const emptyFilters: PeopleDirectoryFilter = {
      status: 'all',
      workspaceId: undefined,
      roleId: undefined,
      departmentId: undefined,
      memberType: undefined,
    };
    setLocalFilters(emptyFilters);
    onResetFilters();
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col justify-between bg-card border-l shadow-2xl"
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Header */}
          <SheetHeader className="p-5 pb-4 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <SheetTitle className="text-base font-semibold">Filter People Directory</SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">
                    Refine members by status, workspace, and roles
                  </SheetDescription>
                </div>
              </div>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="px-2 py-0.5 text-xs font-semibold">
                  {activeFilterCount} Active
                </Badge>
              )}
            </div>
          </SheetHeader>

          {/* Body */}
          <div className="p-5 space-y-5">
            {/* Quick Preset Views */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Preset Views
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={localFilters.status === 'all' && !localFilters.roleId && !localFilters.workspaceId ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setLocalFilters({ status: 'all' })}
                  className="justify-start text-xs h-9 active:scale-[0.97]"
                >
                  All People
                </Button>
                <Button
                  type="button"
                  variant={localFilters.status === 'pending' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setLocalFilters({ ...localFilters, status: 'pending' })}
                  className="justify-start text-xs h-9 active:scale-[0.97]"
                >
                  Pending Review
                </Button>
                <Button
                  type="button"
                  variant={localFilters.status === 'active' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setLocalFilters({ ...localFilters, status: 'active' })}
                  className="justify-start text-xs h-9 active:scale-[0.97]"
                >
                  Active Members
                </Button>
                <Button
                  type="button"
                  variant={localFilters.status === 'suspended' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setLocalFilters({ ...localFilters, status: 'suspended' })}
                  className="justify-start text-xs h-9 active:scale-[0.97]"
                >
                  Suspended
                </Button>
              </div>
            </div>

            <Separator />

            {/* Membership Status */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Membership Status</Label>
              <Select
                value={localFilters.status || 'all'}
                onValueChange={(val) => setLocalFilters({ ...localFilters, status: val as MembershipStatus | 'all' })}
              >
                <SelectTrigger className="h-10 min-h-[44px] text-xs">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending Approval</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Workspace Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-muted-foreground" /> Operational Workspace
              </Label>
              <Select
                value={localFilters.workspaceId || 'all'}
                onValueChange={(val) => setLocalFilters({ ...localFilters, workspaceId: val === 'all' ? undefined : val })}
              >
                <SelectTrigger className="h-10 min-h-[44px] text-xs">
                  <SelectValue placeholder="All Workspaces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workspaces</SelectItem>
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-muted-foreground" /> Assigned Role
              </Label>
              <Select
                value={localFilters.roleId || 'all'}
                onValueChange={(val) => setLocalFilters({ ...localFilters, roleId: val === 'all' ? undefined : val })}
              >
                <SelectTrigger className="h-10 min-h-[44px] text-xs">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Department Filter (if departments exist) */}
            {departments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Department</Label>
                <Select
                  value={localFilters.departmentId || 'all'}
                  onValueChange={(val) => setLocalFilters({ ...localFilters, departmentId: val === 'all' ? undefined : val })}
                >
                  <SelectTrigger className="h-10 min-h-[44px] text-xs">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <SheetFooter className="p-4 border-t bg-muted/20 flex flex-row items-center gap-2 justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs h-10 min-h-[44px] px-3 text-muted-foreground active:scale-[0.97]"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            className="text-xs h-10 min-h-[44px] px-4 font-medium active:scale-[0.97]"
          >
            <Check className="w-3.5 h-3.5 mr-1.5" /> Apply Filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default PeopleFilterDrawer;
