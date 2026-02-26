import { useState } from 'react'
import { useResumeFlow } from '../../hooks/useResumeFlow'
import { downloadBlob } from '../../lib/downloadBlob'
import { JobAnalysisResult } from './JobAnalysisResult'
import styles from './ResumeGenerator.module.css'

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MIME_PDF = 'application/pdf'

export function ResumeGenerator() {
  const [jd, setJd] = useState('')
  const {
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
  } = useResumeFlow()

  const loading = analyzeLoading || generateLoading

  function handleAnalyze() {
    runAnalyze(jd)
  }

  function handleGenerate() {
    runGenerate(jd, false)
  }

  function handleGenerateAnyway() {
    runGenerate(jd, true)
  }

  async function handleCopy() {
    if (!result?.resumeText) return
    try {
      await navigator.clipboard.writeText(result.resumeText)
      setStatus({ text: 'Copied to clipboard.', type: 'success' })
      setTimeout(() => {
        setStatus((s) => (s.text === 'Copied to clipboard.' ? { text: '', type: '' } : s))
      }, 2000)
    } catch {
      setStatus({ text: 'Copy failed', type: 'error' })
    }
  }

  const canGenerate = !optionsLoading && availableBases.length && jd.trim()
  const showAnalysis = analysis != null

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Resume Tailor</h1>
        <p className={styles.subtitle}>
          Paste a job description, select profile and template, then generate. Analyze (optional) checks remote and clearance.
        </p>
      </header>

      <section className={styles.inputSection}>
        <label htmlFor="jd" className={styles.label}>
          Job description
        </label>
        <textarea
          id="jd"
          className={styles.textarea}
          placeholder="Paste the full job description here…"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          disabled={loading}
        />
      </section>

      <section className={styles.optionsSection}>
        <div className={styles.option}>
          <label htmlFor="profile-select">Profile (person)</label>
          <select
            id="profile-select"
            value={selectedProfileId ?? ''}
            onChange={(e) => setSelectedProfileId(e.target.value ? Number(e.target.value) : null)}
            className={styles.select}
            disabled={optionsLoading || loading}
          >
            <option value="">— None (use template as-is) —</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name || 'Unnamed'}</option>
            ))}
          </select>
        </div>
        <div className={styles.option}>
          <label htmlFor="base-select">Base resume</label>
          <select
            id="base-select"
            value={selectedBase}
            onChange={(e) => setSelectedBase(e.target.value)}
            className={styles.select}
            disabled={optionsLoading || loading}
          >
            {availableBases.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className={styles.option}>
          <label htmlFor="docx-template-select">DOCX format</label>
          <select
            id="docx-template-select"
            value={selectedDocxTemplate}
            onChange={(e) => setSelectedDocxTemplate(Number(e.target.value))}
            className={styles.select}
            disabled={optionsLoading || loading}
          >
            {(docxTemplates.length ? docxTemplates : [{ id: 1, name: 'Classic' }]).map((t) => (
              <option key={t.id} value={t.id}>Template {t.id}: {t.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.option}>
          <label htmlFor="prompt-select">Prompt</label>
          <select
            id="prompt-select"
            value={selectedPrompt}
            onChange={(e) => setSelectedPrompt(e.target.value)}
            className={styles.select}
            disabled={optionsLoading || loading}
          >
            {availablePrompts.map((p) => (
              <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={handleGenerate}
          disabled={!canGenerate || loading}
        >
          {generateLoading ? 'Generating…' : 'Generate resume'}
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={handleAnalyze}
          disabled={loading}
        >
          {analyzeLoading ? 'Analyzing…' : 'Analyze'}
        </button>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={handleGenerateAnyway}
          disabled={!canGenerate || loading}
          title="Skip eligibility check (remote, no clearance)"
        >
          Generate anyway
        </button>
        {(analysis || result) && (
          <button type="button" className={styles.btnGhost} onClick={clearAll}>
            Clear
          </button>
        )}
        <span className={`${styles.status} ${status.type ? styles[status.type] : ''}`}>
          {status.text}
        </span>
      </div>

      {showAnalysis && (
        <JobAnalysisResult
          analysis={analysis}
          selectedBase={selectedBase}
          onSelectBase={setSelectedBase}
          selectedPrompt={selectedPrompt}
          onSelectPrompt={setSelectedPrompt}
          onGenerate={handleGenerate}
          onGenerateAnyway={handleGenerateAnyway}
          generateLoading={generateLoading}
        />
      )}

      {result && (
        <section className={styles.resultSection}>
          <h2 className={styles.resultTitle}>Tailored resume</h2>
          <textarea
            className={styles.resultText}
            readOnly
            value={result.resumeText}
            aria-label="Generated resume text"
          />
          <div className={styles.resultActions}>
            <button type="button" className={styles.btnSecondary} onClick={handleCopy}>
              Copy text
            </button>
            {result.docxBase64 && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() =>
                  downloadBlob(result.docxBase64, MIME_DOCX, result.docxFilename)
                }
              >
                Download .docx
              </button>
            )}
            {result.pdfBase64 && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => downloadBlob(result.pdfBase64, MIME_PDF, result.pdfFilename)}
              >
                Download .pdf
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
