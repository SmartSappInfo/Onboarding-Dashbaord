'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { WorkspaceEntity } from '@/lib/types';

interface UseEntitySelectionProps {
  entities: WorkspaceEntity[];
  currentPage: number;
  pageSize: number;
  onPageReset?: () => void;
  serverPaginated?: boolean;
  totalCount?: number;
  allFilteredIds?: string[];
}

export function useEntitySelection({
  entities,
  currentPage,
  pageSize,
  onPageReset,
  serverPaginated = false,
  totalCount = 0,
  allFilteredIds = [],
}: UseEntitySelectionProps) {
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);

  // Calculate paginated subset
  const paginatedEntities = useMemo(() => {
    if (serverPaginated) return entities;
    const start = (currentPage - 1) * pageSize;
    return entities.slice(start, start + pageSize);
  }, [entities, currentPage, pageSize, serverPaginated]);

  // Total pages count
  const totalPages = useMemo(() => {
    if (serverPaginated) {
      return Math.ceil(totalCount / pageSize) || 1;
    }
    return Math.ceil(entities.length / pageSize) || 1;
  }, [entities, pageSize, serverPaginated, totalCount]);

  // Clear selection helper
  const clearSelection = useCallback(() => {
    setSelectedEntityIds([]);
  }, []);

  // Sync / safety check: If entities list shrinks or workspace changes, clear selected IDs that no longer exist
  useEffect(() => {
    if (selectedEntityIds.length === 0) return;
    const referenceList = allFilteredIds.length > 0 ? allFilteredIds : entities.map(e => e.id);
    const entityIdSet = new Set(referenceList);
    setSelectedEntityIds(prev => prev.filter(id => entityIdSet.has(id)));
  }, [entities, allFilteredIds]);

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
    const referenceList = allFilteredIds.length > 0 ? allFilteredIds : entities.map(e => e.id);
    const otherPageIds = referenceList.filter(id => !pageIds.has(id));
    setSelectedEntityIds(otherPageIds);
  }, [entities, paginatedEntities, allFilteredIds]);

  // Select all sorted/filtered items
  const selectAllInView = useCallback(() => {
    const referenceList = allFilteredIds.length > 0 ? allFilteredIds : entities.map(e => e.id);
    setSelectedEntityIds(referenceList);
  }, [entities, allFilteredIds]);

  // Memoized selection matrices
  const selectedCount = selectedEntityIds.length;

  const isAllSelectedOnPage = useMemo(() => {
    if (paginatedEntities.length === 0) return false;
    return paginatedEntities.every(e => selectedEntityIds.includes(e.id));
  }, [paginatedEntities, selectedEntityIds]);

  const isAllSelectedInView = useMemo(() => {
    const referenceList = allFilteredIds.length > 0 ? allFilteredIds : entities.map(e => e.id);
    if (referenceList.length === 0) return false;
    return referenceList.length === selectedCount && referenceList.every(id => selectedEntityIds.includes(id));
  }, [entities, selectedCount, selectedEntityIds, allFilteredIds]);

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
