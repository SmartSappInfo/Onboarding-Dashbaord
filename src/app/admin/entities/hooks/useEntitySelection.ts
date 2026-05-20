'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { WorkspaceEntity } from '@/lib/types';

interface UseEntitySelectionProps {
  entities: WorkspaceEntity[];
  currentPage: number;
  pageSize: number;
  onPageReset?: () => void;
}

export function useEntitySelection({
  entities,
  currentPage,
  pageSize,
  onPageReset,
}: UseEntitySelectionProps) {
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);

  // Calculate paginated subset
  const paginatedEntities = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return entities.slice(start, start + pageSize);
  }, [entities, currentPage, pageSize]);

  // Total pages count
  const totalPages = useMemo(() => {
    return Math.ceil(entities.length / pageSize) || 1;
  }, [entities, pageSize]);

  // Clear selection helper
  const clearSelection = useCallback(() => {
    setSelectedEntityIds([]);
  }, []);

  // Sync / safety check: If entities list shrinks or workspace changes, clear selected IDs that no longer exist
  useEffect(() => {
    if (selectedEntityIds.length === 0) return;
    const entityIdSet = new Set(entities.map(e => e.id));
    setSelectedEntityIds(prev => prev.filter(id => entityIdSet.has(id)));
  }, [entities]);

  // Reset page size / filter resets
  const resetSelectionAndPage = useCallback(() => {
    clearSelection();
    onPageReset?.();
  }, [clearSelection, onPageReset]);

  // Toggle single item selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedEntityIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, []);

  // Select all items currently visible on the active page
  const selectCurrentPage = useCallback(() => {
    setSelectedEntityIds(paginatedEntities.map(e => e.id));
  }, [paginatedEntities]);

  // Select all items EXCEPT those on the current page (User's custom rule)
  const selectOtherPages = useCallback(() => {
    const pageIds = new Set(paginatedEntities.map(e => e.id));
    const otherPageIds = entities
      .filter(e => !pageIds.has(e.id))
      .map(e => e.id);
    setSelectedEntityIds(otherPageIds);
  }, [entities, paginatedEntities]);

  // Select all sorted/filtered items
  const selectAllInView = useCallback(() => {
    setSelectedEntityIds(entities.map(e => e.id));
  }, [entities]);

  // Memoized selection matrices
  const selectedCount = selectedEntityIds.length;

  const isAllSelectedOnPage = useMemo(() => {
    if (paginatedEntities.length === 0) return false;
    return paginatedEntities.every(e => selectedEntityIds.includes(e.id));
  }, [paginatedEntities, selectedEntityIds]);

  const isAllSelectedInView = useMemo(() => {
    if (entities.length === 0) return false;
    return entities.length === selectedCount && entities.every(e => selectedEntityIds.includes(e.id));
  }, [entities, selectedCount, selectedEntityIds]);

  const isIndeterminateOnPage = useMemo(() => {
    if (isAllSelectedOnPage || selectedCount === 0) return false;
    return paginatedEntities.some(e => selectedEntityIds.includes(e.id));
  }, [paginatedEntities, selectedEntityIds, isAllSelectedOnPage, selectedCount]);

  return {
    selectedEntityIds,
    setSelectedEntityIds,
    paginatedEntities,
    totalPages,
    selectedCount,
    isAllSelectedOnPage,
    isAllSelectedInView,
    isIndeterminateOnPage,
    toggleSelect,
    selectCurrentPage,
    selectOtherPages,
    selectAllInView,
    clearSelection,
    resetSelectionAndPage,
  };
}
