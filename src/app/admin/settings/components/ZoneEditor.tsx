'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Zone } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Loader2, Pencil, MapPin, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function ZoneEditor() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeOrganizationId } = useTenant();
  
  const zonesQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
      collection(firestore, 'zones'), 
      where('organizationId', '==', activeOrganizationId),
      orderBy('name', 'asc')
    );
  }, [firestore, activeOrganizationId]);
  const { data: zones, isLoading } = useCollection<Zone>(zonesQuery);
  
  const [newZoneName, setNewZoneName] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingZoneId, setEditingZoneId] = React.useState<string | null>(null);
  const [editingZoneName, setEditingZoneName] = React.useState('');
  const [zoneToDelete, setZoneToDelete] = React.useState<Zone | null>(null);

  const handleAddZone = async () => {
    if (!newZoneName.trim() || !firestore) return;
    setIsAdding(true);
    try {
      await addDoc(collection(firestore, 'zones'), { 
        name: newZoneName.trim(),
        organizationId: activeOrganizationId 
      });
      setNewZoneName('');
      toast({ title: 'Zone Added', description: `"${newZoneName}" has been added.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add zone.' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRename = async (id: string, name: string) => {
    if (!name.trim() || !firestore) {
        setEditingZoneId(null);
        return;
    }
    try {
      await updateDoc(doc(firestore, 'zones', id), { name: name.trim() });
      setEditingZoneId(null);
      toast({ title: 'Zone Renamed' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to rename zone.' });
    }
  };

  const handleDeleteZone = async () => {
    if (!zoneToDelete || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'zones', zoneToDelete.id));
      toast({ title: 'Zone Deleted' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete zone.' });
    } finally {
      setZoneToDelete(null);
    }
  };

  return (
    <>
      <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-6 text-left">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
                <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight">Zone Architecture</CardTitle>
                <CardDescription className="text-xs font-medium">Manage operational areas and zones to categorize and group workspace entities.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : (
            <div className="space-y-3">
              {zones?.map((zone) => (
                <div key={zone.id} className="flex items-center gap-2 bg-muted/20 p-3 rounded-xl group transition-all hover:bg-muted/40">
                  {editingZoneId === zone.id ? (
                    <div className="flex-grow flex items-center gap-2">
                        <Input
                            value={editingZoneName}
                            onChange={(e) => setEditingZoneName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRename(zone.id, editingZoneName)}
                            autoFocus
                            className="h-9 rounded-lg bg-background border-primary/20"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditingZoneId(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                  ) : (
                    <span className="flex-grow font-bold text-sm px-2 text-foreground/80">{zone.name}</span>
                  )}
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { setEditingZoneId(zone.id); setEditingZoneName(zone.name); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => setZoneToDelete(zone)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-4 border-t border-border/50">
            <Input
              placeholder="e.g. Airport / Legon Zone"
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddZone()}
              className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"
            />
            <Button onClick={handleAddZone} disabled={isAdding} className="h-11 rounded-xl font-bold shadow-lg">
              {isAdding ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Zone
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!zoneToDelete} onOpenChange={(o) => !o && setZoneToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black">Delete Zone?</AlertDialogTitle>
            <AlertDialogDescription className="font-medium">
              Are you sure you want to delete <span className="font-bold text-foreground">"{zoneToDelete?.name}"</span>? 
              <br/><br/>
              Schools assigned to this zone will need to be manually reassigned. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteZone} className="rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Zone</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
