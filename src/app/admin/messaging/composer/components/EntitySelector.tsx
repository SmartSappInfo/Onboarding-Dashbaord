'use client';

import * as React from 'react';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import type { School } from '@/lib/types';
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
import { Search, X, Building, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EntitySelectorProps {
  channel: 'email' | 'sms';
  onSelectionChange: (entityIds: string[]) => void;
  selectedEntityIds: string[];
  maxSelections?: number;
}

const ENTITIES_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 300;

export function EntitySelector({
  channel,
  onSelectionChange,
  selectedEntityIds,
  maxSelections = 100,
}: EntitySelectorProps) {
  const firestore = useFirestore();
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

  // Load schools from Firestore
  const schoolsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'schools'),
      orderBy('name', 'asc')
    );
  }, [firestore]);

  const { data: schools, isLoading } = useCollection<School>(schoolsQuery);

  // Filter schools based on search term
  const filteredSchools = React.useMemo(() => {
    if (!schools) return [];
    
    const searchLower = debouncedSearchTerm.toLowerCase().trim();
    if (!searchLower) return schools;

    return schools.filter((school) => {
      const nameMatch = school.name?.toLowerCase().includes(searchLower);
      const locationMatch = school.location?.toLowerCase().includes(searchLower);
      const statusMatch = school.status?.toLowerCase().includes(searchLower);
      
      return nameMatch || locationMatch || statusMatch;
    });
  }, [schools, debouncedSearchTerm]);

  // Paginate filtered schools
  const totalPages = Math.ceil(filteredSchools.length / ENTITIES_PER_PAGE);
  const paginatedSchools = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ENTITIES_PER_PAGE;
    const endIndex = startIndex + ENTITIES_PER_PAGE;
    return filteredSchools.slice(startIndex, endIndex);
  }, [filteredSchools, currentPage]);

  // Handle individual entity selection
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
    const allIds = filteredSchools.slice(0, maxSelections).map(s => s.id);
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

  // Get selected school details for display
  const selectedSchools = React.useMemo(() => {
    if (!schools) return [];
    return schools.filter(s => selectedEntityIds.includes(s.id));
  }, [schools, selectedEntityIds]);

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
        <Label htmlFor="entity-search">Search Schools</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="entity-search"
            placeholder="Search by name, location, or status..."
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
          {filteredSchools.length > 0 && (
            <span className="text-sm text-muted-foreground">
              ({filteredSchools.length} schools found)
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
          {filteredSchools.length > 0 && (
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
            Maximum selection limit of {maxSelections} schools reached
          </span>
        </div>
      )}

      {/* Selected Entities Display */}
      {selectedSchools.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Selected Schools</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {selectedSchools.map((school) => (
                  <div
                    key={school.id}
                    className="flex items-center justify-between p-2 bg-muted rounded-md"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{school.name}</span>
                      {school.location && (
                        <span className="text-xs text-muted-foreground truncate">
                          {school.location}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEntity(school.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Entity List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Available Schools</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : paginatedSchools.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {searchTerm ? 'No schools found matching your search' : 'No schools available'}
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-96">
                <div className="space-y-1">
                  {paginatedSchools.map((school) => {
                    const isSelected = selectedEntityIds.includes(school.id);
                    const isDisabled = !isSelected && selectedEntityIds.length >= maxSelections;

                    return (
                      <div
                        key={school.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-md border transition-colors",
                          isSelected && "bg-primary/5 border-primary",
                          !isSelected && "hover:bg-muted",
                          isDisabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Checkbox
                          id={`entity-${school.id}`}
                          checked={isSelected}
                          onCheckedChange={() => handleToggleEntity(school.id)}
                          disabled={isDisabled}
                        />
                        <label
                          htmlFor={`entity-${school.id}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{school.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {school.location && (
                                  <span className="text-xs text-muted-foreground">
                                    {school.location}
                                  </span>
                                )}
                                {school.status && (
                                  <Badge variant="outline" className="text-xs">
                                    {school.status}
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
            <AlertDialogTitle>Select All Schools?</AlertDialogTitle>
            <AlertDialogDescription>
              This will select {Math.min(filteredSchools.length, maxSelections)} schools
              {filteredSchools.length > maxSelections && 
                ` (limited to maximum of ${maxSelections})`
              }.
              {' '}You will send approximately {Math.min(filteredSchools.length, maxSelections)} messages.
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
