
'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Layout, Building, Video, Palette, Type, MessageSquareText, ArrowRight, Image as ImageIcon, Search, Users, User } from 'lucide-react';
import { MediaSelect } from '@/app/admin/entities/components/media-select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { WorkspaceEntity } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Step1DetailsProps {
    institutions?: WorkspaceEntity[];
}

export default function Step1Details({ institutions }: Step1DetailsProps) {
    const { control, setValue, watch } = useFormContext();

    return (
 <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500 text-left">
            {/* Identity Card */}
 <Card className="shadow-sm border-none ring-1 ring-border rounded-2xl overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6 px-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl">
 <Type className="h-5 w-5 text-primary" />
                        </div>
                        <div>
 <CardTitle className="text-sm font-semibold tracking-tight">Identity & Branding</CardTitle>
 <CardDescription className="text-[10px] font-bold text-muted-foreground/60">Core nomenclature and organizational context.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
 <CardContent className="p-6 space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Controller
                            name="internalName"
                            control={control}
                            render={({ field }) => (
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Internal Blueprint Name</Label>
 <Input {...field} placeholder="e.g. 2024 Parent Satisfaction Audit" className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" />
                                </div>
                            )}
                        />
                        <Controller
                            name="title"
                            control={control}
                            render={({ field }) => (
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Public Header Title</Label>
 <Input {...field} placeholder="e.g. Help Us Improve" className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" />
                                </div>
                            )}
                        />
                    </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Controller
                            name="entityId"
                            control={control}
                            render={({ field }) => {
                                const [open, setOpen] = React.useState(false);
                                const [search, setSearch] = React.useState('');

                                const entityTypeConfig = {
                                    institution: { label: 'Institution', icon: Building, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
                                    family: { label: 'Family', icon: Users, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
                                    person: { label: 'Person', icon: User, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
                                    other: { label: 'Other', icon: Layout, color: 'text-slate-500', bgColor: 'bg-muted/100/10' },
                                };

                                // Normalize entities for searching and grouping
                                const normalizedEntities = (institutions || []).map(e => ({
                                    ...e,
                                    label: e.displayName || e.entityId || e.id || 'Unnamed Entity',
                                    type: (e.entityType || 'other').toLowerCase() as keyof typeof entityTypeConfig
                                }));

                                const filtered = normalizedEntities.filter(e =>
                                    e.label.toLowerCase().includes(search.toLowerCase())
                                );

                                const grouped = {
                                    institution: filtered.filter(e => e.type === 'institution'),
                                    family: filtered.filter(e => e.type === 'family'),
                                    person: filtered.filter(e => e.type === 'person'),
                                    other: filtered.filter(e => !['institution', 'family', 'person'].includes(e.type)),
                                };

                                const selectedEntity = normalizedEntities.find(e => e.entityId === field.value);
                                const selectedConfig = selectedEntity ? (entityTypeConfig[selectedEntity.type] || entityTypeConfig.other) : null;
                                const SelectedIcon = selectedConfig ? selectedConfig.icon : Building;

                                return (
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Associated Entity</Label>
                                        <Popover open={open} onOpenChange={setOpen}>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
 className={cn(
                                                        "w-full h-11 px-3 flex items-center gap-2.5 rounded-xl bg-muted/20 text-left font-bold text-sm",
                                                        "border-none shadow-none hover:bg-muted/30 transition-colors",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {selectedEntity ? (
                                                        <>
 <div className={cn("p-1 rounded-lg shrink-0", selectedConfig?.bgColor)}>
 <SelectedIcon className={cn("h-3.5 w-3.5", selectedConfig?.color)} />
                                                            </div>
 <span className="flex-1 truncate">{selectedEntity.label}</span>
                                                            <Badge variant="outline" className={cn("text-[9px] font-semibold uppercase shrink-0 border-0", selectedConfig?.bgColor, selectedConfig?.color)}>
                                                                {selectedConfig?.label}
                                                            </Badge>
                                                        </>
                                                    ) : (
                                                        <>
 <Building className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                                                            <span>Global / Generic</span>
                                                        </>
                                                    )}
                                                </button>
                                            </PopoverTrigger>
 <PopoverContent className="w-[320px] p-0 rounded-2xl shadow-2xl border border-border/50" align="start">
                                                <Command shouldFilter={false}>
                                                    <CommandInput
                                                        placeholder="Search entities..."
                                                        value={search}
                                                        onValueChange={setSearch}
 className="h-10"
                                                    />
 <CommandList className="max-h-[280px]">
 <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                                                            No entities found.
                                                        </CommandEmpty>
                                                        <CommandItem
                                                            value="none"
                                                            onSelect={() => {
                                                                field.onChange(null);
                                                                setValue('entityName', null, { shouldDirty: true });
                                                                setOpen(false);
                                                                setSearch('');
                                                            }}
 className={cn("rounded-xl mx-1 my-0.5 gap-2", !field.value && "bg-primary/5 text-primary")}
                                                        >
 <Building className="h-3.5 w-3.5 text-muted-foreground" />
 <span className="font-bold text-sm">Global / Generic</span>
                                                        </CommandItem>

                                                        {Object.entries(grouped).map(([type, entities]) => {
                                                            if (entities.length === 0) return null;
                                                            const config = entityTypeConfig[type as keyof typeof entityTypeConfig];
                                                            const GroupIcon = config.icon;
                                                            return (
                                                                <CommandGroup
                                                                    key={type}
                                                                    heading={
 <span className={cn("flex items-center gap-1.5 text-[9px] font-semibold ", config.color)}>
 <GroupIcon className="h-3 w-3" />
                                                                            {config.label}s
                                                                        </span>
                                                                    }
                                                                >
                                                                    {entities.map(entity => (
                                                                        <CommandItem
                                                                            key={entity.entityId || entity.id}
                                                                            value={entity.entityId || entity.id}
                                                                            onSelect={() => {
                                                                                field.onChange(entity.entityId);
                                                                                setValue('entityName', entity.label, { shouldDirty: true });
                                                                                setOpen(false);
                                                                                setSearch('');
                                                                            }}
 className={cn(
                                                                                "rounded-xl mx-1 my-0.5 gap-2",
                                                                                field.value === entity.entityId && "bg-primary/5 text-primary"
                                                                            )}
                                                                        >
 <div className={cn("p-0.5 rounded shrink-0", config.bgColor)}>
 <GroupIcon className={cn("h-3 w-3", config.color)} />
                                                                            </div>
 <span className="font-bold text-sm flex-1 truncate">{entity.label}</span>
                                                                            {field.value === entity.entityId && (
 <span className="text-primary text-[10px] font-semibold">✓</span>
                                                                            )}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            );
                                                        })}
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                );
                            }}
                        />
                        <Controller
                            name="useEntityLogo"
                            control={control}
                            render={({ field }) => (
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1 opacity-0">-</Label>
 <div className={cn(
                                        "flex items-center justify-between h-11 px-4 rounded-xl border-2 transition-all duration-300",
                                        field.value ? "border-primary/20 bg-primary/5" : "border-transparent bg-muted/20 grayscale opacity-40"
                                    )}>
 <div className="flex items-center gap-2">
 <Building className="h-4 w-4 text-primary" />
 <span className="text-[10px] font-semibold tracking-tight">Sync Entity Logo</span>
                                        </div>
                                        <Switch 
                                            disabled={!watch('entityId')}
                                            checked={field.value} 
                                            onCheckedChange={(checked) => {
                                                field.onChange(checked);
                                                if (checked) {
                                                    const entityId = watch('entityId');
                                                    const institution = institutions?.find(i => i.entityId === entityId);
                                                    const logo = institution?.logoUrl;
                                                    if (logo) setValue('logoUrl', logo, { shouldDirty: true });
                                                }
                                            }} 
                                        />
                                    </div>
                                </div>
                            )}
                        />
                    </div>
                    <Controller
                        name="description"
                        control={control}
                        render={({ field }) => (
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Introductory Prose</Label>
 <Textarea {...field} placeholder="Share the purpose of this audit..." className="min-h-[100px] rounded-xl bg-muted/20 border-none p-4 font-medium leading-relaxed shadow-inner" />
                            </div>
                        )}
                    />
                    <Controller
                        name="startButtonText"
                        control={control}
                        render={({ field }) => (
 <div className="space-y-3">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Start Button Label</Label>
                                <Input
                                    {...field}
                                    value={field.value || ''}
                                    placeholder="e.g. Start the 2-Minute Survey"
 className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"
                                />
 <div className="flex items-center gap-2 pt-1">
 <span className="text-[9px] font-bold text-muted-foreground/50 tracking-tighter ml-1">Preview:</span>
                                    <button
                                        type="button"
 className="inline-flex items-center gap-2 h-9 px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md transition-all whitespace-nowrap"
                                        style={{ width: 'fit-content' }}
                                    >
 {field.value?.trim() || "Let's Start"} <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                                    </button>
                                </div>
                            </div>
                        )}
                    />
                </CardContent>
            </Card>

            {/* Immersive Media Card */}
 <Card className="shadow-sm border-none ring-1 ring-border rounded-2xl overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6 px-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl">
 <Video className="h-5 w-5 text-primary" />
                        </div>
                        <div>
 <CardTitle className="text-sm font-semibold tracking-tight">Immersive Hero</CardTitle>
 <CardDescription className="text-[10px] font-bold text-muted-foreground/60">High-engagement video and cover assets.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
 <CardContent className="p-6 space-y-8">
 <div className="space-y-6">
                        <Controller
                            name="videoUrl"
                            control={control}
                            render={({ field }) => (
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Feature Video URL</Label>
 <Input {...field} value={field.value || ''} placeholder="YouTube, Vimeo, or direct MP4 link..." className="h-11 rounded-xl bg-muted/20 border-none font-bold" />
                                </div>
                            )}
                        />
                        <Controller
                            name="videoCaption"
                            control={control}
                            render={({ field }) => (
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-2">
 <MessageSquareText className="h-3 w-3" /> Call-to-Action Text
                                    </Label>
 <Input {...field} value={field.value || ''} placeholder="e.g. Watch our Director's Welcome" className="h-11 rounded-xl bg-muted/20 border-none font-bold" />
 <p className="text-[9px] font-bold text-muted-foreground/60 tracking-tighter ml-1 italic">Defaults to "Click to watch video" if empty.</p>
                                </div>
                            )}
                        />
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Controller
                                name="logoUrl"
                                control={control}
                                render={({ field }) => (
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-2">
 <ImageIcon className="h-3 w-3" /> Survey Brand Logo
                                        </Label>
                                        <MediaSelect 
                                            {...field} 
                                            filterType="image" 
 className="rounded-xl" 
                                            disabled={watch('useEntityLogo')}
                                        />
                                        {watch('useEntityLogo') && (
 <p className="text-[9px] font-bold text-primary tracking-tighter ml-1 italic">
                                                Branding is being managed by the associated entity.
                                            </p>
                                        )}
                                    </div>
                                )}
                            />
 <div className="grid grid-cols-1 gap-6">
                                <Controller
                                    name="videoThumbnailUrl"
                                    control={control}
                                    render={({ field }) => (
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Video Poster (Frame)</Label>
 <MediaSelect {...field} filterType="image" className="rounded-xl" />
                                        </div>
                                    )}
                                />
                            </div>
                        </div>
                        <Controller
                            name="bannerImageUrl"
                            control={control}
                            render={({ field }) => (
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Cover Image (Fallback)</Label>
 <MediaSelect {...field} filterType="image" className="rounded-xl" />
                                </div>
                            )}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Aesthetics Card */}
 <Card className="shadow-sm border-none ring-1 ring-border rounded-2xl overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6 px-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl">
 <Palette className="h-5 w-5 text-primary" />
                        </div>
                        <div>
 <CardTitle className="text-sm font-semibold tracking-tight">Visual Theme</CardTitle>
 <CardDescription className="text-[10px] font-bold text-muted-foreground/60">Customize the atmospheric design.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
 <CardContent className="p-6 space-y-6">
 <div className="grid grid-cols-2 gap-6">
                        <Controller
                            name="backgroundColor"
                            control={control}
                            render={({ field }) => (
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Base Color</Label>
 <div className="flex items-center gap-2 p-1.5 rounded-xl bg-muted/20 border shadow-inner">
 <Input type="color" {...field} className="w-10 h-10 p-0 border-none bg-transparent rounded-lg cursor-pointer" />
 <Input value={field.value} onChange={e => field.onChange(e.target.value)} className="h-8 border-none bg-transparent shadow-none font-mono text-[10px] font-semibold " />
                                    </div>
                                </div>
                            )}
                        />
                        <Controller
                            name="patternColor"
                            control={control}
                            render={({ field }) => (
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Pattern Tint</Label>
 <div className="flex items-center gap-2 p-1.5 rounded-xl bg-muted/20 border shadow-inner">
 <Input type="color" {...field} className="w-10 h-10 p-0 border-none bg-transparent rounded-lg cursor-pointer" />
 <Input value={field.value} onChange={e => field.onChange(e.target.value)} className="h-8 border-none bg-transparent shadow-none font-mono text-[10px] font-semibold " />
                                    </div>
                                </div>
                            )}
                        />
                    </div>
                    <Controller
                        name="backgroundPattern"
                        control={control}
                        render={({ field }) => (
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Overlay Pattern</Label>
                                <Select onValueChange={field.onChange} value={field.value || 'none'}>
 <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold">
                                        <SelectValue placeholder="Select pattern..." />
                                    </SelectTrigger>
 <SelectContent className="rounded-xl">
                                        <SelectItem value="none">Solid (None)</SelectItem>
                                        <SelectItem value="dots">Dots</SelectItem>
                                        <SelectItem value="grid">Grid</SelectItem>
                                        <SelectItem value="circuit">Circuit</SelectItem>
                                        <SelectItem value="topography">Topography</SelectItem>
                                        <SelectItem value="cubes">Cubes</SelectItem>
                                        <SelectItem value="gradient">Aura Gradient</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
