import { useState, useCallback, useEffect } from 'react'
import { fetchOptions, analyzeJob, generateResume } from '../api/resume.js'
import { listProfiles } from '../api/profile.js'

/**
 * @typedef {Object} AnalysisResult
 * @property {boolean} is_remote
 * @property {boolean} requires_clearance
 * @property {boolean} is_eligible
 * @property {string} suggested_base
 * @property {string} suggested_prompt
 * @property {string[]} available_bases
 * @property {string[]} available_prompts
 */

/**
 * @typedef {Object} GenerateResult
 * @property {string} resumeText
 * @property {string|null} docxBase64
 * @property {string|null} pdfBase64
 * @property {string} docxFilename
 * @property {string} pdfFilename
 * @property {string} savedDir
 * @property {string[]} savedFiles
 */

/**
 * @typedef {Object} Status
 * @property {string} text
 * @property {''|'loading'|'error'|'success'} type
 */

/**
 * Hook for resume generation flow. Supports generate without analyze.
 * Options (bases, prompts) are fetched on mount.
 */
export function useResumeFlow() {
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [availableBases, setAvailableBases] = useState([])
  const [availablePrompts, setAvailablePrompts] = useState(['default'])
  const [docxTemplates, setDocxTemplates] = useState([])
  const [profiles, setProfiles] = useState([])
  const [selectedBase, setSelectedBase] = useState('')
  const [selectedPrompt, setSelectedPrompt] = useState('default')
  const [selectedDocxTemplate, setSelectedDocxTemplate] = useState(1)
  const [selectedProfileId, setSelectedProfileId] = useState(null)

  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [generateLoading, setGenerateLoading] = useState(false)
  const [analysis, setAnalysis] = useState(/** @type {AnalysisResult | null} */ (null))
  const [result, setResult] = useState(/** @type {GenerateResult | null} */ (null))
  const [status, setStatus] = useState(/** @type {Status} */ ({ text: '', type: '' }))

  useEffect(() => {
    let cancelled = false
    setOptionsLoading(true)
    Promise.all([fetchOptions(), listProfiles()]).then(([optRes, profRes]) => {
      if (cancelled) return
      setOptionsLoading(false)
      if (optRes.data) {
        const bases = optRes.data.available_bases ?? ['base1.txt']
        const prompts = optRes.data.available_prompts ?? ['default']
        const templates = optRes.data.docx_templates ?? []
        setAvailableBases(bases)
        setAvailablePrompts(prompts)
        setDocxTemplates(templates)
        setSelectedBase((prev) => (prev && bases.includes(prev) ? prev : bases[0]))
        setSelectedPrompt((prev) => (prev && prompts.includes(prev) ? prev : (prompts.includes('default') ? 'default' : prompts[0])))
      }
      if (profRes.data?.length) {
        setProfiles(profRes.data)
        setSelectedProfileId((prev) => prev && profRes.data.some((p) => p.id === prev) ? prev : profRes.data[0]?.id ?? null)
      }
    })
    return () => { cancelled = true }
  }, [])

  const runAnalyze = useCallback(async (jobDescription) => {
    const trimmed = jobDescription.trim()
    if (!trimmed) {
      setStatus({ text: 'Please paste a job description first.', type: 'error' })
      return
    }
    setAnalyzeLoading(true)
    setStatus({ text: 'Analyzing…', type: 'loading' })
    setAnalysis(null)
    try {
      const { data, error } = await analyzeJob(trimmed)
      if (error) {
        setStatus({ text: error, type: 'error' })
        return
      }
      if (data) {
        setAnalysis({
          is_remote: data.is_remote,
          requires_clearance: data.requires_clearance,
          is_eligible: data.is_eligible,
          suggested_base: data.suggested_base,
          suggested_prompt: data.suggested_prompt ?? 'default',
          available_bases: data.available_bases ?? availableBases,
          available_prompts: data.available_prompts ?? availablePrompts,
        })
        if (data.suggested_base) setSelectedBase(data.suggested_base)
        if (data.suggested_prompt) setSelectedPrompt(data.suggested_prompt)
        setStatus({
          text: data.is_eligible
            ? 'Eligible. Select base and prompt, then generate.'
            : `Not eligible. Use "Generate anyway" to override.`,
          type: data.is_eligible ? 'success' : 'error',
        })
      }
    } catch (e) {
      setStatus({ text: 'Network error: ' + (e?.message ?? 'Unknown'), type: 'error' })
    } finally {
      setAnalyzeLoading(false)
    }
  }, [availableBases, availablePrompts])

  const runGenerate = useCallback(async (jobDescription, force = false) => {
    const trimmed = jobDescription.trim()
    if (!trimmed) {
      setStatus({ text: 'Please paste a job description first.', type: 'error' })
      return
    }
    const base = selectedBase || availableBases[0]
    const prompt = selectedPrompt || availablePrompts[0] || 'default'
    if (!base) {
      setStatus({ text: 'Loading options…', type: 'error' })
      return
    }
    setGenerateLoading(true)
    setStatus({ text: 'Generating resume…', type: 'loading' })
    setResult(null)
    try {
      const { data, error } = await generateResume(trimmed, {
        base_template: base,
        prompt_name: prompt,
        force,
        profile_id: selectedProfileId || undefined,
        docx_template: selectedDocxTemplate,
      })
      if (error) {
        setStatus({ text: error, type: 'error' })
        return
      }
      if (data) {
        setResult({
          resumeText: data.resume_text ?? '',
          docxBase64: data.docx_base64 ?? null,
          pdfBase64: data.pdf_base64 ?? null,
          docxFilename: data.docx_filename ?? 'resume.docx',
          pdfFilename: data.pdf_filename ?? 'resume.pdf',
          savedDir: data.saved_dir ?? '',
          savedFiles: data.saved_files ?? [],
        })
        const dirMsg = data.saved_dir
          ? `Saved to data/${data.saved_dir}/. `
          : ''
        setStatus({
          text: `Done. ${dirMsg}Copy or download .docx / .pdf.`,
          type: 'success',
        })
      }
    } catch (e) {
      setStatus({ text: 'Network error: ' + (e?.message ?? 'Unknown'), type: 'error' })
    } finally {
      setGenerateLoading(false)
    }
  }, [selectedBase, selectedPrompt, selectedDocxTemplate, selectedProfileId, availableBases, availablePrompts])

  const clearAll = useCallback(() => {
    setAnalysis(null)
    setResult(null)
    setStatus({ text: '', type: '' })
  }, [])

  return {
    optionsLoading,
    availableBases,
    availablePrompts,
    docxTemplates,
    selectedDocxTemplate,
    setSelectedDocxTemplate,
    profiles,
    selectedProfileId,
    setSelectedProfileId,
    analyzeLoading,
    generateLoading,
    analysis,
    selectedBase,
    setSelectedBase,
    selectedPrompt,
    setSelectedPrompt,
    result,
    status,
    setStatus,
    runAnalyze,
    runGenerate,
    clearAll,
  }
}
