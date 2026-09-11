import { describe, expect, it } from 'vitest';
import { fnv1aHex, fetchEvidenceImage, EVIDENCE_PHOTOS } from './evidencePackage';

// 1x1 red pixel JPEG as a data URL fixture.
const JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDQ0NP/AABEIAAEAAQMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwDAQACEQMRAD8A/9k=';

describe('fnv1aHex', () => {
  it('is deterministic and hex-formatted', () => {
    expect(fnv1aHex('hello')).toBe(fnv1aHex('hello'));
    expect(fnv1aHex('hello')).toMatch(/^[0-9a-f]{8}$/);
    expect(fnv1aHex('hello')).not.toBe(fnv1aHex('hellp'));
  });

  it('produces distinct checksums for the CSV vs photo fixtures', () => {
    expect(fnv1aHex('TicketID, VIN\n1, ABC')).not.toBe(fnv1aHex(JPEG_DATA_URL.split(',')[1]));
  });
});

describe('fetchEvidenceImage', () => {
  it('decodes data-URL images without network', async () => {
    const result = await fetchEvidenceImage(JPEG_DATA_URL);
    expect(result).not.toBeNull();
    expect(result!.ext).toBe('jpg');
    expect(result!.base64.length).toBeGreaterThan(50);
    expect(result!.checksum).toMatch(/^[0-9a-f]{8}$/);
    expect(result!.bytes).toBeGreaterThan(100);
  });

  it('returns null for malformed data URLs', async () => {
    expect(await fetchEvidenceImage('data:image/jpeg,notbase64!')).toBeNull();
  });

  it('returns null for empty/unfetchable references', async () => {
    expect(await fetchEvidenceImage('')).toBeNull();
    expect(await fetchEvidenceImage('http://127.0.0.1:1/nope.jpg')).toBeNull();
  });
});

describe('EVIDENCE_PHOTOS', () => {
  it('uses the canonical ordered evidence filenames', () => {
    expect(EVIDENCE_PHOTOS.map((p) => p.name)).toEqual([
      '01_seller',
      '02_id',
      '03_vehicle',
      '04_plate',
      '05_load',
    ]);
  });
});
