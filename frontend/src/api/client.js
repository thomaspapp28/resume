/**
 * API base URL. Empty string means same origin (use Vite proxy in dev).
 */
const API_BASE = import.meta.env.VITE_API_URL ?? ''

/**
 * @param {string} path - Path without leading slash (e.g. 'api/generate')
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
export function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}/${path.replace(/^\//, '')}`
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

export { API_BASE }
