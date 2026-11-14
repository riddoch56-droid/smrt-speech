import type { WordCues } from '../content/types';
import { blobToBinary, type Binary } from '../platform/db';
import { countLetters, type AppWord } from '../session/words';

export interface Crop {
  x: number;
  y: number;
  size: number;
}

/** The largest square that fits in the image, centred. */
export function centredSquare(width: number, height: number): Crop {
  const size = Math.max(1, Math.floor(Math.min(width, height)));
  return { x: Math.floor((width - size) / 2), y: Math.floor((height - size) / 2), size };
}

/** Keeps a square crop inside the image. */
export function clampCrop(crop: Crop, width: number, height: number): Crop {
  const max = Math.max(1, Math.min(width, height));
  const size = Math.min(max, Math.max(1, crop.size));
  const x = Math.min(Math.max(0, width - size), Math.max(0, crop.x));
  const y = Math.min(Math.max(0, height - size), Math.max(0, crop.y));
  return { x, y, size };
}

export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

function loadImageElement(file: Blob): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        release: () => URL.revokeObjectURL(url),
      });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as a picture.'));
    };
    img.src = url;
  });
}

/** Decodes a picture, honouring EXIF orientation where the browser supports it. */
export async function decodeImage(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      try {
        const bmp = await createImageBitmap(file);
        return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
      } catch {
        /* fall back to an image element */
      }
    }
  }
  return loadImageElement(file);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

/** Crops to a square, scales to outSize pixels and encodes as WebP (or JPEG if WebP is unavailable). */
export async function squareImage(file: Blob, crop: Crop | null, outSize = 512): Promise<Binary> {
  const img = await decodeImage(file);
  try {
    const c = crop ? clampCrop(crop, img.width, img.height) : centredSquare(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = outSize;
    canvas.height = outSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Pictures cannot be processed in this browser.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outSize, outSize);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img.source, c.x, c.y, c.size, c.size, 0, 0, outSize, outSize);
    let blob = await canvasToBlob(canvas, 'image/webp', 0.8);
    if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
    if (!blob) throw new Error('The picture could not be saved.');
    return await blobToBinary(blob);
  } finally {
    img.release();
  }
}

export function estimateSyllables(word: string): number {
  const parts = word.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  let total = 0;
  for (const p of parts) {
    let n = (p.match(/[aeiouy]+/g) ?? []).length;
    if (n > 1 && /[^aeiouy]e$/.test(p) && !/[^aeiouy]le$/.test(p)) n -= 1;
    total += Math.max(1, n);
  }
  return Math.max(1, total);
}

export function buildCustomWord(input: {
  id: string;
  word: string;
  group: string;
  syllables: number;
  patientId: string | null;
  cues?: Partial<WordCues>;
}): AppWord {
  const word = input.word.trim();
  const letters = word.replace(/[^a-z]/gi, '');
  const first = letters.charAt(0).toLowerCase();
  const last = letters.charAt(letters.length - 1).toLowerCase();
  const cues = input.cues ?? {};
  const cueOut: WordCues = {
    definition: cues.definition ?? '',
    sentenceCompletion: cues.sentenceCompletion ?? '',
    firstLetter: cues.firstLetter ?? first,
    firstSoundSpoken: cues.firstSoundSpoken ?? '',
  };
  if (cues.firstSyllable) cueOut.firstSyllable = cues.firstSyllable;
  return {
    id: input.id,
    word,
    group: input.group,
    subgroup: '',
    wordClass: 'noun',
    letters: countLetters(word),
    syllables: Math.max(1, Math.round(input.syllables)),
    frequencyBand: 2,
    multiWord: /\s/.test(word),
    childFriendly: true,
    image: '',
    imagePrompt: '',
    cues: cueOut,
    semantic: { category: '', use: '', action: '', properties: '', location: '', association: '' },
    phonological: {
      firstSound: first,
      lastSound: last,
      syllables: Math.max(1, Math.round(input.syllables)),
      rhyme: null,
      sameFirstSound: '',
    },
    custom: true,
    patientId: input.patientId,
  };
}
