'use client';

import * as React from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Organization } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { saveOrganizationAction } from '@/lib/organization-actions';
import { Settings, Loader2, Save, X, Plus } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

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
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' }
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

    const [defaultLanguage, setDefaultLanguage] = React.useState(organization.settings?.defaultLanguage || 'en');
    const [defaultCountryCode, setDefaultCountryCode] = React.useState(organization.defaultCountryCode || 'GH');
    const [defaultCurrency, setDefaultCurrency] = React.useState(organization.settings?.defaultCurrency || 'USD');
    const [defaultTimezone, setDefaultTimezone] = React.useState(organization.settings?.defaultTimezone || 'UTC');
    const [defaultRoleId, setDefaultRoleId] = React.useState(organization.defaultRoleId || '');
    
    const [roles, setRoles] = React.useState<{ id: string; name: string }[]>([]);
    const [departments, setDepartments] = React.useState<string[]>(organization.departments && organization.departments.length > 0 ? organization.departments : ['General']);
    const [newDept, setNewDept] = React.useState('');

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

    const handleAddDepartment = () => {
        const cleanDept = newDept.trim();
        if (!cleanDept) return;

        if (cleanDept.length > 50) {
            toast({ variant: 'destructive', title: 'Department Name Too Long', description: 'Limit to 50 chars.' });
            return;
        }

        if (departments.some(d => d.toLowerCase() === cleanDept.toLowerCase())) {
            toast({ variant: 'destructive', title: 'Duplicate Department', description: `Already exists.` });
            return;
        }

        setDepartments([...departments, cleanDept]);
        setNewDept('');
    };

    const handleRemoveDepartment = (deptToRemove: string) => {
        setDepartments(departments.filter(d => d !== deptToRemove));
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
                    departments: departments.length > 0 ? departments : ['General']
                },
                user.uid
            );

            if (result.success) {
                toast({ title: 'Settings Saved', description: 'Regional details updated successfully.' });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
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
                                    {c.flag} {c.name}
                                </option>
                            ))}
                        </select>
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
                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Onboarding Departments</Label>
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
                            className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 flex-1 animate-none"
                        />
                        <Button
                            type="button"
                            onClick={handleAddDepartment}
                            className="h-11 rounded-xl font-semibold bg-primary text-white hover:bg-primary/90 px-5 shrink-0"
                        >
                            Add
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 p-4 rounded-2xl bg-muted/10 border border-border/50 min-h-[60px]">
                        {departments.map((dept, idx) => (
                            <Badge
                                key={dept}
                                variant="secondary"
                                className="pl-3 pr-2 py-1 bg-muted/50 border border-border rounded-xl text-xs font-semibold flex items-center gap-1.5 group hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-all animate-fade-in duration-300"
                                style={{ animationDelay: `${idx * 40}ms` }}
                            >
                                {dept}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveDepartment(dept)}
                                    className="w-4 h-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={isSaving} className="rounded-xl font-bold h-11 px-8 shadow-lg shadow-primary/10">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Settings
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
