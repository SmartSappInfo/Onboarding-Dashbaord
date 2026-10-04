// @vitest-environment jsdom
/**
 * @fileOverview UI Test Suite for Universal Object Command Menu (Phase 8 Milestone 4)
 *
 * Implements verification for:
 * - Rule 7: Accessible touch target >= 44px
 * - Rule 68 / §81: "No Dead Ends" navigation to target action URLs
 * - Rule 60: Emergency dead-man pause feedback
 * - 6 Contextual commands execution
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ObjectCommandMenu } from '@/components/shared/ObjectCommandMenu';
import { ContextRailProvider } from '@/components/context-rail';
import * as contextRailActions from '@/app/actions/context-rail-actions';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/app/actions/context-rail-actions', () => ({
  executeObjectCommandAction: vi.fn(),
  getEntityContextRailDataAction: vi.fn(),
}));

describe('ObjectCommandMenu Component (Phase 8 Milestone 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. renders trigger button with >= 44px touch target (Rule 7)', () => {
    render(
      <ContextRailProvider>
        <ObjectCommandMenu
          entityId="contact_john_doe"
          entityType="contact"
          entityName="John Doe"
        />
      </ContextRailProvider>
    );

    const trigger = screen.getByTestId('object-command-menu-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger.className).toContain('min-h-[44px]');
    expect(trigger.className).toContain('min-w-[44px]');
  });

  it('2. opens menu and displays all intelligence and autonomous commands', async () => {
    render(
      <ContextRailProvider>
        <ObjectCommandMenu
          entityId="contact_john_doe"
          entityType="contact"
          entityName="John Doe"
          defaultOpen={true}
        />
      </ContextRailProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('object-command-menu-content')).toBeInTheDocument();
    });

    expect(screen.getByTestId('command-item-open-rail')).toBeInTheDocument();
    expect(screen.getByTestId('command-item-ask-ai')).toBeInTheDocument();
    expect(screen.getByTestId('command-item-summarize')).toBeInTheDocument();
    expect(screen.getByTestId('command-item-find-related')).toBeInTheDocument();
    expect(screen.getByTestId('command-item-create-task')).toBeInTheDocument();
    expect(screen.getByTestId('command-item-launch-agent')).toBeInTheDocument();
    expect(screen.getByTestId('command-item-add-workflow')).toBeInTheDocument();
  });

  it('3. executes command and navigates to target URL ensuring No Dead Ends (§81)', async () => {
    vi.mocked(contextRailActions.executeObjectCommandAction).mockResolvedValue({
      success: true,
      data: {
        success: true,
        message: 'Opening AI intelligence desk for John Doe',
        actionTargetUrl: '/admin/entities/contact_john_doe?tab=ai',
      },
    });

    render(
      <ContextRailProvider>
        <ObjectCommandMenu
          entityId="contact_john_doe"
          entityType="contact"
          entityName="John Doe"
          defaultOpen={true}
        />
      </ContextRailProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('command-item-ask-ai')).toBeInTheDocument();
    });

    const askAiItem = screen.getByTestId('command-item-ask-ai');
    fireEvent.click(askAiItem);

    await waitFor(() => {
      expect(contextRailActions.executeObjectCommandAction).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'contact_john_doe',
          commandType: 'ask_ai',
        })
      );
    });

    expect(mockPush).toHaveBeenCalledWith('/admin/entities/contact_john_doe?tab=ai');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Action Triggered',
      })
    );
  });

  it('4. displays error toast when mutating command is blocked by dead-man switch (Rule 60)', async () => {
    vi.mocked(contextRailActions.executeObjectCommandAction).mockResolvedValue({
      success: false,
      error: {
        code: 'CONTEXT_DEAD_MAN_PAUSED',
        message: 'Autonomous execution is emergency paused by administrator',
      },
    });

    render(
      <ContextRailProvider>
        <ObjectCommandMenu
          entityId="contact_john_doe"
          entityType="contact"
          entityName="John Doe"
          defaultOpen={true}
        />
      </ContextRailProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('command-item-launch-agent')).toBeInTheDocument();
    });

    const launchItem = screen.getByTestId('command-item-launch-agent');
    fireEvent.click(launchItem);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Action Blocked',
          description: 'Autonomous execution is emergency paused by administrator',
        })
      );
    });
  });
});
