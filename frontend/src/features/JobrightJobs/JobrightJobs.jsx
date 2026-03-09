import { useState, useEffect, useCallback } from 'react'
import WorkOutlineIcon from '@mui/icons-material/WorkOutline'
import RefreshIcon from '@mui/icons-material/Refresh'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { listJobs, getJobCounts, triggerFetch, getFetchStatus, getLastFetchTime, updateJobStatus } from '../../api/jobs'
import styles from './JobrightJobs.module.css'

const PAGE_SIZE_OPTIONS = [10, 20, 50]

export function JobrightJobs() {
  const [jobs, setJobs] = useState([])
  const [counts, setCounts] = useState({ total: 0 })
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [search, setSearch] = useState('')
  const [statusMessage, setStatusMessage] = useState(null)
  const [lastFetchAt, setLastFetchAt] = useState(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [applyingId, setApplyingId] = useState(null)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    const { data, error } = await listJobs({
      search: search.trim() || undefined,
      page,
      limit,
    })
    setLoading(false)
    if (error) {
      setStatusMessage({ text: error, type: 'error' })
      setJobs([])
      return
    }
    setJobs(data ?? [])
  }, [search, page, limit])

  const loadCounts = useCallback(async () => {
    const { data } = await getJobCounts()
    if (data) setCounts(data)
  }, [])

  const loadLastFetchTime = useCallback(async () => {
    const { data } = await getLastFetchTime()
    if (data?.last_fetch_at != null) setLastFetchAt(data.last_fetch_at)
    else setLastFetchAt(null)
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  useEffect(() => {
    loadCounts()
  }, [loadCounts])

  useEffect(() => {
    loadLastFetchTime()
  }, [loadLastFetchTime])

  useEffect(() => {
    if (!fetching) return
    const t = setInterval(async () => {
      const { data } = await getFetchStatus()
      if (data && !data.running) {
        setFetching(false)
        setStatusMessage({ text: 'Fetch complete. List updated.', type: 'success' })
        loadJobs()
        loadCounts()
        loadLastFetchTime()
        setTimeout(() => setStatusMessage(null), 4000)
      }
    }, 3000)
    return () => clearInterval(t)
  }, [fetching, loadJobs, loadCounts, loadLastFetchTime])

  async function handleFetch() {
    setStatusMessage(null)
    const { data, error } = await triggerFetch()
    if (error) {
      setStatusMessage({ text: error, type: 'error' })
      return
    }
    if (data?.already_running) {
      setStatusMessage({ text: 'Fetch already running.', type: 'info' })
      setFetching(true)
      return
    }
    setStatusMessage({ text: 'Fetch started. This may take a minute…', type: 'info' })
    setFetching(true)
  }

  async function handleApply(e, job) {
    e.preventDefault()
    e.stopPropagation()
    if (job.status === 'applied' || applyingId === job.id) return
    setApplyingId(job.id)
    const { data, error } = await updateJobStatus(job.id, 'applied')
    setApplyingId(null)
    if (error) {
      setStatusMessage({ text: error, type: 'error' })
      return
    }
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'applied' } : j)))
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        <WorkOutlineIcon sx={{ fontSize: 28, verticalAlign: 'middle', mr: 0.5 }} />
        Job dashboard
      </h1>

      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.fetchBtn}
          onClick={handleFetch}
          disabled={fetching}
        >
          {fetching ? (
            <>
              <span className={styles.spinner} />
              Fetching…
            </>
          ) : (
            <>
              <RefreshIcon sx={{ fontSize: 18 }} />
              Fetch from Jobright
            </>
          )}
        </button>
        <input
          type="text"
          className={styles.search}
          placeholder="Search by title, company, location…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <label className={styles.pageSizeLabel}>
          Per page:
          <select
            className={styles.pageSizeSelect}
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value))
              setPage(1)
            }}
            aria-label="Jobs per page"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      {lastFetchAt && (
        <div className={styles.counts}>
          <span className={styles.lastFetch}>
            Last fetch: {new Date(lastFetchAt).toLocaleString()}
          </span>
        </div>
      )}

      {statusMessage && (
        <div className={`${styles.statusBar} ${styles[statusMessage.type]}`}>
          {statusMessage.text}
        </div>
      )}

      {loading ? (
        <div className={styles.empty}>
          <p>Loading jobs…</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className={styles.empty}>
          <p>No jobs yet.</p>
          <small>
            Click &quot;Fetch from Jobright&quot; to pull job links from Jobright (requires JOBRIGHT_COOKIE configured on the server).
          </small>
        </div>
      ) : (
        <>
        <ul className={styles.jobList}>
          {jobs.map((job) => {
            const jobUrl = (job.url || '').trim()
            const isApplied = job.status === 'applied'
            const cardContent = (
              <>
                {jobUrl ? (
                  <a
                    href={jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.jobCardLink}
                  >
                    <div className={styles.jobTitle}>{job.title || 'Untitled'}</div>
                    <div className={styles.jobMeta}>
                      {job.company && <span>{job.company}</span>}
                      {job.location && <span>{job.location}</span>}
                      {job.salary && <span>{job.salary}</span>}
                      <OpenInNewIcon sx={{ fontSize: 14, opacity: 0.7 }} />
                    </div>
                  </a>
                ) : (
                  <div className={styles.jobCardLink}>
                    <div className={styles.jobTitle}>{job.title || 'Untitled'}</div>
                    <div className={styles.jobMeta}>
                      {job.company && <span>{job.company}</span>}
                      {job.location && <span>{job.location}</span>}
                      {job.salary && <span>{job.salary}</span>}
                    </div>
                  </div>
                )}
                <div className={styles.jobCardActions}>
                  {isApplied ? (
                    <span className={styles.appliedLabel}>Applied</span>
                  ) : (
                    <button
                      type="button"
                      className={styles.applyBtn}
                      onClick={(e) => handleApply(e, job)}
                      disabled={applyingId === job.id}
                    >
                      {applyingId === job.id ? '…' : 'Apply'}
                    </button>
                  )}
                </div>
              </>
            )
            return (
              <li key={job.id}>
                <div className={styles.jobCard}>{cardContent}</div>
              </li>
            )
          })}
        </ul>
        {(() => {
          const totalForFilter = search.trim() ? null : counts.total
          const totalPages = totalForFilter != null ? Math.ceil(totalForFilter / limit) || 1 : null
          const hasNext = totalPages != null ? page < totalPages : jobs.length >= limit
          const hasPrev = page > 1
          return (
            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>
                {totalPages != null
                  ? `Page ${page} of ${totalPages} (${totalForFilter} jobs)`
                  : `Page ${page}`}
              </span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={styles.paginationBtn}
                  disabled={!hasPrev}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={styles.paginationBtn}
                  disabled={!hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </div>
          )
        })()}
        </>
      )}
    </div>
  )
}
