import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NumberStepperControl } from '../NumberStepperControl';

describe('NumberStepperControl', () => {
  it('renders spinbutton input and decrement/increment buttons', () => {
    render(
      <NumberStepperControl
        label="Step Index / Sequence"
        value={1}
        min={1}
        onChange={vi.fn()}
      />
    );

    const spinbutton = screen.getByRole('spinbutton', { name: /step index \/ sequence/i });
    expect(spinbutton).toBeInTheDocument();
    expect(spinbutton).toHaveValue(1);

    const decBtn = screen.getByRole('button', { name: /decrement/i });
    const incBtn = screen.getByRole('button', { name: /increment/i });
    expect(decBtn).toBeInTheDocument();
    expect(incBtn).toBeInTheDocument();
  });

  it('increments value by step on increment button click', () => {
    const handleChange = vi.fn();
    render(
      <NumberStepperControl
        label="Step Index"
        value={2}
        min={1}
        step={1}
        onChange={handleChange}
      />
    );

    const incBtn = screen.getByRole('button', { name: /increment/i });
    fireEvent.click(incBtn);
    expect(handleChange).toHaveBeenCalledWith(3);
  });

  it('decrements value by step on decrement button click', () => {
    const handleChange = vi.fn();
    render(
      <NumberStepperControl
        label="Step Index"
        value={3}
        min={1}
        step={1}
        onChange={handleChange}
      />
    );

    const decBtn = screen.getByRole('button', { name: /decrement/i });
    fireEvent.click(decBtn);
    expect(handleChange).toHaveBeenCalledWith(2);
  });

  it('disables decrement button and prevents going below min', () => {
    const handleChange = vi.fn();
    render(
      <NumberStepperControl
        label="Step Index"
        value={1}
        min={1}
        onChange={handleChange}
      />
    );

    const decBtn = screen.getByRole('button', { name: /decrement/i });
    expect(decBtn).toBeDisabled();
    fireEvent.click(decBtn);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('disables increment button and prevents going above max', () => {
    const handleChange = vi.fn();
    render(
      <NumberStepperControl
        label="Step Index"
        value={5}
        min={1}
        max={5}
        onChange={handleChange}
      />
    );

    const incBtn = screen.getByRole('button', { name: /increment/i });
    expect(incBtn).toBeDisabled();
    fireEvent.click(incBtn);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('handles direct input change and sanitizes input', () => {
    const handleChange = vi.fn();
    render(
      <NumberStepperControl
        label="Step Index"
        value={1}
        min={1}
        onChange={handleChange}
      />
    );

    const spinbutton = screen.getByRole('spinbutton', { name: /step index/i });
    fireEvent.change(spinbutton, { target: { value: '4' } });
    expect(handleChange).toHaveBeenCalledWith(4);
  });

  it('supports keyboard navigation via ArrowUp and ArrowDown', () => {
    const handleChange = vi.fn();
    render(
      <NumberStepperControl
        label="Step Index"
        value={2}
        min={1}
        onChange={handleChange}
      />
    );

    const spinbutton = screen.getByRole('spinbutton', { name: /step index/i });
    fireEvent.keyDown(spinbutton, { key: 'ArrowUp' });
    expect(handleChange).toHaveBeenCalledWith(3);

    fireEvent.keyDown(spinbutton, { key: 'ArrowDown' });
    expect(handleChange).toHaveBeenCalledWith(1);
  });
});
