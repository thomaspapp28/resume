import FactCheckIcon from '@mui/icons-material/FactCheck'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import styles from './JobAnalysisResult.module.css'

/**
 * @param {{ analysis: { is_remote: boolean, requires_clearance: boolean, is_eligible: boolean, suggested_base: string, suggested_prompt: string, available_bases: string[], available_prompts: string[] }, selectedBase: string, onSelectBase: (base: string) => void, selectedPrompt: string, onSelectPrompt: (prompt: string) => void, onGenerate: () => void, onGenerateAnyway: () => void, generateLoading: boolean }} props
 */
export function JobAnalysisResult({
  analysis,
  selectedBase,
  onSelectBase,
  selectedPrompt,
  onSelectPrompt,
  onGenerate,
  onGenerateAnyway,
  generateLoading,
}) {
  const bases = analysis.available_bases?.length ? analysis.available_bases : [analysis.suggested_base]
  const prompts = analysis.available_prompts?.length ? analysis.available_prompts : ['default']

  return (
    <section className={styles.container}>
      <h2 className={styles.title}>
        <FactCheckIcon className={styles.titleIcon} />
        Analysis
      </h2>
      <dl className={styles.grid}>
        <dt>Remote</dt>
        <dd>
          <span className={analysis.is_remote ? styles.yes : styles.no}>
            {analysis.is_remote ? 'Yes' : 'No'}
          </span>
        </dd>
        <dt>Requires clearance</dt>
        <dd>
          <span className={!analysis.requires_clearance ? styles.yes : styles.no}>
            {analysis.requires_clearance ? 'Yes' : 'No'}
          </span>
        </dd>
        <dt>Eligible</dt>
        <dd>
          <span className={analysis.is_eligible ? styles.yes : styles.no}>
            {analysis.is_eligible ? 'Yes' : 'No'}
          </span>
        </dd>
      </dl>
      <div className={styles.baseSelect}>
        <label htmlFor="base-select">Base template</label>
        <select
          id="base-select"
          value={selectedBase}
          onChange={(e) => onSelectBase(e.target.value)}
          className={styles.select}
        >
          {bases.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.baseSelect}>
        <label htmlFor="prompt-select">Prompt</label>
        <select
          id="prompt-select"
          value={selectedPrompt}
          onChange={(e) => onSelectPrompt(e.target.value)}
          className={styles.select}
        >
          {prompts.map((p) => (
            <option key={p} value={p}>
              {p.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onGenerate}
          disabled={generateLoading || !analysis.is_eligible}
          title={!analysis.is_eligible ? 'Use "Generate anyway" to override' : ''}
        >
          <AutoAwesomeIcon className={styles.btnIcon} />
          {generateLoading ? 'Generating…' : 'Generate resume'}
        </button>
        {!analysis.is_eligible && (
          <button
            type="button"
            className={styles.btnOverride}
            onClick={onGenerateAnyway}
            disabled={generateLoading}
          >
            <WarningAmberIcon className={styles.btnIcon} />
            Generate anyway
          </button>
        )}
      </div>
    </section>
  )
}
