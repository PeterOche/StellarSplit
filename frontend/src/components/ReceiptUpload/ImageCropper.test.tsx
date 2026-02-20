import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageCropper } from './ImageCropper';

vi.mock('./utils/cropUtils', () => ({
  getCroppedImageBlob: vi.fn(),
}));

import { getCroppedImageBlob } from './utils/cropUtils';

describe('ImageCropper', () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders image and control buttons', () => {
    render(
      <ImageCropper
        src="data:image/jpeg;base64,/9j/4AAQ"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    const img = document.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(screen.getByLabelText(/rotate left/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/rotate right/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', () => {
    render(
      <ImageCropper src="data:image/jpeg;base64,/9j/4AAQ" onConfirm={onConfirm} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm with file when Apply is clicked after image load', async () => {
    vi.mocked(getCroppedImageBlob).mockResolvedValue(new Blob(['cropped'], { type: 'image/jpeg' }));

    render(
      <ImageCropper
        src="data:image/jpeg;base64,/9j/4AAQ"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await waitFor(() => {
      expect(document.querySelector('img')).toBeInTheDocument();
    });

    const img = document.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    Object.defineProperty(img, 'naturalWidth', { value: 200, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 200, configurable: true });
    Object.defineProperty(img, 'width', { value: 200, configurable: true });
    Object.defineProperty(img, 'height', { value: 200, configurable: true });
    fireEvent.load(img);

    const applyBtn = screen.getByRole('button', { name: /apply/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(getCroppedImageBlob).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(expect.any(File));
    });
  });
});
