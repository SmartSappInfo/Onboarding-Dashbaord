'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Search, Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { LeadSourceSelect } from '@/components/LeadSourceSelect';

interface DefaultValueRowProps {
    fieldKey: string;
    value: string;
    fieldLabel: string;
    onValueChange: (key: string, val: string) => void;
    onDelete: (key: string) => void;
    regionsList: any[] | null | undefined;
    districtsList: any[] | null | undefined;
    packagesList: any[] | null | undefined;
    modulesList: any[] | null | undefined;
    workspaceStatuses: any[];
    parentRegionValue?: string;
    customLeadSources?: string[];
    appFieldsList?: any[] | null;
}

export const DefaultValueRow = React.memo(({
    fieldKey,
    value,
    fieldLabel,
    onValueChange,
    onDelete,
    regionsList,
    districtsList,
    packagesList,
    modulesList,
    workspaceStatuses = [],
    parentRegionValue,
    customLeadSources,
    appFieldsList
}: DefaultValueRowProps) => {
    const firestore = useFirestore();
    const { activeWorkspace } = useWorkspace();
    const { toast } = useToast();

    const customField = React.useMemo(() => {
        if (!appFieldsList) return null;
        return appFieldsList.find((f: any) => f.variableName === fieldKey);
    }, [fieldKey, appFieldsList]);

    const regions = regionsList || [];
    const districts = districtsList || [];
    const packages = packagesList || [];
    const modules = modulesList || [];
    const [districtSearch, setDistrictSearch] = React.useState('');
    const [isCreatingDistrict, setIsCreatingDistrict] = React.useState(false);

    // Cascading district list calculation derived synchronously in render
    const filteredDistricts = React.useMemo(() => {
        if (fieldKey !== 'locationDistrict') return [];
        if (!parentRegionValue) return districts;
        const regionDoc = regions.find((r: any) => r.name?.toLowerCase().trim() === parentRegionValue.toLowerCase().trim());
        return regionDoc ? districts.filter((d: any) => d.regionId === regionDoc.id) : districts;
    }, [fieldKey, parentRegionValue, regions, districts]);

    // Parent region doc resolver
    const parentRegionDoc = React.useMemo(() => {
        if (!parentRegionValue) return null;
        return regions.find((r: any) => r.name?.toLowerCase().trim() === parentRegionValue.toLowerCase().trim());
    }, [parentRegionValue, regions]);

    // Filter districts by districtSearch
    const filteredDistrictsBySearch = React.useMemo(() => {
        const base = filteredDistricts.length > 0 ? filteredDistricts : districts;
        if (!districtSearch.trim()) return base;
        const q = districtSearch.toLowerCase();
        return base.filter((d: any) => d.name?.toLowerCase().includes(q));
    }, [filteredDistricts, districts, districtSearch]);

    // Check if district can be created
    const canCreateDistrict = React.useMemo(() => {
        if (!districtSearch.trim() || !parentRegionDoc) return false;
        const q = districtSearch.trim().toLowerCase();
        const base = filteredDistricts.length > 0 ? filteredDistricts : districts;
        return !base.some((d: any) => d.name?.toLowerCase() === q);
    }, [districtSearch, filteredDistricts, districts, parentRegionDoc]);

    const handleCreateDistrict = async () => {
        if (!firestore || !parentRegionDoc || !activeWorkspace || isCreatingDistrict) return;
        const name = districtSearch.trim();
        if (!name) return;

        setIsCreatingDistrict(true);
        try {
            const orgId = activeWorkspace?.organizationId || 'smartsapp-hq';
            await addDoc(collection(firestore, 'districts'), {
                name,
                regionId: parentRegionDoc.id,
                organizationId: orgId,
            });
            onValueChange('locationDistrict', name);
            setDistrictSearch('');
            toast({
                title: 'District Created',
                description: `"${name}" has been added to districts under region "${parentRegionValue}".`,
            });
        } catch (e: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: e.message || 'Failed to create district.',
            });
        } finally {
            setIsCreatingDistrict(false);
        }
    };

    // Handle cascading reset: if region changes and district is no longer in filtered list, we clear it!
    React.useEffect(() => {
        if (fieldKey === 'locationDistrict' && value && parentRegionValue) {
            const hasMatch = filteredDistricts.some((d: any) => d.name?.toLowerCase().trim() === value.toLowerCase().trim());
            if (!hasMatch && filteredDistricts.length > 0) {
                // Wipe orphaned district default
                onValueChange('locationDistrict', '');
            }
        }
    }, [filteredDistricts, fieldKey, value, parentRegionValue, onValueChange]);

    const renderInput = () => {
        if (customField) {
            switch (customField.type) {
                case 'select':
                case 'dropdown': {
                    return (
                        <Select value={value || undefined} onValueChange={val => onValueChange(fieldKey, val)}>
                            <SelectTrigger className="h-9 text-xs bg-background rounded-xl border border-border/40 backdrop-blur-md shadow-sm hover:border-border/80 transition-all">
                                <SelectValue placeholder={customField.placeholder || "Select option..."} />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl bg-background/95 backdrop-blur-md border border-border/40 shadow-lg max-h-[250px]">
                                {(customField.options || []).map((opt: any) => (
                                    <SelectItem key={opt.value} value={opt.value} className="font-semibold text-xs py-2">
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    );
                }
                case 'multi_select': {
                    const selectedList = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
                    const options = (customField.options || []).map((opt: any) => ({
                        label: opt.label,
                        value: opt.value,
                        color: '#3B5FFF'
                    }));

                    return (
                        <div className="min-w-0">
                            <MultiSelect
                                options={options}
                                value={selectedList}
                                onChange={(selectedValues) => {
                                    onValueChange(fieldKey, selectedValues.join(', '));
                                }}
                                placeholder={customField.placeholder || "Select options..."}
                            />
                        </div>
                    );
                }
                case 'number':
                case 'currency': {
                    return (
                        <Input 
                            value={value} 
                            onChange={e => onValueChange(fieldKey, e.target.value)}
                            type="number"
                            placeholder={customField.placeholder || "Enter number..."}
                            className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                        />
                    );
                }
                case 'date': {
                    return (
                        <Input 
                            value={value} 
                            onChange={e => onValueChange(fieldKey, e.target.value)}
                            type="date"
                            className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                        />
                    );
                }
                case 'datetime': {
                    return (
                        <Input 
                            value={value} 
                            onChange={e => onValueChange(fieldKey, e.target.value)}
                            type="datetime-local"
                            className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                        />
                    );
                }
                default: {
                    return (
                        <Input 
                            value={value} 
                            onChange={e => onValueChange(fieldKey, e.target.value)}
                            placeholder={customField.placeholder || "Enter default value..."}
                            className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                        />
                    );
                }
            }
        }

        switch (fieldKey) {
            case 'locationRegion': {
                if (regions.length === 0) {
                    return (
                        <Input 
                            value={value} 
                            onChange={e => onValueChange(fieldKey, e.target.value)}
                            placeholder="Enter region..."
                            className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                        />
                    );
                }
                return (
                    <Select value={value || undefined} onValueChange={val => onValueChange(fieldKey, val)}>
                        <SelectTrigger className="h-9 text-xs bg-background rounded-xl border border-border/40 backdrop-blur-md shadow-sm hover:border-border/80 transition-all">
                            <SelectValue placeholder="Select region..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-[250px] bg-background/95 backdrop-blur-md border border-border/40 shadow-lg">
                            {regions.map((r: any) => (
                                <SelectItem key={r.id} value={r.name} className="font-semibold text-xs py-2">
                                    {r.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            }
            case 'locationDistrict': {
                if (districts.length === 0) {
                    return (
                        <Input 
                            value={value} 
                            onChange={e => onValueChange(fieldKey, e.target.value)}
                            placeholder="Enter district..."
                            className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                        />
                    );
                }
                const isDistrictDisabled = !parentRegionValue;

                return (
                    <Select
                        value={value || undefined}
                        onValueChange={val => {
                            if (val === '__clear__') {
                                onValueChange(fieldKey, '');
                                return;
                            }
                            if (val === '__create__') {
                                handleCreateDistrict();
                                return;
                            }
                            onValueChange(fieldKey, val);
                        }}
                        disabled={isDistrictDisabled}
                    >
                        <SelectTrigger className="h-9 text-xs bg-background rounded-xl border border-border/40 backdrop-blur-md shadow-sm hover:border-border/80 transition-all">
                            <SelectValue placeholder={parentRegionValue ? "Select district..." : "Select region first..."} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-[280px] bg-background/95 backdrop-blur-md border border-border/40 shadow-lg">
                            {/* Search */}
                            <div className="px-2 pb-2 pt-1 sticky top-0 bg-popover z-10 border-b border-border/20">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Search or create district…"
                                        value={districtSearch}
                                        onChange={(e) => setDistrictSearch(e.target.value)}
                                        className="h-8 pl-7 rounded-lg text-[11px] bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-primary/20"
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => {
                                            e.stopPropagation();
                                            if (e.key === 'Enter' && canCreateDistrict) {
                                                e.preventDefault();
                                                handleCreateDistrict();
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {value && (
                                <SelectItem value="__clear__" className="text-xs text-muted-foreground italic py-1.5">
                                    Clear selection
                                </SelectItem>
                            )}

                            {/* Inline create option */}
                            {canCreateDistrict && (
                                <SelectItem value="__create__" className="text-primary font-bold text-xs py-2">
                                    <span className="flex items-center gap-2">
                                        {isCreatingDistrict ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Plus className="h-3 w-3" />
                                        )}
                                        <span>Create &ldquo;{districtSearch.trim()}&rdquo;</span>
                                    </span>
                                </SelectItem>
                            )}

                            <SelectGroup>
                                {filteredDistrictsBySearch.length === 0 && !canCreateDistrict ? (
                                    <div className="text-center py-4 text-xs text-muted-foreground">
                                        No districts found. Type to create one.
                                    </div>
                                ) : (
                                    filteredDistrictsBySearch.map((d: any) => (
                                        <SelectItem key={d.id} value={d.name} className="font-semibold text-xs py-2">
                                            {d.name}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                );
            }
            case 'subscriptionPackageName':
            case 'package': {
                if (packages.length === 0) {
                    return (
                        <Input 
                            value={value} 
                            onChange={e => onValueChange(fieldKey, e.target.value)}
                            placeholder="Enter package name..."
                            className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                        />
                    );
                }
                return (
                    <Select value={value || undefined} onValueChange={val => onValueChange(fieldKey, val)}>
                        <SelectTrigger className="h-9 text-xs bg-background rounded-xl border border-border/40 backdrop-blur-md shadow-sm hover:border-border/80 transition-all">
                            <SelectValue placeholder="Select subscription package..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl bg-background/95 backdrop-blur-md border border-border/40 shadow-lg">
                            {packages.map((p: any) => (
                                <SelectItem key={p.id} value={p.name} className="font-semibold text-xs py-2">
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            }
            case 'interests': {
                if (modules.length === 0) {
                    return (
                        <Input 
                            value={value} 
                            onChange={e => onValueChange(fieldKey, e.target.value)}
                            placeholder="Enter interests (comma separated)..."
                            className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                        />
                    );
                }
                const selectedList = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
                const options = modules.map((m: any) => ({
                    label: m.name,
                    value: m.name,
                    color: m.color || '#3B5FFF'
                }));

                return (
                    <div className="min-w-0">
                        <MultiSelect
                            options={options}
                            value={selectedList}
                            onChange={(selectedValues) => {
                                onValueChange('interests', selectedValues.join(', '));
                            }}
                            placeholder="Select interests..."
                        />
                    </div>
                );
            }
            case 'status': {
                return (
                    <Select value={value || undefined} onValueChange={val => onValueChange(fieldKey, val)}>
                        <SelectTrigger className="h-9 text-xs bg-background rounded-xl border border-border/40 backdrop-blur-md shadow-sm hover:border-border/80 transition-all">
                            <SelectValue placeholder="Select status..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl bg-background/95 backdrop-blur-md border border-border/40 shadow-lg">
                            <SelectItem value="active" className="font-semibold text-xs py-2">Active</SelectItem>
                            <SelectItem value="inactive" className="font-semibold text-xs py-2">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                );
            }
            case 'currency': {
                const currencies = ['GHS', 'USD', 'EUR', 'GBP', 'NGN'];
                return (
                    <Select value={value || undefined} onValueChange={val => onValueChange(fieldKey, val)}>
                        <SelectTrigger className="h-9 text-xs bg-background rounded-xl border border-border/40 backdrop-blur-md shadow-sm hover:border-border/80 transition-all">
                            <SelectValue placeholder="Select currency..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl bg-background/95 backdrop-blur-md border border-border/40 shadow-lg">
                            {currencies.map(c => (
                                <SelectItem key={c} value={c} className="font-semibold text-xs py-2">{c}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            }
            case 'leadSource': {
                return (
                    <LeadSourceSelect 
                        value={value} 
                        onValueChange={val => onValueChange(fieldKey, val)}
                        className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                    />
                );
            }
            default:
                return (
                    <Input 
                        value={value} 
                        onChange={e => onValueChange(fieldKey, e.target.value)}
                        placeholder="Enter default value..."
                        className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                    />
                );
        }
    };

    return (
        <motion.div 
            layout
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-2 p-4 rounded-2xl border border-border/40 bg-muted/20 backdrop-blur-sm shadow-sm relative group hover:border-border hover:shadow transition-all"
        >
            <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {fieldLabel}
                </Label>
                <button 
                    onClick={() => onDelete(fieldKey)} 
                    className="text-muted-foreground/60 hover:text-rose-500 transition-colors p-1 hover:bg-rose-50 rounded-lg"
                    title="Remove default value"
                >
                    <X size={14} />
                </button>
            </div>
            {renderInput()}
        </motion.div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.value === nextProps.value &&
        prevProps.fieldLabel === nextProps.fieldLabel &&
        prevProps.parentRegionValue === nextProps.parentRegionValue &&
        prevProps.regionsList?.length === nextProps.regionsList?.length &&
        prevProps.districtsList?.length === nextProps.districtsList?.length &&
        prevProps.packagesList?.length === nextProps.packagesList?.length &&
        prevProps.modulesList?.length === nextProps.modulesList?.length &&
        prevProps.workspaceStatuses?.length === nextProps.workspaceStatuses?.length &&
        prevProps.customLeadSources?.length === nextProps.customLeadSources?.length &&
        prevProps.appFieldsList?.length === nextProps.appFieldsList?.length
    );
});

DefaultValueRow.displayName = 'DefaultValueRow';
