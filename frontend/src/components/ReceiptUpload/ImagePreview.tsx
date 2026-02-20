import { FileText, Crop, Trash2 } from 'lucide-react';
import { isPdfFile } from './utils/cropUtils';

export interface PreviewItem {
  id: string;
  file: File;
  previewUrl?: string; // object URL for images; undefined for PDF
  progress?: number; // 0–100 when uploading/compressing
  error?: string;
}

export interface ImagePreviewProps {
  items: PreviewItem[];
  /** Called when user wants to crop/edit an image (only for image files) */
  onCrop?: (item: PreviewItem) => void;
  /** Called when user removes an item */
  onRemove: (id: string) => void;
  /** Optional max number of thumbnails to show in a row */
  maxColumns?: number;
}

export function ImagePreview({
  items,
  onCrop,
  onRemove,
  maxColumns = 4,
}: ImagePreviewProps) {
  if (items.length === 0) return null;

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${Math.min(maxColumns, items.length)}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const isPdf = isPdfFile(item.file);
        return (
          <div
            key={item.id}
            className="relative rounded-xl border border-theme bg-card-theme overflow-hidden group"
          >
            <div className="aspect-square flex items-center justify-center bg-surface min-h-[100px]">
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="w-full h-full object-cover"
                />
              ) : isPdf ? (
                <div className="flex flex-col items-center gap-1 text-muted-theme p-2">
                  <FileText size={40} />
                  <span className="text-xs truncate w-full px-2 text-center">
                    {item.file.name}
                  </span>
                </div>
              ) : (
                <span className="text-muted-theme text-sm">Preview</span>
              )}
            </div>

            {item.progress !== undefined && item.progress < 100 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="w-12 h-12 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span className="absolute text-white text-xs mt-14">{item.progress}%</span>
              </div>
            )}

            {item.error && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 p-2">
                <p className="text-xs text-red-600 dark:text-red-400 text-center">{item.error}</p>
              </div>
            )}

            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!isPdf && item.previewUrl && onCrop && (
                <button
                  type="button"
                  onClick={() => onCrop(item)}
                  aria-label={`Crop ${item.file.name}`}
                  className="p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 focus:outline-none focus:ring-2 ring-theme min-h-[40px] min-w-[40px] flex items-center justify-center"
                >
                  <Crop size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.file.name}`}
                className="p-2 rounded-lg bg-black/60 text-white hover:bg-red-600 focus:outline-none focus:ring-2 ring-theme min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className="p-2 border-t border-theme">
              <p className="text-xs text-muted-theme truncate" title={item.file.name}>
                {item.file.name}
              </p>
              <p className="text-xs text-muted-theme">
                {(item.file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
