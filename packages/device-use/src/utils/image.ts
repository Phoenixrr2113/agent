import sharp from 'sharp';
import { readFile } from 'fs/promises';

export async function imageToBase64(imagePath: string): Promise<string> {
  const buffer = await readFile(imagePath);
  const base64 = buffer.toString('base64');
  return base64;
}

export async function resizeAndConvertToBase64(
  imagePath: string,
  maxWidth?: number,
  maxHeight?: number
): Promise<string> {
  let image = sharp(imagePath);

  if (maxWidth || maxHeight) {
    image = image.resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const buffer = await image.png().toBuffer();
  return buffer.toString('base64');
}

export async function bufferToBase64(buffer: Buffer): Promise<string> {
  const pngBuffer = await sharp(buffer).png().toBuffer();
  return pngBuffer.toString('base64');
}
