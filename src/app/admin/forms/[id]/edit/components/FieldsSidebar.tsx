'use client';

import * as React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { AppField, FieldGroup, FormFieldInstance } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  CaseSensitive,
  FileText,
  Mail,
  Phone,
  Hash,
  Calendar,
  ListFilter,
  ToggleLeft,
  MapPin,
  Link as LinkIcon,
  EyeOff,
  Search,
  Check,
  Plus,
} from 'lucide-react';

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  short_text: CaseSensitive,
  long_text: FileText,
  email: Mail,
  phone: Phone,
  number: Hash,
  currency: Hash,
  date: Calendar,
  datetime: Calendar,
  select: ListFilter,
  multi_select: ListFilter,
  radio: ToggleLeft,
  checkbox: ToggleLeft,
  yes_no: ToggleLeft,
  address: MapPin,
  url: LinkIcon,
  hidden: EyeOff,
};

interface DraggableSidebarItemProps {
  af: AppField;
  isAlreadyAdded: boolean;
  onAddField: (field: AppField) => void;
}

function DraggableSidebarItem({ af, isAlreadyAdded, onAddField }: DraggableSidebarItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sidebar-${af.id}`,
    disabled: isAlreadyAdded,
  });

  const Icon = FIELD_TYPE_ICONS[af.type] || CaseSensitive;

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none rounded-xl select-none",
        isDragging && "pointer-events-none"
      )}
    >
      <button
        type="button"
        disabled={isAlreadyAdded}
        onClick={() => onAddField(af)}
        className={cn(
          'w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all border group/item text-xs',
          isAlreadyAdded
            ? 'opacity-40 cursor-not-allowed border-border/30 bg-muted/20'
            : 'hover:bg-primary/5 hover:border-primary/20 border-border/50 cursor-pointer bg-background/30',
          isDragging && 'opacity-30 border-primary shadow-lg ring-1 ring-primary/20'
        )}
      >
        <div className="p-1.5 bg-primary/10 rounded-lg group-hover/item:scale-105 transition-transform shrink-0">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="font-bold truncate text-foreground">{af.label}</p>
            {af.isNative && (
              <Badge
                variant="secondary"
                className="h-3.5 text-[6px] uppercase px-1 font-extrabold tracking-tighter bg-primary/10 text-primary border-none"
              >
                Native
              </Badge>
            )}
            {af.type === 'hidden' && (
              <Badge
                variant="outline"
                className="h-3.5 text-[6px] uppercase px-1 font-extrabold tracking-tighter"
              >
                Hidden
              </Badge>
            )}
          </div>
          <p className="text-[8px] text-muted-foreground font-mono truncate">
            {'{{' + af.variableName + '}}'}
          </p>
        </div>
        {isAlreadyAdded ? (
          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        ) : (
          <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity" />
        )}
      </button>
    </div>
  );
}

export const SYSTEM_CONSTANTS_GROUP: FieldGroup = {
  id: 'system_constants',
  name: 'App Constants',
  slug: 'app_constants',
  order: -1,
  workspaceId: '',
  organizationId: '',
  description: 'System-wide parameters and constant variables',
  icon: 'ShieldAlert',
  color: '#F97316',
  entityTypes: ['institution', 'family', 'person'],
  isSystem: true,
  createdAt: new Date().toISOString(),
};

export const SYSTEM_CONSTANT_FIELDS: AppField[] = [
  { id: 'sc_entity_name',     label: 'Entity Name',     variableName: 'entity_name',     type: 'short_text', groupId: 'system_constants', workspaceId: '', organizationId: '', isNative: true, status: 'active', section: 'common', name: 'entity_name', compatibilityScope: ['common'], createdAt: new Date().toISOString() },
  { id: 'sc_contact_name',    label: 'Contact Name',    variableName: 'contact_name',    type: 'short_text', groupId: 'system_constants', workspaceId: '', organizationId: '', isNative: true, status: 'active', section: 'common', name: 'contact_name', compatibilityScope: ['common'], createdAt: new Date().toISOString() },
  { id: 'sc_contact_email',   label: 'Contact Email',   variableName: 'contact_email',   type: 'email',      groupId: 'system_constants', workspaceId: '', organizationId: '', isNative: true, status: 'active', section: 'common', name: 'contact_email', compatibilityScope: ['common'], createdAt: new Date().toISOString() },
  { id: 'sc_contact_phone',   label: 'Contact Phone',   variableName: 'contact_phone',   type: 'phone',      groupId: 'system_constants', workspaceId: '', organizationId: '', isNative: true, status: 'active', section: 'common', name: 'contact_phone', compatibilityScope: ['common'], createdAt: new Date().toISOString() },
  { id: 'sc_contact_role',    label: 'Contact Role',    variableName: 'contact_role',    type: 'short_text', groupId: 'system_constants', workspaceId: '', organizationId: '', isNative: true, status: 'active', section: 'common', name: 'contact_role', compatibilityScope: ['common'], createdAt: new Date().toISOString() },
];

interface FieldsSidebarProps {
  availableFields: AppField[] | undefined;
  fieldGroups: FieldGroup[] | undefined;
  addedFields: FormFieldInstance[];
  formType: 'bound' | 'global';
  contactScope?: 'institution' | 'family' | 'person' | null;
  onAddField: (field: AppField) => void;
}

export default function FieldsSidebar({
  availableFields,
  fieldGroups,
  addedFields,
  formType,
  contactScope,
  onAddField,
}: FieldsSidebarProps) {
  const [search, setSearch] = React.useState('');

  const allAvailableFields = React.useMemo(() => {
    return [...(availableFields || []), ...SYSTEM_CONSTANT_FIELDS];
  }, [availableFields]);

  const allFieldGroups = React.useMemo(() => {
    return [SYSTEM_CONSTANTS_GROUP, ...(fieldGroups || [])];
  }, [fieldGroups]);

  const filteredFields = React.useMemo(() => {
    return allAvailableFields.filter(af => {
      // 1. Filter by search query
      const matchSearch =
        af.label.toLowerCase().includes(search.toLowerCase()) ||
        af.variableName.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;

      return true;
    });
  }, [allAvailableFields, search]);

  return (
    <aside className="w-[300px] border-r bg-card/40 flex flex-col h-full shrink-0">
      <div className="p-4 border-b space-y-3">
        <div>
          <h3 className="font-bold text-sm text-foreground">Field Library</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            All fields available
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs rounded-lg focus-visible:ring-primary/20 bg-background/50"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <CardContent className="p-4 space-y-6">
          {!allFieldGroups || allFieldGroups.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No field groups found.
            </div>
          ) : (
            <div className="space-y-6">
              {allFieldGroups.map(group => {
                const groupFields = filteredFields.filter(f => f.groupId === group.id);
                if (groupFields.length === 0) return null;

                // Hidden fields sorted to the bottom of the group list
                const sortedFields = [...groupFields].sort((a, b) => {
                  if (a.type === 'hidden' && b.type !== 'hidden') return 1;
                  if (a.type !== 'hidden' && b.type === 'hidden') return -1;
                  return 0;
                });

                return (
                  <div key={group.id} className="space-y-2">
                    <h4 className="text-[9px] font-bold text-muted-foreground flex items-center gap-1.5 px-1 uppercase tracking-wider">
                      {group.name}
                    </h4>
                    <div className="space-y-1.5">
                      {sortedFields.map(af => {
                        const isAlreadyAdded = addedFields.some(f => f.appFieldId === af.id);
                        return (
                          <DraggableSidebarItem
                            key={af.id}
                            af={af}
                            isAlreadyAdded={isAlreadyAdded}
                            onAddField={onAddField}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </ScrollArea>
    </aside>
  );
}
