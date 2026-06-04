// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin
vi.mock('../firebase-admin', () => {
  const update = vi.fn().mockResolvedValue(undefined);
  const add = vi.fn().mockResolvedValue({ id: 'new-attendee-id' });
  const get = vi.fn();
  const where = vi.fn();
  const limit = vi.fn();
  
  const queryMock = {
    where,
    limit,
    get
  };
  where.mockReturnValue(queryMock);
  limit.mockReturnValue(queryMock);

  // meeting Doc Mock
  const meetingDocData = {
    organizationId: 'org-123',
    workspaceIds: ['workspace-123'],
    type: { id: 'parent' }
  };
  const getMeetingDocMock = vi.fn().mockResolvedValue({
    exists: true,
    data: () => meetingDocData
  });

  // registrant Doc Mock
  const registrantDocData = {
    entityId: 'entity-123',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '1234567890',
    status: 'pending',
    token: 'token-123',
    registrationData: {}
  };
  const getRegistrantDocMock = vi.fn().mockResolvedValue({
    exists: true,
    data: () => registrantDocData
  });

  const registrantDocRef = {
    get: getRegistrantDocMock,
    update: vi.fn().mockResolvedValue(undefined)
  };

  const doc = vi.fn((id) => {
    return {
      get: getMeetingDocMock,
      update: vi.fn().mockResolvedValue(undefined),
      collection: vi.fn((subPath) => {
        if (subPath === 'registrants') {
          return {
            doc: vi.fn((regId) => registrantDocRef)
          };
        }
      })
    };
  });

  const collection = vi.fn((path) => {
    if (path === 'meetings') {
      return { doc };
    }
    // For attendees
    return {
      where,
      limit,
      add,
      doc: vi.fn((id) => ({
        update: vi.fn().mockResolvedValue(undefined)
      }))
    };
  });

  return {
    adminDb: { collection },
    __mocks: {
      update,
      add,
      get,
      where,
      limit,
      collection,
      doc,
      registrantDocRef,
      getMeetingDocMock
    }
  };
});

// Mock meeting-automation-events
vi.mock('../../lib/meeting-automation-events', () => ({
  emitMeetingRegistrantActivity: vi.fn().mockResolvedValue(undefined),
}));

import { logMeetingAttendance } from '../../app/actions/meeting-attendance-actions';
import * as firebaseAdmin from '../firebase-admin';

const mocks = () => (firebaseAdmin as any).__mocks;

describe('logMeetingAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks().where.mockReturnValue({ where: mocks().where, limit: mocks().limit, get: mocks().get });
    mocks().limit.mockReturnValue({ get: mocks().get });
  });

  it('creates a new attendee record if none exists', async () => {
    // Mock that no attendee record exists
    mocks().get.mockResolvedValue({ empty: true, docs: [] });

    const result = await logMeetingAttendance('meeting-123', 'registrant-123', {
      registrantName: 'John Doe',
      registrantToken: 'token-123',
      entityId: 'entity-123',
      childrenNames: ['Kid 1'],
    });

    expect(result.success).toBe(true);
    expect(mocks().add).toHaveBeenCalledWith(expect.objectContaining({
      meetingId: 'meeting-123',
      registrantId: 'registrant-123',
      parentName: 'John Doe',
    }));
  });

  it('updates lastRejoinedAt on the existing attendee record if they rejoin', async () => {
    // Mock that an attendee record already exists
    const updateAttendeeMock = vi.fn().mockResolvedValue(undefined);
    const existingDoc = {
      id: 'existing-attendee-id',
      ref: { update: updateAttendeeMock }
    };
    mocks().get.mockResolvedValue({ empty: false, docs: [existingDoc] });

    // Mock the doc path for updating the attendee
    const docMock = vi.fn().mockReturnValue({ update: updateAttendeeMock });
    mocks().collection.mockImplementation((path) => {
      if (path === 'meetings') {
        return { doc: mocks().doc };
      }
      return {
        where: mocks().where,
        limit: mocks().limit,
        add: mocks().add,
        doc: docMock
      };
    });

    const result = await logMeetingAttendance('meeting-123', 'registrant-123', {
      registrantName: 'John Doe',
      registrantToken: 'token-123',
      entityId: 'entity-123',
      childrenNames: ['Kid 1'],
    });

    expect(result.success).toBe(true);
    expect(mocks().add).not.toHaveBeenCalled();
    expect(docMock).toHaveBeenCalledWith('existing-attendee-id');
    expect(updateAttendeeMock).toHaveBeenCalledWith(expect.objectContaining({
      lastRejoinedAt: expect.any(String),
    }));
  });
});
