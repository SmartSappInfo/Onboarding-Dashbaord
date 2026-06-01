import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VariablePicker } from '../VariablePicker';
import type { TemplateVariable } from '@/lib/types';

const mockVariables: TemplateVariable[] = [
  {
    id: 'common_contact_name',
    name: 'contact_name',
    label: 'Contact Name',
    description: 'Full name of the primary contact',
    dataType: 'string',
    context: 'common',
    exampleValue: 'Jane Doe',
    isDynamic: false,
    isComputed: false,
  },
  {
    id: 'common_organization_name',
    name: 'org_name',
    label: 'Organization Name',
    description: 'Name of the organization',
    dataType: 'string',
    context: 'common',
    exampleValue: 'SmartSapp Education',
    isDynamic: false,
    isComputed: false,
  },
  {
    id: 'meeting_link',
    name: 'meeting_link',
    label: 'Meeting Link',
    description: 'URL to join the meeting',
    dataType: 'url',
    context: 'meeting',
    exampleValue: 'https://meet.example.com/abc123',
    isDynamic: false,
    isComputed: false,
  },
  {
    id: 'meeting_time',
    name: 'meeting_time',
    label: 'Meeting Time',
    description: 'Scheduled time of the meeting',
    dataType: 'date',
    context: 'meeting',
    exampleValue: '2025-06-20 09:00 AM',
    isDynamic: false,
    isComputed: false,
  },
  {
    id: 'form_form_name',
    name: 'form_name',
    label: 'Form Name',
    description: 'Name of the form',
    dataType: 'string',
    context: 'form',
    exampleValue: 'Enrollment Application',
    isDynamic: false,
    isComputed: false,
  },
];

describe('VariablePicker', () => {
  it('renders trigger button with default label', () => {
    const onVariableSelect = vi.fn();
    render(<VariablePicker variables={mockVariables} onVariableSelect={onVariableSelect} />);

    expect(screen.getByRole('button', { name: /insert variable/i })).toBeInTheDocument();
  });

  it('renders trigger button with custom label', () => {
    const onVariableSelect = vi.fn();
    render(
      <VariablePicker
        variables={mockVariables}
        onVariableSelect={onVariableSelect}
        triggerLabel="Add Variable"
      />
    );

    expect(screen.getByRole('button', { name: /add variable/i })).toBeInTheDocument();
  });

  it('opens popover when trigger is clicked', async () => {
    const user = userEvent.setup();
    const onVariableSelect = vi.fn();
    render(<VariablePicker variables={mockVariables} onVariableSelect={onVariableSelect} />);

    const trigger = screen.getByRole('button', { name: /insert variable/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search variables/i)).toBeInTheDocument();
    });
  });

  it('displays variables grouped by context', async () => {
    const user = userEvent.setup();
    const onVariableSelect = vi.fn();
    render(<VariablePicker variables={mockVariables} onVariableSelect={onVariableSelect} />);

    const trigger = screen.getByRole('button', { name: /insert variable/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Common')).toBeInTheDocument();
      expect(screen.getByText('Meeting')).toBeInTheDocument();
      expect(screen.getByText('Form')).toBeInTheDocument();
    });
  });

  it('displays variable names with {{}} syntax', async () => {
    const user = userEvent.setup();
    const onVariableSelect = vi.fn();
    render(<VariablePicker variables={mockVariables} onVariableSelect={onVariableSelect} />);

    const trigger = screen.getByRole('button', { name: /insert variable/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('{{contact_name}}')).toBeInTheDocument();
      expect(screen.getByText('{{meeting_link}}')).toBeInTheDocument();
      expect(screen.getByText('{{form_name}}')).toBeInTheDocument();
    });
  });

  it('filters variables based on search query', async () => {
    const user = userEvent.setup();
    const onVariableSelect = vi.fn();
    render(<VariablePicker variables={mockVariables} onVariableSelect={onVariableSelect} />);

    const trigger = screen.getByRole('button', { name: /insert variable/i });
    await user.click(trigger);

    const searchInput = await screen.findByPlaceholderText(/search variables/i);
    await user.type(searchInput, 'meeting');

    await waitFor(() => {
      expect(screen.getByText('{{meeting_link}}')).toBeInTheDocument();
      expect(screen.getByText('{{meeting_time}}')).toBeInTheDocument();
      expect(screen.queryByText('{{contact_name}}')).not.toBeInTheDocument();
      expect(screen.queryByText('{{form_name}}')).not.toBeInTheDocument();
    });
  });

  it('filters variables by label', async () => {
    const user = userEvent.setup();
    const onVariableSelect = vi.fn();
    render(<VariablePicker variables={mockVariables} onVariableSelect={onVariableSelect} />);

    const trigger = screen.getByRole('button', { name: /insert variable/i });
    await user.click(trigger);

    const searchInput = await screen.findByPlaceholderText(/search variables/i);
    await user.type(searchInput, 'Contact Name');

    await waitFor(() => {
      expect(screen.getByText('{{contact_name}}')).toBeInTheDocument();
      expect(screen.queryByText('{{meeting_link}}')).not.toBeInTheDocument();
    });
  });

  it('shows "No variables found" when search has no results', async () => {
    const user = userEvent.setup();
    const onVariableSelect = vi.fn();
    render(<VariablePicker variables={mockVariables} onVariableSelect={onVariableSelect} />);

    const trigger = screen.getByRole('button', { name: /insert variable/i });
    await user.click(trigger);

    const searchInput = await screen.findByPlaceholderText(/search variables/i);
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText(/no variables found/i)).toBeInTheDocument();
    });
  });

  it('calls onVariableSelect with variable name when clicked', async () => {
    const user = userEvent.setup();
    const onVariableSelect = vi.fn();
    render(<VariablePicker variables={mockVariables} onVariableSelect={onVariableSelect} />);

    const trigger = screen.getByRole('button', { name: /insert variable/i });
    await user.click(trigger);

    const variableButton = await screen.findByText('{{contact_name}}');
    await user.click(variableButton);

    expect(onVariableSelect).toHaveBeenCalledWith('contact_name');
  });

  it('closes popover after variable selection', async () => {
    const user = userEvent.setup();
    const onVariableSelect = vi.fn();
    render(<VariablePicker variables={mockVariables} onVariableSelect={onVariableSelect} />);

    const trigger = screen.getByRole('button', { name: /insert variable/i });
    await user.click(trigger);

    const variableButton = await screen.findByText('{{contact_name}}');
    await user.click(variableButton);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/search variables/i)).not.toBeInTheDocument();
    });
  });

  it('resets search query after variable selection', async () => {
    const user = userEvent.setup();
    const onVariableSelect = vi.fn();
    render(<VariablePicker variables={mockVariables} onVariableSelect={onVariableSelect} />);

    // Open and search
    const trigger = screen.getByRole('button', { name: /insert variable/i });
    await user.click(trigger);

    const searchInput = await screen.findByPlaceholderText(/search variables/i);
    await user.type(searchInput, 'meeting');

    // Select a variable
    const variableButton = await screen.findByText('{{meeting_link}}');
    await user.click(variableButton);

    // Reopen and verify search is cleared
    await user.click(trigger);
    const newSearchInput = await screen.findByPlaceholderText(/search variables/i);
    expect(newSearchInput).toHaveValue('');
  });

  it('displays dynamic badge for dynamic variables', async () => {
    const user = userEvent.setup();
    const dynamicVariable: TemplateVariable = {
      id: 'form_field_1',
      name: 'form_fields.student_name',
      label: 'Student Name',
      description: 'Form field: Student Name',
      dataType: 'string',
      context: 'form',
      exampleValue: 'John Doe',
      isDynamic: true,
      sourceFormId: 'form123',
      sourceFieldId: 'field1',
      isComputed: false,
    };

    const onVariableSelect = vi.fn();
    render(
      <VariablePicker
        variables={[...mockVariables, dynamicVariable]}
        onVariableSelect={onVariableSelect}
      />
    );

    const trigger = screen.getByRole('button', { name: /insert variable/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Dynamic')).toBeInTheDocument();
    });
  });

  it('displays computed badge for computed variables', async () => {
    const user = userEvent.setup();
    const computedVariable: TemplateVariable = {
      id: 'common_current_date',
      name: 'current_date',
      label: 'Current Date',
      description: "Today's date",
      dataType: 'date',
      context: 'common',
      exampleValue: '2025-06-15',
      isDynamic: false,
      isComputed: true,
      computeExpression: 'new Date().toLocaleDateString()',
    };

    const onVariableSelect = vi.fn();
    render(
      <VariablePicker
        variables={[...mockVariables, computedVariable]}
        onVariableSelect={onVariableSelect}
      />
    );

    const trigger = screen.getByRole('button', { name: /insert variable/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Computed')).toBeInTheDocument();
    });
  });

  it('displays variable labels and example values', async () => {
    const user = userEvent.setup();
    const onVariableSelect = vi.fn();
    render(<VariablePicker variables={mockVariables} onVariableSelect={onVariableSelect} />);

    const trigger = screen.getByRole('button', { name: /insert variable/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Contact Name')).toBeInTheDocument();
      expect(screen.getByText('Meeting Link')).toBeInTheDocument();
    });
  });
});
