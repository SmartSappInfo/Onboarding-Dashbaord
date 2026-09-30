import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { onSnapshot, FirestoreError, DocumentReference, DocumentSnapshot } from 'firebase/firestore';
import { useDoc } from '../use-doc';

// Mock dependencies
vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(),
}));

vi.mock('../../provider', () => ({
  useAuth: vi.fn(() => ({
    currentUser: { uid: 'user_123' },
  })),
}));

describe('useDoc Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockDocRef = (path: string) =>
    ({
      id: 'doc_123',
      path,
    } as unknown as DocumentReference);

  it('subscribes to document and returns data on snapshot success', () => {
    const mockSnap = {
      id: 'doc_123',
      exists: () => true,
      data: () => ({ name: 'Test Org' }),
    } as unknown as DocumentSnapshot;

    let snapshotCallback: (snapshot: DocumentSnapshot) => void = () => {};
    vi.mocked(onSnapshot).mockImplementation((_ref, onNext) => {
      snapshotCallback = onNext as typeof snapshotCallback;
      return () => {};
    });

    const mockRef = createMockDocRef('organizations/doc_123');
    const { result } = renderHook(() => useDoc<{ name: string }>(mockRef));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();

    act(() => {
      snapshotCallback(mockSnap);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({ id: 'doc_123', name: 'Test Org' });
  });

  it('retries transient deadline-exceeded error with backoff and path warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    let callCount = 0;
    let errorCallback: (err: FirestoreError) => void = () => {};
    let nextCallback: (snapshot: DocumentSnapshot) => void = () => {};

    vi.mocked(onSnapshot).mockImplementation((...args: unknown[]) => {
      callCount++;
      nextCallback = args[1] as typeof nextCallback;
      errorCallback = args[2] as typeof errorCallback;
      return () => {};
    });

    const mockRef = createMockDocRef('users/user_123');
    const { result } = renderHook(() => useDoc<{ email: string }>(mockRef));

    act(() => {
      nextCallback({
        id: 'user_123',
        exists: () => true,
        data: () => ({ email: 'kwame@smartsapp.com' }),
      } as unknown as DocumentSnapshot);
    });

    expect(result.current.data).toEqual({ id: 'user_123', email: 'kwame@smartsapp.com' });
    expect(callCount).toBe(1);

    // Transient deadline exceeded
    act(() => {
      errorCallback({
        code: 'deadline-exceeded',
        message: 'Timeout',
        name: 'FirebaseError',
      } as FirestoreError);
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Firestore useDoc] Transient error (deadline-exceeded) on path "users/user_123"')
    );
    expect(result.current.data).toEqual({ id: 'user_123', email: 'kwame@smartsapp.com' });

    // Advance 1s timer
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callCount).toBe(2);
    warnSpy.mockRestore();
  });
});
