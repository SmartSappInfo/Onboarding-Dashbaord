'use client';

/**
 * Saved Searches Tab
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Fast Query Loading: Populates Omnisearch filters and triggers instant execution.
 * 2. Responsive Cards: Displays filters, city, industry, and created timestamp.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookmarkCheck, Search, Calendar, MapPin, Building2 } from 'lucide-react';
import type { SavedSearch } from '@/lib/lead-intelligence/types';

interface SavedSearchesTabProps {
  savedSearches: SavedSearch[];
  onRunSearch: (s: SavedSearch) => void;
}

export const SavedSearchesTab: React.FC<SavedSearchesTabProps> = ({
  savedSearches,
  onRunSearch
}) => {
  return (
    <Card className="bg-card border border-border/70 shadow-sm rounded-2xl">
      <CardHeader className="p-6 border-b border-border/50">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
          <BookmarkCheck className="h-5 w-5 text-primary" /> Saved Search Configurations
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Quickly re-run previous location discovery filters and monitor new incoming opportunities.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {savedSearches.length === 0 ? (
          <div className="text-xs text-muted-foreground py-12 text-center space-y-2">
            <BookmarkCheck className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p>No saved searches saved yet.</p>
            <p className="text-[11px]">Save search criteria using the bookmark icon in the Omnisearch ribbon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedSearches.map((s) => (
              <div 
                key={s.id} 
                className="p-4 bg-muted/20 border border-border/70 rounded-xl flex flex-col justify-between space-y-3 hover:border-primary/40 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-foreground truncate">{s.name}</h4>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3" />
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {s.filters.city && (
                      <Badge variant="outline" className="text-[10px] bg-background gap-1">
                        <MapPin className="w-2.5 h-2.5 text-muted-foreground" />
                        {s.filters.city}
                      </Badge>
                    )}
                    {s.filters.industry && (
                      <Badge variant="outline" className="text-[10px] bg-background gap-1">
                        <Building2 className="w-2.5 h-2.5 text-muted-foreground" />
                        {s.filters.industry}
                      </Badge>
                    )}
                    {s.filters.ratingMin !== undefined && (
                      <Badge variant="outline" className="text-[10px] bg-background">
                        {s.filters.ratingMin}+ ★
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-border/40">
                  <Button 
                    size="sm"
                    onClick={() => onRunSearch(s)}
                    className="h-8 px-3.5 bg-primary text-primary-foreground font-medium text-xs rounded-lg active:scale-[0.97] flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Run Search</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
export default SavedSearchesTab;
