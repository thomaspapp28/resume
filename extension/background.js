/**
 * Service Worker — API bridge between popup/content scripts and the backend.
 * Uses chrome.storage.local so state survives service worker restarts.
 */

const API_BASE = 'http://localhost:8000/api'

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}/${path.replace(/^\//, '')}`
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join(' ')
      : data.detail || data.error || `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

async function saveState(updates) {
  return chrome.storage.local.set(updates)
}

async function loadState(keys) {
  return chrome.storage.local.get(keys)
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'api') {
    handleApiMessage(msg)
      .then((result) => sendResponse({ ok: true, data: result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === 'getResult') {
    loadState(['generatedResult']).then((s) => {
      sendResponse({ ok: true, data: s.generatedResult || null })
    })
    return true
  }

  if (msg.type === 'clearResult') {
    saveState({ generatedResult: null }).then(() => {
      sendResponse({ ok: true })
    })
    return true
  }

  if (msg.type === 'savePopupState') {
    saveState(msg.state || {}).then(() => sendResponse({ ok: true }))
    return true
  }

  if (msg.type === 'loadPopupState') {
    loadState([
      'currentJD', 'generatedResult', 'selectedProfile',
      'selectedBase', 'selectedPrompt', 'selectedDocx', 'currentProfileData',
    ]).then((s) => sendResponse({ ok: true, data: s }))
    return true
  }
})

async function handleApiMessage(msg) {
  switch (msg.action) {
    case 'fetchProfiles':
      return apiFetch('profiles')

    case 'fetchOptions':
      return apiFetch('options')

    case 'getProfile':
      return apiFetch(`profiles/${msg.profileId}`)

    case 'generate': {
      const body = {
        job_description: msg.jobDescription,
        force: true,
      }
      if (msg.profileId) body.profile_id = msg.profileId
      if (msg.baseTemplate) body.base_template = msg.baseTemplate
      if (msg.promptName) body.prompt_name = msg.promptName
      if (msg.docxTemplate) body.docx_template = msg.docxTemplate
      const result = await apiFetch('generate', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      await saveState({ generatedResult: result })
      return result
    }

    case 'answerQuestions': {
      const body = {
        questions: msg.questions,
        job_description: msg.jobDescription,
        profile_id: msg.profileId,
      }
      return apiFetch('answer-questions', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    }

    case 'fetchJobs':
      return apiFetch('jobs/fetch', { method: 'POST' })

    case 'fetchJobsStatus':
      return apiFetch('jobs/fetch/status')

    case 'listJobs': {
      const params = new URLSearchParams()
      if (msg.status) params.set('status', msg.status)
      if (msg.search) params.set('search', msg.search)
      if (msg.page) params.set('page', String(msg.page))
      if (msg.limit) params.set('limit', String(msg.limit))
      const qs = params.toString()
      return apiFetch(`jobs${qs ? '?' + qs : ''}`)
    }

    case 'getJob':
      return apiFetch(`jobs/${msg.jobId}`)

    case 'updateJobStatus':
      return apiFetch(`jobs/${msg.jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: msg.status }),
      })

    case 'jobCounts':
      return apiFetch('jobs/count')

    default:
      throw new Error(`Unknown action: ${msg.action}`)
  }
}

// Open extension in side panel (right side of window) when icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab?.windowId != null) {
    chrome.sidePanel.open({ windowId: tab.windowId })
  }
})
