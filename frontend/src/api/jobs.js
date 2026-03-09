import { apiFetch } from './client.js'

/**
 * @typedef {Object} JobListItem
 * @property {number} id
 * @property {string} jobright_id
 * @property {string} title
 * @property {string} company
 * @property {string} location
 * @property {string} url
 * @property {string} salary
 * @property {string} job_type
 * @property {string} status
 * @property {string} created_at
 */

/**
 * @param {{ status?: string, search?: string, page?: number, limit?: number }} [params]
 * @returns {Promise<{ data?: JobListItem[], error?: string }>}
 */
export async function listJobs(params = {}) {
  const searchParams = new URLSearchParams()
  if (params.status) searchParams.set('status', params.status)
  if (params.search) searchParams.set('search', params.search)
  if (params.page != null) searchParams.set('page', String(params.page))
  if (params.limit != null) searchParams.set('limit', String(params.limit))
  const qs = searchParams.toString()
  const res = await apiFetch(`api/jobs${qs ? `?${qs}` : ''}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join(' ')
      : data.detail || data.error || 'Request failed'
    return { error: message }
  }
  return { data: Array.isArray(data) ? data : [] }
}

/**
 * @returns {Promise<{ data?: { total: number, new: number, normal: number, applied: number }, error?: string }>}
 */
export async function getJobCounts() {
  const res = await apiFetch('api/jobs/count')
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join(' ')
      : data.detail || data.error || 'Request failed'
    return { error: message }
  }
  return { data: data || {} }
}

/**
 * @returns {Promise<{ data?: { message: string, already_running?: boolean }, error?: string }>}
 */
export async function triggerFetch() {
  const res = await apiFetch('api/jobs/fetch', { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join(' ')
      : data.detail || data.error || 'Request failed'
    return { error: message }
  }
  return { data }
}

/**
 * @returns {Promise<{ data?: { running: boolean }, error?: string }>}
 */
export async function getFetchStatus() {
  const res = await apiFetch('api/jobs/fetch/status')
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join(' ')
      : data.detail || data.error || 'Request failed'
    return { error: message }
  }
  return { data: data || {} }
}

/**
 * @param {number} jobId
 * @param {string} status - 'new' | 'normal' | 'applied'
 * @returns {Promise<{ data?: JobListItem, error?: string }>}
 */
export async function updateJobStatus(jobId, status) {
  const res = await apiFetch(`api/jobs/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join(' ')
      : data.detail || data.error || 'Request failed'
    return { error: message }
  }
  return { data }
}

/**
 * @returns {Promise<{ data?: { last_fetch_at: string | null }, error?: string }>}
 */
export async function getLastFetchTime() {
  const res = await apiFetch('api/jobs/fetch/last')
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join(' ')
      : data.detail || data.error || 'Request failed'
    return { error: message }
  }
  return { data: data || {} }
}
