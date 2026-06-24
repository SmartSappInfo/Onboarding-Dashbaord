import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormView } from '../FormView';

describe('FormView', () => {
  it('renders a field per definition and the title', () => {
    render(
      <FormView
        title="Join the waitlist"
        fields={[{ id: 'email', label: 'Email', type: 'email' }]}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByText('Join the waitlist')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('collects field values and calls onSubmit with a key/value map', async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <FormView
        title="Contact"
        fields={[{ id: 'email', label: 'Email', type: 'email' }]}
        submitLabel="Send"
        onSubmit={onSubmit}
      />,
    );
    const input = container.querySelector('input[name="email"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a@b.com' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.com' });
  });
});
