'use client';

import * as React from 'react';
import type { ContactScope, EntityType } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Building, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScopeBadgeProps {
  scope: ContactScope | EntityType;
  variant?: 'default' | 'outline' | 'secondary';
  showIcon?: boolean;
  className?: string;
}

/**
 * Scope badge component for displaying contact scope labels
 * Used in workspace switcher, settings, and contact detail pages (Requirement 25)
 */
export function ScopeBadge({ scope, variant = 'secondary', showIcon = false, className }: ScopeBadgeProps) {
  const scopeConfig = getScopeConfig(scope);
  
  return (
    <Badge variant={variant} className={cn('text-xs font-bold uppercase tracking-wider', className)}>
      {showIcon && <scopeConfig.icon className="h-3 w-3 mr-1" />}
      {scopeConfig.label}
    </Badge>
  );
}

/**
 * Maps contactScope/entityType values to user-friendly labels and icons
 */
function getScopeConfig(scope: ContactScope | EntityType) {
  const scopeMap: Record<ContactScope, { label: string; icon: React.ElementType }> = {
    institution: { label: 'Schools', icon: Building },
    family: { label: 'Families', icon: Users },
    person: { label: 'People', icon: User }
  };
  
  return scopeMap[scope] || { label: 'Unknown', icon: User };
}

/**
 * Scope label component for workspace settings
 * Displays: "This workspace manages [scope label]. Only [scope label] records can exist here."
 */
export function ScopeLabel({ scope, locked }: { scope: ContactScope; locked?: boolean }) {
  const scopeConfig = getScopeConfig(scope);
  
  return (
    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border">
      <div className="p-2 bg-primary/10 rounded-lg">
        <scopeConfig.icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold">
          This workspace manages <span className="text-primary">{scopeConfig.label}</span>.
        </p>
        <p className="text-xs text-muted-foreground">
          Only {scopeConfig.label} records can exist here.
          {locked && ' Scope is locked because this workspace has active contacts.'}
        </p>
      </div>
      {locked && (
        <Badge variant="outline" className="text-xs">
          🔒 Locked
        </Badge>
      )}
    </div>
  );
}

/**
 * Scope selection component for workspace creation wizard
 */
export function ScopeSelector({ 
  value, 
  onChange, 
  disabled 
}: { 
  value: ContactScope; 
  onChange: (scope: ContactScope) => void; 
  disabled?: boolean;
}) {
  const scopes: ContactScope[] = ['institution', 'family', 'person'];
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scopes.map((scope) => {
          const config = getScopeConfig(scope);
          const isSelected = value === scope;
          
          return (
            <button
              key={scope}
              type="button"
              onClick={() => !disabled && onChange(scope)}
              disabled={disabled}
              className={cn(
                'p-6 rounded-xl border-2 transition-all text-left',
                'hover:shadow-md hover:scale-105',
                isSelected 
                  ? 'border-primary bg-primary/5 shadow-lg' 
                  : 'border-border bg-white',
                disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                )}>
                  <config.icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg">{config.label}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {scope === 'institution' && 'Manage schools and educational institutions with billing, contracts, and enrollment tracking.'}
                {scope === 'family' && 'Manage families with guardians, children, and admissions workflows.'}
                {scope === 'person' && 'Manage individual contacts with company info and sales pipeline tracking.'}
              </p>
            </button>
          );
        })}
      </div>
      
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-sm font-medium text-amber-900">
          ⚠️ Scope cannot be changed after the first contact is added.
        </p>
      </div>
    </div>
  );
}

/**
 * Scope mismatch error message component
 * Displays human-readable error when scope violation occurs (Requirement 25)
 */
export function ScopeMismatchError({ 
  entityType, 
  workspaceScope 
}: { 
  entityType: EntityType; 
  workspaceScope: ContactScope;
}) {
  const entityConfig = getScopeConfig(entityType);
  const workspaceConfig = getScopeConfig(workspaceScope);
  
  return (
    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
      <p className="text-sm font-bold text-destructive mb-2">
        Scope Mismatch Error
      </p>
      <p className="text-sm text-destructive/80">
        {entityConfig.label} records cannot be added to a workspace that manages {workspaceConfig.label}.
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        Please select a workspace with the correct contact scope or create a new workspace.
      </p>
    </div>
  );
}
