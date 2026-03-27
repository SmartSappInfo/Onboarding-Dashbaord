import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MigrationCard } from '../MigrationCard';
import type { FetchResult, MigrationResult, VerificationResult, RollbackResult } from '@/lib/migration-types';

describe('MigrationCard', () => {
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

  it('should render feature name and collection name', () => {
    render(<MigrationCard {...defaultProps} />);
    
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('tasks')).toBeInTheDocument();
  });

  it('should display record counts', () => {
    render(<MigrationCard {...defaultProps} />);
    
    // Check for specific labels to ensure we're testing the right counts
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Migrated')).toBeInTheDocument();
    expect(screen.getByText('Unmigrated')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    
    // Verify the counts are displayed (using getAllByText since there are duplicates)
    const hundredElements = screen.getAllByText('100');
    expect(hundredElements.length).toBeGreaterThan(0);
  });

  it('should display correct status badge for not_started', () => {
    render(<MigrationCard {...defaultProps} />);
    
    expect(screen.getByText('Not Started')).toBeInTheDocument();
  });

  it('should display correct status badge for completed', () => {
    render(<MigrationCard {...defaultProps} status="completed" />);
    
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('should calculate progress percentage correctly', () => {
    render(<MigrationCard {...defaultProps} migratedRecords={50} />);
    
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should render all action buttons', () => {
    render(<MigrationCard {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /fetch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enrich & restore/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rollback/i })).toBeInTheDocument();
  });

  it('should call onFetch when Fetch button is clicked', async () => {
    const mockFetchResult: FetchResult = {
      collection: 'tasks',
      totalRecords: 100,
      recordsToMigrate: 50,
      sampleRecords: [],
      invalidRecords: []
    };
    
    mockHandlers.onFetch.mockResolvedValue(mockFetchResult);
    
    render(<MigrationCard {...defaultProps} />);
    
    const fetchButton = screen.getByRole('button', { name: /fetch/i });
    fireEvent.click(fetchButton);
    
    await waitFor(() => {
      expect(mockHandlers.onFetch).toHaveBeenCalledTimes(1);
    });
  });

  it('should display fetch results after fetch operation', async () => {
    const mockFetchResult: FetchResult = {
      collection: 'tasks',
      totalRecords: 100,
      recordsToMigrate: 50,
      sampleRecords: [{ id: 'task1', schoolId: 'school1' }],
      invalidRecords: []
    };
    
    mockHandlers.onFetch.mockResolvedValue(mockFetchResult);
    
    render(<MigrationCard {...defaultProps} />);
    
    const fetchButton = screen.getByRole('button', { name: /fetch/i });
    fireEvent.click(fetchButton);
    
    await waitFor(() => {
      expect(screen.getByText(/fetch results/i)).toBeInTheDocument();
      expect(screen.getByText(/records to migrate: 50/i)).toBeInTheDocument();
    });
  });

  it('should call onEnrichAndRestore when Enrich & Restore button is clicked', async () => {
    const mockMigrationResult: MigrationResult = {
      total: 50,
      succeeded: 50,
      failed: 0,
      skipped: 0,
      errors: []
    };
    
    mockHandlers.onEnrichAndRestore.mockResolvedValue(mockMigrationResult);
    
    render(<MigrationCard {...defaultProps} />);
    
    const migrateButton = screen.getByRole('button', { name: /enrich & restore/i });
    fireEvent.click(migrateButton);
    
    await waitFor(() => {
      expect(mockHandlers.onEnrichAndRestore).toHaveBeenCalledTimes(1);
    });
  });

  it('should display error log when migration fails', async () => {
    const mockMigrationResult: MigrationResult = {
      total: 50,
      succeeded: 45,
      failed: 5,
      skipped: 0,
      errors: [
        { id: 'task1', error: 'School not found' },
        { id: 'task2', error: 'Invalid schoolId' }
      ]
    };
    
    mockHandlers.onEnrichAndRestore.mockResolvedValue(mockMigrationResult);
    
    render(<MigrationCard {...defaultProps} />);
    
    const migrateButton = screen.getByRole('button', { name: /enrich & restore/i });
    fireEvent.click(migrateButton);
    
    await waitFor(() => {
      expect(screen.getByText(/error log/i)).toBeInTheDocument();
      expect(screen.getByText(/task1: School not found/i)).toBeInTheDocument();
    });
  });

  it('should call onVerify when Verify button is clicked', async () => {
    const mockVerifyResult: VerificationResult = {
      collection: 'tasks',
      totalRecords: 100,
      migratedRecords: 50,
      unmigratedRecords: 50,
      orphanedRecords: 0,
      validationErrors: []
    };
    
    mockHandlers.onVerify.mockResolvedValue(mockVerifyResult);
    
    render(<MigrationCard {...defaultProps} />);
    
    const verifyButton = screen.getByRole('button', { name: /verify/i });
    fireEvent.click(verifyButton);
    
    await waitFor(() => {
      expect(mockHandlers.onVerify).toHaveBeenCalledTimes(1);
    });
  });

  it('should display verification results after verify operation', async () => {
    const mockVerifyResult: VerificationResult = {
      collection: 'tasks',
      totalRecords: 100,
      migratedRecords: 50,
      unmigratedRecords: 50,
      orphanedRecords: 2,
      validationErrors: []
    };
    
    mockHandlers.onVerify.mockResolvedValue(mockVerifyResult);
    
    render(<MigrationCard {...defaultProps} />);
    
    const verifyButton = screen.getByRole('button', { name: /verify/i });
    fireEvent.click(verifyButton);
    
    await waitFor(() => {
      expect(screen.getByText(/verification results/i)).toBeInTheDocument();
      expect(screen.getByText(/orphaned: 2/i)).toBeInTheDocument();
    });
  });

  it('should call onRollback when Rollback button is clicked', async () => {
    const mockRollbackResult: RollbackResult = {
      collection: 'tasks',
      totalRestored: 50,
      failed: 0,
      errors: []
    };
    
    mockHandlers.onRollback.mockResolvedValue(mockRollbackResult);
    
    render(<MigrationCard {...defaultProps} />);
    
    const rollbackButton = screen.getByRole('button', { name: /rollback/i });
    fireEvent.click(rollbackButton);
    
    await waitFor(() => {
      expect(mockHandlers.onRollback).toHaveBeenCalledTimes(1);
    });
  });

  it('should disable buttons during operation', async () => {
    mockHandlers.onFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<MigrationCard {...defaultProps} />);
    
    const fetchButton = screen.getByRole('button', { name: /fetch/i });
    fireEvent.click(fetchButton);
    
    expect(fetchButton).toBeDisabled();
    
    await waitFor(() => {
      expect(fetchButton).not.toBeDisabled();
    });
  });

  it('should show loading spinner during operation', async () => {
    mockHandlers.onFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<MigrationCard {...defaultProps} />);
    
    const fetchButton = screen.getByRole('button', { name: /fetch/i });
    fireEvent.click(fetchButton);
    
    // Check for loading spinner (Loader2 component)
    const spinner = fetchButton.querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
