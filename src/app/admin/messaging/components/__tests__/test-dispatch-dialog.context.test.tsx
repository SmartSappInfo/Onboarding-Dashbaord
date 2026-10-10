import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

type DispatchInput = Record<string, unknown>;

const sendMessage = vi.fn(async (_input: DispatchInput) => ({ success: true, logId: 'log1' }));
const sendRawMessage = vi.fn(async (_input: DispatchInput) => ({ success: true, logId: 'log1' }));

vi.mock('@/lib/messaging-engine', () => ({
  sendMessage: (input: DispatchInput) => sendMessage(input),
  sendRawMessage: (input: DispatchInput) => sendRawMessage(input),
}));

// The dialog reads the admin's current tenant scope from TenantContext.
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({ activeWorkspaceId: 'ws1', activeOrganizationId: 'org1' }),
}));

vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({ singular: 'Campus', plural: 'Campuses' }),
}));

// No entities: exercises the "custom values" path the template workshop uses.
vi.mock('@/firebase', () => ({ useFirestore: () => ({}) }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(async () => ({ forEach: () => {} })),
}));

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

import TestDispatchDialog from '../TestDispatchDialog';

beforeEach(() => {
  sendMessage.mockClear();
  sendRawMessage.mockClear();
  toast.mockClear();
});

async function clickSend() {
  const button = await screen.findByRole('button', { name: /send test/i });
  await userEvent.click(button);
}

describe('TestDispatchDialog tenant context', () => {
  it('forwards the active workspace and org on a raw (unsaved template) send', async () => {
    render(
      <TestDispatchDialog
        open
        onOpenChange={() => {}}
        channel="email"
        rawBody="<p>Hello {{contact_name}}</p>"
        rawSubject="You're In!"
        variables={{ contact_name: 'Joseph' }}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('your-email@example.com'),
      'joseph.aidoo@smartsapp.com'
    );
    await clickSend();

    await waitFor(() => expect(sendRawMessage).toHaveBeenCalledTimes(1));
    expect(sendRawMessage.mock.calls[0][0]).toMatchObject({
      workspaceIds: ['ws1'],
      organizationId: 'org1',
    });
  });

  it('forwards the active workspace and org on a template send', async () => {
    render(
      <TestDispatchDialog
        open
        onOpenChange={() => {}}
        channel="email"
        templateId="tpl1"
        variables={{}}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('your-email@example.com'),
      'joseph.aidoo@smartsapp.com'
    );
    await clickSend();

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect(sendMessage.mock.calls[0][0]).toMatchObject({
      templateId: 'tpl1',
      expectedChannel: 'email',
      workspaceId: 'ws1',
      organizationId: 'org1',
    });
  });

  it('rejects sending SMS when recipient is an email address', async () => {
    render(
      <TestDispatchDialog
        open
        onOpenChange={() => {}}
        channel="sms"
        rawBody="Your code is 123456"
        variables={{}}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('e.g. +233242737120'),
      'invalid-email@smartsapp.com'
    );
    await clickSend();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(sendRawMessage).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: 'Invalid Phone Number',
      })
    );
  });

  it('rejects sending SMS when rawBody contains HTML email markup', async () => {
    render(
      <TestDispatchDialog
        open
        onOpenChange={() => {}}
        channel="sms"
        rawBody="<!DOCTYPE html><html><body><table><tr><td>How We Stopped 60 Schools</td></tr></table></body></html>"
        variables={{}}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('e.g. +233242737120'),
      '+233501234567'
    );
    await clickSend();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(sendRawMessage).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: 'HTML Markup Detected',
      })
    );
  });

  it('forwards expectedChannel and templateId for SMS template sends', async () => {
    render(
      <TestDispatchDialog
        open
        onOpenChange={() => {}}
        channel="sms"
        templateId="sms-tpl-99"
        rawBody="Clean plain text alert"
        variables={{}}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('e.g. +233242737120'),
      '+233501234567'
    );
    await clickSend();

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect(sendMessage.mock.calls[0][0]).toMatchObject({
      templateId: 'sms-tpl-99',
      expectedChannel: 'sms',
      recipient: '+233501234567',
      workspaceId: 'ws1',
      organizationId: 'org1',
      body: 'Clean plain text alert',
    });
  });
});
