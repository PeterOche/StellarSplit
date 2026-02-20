import { useCallback, useRef, useState } from 'react';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  convertToPixelCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { RotateCw, RotateCcw, Check, X } from 'lucide-react';
import { getCroppedImageBlob } from './utils/cropUtils';

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop(
      { unit: '%', width: 90 },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export interface ImageCropperProps {
  /** Object URL or data URL of the image to crop */
  src: string;
  /** Original file name for the output */
  fileName?: string;
  /** Called with the cropped image file when user confirms */
  onConfirm: (file: File) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Optional aspect ratio (e.g. 4/3). Omit for free crop */
  aspect?: number;
}

export function ImageCropper({
  src,
  fileName = 'receipt.jpg',
  onConfirm,
  onCancel,
  aspect,
}: ImageCropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [rotate, setRotate] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      let newCrop: Crop;
      if (aspect) {
        newCrop = centerAspectCrop(width, height, aspect);
      } else {
        newCrop = centerCrop(
          makeAspectCrop({ unit: '%', width: 90 }, width / height, width, height),
          width,
          height
        );
      }
      setCrop(newCrop);
      setCompletedCrop(convertToPixelCrop(newCrop, width, height));
    },
    [aspect]
  );

  const handleRotateLeft = () => setRotate((r) => r - 90);
  const handleRotateRight = () => setRotate((r) => r + 90);

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop?.width || !completedCrop?.height) {
      setError('Please adjust the crop area.');
      return;
    }
    setIsExporting(true);
    setError(null);
    try {
      const blob = await getCroppedImageBlob(
        imgRef.current,
        completedCrop,
        rotate,
        'image/jpeg',
        0.9
      );
      const file = new File([blob], fileName.replace(/\.[^.]+$/, '.jpg') || 'receipt.jpg', {
        type: 'image/jpeg',
      });
      onConfirm(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to crop image');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh] bg-surface border-theme border rounded-xl overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto p-2 md:p-4">
        <div className="relative max-w-full mx-auto" style={{ touchAction: 'none' }}>
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            minWidth={80}
            minHeight={80}
            className="max-w-full"
            style={{ maxHeight: '60vh' }}
          >
            <img
              ref={imgRef}
              src={src}
              alt="Crop"
              style={{
                maxHeight: '60vh',
                width: 'auto',
                height: 'auto',
                transform: `rotate(${rotate}deg)`,
              }}
              onLoad={onImageLoad}
            />
          </ReactCrop>
        </div>
      </div>

      {/* Touch-friendly crop/rotate controls */}
      <div className="flex flex-wrap items-center justify-center gap-2 p-3 border-t border-theme bg-card-theme">
        <button
          type="button"
          onClick={handleRotateLeft}
          aria-label="Rotate left"
          className="min-h-[44px] min-w-[44px] p-3 rounded-xl bg-surface border border-theme text-theme hover:bg-accent hover:text-white hover:border-accent transition-colors focus:outline-none focus:ring-2 ring-theme"
        >
          <RotateCcw size={24} />
        </button>
        <button
          type="button"
          onClick={handleRotateRight}
          aria-label="Rotate right"
          className="min-h-[44px] min-w-[44px] p-3 rounded-xl bg-surface border border-theme text-theme hover:bg-accent hover:text-white hover:border-accent transition-colors focus:outline-none focus:ring-2 ring-theme"
        >
          <RotateCw size={24} />
        </button>
      </div>

      {error && (
        <p className="px-4 py-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3 p-3 border-t border-theme bg-card-theme">
        <button
          type="button"
          onClick={onCancel}
          disabled={isExporting}
          className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-theme bg-surface text-theme hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 focus:outline-none focus:ring-2 ring-theme"
        >
          <span className="flex items-center justify-center gap-2">
            <X size={20} /> Cancel
          </span>
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isExporting}
          className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-accent text-white hover:opacity-90 disabled:opacity-50 focus:outline-none focus:ring-2 ring-theme"
        >
          <span className="flex items-center justify-center gap-2">
            {isExporting ? (
              <>
                <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                Applying…
              </>
            ) : (
              <>
                <Check size={20} /> Apply
              </>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
