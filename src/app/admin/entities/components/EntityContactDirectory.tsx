'use client';

import * as React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { logActivity } from '@/lib/activity-logger';
import { 
    Plus, User, Mail, Phone, ShieldCheck, BadgeCheck, X, AlertCircle, Loader2, Save, Trash2, Pencil, MoreHorizontal, UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { 
    resolveEntityContacts, 
    enforceContactConstraints,
    normalizeContactType 
} from '@/lib/entity-contact-helpers';
import { getEffectiveContactTypes } from '@/lib/contact-type-actions';
import { getSystemContactTypes } from '@/lib/contact-type-defaults';
import type { Entity, EntityContact, ContactTypeEntry } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EntityContactDirectoryProps {
    entityId: string;
    entityData: Entity;
    organizationId?: string;
    workspaceId?: string;
}

export default function EntityContactDirectory({ 
    entityId, 
    entityData, 
    organizationId, 
    workspaceId 
}: EntityContactDirectoryProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAdding, setIsAdding] = React.useState(false);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const { user } = useUser();
    
    // Role selection state
    const [availableRoles, setAvailableRoles] = React.useState<ContactTypeEntry[]>(getSystemContactTypes(entityData.entityType));
    const [isLoadingRoles, setIsLoadingRoles] = React.useState(false);

    // Initial load of roles
    React.useEffect(() => {
        let cancelled = false;
        setIsLoadingRoles(true);
        getEffectiveContactTypes(entityData.entityType, organizationId, workspaceId)
            .then(roles => { if (!cancelled) setAvailableRoles(roles); })
            .catch(() => { if (!cancelled) setAvailableRoles(getSystemContactTypes(entityData.entityType)); })
            .finally(() => { if (!cancelled) setIsLoadingRoles(false); });
        return () => { cancelled = true; };
    }, [entityData.entityType, organizationId, workspaceId]);

    const contacts = React.useMemo(() => resolveEntityContacts(entityData), [entityData]);

    const handleSave = async (contact: EntityContact) => {
        if (!firestore || isSaving) return;
        setIsSaving(true);
        
        try {
            let updatedContacts = [...contacts];
            
            if (isAdding) {
                updatedContacts.push(contact);
            } else {
                updatedContacts = updatedContacts.map(c => c.id === contact.id ? contact : c);
            }
            
            // Enforce constraints (single primary, single signatory)
            const finalContacts = enforceContactConstraints(updatedContacts);
            
            await updateDoc(doc(firestore, 'entities', entityId), {
                entityContacts: finalContacts,
                updatedAt: new Date().toISOString()
            });
            
            toast({ title: isAdding ? 'Contact Created' : 'Contact Updated' });
            
            // Log activity
            await logActivity({
                organizationId: organizationId || entityData.organizationId || '',
                workspaceId: workspaceId || '',
                entityId: entityId,
                entityType: entityData.entityType,
                userId: user?.uid || null,
                type: isAdding ? 'contact_added' : 'contact_updated',
                source: 'console',
                description: `${isAdding ? 'Added' : 'Updated'} contact: ${contact.name} (${contact.typeLabel || contact.typeKey})`,
                metadata: {
                    contactId: contact.id,
                    contactName: contact.name,
                    role: contact.typeLabel || contact.typeKey,
                    isPrimary: contact.isPrimary,
                    isSignatory: contact.isSignatory
                }
            });

            setIsAdding(false);
            setEditingId(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    const [contactToDelete, setContactToDelete] = React.useState<string | null>(null);

    const handleDelete = async () => {
        if (!firestore || isSaving || !contactToDelete) return;
        
        setIsSaving(true);
        try {
            const updatedContacts = contacts.filter(c => c.id !== contactToDelete);
            const finalContacts = enforceContactConstraints(updatedContacts);
            
            await updateDoc(doc(firestore, 'entities', entityId), {
                entityContacts: finalContacts,
                updatedAt: new Date().toISOString()
            });
            
            toast({ title: 'Contact Removed' });
            
            // Log activity
            await logActivity({
                organizationId: organizationId || entityData.organizationId || '',
                workspaceId: workspaceId || '',
                entityId: entityId,
                entityType: entityData.entityType,
                userId: user?.uid || null,
                type: 'contact_removed',
                source: 'console',
                description: `Removed contact from directory`,
                metadata: {
                    contactId: contactToDelete
                }
            });

            setContactToDelete(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
        } finally {
            setIsSaving(false);
            setContactToDelete(null);
        }
    };

    return (
        <Card className="border-none shadow-sm rounded-2xl bg-card overflow-hidden">
            <CardHeader className="border-b bg-card/20 pb-5 px-8 pt-8 flex flex-row items-center justify-between">
                <div className="space-y-0.5">
                    <CardTitle className="text-[10px] font-semibold text-primary flex items-center gap-2">
                        <UserCheck className="h-4 w-4" /> Contact Directory
                    </CardTitle>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsAdding(true)}
                    disabled={isAdding || !!editingId}
                    className="h-9 rounded-xl font-bold border-dashed border-2 text-[10px] uppercase tracking-widest hover:bg-primary/5 hover:text-primary transition-all shadow-sm"
                >
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> New Contact
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                    {/* Add Mode */}
                    {isAdding && (
                        <ContactEditor 
                            initialValues={{
                                id: `ec_${nanoid(10)}`,
                                name: '',
                                email: '',
                                phone: '',
                                typeKey: availableRoles[0]?.key || 'other',
                                typeLabel: availableRoles[0]?.label || 'Other',
                                isPrimary: contacts.length === 0,
                                isSignatory: contacts.length === 0,
                                order: contacts.length,
                                createdAt: new Date().toISOString()
                            }}
                            availableRoles={availableRoles}
                            onSave={handleSave}
                            onCancel={() => setIsAdding(false)}
                            isSaving={isSaving}
                        />
                    )}

                    {/* Contact List */}
                    {contacts.length > 0 ? (
                        contacts.sort((a, b) => a.order - b.order).map((contact) => (
                            editingId === contact.id ? (
                                <ContactEditor 
                                    key={contact.id}
                                    initialValues={contact}
                                    availableRoles={availableRoles}
                                    onSave={handleSave}
                                    onCancel={() => setEditingId(null)}
                                    isSaving={isSaving}
                                />
                            ) : (
                                <ContactRow 
                                    key={contact.id}
                                    contact={contact}
                                    onEdit={() => setEditingId(contact.id)}
                                    onDelete={() => setContactToDelete(contact.id)}
                                    disabled={!!editingId || isAdding}
                                />
                            )
                        ))
                    ) : !isAdding && (
                        <div className="p-12 text-center text-muted-foreground font-medium italic">
                            No entity contacts initialized.
                        </div>
                    )}
                </div>
            </CardContent>

            <AlertDialog open={!!contactToDelete} onOpenChange={(open) => !open && setContactToDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-semibold">Remove Contact?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove this contact from the directory. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDelete} 
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Remove Contact
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

function ContactRow({ contact, onEdit, onDelete, disabled }: { 
    contact: EntityContact, 
    onEdit: () => void, 
    onDelete: () => void,
    disabled: boolean 
}) {
    const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '?';

    return (
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group hover:bg-background transition-colors text-left">
            <div className="flex items-center gap-4 text-left">
                <div className="h-12 w-12 rounded-2xl bg-card/50 flex items-center justify-center font-semibold text-primary border border-border/50 shadow-sm group-hover:bg-primary group-hover:text-white transition-colors">
                    {getInitials(contact.name)}
                </div>
                <div className="text-left">
                    <p className="font-semibold text-base">{contact.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[8px] font-semibold uppercase tracking-tighter h-5">
                            {contact.typeLabel || contact.typeKey}
                        </Badge>
                        {contact.isPrimary && (
                            <Badge variant="secondary" className="text-[7px] font-semibold uppercase bg-blue-50 text-blue-700 border-blue-200 py-0.5 px-2">
                                Primary
                            </Badge>
                        )}
                        {contact.isSignatory && (
                            <Badge className="text-[7px] font-semibold uppercase bg-amber-500 text-white border-none py-0.5 px-2">
                                Signatory
                            </Badge>
                        )}
                        <ShieldCheck className={cn("h-3.5 w-3.5", contact.isSignatory ? "text-amber-500" : "text-muted-foreground/20")} />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex gap-2 flex-1 sm:flex-none">
                    {contact.email && (
                        <Button variant="outline" size="sm" asChild className="h-9 rounded-xl flex-1 sm:flex-none border-border/50">
                            <a href={`mailto:${contact.email}`}><Mail className="h-3.5 w-3.5 mr-2" /> Email</a>
                        </Button>
                    )}
                    {contact.phone && (
                        <Button variant="outline" size="sm" asChild className="h-9 rounded-xl flex-1 sm:flex-none border-border/50">
                            <a href={`tel:${contact.phone}`}><Phone className="h-3.5 w-3.5 mr-2" /> Call</a>
                        </Button>
                    )}
                </div>
                
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground" disabled={disabled}>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 border-none shadow-2xl">
                        <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 py-2">Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={onEdit} className="rounded-lg p-2.5 gap-3 cursor-pointer">
                            <div className="p-1.5 bg-blue-500/10 rounded-md text-blue-600"><Pencil className="h-3.5 w-3.5" /></div>
                            <span className="font-bold text-sm">Edit Contact</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-1" />
                        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:bg-destructive/10 rounded-lg p-2.5 gap-3 cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="font-bold text-sm">Remove</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

function ContactEditor({ 
    initialValues, 
    availableRoles, 
    onSave, 
    onCancel, 
    isSaving 
}: { 
    initialValues: EntityContact, 
    availableRoles: ContactTypeEntry[],
    onSave: (contact: EntityContact) => void, 
    onCancel: () => void,
    isSaving: boolean
}) {
    const [form, setForm] = React.useState<EntityContact>(initialValues);
    const [isCustomRole, setIsCustomRole] = React.useState(!availableRoles.some(r => r.key === form.typeKey) && !!form.typeKey);

    const handleRoleChange = (val: string) => {
        if (val === 'CUSTOM') {
            setIsCustomRole(true);
            setForm(prev => ({ ...prev, typeKey: 'custom', typeLabel: '' }));
        } else {
            const role = availableRoles.find(r => r.key === val);
            if (role) {
                setForm(prev => ({ ...prev, typeKey: role.key, typeLabel: role.label }));
            }
        }
    };

    const handleCustomRoleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const key = normalizeContactType(val);
        setForm(prev => ({ ...prev, typeKey: key, typeLabel: val }));
    };

    return (
        <div className="p-8 bg-muted/20 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5 uppercase tracking-widest">
                        <User className="h-3 w-3 text-primary" /> Full Name
                    </Label>
                    <Input
                        value={form.name}
                        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Ama Serwaa"
                        className="h-11 rounded-xl bg-background border-none shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20 font-bold"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5 uppercase tracking-widest">
                            <Mail className="h-3 w-3" /> Email
                        </Label>
                        <Input
                            value={form.email || ''}
                            onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                            type="email"
                            placeholder="ama@school.edu"
                            className="h-11 rounded-xl bg-background border-none shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20 font-medium"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5 uppercase tracking-widest">
                            <Phone className="h-3 w-3" /> Phone
                        </Label>
                        <Input
                            value={form.phone || ''}
                            onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="+233…"
                            className="h-11 rounded-xl bg-background border-none shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20 font-bold"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5 uppercase tracking-widest">
                        <ShieldCheck className="h-3 w-3" /> Assigned Role
                    </Label>
                    {isCustomRole ? (
                        <div className="flex items-center gap-2">
                            <Input 
                                value={form.typeLabel || ''}
                                onChange={handleCustomRoleChange}
                                placeholder="Enter custom role…"
                                className="h-11 rounded-xl bg-background border-none shadow-sm font-bold focus-visible:ring-2 focus-visible:ring-primary/20"
                                autoFocus
                            />
                            <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => setIsCustomRole(false)}><X className="h-4 w-4" /></Button>
                        </div>
                    ) : (
                        <Select value={form.typeKey} onValueChange={handleRoleChange}>
                            <SelectTrigger className="h-11 rounded-xl bg-background border-none shadow-sm focus:ring-1 focus:ring-primary/20 font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-2xl border border-border/50 bg-card">
                                {availableRoles.map((t) => (
                                    <SelectItem key={t.key} value={t.key} className="font-bold text-xs uppercase">
                                        {t.label}
                                    </SelectItem>
                                ))}
                                <Separator className="my-1" />
                                <SelectItem value="CUSTOM" className="text-primary font-semibold italic text-xs">Add Custom Role…</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col justify-center gap-2">
                        <Label className="text-[9px] font-bold text-primary tracking-widest uppercase">Primary Contact</Label>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/50 shadow-sm">
                            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase">Main Person</span>
                            <Switch 
                                checked={form.isPrimary} 
                                onCheckedChange={checked => setForm(prev => ({ ...prev, isPrimary: checked }))}
                                className="scale-75"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col justify-center gap-2">
                        <Label className="text-[9px] font-bold text-primary tracking-widest uppercase">Authorized Signer</Label>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/50 shadow-sm">
                            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase">Signer</span>
                            <Switch 
                                checked={form.isSignatory} 
                                onCheckedChange={checked => setForm(prev => ({ ...prev, isSignatory: checked }))}
                                className="scale-75"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-border/50">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={onCancel}
                    className="rounded-xl font-bold h-10 px-6"
                    disabled={isSaving}
                >
                    Cancel
                </Button>
                <Button 
                    size="sm" 
                    onClick={() => onSave(form)}
                    className="rounded-xl font-bold h-10 px-8 shadow-lg shadow-primary/20"
                    disabled={isSaving || !form.name}
                >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Contact
                </Button>
            </div>
        </div>
    );
}

// Sub-components
function CardHeader({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("p-6", className)}>{children}</div>;
}

function CardTitle({ children, className }: { children: React.ReactNode, className?: string }) {
    return <h3 className={cn("text-lg font-semibold", className)}>{children}</h3>;
}
