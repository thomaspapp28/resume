import { apiFetch } from './client.js'

/**
 * @typedef {Object} WorkExperience
 * @property {string} company_name
 * @property {string} job_title
 * @property {string} date_from - YYYY-MM
 * @property {string} date_to - YYYY-MM
 */

/**
 * @typedef {Object} Education
 * @property {string} university - University / school name (same as education institution)
 * @property {string} degree
 * @property {string} field
 * @property {string} date_from - YYYY-MM
 * @property {string} date_to - YYYY-MM
 */

/**
 * @typedef {Object} Profile
 * @property {number} id
 * @property {string} full_name
 * @property {string} subtitle
 * @property {string} email
 * @property {string} location
 * @property {string} phone
 * @property {WorkExperience[]} work_experiences
 * @property {Education[]} educations
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} ProfileSummary
 * @property {number} id
 * @property {string} full_name
 */

/**
 * @returns {Promise<{ data?: ProfileSummary[], error?: string }>}
 */
export async function listProfiles() {
  const res = await apiFetch('api/profiles')
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join(' ')
      : data.detail || data.error || 'Request failed'
    return { error: message }
  }
  return { data: data || [] }
}

/**
 * @param {number} id
 * @returns {Promise<{ data?: Profile, error?: string }>}
 */
export async function getProfile(id) {
  const res = await apiFetch(`api/profiles/${id}`)
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
 * @param {Partial<Profile>} profile
 * @returns {Promise<{ data?: Profile, error?: string }>}
 */
export async function createProfile(profile) {
  const body = {
    full_name: profile.full_name ?? '',
    subtitle: profile.subtitle ?? '',
    email: profile.email ?? '',
    location: profile.location ?? '',
    phone: profile.phone ?? '',
    work_experiences: profile.work_experiences ?? [],
    educations: profile.educations ?? [],
  }
  const res = await apiFetch('api/profiles', {
    method: 'POST',
    body: JSON.stringify(body),
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
 * @param {number} id
 * @param {Partial<Profile>} profile
 * @returns {Promise<{ data?: Profile, error?: string }>}
 */
export async function updateProfile(id, profile) {
  const body = {}
  if (profile.full_name !== undefined) body.full_name = profile.full_name
  if (profile.subtitle !== undefined) body.subtitle = profile.subtitle
  if (profile.email !== undefined) body.email = profile.email
  if (profile.location !== undefined) body.location = profile.location
  if (profile.phone !== undefined) body.phone = profile.phone
  if (profile.work_experiences !== undefined) body.work_experiences = profile.work_experiences
  if (profile.educations !== undefined) body.educations = profile.educations

  const res = await apiFetch(`api/profiles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
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
 * @param {number} id
 * @returns {Promise<{ error?: string }>}
 */
export async function deleteProfile(id) {
  const res = await apiFetch(`api/profiles/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const message = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join(' ')
      : data.detail || data.error || 'Request failed'
    return { error: message }
  }
  return {}
}
