import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MigrationCard } from '../MigrationCard';
import type { 
  FetchResult, 
  MigrationResult, 
  VerificationResult, 
  RollbackResult 
} from '@/lib/migration-types';

/**
 * Integration Tests for MigrationCard Component
 * 
 * These tests validate:
 * - Migration card displays correct status
 * - Action buttons trigger correct operations
 * - Progress updates in real-time
 * - Error display and logging
 * 
 * Requirements: 26.2
 */

describe('MigrationCard Integration Tests', () => {
  const mockHandlers = {
    onFetch: vi.fn<[], Promise<FetchResult>>(),
    onEnrichAndRestore: vi.fn<[], Promise<MigrationResult>>(),
    onVerify: vi.fn<[], Promise<VerificationResult>>(),
    onRollback: vi.fn<[], Promise<RollbackResult>>()
  };

  const defaultProps = {
    featureName: 'Tasks',
    collectionName: 'tasks',
    description: 'Migrate task records to use entityId',
    status: 'not_started' as const,
    totalRecords: 100,
    migratedRecords: 0,
    unmigratedRecords: 100,
    failedRecords: 0,
    ...mockHandlers
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Status Display Integration', () => {
    it('should display correct status badge for not_started state', () => {
      render(<MigrationCard {...defaultProps} status="not_started" />);
      
      const badge = screen.getByText('Not Started');
      expect(badge).toBeInTheDocument();
    });

    it('should display correct status badge for in_progress state', () => {
      render(<MigrationCard {...defaultProps} status="in_progress" />);
      
      const badge = screen.getByText('In Progress');
      expect(badge).toBeInTheDocument();
    });

    it('should display correct status badge for completed state', () => {
      render(<MigrationCard {...defaultProps} status="completed" />);
      
      const badge = screen.getByText('Completed');
      expect(badge).toBeInTheDocument();
    });

    it('should display correct status badge for failed state', () => {
      render(<MigrationCard {...defaultProps} status="failed" />);
      
      // Use getAllByText since "Failed" appears in both badge and record counts
      const failedElements = screen.getAllByText('Failed');
      expect(failedElements.length).toBeGreaterThan(0);
      
      // Verify the badge specifically
      const badge = failedElements.find(el => el.classList.contains('bg-rose-50'));
      expect(badge).toBeInTheDocument();
    });

    it('should update record counts dynamically', () => {
      const { rerender } = render(<MigrationCard {...defaultProps} />);
      
      // Initial state
      expect(screen.getByText('Migrated')).toBeInTheDocument();
      
      // Update to show progress
      rerender(<MigrationCard {...defaultProps} migratedRecords={50} unmigratedRecords={50} />);
      
      const updatedMigrated = screen.getAllByText('50').filter(el => 
        el.closest('.text-emerald-600')
      );
      expect(updatedMigrated.length).toBeGreaterThan(0);
    });
  });

  describe('Action Button Integration', () => {
    it('should trigger fetch operation and display results', async () => {
      const mockFetchResult: FetchResult = {
        collection: 'tasks',
        totalRecords: 100,
        recordsToMigrate: 75,
        sampleRecords: [
          { id: 'task1', schoolId: 'school1', title: 'Test Task 1' },
          { id: 'task2', schoolId: 'school2', title: 'Test Task 2' }
        ],
        invalidRecords: [
          { id: 'task3', reason: 'Missing schoolId' }
        ]
      };
      
      mockHandlers.onFetch.mockResolvedValue(mockFetchResult);
      
      render(<MigrationCard {...defaultProps} />);
      
      const fetchButton = screen.getByRole('button', { name: /fetch/i });
      fireEvent.click(fetchButton);
      
      // Verify loading state
      await waitFor(() => {
        expect(fetchButton).toBeDisabled();
      });
      
      // Verify operation was called
      expect(mockHandlers.onFetch).toHaveBeenCalledTimes(1);
      
      // Verify results are displayed
      await waitFor(() => {
        expect(screen.getByText(/fetch results/i)).toBeInTheDocument();
        expect(screen.getByText(/records to migrate: 75/i)).toBeInTheDocument();
        expect(screen.getByText(/invalid records: 1/i)).toBeInTheDocument();
      });
      
      // Verify error log shows invalid records
      expect(screen.getByText(/error log/i)).toBeInTheDocument();
      expect(screen.getByText(/task3: Missing schoolId/i)).toBeInTheDocument();
    });

    it('should trigger enrich and restore operation with progress tracking', async () => {
      const mockMigrationResult: MigrationResult = {
        total: 75,
        succeeded: 70,
        failed: 5,
        skipped: 0,
        errors: [
          { id: 'task1', error: 'School not found' },
          { id: 'task2', error: 'Invalid entityId format' }
        ]
      };
      
      mockHandlers.onEnrichAndRestore.mockResolvedValue(mockMigrationResult);
      
      render(<MigrationCard {...defaultProps} />);
      
      const migrateButton = screen.getByRole('button', { name: /enrich & restore/i });
      fireEvent.click(migrateButton);
      
      // Verify loading state
      await waitFor(() => {
        expect(migrateButton).toBeDisabled();
        const spinner = migrateButton.querySelector('svg.animate-spin');
        expect(spinner).toBeInTheDocument();
      });
      
      // Verify operation was called
      expect(mockHandlers.onEnrichAndRestore).toHaveBeenCalledTimes(1);
      
      // Verify error log is displayed
      await waitFor(() => {
        expect(screen.getByText(/error log/i)).toBeInTheDocument();
        expect(screen.getByText(/task1: School not found/i)).toBeInTheDocument();
        expect(screen.getByText(/task2: Invalid entityId format/i)).toBeInTheDocument();
      });
    });

    it('should trigger verify operation and display validation results', async () => {
      const mockVerifyResult: VerificationResult = {
        collection: 'tasks',
        totalRecords: 100,
        migratedRecords: 70,
        unmigratedRecords: 25,
        orphanedRecords: 5,
        validationErrors: [
          { recordId: 'task1', field: 'entityId', issue: 'Entity does not exist' },
          { recordId: 'task2', field: 'entityType', issue: 'Invalid entity type' }
        ]
      };
      
      mockHandlers.onVerify.mockResolvedValue(mockVerifyResult);
      
      render(<MigrationCard {...defaultProps} />);
      
      const verifyButton = screen.getByRole('button', { name: /verify/i });
      fireEvent.click(verifyButton);
      
      // Verify loading state
      await waitFor(() => {
        expect(verifyButton).toBeDisabled();
      });
      
      // Verify operation was called
      expect(mockHandlers.onVerify).toHaveBeenCalledTimes(1);
      
      // Verify results are displayed
      await waitFor(() => {
        expect(screen.getByText(/verification results/i)).toBeInTheDocument();
        expect(screen.getByText(/migrated: 70/i)).toBeInTheDocument();
        expect(screen.getByText(/unmigrated: 25/i)).toBeInTheDocument();
        expect(screen.getByText(/orphaned: 5/i)).toBeInTheDocument();
        expect(screen.getByText(/validation errors: 2/i)).toBeInTheDocument();
      });
      
      // Verify validation errors are shown in error log
      expect(screen.getByText(/error log/i)).toBeInTheDocument();
      expect(screen.getByText(/task1 - entityId: Entity does not exist/i)).toBeInTheDocument();
    });

    it('should trigger rollback operation and handle errors', async () => {
      const mockRollbackResult: RollbackResult = {
        collection: 'tasks',
        totalRestored: 65,
        failed: 5,
        errors: [
          { id: 'task1', error: 'Backup not found' },
          { id: 'task2', error: 'Restore failed' }
        ]
      };
      
      mockHandlers.onRollback.mockResolvedValue(mockRollbackResult);
      
      render(<MigrationCard {...defaultProps} />);
      
      const rollbackButton = screen.getByRole('button', { name: /rollback/i });
      fireEvent.click(rollbackButton);
      
      // Verify loading state
      await waitFor(() => {
        expect(rollbackButton).toBeDisabled();
      });
      
      // Verify operation was called
      expect(mockHandlers.onRollback).toHaveBeenCalledTimes(1);
      
      // Verify errors are displayed
      await waitFor(() => {
        expect(screen.getByText(/error log/i)).toBeInTheDocument();
        expect(screen.getByText(/task1: Backup not found/i)).toBeInTheDocument();
        expect(screen.getByText(/task2: Restore failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Real-Time Progress Updates', () => {
    it('should update progress bar as migration progresses', () => {
      const { rerender } = render(<MigrationCard {...defaultProps} />);
      
      // Initial state - 0% progress
      expect(screen.getByText('0%')).toBeInTheDocument();
      
      // Simulate 25% progress
      rerender(<MigrationCard {...defaultProps} migratedRecords={25} unmigratedRecords={75} />);
      expect(screen.getByText('25%')).toBeInTheDocument();
      
      // Simulate 50% progress
      rerender(<MigrationCard {...defaultProps} migratedRecords={50} unmigratedRecords={50} />);
      expect(screen.getByText('50%')).toBeInTheDocument();
      
      // Simulate 100% progress
      rerender(<MigrationCard {...defaultProps} migratedRecords={100} unmigratedRecords={0} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should update record counts in real-time during migration', () => {
      const { rerender } = render(<MigrationCard {...defaultProps} />);
      
      // Initial state
      const getRecordCount = (label: string) => {
        const labelElement = screen.getByText(label);
        const container = labelElement.closest('div');
        return container?.querySelector('.text-2xl')?.textContent;
      };
      
      expect(getRecordCount('Migrated')).toBe('0');
      expect(getRecordCount('Unmigrated')).toBe('100');
      
      // Simulate progress
      rerender(<MigrationCard {...defaultProps} migratedRecords={30} unmigratedRecords={70} />);
      expect(getRecordCount('Migrated')).toBe('30');
      expect(getRecordCount('Unmigrated')).toBe('70');
      
      // Simulate more progress
      rerender(<MigrationCard {...defaultProps} migratedRecords={80} unmigratedRecords={20} />);
      expect(getRecordCount('Migrated')).toBe('80');
      expect(getRecordCount('Unmigrated')).toBe('20');
    });

    it('should track failed records separately', () => {
      const { rerender } = render(<MigrationCard {...defaultProps} />);
      
      const getFailedCount = () => {
        const labelElement = screen.getByText('Failed');
        const container = labelElement.closest('div');
        return container?.querySelector('.text-2xl')?.textContent;
      };
      
      expect(getFailedCount()).toBe('0');
      
      // Simulate some failures
      rerender(<MigrationCard 
        {...defaultProps} 
        migratedRecords={70} 
        unmigratedRecords={25} 
        failedRecords={5} 
      />);
      expect(getFailedCount()).toBe('5');
    });

    it('should handle zero total records gracefully', () => {
      render(<MigrationCard {...defaultProps} totalRecords={0} migratedRecords={0} unmigratedRecords={0} />);
      
      // Should show 0% instead of NaN
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('Error Display and Logging', () => {
    it('should display error log when fetch operation has invalid records', async () => {
      const mockFetchResult: FetchResult = {
        collection: 'tasks',
        totalRecords: 100,
        recordsToMigrate: 95,
        sampleRecords: [],
        invalidRecords: [
          { id: 'task1', reason: 'Missing schoolId' },
          { id: 'task2', reason: 'Null schoolId value' },
          { id: 'task3', reason: 'Invalid format' }
        ]
      };
      
      mockHandlers.onFetch.mockResolvedValue(mockFetchResult);
      
      render(<MigrationCard {...defaultProps} />);
      
      const fetchButton = screen.getByRole('button', { name: /fetch/i });
      fireEvent.click(fetchButton);
      
      await waitFor(() => {
        const errorLog = screen.getByText(/error log/i);
        expect(errorLog).toBeInTheDocument();
        
        // Verify all errors are displayed
        expect(screen.getByText(/task1: Missing schoolId/i)).toBeInTheDocument();
        expect(screen.getByText(/task2: Null schoolId value/i)).toBeInTheDocument();
        expect(screen.getByText(/task3: Invalid format/i)).toBeInTheDocument();
      });
    });

    it('should display error log when migration operation fails', async () => {
      const mockMigrationResult: MigrationResult = {
        total: 100,
        succeeded: 90,
        failed: 10,
        skipped: 0,
        errors: [
          { id: 'task1', error: 'School not found in database' },
          { id: 'task2', error: 'EntityId generation failed' },
          { id: 'task3', error: 'Firestore write error' }
        ]
      };
      
      mockHandlers.onEnrichAndRestore.mockResolvedValue(mockMigrationResult);
      
      render(<MigrationCard {...defaultProps} />);
      
      const migrateButton = screen.getByRole('button', { name: /enrich & restore/i });
      fireEvent.click(migrateButton);
      
      await waitFor(() => {
        expect(screen.getByText(/error log/i)).toBeInTheDocument();
        expect(screen.getByText(/task1: School not found in database/i)).toBeInTheDocument();
        expect(screen.getByText(/task2: EntityId generation failed/i)).toBeInTheDocument();
        expect(screen.getByText(/task3: Firestore write error/i)).toBeInTheDocument();
      });
    });

    it('should clear error log when starting a new operation', async () => {
      // First operation with errors
      const mockFetchResult: FetchResult = {
        collection: 'tasks',
        totalRecords: 100,
        recordsToMigrate: 95,
        sampleRecords: [],
        invalidRecords: [{ id: 'task1', reason: 'Error from first operation' }]
      };
      
      mockHandlers.onFetch.mockResolvedValue(mockFetchResult);
      
      render(<MigrationCard {...defaultProps} />);
      
      const fetchButton = screen.getByRole('button', { name: /fetch/i });
      fireEvent.click(fetchButton);
      
      await waitFor(() => {
        expect(screen.getByText(/task1: Error from first operation/i)).toBeInTheDocument();
      });
      
      // Second operation without errors
      const mockVerifyResult: VerificationResult = {
        collection: 'tasks',
        totalRecords: 100,
        migratedRecords: 100,
        unmigratedRecords: 0,
        orphanedRecords: 0,
        validationErrors: []
      };
      
      mockHandlers.onVerify.mockResolvedValue(mockVerifyResult);
      
      const verifyButton = screen.getByRole('button', { name: /verify/i });
      fireEvent.click(verifyButton);
      
      await waitFor(() => {
        // Old error should be cleared
        expect(screen.queryByText(/task1: Error from first operation/i)).not.toBeInTheDocument();
      });
    });

    it('should handle operation exceptions and display error message', async () => {
      const errorMessage = 'Network error: Failed to connect to Firestore';
      mockHandlers.onFetch.mockRejectedValue(new Error(errorMessage));
      
      render(<MigrationCard {...defaultProps} />);
      
      const fetchButton = screen.getByRole('button', { name: /fetch/i });
      fireEvent.click(fetchButton);
      
      await waitFor(() => {
        expect(screen.getByText(/error log/i)).toBeInTheDocument();
        expect(screen.getByText(new RegExp(errorMessage, 'i'))).toBeInTheDocument();
      });
    });
  });

  describe('Sequential Operations Integration', () => {
    it('should handle fetch -> enrich -> verify workflow', async () => {
      // Step 1: Fetch
      const mockFetchResult: FetchResult = {
        collection: 'tasks',
        totalRecords: 100,
        recordsToMigrate: 100,
        sampleRecords: [],
        invalidRecords: []
      };
      mockHandlers.onFetch.mockResolvedValue(mockFetchResult);
      
      render(<MigrationCard {...defaultProps} />);
      
      const fetchButton = screen.getByRole('button', { name: /fetch/i });
      fireEvent.click(fetchButton);
      
      await waitFor(() => {
        expect(screen.getByText(/fetch results/i)).toBeInTheDocument();
        expect(screen.getByText(/records to migrate: 100/i)).toBeInTheDocument();
      });
      
      // Step 2: Enrich & Restore
      const mockMigrationResult: MigrationResult = {
        total: 100,
        succeeded: 100,
        failed: 0,
        skipped: 0,
        errors: []
      };
      mockHandlers.onEnrichAndRestore.mockResolvedValue(mockMigrationResult);
      
      const migrateButton = screen.getByRole('button', { name: /enrich & restore/i });
      fireEvent.click(migrateButton);
      
      await waitFor(() => {
        expect(mockHandlers.onEnrichAndRestore).toHaveBeenCalledTimes(1);
      });
      
      // Step 3: Verify
      const mockVerifyResult: VerificationResult = {
        collection: 'tasks',
        totalRecords: 100,
        migratedRecords: 100,
        unmigratedRecords: 0,
        orphanedRecords: 0,
        validationErrors: []
      };
      mockHandlers.onVerify.mockResolvedValue(mockVerifyResult);
      
      const verifyButton = screen.getByRole('button', { name: /verify/i });
      fireEvent.click(verifyButton);
      
      await waitFor(() => {
        expect(screen.getByText(/verification results/i)).toBeInTheDocument();
        expect(screen.getByText(/migrated: 100/i)).toBeInTheDocument();
        expect(screen.getByText(/unmigrated: 0/i)).toBeInTheDocument();
      });
    });

    it('should prevent concurrent operations on same button', async () => {
      mockHandlers.onFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );
      
      render(<MigrationCard {...defaultProps} />);
      
      const fetchButton = screen.getByRole('button', { name: /fetch/i });
      
      // Click button twice rapidly
      fireEvent.click(fetchButton);
      fireEvent.click(fetchButton);
      
      // Should only be called once
      await waitFor(() => {
        expect(mockHandlers.onFetch).toHaveBeenCalledTimes(1);
      });
    });
  });
});

