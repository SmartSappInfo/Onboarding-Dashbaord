'use client';

import * as React from 'react';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import type { WorkspaceEntity } from '@/lib/types';
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
import { useTenant } from '@/context/TenantContext';
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
 * from entities + workspace_entities collections via Contact Adapter.
 * 
 * Requirements: 23.2, 23.4 (Task 35.1)
 */
export function EntitySelector({
  channel,
  onSelectionChange,
  selectedEntityIds,
  maxSelections = 100,
}: EntitySelectorProps) {
  const firestore = useFirestore();
  const { activeWorkspace: currentWorkspace } = useWorkspace();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [showSelectAllDialog, setShowSelectAllDialog] = React.useState(false);

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load workspace entities from Firestore (Requirement 23.2)
  const workspaceEntitiesQuery = React.useMemo(() => {
    if (!firestore || !currentWorkspace?.id) return null;
    return query(
      collection(firestore, 'workspace_entities'),
      where('workspaceId', '==', currentWorkspace.id),
      where('status', '==', 'active'),
      orderBy('displayName', 'asc')
    );
  }, [firestore, currentWorkspace?.id]);

  const { data: workspaceEntities, isLoading } = useCollection<WorkspaceEntity>(workspaceEntitiesQuery);

  // Filter entities based on search term (Requirement 23.2)
  const filteredEntities = React.useMemo(() => {
    if (!workspaceEntities) return [];
    
    const searchLower = debouncedSearchTerm.toLowerCase().trim();
    if (!searchLower) return workspaceEntities;

    return workspaceEntities.filter((entity) => {
      const nameMatch = entity.displayName?.toLowerCase().includes(searchLower);
      const emailMatch = entity.primaryEmail?.toLowerCase().includes(searchLower);
      const phoneMatch = entity.primaryPhone?.toLowerCase().includes(searchLower);
      const typeMatch = entity.entityType?.toLowerCase().includes(searchLower);
      const stageMatch = entity.currentStageName?.toLowerCase().includes(searchLower);
      
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
      // Add to selection if under limit
      if (selectedEntityIds.length >= maxSelections) {
        return; // Silently ignore if at max
      }
      onSelectionChange([...selectedEntityIds, entityId]);
    }
  };

  // Handle select all
  const handleSelectAll = () => {
    setShowSelectAllDialog(true);
  };

  const confirmSelectAll = () => {
    const allIds = filteredEntities.slice(0, maxSelections).map(e => e.entityId);
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
    return workspaceEntities.filter(e => selectedEntityIds.includes(e.entityId));
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
            {selectedEntityIds.length} / {maxSelections} selected
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
              disabled={selectedEntityIds.length >= maxSelections}
            >
              Select All
            </Button>
          )}
        </div>
      </div>

      {/* Maximum Selection Warning */}
      {selectedEntityIds.length >= maxSelections && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm text-amber-900 dark:text-amber-100">
            Maximum selection limit of {maxSelections} contacts reached
          </span>
        </div>
      )}

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
                  const EntityIcon = ENTITY_TYPE_ICONS[entity.entityType] || Building;
                  return (
                    <div
                      key={entity.entityId}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <EntityIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate">{entity.displayName}</span>
                        <Badge variant="outline" className="text-xs">
                          {entity.entityType}
                        </Badge>
                        {entity.currentStageName && (
                          <span className="text-xs text-muted-foreground truncate">
                            {entity.currentStageName}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveEntity(entity.entityId)}
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
                    const isSelected = selectedEntityIds.includes(entity.entityId);
                    const isDisabled = !isSelected && selectedEntityIds.length >= maxSelections;
                    const EntityIcon = ENTITY_TYPE_ICONS[entity.entityType] || Building;

                    return (
                      <div
                        key={entity.entityId}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-md border transition-colors",
                          isSelected && "bg-primary/5 border-primary",
                          !isSelected && "hover:bg-muted",
                          isDisabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Checkbox
                          id={`entity-${entity.entityId}`}
                          checked={isSelected}
                          onCheckedChange={() => handleToggleEntity(entity.entityId)}
                          disabled={isDisabled}
                        />
                        <label
                          htmlFor={`entity-${entity.entityId}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <EntityIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <p className="text-sm font-medium truncate">{entity.displayName}</p>
                                <Badge variant="outline" className="text-xs">
                                  {entity.entityType}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                {entity.primaryEmail && (
                                  <span className="truncate">{entity.primaryEmail}</span>
                                )}
                                {entity.primaryPhone && (
                                  <span className="truncate">{entity.primaryPhone}</span>
                                )}
                                {entity.currentStageName && (
                                  <Badge variant="secondary" className="text-xs">
                                    {entity.currentStageName}
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
              This will select {Math.min(filteredEntities.length, maxSelections)} contacts
              {filteredEntities.length > maxSelections && 
                ` (limited to maximum of ${maxSelections})`
              }.
              {' '}You will send approximately {Math.min(filteredEntities.length, maxSelections)} messages.
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
