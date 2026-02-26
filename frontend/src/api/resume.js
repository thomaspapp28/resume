import { apiFetch } from './client.js'

/**
 * Fetch available base templates and prompts.
 * @returns {Promise<{ data?: { available_bases: string[], available_prompts: string[] }, error?: string }>}
 */
export async function fetchOptions() {
  const res = await apiFetch('api/options')
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
 * @typedef {Object} AnalyzeResponse
 * @property {boolean} is_remote
 * @property {boolean} requires_clearance
 * @property {boolean} is_eligible
 * @property {string} suggested_base
 * @property {string} suggested_prompt
 * @property {string[]} available_bases
 * @property {string[]} available_prompts
 */

/**
 * @typedef {Object} GenerateResponse
 * @property {string} resume_text
 * @property {string|null} docx_base64
 * @property {string|null} pdf_base64
 * @property {string} docx_filename
 * @property {string} pdf_filename
 * @property {string} saved_dir
 * @property {string[]} saved_files
 */

/**
 * Analyze job description.
 * @param {string} jobDescription
 * @returns {Promise<{ data?: AnalyzeResponse, error?: string }>}
 */
export async function analyzeJob(jobDescription) {
  const res = await apiFetch('api/analyze', {
    method: 'POST',
    body: JSON.stringify({ job_description: jobDescription.trim() }),
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
 * Generate tailored resume from job description.
 * @param {string} jobDescription
 * @param {{ base_template?: string, prompt_name?: string, force?: boolean, profile_id?: number }} [opts]
 * @returns {Promise<{ data?: GenerateResponse, error?: string }>}
 */
export async function generateResume(jobDescription, opts = {}) {
  const body = { job_description: jobDescription.trim() }
  if (opts.base_template) body.base_template = opts.base_template
  if (opts.prompt_name) body.prompt_name = opts.prompt_name
  if (opts.force) body.force = opts.force
  if (opts.profile_id != null) body.profile_id = opts.profile_id
  if (opts.docx_template != null && opts.docx_template >= 1 && opts.docx_template <= 5) body.docx_template = opts.docx_template
  const res = await apiFetch('api/generate', {
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
