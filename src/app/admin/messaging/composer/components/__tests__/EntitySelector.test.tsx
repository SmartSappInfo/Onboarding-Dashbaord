import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySelector } from '../EntitySelector';
import type { School } from '@/lib/types';

// Mock Firebase Firestore functions
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db: any, path: string) => ({ path })),
  query: vi.fn((...args: any[]) => ({ type: 'query', args })),
  orderBy: vi.fn((field: string, direction: string) => ({ field, direction })),
  where: vi.fn((field: string, op: string, value: any) => ({ field, op, value })),
}));

// Mock Firebase hooks
const mockUseFirestore = vi.fn();
const mockUseCollection = vi.fn();

vi.mock('@/firebase', () => ({
  useFirestore: () => mockUseFirestore(),
  useCollection: (query: any) => mockUseCollection(query),
}));

describe('EntitySelector Component', () => {
  const mockSchools: School[] = [
    {
      id: 'school-1',
      name: 'Alpha Academy',
      location: 'Accra',
      status: 'Active',
      slug: 'alpha-academy',
      workspaceIds: ['workspace-1'],
      schoolStatus: 'active',
      pipelineId: 'pipeline-1',
      focalPersons: [],
      entityContacts: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'school-2',
      name: 'Beta School',
      location: 'Kumasi',
      status: 'Active',
      slug: 'beta-school',
      workspaceIds: ['workspace-1'],
      schoolStatus: 'active',
      pipelineId: 'pipeline-1',
      focalPersons: [],
      entityContacts: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'school-3',
      name: 'Gamma Institute',
      location: 'Accra',
      status: 'Inactive',
      slug: 'gamma-institute',
      workspaceIds: ['workspace-1'],
      schoolStatus: 'inactive',
      pipelineId: 'pipeline-1',
      focalPersons: [],
      entityContacts: [],
      createdAt: new Date().toISOString(),
    },
  ];

  const mockOnSelectionChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock firestore instance
    mockUseFirestore.mockReturnValue({ type: 'firestore' });
    
    // Default mock implementation for useCollection
    mockUseCollection.mockReturnValue({
      data: mockSchools,
      loading: false,
      error: null,
    });
  });

  describe('Entity List Rendering', () => {
    it('should render entity list with checkboxes', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Check that all schools are rendered
      expect(screen.getByText('Alpha Academy')).toBeInTheDocument();
      expect(screen.getByText('Beta School')).toBeInTheDocument();
      expect(screen.getByText('Gamma Institute')).toBeInTheDocument();

      // Check that checkboxes are present
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(3);
    });

    it('should display loading state while fetching entities', () => {
      mockUseCollection.mockReturnValue({
        data: null,
        loading: true,
        error: null,
      });

      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Check that "Available Schools" header is present
      expect(screen.getByText('Available Contacts')).toBeInTheDocument();
      
      // Check for loading skeletons (animated pulse elements)
      const container = screen.getByText('Available Contacts').closest('div');
      expect(container).toBeInTheDocument();
    });

    it('should display empty state when no entities available', () => {
      mockUseCollection.mockReturnValue({
        data: [],
        loading: false,
        error: null,
      });

      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(screen.getByText('No contacts available')).toBeInTheDocument();
    });
  });

  describe('Checkbox Selection/Deselection', () => {
    it('should select an entity when checkbox is clicked', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const checkbox = screen.getByLabelText(/Alpha Academy/i);
      fireEvent.click(checkbox);

      expect(mockOnSelectionChange).toHaveBeenCalledWith(['school-1']);
    });

    it('should deselect an entity when checkbox is clicked again', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={['school-1']}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const checkbox = screen.getByLabelText(/Alpha Academy/i);
      fireEvent.click(checkbox);

      expect(mockOnSelectionChange).toHaveBeenCalledWith([]);
    });

    it('should allow multiple entities to be selected', () => {
      const { rerender } = render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Select first entity
      const checkbox1 = screen.getByLabelText(/Alpha Academy/i);
      fireEvent.click(checkbox1);
      expect(mockOnSelectionChange).toHaveBeenCalledWith(['school-1']);

      // Rerender with first entity selected
      rerender(
        <EntitySelector
          channel="email"
          selectedEntityIds={['school-1']}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Select second entity
      const checkbox2 = screen.getByLabelText(/Beta School/i);
      fireEvent.click(checkbox2);
      expect(mockOnSelectionChange).toHaveBeenCalledWith(['school-1', 'school-2']);
    });

    it('should display selected entities in the selected section', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={['school-1', 'school-2']}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Check selected schools section
      const selectedSection = screen.getByText('Selected Contacts').closest('div');
      expect(selectedSection).toBeInTheDocument();
      
      // Both schools should appear in selected section
      const selectedCards = screen.getAllByText(/Alpha Academy|Beta School/);
      expect(selectedCards.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Search Filtering', () => {
    it('should filter entities by name', async () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search by name/i);
      fireEvent.change(searchInput, { target: { value: 'Alpha' } });

      // Wait for debounce
      await waitFor(() => {
        expect(screen.getByText('Alpha Academy')).toBeInTheDocument();
        expect(screen.queryByText('Beta School')).not.toBeInTheDocument();
      }, { timeout: 500 });
    });

    it('should filter entities by location', async () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search by name/i);
      fireEvent.change(searchInput, { target: { value: 'Kumasi' } });

      // Wait for debounce
      await waitFor(() => {
        expect(screen.getByText('Beta School')).toBeInTheDocument();
        expect(screen.queryByText('Alpha Academy')).not.toBeInTheDocument();
      }, { timeout: 500 });
    });

    it('should filter entities by status', async () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search by name/i);
      fireEvent.change(searchInput, { target: { value: 'inactive' } });

      // Wait for debounce
      await waitFor(() => {
        expect(screen.getByText('Gamma Institute')).toBeInTheDocument();
        expect(screen.queryByText('Alpha Academy')).not.toBeInTheDocument();
      }, { timeout: 500 });
    });

    it('should clear search when X button is clicked', async () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search by name/i);
      fireEvent.change(searchInput, { target: { value: 'Alpha' } });

      // Wait for debounce
      await waitFor(() => {
        expect(screen.queryByText('Beta School')).not.toBeInTheDocument();
      }, { timeout: 500 });

      // Click clear button
      const clearButton = searchInput.parentElement?.querySelector('button');
      if (clearButton) {
        fireEvent.click(clearButton);
      }

      // All schools should be visible again
      await waitFor(() => {
        expect(screen.getByText('Alpha Academy')).toBeInTheDocument();
        expect(screen.getByText('Beta School')).toBeInTheDocument();
      }, { timeout: 500 });
    });

    it('should display "no results" message when search has no matches', async () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search by name/i);
      fireEvent.change(searchInput, { target: { value: 'NonexistentSchool' } });

      // Wait for debounce
      await waitFor(() => {
        expect(screen.getByText(/No contacts found matching your search/i)).toBeInTheDocument();
      }, { timeout: 500 });
    });
  });

  describe('Select All Confirmation Dialog', () => {
    it('should show confirmation dialog when "Select All" is clicked', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);

      expect(screen.getByText('Select All Contacts?')).toBeInTheDocument();
      expect(screen.getByText(/This will select 3 matching contacts/i)).toBeInTheDocument();
    });

    it('should select all entities when confirmed', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);

      const confirmButton = screen.getByText('Confirm Selection');
      fireEvent.click(confirmButton);

      expect(mockOnSelectionChange).toHaveBeenCalledWith(['school-1', 'school-2', 'school-3']);
    });

    it('should not select entities when dialog is cancelled', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnSelectionChange).not.toHaveBeenCalled();
    });
  });

  describe('Pagination Controls', () => {
    beforeEach(() => {
      // Create 60 schools to test pagination (50 per page)
      const manySchools: School[] = Array.from({ length: 60 }, (_, i) => ({
        id: `school-${i + 1}`,
        name: `School ${i + 1}`,
        location: 'Test Location',
        status: 'Active',
        slug: `school-${i + 1}`,
        workspaceIds: ['workspace-1'],
        schoolStatus: 'active',
        pipelineId: 'pipeline-1',
        focalPersons: [],
        entityContacts: [],
        createdAt: new Date().toISOString(),
      }));

      mockUseCollection.mockReturnValue({
        data: manySchools,
        loading: false,
        error: null,
      });
    });

    it('should display pagination controls when entities exceed page size', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    it('should navigate to next page when Next button is clicked', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      expect(screen.getByText(/Page 2 of 2/i)).toBeInTheDocument();
    });

    it('should navigate to previous page when Previous button is clicked', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Go to page 2
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      // Go back to page 1
      const previousButton = screen.getByText('Previous');
      fireEvent.click(previousButton);

      expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();
    });

    it('should disable Previous button on first page', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const previousButton = screen.getByText('Previous').closest('button');
      expect(previousButton).toBeDisabled();
    });

    it('should disable Next button on last page', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Navigate to last page
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      const nextButtonAfter = screen.getByText('Next').closest('button');
      expect(nextButtonAfter).toBeDisabled();
    });
  });

  describe('Maximum Selection Limit', () => {
    it('should enforce maximum selection limit', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={['school-1', 'school-2']}
          onSelectionChange={mockOnSelectionChange}
          maxSelections={2}
        />
      );

      // Try to select third entity
      const checkbox = screen.getByLabelText(/Gamma Institute/i);
      fireEvent.click(checkbox);

      // Should not call onSelectionChange because limit is reached
      expect(mockOnSelectionChange).not.toHaveBeenCalled();
    });

    it('should display warning when maximum selection limit is reached', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={['school-1', 'school-2']}
          onSelectionChange={mockOnSelectionChange}
          maxSelections={2}
        />
      );

      expect(screen.getByText(/Maximum selection limit of 2 contacts reached/i)).toBeInTheDocument();
    });

    it('should disable "Select All" button when at maximum selection limit', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={['school-1', 'school-2', 'school-3']}
          onSelectionChange={mockOnSelectionChange}
          maxSelections={3}
        />
      );

      const selectAllButton = screen.getByText('Select All').closest('button');
      expect(selectAllButton).toBeDisabled();
    });

    it('should display selection count with maximum limit', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={['school-1']}
          onSelectionChange={mockOnSelectionChange}
          maxSelections={100}
        />
      );

      expect(screen.getByText('1 / 100 selected')).toBeInTheDocument();
    });
  });

  describe('Remove Entity Functionality', () => {
    it('should remove entity when Remove button is clicked', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={['school-1', 'school-2']}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Find the selected schools section
      const selectedSection = screen.getByText('Selected Contacts').closest('div');
      expect(selectedSection).toBeInTheDocument();

      // Find all remove buttons (X buttons)
      const removeButtons = screen.getAllByRole('button').filter(
        button => button.querySelector('svg') && button.className.includes('h-6')
      );

      // Click the first remove button
      if (removeButtons.length > 0) {
        fireEvent.click(removeButtons[0]);
        expect(mockOnSelectionChange).toHaveBeenCalled();
      }
    });

    it('should clear all selections when "Clear All" button is clicked', () => {
      render(
        <EntitySelector
          channel="email"
          selectedEntityIds={['school-1', 'school-2']}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const clearAllButton = screen.getByText('Clear All');
      fireEvent.click(clearAllButton);

      expect(mockOnSelectionChange).toHaveBeenCalledWith([]);
    });
  });
});
