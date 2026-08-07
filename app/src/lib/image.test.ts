import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { processImage } from './image';

const originalImage = globalThis.Image;
const originalCreateElement = document.createElement.bind(document);

let canvas: { width: number; height: number; getContext: () => typeof context; toBlob: typeof toBlob };
let context: { imageSmoothingQuality: string; drawImage: ReturnType<typeof vi.fn> };
let toBlob: ReturnType<typeof vi.fn>;
let image: { width: number; height: number; onload: (() => void) | null; onerror: (() => void) | null; src: string };

beforeEach(() => {
  context = { imageSmoothingQuality: '', drawImage: vi.fn() };
  toBlob = vi.fn((callback: BlobCallback, type?: string, quality?: number) => {
    expect(type).toBe('image/jpeg');
    expect(quality).toBe(0.82);
    callback(new Blob(['jpeg'], { type: 'image/jpeg' }));
  });
  canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob,
  };
  image = { width: 4000, height: 3000, onload: null, onerror: null, src: '' };
  vi.stubGlobal('Image', class {
    width = image.width;
    height = image.height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
      image.src = value;
      this.onload?.();
    }
  });
  vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
    if (tagName === 'canvas') return canvas as unknown as HTMLElement;
    return originalCreateElement(tagName);
  }) as typeof document.createElement);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalImage) globalThis.Image = originalImage;
});

test('resizes a wide image to 1800px on the long edge', async () => {
  const result = await processImage(new Blob(['input'], { type: 'image/jpeg' }));
  expect(canvas.width).toBe(1800);
  expect(canvas.height).toBe(1350);
  expect(context.imageSmoothingQuality).toBe('high');
  expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1800, 1350);
  expect(toBlob).toHaveBeenCalledOnce();
  expect(result.type).toBe('image/jpeg');
});

test('does not upscale a small image', async () => {
  image.width = 640;
  image.height = 480;
  const result = await processImage(new Blob(['input'], { type: 'image/png' }));
  expect(canvas.width).toBe(640);
  expect(canvas.height).toBe(480);
  expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 640, 480);
  expect(result.type).toBe('image/jpeg');
});

test('rejects non-image files with the legacy message', async () => {
  await expect(processImage(new Blob(['pdf'], { type: 'application/pdf' })))
    .rejects.toThrow('Images only — photograph a document rather than uploading a PDF');
});

test('rejects when the image cannot be read', async () => {
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) { this.onerror?.(); }
  });
  await expect(processImage(new Blob(['bad'], { type: 'image/jpeg' })))
    .rejects.toThrow('That file is not a readable image');
});
