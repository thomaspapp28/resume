/**
 * Popup script — controls the extension UI.
 * Communicates with background.js (API calls) and content.js (page interaction).
 */

const $ = (sel) => document.querySelector(sel)
const profileSelect = $('#profileSelect')
const baseSelect = $('#baseSelect')
const promptSelect = $('#promptSelect')
const docxSelect = $('#docxSelect')
const jdPreview = $('#jdPreview')
const btnFetchJD = $('#btnFetchJD')
const btnGenerate = $('#btnGenerate')
const btnAutoFill = $('#btnAutoFill')
const statusBar = $('#statusBar')
const statusText = $('#statusText')
const statusSpinner = $('#statusSpinner')
const connectionDot = $('#connectionDot')
const resumeBadge = $('#resumeBadge')
const stepsSection = $('#stepsSection')
const stepsContainer = $('#stepsContainer')

let currentJD = ''
let generatedResult = null
let currentProfile = null

function savePopupState() {
  sendToBackground({
    type: 'savePopupState',
    state: {
      currentJD,
      generatedResult,
      currentProfileData: currentProfile,
      selectedProfile: profileSelect.value,
      selectedBase: baseSelect.value,
      selectedPrompt: promptSelect.value,
      selectedDocx: docxSelect.value,
    },
  })
}

/* ══════════════════════════════════════
   Helpers
   ══════════════════════════════════════ */

function showStatus(text, type = 'info', loading = false) {
  statusBar.className = `status-bar visible ${type}`
  statusText.textContent = text
  statusSpinner.style.display = loading ? 'inline-block' : 'none'
}

function hideStatus() {
  statusBar.className = 'status-bar'
}

function updateResumeBadge(ready) {
  resumeBadge.className = `result-badge ${ready ? 'ready' : 'not-ready'}`
  resumeBadge.textContent = ready ? 'Ready' : 'Not generated'
}

function updateGenerateBtn() {
  btnGenerate.disabled = !currentJD || !profileSelect.value
}

function updateAutoFillBtn() {
  btnAutoFill.disabled = !generatedResult || !profileSelect.value
}

function sendToBackground(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      resolve(response || { ok: false, error: 'No response from background' })
    })
  })
}

async function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs?.[0] || null)
    })
  })
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    })
  } catch (_) {
    // already injected or restricted page
  }
}

/** Scrape job description from page (runs in page context via executeScript). */
function scrapeJobDescriptionInPage() {
  const selectors = [
    '[data-testid="job-description"]',
    '.ashby-job-posting-brief-description',
    '[class*="ashby_job"]',
    '.ashby_jobPage_descriptionContent',
    '#content .body',
    '#content',
    '.job__description',
    '#job_description',
    '.posting-page .content',
    '.posting-categories + .posting-description',
    '.section-wrapper.page-full-width',
    '#job-details',
    '.jobs-description__content',
    '.jobs-description-content__text',
    '.description__text',
    '[data-automation-id="jobPostingDescription"]',
    '.css-cygeeu',
    '#jobDescriptionText',
    '.jobsearch-jobDescriptionText',
    '.job-detail-description',
    '.description-content',
    '.BambooHR-ATS-board__job-content',
    '.job-sections',
    '.jobad-content',
    '.iCIMS_JobContent',
    '.job-description',
    '[class*="jobDescription"]',
    '[class*="job-description"]',
    '[class*="JobDescription"]',
    '[class*="job_description"]',
    '[class*="job-details"]',
    '[class*="jobDetails"]',
    '[class*="posting-description"]',
    '[role="main"] article',
    'article .description',
    'main .description',
  ]
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel)
      if (el && el.innerText && el.innerText.trim().length > 80) {
        return el.innerText.trim()
      }
    } catch (_) {}
  }
  const keywords = /responsibilities|requirements|qualifications|experience|about the role|what you|you will|we are looking/i
  const candidates = document.querySelectorAll('div, section, article, main')
  let best = null
  let bestScore = 0
  for (const block of candidates) {
    const text = block.innerText || ''
    if (text.length < 200) continue
    const hasKeywords = keywords.test(text)
    const childCount = block.querySelectorAll('div, section, article').length
    const score = (hasKeywords ? 500 : 0) + Math.min(text.length, 5000) - childCount * 2
    if (score > bestScore) {
      bestScore = score
      best = text.trim()
    }
  }
  return best || ''
}

async function fetchJDViaScripting(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: scrapeJobDescriptionInPage,
    })
    const text = results?.[0]?.result
    return typeof text === 'string' ? text : ''
  } catch (e) {
    return ''
  }
}

async function sendToContent(msg) {
  const tab = await getActiveTab()
  if (!tab) return { ok: false, error: 'No active tab' }

  await ensureContentScript(tab.id)
  await new Promise((r) => setTimeout(r, 150))

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, msg, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message })
        return
      }
      resolve(response || { ok: false, error: 'No response from content script' })
    })
  })
}

/* ══════════════════════════════════════
   Steps UI
   ══════════════════════════════════════ */

function showSteps(steps) {
  stepsSection.style.display = 'block'
  stepsContainer.innerHTML = ''
  for (const step of steps) {
    const el = document.createElement('div')
    el.className = `step ${step.status || ''}`
    el.id = `step-${step.id}`
    el.innerHTML = `
      <div class="step-icon">${step.status === 'done' ? '✓' : step.status === 'error' ? '✕' : step.status === 'active' ? '…' : '○'}</div>
      <span>${step.label}</span>
    `
    stepsContainer.appendChild(el)
  }
}

function updateStep(id, status) {
  const el = document.getElementById(`step-${id}`)
  if (!el) return
  el.className = `step ${status}`
  const icon = el.querySelector('.step-icon')
  if (icon) {
    icon.textContent = status === 'done' ? '✓' : status === 'error' ? '✕' : status === 'active' ? '…' : '○'
  }
}

/* ══════════════════════════════════════
   Init: load profiles + options
   ══════════════════════════════════════ */

async function init() {
  const optRes = await sendToBackground({ type: 'api', action: 'fetchOptions' })
  if (!optRes.ok) {
    connectionDot.className = 'status-dot disconnected'
    connectionDot.title = 'Backend offline'
    showStatus('Backend not reachable at localhost:8000', 'error')
    return
  }
  connectionDot.className = 'status-dot connected'
  connectionDot.title = 'Connected'

  const options = optRes.data
  baseSelect.innerHTML = ''
  for (const b of options.available_bases || []) {
    const opt = document.createElement('option')
    opt.value = b
    opt.textContent = b.replace(/\.(json|txt)$/, '')
    baseSelect.appendChild(opt)
  }
  baseSelect.disabled = false

  promptSelect.innerHTML = ''
  for (const p of options.available_prompts || []) {
    const opt = document.createElement('option')
    opt.value = p
    opt.textContent = p.replace(/_/g, ' ')
    promptSelect.appendChild(opt)
  }
  promptSelect.disabled = false

  if (options.docx_templates?.length) {
    docxSelect.innerHTML = ''
    for (const t of options.docx_templates) {
      const opt = document.createElement('option')
      opt.value = t.id
      opt.textContent = t.name
      docxSelect.appendChild(opt)
    }
  }
  docxSelect.disabled = false

  baseSelect.addEventListener('change', () => {
    const stem = baseSelect.value.replace(/\.(json|txt)$/, '')
    for (const opt of promptSelect.options) {
      if (opt.value === stem) {
        promptSelect.value = stem
        break
      }
    }
    savePopupState()
  })

  promptSelect.addEventListener('change', () => savePopupState())
  docxSelect.addEventListener('change', () => savePopupState())

  const profRes = await sendToBackground({ type: 'api', action: 'fetchProfiles' })
  profileSelect.innerHTML = '<option value="">— Select profile —</option>'
  if (profRes.ok && Array.isArray(profRes.data)) {
    for (const p of profRes.data) {
      const opt = document.createElement('option')
      opt.value = p.id
      opt.textContent = `${p.full_name || 'Unnamed'}${p.subtitle ? ` — ${p.subtitle}` : ''}`
      profileSelect.appendChild(opt)
    }
  }
  profileSelect.disabled = false
  profileSelect.addEventListener('change', async () => {
    updateGenerateBtn()
    updateAutoFillBtn()
    if (profileSelect.value) {
      const res = await sendToBackground({
        type: 'api',
        action: 'getProfile',
        profileId: Number(profileSelect.value),
      })
      currentProfile = res.ok ? res.data : null
    } else {
      currentProfile = null
    }
    savePopupState()
  })

  // Restore previously saved state
  const saved = await sendToBackground({ type: 'loadPopupState' })
  if (saved.ok && saved.data) {
    const s = saved.data

    if (s.selectedBase && baseSelect.querySelector(`option[value="${s.selectedBase}"]`)) {
      baseSelect.value = s.selectedBase
    }
    if (s.selectedPrompt && promptSelect.querySelector(`option[value="${s.selectedPrompt}"]`)) {
      promptSelect.value = s.selectedPrompt
    }
    if (s.selectedDocx && docxSelect.querySelector(`option[value="${s.selectedDocx}"]`)) {
      docxSelect.value = s.selectedDocx
    }
    if (s.selectedProfile && profileSelect.querySelector(`option[value="${s.selectedProfile}"]`)) {
      profileSelect.value = s.selectedProfile
      currentProfile = s.currentProfileData || null
    }

    if (s.currentJD) {
      currentJD = s.currentJD
      jdPreview.className = 'jd-preview'
      jdPreview.textContent = currentJD
    }

    if (s.generatedResult) {
      generatedResult = s.generatedResult
      updateResumeBadge(true)
    }
  }

  updateGenerateBtn()
  updateAutoFillBtn()
  hideStatus()
}

/* ══════════════════════════════════════
   Fetch JD
   ══════════════════════════════════════ */

btnFetchJD.addEventListener('click', async () => {
  const tab = await getActiveTab()
  if (!tab) {
    showStatus('No active tab', 'error')
    return
  }
  if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
    showStatus('Cannot fetch from browser internal pages', 'error')
    return
  }

  showStatus('Scraping job description...', 'loading', true)

  let jobDescription = await fetchJDViaScripting(tab.id)
  if (!jobDescription) {
    const res = await sendToContent({ action: 'scrapeJD' })
    if (res.ok && res.jobDescription) jobDescription = res.jobDescription
  }

  if (jobDescription) {
    currentJD = jobDescription
    jdPreview.className = 'jd-preview'
    jdPreview.textContent = currentJD
    showStatus(`Job description captured (${currentJD.length} chars)`, 'success')
    setTimeout(hideStatus, 3000)
  } else {
    jdPreview.className = 'jd-preview empty'
    jdPreview.textContent = 'Could not find job description on this page'
    showStatus('No job description found. Try another job page.', 'error')
  }
  updateGenerateBtn()
  savePopupState()
})

/* ══════════════════════════════════════
   Generate Resume
   ══════════════════════════════════════ */

btnGenerate.addEventListener('click', async () => {
  if (!currentJD || !profileSelect.value) return
  btnGenerate.disabled = true
  btnFetchJD.disabled = true
  showStatus('Generating tailored resume...', 'loading', true)

  const res = await sendToBackground({
    type: 'api',
    action: 'generate',
    jobDescription: currentJD,
    profileId: Number(profileSelect.value),
    baseTemplate: baseSelect.value || undefined,
    promptName: promptSelect.value || undefined,
    docxTemplate: Number(docxSelect.value) || 1,
  })

  btnFetchJD.disabled = false

  if (res.ok) {
    generatedResult = res.data
    updateResumeBadge(true)
    showStatus('Resume generated successfully!', 'success')
    setTimeout(hideStatus, 4000)
  } else {
    showStatus(`Generation failed: ${res.error}`, 'error')
  }

  updateGenerateBtn()
  updateAutoFillBtn()
  savePopupState()
})

/* ══════════════════════════════════════
   Auto-Fill & Upload
   ══════════════════════════════════════ */

btnAutoFill.addEventListener('click', async () => {
  if (!generatedResult || !currentProfile) return
  btnAutoFill.disabled = true

  const steps = [
    { id: 'fill', label: 'Auto-fill form fields', status: 'active' },
    { id: 'questions', label: 'Answer screening questions', status: '' },
    { id: 'upload', label: 'Upload PDF resume', status: '' },
  ]
  showSteps(steps)

  const fillRes = await sendToContent({
    action: 'autoFill',
    profile: currentProfile,
  })
  updateStep('fill', fillRes.ok ? 'done' : 'error')

  updateStep('questions', 'active')
  const qRes = await sendToContent({ action: 'scrapeQuestions' })
  if (qRes.ok && qRes.questions?.length > 0) {
    const ansRes = await sendToBackground({
      type: 'api',
      action: 'answerQuestions',
      questions: qRes.questions.map((q) => q.question),
      jobDescription: currentJD,
      profileId: Number(profileSelect.value),
    })
    if (ansRes.ok && ansRes.data?.answers) {
      const answersToFill = qRes.questions.map((q, i) => ({
        inputId: q.inputId,
        inputName: q.inputName,
        answer: ansRes.data.answers[i] || '',
      }))
      const fillAnsRes = await sendToContent({ action: 'fillAnswers', answers: answersToFill })
      updateStep('questions', fillAnsRes.ok ? 'done' : 'error')
    } else {
      updateStep('questions', ansRes.ok ? 'done' : 'error')
    }
  } else {
    updateStep('questions', 'done')
  }

  updateStep('upload', 'active')
  if (generatedResult.pdf_base64) {
    const uploadRes = await sendToContent({
      action: 'uploadPdf',
      base64: generatedResult.pdf_base64,
      filename: generatedResult.pdf_filename || 'resume.pdf',
    })
    updateStep('upload', uploadRes.ok && uploadRes.uploaded ? 'done' : 'error')
    if (!uploadRes.ok || !uploadRes.uploaded) {
      showStatus('PDF upload may need manual action', 'warning')
    }
  } else {
    updateStep('upload', 'error')
    showStatus('No PDF available — DOCX was generated but PDF conversion may have failed', 'error')
  }

  showStatus('Auto-fill complete!', 'success')
  btnAutoFill.disabled = false
})

/* ══════════════════════════════════════
   Start
   ══════════════════════════════════════ */
init()
