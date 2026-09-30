'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MultiSelect } from '@/components/ui/multi-select';
import { Checkbox } from '@/components/ui/checkbox';
import { inviteUserAction } from '@/lib/user-invite-actions';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { UserPlus, Mail, Phone, MessageSquare, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const inviteSchema = z.object({
    fullName: z.string().min(2, 'Please enter a name'),
    email: z.string().email('Please enter a valid email address'),
    phone: z.string().optional(),
    department: z.string().optional(),
    departmentId: z.string().optional(),
    workspaceIds: z.array(z.string()).min(1, 'Select at least one workspace'),
    roles: z.array(z.string()).min(1, 'Select at least one role'),
    sendMethods: z.array(z.enum(['email', 'sms', 'whatsapp'])).min(1, 'Select at least one invite method'),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface NormalizedDept {
    id: string;
    name: string;
    code?: string;
}

interface InviteUserModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roles: { id: string; name: string }[];
    departments?: Array<string | { id: string; name: string; code?: string }>;
    workspaces?: { id: string; name: string }[];
}

export default function InviteUserModal({ open, onOpenChange, roles, departments, workspaces }: InviteUserModalProps) {
    const { toast } = useToast();
    const { activeOrganizationId, activeOrganization, activeWorkspaceId, activeWorkspace, accessibleWorkspaces } = useTenant();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isCustomDept, setIsCustomDept] = React.useState(false);

    // Compute available departments ONLY from current organization (no sample fallbacks)
    const availableDepartments: NormalizedDept[] = React.useMemo(() => {
        if (departments && departments.length > 0) {
            return departments.map((d) =>
                typeof d === 'string'
                    ? { id: d, name: d, code: d.slice(0, 4).toUpperCase() }
                    : { id: d.id, name: d.name, code: d.code }
            );
        }
        if (activeOrganization?.departments && activeOrganization.departments.length > 0) {
            return activeOrganization.departments.map((d) => ({
                id: d,
                name: d,
                code: d.slice(0, 4).toUpperCase(),
            }));
        }
        return [];
    }, [departments, activeOrganization?.departments]);

    // Compute available workspaces from props, tenant context, or active workspace
    const availableWorkspaces = React.useMemo(() => {
        if (workspaces && workspaces.length > 0) return workspaces;
        if (accessibleWorkspaces && accessibleWorkspaces.length > 0) {
            return accessibleWorkspaces.map(w => ({ id: w.id, name: w.name }));
        }
        if (activeWorkspace) {
            return [{ id: activeWorkspace.id, name: activeWorkspace.name }];
        }
        return [];
    }, [workspaces, accessibleWorkspaces, activeWorkspace]);

    const form = useForm<InviteFormData>({
        resolver: zodResolver(inviteSchema),
        defaultValues: {
            fullName: '',
            email: '',
            phone: '',
            department: availableDepartments[0]?.name || '',
            departmentId: availableDepartments[0]?.id || '',
            workspaceIds: activeWorkspaceId ? [activeWorkspaceId] : (availableWorkspaces[0]?.id ? [availableWorkspaces[0].id] : []),
            roles: activeOrganization?.defaultRoleId ? [activeOrganization.defaultRoleId] : [],
            sendMethods: ['email'],
        }
    });

    // Sync default role if it changes or loads after mount
    React.useEffect(() => {
        if (activeOrganization?.defaultRoleId && form.getValues('roles').length === 0) {
            form.setValue('roles', [activeOrganization.defaultRoleId]);
        }
    }, [activeOrganization?.defaultRoleId, form]);

    // Sync default workspace if not set
    React.useEffect(() => {
        if (activeWorkspaceId && form.getValues('workspaceIds').length === 0) {
            form.setValue('workspaceIds', [activeWorkspaceId]);
        }
    }, [activeWorkspaceId, form]);

    // Sync default department if available
    React.useEffect(() => {
        if (!form.getValues('department') && availableDepartments.length > 0) {
            form.setValue('department', availableDepartments[0].name);
            form.setValue('departmentId', availableDepartments[0].id);
        }
    }, [availableDepartments, form]);

    const onSubmit = async (data: InviteFormData) => {
        if (!activeOrganizationId) return;
        setIsSubmitting(true);
        try {
            // Map the selected roles to each chosen workspace
            const workspaceRoles: Record<string, string[]> = {};
            data.workspaceIds.forEach(wsId => {
                workspaceRoles[wsId] = data.roles;
            });

            const result = await inviteUserAction({
                fullName: data.fullName.trim(),
                email: data.email.trim(),
                phone: data.phone?.trim() || undefined,
                department: data.department?.trim() || undefined,
                departmentId: data.departmentId?.trim() || undefined,
                workspaceIds: data.workspaceIds,
                workspaceRoles,
                organizationId: activeOrganizationId,
                sendMethods: data.sendMethods,
            });

            if (result.success) {
                if (result.warnings && result.warnings.length > 0) {
                    toast({ 
                        variant: 'destructive', 
                        title: 'User Added with Warning', 
                        description: result.warnings.join('. ') 
                    });
                } else {
                    toast({ 
                        title: 'Invite Sent', 
                        description: `Invitation sent to ${data.email}.` 
                    });
                }
                onOpenChange(false);
                form.reset();
            } else {
                throw new Error(result.error);
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Failed to send invite';
            toast({ variant: 'destructive', title: 'Could Not Send Invite', description: msg });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] rounded-2xl border border-border shadow-xl p-0 overflow-hidden bg-card text-card-foreground">
                <DialogHeader className="p-6 pb-4 bg-card border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted text-foreground rounded-xl border border-border shrink-0">
                            <UserPlus className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold tracking-tight text-foreground">Add User</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground font-normal mt-0.5">
                                Send an invite to join your organization.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="fullName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-semibold text-foreground">Full Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. John Doe" className="rounded-xl h-10 bg-background border-border text-foreground placeholder:text-muted-foreground text-sm" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-semibold text-foreground">Email</FormLabel>
                                            <FormControl>
                                                <Input type="email" placeholder="name@company.com" className="rounded-xl h-10 bg-background border-border text-foreground placeholder:text-muted-foreground text-sm" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold text-foreground">Phone Number (Optional)</FormLabel>
                                        <FormControl>
                                            <Input type="tel" placeholder="e.g. 024 412 3456" className="rounded-xl h-10 bg-background border-border text-foreground placeholder:text-muted-foreground text-sm" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="department"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center justify-between">
                                                <FormLabel className="text-xs font-semibold text-foreground">
                                                    Department (Optional)
                                                </FormLabel>
                                                {availableDepartments.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsCustomDept(!isCustomDept);
                                                            if (!isCustomDept) {
                                                                field.onChange('');
                                                                form.setValue('departmentId', '');
                                                            } else {
                                                                field.onChange(availableDepartments[0]?.name || '');
                                                                form.setValue('departmentId', availableDepartments[0]?.id || '');
                                                            }
                                                        }}
                                                        className="text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                                    >
                                                        {isCustomDept ? 'Choose from list' : '+ New Department'}
                                                    </button>
                                                )}
                                            </div>

                                            {!isCustomDept && availableDepartments.length > 0 ? (
                                                <Select
                                                    value={form.watch('departmentId') || field.value || undefined}
                                                    onValueChange={(val) => {
                                                        const match = availableDepartments.find((d) => d.id === val || d.name === val);
                                                        if (match) {
                                                            field.onChange(match.name);
                                                            form.setValue('departmentId', match.id);
                                                        } else {
                                                            field.onChange(val);
                                                            form.setValue('departmentId', '');
                                                        }
                                                    }}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className="rounded-xl h-10 min-h-[44px] bg-background border-border text-foreground text-sm">
                                                            <SelectValue placeholder="Select department" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="rounded-xl border-border bg-popover text-popover-foreground">
                                                        {availableDepartments.map((dept) => (
                                                            <SelectItem key={dept.id || dept.name} value={dept.id || dept.name}>
                                                                <div className="flex items-center gap-2">
                                                                    {dept.code && (
                                                                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                                                            {dept.code}
                                                                        </span>
                                                                    )}
                                                                    <span>{dept.name}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <FormControl>
                                                    <Input
                                                        placeholder={availableDepartments.length === 0 ? "e.g. Sales, Operations" : "Enter department name..."}
                                                        className="rounded-xl h-10 min-h-[44px] bg-background border-border text-foreground placeholder:text-muted-foreground text-sm"
                                                        value={field.value || ''}
                                                        onChange={(e) => {
                                                            field.onChange(e.target.value);
                                                            form.setValue('departmentId', '');
                                                        }}
                                                    />
                                                </FormControl>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="workspaceIds"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-semibold text-foreground">
                                                Workspaces
                                            </FormLabel>
                                            <MultiSelect
                                                options={availableWorkspaces.map((w) => ({ label: w.name, value: w.id }))}
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder="Select workspaces..."
                                                className="rounded-xl border-border bg-background min-h-10 hover:bg-background text-xs"
                                            />
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="roles"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold text-foreground">
                                            Roles
                                        </FormLabel>
                                        <MultiSelect
                                            options={roles.map((r) => ({ label: r.name, value: r.id }))}
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Select roles..."
                                            className="rounded-xl border-border bg-background min-h-10 hover:bg-background text-xs"
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Separator className="border-border" />

                            <div className="space-y-2.5">
                                <FormLabel className="text-xs font-semibold text-foreground">
                                    Send Invite Via
                                </FormLabel>
                                <div className="grid grid-cols-3 gap-2.5">
                                    <FormField
                                        control={form.control}
                                        name="sendMethods"
                                        render={({ field }) => {
                                            const isChecked = field.value.includes('email');
                                            return (
                                                <FormItem className={cn(
                                                    "flex items-center space-x-2 space-y-0 p-3 rounded-xl border transition-all cursor-pointer",
                                                    isChecked 
                                                        ? "border-foreground/40 bg-muted/60 text-foreground font-semibold shadow-xs" 
                                                        : "border-border bg-background text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                                )}>
                                                    <FormControl>
                                                        <Checkbox 
                                                            checked={isChecked}
                                                            onCheckedChange={(checked) => {
                                                                const val = checked ? [...field.value, 'email'] : field.value.filter(v => v !== 'email');
                                                                field.onChange(val);
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <Mail className="h-3.5 w-3.5 shrink-0 text-foreground" />
                                                        <span className="text-xs font-medium truncate">Email</span>
                                                    </div>
                                                </FormItem>
                                            );
                                        }}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="sendMethods"
                                        render={({ field }) => {
                                            const isChecked = field.value.includes('sms');
                                            const isDisabled = !form.watch('phone');
                                            return (
                                                <FormItem className={cn(
                                                    "flex items-center space-x-2 space-y-0 p-3 rounded-xl border transition-all",
                                                    isDisabled 
                                                        ? "opacity-50 cursor-not-allowed border-border bg-muted/10 text-muted-foreground" 
                                                        : isChecked
                                                            ? "cursor-pointer border-foreground/40 bg-muted/60 text-foreground font-semibold shadow-xs"
                                                            : "cursor-pointer border-border bg-background text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                                )}>
                                                    <FormControl>
                                                        <Checkbox 
                                                            checked={isChecked}
                                                            disabled={isDisabled}
                                                            onCheckedChange={(checked) => {
                                                                const val = checked ? [...field.value, 'sms'] : field.value.filter(v => v !== 'sms');
                                                                field.onChange(val);
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <Phone className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="text-xs font-medium truncate">SMS</span>
                                                    </div>
                                                </FormItem>
                                            );
                                        }}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="sendMethods"
                                        render={({ field }) => {
                                            const isChecked = field.value.includes('whatsapp');
                                            const isDisabled = !form.watch('phone');
                                            return (
                                                <FormItem className={cn(
                                                    "flex items-center space-x-2 space-y-0 p-3 rounded-xl border transition-all",
                                                    isDisabled 
                                                        ? "opacity-50 cursor-not-allowed border-border bg-muted/10 text-muted-foreground" 
                                                        : isChecked
                                                            ? "cursor-pointer border-foreground/40 bg-muted/60 text-foreground font-semibold shadow-xs"
                                                            : "cursor-pointer border-border bg-background text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                                )}>
                                                    <FormControl>
                                                        <Checkbox 
                                                            checked={isChecked}
                                                            disabled={isDisabled}
                                                            onCheckedChange={(checked) => {
                                                                const val = checked ? [...field.value, 'whatsapp'] : field.value.filter(v => v !== 'whatsapp');
                                                                field.onChange(val);
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="text-xs font-medium truncate">WhatsApp</span>
                                                    </div>
                                                </FormItem>
                                            );
                                        }}
                                    />
                                </div>
                            </div>
                        </form>
                    </Form>
                </div>

                <DialogFooter className="p-6 py-4 bg-muted/20 border-t border-border gap-2.5">
                    <Button 
                        type="button"
                        variant="outline" 
                        className="rounded-xl px-4 h-10 text-sm font-medium border-border hover:bg-muted active:scale-[0.97]" 
                        onClick={() => onOpenChange(false)} 
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button 
                        type="button"
                        onClick={form.handleSubmit(onSubmit)} 
                        className="rounded-xl px-5 h-10 text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 shadow-xs active:scale-[0.97] transition-all" 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...
                            </>
                        ) : (
                            'Send Invite'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
