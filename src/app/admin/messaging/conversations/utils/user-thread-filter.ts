/**
 * SmartSapp Messaging Hub — Conversation User Association Filter
 *
 * Evaluates whether a conversation thread is associated with the given user context.
 * Checks direct log userId, senderProfileId, senderName, recipient email/phone,
 * and variables (assignedUserId, assigned_userId, userId, authorId, user_name, etc.).
 *
 * In accordance with Rule 4: Zero any or any[].
 */

import type { ThreadGroup } from '../ConversationsClient';

export interface UserContextIdentity {
  uid?: string | null;
  email?: string | null;
  displayName?: string | null;
}

export function isThreadForUser(
  thread: ThreadGroup,
  user: UserContextIdentity | null | undefined
): boolean {
  if (!user || !user.uid) return false;
  const userUid = user.uid;
  const userEmail = user.email?.toLowerCase().trim() || null;
  const userName = user.displayName?.toLowerCase().trim() || null;

  return thread.messages.some((msg) => {
    // 1. Direct user identity on message log
    if (msg.userId === userUid || msg.senderProfileId === userUid) return true;

    // 2. Direct recipient email match
    if (userEmail && msg.recipient && msg.recipient.toLowerCase().trim() === userEmail) {
      return true;
    }

    // 3. Sender name match
    if (userName && msg.senderName && msg.senderName.toLowerCase().trim() === userName) {
      return true;
    }

    // 4. Variables match (assigned manager, creator, recipient user)
    const vars = (msg.variables || {}) as Record<string, unknown>;
    if (
      vars.assignedUserId === userUid ||
      vars.assigned_userId === userUid ||
      vars.userId === userUid ||
      vars.user_id === userUid ||
      vars.authorId === userUid ||
      vars.senderUserId === userUid
    ) {
      return true;
    }

    if (
      userEmail &&
      (vars.email === userEmail ||
        vars.user_email === userEmail ||
        vars.contact_email === userEmail)
    ) {
      return true;
    }

    if (
      userName &&
      (vars.admin_name === userName ||
        vars.user_name === userName ||
        vars.assignee_name === userName ||
        vars.contact_name === userName)
    ) {
      return true;
    }

    return false;
  });
}
