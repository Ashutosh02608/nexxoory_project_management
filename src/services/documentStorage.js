/**
 * Central Database Document Service
 * Binary documents stored directly in PostgreSQL BYTEA via API.
 * Converts between File / Blob and base64 payloads with caching.
 */
import { DocumentsAPI } from './api';

// In-memory object URL cache to avoid re-fetching repeated downloads/previews in same session
const blobCache = new Map();

/**
 * Converts a File or Blob into base64 string
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Converts base64 to Blob
 */
export function base64ToBlob(base64, mimeType = 'application/octet-stream') {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Retrieves document binary file directly from PostgreSQL database.
 * Returns { file: Blob, name: string, type: string, size: number }
 */
export async function getDocumentFile(id) {
  if (!id) return null;

  if (blobCache.has(id)) {
    return blobCache.get(id);
  }

  try {
    const res = await DocumentsAPI.getFile(id);
    if (!res || !res.fileBase64) return null;

    const blob = base64ToBlob(res.fileBase64, res.mimeType);
    const result = {
      id: res.id,
      file: blob,
      name: res.name,
      type: res.mimeType,
      size: res.sizeBytes
    };

    blobCache.set(id, result);
    return result;
  } catch (err) {
    console.error(`[DOCUMENT STORAGE] Failed to fetch document ${id} from database:`, err);
    return null;
  }
}

/**
 * Clears cached blob for given document ID
 */
export function clearDocumentCache(id) {
  if (id) blobCache.delete(id);
  else blobCache.clear();
}
