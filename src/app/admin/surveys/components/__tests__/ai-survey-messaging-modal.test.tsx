import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AiSurveyMessagingModal from '../ai-survey-messaging-modal';
import type { GenerateSurveyMessagingOutput } from '@/ai/schemas/survey-messaging-schemas';

// Mock dependencies
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    activeOrganization: {
      name: 'SmartSapp Academy',
      logoUrl: 'https://example.com/logo.png',
      email: 'alerts@smartsapp.com',
    },
  }),
}));

const mockQuickSave = vi.fn().mockResolvedValue({ success: true, templateId: 'test_tmpl_1' });
vi.mock('@/lib/survey-ai-messaging-actions', () => ({
  quickSaveSurveyTemplateAction: (...args: unknown[]) => mockQuickSave(...args),
}));

const sampleAiOutput: GenerateSurveyMessagingOutput = {
  email: {
    name: 'New Submission Team Alert - Email',
    subject: 'New Submission from {{contact_name}} - Score {{survey_score}}%',
    body: 'A new submission has been received for the survey. Please review the responses.',
    blocks: [
      {
        id: 'blk_logo_1',
        type: 'logo',
        url: '{{org_logo_url}}',
      },
      {
        id: 'blk_heading_1',
        type: 'heading',
        title: 'New Survey Response Recorded',
        variant: 'h2',
      },
      {
        id: 'blk_text_1',
        type: 'text',
        content: 'A new response was submitted by **{{contact_name}}**. Below are the summary highlights.',
      },
      {
        id: 'blk_list_1',
        type: 'list',
        items: [
          'Respondent: {{contact_name}}',
          'Score: {{survey_score}}%',
          'Status: Qualified',
        ],
      },
      {
        id: 'blk_button_1',
        type: 'button',
        title: 'View In Dashboard',
        url: 'https://smartsapp.com/admin/dashboard',
      },
    ],
    explanation: 'Designed to alert internal teams immediately with key metrics.',
  },
  sms: {
    name: 'New Submission Team Alert - SMS',
    body: 'Alert: New survey submission from {{contact_name}} (Score: {{survey_score}}%). View: {{dashboard_link}}',
    explanation: 'Concise SMS alert within standard limits.',
  },
  whatsapp: {
    name: 'survey_team_alert_wa',
    header: 'New Survey Response',
    body: 'Hello Team, a new response was received from {{1}}. Overall score: {{2}}%. View report: {{3}}.',
    footer: 'SmartSapp Automated Alerts',
    bodyParams: ['Dr. Mensah', '94', 'https://smartsapp.com/admin/dashboard'],
    whatsappCategory: 'UTILITY',
    explanation: 'Meta-approved alert format with positional tokens.',
  },
  overallSummary: 'High-converting notification suite across Email, SMS, and WhatsApp.',
};

describe('AiSurveyMessagingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal dialog with title, description, and preview', () => {
    render(
      <AiSurveyMessagingModal
        open={true}
        onOpenChange={vi.fn()}
        title="AI Generated Team Alerts"
        targetDescription="Auto-generated alert templates for internal team members."
        generatedOutput={sampleAiOutput}
        savedTemplateIds={{
          emailTemplateId: 'tmpl_email_1',
          smsTemplateId: 'tmpl_sms_1',
          whatsappTemplateId: 'tmpl_wa_1',
        }}
        onApply={vi.fn()}
      />
    );

    expect(screen.getByText('AI Generated Team Alerts')).toBeDefined();
    expect(screen.getByText('Auto-generated alert templates for internal team members.')).toBeDefined();

    // Verify visual preview mode is default and shows subject & email mockup
    expect(screen.getByText(/New Submission from/i)).toBeDefined();
    expect(screen.getByTitle('Email Live Preview')).toBeDefined();
  });

  it('allows toggling between Visual Preview and Edit Content modes', () => {
    render(
      <AiSurveyMessagingModal
        open={true}
        onOpenChange={vi.fn()}
        generatedOutput={sampleAiOutput}
        onApply={vi.fn()}
      />
    );

    // Click Edit Content toggle
    const editToggle = screen.getByRole('button', { name: /Edit Content/i });
    fireEvent.click(editToggle);

    // In Edit mode, input fields for Subject line and blocks should be visible
    expect(screen.getByLabelText(/Email Subject Line/i)).toBeDefined();
    expect(screen.getByDisplayValue('New Survey Response Recorded')).toBeDefined();
  });

  it('allows editing the email subject and block text directly in the modal', () => {
    render(
      <AiSurveyMessagingModal
        open={true}
        onOpenChange={vi.fn()}
        generatedOutput={sampleAiOutput}
        onApply={vi.fn()}
      />
    );

    // Switch to edit mode
    fireEvent.click(screen.getByRole('button', { name: /Edit Content/i }));

    // Edit subject line
    const subjectInput = screen.getByLabelText(/Email Subject Line/i);
    fireEvent.change(subjectInput, { target: { value: 'Custom Subject Line Alert' } });
    expect(screen.getByDisplayValue('Custom Subject Line Alert')).toBeDefined();

    // Switch back to preview mode
    fireEvent.click(screen.getByRole('button', { name: /Visual Preview/i }));

    // Preview should now reflect the updated subject
    expect(screen.getByText('Custom Subject Line Alert')).toBeDefined();
  });

  it('allows editing SMS body with character counter updates', () => {
    render(
      <AiSurveyMessagingModal
        open={true}
        onOpenChange={vi.fn()}
        generatedOutput={sampleAiOutput}
        defaultChannel="sms"
        onApply={vi.fn()}
      />
    );

    // Switch to Edit Content
    fireEvent.click(screen.getByRole('button', { name: /Edit Content/i }));

    const smsTextarea = screen.getByLabelText(/SMS Message Body/i);
    fireEvent.change(smsTextarea, { target: { value: 'Quick test SMS alert text.' } });

    expect(screen.getByDisplayValue('Quick test SMS alert text.')).toBeDefined();
    expect(screen.getByText(/26 \/ 160 characters/i)).toBeDefined();
  });

  it('persists edits to Firestore and invokes onApply when Apply is clicked', async () => {
    const handleApply = vi.fn();

    render(
      <AiSurveyMessagingModal
        open={true}
        onOpenChange={vi.fn()}
        generatedOutput={sampleAiOutput}
        savedTemplateIds={{
          emailTemplateId: 'tmpl_email_1',
          smsTemplateId: 'tmpl_sms_1',
          whatsappTemplateId: 'tmpl_wa_1',
        }}
        workspaceId="ws_123"
        organizationId="org_456"
        userId="user_789"
        onApply={handleApply}
      />
    );

    // Switch to Edit Content and modify email subject
    fireEvent.click(screen.getByRole('button', { name: /Edit Content/i }));
    const subjectInput = screen.getByLabelText(/Email Subject Line/i);
    fireEvent.change(subjectInput, { target: { value: 'Modified Email Subject' } });

    // Click Apply to Survey
    const applyButton = screen.getByRole('button', { name: /Apply to Survey/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(mockQuickSave).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws_123',
          organizationId: 'org_456',
          userId: 'user_789',
          templateId: 'tmpl_email_1',
          templateData: expect.objectContaining({
            subject: 'Modified Email Subject',
          }),
        })
      );
      expect(handleApply).toHaveBeenCalledWith({
        emailTemplateId: 'tmpl_email_1',
        smsTemplateId: 'tmpl_sms_1',
        whatsappTemplateId: 'tmpl_wa_1',
      });
    });
  });

  it('allows editing WhatsApp header, body, and parameter samples', () => {
    render(
      <AiSurveyMessagingModal
        open={true}
        onOpenChange={vi.fn()}
        generatedOutput={sampleAiOutput}
        defaultChannel="whatsapp"
        onApply={vi.fn()}
      />
    );

    // Switch to Edit Content
    fireEvent.click(screen.getByRole('button', { name: /Edit Content/i }));

    const headerInput = screen.getByLabelText(/WhatsApp Header/i);
    fireEvent.change(headerInput, { target: { value: 'Updated Header' } });
    expect(screen.getByDisplayValue('Updated Header')).toBeDefined();

    const bodyInput = screen.getByLabelText(/WhatsApp Message Body/i);
    fireEvent.change(bodyInput, { target: { value: 'Custom WhatsApp message with {{1}}' } });
    expect(screen.getByDisplayValue('Custom WhatsApp message with {{1}}')).toBeDefined();
  });

  it('allows resetting manual changes back to original AI copy', () => {
    render(
      <AiSurveyMessagingModal
        open={true}
        onOpenChange={vi.fn()}
        generatedOutput={sampleAiOutput}
        onApply={vi.fn()}
      />
    );

    // Switch to edit mode and change subject
    fireEvent.click(screen.getByRole('button', { name: /Edit Content/i }));
    const subjectInput = screen.getByLabelText(/Email Subject Line/i);
    fireEvent.change(subjectInput, { target: { value: 'Temporary Modified Subject' } });
    expect(screen.getByDisplayValue('Temporary Modified Subject')).toBeDefined();

    // Reset button should now appear in the footer
    const resetButton = screen.getByRole('button', { name: /Reset Changes/i });
    expect(resetButton).toBeDefined();

    // Click Reset
    fireEvent.click(resetButton);

    // Verify subject reverted to original AI generated text
    expect(screen.getByDisplayValue(sampleAiOutput.email!.subject)).toBeDefined();
  });

  it('allows typing corrections into the AI Command Bar and triggers refinement', async () => {
    const handleRegenerate = vi.fn().mockResolvedValue(undefined);

    render(
      <AiSurveyMessagingModal
        open={true}
        onOpenChange={vi.fn()}
        generatedOutput={sampleAiOutput}
        onApply={vi.fn()}
        onRegenerate={handleRegenerate}
      />
    );

    const commandInput = screen.getByLabelText(/AI Command Input/i);
    expect(commandInput).toBeDefined();

    fireEvent.change(commandInput, {
      target: { value: 'Make it more urgent and replace school with organization' },
    });

    const refineButton = screen.getByRole('button', { name: /Submit AI Command/i });
    fireEvent.click(refineButton);

    await waitFor(() => {
      expect(handleRegenerate).toHaveBeenCalledWith(
        'Make it more urgent and replace school with organization'
      );
    });
  });

  it('triggers AI refinement when a quick suggestion chip is clicked', async () => {
    const handleRegenerate = vi.fn().mockResolvedValue(undefined);

    render(
      <AiSurveyMessagingModal
        open={true}
        onOpenChange={vi.fn()}
        generatedOutput={sampleAiOutput}
        onApply={vi.fn()}
        onRegenerate={handleRegenerate}
      />
    );

    const conciseChip = screen.getByRole('button', { name: /More concise & punchy/i });
    expect(conciseChip).toBeDefined();

    fireEvent.click(conciseChip);

    await waitFor(() => {
      expect(handleRegenerate).toHaveBeenCalledWith('More concise & punchy');
    });
  });

  it('automatically sanitizes deprecated school_name and school_logo to canonical tokens', () => {
    const legacyOutput: GenerateSurveyMessagingOutput = {
      email: {
        name: 'Legacy Template',
        subject: 'Notification for {{school_name}}',
        body: 'Welcome to {{school_name}} with logo {{school_logo}}',
        blocks: [
          {
            id: 'b1',
            type: 'heading',
            title: 'Welcome to {{school_name}}',
            variant: 'h2',
          },
          {
            id: 'b2',
            type: 'text',
            content: 'Dear {{contact_name}}, this is {{school_name}}.',
          },
        ],
        explanation: 'Legacy email copy with deprecated tokens.',
      },
      overallSummary: 'Legacy test output',
    };

    render(
      <AiSurveyMessagingModal
        open={true}
        onOpenChange={vi.fn()}
        generatedOutput={legacyOutput}
        onApply={vi.fn()}
      />
    );

    // Switch to edit mode
    fireEvent.click(screen.getByRole('button', { name: /Edit Content/i }));

    // Verify school_name was converted to entity_name in the subject input and heading
    expect(screen.getByDisplayValue('Notification for {{entity_name}}')).toBeDefined();
    expect(screen.getByDisplayValue('Welcome to {{entity_name}}')).toBeDefined();
  });

  it('supports adding and deleting blocks in the WYSIWYG canvas', () => {
    render(
      <AiSurveyMessagingModal
        open={true}
        onOpenChange={vi.fn()}
        generatedOutput={sampleAiOutput}
        onApply={vi.fn()}
      />
    );

    // Switch to edit mode
    fireEvent.click(screen.getByRole('button', { name: /Edit Content/i }));

    // Click "+ Heading" in Add Block toolbar
    const addHeadingButtons = screen.getAllByRole('button', { name: /Heading/i });
    // Use the add block button (has Plus icon)
    fireEvent.click(addHeadingButtons[0]);

    // Verify a new heading block was added with default text
    expect(screen.getByDisplayValue('New Section Heading')).toBeDefined();
  });
});
