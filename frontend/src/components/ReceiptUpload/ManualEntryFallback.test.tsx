import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ManualEntryFallback } from './ManualEntryFallback';

describe('ManualEntryFallback', () => {
  it('renders form fields and buttons', () => {
    render(
      <ManualEntryFallback onSubmit={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/merchant/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save details/i })).toBeInTheDocument();
  });

  it('calls onCancel when Back is clicked', () => {
    const onCancel = vi.fn();
    render(<ManualEntryFallback onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows error when amount is invalid on submit', async () => {
    const onSubmit = vi.fn();
    render(<ManualEntryFallback onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /save details/i }));
    expect(screen.getByText(/valid amount/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with entered data when amount is valid', () => {
    const onSubmit = vi.fn();
    render(<ManualEntryFallback onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '25.50' } });
    fireEvent.change(screen.getByLabelText(/merchant/i), { target: { value: 'Store' } });
    fireEvent.click(screen.getByRole('button', { name: /save details/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '25.50',
        merchant: 'Store',
      })
    );
  });

  it('uses default date when not provided', () => {
    const onSubmit = vi.fn();
    render(<ManualEntryFallback onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /save details/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '10.00',
        date: expect.any(String),
      })
    );
  });
});
