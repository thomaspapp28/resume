import { useState, useCallback } from 'react'
import { generateResume } from '../api/resume.js'

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
 * Hook for resume generation: state and trigger.
 * @returns {{
 *   loading: boolean,
 *   result: GenerateResult | null,
 *   status: Status,
 *   setStatus: (s: Status) => void,
 *   generate: (jobDescription: string) => Promise<void>,
 *   clearResult: () => void,
 * }}
 */
export function useGenerateResume() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(/** @type {GenerateResult | null} */ (null))
  const [status, setStatus] = useState(/** @type {Status} */ ({ text: '', type: '' }))

  const generate = useCallback(async (jobDescription) => {
    const trimmed = jobDescription.trim()
    if (!trimmed) {
      setStatus({ text: 'Please paste a job description first.', type: 'error' })
      return
    }
    setLoading(true)
    setStatus({ text: 'Generating resume…', type: 'loading' })
    setResult(null)
    try {
      const { data, error } = await generateResume(trimmed)
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
          ? `Saved to data/${data.saved_dir}/${(data.saved_files ?? []).join(', ')}. `
          : ''
        const baseMsg = data.base_used ? `Base: ${data.base_used}. ` : ''
        setStatus({
          text: `Done. ${baseMsg}${dirMsg}You can copy the text or download .docx / .pdf.`,
          type: 'success',
        })
      }
    } catch (e) {
      setStatus({
        text: 'Network error: ' + (e?.message ?? 'Unknown'),
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const clearResult = useCallback(() => {
    setResult(null)
    setStatus({ text: '', type: '' })
  }, [])

  return { loading, result, status, setStatus, generate, clearResult }
}
