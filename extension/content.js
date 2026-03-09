/**
 * Content script — injected into job board pages.
 * Handles: JD scraping, form auto-fill, screening question extraction, PDF upload.
 * Supports: Ashby, Greenhouse, Lever, LinkedIn, Workday, Jobright, and generic pages.
 */

/* ══════════════════════════════════════════════════════════════════════
 *  1. JOB DESCRIPTION SCRAPING
 *  Site-specific selectors with generic fallback.
 * ══════════════════════════════════════════════════════════════════════ */

const SITE_SELECTORS = [
  // Ashby (jobs.ashbyhq.com)
  '[data-testid="job-description"]',
  '.ashby-job-posting-brief-description',
  '[class*="ashby_job"]',
  '.ashby_jobPage_descriptionContent',
  // Greenhouse (boards.greenhouse.io)
  '#content .body',
  '#content',
  '.job__description',
  '#job_description',
  // Lever (jobs.lever.co)
  '.posting-page .content',
  '.posting-categories + .posting-description',
  '.section-wrapper.page-full-width',
  // LinkedIn
  '#job-details',
  '.jobs-description__content',
  '.jobs-description-content__text',
  '.description__text',
  // Workday (*.myworkdayjobs.com)
  '[data-automation-id="jobPostingDescription"]',
  '.css-cygeeu',
  // Indeed
  '#jobDescriptionText',
  '.jobsearch-jobDescriptionText',
  // Jobright
  '.job-detail-description',
  '.description-content',
  // BambooHR
  '.BambooHR-ATS-board__job-content',
  // SmartRecruiters
  '.job-sections',
  '.jobad-content',
  // iCIMS / Taleo / generic ATS
  '.iCIMS_JobContent',
  '.job-description',
  // Generic patterns
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

function getJobDescription() {
  for (const sel of SITE_SELECTORS) {
    try {
      const el = document.querySelector(sel)
      if (el && el.innerText.trim().length > 80) {
        return el.innerText.trim()
      }
    } catch (_) {
      // invalid selector on this page, skip
    }
  }

  // Fallback: find the deepest container with the most relevant text.
  // Prefer elements that contain job-related keywords.
  const keywords = /responsibilities|requirements|qualifications|experience|about the role|what you|you will|we are looking/i
  const candidates = document.querySelectorAll('div, section, article, main')
  let best = null
  let bestScore = 0

  for (const block of candidates) {
    const text = block.innerText || ''
    if (text.length < 200) continue
    const hasKeywords = keywords.test(text)
    const childCount = block.querySelectorAll('div, section, article').length
    // Score: prefer keyword-rich, moderately-sized blocks over the full page body
    const score = (hasKeywords ? 500 : 0) + Math.min(text.length, 5000) - childCount * 2
    if (score > bestScore) {
      bestScore = score
      best = text.trim()
    }
  }
  return best || ''
}

/* ══════════════════════════════════════════════════════════════════════
 *  2. SCREENING QUESTION EXTRACTION
 *  Finds question labels + their input fields on the application form.
 * ══════════════════════════════════════════════════════════════════════ */

function getScreeningQuestions() {
  const questions = []
  // Look for label + input/textarea/select pairs
  const labels = document.querySelectorAll('label')
  for (const label of labels) {
    const text = label.innerText.trim()
    if (!text || text.length < 5) continue
    // Skip common non-question labels
    if (/^(first name|last name|email|phone|resume|cover letter|name)$/i.test(text)) continue
    const forId = label.getAttribute('for')
    let input = forId ? document.getElementById(forId) : null
    if (!input) {
      input = label.querySelector('input, textarea, select')
    }
    if (!input) {
      input = label.parentElement?.querySelector('input, textarea, select')
    }
    if (input) {
      questions.push({
        question: text,
        inputType: input.tagName.toLowerCase(),
        inputId: input.id || '',
        inputName: input.name || '',
        currentValue: input.value || '',
      })
    }
  }
  return questions
}

/* ══════════════════════════════════════════════════════════════════════
 *  3. FORM AUTO-FILL
 *  Fills standard application fields (name, email, phone, etc.)
 * ══════════════════════════════════════════════════════════════════════ */

function setInputValue(input, value) {
  if (!input || !value) return false
  const nativeSet = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set || Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set
  if (nativeSet) {
    nativeSet.call(input, value)
  } else {
    input.value = value
  }
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  input.dispatchEvent(new Event('blur', { bubbles: true }))
  return true
}

function findFieldByPatterns(patterns) {
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'i')
    // Search by label text
    for (const label of document.querySelectorAll('label')) {
      if (regex.test(label.innerText)) {
        const forId = label.getAttribute('for')
        const input = forId
          ? document.getElementById(forId)
          : label.querySelector('input, textarea, select')
          || label.parentElement?.querySelector('input, textarea, select')
        if (input) return input
      }
    }
    // Search by input attributes
    for (const input of document.querySelectorAll('input, textarea, select')) {
      const attrs = [input.name, input.id, input.placeholder, input.getAttribute('aria-label')]
      if (attrs.some((a) => a && regex.test(a))) return input
    }
  }
  return null
}

function autoFillProfile(profile) {
  const filled = []

  const fieldMap = [
    { patterns: ['first.?name'], value: (profile.full_name || '').split(' ')[0] },
    { patterns: ['last.?name', 'surname'], value: (profile.full_name || '').split(' ').slice(1).join(' ') },
    { patterns: ['^name$', 'full.?name', 'your.?name'], value: profile.full_name },
    { patterns: ['email', 'e-mail'], value: profile.email },
    { patterns: ['phone', 'mobile', 'tel'], value: profile.phone },
    { patterns: ['city', 'location', 'address'], value: profile.location },
  ]

  for (const { patterns, value } of fieldMap) {
    if (!value) continue
    const input = findFieldByPatterns(patterns)
    if (input && setInputValue(input, value)) {
      filled.push(patterns[0])
    }
  }

  return filled
}

/* ══════════════════════════════════════════════════════════════════════
 *  4. FILL SCREENING QUESTION ANSWERS
 * ══════════════════════════════════════════════════════════════════════ */

function fillAnswers(answers) {
  let filledCount = 0
  for (const { inputId, inputName, answer } of answers) {
    let input = null
    if (inputId) input = document.getElementById(inputId)
    if (!input && inputName) input = document.querySelector(`[name="${inputName}"]`)
    if (input && setInputValue(input, answer)) {
      filledCount++
    }
  }
  return filledCount
}

/* ══════════════════════════════════════════════════════════════════════
 *  5. PDF UPLOAD
 *  Converts base64 PDF to a File and injects into the file input.
 * ══════════════════════════════════════════════════════════════════════ */

function uploadPdf(base64, filename) {
  const fileInputs = document.querySelectorAll('input[type="file"]')
  if (!fileInputs.length) return false

  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const file = new File([bytes], filename || 'resume.pdf', { type: 'application/pdf' })

  let uploaded = false
  for (const fileInput of fileInputs) {
    // Check if this input accepts PDFs
    const accept = (fileInput.getAttribute('accept') || '').toLowerCase()
    if (accept && !accept.includes('pdf') && !accept.includes('*')) continue

    const dt = new DataTransfer()
    dt.items.add(file)
    fileInput.files = dt.files
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    fileInput.dispatchEvent(new Event('input', { bubbles: true }))
    uploaded = true
    break
  }

  // Some sites use drag-and-drop zones instead of file inputs
  if (!uploaded) {
    const dropZones = document.querySelectorAll(
      '[class*="upload"], [class*="dropzone"], [class*="file-drop"], [class*="resume"]'
    )
    for (const zone of dropZones) {
      const dt = new DataTransfer()
      dt.items.add(file)
      zone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
      uploaded = true
      break
    }
  }

  return uploaded
}

/* ══════════════════════════════════════════════════════════════════════
 *  6. MESSAGE HANDLER — called by popup.js
 *  Guard prevents duplicate registration when script is injected multiple times.
 * ══════════════════════════════════════════════════════════════════════ */

if (!window.__resumeAutoApplyInjected) {
  window.__resumeAutoApplyInjected = true

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.action) {
      case 'scrapeJD':
        sendResponse({ ok: true, jobDescription: getJobDescription() })
        break

      case 'scrapeQuestions':
        sendResponse({ ok: true, questions: getScreeningQuestions() })
        break

      case 'autoFill':
        try {
          const filled = autoFillProfile(msg.profile)
          sendResponse({ ok: true, filled })
        } catch (e) {
          sendResponse({ ok: false, error: e.message })
        }
        break

      case 'fillAnswers':
        try {
          const count = fillAnswers(msg.answers)
          sendResponse({ ok: true, filledCount: count })
        } catch (e) {
          sendResponse({ ok: false, error: e.message })
        }
        break

      case 'uploadPdf':
        try {
          const success = uploadPdf(msg.base64, msg.filename)
          sendResponse({ ok: true, uploaded: success })
        } catch (e) {
          sendResponse({ ok: false, error: e.message })
        }
        break

      default:
        sendResponse({ ok: false, error: `Unknown action: ${msg.action}` })
    }
    return false
  })
}
