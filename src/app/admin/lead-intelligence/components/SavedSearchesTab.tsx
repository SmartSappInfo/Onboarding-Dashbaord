'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { SavedSearch } from '@/lib/lead-intelligence/types';

interface SavedSearchesTabProps {
  savedSearches: SavedSearch[];
  onRunSearch: (s: SavedSearch) => void;
}

export default function SavedSearchesTab({
  savedSearches,
  onRunSearch
}: SavedSearchesTabProps) {
  return (
    <Card className="bg-card/35 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="text-sm font-bold uppercase tracking-wider">Saved Search Configurations</CardTitle>
        <CardDescription className="text-xs">Quickly run or edit your saved location discovery filters.</CardDescription>
      </CardHeader>
      <CardContent className="text-xs">
        {savedSearches.length === 0 ? (
          <div className="text-xs text-muted-foreground py-10 text-center">No saved search configurations yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedSearches.map((s) => (
              <div key={s.id} className="p-4 bg-muted/10 border border-border/40 rounded-xl flex justify-between items-center">
                <div>
                  <div className="font-bold text-xs">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Region: {s.filters.city || 'All'} • Industry: {s.filters.industry || 'All'}
                  </div>
                </div>
                <Button 
                  onClick={() => onRunSearch(s)}
                  className="h-8 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 text-xs rounded-lg active:scale-[0.97]"
                >
                  Run Search
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
