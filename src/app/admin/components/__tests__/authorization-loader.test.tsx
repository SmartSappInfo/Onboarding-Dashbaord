import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AuthorizationLoader from '../authorization-loader';

describe('AuthorizationLoader', () => {
  it('renders the checking status correctly', () => {
    render(<AuthorizationLoader status="checking" />);
    expect(screen.getByText(/Checking Authorization/i)).toBeInTheDocument();
  });

  it('renders the success status correctly', () => {
    render(<AuthorizationLoader status="success" />);
    expect(screen.getByText(/Authorization Successful/i)).toBeInTheDocument();
  });

  it('renders the failed status correctly', () => {
    render(<AuthorizationLoader status="failed" />);
    expect(screen.getByText(/Authorization Failed/i)).toBeInTheDocument();
  });

  it('displays the SmartSapp logo', () => {
    render(<AuthorizationLoader status="checking" />);
    // SmartSappLogo is a client component, we check for its presence in the DOM
    expect(screen.getByText(/SmartSapp/i)).toBeInTheDocument();
  });
});
