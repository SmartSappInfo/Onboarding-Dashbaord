'use client';

/**
 * TaskScopeSwitcher
 * Segmented scope control conforming to Roadmap §27 and UI Spec §444-462:
 * - All Tasks (default)
 * - My Tasks
 * - All Team Members
 * - Selected Team Member (with dedicated Team Member Selector)
 * - Tactile active:scale-[0.97] feedback and min-h-[44px] touch targets per .agents/AGENTS.md.
 * 
 * Caution for future maintainers:
 * - Do not remove disabled state on 'all' scope as standard users must be prevented from seeing workspace-wide tasks.
 * - Do not remove min-h-[44px] classes as mobile touch target accessibility requires it.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { User, Users, Globe, Lock, UserCheck, ChevronDown, X, Search, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { UserProfile } from '@/lib/types';

export type TaskScope = 'my' | 'team' | 'all' | 'member';

export interface TaskScopeSwitcherProps {
    currentScope: TaskScope;
    onScopeChange: (scope: TaskScope) => void;
    canViewAllTasks?: boolean;
    counts?: {
        my?: number;
        team?: number;
        all?: number;
        member?: number;
    };
    workspaceUsers?: UserProfile[];
    selectedMemberId?: string | null;
    onSelectMember?: (memberId: string | null) => void;
    className?: string;
}

export function TaskScopeSwitcher({
    currentScope,
    onScopeChange,
    canViewAllTasks = true,
    counts,
    workspaceUsers,
    selectedMemberId,
    onSelectMember,
    className,
}: TaskScopeSwitcherProps) {
    const [popoverOpen, setPopoverOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');

    const scopes: Array<{
        id: TaskScope;
        label: string;
        ariaLabel: string;
        icon: React.ComponentType<{ className?: string }>;
        disabled?: boolean;
        tooltip?: string;
    }> = [
        { 
            id: 'all', 
            label: 'All Tasks', 
            ariaLabel: 'All Tasks',
            icon: canViewAllTasks ? Globe : Lock, 
            disabled: !canViewAllTasks,
            tooltip: !canViewAllTasks ? 'Requires admin or manager permissions to view all tasks.' : undefined,
        },
        { 
            id: 'my', 
            label: 'My Tasks', 
            ariaLabel: 'My Tasks',
            icon: User 
        },
        { 
            id: 'team', 
            label: 'All Team Members', 
            ariaLabel: 'Team Tasks - All Team Members',
            icon: Users 
        },
    ];

    const selectedUser = React.useMemo(() => {
        if (!selectedMemberId || !workspaceUsers) return null;
        return workspaceUsers.find((u) => u.id === selectedMemberId) || null;
    }, [selectedMemberId, workspaceUsers]);

    const filteredUsers = React.useMemo(() => {
        if (!workspaceUsers) return [];
        if (!searchQuery.trim()) return workspaceUsers;
        const q = searchQuery.toLowerCase().trim();
        return workspaceUsers.filter(
            (u) =>
                u.name?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                u.displayName?.toLowerCase().includes(q)
        );
    }, [workspaceUsers, searchQuery]);

    const handleSelectUser = (user: UserProfile) => {
        onSelectMember?.(user.id);
        onScopeChange('member');
        setPopoverOpen(false);
    };

    const handleClearSelectedMember = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelectMember?.(null);
        onScopeChange('team');
    };

    return (
        <TooltipProvider>
            <div className={cn("inline-flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/80 shadow-xs", className)}>
                {/* Standard Scope Buttons: All Tasks, My Tasks, All Team Members */}
                {scopes.map((s) => {
                    const Icon = s.icon;
                    const isSelected = currentScope === s.id;
                    const count = counts?.[s.id];

                    const buttonElement = (
                        <button
                            key={s.id}
                            type="button"
                            disabled={s.disabled}
                            onClick={() => {
                                if (s.disabled) return;
                                if (s.id !== 'member' && onSelectMember && currentScope === 'member') {
                                    onSelectMember(null);
                                }
                                onScopeChange(s.id);
                            }}
                            aria-label={s.ariaLabel}
                            aria-pressed={isSelected}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all select-none min-h-[44px] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                isSelected
                                    ? "bg-card text-foreground shadow-sm font-bold border border-border/60"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                                s.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
                            )}
                        >
                            <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                            <span>{s.label}</span>
                            {typeof count === 'number' && (
                                <span className={cn(
                                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5",
                                    isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                )}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );

                    if (s.tooltip) {
                        return (
                            <Tooltip key={s.id}>
                                <TooltipTrigger asChild>
                                    <span>{buttonElement}</span>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs max-w-xs">{s.tooltip}</TooltipContent>
                            </Tooltip>
                        );
                    }

                    return buttonElement;
                })}

                {/* Team Member Selector (Available when workspaceUsers is provided) */}
                {workspaceUsers && (
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        {currentScope === 'member' && selectedUser ? (
                            <div className="flex items-center rounded-lg border border-primary/50 bg-primary/10 pl-2.5 pr-1 py-1 text-xs font-bold text-primary min-h-[44px] shadow-xs">
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={`Selected team member: ${selectedUser.name}`}
                                        aria-pressed={true}
                                        className="flex items-center gap-2 select-none active:scale-[0.97] focus-visible:outline-none"
                                    >
                                        <Avatar className="h-5 w-5 border border-primary/30">
                                            <AvatarImage src={selectedUser.photoURL || undefined} alt={selectedUser.name} />
                                            <AvatarFallback className="text-[9px] bg-primary/20 text-primary font-bold">
                                                {selectedUser.name?.charAt(0) || 'U'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="truncate max-w-[120px]">{selectedUser.name}</span>
                                        <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                                    </button>
                                </PopoverTrigger>
                                <button
                                    type="button"
                                    onClick={handleClearSelectedMember}
                                    aria-label="Clear team member filter"
                                    className="h-7 w-7 min-h-[28px] ml-1 rounded-md hover:bg-primary/20 flex items-center justify-center text-primary/70 hover:text-primary transition-colors active:scale-[0.95]"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ) : (
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    aria-label="Selected team member"
                                    aria-pressed={false}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all select-none min-h-[44px] active:scale-[0.97] border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                >
                                    <UserCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span>Select Team Member</span>
                                    <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
                                </button>
                            </PopoverTrigger>
                        )}

                        <PopoverContent
                            align="start"
                            sideOffset={6}
                            className="w-[280px] p-0 border border-border/80 bg-card text-card-foreground shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in-50 zoom-in-95"
                        >
                            <div className="p-2.5 border-b border-border/80 bg-muted/20">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-60" />
                                    <Input
                                        placeholder="Search team members..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-9 min-h-[36px] rounded-lg bg-background border border-border text-foreground font-medium pl-8 text-xs w-full focus-visible:ring-1 focus-visible:ring-primary"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="max-h-[260px] overflow-y-auto p-1.5 space-y-0.5">
                                {/* All Team Members Option */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelectMember?.(null);
                                        onScopeChange('team');
                                        setPopoverOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-all text-left active:scale-[0.97]",
                                        currentScope === 'team'
                                            ? "bg-primary text-primary-foreground font-bold"
                                            : "hover:bg-muted/60 text-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4 opacity-70" />
                                        <span>All Team Members</span>
                                    </div>
                                    {currentScope === 'team' && <Check className="h-3.5 w-3.5" />}
                                </button>

                                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mt-1">
                                    Workspace Members ({filteredUsers.length})
                                </div>

                                {filteredUsers.map((user) => {
                                    const isSelected = selectedMemberId === user.id;
                                    return (
                                        <button
                                            key={user.id}
                                            type="button"
                                            onClick={() => handleSelectUser(user)}
                                            className={cn(
                                                "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium min-h-[44px] transition-all text-left active:scale-[0.97]",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground font-semibold"
                                                    : "hover:bg-muted/60 text-foreground"
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Avatar className="h-6 w-6 shrink-0 border border-border/40">
                                                    <AvatarImage src={user.photoURL || undefined} alt={user.name} />
                                                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground font-bold">
                                                        {user.name?.charAt(0) || 'U'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold leading-tight">{user.name}</p>
                                                    {user.email && (
                                                        <p className={cn(
                                                            "truncate text-[10px] leading-tight",
                                                            isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                                                        )}>
                                                            {user.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {isSelected && <Check className="h-3.5 w-3.5 shrink-0 ml-1" />}
                                        </button>
                                    );
                                })}

                                {filteredUsers.length === 0 && (
                                    <div className="py-4 text-center text-xs text-muted-foreground">
                                        No team members found
                                    </div>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </TooltipProvider>
    );
}
