import { resolve } from 'node:path';

// Development must never use the production URL saved in the preview's environment.
export function isLocalPreview() {
  return process.env.NODE_ENV === 'development';
}

export function localPreviewDirectory() {
  return resolve(process.env.NITRO_PREVIEW_DATA_DIR || './data/local-preview');
}
