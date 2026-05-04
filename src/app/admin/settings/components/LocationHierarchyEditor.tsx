'use client';

import * as React from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Region, District, Country } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { CountrySelect } from '@/components/location/CountrySelect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  Loader2,
  Pencil,
  MapPin,
  X,
  ChevronRight,
  Layers,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export default function LocationHierarchyEditor() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeOrganizationId, activeOrganization } = useTenant();

  // Country filter
  const [selectedCountry, setSelectedCountry] = React.useState<{
    id: string;
    name: string;
    code: string;
    flag: string;
  } | null>(null);

  // Region state
  const [selectedRegionId, setSelectedRegionId] = React.useState<string | null>(null);
  const [newRegionName, setNewRegionName] = React.useState('');
  const [isAddingRegion, setIsAddingRegion] = React.useState(false);
  const [editingRegionId, setEditingRegionId] = React.useState<string | null>(null);
  const [editingRegionName, setEditingRegionName] = React.useState('');
  const [regionToDelete, setRegionToDelete] = React.useState<Region | null>(null);

  // District state
  const [newDistrictName, setNewDistrictName] = React.useState('');
  const [isAddingDistrict, setIsAddingDistrict] = React.useState(false);
  const [editingDistrictId, setEditingDistrictId] = React.useState<string | null>(null);
  const [editingDistrictName, setEditingDistrictName] = React.useState('');
  const [districtToDelete, setDistrictToDelete] = React.useState<District | null>(null);

  // Queries
  const regionsQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
      collection(firestore, 'regions'),
      where('organizationId', '==', activeOrganizationId),
      orderBy('name', 'asc'),
    );
  }, [firestore, activeOrganizationId]);
  const { data: allRegions, isLoading: isLoadingRegions } = useCollection<Region>(regionsQuery);

  const districtsQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId || !selectedRegionId) return null;
    return query(
      collection(firestore, 'districts'),
      where('organizationId', '==', activeOrganizationId),
      where('regionId', '==', selectedRegionId),
      orderBy('name', 'asc'),
    );
  }, [firestore, activeOrganizationId, selectedRegionId]);
  const { data: districts, isLoading: isLoadingDistricts } = useCollection<District>(districtsQuery);

  // Filter regions by selected country
  const filteredRegions = React.useMemo(() => {
    if (!allRegions) return [];
    if (!selectedCountry) return allRegions;
    return allRegions.filter((r) => r.countryId === selectedCountry.id);
  }, [allRegions, selectedCountry]);

  const selectedRegion = filteredRegions.find((r) => r.id === selectedRegionId);

  // ── Region CRUD ──
  const handleAddRegion = async () => {
    if (!newRegionName.trim() || !firestore || !selectedCountry) return;
    setIsAddingRegion(true);
    try {
      await addDoc(collection(firestore, 'regions'), {
        name: newRegionName.trim(),
        countryId: selectedCountry.id,
        organizationId: activeOrganizationId,
      });
      setNewRegionName('');
      toast({ title: 'Region Added', description: `"${newRegionName}" has been added.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add region.' });
    } finally {
      setIsAddingRegion(false);
    }
  };

  const handleRenameRegion = async (id: string, name: string) => {
    if (!name.trim() || !firestore) {
      setEditingRegionId(null);
      return;
    }
    try {
      await updateDoc(doc(firestore, 'regions', id), { name: name.trim() });
      setEditingRegionId(null);
      toast({ title: 'Region Renamed' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to rename.' });
    }
  };

  const handleDeleteRegion = async () => {
    if (!regionToDelete || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'regions', regionToDelete.id));
      if (selectedRegionId === regionToDelete.id) setSelectedRegionId(null);
      toast({ title: 'Region Deleted' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete.' });
    } finally {
      setRegionToDelete(null);
    }
  };

  // ── District CRUD ──
  const handleAddDistrict = async () => {
    if (!newDistrictName.trim() || !firestore || !selectedRegionId) return;
    setIsAddingDistrict(true);
    try {
      await addDoc(collection(firestore, 'districts'), {
        name: newDistrictName.trim(),
        regionId: selectedRegionId,
        organizationId: activeOrganizationId,
      });
      setNewDistrictName('');
      toast({ title: 'District Added', description: `"${newDistrictName}" has been added.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add district.' });
    } finally {
      setIsAddingDistrict(false);
    }
  };

  const handleRenameDistrict = async (id: string, name: string) => {
    if (!name.trim() || !firestore) {
      setEditingDistrictId(null);
      return;
    }
    try {
      await updateDoc(doc(firestore, 'districts', id), { name: name.trim() });
      setEditingDistrictId(null);
      toast({ title: 'District Renamed' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to rename.' });
    }
  };

  const handleDeleteDistrict = async () => {
    if (!districtToDelete || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'districts', districtToDelete.id));
      toast({ title: 'District Deleted' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete.' });
    } finally {
      setDistrictToDelete(null);
    }
  };

  return (
    <>
      <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden col-span-full">
        <CardHeader className="bg-muted/30 border-b pb-6 text-left">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <Layers className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">
                Location Hierarchy
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Manage regions and districts for your organization. These are official
                administrative geographic units shared across all workspaces.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Country filter bar */}
          <div className="p-4 border-b bg-muted/10">
            <div className="max-w-xs">
              <CountrySelect
                value={selectedCountry}
                onValueChange={(c) => {
                  setSelectedCountry(c);
                  setSelectedRegionId(null);
                }}
                defaultCountryId={activeOrganization?.defaultCountryId || 'GH'}
                placeholder="Filter by country…"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border min-h-[350px]">
            {/* ── Left: Regions ── */}
            <div className="p-5 space-y-3">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                Regions
                {filteredRegions.length > 0 && (
                  <Badge variant="secondary" className="text-[8px] h-4 font-bold">
                    {filteredRegions.length}
                  </Badge>
                )}
              </div>

              {isLoadingRegions ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {filteredRegions.map((region) => (
                    <div
                      key={region.id}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-xl group transition-all cursor-pointer',
                        selectedRegionId === region.id
                          ? 'bg-primary/10 ring-1 ring-primary/30'
                          : 'bg-muted/20 hover:bg-muted/40',
                      )}
                      onClick={() => setSelectedRegionId(region.id)}
                    >
                      {editingRegionId === region.id ? (
                        <div className="flex-grow flex items-center gap-2">
                          <Input
                            value={editingRegionName}
                            onChange={(e) => setEditingRegionName(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === 'Enter' && handleRenameRegion(region.id, editingRegionName)
                            }
                            autoFocus
                            className="h-8 rounded-lg bg-background border-primary/20 text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRegionId(null);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-grow font-bold text-sm px-1 text-foreground/80">
                            {region.name}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingRegionId(region.id);
                                setEditingRegionName(region.name);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRegionToDelete(region);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {selectedRegionId === region.id && (
                            <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  {filteredRegions.length === 0 && (
                    <div className="text-center py-8 text-xs text-muted-foreground italic">
                      {selectedCountry
                        ? 'No regions yet. Add one below.'
                        : 'Select a country to manage regions.'}
                    </div>
                  )}
                </div>
              )}

              {selectedCountry && (
                <div className="flex gap-2 pt-3 border-t border-border/50">
                  <Input
                    placeholder="e.g. Greater Accra"
                    value={newRegionName}
                    onChange={(e) => setNewRegionName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddRegion()}
                    className="h-10 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-sm"
                  />
                  <Button
                    onClick={handleAddRegion}
                    disabled={isAddingRegion || !newRegionName.trim()}
                    size="sm"
                    className="h-10 rounded-xl font-bold shadow-sm px-4"
                  >
                    {isAddingRegion ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* ── Right: Districts ── */}
            <div className="p-5 space-y-3">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                Districts
                {selectedRegion && (
                  <Badge variant="outline" className="text-[8px] h-4 font-bold truncate max-w-[120px]">
                    {selectedRegion.name}
                  </Badge>
                )}
                {districts && districts.length > 0 && (
                  <Badge variant="secondary" className="text-[8px] h-4 font-bold">
                    {districts.length}
                  </Badge>
                )}
              </div>

              {!selectedRegionId ? (
                <div className="flex flex-col items-center justify-center py-16 text-center opacity-40">
                  <ChevronRight className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-semibold">
                    Select a region to manage its districts
                  </p>
                </div>
              ) : isLoadingDistricts ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {(districts || []).map((district) => (
                    <div
                      key={district.id}
                      className="flex items-center gap-2 bg-muted/20 p-3 rounded-xl group transition-all hover:bg-muted/40"
                    >
                      {editingDistrictId === district.id ? (
                        <div className="flex-grow flex items-center gap-2">
                          <Input
                            value={editingDistrictName}
                            onChange={(e) => setEditingDistrictName(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === 'Enter' &&
                              handleRenameDistrict(district.id, editingDistrictName)
                            }
                            autoFocus
                            className="h-8 rounded-lg bg-background border-primary/20 text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => setEditingDistrictId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-grow font-bold text-sm px-1 text-foreground/80">
                            {district.name}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg"
                              onClick={() => {
                                setEditingDistrictId(district.id);
                                setEditingDistrictName(district.name);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg"
                              onClick={() => setDistrictToDelete(district)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {(districts || []).length === 0 && (
                    <div className="text-center py-8 text-xs text-muted-foreground italic">
                      No districts yet. Add one below.
                    </div>
                  )}
                </div>
              )}

              {selectedRegionId && (
                <div className="flex gap-2 pt-3 border-t border-border/50">
                  <Input
                    placeholder="e.g. Ga East Municipal"
                    value={newDistrictName}
                    onChange={(e) => setNewDistrictName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDistrict()}
                    className="h-10 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-sm"
                  />
                  <Button
                    onClick={handleAddDistrict}
                    disabled={isAddingDistrict || !newDistrictName.trim()}
                    size="sm"
                    className="h-10 rounded-xl font-bold shadow-sm px-4"
                  >
                    {isAddingDistrict ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Region Dialog */}
      <AlertDialog open={!!regionToDelete} onOpenChange={(o) => !o && setRegionToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold">Delete Region?</AlertDialogTitle>
            <AlertDialogDescription className="font-medium">
              Are you sure you want to delete{' '}
              <span className="font-bold text-foreground">
                &ldquo;{regionToDelete?.name}&rdquo;
              </span>
              ? All districts within this region will need to be manually reassigned. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRegion}
              className="rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Region
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete District Dialog */}
      <AlertDialog open={!!districtToDelete} onOpenChange={(o) => !o && setDistrictToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold">Delete District?</AlertDialogTitle>
            <AlertDialogDescription className="font-medium">
              Are you sure you want to delete{' '}
              <span className="font-bold text-foreground">
                &ldquo;{districtToDelete?.name}&rdquo;
              </span>
              ? Entities assigned to this district will need to be manually reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDistrict}
              className="rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete District
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
