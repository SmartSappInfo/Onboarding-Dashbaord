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
import { UserPlus, Mail, Phone, MessageSquare, Loader2, Sparkles, Building2, Briefcase, ShieldCheck } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const inviteSchema = z.object({
    fullName: z.string().min(2, 'Name is too short'),
    email: z.string().email('Invalid email address'),
    phone: z.string().optional(),
    department: z.string().min(1, 'Please select a department'),
    workspaceIds: z.array(z.string()).min(1, 'Select at least one workspace'),
    roles: z.array(z.string()).min(1, 'Select at least one role'),
    sendMethods: z.array(z.enum(['email', 'sms', 'whatsapp'])).min(1, 'Select at least one delivery method'),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteUserModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roles: { id: string; name: string }[];
    departments?: string[];
    workspaces?: { id: string; name: string }[];
}

export default function InviteUserModal({ open, onOpenChange, roles, departments, workspaces }: InviteUserModalProps) {
    const { toast } = useToast();
    const { activeOrganizationId, activeOrganization, activeWorkspaceId, activeWorkspace, accessibleWorkspaces } = useTenant();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Compute available departments from props, organization config, or standard fallback
    const availableDepartments = React.useMemo(() => {
        if (departments && departments.length > 0) return departments;
        if (activeOrganization?.departments && activeOrganization.departments.length > 0) {
            return activeOrganization.departments;
        }
        return ['Sales & Marketing', 'Finance & Administration', 'Operations', 'Engineering', 'Customer Success', 'General'];
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
            department: availableDepartments[0] || 'General',
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

    // Sync default department if not set
    React.useEffect(() => {
        if (!form.getValues('department') && availableDepartments.length > 0) {
            form.setValue('department', availableDepartments[0]);
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
                fullName: data.fullName,
                email: data.email,
                phone: data.phone,
                department: data.department,
                workspaceIds: data.workspaceIds,
                workspaceRoles,
                organizationId: activeOrganizationId,
                sendMethods: data.sendMethods,
            });

            if (result.success) {
                if (result.warnings && result.warnings.length > 0) {
                    toast({ 
                        variant: 'destructive', 
                        title: 'Account Created with Delivery Alerts', 
                        description: result.warnings.join('. ') 
                    });
                } else {
                    toast({ 
                        title: 'Invitation Dispatched', 
                        description: `Credentials sent successfully via ${data.sendMethods.join(', ')}.` 
                    });
                }
                onOpenChange(false);
                form.reset();
            } else {
                throw new Error(result.error);
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Invitation failed';
            toast({ variant: 'destructive', title: 'Invitation Failed', description: msg });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] rounded-2xl border border-border shadow-xl p-0 overflow-hidden bg-card text-card-foreground">
                <DialogHeader className="p-6 sm:p-8 pb-5 bg-card border-b border-border">
                    <div className="flex items-center gap-3.5">
                        <div className="p-2.5 bg-muted text-foreground rounded-xl border border-border shrink-0">
                            <UserPlus className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Expand the Identity Hub</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground font-normal mt-0.5">
                                Invite new institutional members with secure autogenerated credentials.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto space-y-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="fullName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-semibold text-foreground">Full Legal Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. John Doe" className="rounded-xl h-11 bg-background border-border text-foreground placeholder:text-muted-foreground" {...field} />
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
                                            <FormLabel className="text-xs font-semibold text-foreground">Corporate Email</FormLabel>
                                            <FormControl>
                                                <Input type="email" placeholder="john@org.com" className="rounded-xl h-11 bg-background border-border text-foreground placeholder:text-muted-foreground" {...field} />
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
                                        <FormLabel className="text-xs font-semibold text-foreground">Phone Number (Optional for SMS)</FormLabel>
                                        <FormControl>
                                            <Input type="tel" placeholder="e.g. 0244123456" className="rounded-xl h-11 bg-background border-border text-foreground placeholder:text-muted-foreground" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="department"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                                                Assigned Department
                                            </FormLabel>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger className="rounded-xl h-11 bg-background border-border text-foreground">
                                                        <SelectValue placeholder="Select Department" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl border-border bg-popover text-popover-foreground">
                                                    {availableDepartments.map((dept) => (
                                                        <SelectItem key={dept} value={dept}>
                                                            {dept}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="workspaceIds"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                Assigned Workspaces
                                            </FormLabel>
                                            <MultiSelect
                                                options={availableWorkspaces.map((w) => ({ label: w.name, value: w.id }))}
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder="Select workspaces..."
                                                className="rounded-xl border-border bg-background min-h-11 hover:bg-background"
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
                                        <FormLabel className="flex items-center gap-2 text-xs font-semibold text-foreground">
                                            <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
                                            Assigned Role Architecture
                                        </FormLabel>
                                        <MultiSelect
                                            options={roles.map((r) => ({ label: r.name, value: r.id }))}
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Select roles for assigned workspace(s)..."
                                            className="rounded-xl border-border bg-background min-h-11 hover:bg-background"
                                        />
                                        <p className="text-[11px] text-muted-foreground mt-1.5">
                                            Roles will be granted across all selected workspaces. You can adjust workspace-specific roles anytime after invitation.
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Separator className="border-border" />

                            <div className="space-y-3">
                                <FormLabel className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                                    <Sparkles className="h-3.5 w-3.5 text-secondary" /> Delivery Channels
                                </FormLabel>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <FormField
                                        control={form.control}
                                        name="sendMethods"
                                        render={({ field }) => {
                                            const isChecked = field.value.includes('email');
                                            return (
                                                <FormItem className={cn(
                                                    "flex items-center space-x-2.5 space-y-0 p-3.5 rounded-xl border transition-all cursor-pointer",
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
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Mail className="h-4 w-4 shrink-0 text-foreground" />
                                                        <span className="text-xs font-semibold truncate">Email</span>
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
                                                    "flex items-center space-x-2.5 space-y-0 p-3.5 rounded-xl border transition-all",
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
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                        <span className="text-xs font-semibold truncate">SMS</span>
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
                                                    "flex items-center space-x-2.5 space-y-0 p-3.5 rounded-xl border transition-all",
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
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                        <span className="text-xs font-semibold truncate">WhatsApp</span>
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

                <DialogFooter className="p-6 sm:p-8 py-5 bg-muted/20 border-t border-border gap-3">
                    <Button 
                        type="button"
                        variant="outline" 
                        className="rounded-xl px-5 h-10 text-sm font-medium border-border hover:bg-muted active:scale-[0.97]" 
                        onClick={() => onOpenChange(false)} 
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button 
                        type="button"
                        onClick={form.handleSubmit(onSubmit)} 
                        className="rounded-xl px-7 h-10 text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 shadow-xs active:scale-[0.97] transition-all" 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Dispatching...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4 mr-2" /> Launch Invitation
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
