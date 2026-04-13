'use client';

import * as React from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { ResolvedContact } from '@/lib/types';
import { getContactEmail, getContactPhone } from '@/lib/migration-status-utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Search, X, Building, AlertCircle, ChevronLeft, ChevronRight, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';

interface EntitySelectorProps {
  channel: 'email' | 'sms';
  onSelectionChange: (entityIds: string[]) => void;
  selectedEntityIds: string[];
  maxSelections?: number;
}

// Entity type icons for better visual distinction
const ENTITY_TYPE_ICONS = {
  institution: Building,
  family: Users,
  person: User,
};

const ENTITIES_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * EntitySelector Component
 * 
 * Displays workspace entities and allows multi-selection for messaging.
 * Uses entityId as the primary identifier and resolves entity information
 * from entities + workspace_entities collections via Client SDK.
 */
export function EntitySelector({
  channel,
  onSelectionChange,
  selectedEntityIds,
}: EntitySelectorProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [showSelectAllDialog, setShowSelectAllDialog] = React.useState(false);

  // 1. Fetch Workspace Entities (Migrated)
  const weQuery = useMemoFirebase(() => 
    firestore && activeWorkspaceId ? query(
      collection(firestore, 'workspace_entities'),
      where('workspaceId', '==', activeWorkspaceId)
    ) : null,
  [firestore, activeWorkspaceId]);
  const { data: workspaceEntitiesRaw, isLoading: isLoading } = useCollection<any>(weQuery);

  // 3. Map to Unified ResolvedContact format
  const workspaceEntities = React.useMemo(() => {
    if (!activeWorkspaceId) return [];

    const contacts: ResolvedContact[] = [];

    // Map Workspace Entities
    if (workspaceEntitiesRaw) {
        workspaceEntitiesRaw.forEach(we => {
            contacts.push({
                id: we.entityId || we.id,
                entityId: we.entityId || we.id,
                workspaceEntityId: we.id,
                name: we.displayName,
                contacts: [], // In entities, we resolve contacts on server during dispatch
                pipelineId: we.pipelineId,
                stageId: we.stageId,
                stageName: we.currentStageName,
                assignedTo: we.assignedTo,
                status: we.status,
                tags: we.workspaceTags || [],
                migrationStatus: 'migrated',
                entityType: we.entityType || 'institution'
            });
        });
    }

    return contacts;
  }, [activeWorkspaceId, workspaceEntitiesRaw]);

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter entities based on search term (Requirement 23.2)
  const filteredEntities = React.useMemo(() => {
    if (!workspaceEntities) return [];

    const searchLower = debouncedSearchTerm.toLowerCase().trim();
    if (!searchLower) return workspaceEntities;

    return workspaceEntities.filter((entity) => {
      const nameMatch = entity.name?.toLowerCase().includes(searchLower);
      const email = getContactEmail(entity);
      const phone = getContactPhone(entity);
      const emailMatch = email?.toLowerCase().includes(searchLower);
      const phoneMatch = phone?.toLowerCase().includes(searchLower);
      const typeMatch = entity.entityType?.toLowerCase().includes(searchLower);
      const stageMatch = entity.stageName?.toLowerCase().includes(searchLower);

      return nameMatch || emailMatch || phoneMatch || typeMatch || stageMatch;
    });
  }, [workspaceEntities, debouncedSearchTerm]);

  // Paginate filtered entities
  const totalPages = Math.ceil(filteredEntities.length / ENTITIES_PER_PAGE);
  const paginatedEntities = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ENTITIES_PER_PAGE;
    const endIndex = startIndex + ENTITIES_PER_PAGE;
    return filteredEntities.slice(startIndex, endIndex);
  }, [filteredEntities, currentPage]);

  // Handle individual entity selection (Requirement 23.4 - populate entityId)
  const handleToggleEntity = (entityId: string) => {
    const isSelected = selectedEntityIds.includes(entityId);

    if (isSelected) {
      // Remove from selection
      onSelectionChange(selectedEntityIds.filter(id => id !== entityId));
    } else {
      onSelectionChange([...selectedEntityIds, entityId]);
    }
  };

  // Handle select all
  const handleSelectAll = () => {
    setShowSelectAllDialog(true);
  };

  const confirmSelectAll = () => {
    const allIds = filteredEntities.map(e => e.entityId || e.id);
    onSelectionChange(allIds);
    setShowSelectAllDialog(false);
  };

  // Handle clear all
  const handleClearAll = () => {
    onSelectionChange([]);
  };

  // Handle remove individual entity
  const handleRemoveEntity = (entityId: string) => {
    onSelectionChange(selectedEntityIds.filter(id => id !== entityId));
  };

  // Get selected entity details for display (Requirement 23.2)
  const selectedEntities = React.useMemo(() => {
    if (!workspaceEntities) return [];
    return workspaceEntities.filter(e => selectedEntityIds.includes(e.entityId || e.id));
  }, [workspaceEntities, selectedEntityIds]);

  // Handle pagination
  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  return (
 <div className="space-y-4">
      {/* Search and Controls */}
 <div className="space-y-2">
        <Label htmlFor="entity-search">Search Contacts</Label>
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="entity-search"
            placeholder="Search by name, email, phone, type, or stage..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
 <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Selection Summary */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {selectedEntityIds.length} selected
          </Badge>
          {filteredEntities.length > 0 && (
 <span className="text-sm text-muted-foreground">
              ({filteredEntities.length} contacts found)
            </span>
          )}
        </div>
 <div className="flex gap-2">
          {selectedEntityIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
            >
              Clear All
            </Button>
          )}
          {filteredEntities.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              Select All
            </Button>
          )}
        </div>
      </div>



      {/* Selected Entities Display (Requirement 23.2) */}
      {selectedEntities.length > 0 && (
        <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-sm font-medium">Selected Contacts</CardTitle>
          </CardHeader>
          <CardContent>
 <ScrollArea className="h-32">
 <div className="space-y-2">
                {selectedEntities.map((entity) => {
                  const EntityIcon = ENTITY_TYPE_ICONS[entity.entityType as keyof typeof ENTITY_TYPE_ICONS] || Building;
                  return (
                    <div
                      key={entity.entityId || entity.id}
 className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
 <div className="flex items-center gap-2 flex-1 min-w-0">
 <EntityIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 <span className="text-sm truncate">{entity.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {entity.entityType || 'Unknown'}
                        </Badge>
                        {entity.stageName && (
 <span className="text-xs text-muted-foreground truncate">
                            {entity.stageName}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveEntity(entity.entityId || entity.id)}
 className="h-6 w-6 p-0"
                      >
 <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Entity List (Requirement 23.2 - Display entity information) */}
      <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-sm font-medium">Available Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
 <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
 <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : paginatedEntities.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <Building className="h-8 w-8 mx-auto mb-2 opacity-50" />
 <p className="text-sm">
                {searchTerm ? 'No contacts found matching your search' : 'No contacts available'}
              </p>
            </div>
          ) : (
            <>
 <ScrollArea className="h-96">
 <div className="space-y-1">
                  {paginatedEntities.map((entity) => {
                    const mappedEntityId = entity.entityId || entity.id;
                    const isSelected = selectedEntityIds.includes(mappedEntityId);
                    const EntityIcon = ENTITY_TYPE_ICONS[entity.entityType as keyof typeof ENTITY_TYPE_ICONS] || Building;

                    return (
                      <div
                        key={mappedEntityId}
 className={cn(
                          "flex items-center gap-3 p-3 rounded-md border transition-colors",
                          isSelected && "bg-primary/5 border-primary",
                          !isSelected && "hover:bg-muted"
                        )}
                      >
                        <Checkbox
                          id={`entity-${mappedEntityId}`}
                          checked={isSelected}
                          onCheckedChange={() => handleToggleEntity(mappedEntityId)}
                        />
                        <label
                          htmlFor={`entity-${mappedEntityId}`}
 className="flex-1 cursor-pointer"
                        >
 <div className="flex items-center justify-between">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <EntityIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
 <p className="text-sm font-medium truncate">{entity.name}</p>
                                <Badge variant="outline" className="text-xs">
                                  {entity.entityType || 'Unknown'}
                                </Badge>
                              </div>
 <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                {getContactEmail(entity) && (
 <span className="truncate">{getContactEmail(entity)}</span>
                                )}
                                {getContactPhone(entity) && (
 <span className="truncate">{getContactPhone(entity)}</span>
                                )}
                                {entity.stageName && (
                                  <Badge variant="secondary" className="text-xs">
                                    {entity.stageName}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Pagination Controls */}
              {totalPages > 1 && (
 <div className="flex items-center justify-between mt-4 pt-4 border-t">
 <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
 <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                    >
 <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                    >
                      Next
 <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Select All Confirmation Dialog */}
      <AlertDialog open={showSelectAllDialog} onOpenChange={setShowSelectAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select All Contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              This will select all {filteredEntities.length} matching contacts. 
              You will queue approximately {filteredEntities.length} messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSelectAll}>
              Confirm Selection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
