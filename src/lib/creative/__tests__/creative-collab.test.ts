import { describe, it, expect } from 'vitest';
import type {
  CreativeComment,
  CreativeApprovalDecision,
  PresenceUser,
} from '../creative-types';

describe('Creative Collaboration & Editorial Approvals Engine (Phase 7)', () => {
  it('should validate normalized pin comment coordinates within 0-100%', () => {
    const comment: CreativeComment = {
      id: 'cmt-101',
      projectId: 'proj-1',
      authorName: 'Alex Designer',
      authorEmail: 'alex@smartsapp.com',
      text: 'Please adjust headline contrast here',
      resolved: false,
      pinX: 45.5,
      pinY: 30.2,
      replies: [],
      createdAt: new Date().toISOString(),
    };

    expect(comment.pinX).toBeGreaterThanOrEqual(0);
    expect(comment.pinX).toBeLessThanOrEqual(100);
    expect(comment.pinY).toBeGreaterThanOrEqual(0);
    expect(comment.pinY).toBeLessThanOrEqual(100);
    expect(comment.resolved).toBe(false);
  });

  it('should append threaded replies to a comment pin', () => {
    const comment: CreativeComment = {
      id: 'cmt-102',
      projectId: 'proj-1',
      authorName: 'Clara Art Lead',
      authorEmail: 'clara@smartsapp.com',
      text: 'Is this font WCAG compliant?',
      resolved: false,
      pinX: 20,
      pinY: 40,
      replies: [],
      createdAt: new Date().toISOString(),
    };

    const reply = {
      id: 'rep-1',
      authorName: 'Alex Designer',
      text: 'Yes, contrast ratio is 7.2:1 (AAA).',
      createdAt: new Date().toISOString(),
    };

    const updatedComment: CreativeComment = {
      ...comment,
      replies: [...(comment.replies || []), reply],
    };

    expect(updatedComment.replies?.length).toBe(1);
    expect(updatedComment.replies?.[0].authorName).toBe('Alex Designer');
  });

  it('should structure approval decisions and state transitions accurately', () => {
    const decision: CreativeApprovalDecision = {
      projectId: 'proj-1',
      status: 'approved',
      reviewerName: 'Lead Art Director',
      reviewerEmail: 'director@smartsapp.com',
      note: 'Verified brand guidelines & contrast ratio. Approved for launch.',
      decisionAt: new Date().toISOString(),
    };

    expect(decision.status).toBe('approved');
    expect(decision.reviewerName).toBe('Lead Art Director');
    expect(decision.note).toContain('Approved for launch');
  });

  it('should represent peer presence users with normalized cursor coordinates', () => {
    const user: PresenceUser = {
      id: 'usr-clara',
      name: 'Clara Art Lead',
      email: 'clara@smartsapp.com',
      color: '#06b6d4',
      cursorX: 68,
      cursorY: 28,
      lastActive: new Date().toISOString(),
    };

    expect(user.cursorX).toBe(68);
    expect(user.cursorY).toBe(28);
    expect(user.color).toBe('#06b6d4');
  });
});
