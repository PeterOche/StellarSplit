import type { PixelCrop } from 'react-image-crop';

const TO_RADIANS = Math.PI / 180;

/**
 * Draw cropped (and optionally rotated) image to canvas and return as blob.
 * Used by ImageCropper to produce final image file.
 */
export async function getCroppedImageBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
  rotate = 0,
  mimeType: string = 'image/jpeg',
  quality = 0.9
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = window.devicePixelRatio ?? 1;

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio);
  ctx.scale(pixelRatio, pixelRatio);
  ctx.imageSmoothingQuality = 'high';

  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;
  const rotateRads = rotate * TO_RADIANS;
  const centerX = image.naturalWidth / 2;
  const centerY = image.naturalHeight / 2;

  ctx.save();
  ctx.translate(-cropX, -cropY);
  ctx.translate(centerX, centerY);
  ctx.rotate(rotateRads);
  ctx.translate(-centerX, -centerY);
  ctx.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight
  );
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      mimeType,
      quality
    );
  });
}

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const;
export const ACCEPTED_PDF_TYPE = 'application/pdf' as const;
export const ACCEPTED_RECEIPT_TYPES = [...ACCEPTED_IMAGE_TYPES, ACCEPTED_PDF_TYPE] as const;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function isImageFile(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number]);
}

export function isPdfFile(file: File): boolean {
  return file.type === ACCEPTED_PDF_TYPE;
}

export function isAcceptedReceiptType(file: File): boolean {
  return isImageFile(file) || isPdfFile(file);
}
