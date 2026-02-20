import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImagePreview } from './ImagePreview';
import type { PreviewItem } from './ImagePreview';

function makeItem(overrides: Partial<PreviewItem> = {}): PreviewItem {
  return {
    id: '1',
    file: new File(['x'], 'receipt.jpg', { type: 'image/jpeg' }),
    previewUrl: 'blob:http://localhost/fake',
    ...overrides,
  };
}

describe('ImagePreview', () => {
  it('returns null when items is empty', () => {
    const { container } = render(
      <ImagePreview items={[]} onRemove={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders image previews', () => {
    const items = [makeItem()];
    render(<ImagePreview items={items} onRemove={vi.fn()} />);
    const img = document.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'receipt.jpg');
  });

  it('renders PDF placeholder when file is PDF', () => {
    const items = [
      makeItem({
        file: new File(['x'], 'doc.pdf', { type: 'application/pdf' }),
        previewUrl: undefined,
      }),
    ];
    render(<ImagePreview items={items} onRemove={vi.fn()} />);
    const pdfLabels = screen.getAllByText('doc.pdf');
    expect(pdfLabels.length).toBeGreaterThan(0);
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn();
    const items = [makeItem({ id: 'a1' })];
    render(<ImagePreview items={items} onRemove={onRemove} onCrop={vi.fn()} />);
    const removeBtn = screen.getByLabelText(/remove receipt.jpg/i);
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledWith('a1');
  });

  it('calls onCrop when crop button is clicked for image', () => {
    const onCrop = vi.fn();
    const items = [makeItem({ id: 'a1' })];
    render(<ImagePreview items={items} onRemove={vi.fn()} onCrop={onCrop} />);
    const cropBtn = screen.getByLabelText(/crop receipt.jpg/i);
    fireEvent.click(cropBtn);
    expect(onCrop).toHaveBeenCalledWith(items[0]);
  });
});
