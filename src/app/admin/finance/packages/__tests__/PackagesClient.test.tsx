/**
 * @fileOverview Unit tests for PackagesClient UI title area and tab layout
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import PackagesClient from '../PackagesClient';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ id: 'mock_collection' })),
  query: vi.fn(() => ({ id: 'mock_query' })),
  where: vi.fn(),
  orderBy: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
}));

// Mock dependencies
vi.mock('@/firebase', () => ({
  useFirestore: () => ({ id: 'mock_firestore' }),
  useUser: () => ({ user: { uid: 'test-user' } }),
  useCollection: () => ({ data: [], isLoading: false }),
  useMemoFirebase: (fn: () => unknown) => fn(),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'test-workspace',
    allowedWorkspaces: [{ id: 'test-workspace', name: 'Test Workspace' }],
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  useConfirm: () => vi.fn(),
}));

vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({
    singular: 'Student',
    plural: 'Students',
  }),
}));

vi.mock('@/app/actions/product-actions', () => ({
  listProductsAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createProductAction: vi.fn().mockResolvedValue({ success: true }),
  updateProductAction: vi.fn().mockResolvedValue({ success: true }),
  deleteProductAction: vi.fn().mockResolvedValue({ success: true }),
  listProductCategoriesAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createProductCategoryAction: vi.fn().mockResolvedValue({ success: true }),
  updateProductCategoryAction: vi.fn().mockResolvedValue({ success: true }),
  deleteProductCategoryAction: vi.fn().mockResolvedValue({ success: true }),
  listPriceBooksAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createPriceBookAction: vi.fn().mockResolvedValue({ success: true }),
  updatePriceBookAction: vi.fn().mockResolvedValue({ success: true }),
  deletePriceBookAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe('PackagesClient Title Area & Tabs Invariants', () => {
  it('renders the header title directly without an enclosing card wrapper', async () => {
    await act(async () => {
      render(<PackagesClient />);
    });

    // Header title must be present
    const heading = screen.getByRole('heading', { level: 1, name: /Commercial & Pricing Hub/i });
    expect(heading).toBeInTheDocument();

    // The direct parent or grandparent of the heading should NOT have card classes (bg-card border shadow-sm p-6)
    const headerRow = heading.closest('div.flex-col');
    expect(headerRow).toBeInTheDocument();
    expect(headerRow?.className).not.toContain('bg-card');
    expect(headerRow?.className).not.toContain('border-border/80');
    expect(headerRow?.className).not.toContain('p-6');
  });

  it('renders tabs aligned to the left in a full-width container', async () => {
    let container: HTMLElement;
    await act(async () => {
      const res = render(<PackagesClient />);
      container = res.container;
    });

    // TabsList must have w-full and justify-start
    const tabsList = container!.querySelector('[role="tablist"]');
    expect(tabsList).toBeInTheDocument();
    expect(tabsList?.className).toContain('justify-start');
    expect(tabsList?.className).toContain('w-full');

    // All tab triggers must be rendered
    expect(screen.getByRole('tab', { name: /Products & Services/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Subscription Tiers/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Price Books/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Categories/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Commercial Analytics & AI/i })).toBeInTheDocument();
  });
});
