// Change only this value when the backend provides a new Cloudflare Tunnel URL.
// Used by emulator and physical-device builds; rebuild installed APKs after changes.
const SERVER_URL = 'https://databases-emphasis-striking-fell.trycloudflare.com';

export const API_BASE_URL = SERVER_URL.trim().replace(/\/+$/, '');

export const API_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 60_000;
