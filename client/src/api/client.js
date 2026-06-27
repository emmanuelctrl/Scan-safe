// Thin fetch wrapper that centralises base URL, auth headers, JSON parsing,
// and error handling so components stay clean.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Keys for browser storage.
const TOKEN_KEY = 'it_token';
const OWNER_TOKEN_KEY = 'it_owner_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
  getOwner: () => sessionStorage.getItem(OWNER_TOKEN_KEY),
  setOwner: (t) => sessionStorage.setItem(OWNER_TOKEN_KEY, t),
  clearOwner: () => sessionStorage.removeItem(OWNER_TOKEN_KEY),
};

/**
 * Perform an API request.
 * @param {string} path        e.g. '/api/auth/login'
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object} [options.body]    Auto-JSON-stringified.
 * @param {boolean} [options.owner]  Attach the owner token header.
 */
export async function api(path, { method = 'GET', body, owner = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  if (owner) {
    const ownerToken = tokenStore.getOwner();
    if (ownerToken) headers['x-owner-token'] = ownerToken;
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiClientError('Network error — is the server running?', 0);
  }

  // Some endpoints (none currently) may return empty bodies.
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const message = data?.error?.message || 'Request failed.';
    throw new ApiClientError(message, res.status, data?.error?.details);
  }

  return data;
}

/**
 * Upload a file (multipart/form-data) — used for the Excel/CSV inventory import.
 * @param {string} path
 * @param {File} file
 * @param {object} [fields]   Extra string form fields (e.g. { replace: 'true' }).
 * @param {boolean} [owner]   Attach the owner token header.
 */
export async function uploadFile(path, file, fields = {}, owner = true) {
  const form = new FormData();
  form.append('file', file);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);

  const headers = {}; // Let the browser set the multipart boundary.
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (owner) {
    const ownerToken = tokenStore.getOwner();
    if (ownerToken) headers['x-owner-token'] = ownerToken;
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: form });
  } catch {
    throw new ApiClientError('Network error — is the server running?', 0);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = data?.error?.message || 'Upload failed.';
    throw new ApiClientError(message, res.status, data?.error?.details);
  }
  return data;
}

export class ApiClientError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
