import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskStatusBadge } from '../primitives/TaskStatusBadge';
import { TaskPriorityBadge } from '../primitives/TaskPriorityBadge';
import { TaskAssignee } from '../primitives/TaskAssignee';
import { TaskDueDate } from '../primitives/TaskDueDate';
import { TaskRelationshipBadge } from '../primitives/TaskRelationshipBadge';
import { TaskSourceBadge } from '../primitives/TaskSourceBadge';
import type { UserProfile } from '@/lib/types';

describe('Task Primitives (Phase 1)', () => {
  describe('TaskStatusBadge', () => {
    it('renders text label for each status without relying on color alone', () => {
      const { rerender } = render(<TaskStatusBadge status="todo" />);
      expect(screen.getByText(/backlog|to do/i)).toBeInTheDocument();

      rerender(<TaskStatusBadge status="in_progress" />);
      expect(screen.getByText(/in progress/i)).toBeInTheDocument();

      rerender(<TaskStatusBadge status="waiting" />);
      expect(screen.getByText(/waiting/i)).toBeInTheDocument();

      rerender(<TaskStatusBadge status="review" />);
      expect(screen.getByText(/review/i)).toBeInTheDocument();

      rerender(<TaskStatusBadge status="done" />);
      expect(screen.getByText(/done|resolved/i)).toBeInTheDocument();
    });

    it('renders interactive dropdown trigger when onStatusChange is provided', () => {
      const onStatusChange = vi.fn();
      render(<TaskStatusBadge status="todo" interactive onStatusChange={onStatusChange} />);
      const button = screen.getByRole('button', { name: /change status/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('TaskPriorityBadge', () => {
    it('renders priority label and icon subordinate to title', () => {
      const { rerender } = render(<TaskPriorityBadge priority="urgent" />);
      expect(screen.getByText(/urgent/i)).toBeInTheDocument();

      rerender(<TaskPriorityBadge priority="high" />);
      expect(screen.getByText(/high/i)).toBeInTheDocument();

      rerender(<TaskPriorityBadge priority="medium" />);
      expect(screen.getByText(/medium/i)).toBeInTheDocument();

      rerender(<TaskPriorityBadge priority="low" />);
      expect(screen.getByText(/low/i)).toBeInTheDocument();
    });
  });

  describe('TaskAssignee', () => {
    it('renders unassigned placeholder when assignees is empty', () => {
      render(<TaskAssignee assignees={[]} />);
      expect(screen.getByText(/unassigned/i)).toBeInTheDocument();
    });

    it('renders avatar and fallback initials for assigned users', () => {
      const mockUsers: UserProfile[] = [
        { id: 'u1', name: 'Alice Cooper', email: 'alice@example.com' } as UserProfile,
        { id: 'u2', name: 'Bob Dylan', email: 'bob@example.com' } as UserProfile,
      ];
      render(<TaskAssignee assignees={mockUsers} />);
      expect(screen.getByText('AC')).toBeInTheDocument();
      expect(screen.getByText('BD')).toBeInTheDocument();
    });

    it('renders overflow counter when exceeding maxDisplay', () => {
      const mockUsers: UserProfile[] = [
        { id: 'u1', name: 'User One', email: 'u1@example.com' } as UserProfile,
        { id: 'u2', name: 'User Two', email: 'u2@example.com' } as UserProfile,
        { id: 'u3', name: 'User Three', email: 'u3@example.com' } as UserProfile,
        { id: 'u4', name: 'User Four', email: 'u4@example.com' } as UserProfile,
      ];
      render(<TaskAssignee assignees={mockUsers} maxDisplay={2} />);
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  describe('TaskDueDate', () => {
    it('gracefully handles missing or unparseable dates without throwing RangeError', () => {
      const { rerender } = render(<TaskDueDate dueDate={null} />);
      expect(screen.getByText(/no due date/i)).toBeInTheDocument();

      rerender(<TaskDueDate dueDate="invalid-date-string" />);
      expect(screen.getByText(/no due date/i)).toBeInTheDocument();
    });

    it('renders explicit text for overdue tasks', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      render(<TaskDueDate dueDate={yesterday} isDone={false} />);
      expect(screen.getByText(/overdue/i)).toBeInTheDocument();
    });

    it('renders normal formatted date when task is done even if past', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      render(<TaskDueDate dueDate={pastDate} isDone={true} />);
      expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
    });
  });

  describe('TaskRelationshipBadge', () => {
    it('renders entity name and type', () => {
      render(<TaskRelationshipBadge entityName="Greenwood High" entityType="institution" />);
      expect(screen.getByText('Greenwood High')).toBeInTheDocument();
    });

    it('renders contract obligation sync status', () => {
      const { rerender } = render(
        <TaskRelationshipBadge
          entityName="Springfield Academy"
          relatedEntityType="School"
          obligationSyncStatus="pending"
        />
      );
      expect(screen.getByText(/sync pending/i)).toBeInTheDocument();

      rerender(
        <TaskRelationshipBadge
          entityName="Springfield Academy"
          relatedEntityType="School"
          obligationSyncStatus="synced"
        />
      );
      expect(screen.getByText(/synced/i)).toBeInTheDocument();
    });
  });

  describe('TaskSourceBadge', () => {
    it('renders attribution label for automation and AI sources', () => {
      const { rerender } = render(<TaskSourceBadge source="automation" />);
      expect(screen.getByText(/automation/i)).toBeInTheDocument();

      rerender(<TaskSourceBadge source="ai" />);
      expect(screen.getByText(/ai/i)).toBeInTheDocument();

      rerender(<TaskSourceBadge source="system" />);
      expect(screen.getByText(/system/i)).toBeInTheDocument();
    });
  });
});
