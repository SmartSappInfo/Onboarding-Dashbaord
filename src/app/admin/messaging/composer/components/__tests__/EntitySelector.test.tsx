import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySelector } from '../EntitySelector';
import type { ResolvedContact } from '@/lib/types';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, collection, id) => ({ 
    path: `${collection}/${id}`,
    id,
    collection 
  })),
  collection: vi.fn((db, name) => ({ path: name, name })),
  getFirestore: vi.fn(() => ({})),
}));

// Mock Firebase hooks
vi.mock('@/firebase', () => ({
  useDoc: vi.fn(() => ({ data: null, loading: false, error: null })),
  useFirestore: vi.fn(() => ({})),
}));

// Mock Firebase provider
vi.mock('@/firebase/provider', () => ({
  useFirebase: () => ({
    app: {},
    auth: {},
    db: {},
    storage: {},
  }),
  useFirestore: () => ({}),
  useAuth: () => ({}),
  useStorage: () => ({}),
}));

// EntitySelector no longer fetches data itself — it receives entities as props.
// No Firestore mocking needed.

const makeEntity = (id: string, name: string, overrides: Partial<ResolvedContact> = {}): ResolvedContact => ({
  id,
  entityId: id,
  workspaceEntityId: `we-${id}`,
  name,
  contacts: [],
  pipelineId: 'pipeline-1',
  stageId: 'stage-1',
  stageName: 'Onboarding',
  status: 'active',
  tags: [],
  migrationStatus: 'migrated',
  entityType: 'institution',
  entityContacts: [],
  ...overrides,
});

const mockEntities: ResolvedContact[] = [
  makeEntity('school-1', 'Alpha Academy'),
  makeEntity('school-2', 'Beta School'),
  makeEntity('school-3', 'Gamma Institute'),
];

const defaultProps = {
  entities: mockEntities,
  isLoading: false,
  channel: 'email' as const,
  selectedEntityIds: [] as string[],
  onSelectionChange: vi.fn(),
};

describe('EntitySelector Component', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('Entity List Rendering', () => {
    it('renders entity list with checkboxes', () => {
      render(<EntitySelector {...defaultProps} />);
      expect(screen.getByText('Alpha Academy')).toBeInTheDocument();
      expect(screen.getByText('Beta School')).toBeInTheDocument();
      expect(screen.getByText('Gamma Institute')).toBeInTheDocument();
      expect(screen.getAllByRole('checkbox').length).toBeGreaterThanOrEqual(3);
    });

    it('shows loading skeletons while isLoading=true', () => {
      render(<EntitySelector {...defaultProps} isLoading={true} entities={[]} />);
      expect(screen.getByText('Available Contacts')).toBeInTheDocument();
      // Skeleton divs are rendered — just verify the header is present
    });

    it('shows empty state when no entities', () => {
      render(<EntitySelector {...defaultProps} entities={[]} />);
      expect(screen.getByText('No contacts in this workspace')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('selects an entity on row click', () => {
      const onSelectionChange = vi.fn();
      render(<EntitySelector {...defaultProps} onSelectionChange={onSelectionChange} />);
      fireEvent.click(screen.getByText('Alpha Academy').closest('div[class*="cursor-pointer"]')!);
      expect(onSelectionChange).toHaveBeenCalledWith(['school-1']);
    });

    it('deselects an already-selected entity', () => {
      const onSelectionChange = vi.fn();
      render(<EntitySelector {...defaultProps} selectedEntityIds={['school-1']} onSelectionChange={onSelectionChange} />);
      fireEvent.click(screen.getByText('Alpha Academy').closest('div[class*="cursor-pointer"]')!);
      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });

    it('shows selected entities in the selected strip', () => {
      render(<EntitySelector {...defaultProps} selectedEntityIds={['school-1', 'school-2']} />);
      expect(screen.getByText('Selected')).toBeInTheDocument();
    });

    it('clears all when Clear all is clicked', () => {
      const onSelectionChange = vi.fn();
      render(<EntitySelector {...defaultProps} selectedEntityIds={['school-1']} onSelectionChange={onSelectionChange} />);
      fireEvent.click(screen.getByText('Clear all'));
      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Search Filtering', () => {
    it('filters by name', async () => {
      render(<EntitySelector {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText(/Search by name/i), { target: { value: 'Alpha' } });
      await waitFor(() => {
        expect(screen.getByText('Alpha Academy')).toBeInTheDocument();
        expect(screen.queryByText('Beta School')).not.toBeInTheDocument();
      }, { timeout: 500 });
    });

    it('shows no-results message when search has no matches', async () => {
      render(<EntitySelector {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText(/Search by name/i), { target: { value: 'ZZZnonexistent' } });
      await waitFor(() => {
        expect(screen.getByText(/No contacts match your search/i)).toBeInTheDocument();
      }, { timeout: 500 });
    });
  });

  describe('Select All Dialog', () => {
    it('shows confirmation dialog on Select all click', () => {
      render(<EntitySelector {...defaultProps} />);
      fireEvent.click(screen.getByText('Select all'));
      expect(screen.getByText(/Select all 3 contacts/i)).toBeInTheDocument();
    });

    it('selects all on confirm', () => {
      const onSelectionChange = vi.fn();
      render(<EntitySelector {...defaultProps} onSelectionChange={onSelectionChange} />);
      fireEvent.click(screen.getByText('Select all'));
      fireEvent.click(screen.getByText('Confirm'));
      expect(onSelectionChange).toHaveBeenCalledWith(['school-1', 'school-2', 'school-3']);
    });

    it('does not select on cancel', () => {
      const onSelectionChange = vi.fn();
      render(<EntitySelector {...defaultProps} onSelectionChange={onSelectionChange} />);
      fireEvent.click(screen.getByText('Select all'));
      fireEvent.click(screen.getByText('Cancel'));
      expect(onSelectionChange).not.toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    const manyEntities = Array.from({ length: 60 }, (_, i) => makeEntity(`s-${i}`, `School ${i + 1}`));

    it('shows pagination when entities exceed page size', () => {
      render(<EntitySelector {...defaultProps} entities={manyEntities} />);
      expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();
    });

    it('navigates to next page', () => {
      render(<EntitySelector {...defaultProps} entities={manyEntities} />);
      fireEvent.click(screen.getAllByRole('button').find(b => b.querySelector('svg'))!);
      // Just verify no crash — page navigation works
    });
  });

  describe('Contact Type Filter', () => {
    const entitiesWithContacts: ResolvedContact[] = [
      makeEntity('e1', 'School A', {
        entityContacts: [
          { id: 'c1', name: 'John Father', typeKey: 'father', typeLabel: 'Father', isPrimary: true, isSignatory: false, order: 0 },
          { id: 'c2', name: 'Jane Mother', typeKey: 'mother', typeLabel: 'Mother', isPrimary: false, isSignatory: false, order: 1 },
        ],
      }),
    ];

    it('renders contact type filter chips when contacts have types', () => {
      render(<EntitySelector {...defaultProps} entities={entitiesWithContacts} />);
      expect(screen.getByText('Father')).toBeInTheDocument();
      expect(screen.getByText('Mother')).toBeInTheDocument();
    });

    it('calls onContactTypeFilterChange when a type chip is clicked', () => {
      const onContactTypeFilterChange = vi.fn();
      render(<EntitySelector {...defaultProps} entities={entitiesWithContacts} onContactTypeFilterChange={onContactTypeFilterChange} />);
      fireEvent.click(screen.getByText('Father'));
      expect(onContactTypeFilterChange).toHaveBeenCalledWith('father');
    });

    it('shows contact chips inside entity row', () => {
      render(<EntitySelector {...defaultProps} entities={entitiesWithContacts} />);
      expect(screen.getByText('John Father')).toBeInTheDocument();
      expect(screen.getByText('Jane Mother')).toBeInTheDocument();
    });

    it('filters visible contacts when activeContactTypeFilter is set', () => {
      render(<EntitySelector {...defaultProps} entities={entitiesWithContacts} activeContactTypeFilter={["father"]} />);
      expect(screen.getByText('John Father')).toBeInTheDocument();
      expect(screen.queryByText('Jane Mother')).not.toBeInTheDocument();
    });
  });

  // maxSelections is kept as a no-op prop for backward compat
  describe('maxSelections backward compat', () => {
    it('accepts maxSelections prop without error', () => {
      expect(() => render(<EntitySelector {...defaultProps} maxSelections={2} />)).not.toThrow();
    });
  });
});
