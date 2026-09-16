'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * =======================================
 * EntityHeaderCard is the Single Source of Truth component for rendering the top Console Header
 * across both Console View (`/admin/entities/[id]`) and Entity Design Studio (`/admin/entities/[id]/edit`).
 * 
 * DESIGN REQUIREMENTS:
 * 1. Persistent Visibility: Remains visible at the top of the entity page regardless of view mode.
 * 2. Dynamic Primary Action:
 *    - In 'console' mode: Renders "Edit" button with PenSquare icon to switch to Design Studio.
 *    - In 'edit' mode: Renders "Console" button with LayoutDashboard icon to return to Console View.
 * 3. Micro-Interactions & Mobile Target: All buttons enforce `min-h-[44px]` touch target sizing
 *    and responsive active press feedback (`active:scale-[0.97]`).
 * 4. Strict Typing: Fully typed without any `any` or `any[]` escape hatches.
 */

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Entity, WorkspaceEntity } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    MapPin,
    Users,
    PenSquare,
    Check,
    X,
    Loader2,
    Zap,
    PhoneCall,
    PhoneForwarded,
    Download,
    ChevronDown,
    FileCode,
    Sparkles,
    Pencil,
    Camera,
    LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UNASSIGNED_ZONE } from '@/lib/zone-constants';

export interface EntityHeaderCardProps {
    entityId: string;
    displayName: string;
    entityData: Entity;
    weData: WorkspaceEntity;
    mode: 'console' | 'edit';
    onModeToggle?: () => void;
    onConvertModalOpen: () => void;
    onCallNow: () => void;
    onAddToCallCampaign: () => void;
    onExportJSON: () => void;
    onExportPDF: () => void;
    onLogoClick: () => void;
    onSaveName: (newName: string) => Promise<void>;
    isGeneratingPdf: boolean;
}

const getStatusBadgeVariant = (status: string | undefined): 'default' | 'outline' | 'secondary' => {
    switch (status) {
        case 'active':
        case 'Active':
            return 'default';
        case 'archived':
        case 'Archived':
            return 'outline';
        default:
            return 'secondary';
    }
};

const getInitials = (name?: string | null): string =>
    name
        ? name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
        : '?';

export default function EntityHeaderCard({
    entityId,
    displayName,
    entityData,
    weData,
    mode,
    onModeToggle,
    onConvertModalOpen,
    onCallNow,
    onAddToCallCampaign,
    onExportJSON,
    onExportPDF,
    onLogoClick,
    onSaveName,
    isGeneratingPdf,
}: EntityHeaderCardProps) {
    const router = useRouter();

    // Inline Entity Name Editing
    const [isEditingName, setIsEditingName] = React.useState(false);
    const [nameInput, setNameInput] = React.useState('');
    const [isSavingName, setIsSavingName] = React.useState(false);

    const isInstitution = entityData.entityType === 'institution';
    const capacity = entityData.industryData && 'capacity' in entityData.industryData ? (entityData.industryData.capacity ?? 0) : 0;
    const logoUrl = entityData.logoUrl;

    // Location Formatting
    const locationParts = [
        entityData.location?.district?.name,
        entityData.location?.region?.name,
    ].filter((p): p is string => Boolean(p));
    const hierarchyString = locationParts.length > 0 ? locationParts.join(', ') : null;
    const countryFlag = entityData.location?.country?.flag;
    const locationZone = entityData.location?.zone?.name;
    const displayLocation = hierarchyString || locationZone || UNASSIGNED_ZONE.name;

    const handleNameSubmit = async () => {
        if (isSavingName) return;
        const trimmed = nameInput.trim();
        if (!trimmed) return;

        if (trimmed === displayName) {
            setIsEditingName(false);
            return;
        }

        setIsSavingName(true);
        try {
            await onSaveName(trimmed);
            setIsEditingName(false);
        } finally {
            setIsSavingName(false);
        }
    };

    const handlePrimaryActionClick = () => {
        if (onModeToggle) {
            onModeToggle();
            return;
        }

        if (mode === 'console') {
            router.push(`/admin/entities/${entityId}/edit`);
        } else {
            router.push(`/admin/entities/${entityId}`);
        }
    };

    return (
        <div className="relative overflow-visible rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl shadow-lg">
            <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                {/* Identity & Logo */}
                <div className="flex items-center gap-6">
                    <div
                        className="relative h-20 w-20 md:h-24 md:w-24 rounded-2xl bg-card p-1 shadow-sm ring-1 ring-border/50 overflow-hidden shrink-0 group cursor-pointer"
                        onClick={onLogoClick}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onLogoClick();
                            }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label="Change logo"
                    >
                        {isInstitution && logoUrl ? (
                            <Image
                                src={logoUrl}
                                alt={displayName}
                                fill
                                sizes="(min-width: 768px) 6rem, 5rem"
                                className="object-contain p-2"
                            />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center bg-primary/5 text-primary text-2xl font-semibold">
                                {getInitials(displayName)}
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Camera className="h-6 w-6" />
                        </div>
                    </div>

                    <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                            {isEditingName ? (
                                <div className="flex items-center gap-1.5 w-full max-w-md">
                                    <Input
                                        value={nameInput}
                                        onChange={(e) => setNameInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleNameSubmit();
                                            } else if (e.key === 'Escape') {
                                                setIsEditingName(false);
                                            }
                                        }}
                                        autoFocus
                                        disabled={isSavingName}
                                        placeholder="Entity name"
                                        className="h-10 px-3 text-lg md:text-xl font-bold rounded-xl bg-background border-border shadow-2xs text-foreground focus-visible:ring-1 focus-visible:ring-primary min-h-[44px]"
                                    />
                                    <Button
                                        type="button"
                                        size="icon"
                                        disabled={isSavingName || !nameInput.trim()}
                                        onClick={handleNameSubmit}
                                        className="h-10 w-10 shrink-0 rounded-xl bg-foreground text-background hover:bg-foreground/90 shadow-2xs active:scale-[0.97] min-h-[44px] min-w-[44px]"
                                        title="Save name (Enter)"
                                    >
                                        {isSavingName ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Check className="h-4 w-4" />
                                        )}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        disabled={isSavingName}
                                        onClick={() => setIsEditingName(false)}
                                        className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:text-foreground active:scale-[0.97] min-h-[44px] min-w-[44px]"
                                        title="Cancel (Esc)"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => {
                                            setNameInput(displayName || '');
                                            setIsEditingName(true);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setNameInput(displayName || '');
                                                setIsEditingName(true);
                                            }
                                        }}
                                        className="group/name flex items-center gap-2 cursor-pointer select-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        title="Click to edit name"
                                    >
                                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground group-hover/name:text-primary transition-colors">
                                            {displayName}
                                        </h2>
                                        <span className="p-1 rounded-md text-muted-foreground/50 group-hover/name:text-foreground group-hover/name:bg-muted/60 transition-all">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </span>
                                    </div>
                                    <Badge
                                        variant={getStatusBadgeVariant(weData.status)}
                                        className="h-5 px-2 text-[10px] font-semibold uppercase tracking-wider"
                                    >
                                        {weData.status}
                                    </Badge>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground font-medium">
                            <span>
                                {countryFlag ? (
                                    <span className="mr-1.5">{countryFlag}</span>
                                ) : (
                                    <MapPin className="h-3.5 w-3.5 inline mr-1" />
                                )}
                                {displayLocation}
                            </span>
                        </div>

                        {/* Summary Metrics Row */}
                        <div className="pt-3 flex flex-wrap items-center gap-3">
                            {capacity > 0 && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 border border-primary/15 rounded-xl">
                                    <Users className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-xs font-bold text-primary tabular-nums">
                                        {capacity.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] font-semibold text-primary/60">Capacity</span>
                                </div>
                            )}
                            {weData.leadScore !== undefined && (
                                <div
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 border rounded-xl',
                                        weData.leadScore >= 80
                                            ? 'bg-rose-500/5 border-rose-500/20 text-rose-500'
                                            : weData.leadScore >= 15
                                            ? 'bg-amber-500/5 border-amber-500/20 text-amber-500'
                                            : 'bg-slate-500/5 border-slate-500/20 text-slate-500'
                                    )}
                                >
                                    <span className="text-sm">
                                        {weData.leadScore >= 80 ? '🔥' : weData.leadScore >= 15 ? '⚡' : '❄️'}
                                    </span>
                                    <span className="text-xs font-black tabular-nums">{weData.leadScore}</span>
                                    <span className="text-[10px] font-bold uppercase opacity-75">Lead Score</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Top Actions */}
                <TooltipProvider delayDuration={200}>
                    <div className="flex items-center gap-2.5 flex-wrap md:flex-nowrap w-full md:w-auto mt-4 md:mt-0 shrink-0">
                        {!weData.isConverted && (
                            <Button
                                variant="outline"
                                className="rounded-xl font-semibold h-10 px-4 text-xs md:text-sm bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 shadow-2xs gap-2 active:scale-[0.97] min-h-[44px]"
                                onClick={onConvertModalOpen}
                            >
                                <Zap className="h-4 w-4 text-primary" /> New Deal
                            </Button>
                        )}

                        {/* Grouped Call Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="rounded-xl font-semibold h-10 px-4 text-xs md:text-sm bg-card hover:bg-muted/40 border-border shadow-2xs gap-2 active:scale-[0.97] min-h-[44px]"
                                >
                                    <PhoneCall className="h-4 w-4 text-indigo-500" />
                                    <span>Call</span>
                                    <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl border-border shadow-lg min-w-[175px] p-1">
                                <DropdownMenuItem
                                    onClick={onCallNow}
                                    className="gap-2.5 text-xs font-medium cursor-pointer rounded-lg py-2 min-h-[44px]"
                                >
                                    <PhoneCall className="h-4 w-4 text-indigo-500" />
                                    <span>Call Now</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={onAddToCallCampaign}
                                    className="gap-2.5 text-xs font-medium cursor-pointer rounded-lg py-2 min-h-[44px]"
                                >
                                    <PhoneForwarded className="h-4 w-4 text-indigo-500" />
                                    <span>Add to Call Campaign</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Export Dropdown Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    disabled={isGeneratingPdf}
                                    className="rounded-xl font-semibold h-10 px-3.5 text-xs md:text-sm bg-card hover:bg-muted/40 border-border shadow-2xs gap-1.5 active:scale-[0.97] min-h-[44px]"
                                >
                                    {isGeneratingPdf ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    ) : (
                                        <Download className="h-4 w-4 text-foreground" />
                                    )}
                                    <span>Export</span>
                                    <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl border-border shadow-lg min-w-[220px] p-1.5">
                                <DropdownMenuItem
                                    onClick={onExportJSON}
                                    className="gap-3 text-xs font-medium cursor-pointer rounded-lg py-2 min-h-[44px]"
                                >
                                    <FileCode className="h-4 w-4 text-emerald-500 shrink-0" />
                                    <div className="flex flex-col text-left">
                                        <span className="font-semibold text-foreground">Export JSON (.json)</span>
                                        <span className="text-[10px] text-muted-foreground">Raw data & metadata backup</span>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={onExportPDF}
                                    disabled={isGeneratingPdf}
                                    className="gap-3 text-xs font-medium cursor-pointer rounded-lg py-2 min-h-[44px]"
                                >
                                    <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
                                    <div className="flex flex-col text-left">
                                        <span className="font-semibold text-foreground">Executive Dossier (.pdf)</span>
                                        <span className="text-[10px] text-muted-foreground">Full report & AI strategic briefing</span>
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Primary Action: Mode Swap Button (Edit vs Console) */}
                        <Button
                            className="rounded-xl font-semibold h-10 px-4 text-xs md:text-sm shadow-2xs bg-foreground text-background hover:bg-foreground/90 active:scale-[0.97] gap-2 min-h-[44px]"
                            onClick={handlePrimaryActionClick}
                        >
                            {mode === 'console' ? (
                                <>
                                    <PenSquare className="h-4 w-4" />
                                    <span>Edit</span>
                                </>
                            ) : (
                                <>
                                    <LayoutDashboard className="h-4 w-4 text-primary-foreground" />
                                    <span>Console</span>
                                </>
                            )}
                        </Button>
                    </div>
                </TooltipProvider>
            </div>
        </div>
    );
}
