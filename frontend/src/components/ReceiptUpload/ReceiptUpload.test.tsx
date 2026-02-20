import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReceiptUpload } from './ReceiptUpload';

vi.mock('react-dropzone', () => ({
  useDropzone: (options: { onDrop: (accepted: File[], rejected: unknown[]) => void }) => {
    const { onDrop } = options;
    return {
      getRootProps: () => ({ 'data-testid': 'dropzone' }),
      getInputProps: () => ({}),
      isDragActive: false,
      open: vi.fn(),
      // Expose a way to simulate drop in tests
      __simulateDrop: (accepted: File[], rejected: unknown[] = []) => onDrop(accepted, rejected),
    };
  },
}));

vi.mock('browser-image-compression', () => ({
  default: vi.fn((file: File) =>
    Promise.resolve(new File([file], file.name, { type: file.type }))
  ),
}));

describe('ReceiptUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dropzone and manual entry option', () => {
    render(<ReceiptUpload />);
    expect(screen.getByText(/drag.*drop|click to browse/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/upload receipt files/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enter details manually/i })).toBeInTheDocument();
  });

  it('shows manual entry form when Enter details manually is clicked', () => {
    render(<ReceiptUpload />);
    fireEvent.click(screen.getByRole('button', { name: /enter details manually/i }));
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('calls onManualEntry when manual form is submitted', () => {
    const onManualEntry = vi.fn();
    render(<ReceiptUpload onManualEntry={onManualEntry} />);
    fireEvent.click(screen.getByRole('button', { name: /enter details manually/i }));
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '19.99' } });
    fireEvent.click(screen.getByRole('button', { name: /save details/i }));
    expect(onManualEntry).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '19.99' })
    );
  });

  it('shows dropzone again when Back is clicked from manual entry', () => {
    render(<ReceiptUpload />);
    fireEvent.click(screen.getByRole('button', { name: /enter details manually/i }));
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText(/drag.*drop|click to browse/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/amount/i)).not.toBeInTheDocument();
  });
});
