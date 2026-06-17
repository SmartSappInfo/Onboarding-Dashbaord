import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySelector } from '../EntitySelector';

// EntitySelector is now search-backed: it reads paginated results from
// useEntitySearch, resolves selected rows via useEntityResolver, and pulls
// contact-type chips from getEffectiveContactTypes. Mock those seams.
const h = vi.hoisted(() => ({
  search: { results: [] as any[], isLoading: false, hasMore: false, loadMore: vi.fn() },
  resolver: { entitiesById: new Map<string, any>(), resolveIds: vi.fn() },
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, collection, id) => ({ path: `${collection}/${id}`, id, collection })),
  collection: vi.fn((db, name) => ({ path: name, name })),
  getFirestore: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => null })),
}));

vi.mock('@/hooks/use-entity-search', () => ({ useEntitySearch: () => h.search }));
vi.mock('@/context/EntityCacheContext', () => ({ useEntityResolver: () => h.resolver }));
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    activeOrganizationId: 'org1',
    activeWorkspaceId: 'ws1',
    activeWorkspace: { contactScope: 'institution' },
  }),
}));
vi.mock('@/lib/contact-type-actions', () => ({
  getEffectiveContactTypes: vi.fn(async () => [
    { key: 'father', label: 'Father', active: true },
    { key: 'mother', label: 'Mother', active: true },
  ]),
}));
vi.mock('@/firebase', () => ({
  useDoc: vi.fn(() => ({ data: null, loading: false, error: null })),
  useFirestore: vi.fn(() => ({})),
}));
vi.mock('@/firebase/provider', () => ({
  useFirebase: () => ({ app: {}, auth: {}, db: {}, storage: {} }),
  useFirestore: () => ({}),
  useAuth: () => ({}),
  useStorage: () => ({}),
}));

const makeEntity = (id: string, name: string, overrides: Record<string, any> = {}) => ({
  id,
  entityId: id,
  displayName: name,
  entityType: 'institution',
  workspaceId: 'ws1',
  organizationId: 'org1',
  status: 'active',
  workspaceTags: [],
  addedAt: '',
  updatedAt: '',
  entityContacts: [],
  ...overrides,
});

const mockEntities = [
  makeEntity('school-1', 'Alpha Academy'),
  makeEntity('school-2', 'Beta School'),
  makeEntity('school-3', 'Gamma Institute'),
];

const defaultProps = {
  channel: 'email' as const,
  selectedEntityIds: [] as string[],
  onSelectionChange: vi.fn(),
};

describe('EntitySelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.search = { results: [], isLoading: false, hasMore: false, loadMore: vi.fn() };
    h.resolver = { entitiesById: new Map(), resolveIds: vi.fn() };
  });

  describe('Entity List Rendering', () => {
    it('renders entity list with checkboxes', () => {
      h.search.results = mockEntities;
      render(<EntitySelector {...defaultProps} />);
      expect(screen.getByText('Alpha Academy')).toBeInTheDocument();
      expect(screen.getByText('Beta School')).toBeInTheDocument();
      expect(screen.getByText('Gamma Institute')).toBeInTheDocument();
      expect(screen.getAllByRole('checkbox').length).toBeGreaterThanOrEqual(3);
    });

    it('shows loading skeletons while loading with no results yet', () => {
      h.search = { results: [], isLoading: true, hasMore: false, loadMore: vi.fn() };
      render(<EntitySelector {...defaultProps} />);
      expect(screen.getByText('Available Contacts')).toBeInTheDocument();
    });

    it('shows empty state when no results', () => {
      render(<EntitySelector {...defaultProps} />);
      expect(screen.getByText('No contacts in this workspace')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('selects an entity on row click', () => {
      h.search.results = mockEntities;
      const onSelectionChange = vi.fn();
      render(<EntitySelector {...defaultProps} onSelectionChange={onSelectionChange} />);
      fireEvent.click(screen.getByText('Alpha Academy').closest('div[class*="cursor-pointer"]')!);
      expect(onSelectionChange).toHaveBeenCalledWith(['school-1']);
    });

    it('deselects an already-selected entity', () => {
      h.search.results = mockEntities;
      const onSelectionChange = vi.fn();
      render(<EntitySelector {...defaultProps} selectedEntityIds={['school-1']} onSelectionChange={onSelectionChange} />);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });

    it('shows selected entities in the selected strip (resolved by id)', () => {
      h.resolver.entitiesById = new Map([
        ['school-1', mockEntities[0]],
        ['school-2', mockEntities[1]],
      ]);
      render(<EntitySelector {...defaultProps} selectedEntityIds={['school-1', 'school-2']} />);
      expect(screen.getByText('Selected')).toBeInTheDocument();
    });

    it('clears all when Clear all is clicked', () => {
      h.search.results = mockEntities;
      const onSelectionChange = vi.fn();
      render(<EntitySelector {...defaultProps} selectedEntityIds={['school-1']} onSelectionChange={onSelectionChange} />);
      fireEvent.click(screen.getByText('Clear all'));
      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Select All Loaded Dialog', () => {
    it('shows confirmation dialog on Select all loaded click', () => {
      h.search.results = mockEntities;
      render(<EntitySelector {...defaultProps} />);
      fireEvent.click(screen.getByText('Select all loaded'));
      expect(screen.getByText(/Select all 3 loaded contacts/i)).toBeInTheDocument();
    });

    it('selects all loaded on confirm', () => {
      h.search.results = mockEntities;
      const onSelectionChange = vi.fn();
      render(<EntitySelector {...defaultProps} onSelectionChange={onSelectionChange} />);
      fireEvent.click(screen.getByText('Select all loaded'));
      fireEvent.click(screen.getByText('Confirm'));
      expect(onSelectionChange).toHaveBeenCalledWith(['school-1', 'school-2', 'school-3']);
    });

    it('does not select on cancel', () => {
      h.search.results = mockEntities;
      const onSelectionChange = vi.fn();
      render(<EntitySelector {...defaultProps} onSelectionChange={onSelectionChange} />);
      fireEvent.click(screen.getByText('Select all loaded'));
      fireEvent.click(screen.getByText('Cancel'));
      expect(onSelectionChange).not.toHaveBeenCalled();
    });
  });

  describe('Contact Type Filter', () => {
    const entitiesWithContacts = [
      makeEntity('e1', 'School A', {
        entityContacts: [
          { id: 'c1', name: 'John Father', typeKey: 'father', typeLabel: 'Father', isPrimary: true, isSignatory: false, order: 0 },
          { id: 'c2', name: 'Jane Mother', typeKey: 'mother', typeLabel: 'Mother', isPrimary: false, isSignatory: false, order: 1 },
        ],
      }),
    ];

    it('renders contact-type filter chips from effective contact types', async () => {
      h.search.results = entitiesWithContacts;
      render(<EntitySelector {...defaultProps} />);
      // Chips load async via getEffectiveContactTypes.
      expect(await screen.findByText('Father')).toBeInTheDocument();
      expect(await screen.findByText('Mother')).toBeInTheDocument();
    });

    it('calls onContactTypeFilterChange when a type chip is clicked', async () => {
      h.search.results = entitiesWithContacts;
      const onContactTypeFilterChange = vi.fn();
      render(<EntitySelector {...defaultProps} onContactTypeFilterChange={onContactTypeFilterChange} />);
      fireEvent.click(await screen.findByText('Father'));
      expect(onContactTypeFilterChange).toHaveBeenCalledWith(['father']);
    });

    it('shows contacts inside entity row', () => {
      h.search.results = entitiesWithContacts;
      render(<EntitySelector {...defaultProps} />);
      expect(screen.getByText(/John Father, Jane Mother/i)).toBeInTheDocument();
    });

    it('filters visible contacts when activeContactTypeFilter is set', () => {
      h.search.results = entitiesWithContacts;
      render(<EntitySelector {...defaultProps} activeContactTypeFilter={['father']} />);
      expect(screen.getByText('John Father')).toBeInTheDocument();
      expect(screen.queryByText('Jane Mother')).not.toBeInTheDocument();
    });
  });

  describe('Load more', () => {
    it('renders a Load more control when hasMore is true', () => {
      h.search = { results: mockEntities, isLoading: false, hasMore: true, loadMore: vi.fn() };
      render(<EntitySelector {...defaultProps} />);
      expect(screen.getByText('Load more')).toBeInTheDocument();
    });
  });

  describe('maxSelections backward compat', () => {
    it('accepts maxSelections prop without error', () => {
      h.search.results = mockEntities;
      expect(() => render(<EntitySelector {...defaultProps} maxSelections={2} />)).not.toThrow();
    });
  });
});
