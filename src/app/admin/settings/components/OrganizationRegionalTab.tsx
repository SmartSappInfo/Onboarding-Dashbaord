'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Organization, Department } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { saveOrganizationAction } from '@/lib/organization-actions';
import { createOrUpdateDepartmentAction, deleteDepartmentAction } from '@/app/actions/workforce-actions';
import { Settings, Loader2, Save, X, ShieldCheck, RefreshCw, Building2, ExternalLink } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { getErrorMessage } from '@/lib/errors/report-error';
import { reconcilePhoneHygieneAction } from '@/lib/phone-hygiene-actions';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' }
];

const COUNTRIES = [
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', dial: '+233' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', dial: '+234' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', dial: '+254' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', dial: '+27' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dial: '+44' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dial: '+1' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dial: '+1' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dial: '+61' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dial: '+49' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dial: '+33' },
  { code: 'IN', name: 'India', flag: '🇮🇳', dial: '+91' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', dial: '+55' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', dial: '+971' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', dial: '+20' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', dial: '+250' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', dial: '+256' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', dial: '+255' },
];

const IANA_TIMEZONES: string[] = (() => {
    try {
        return Intl.supportedValuesOf('timeZone');
    } catch {
        return ['UTC', 'Africa/Accra', 'Africa/Lagos', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'];
    }
})();

interface OrganizationRegionalTabProps {
    organization: Organization;
}

export default function OrganizationRegionalTab({ organization }: OrganizationRegionalTabProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);
    const [isReconciling, setIsReconciling] = React.useState(false);

    const [defaultLanguage, setDefaultLanguage] = React.useState(organization.settings?.defaultLanguage || 'en');
    const [defaultCountryCode, setDefaultCountryCode] = React.useState(organization.defaultCountryCode || 'GH');
    const [defaultCurrency, setDefaultCurrency] = React.useState(organization.settings?.defaultCurrency || 'USD');
    const [defaultTimezone, setDefaultTimezone] = React.useState(organization.settings?.defaultTimezone || 'UTC');
    const [defaultRoleId, setDefaultRoleId] = React.useState(organization.defaultRoleId || '');
    
    const [roles, setRoles] = React.useState<{ id: string; name: string }[]>([]);
    const [departments, setDepartments] = React.useState<Department[]>([]);
    const [isLoadingDepts, setIsLoadingDepts] = React.useState(true);
    const [newDept, setNewDept] = React.useState('');
    const [isAddingDept, setIsAddingDept] = React.useState(false);
    const [deletingDeptId, setDeletingDeptId] = React.useState<string | null>(null);

    const activeCountry = React.useMemo(() => {
        return COUNTRIES.find(c => c.code === defaultCountryCode) || { code: defaultCountryCode, name: defaultCountryCode, flag: '🌐', dial: '' };
    }, [defaultCountryCode]);

    const loadDepartments = React.useCallback(async () => {
        if (!firestore || !organization.id) return;
        setIsLoadingDepts(true);
        try {
            const q = query(collection(firestore, 'departments'), where('organizationId', '==', organization.id));
            const snap = await getDocs(q);
            const list: Department[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Department));
            list.sort((a, b) => a.name.localeCompare(b.name));
            setDepartments(list);
        } catch (err) {
            console.error('[OrganizationRegionalTab] Error loading canonical departments:', err);
        } finally {
            setIsLoadingDepts(false);
        }
    }, [firestore, organization.id]);

    React.useEffect(() => {
        loadDepartments();
    }, [loadDepartments]);

    React.useEffect(() => {
        async function loadRoles() {
            if (!firestore || !organization.id) return;
            try {
                const q = query(collection(firestore, 'roles'), where('organizationId', '==', organization.id));
                const snap = await getDocs(q);
                const roleList = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
                setRoles(roleList);
            } catch (err) {
                console.error('Error loading roles:', err);
            }
        }
        loadRoles();
    }, [firestore, organization.id]);

    const handleAddDepartment = async () => {
        const cleanDept = newDept.trim();
        if (!cleanDept) return;

        if (cleanDept.length > 50) {
            toast({ variant: 'destructive', title: 'Department Name Too Long', description: 'Limit to 50 chars.' });
            return;
        }

        if (departments.some(d => d.name.toLowerCase() === cleanDept.toLowerCase())) {
            toast({ variant: 'destructive', title: 'Duplicate Department', description: `Already exists.` });
            return;
        }

        if (!user) return;
        setIsAddingDept(true);
        try {
            const idToken = await user.getIdToken();
            const code = cleanDept.substring(0, 4).toUpperCase();
            const res = await createOrUpdateDepartmentAction({
                idToken,
                organizationId: organization.id,
                data: {
                    name: cleanDept,
                    code,
                }
            });

            if (res.success && res.department) {
                toast({ title: 'Department Added', description: `${res.department.name} [${res.department.code}] added to organizational blueprint.` });
                setNewDept('');
                await loadDepartments();
            } else {
                throw new Error(res.error || 'Failed to add department');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error creating department';
            toast({ variant: 'destructive', title: 'Could Not Add Department', description: msg });
        } finally {
            setIsAddingDept(false);
        }
    };

    const handleRemoveDepartment = async (dept: Department) => {
        if (!user) return;
        setDeletingDeptId(dept.id);
        try {
            const idToken = await user.getIdToken();
            const res = await deleteDepartmentAction({
                idToken,
                organizationId: organization.id,
                departmentId: dept.id,
            });

            if (res.success) {
                toast({ title: 'Department Removed', description: `${dept.name} removed from organization.` });
                await loadDepartments();
            } else {
                throw new Error(res.error || 'Failed to delete department');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error removing department';
            toast({ variant: 'destructive', title: 'Cannot Delete Department', description: msg });
        } finally {
            setDeletingDeptId(null);
        }
    };

    const handleReconcileHygiene = async () => {
        if (!organization.id || isReconciling) return;
        setIsReconciling(true);
        try {
            const result = await reconcilePhoneHygieneAction(organization.id);
            if (result.success) {
                toast({
                    title: 'Phone Hygiene Re-scanned',
                    description: result.message,
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Re-scan Failed',
                    description: result.error || result.message,
                });
            }
        } catch (err: unknown) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: getErrorMessage(err),
            });
        } finally {
            setIsReconciling(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            const result = await saveOrganizationAction(
                organization.id,
                {
                    settings: {
                        defaultCurrency,
                        defaultTimezone,
                        defaultLanguage,
                    },
                    defaultCountryCode,
                    defaultRoleId,
                    // `departments` is deliberately not sent. The server keeps
                    // organizations/{id}.departments in step with the departments collection
                    // on every add, rename and delete. Sending this tab's list could wipe the
                    // legacy names of an organization with no canonical departments yet.
                }
            );

            if (result.success) {
                toast({ title: 'Settings Saved', description: 'Regional details updated successfully.' });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
            }
        } catch (error: unknown) {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden">
            <CardHeader className="p-8 border-b">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    Regional settings
                </CardTitle>
                <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                    Customize language, defaults, and selectable departments for your team members
                </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                            Default Language
                        </Label>
                        <select
                            value={defaultLanguage}
                            onChange={e => setDefaultLanguage(e.target.value)}
                            className="h-11 w-full rounded-xl bg-muted/20 border-none shadow-inner font-semibold px-4 text-sm"
                        >
                            {LANGUAGES.map(lang => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.flag} {lang.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                            Default Country
                        </Label>
                        <select 
                            value={defaultCountryCode}
                            onChange={e => setDefaultCountryCode(e.target.value)}
                            className="h-11 w-full rounded-xl bg-muted/20 border-none shadow-inner font-semibold px-4 text-sm"
                        >
                            {COUNTRIES.map(c => (
                                <option key={c.code} value={c.code}>
                                    {c.flag} {c.name} ({c.dial})
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 mt-1">
                            <span>{activeCountry.flag}</span>
                            <span>Calling Code: <strong className="text-foreground">{activeCountry.dial || 'Universal'}</strong></span>
                            <span className="text-muted-foreground/60">• Used for domestic contact numbers</span>
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                            Currency
                        </Label>
                        <Input 
                            value={defaultCurrency} 
                            onChange={e => setDefaultCurrency(e.target.value)} 
                            placeholder="USD" 
                            className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-semibold px-4" 
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                            Timezone
                        </Label>
                        <select 
                            value={defaultTimezone}
                            onChange={e => setDefaultTimezone(e.target.value)}
                            className="h-11 w-full rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 text-sm"
                        >
                            {IANA_TIMEZONES.map(tz => (
                                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                        Default Provisioning Role (New Invites)
                    </Label>
                    <select 
                        value={defaultRoleId}
                        onChange={e => setDefaultRoleId(e.target.value)}
                        className="h-11 w-full rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 text-sm"
                    >
                        <option value="">No Default (Manual Selection Required)</option>
                        {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>

                <Separator className="opacity-50" />

                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Onboarding Departments</Label>
                            <p className="text-xs text-muted-foreground">Canonical departments selectable during onboarding and team assignments.</p>
                        </div>
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="text-xs text-primary hover:text-primary/90 h-8 gap-1.5 font-medium shrink-0 active:scale-[0.97] transition-all"
                        >
                            <Link href="/admin/users?tab=teams">
                                <Building2 className="w-3.5 h-3.5" />
                                Manage in Users Hub
                                <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                            </Link>
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Input
                            value={newDept}
                            onChange={e => setNewDept(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddDepartment();
                                }
                            }}
                            placeholder="Add department (e.g. Sales, Marketing)..."
                            disabled={isAddingDept}
                            className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 flex-1 animate-none text-sm"
                        />
                        <Button
                            type="button"
                            onClick={handleAddDepartment}
                            disabled={isAddingDept || !newDept.trim()}
                            className="h-11 rounded-xl font-semibold bg-primary text-white hover:bg-primary/90 px-5 shrink-0 min-h-[44px] active:scale-[0.97] transition-all"
                        >
                            {isAddingDept ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 p-4 rounded-2xl bg-muted/10 border border-border/50 min-h-[60px]">
                        {isLoadingDepts ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                Loading organizational departments...
                            </div>
                        ) : departments.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">No departments provisioned yet.</p>
                        ) : (
                            departments.map((dept, idx) => (
                                <Badge
                                    key={dept.id}
                                    variant="secondary"
                                    className="pl-2.5 pr-2 py-1 bg-muted/50 border border-border rounded-xl text-xs font-semibold flex items-center gap-1.5 group hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-all"
                                    style={{ animationDelay: `${idx * 40}ms` }}
                                >
                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                        {dept.code}
                                    </span>
                                    <span>{dept.name}</span>
                                    {dept.memberCount > 0 && (
                                        <span className="text-[10px] text-muted-foreground font-normal">
                                            ({dept.memberCount} {dept.memberCount === 1 ? 'member' : 'members'})
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveDepartment(dept)}
                                        disabled={deletingDeptId === dept.id}
                                        title={dept.memberCount > 0 ? "Cannot delete department with active members" : `Remove ${dept.name}`}
                                        className="w-4 h-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-50"
                                    >
                                        {deletingDeptId === dept.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <X className="w-3 h-3" />
                                        )}
                                    </button>
                                </Badge>
                            ))
                        )}
                    </div>
                </div>

                <Separator className="opacity-50" />

                <div className="rounded-2xl border border-border/60 bg-muted/10 p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h4 className="text-sm font-bold flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                Phone Hygiene & Deliverability
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Re-evaluate contacts whose numbers were marked invalid due to missing country prefixes or stale cache records.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleReconcileHygiene}
                            disabled={isReconciling}
                            className="min-h-[44px] px-4 font-bold rounded-xl border border-border shadow-sm active:scale-[0.97] transition-all shrink-0"
                        >
                            {isReconciling ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Scanning Cache...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Re-scan Phone Hygiene
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={isSaving} className="rounded-xl font-bold h-11 px-8 shadow-lg shadow-primary/10 active:scale-[0.97] transition-all">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Settings
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
