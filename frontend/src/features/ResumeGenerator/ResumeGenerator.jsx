import { useState } from 'react'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import DescriptionIcon from '@mui/icons-material/Description'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import StyleIcon from '@mui/icons-material/Style'
import PsychologyIcon from '@mui/icons-material/Psychology'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import NoteIcon from '@mui/icons-material/Note'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
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

  const canGenerate =
    !optionsLoading &&
    availableBases.length &&
    jd.trim() &&
    selectedProfileId != null
  const showAnalysis = analysis != null

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <AutoAwesomeIcon className={styles.titleIcon} />
          Resume Tailor
        </h1>
        <p className={styles.subtitle}>
          Paste a job description, select a profile and template, then generate. A profile is required. Analyze (optional) checks remote and clearance.
        </p>
      </header>

      <section className={styles.inputSection}>
        <label htmlFor="jd" className={styles.label}>
          <DescriptionIcon className={styles.labelIcon} />
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
          <label htmlFor="profile-select">
            <PersonOutlineIcon className={styles.optionIcon} />
            Profile (person)
          </label>
          <select
            id="profile-select"
            value={selectedProfileId ?? ''}
            onChange={(e) => setSelectedProfileId(e.target.value ? Number(e.target.value) : null)}
            className={styles.select}
            disabled={optionsLoading || loading}
          >
            <option value="">— Select a profile —</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || 'Unnamed'}{p.subtitle ? ` — ${p.subtitle}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.option}>
          <label htmlFor="base-select">
            <FolderOpenIcon className={styles.optionIcon} />
            Base resume
          </label>
          <select
            id="base-select"
            value={selectedBase}
            onChange={(e) => {
              const base = e.target.value
              setSelectedBase(base)
              const stem = base.replace(/\.(json|txt)$/, '')
              if (availablePrompts.includes(stem)) {
                setSelectedPrompt(stem)
              }
            }}
            className={styles.select}
            disabled={optionsLoading || loading}
          >
            {availableBases.map((b) => (
              <option key={b} value={b}>{b.replace(/\.(json|txt)$/, '')}</option>
            ))}
          </select>
        </div>
        <div className={styles.option}>
          <label htmlFor="docx-template-select">
            <StyleIcon className={styles.optionIcon} />
            DOCX format
          </label>
          <select
            id="docx-template-select"
            value={selectedDocxTemplate}
            onChange={(e) => setSelectedDocxTemplate(Number(e.target.value))}
            className={styles.select}
            disabled={optionsLoading || loading}
          >
            {(docxTemplates.length ? docxTemplates : [{ id: 1, name: 'Classic' }]).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.option}>
          <label htmlFor="prompt-select">
            <PsychologyIcon className={styles.optionIcon} />
            Prompt
          </label>
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
          title={selectedProfileId == null ? 'Select a profile to generate' : ''}
        >
          <AutoAwesomeIcon className={styles.btnIcon} />
          {generateLoading ? 'Generating…' : 'Generate resume'}
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={handleAnalyze}
          disabled={loading}
        >
          <AnalyticsIcon className={styles.btnIcon} />
          {analyzeLoading ? 'Analyzing…' : 'Analyze'}
        </button>
        {(analysis || result) && (
          <button type="button" className={styles.btnGhost} onClick={clearAll}>
            <DeleteSweepIcon className={styles.btnIcon} />
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
          <h2 className={styles.resultTitle}>
            <AutoAwesomeIcon className={styles.resultTitleIcon} />
            Tailored resume
          </h2>
          <textarea
            className={styles.resultText}
            readOnly
            value={result.resumeText}
            aria-label="Generated resume text"
          />
          <div className={styles.resultActions}>
            <button type="button" className={styles.btnSecondary} onClick={handleCopy}>
              <ContentCopyIcon className={styles.btnIcon} />
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
                <NoteIcon className={styles.btnIcon} />
                Download .docx
              </button>
            )}
            {result.pdfBase64 && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => downloadBlob(result.pdfBase64, MIME_PDF, result.pdfFilename)}
              >
                <PictureAsPdfIcon className={styles.btnIcon} />
                Download .pdf
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
