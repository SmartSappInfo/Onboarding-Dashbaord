import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { onSnapshot, FirestoreError, CollectionReference } from 'firebase/firestore';
import { useCollection } from '../use-collection';

// Mock dependencies
vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(),
}));

vi.mock('../../provider', () => ({
  useAuth: vi.fn(() => ({
    currentUser: { uid: 'user_123' },
  })),
}));

describe('useCollection Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockRef = (path: string) =>
    ({
      type: 'collection',
      path,
      __memo: true,
    } as unknown as CollectionReference & { __memo: boolean });

  it('subscribes to collection and returns documents on snapshot success', () => {
    const mockDocs = [
      { id: 'doc1', data: () => ({ name: 'First Document' }) },
      { id: 'doc2', data: () => ({ name: 'Second Document' }) },
    ];

    let snapshotCallback: (snapshot: { docs: typeof mockDocs }) => void = () => {};
    vi.mocked(onSnapshot).mockImplementation((_query, onNext) => {
      snapshotCallback = onNext as typeof snapshotCallback;
      return () => {};
    });

    const mockRef = createMockRef('organizations');
    const { result } = renderHook(() => useCollection<{ name: string }>(mockRef));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();

    // Trigger snapshot
    act(() => {
      snapshotCallback({ docs: mockDocs });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual([
      { id: 'doc1', name: 'First Document' },
      { id: 'doc2', name: 'Second Document' },
    ]);
  });

  it('automatically retries on transient deadline-exceeded error with backoff and preserves data', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    let callCount = 0;
    let errorCallback: (err: FirestoreError) => void = () => {};
    let nextCallback: (snapshot: { docs: Array<{ id: string; data: () => Record<string, string> }> }) => void = () => {};

    vi.mocked(onSnapshot).mockImplementation((...args: unknown[]) => {
      callCount++;
      nextCallback = args[1] as typeof nextCallback;
      errorCallback = args[2] as typeof errorCallback;
      return () => {};
    });

    const mockRef = createMockRef('meetings');
    const { result } = renderHook(() => useCollection<{ title: string }>(mockRef));

    // First load succeeds
    act(() => {
      nextCallback({
        docs: [{ id: 'm1', data: () => ({ title: 'Team Sync' }) }],
      });
    });

    expect(result.current.data).toEqual([{ id: 'm1', title: 'Team Sync' }]);
    expect(callCount).toBe(1);

    // Simulate transient deadline-exceeded error
    const deadlineError = {
      code: 'deadline-exceeded',
      message: 'The operation exceeded the deadline during execution.',
      name: 'FirebaseError',
    } as FirestoreError;

    act(() => {
      errorCallback(deadlineError);
    });

    // Should log warning and retain stale data
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Firestore useCollection] Transient error (deadline-exceeded) on path "meetings"')
    );
    expect(result.current.data).toEqual([{ id: 'm1', title: 'Team Sync' }]);

    // Fast-forward backoff timer (1000ms)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Reconnected attempt 2
    expect(callCount).toBe(2);

    // Reconnection snapshot succeeds
    act(() => {
      nextCallback({
        docs: [
          { id: 'm1', data: () => ({ title: 'Team Sync' }) },
          { id: 'm2', data: () => ({ title: 'Planning' }) },
        ],
      });
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.error).toBeNull();
    warnSpy.mockRestore();
  });

  it('fails immediately without retry on non-transient error like permission-denied', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let errorCallback: (err: FirestoreError) => void = () => {};
    vi.mocked(onSnapshot).mockImplementation((...args: unknown[]) => {
      errorCallback = args[2] as typeof errorCallback;
      return () => {};
    });

    const mockRef = createMockRef('secret_collection');
    const { result } = renderHook(() => useCollection(mockRef));

    const permissionError = {
      code: 'permission-denied',
      message: 'Missing or insufficient permissions.',
      name: 'FirebaseError',
    } as FirestoreError;

    act(() => {
      errorCallback(permissionError);
    });

    // Should NOT retry: fast forward timer has no effect
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toBeNull();
    errorSpy.mockRestore();
  });

  it('unsubscribes and cancels pending retry timers on unmount', () => {
    const unsubscribeMock = vi.fn();
    let errorCallback: (err: FirestoreError) => void = () => {};

    vi.mocked(onSnapshot).mockImplementation((...args: unknown[]) => {
      errorCallback = args[2] as typeof errorCallback;
      return unsubscribeMock;
    });

    const mockRef = createMockRef('temp_collection');
    const { unmount } = renderHook(() => useCollection(mockRef));

    // Trigger transient error
    act(() => {
      errorCallback({
        code: 'deadline-exceeded',
        message: 'Timeout',
        name: 'FirebaseError',
      } as FirestoreError);
    });

    // Unmount before retry fires
    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();

    // Advance time - no new subscription should happen
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });
});
