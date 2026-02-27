import { useState, useEffect, useCallback, useRef } from 'react'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import ContactMailIcon from '@mui/icons-material/ContactMail'
import WorkHistoryIcon from '@mui/icons-material/WorkHistory'
import SchoolIcon from '@mui/icons-material/School'
import PersonSearchIcon from '@mui/icons-material/PersonSearch'
import EmailIcon from '@mui/icons-material/EmailOutlined'
import PhoneIcon from '@mui/icons-material/PhoneOutlined'
import LocationOnIcon from '@mui/icons-material/LocationOnOutlined'
import CircularProgress from '@mui/material/CircularProgress'
import { listProfiles, getProfile, createProfile, updateProfile, deleteProfile } from '../../api/profile.js'
import styles from './ProfileManager.module.css'

function defaultDateFrom() {
  const d = new Date()
  return `${d.getFullYear() - 4}-01`
}

function defaultDateTo() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const emptyWorkExp = () => ({
  company_name: '',
  job_title: '',
  date_from: defaultDateFrom(),
  date_to: defaultDateTo(),
})

const emptyEducation = () => ({
  institution_name: '',
  degree: '',
  field: '',
  date_from: defaultDateFrom(),
  date_to: defaultDateTo(),
})

const PRESENT = 'present'
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const YEARS = (() => {
  const y = new Date().getFullYear()
  return Array.from({ length: 50 }, (_, i) => y - i)
})()

function parseYYYYMM(val) {
  if (!val || val === PRESENT) return { month: '', year: '' }
  const s = String(val).slice(0, 7)
  if (s.length < 7) return { month: '', year: '' }
  const [, y, m] = s.match(/^(\d{4})-(\d{1,2})/) || []
  const num = m ? parseInt(m, 10) : 0
  return { month: (num >= 1 && num <= 12) ? String(num) : '', year: y || '' }
}

function toYYYYMM(month, year) {
  if (!month || !year) return ''
  const m = String(parseInt(month, 10)).padStart(2, '0')
  return `${year}-${m}`
}

function formatDateYYYYMM(val) {
  if (!val || val === PRESENT) return null
  const s = String(val).slice(0, 7)
  if (s.length < 7) return s
  const [y, m] = s.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const month = months[parseInt(m, 10) - 1] || m
  return `${month} ${y}`
}

function formatDateRange(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return ''
  const from = formatDateYYYYMM(dateFrom) || '?'
  const to = (dateTo === PRESENT || !dateTo) ? 'Present' : (formatDateYYYYMM(dateTo) || dateTo)
  return `${from} – ${to}`
}

/** Format phone for display: +1 (227) 222-8188 */
function formatPhoneDisplay(phone) {
  if (!phone || typeof phone !== 'string') return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 10) {
    const d = digits.slice(-10)
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }
  return phone
}

/** Get digits for tel: link, with +1 for US 10-digit numbers */
function phoneToTel(phone) {
  if (!phone || typeof phone !== 'string') return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return digits ? `+${digits}` : ''
}

function sortKeyForDate(dateVal) {
  if (!dateVal || dateVal === PRESENT) return '9999-12'
  return String(dateVal).slice(0, 7)
}

function lastWorkExperience(workExperiences) {
  const arr = workExperiences ?? []
  if (!arr.length) return { company: '—', jobTitle: '', period: '' }
  const sorted = [...arr].filter((w) => w.date_to || w.date_from || w.company_name?.trim() || w.job_title?.trim()).sort(
    (a, b) => sortKeyForDate(b.date_to || b.date_from).localeCompare(sortKeyForDate(a.date_to || a.date_from))
  )
  const last = sorted[0] ?? arr[arr.length - 1]
  const company = last.company_name?.trim() || '—'
  const jobTitle = last.job_title?.trim() || ''
  const period = formatDateRange(last.date_from, last.date_to)
  return { company, jobTitle, period }
}

function lastEducation(educations) {
  const arr = educations ?? []
  if (!arr.length) return { institution: '—', degree: '', period: '' }
  const sorted = [...arr].filter((e) => e.date_to || e.date_from || e.institution_name?.trim() || e.degree?.trim() || e.field?.trim()).sort(
    (a, b) => sortKeyForDate(b.date_to || b.date_from).localeCompare(sortKeyForDate(a.date_to || a.date_from))
  )
  const last = sorted[0] ?? arr[arr.length - 1]
  const institution = last.institution_name?.trim() || '—'
  const degree = last.degree?.trim() || ''
  const period = formatDateRange(last.date_from, last.date_to)
  return { institution, degree, period }
}

function MonthYearSelect({ value, onChange, disabled, id }) {
  const { month, year } = parseYYYYMM(value)
  const handleChange = (m, y) => onChange(toYYYYMM(m, y))
  return (
    <span className={styles.monthYearSelect}>
      <select
        id={id ? `${id}_m` : undefined}
        className={styles.monthSelect}
        value={month}
        onChange={(e) => handleChange(e.target.value, year)}
        disabled={disabled}
        aria-label="Month"
      >
        {MONTHS.map((label, i) => (
          <option key={i} value={i || ''}>{label || 'Month'}</option>
        ))}
      </select>
      <select
        id={id ? `${id}_y` : undefined}
        className={styles.yearSelect}
        value={year}
        onChange={(e) => handleChange(month, e.target.value)}
        disabled={disabled}
        aria-label="Year"
      >
        <option value="">Year</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </span>
  )
}

function ProfileForm({ profileId, onSave, onCancel, initialData }) {
  const [fullName, setFullName] = useState(initialData?.full_name ?? '')
  const [subtitle, setSubtitle] = useState(initialData?.subtitle ?? '')
  const [email, setEmail] = useState(initialData?.email ?? '')
  const [location, setLocation] = useState(initialData?.location ?? '')
  const [phone, setPhone] = useState(initialData?.phone ?? '')
  const [workExperiences, setWorkExperiences] = useState(
    initialData?.work_experiences?.length
      ? initialData.work_experiences.map((w) => ({
          company_name: w.company_name ?? '',
          job_title: w.job_title ?? '',
          date_from: w.date_from || defaultDateFrom(),
          date_to: (w.date_to === PRESENT || w.date_to === 'present') ? PRESENT : (w.date_to || defaultDateTo()),
        }))
      : [emptyWorkExp()]
  )
  const [educations, setEducations] = useState(
    initialData?.educations?.length
      ? initialData.educations.map((e) => ({
          institution_name: e.institution_name ?? '',
          degree: e.degree ?? '',
          field: e.field ?? '',
          date_from: e.date_from || defaultDateFrom(),
          date_to: (e.date_to === PRESENT || e.date_to === 'present') ? PRESENT : (e.date_to || defaultDateTo()),
        }))
      : [emptyEducation()]
  )
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ text: '', type: '' })

  function addWorkExperience() {
    setWorkExperiences((prev) => [...prev, emptyWorkExp()])
  }

  function removeWorkExperience(idx) {
    setWorkExperiences((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateWorkExp(idx, field, value) {
    setWorkExperiences((prev) => prev.map((w, i) => (i === idx ? { ...w, [field]: value } : w)))
  }

  function addEducation() {
    setEducations((prev) => [...prev, emptyEducation()])
  }

  function removeEducation(idx) {
    setEducations((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateEducation(idx, field, value) {
    setEducations((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setStatus({ text: 'Saving…', type: 'loading' })
    const workExps = workExperiences.filter((w) => w.company_name.trim() || w.job_title.trim() || w.date_from || w.date_to).map((w) => ({
      ...w,
      date_to: w.date_to === PRESENT ? 'present' : w.date_to,
    }))
    const eduExps = educations.filter((e) => e.institution_name.trim() || e.degree.trim() || e.field.trim() || e.date_from || e.date_to).map((e) => ({
      ...e,
      date_to: e.date_to === PRESENT ? 'present' : e.date_to,
    }))
    const payload = {
      full_name: fullName,
      subtitle,
      email,
      location,
      phone,
      work_experiences: workExps.length ? workExps : [],
      educations: eduExps.length ? eduExps : [],
    }
    const { data, error } = profileId
      ? await updateProfile(profileId, payload)
      : await createProfile(payload)
    setSaving(false)
    if (error) {
      setStatus({ text: error, type: 'error' })
      return
    }
    setStatus({ text: 'Profile saved.', type: 'success' })
    onSave(data)
    setTimeout(() => setStatus({ text: '', type: '' }), 1500)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <ContactMailIcon className={styles.sectionIcon} />
          Contact
        </h2>
        <div className={styles.contactGrid}>
          <div className={styles.field}>
            <label htmlFor="full_name">Full name</label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label htmlFor="subtitle">Professional title</label>
            <input
              id="subtitle"
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Senior Software Engineer | Python, React, AWS"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
            />
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label htmlFor="location">Location</label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="San Francisco, CA"
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <WorkHistoryIcon className={styles.sectionIcon} />
          Work experience
        </h2>
        <p className={styles.hint}>Job title, company, and period. Check Present for current role.</p>
        {workExperiences.map((we, idx) => (
          <div key={idx} className={styles.entryCard}>
            <div className={styles.entryRow}>
              <div className={styles.entryField}>
                <label>Job title</label>
                <input
                  type="text"
                  value={we.job_title}
                  onChange={(e) => updateWorkExp(idx, 'job_title', e.target.value)}
                  placeholder="e.g. Software Engineer"
                />
              </div>
              <div className={styles.entryField}>
                <label>Company</label>
                <input
                  type="text"
                  value={we.company_name}
                  onChange={(e) => updateWorkExp(idx, 'company_name', e.target.value)}
                  placeholder="Company name"
                />
              </div>
            </div>
            <div className={styles.entryRow}>
              <div className={styles.entryField}>
                <label>From</label>
                <MonthYearSelect
                  value={we.date_from || defaultDateFrom()}
                  onChange={(v) => updateWorkExp(idx, 'date_from', v)}
                  id={`we-from-${idx}`}
                />
              </div>
              <div className={styles.entryField}>
                <label>To</label>
                <div className={styles.dateToGroup}>
                  <MonthYearSelect
                    value={we.date_to === PRESENT ? defaultDateTo() : (we.date_to || defaultDateTo())}
                    onChange={(v) => updateWorkExp(idx, 'date_to', v)}
                    disabled={we.date_to === PRESENT}
                    id={`we-to-${idx}`}
                  />
                  <label className={styles.presentCheck}>
                    <input
                      type="checkbox"
                      checked={we.date_to === PRESENT}
                      onChange={(e) => updateWorkExp(idx, 'date_to', e.target.checked ? PRESENT : defaultDateTo())}
                    />
                    <span>Present</span>
                  </label>
                </div>
              </div>
            </div>
            <button
              type="button"
              className={styles.btnRemove}
              onClick={() => removeWorkExperience(idx)}
              title="Remove"
              disabled={workExperiences.length <= 1}
              aria-label="Remove entry"
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </button>
          </div>
        ))}
        <button type="button" className={styles.btnAdd} onClick={addWorkExperience}>
          <AddIcon className={styles.btnAddIcon} />
          Add experience
        </button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <SchoolIcon className={styles.sectionIcon} />
          Education
        </h2>
        <p className={styles.hint}>Degree, field of study, institution, and period.</p>
        {educations.map((ed, idx) => (
          <div key={idx} className={styles.entryCard}>
            <div className={styles.entryRow}>
              <div className={styles.entryField}>
                <label>Degree</label>
                <input
                  type="text"
                  value={ed.degree}
                  onChange={(e) => updateEducation(idx, 'degree', e.target.value)}
                  placeholder="e.g. Bachelor of Science"
                />
              </div>
              <div className={styles.entryField}>
                <label>Field of study</label>
                <input
                  type="text"
                  value={ed.field}
                  onChange={(e) => updateEducation(idx, 'field', e.target.value)}
                  placeholder="e.g. Computer Science"
                />
              </div>
            </div>
            <div className={styles.entryRow}>
              <div className={styles.entryField} style={{ flex: 1 }}>
                <label>Institution</label>
                <input
                  type="text"
                  value={ed.institution_name}
                  onChange={(e) => updateEducation(idx, 'institution_name', e.target.value)}
                  placeholder="University or school name"
                />
              </div>
            </div>
            <div className={styles.entryRow}>
              <div className={styles.entryField}>
                <label>From</label>
                <MonthYearSelect
                  value={ed.date_from || defaultDateFrom()}
                  onChange={(v) => updateEducation(idx, 'date_from', v)}
                  id={`edu-from-${idx}`}
                />
              </div>
              <div className={styles.entryField}>
                <label>To</label>
                <div className={styles.dateToGroup}>
                  <MonthYearSelect
                    value={ed.date_to === PRESENT ? defaultDateTo() : (ed.date_to || defaultDateTo())}
                    onChange={(v) => updateEducation(idx, 'date_to', v)}
                    disabled={ed.date_to === PRESENT}
                    id={`edu-to-${idx}`}
                  />
                  <label className={styles.presentCheck}>
                    <input
                      type="checkbox"
                      checked={ed.date_to === PRESENT}
                      onChange={(e) => updateEducation(idx, 'date_to', e.target.checked ? PRESENT : defaultDateTo())}
                    />
                    <span>Present</span>
                  </label>
                </div>
              </div>
            </div>
            <button
              type="button"
              className={styles.btnRemove}
              onClick={() => removeEducation(idx)}
              title="Remove"
              disabled={educations.length <= 1}
              aria-label="Remove entry"
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </button>
          </div>
        ))}
        <button type="button" className={styles.btnAdd} onClick={addEducation}>
          <AddIcon className={styles.btnAddIcon} />
          Add education
        </button>
      </section>

      <div className={styles.actions}>
        <button type="submit" className={styles.btnPrimary} disabled={saving}>
          {saving ? 'Saving…' : profileId ? 'Update profile' : 'Create profile'}
        </button>
        <button type="button" className={styles.btnSecondary} onClick={onCancel}>
          <ArrowBackIcon className={styles.btnIcon} />
          Cancel
        </button>
        <span className={`${styles.status} ${status.type ? styles[status.type] : ''}`}>
          {status.text}
        </span>
      </div>
    </form>
  )
}

export function ProfileManager({ addProfileRef, onFormVisibleChange }) {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [isResizing, setIsResizing] = useState(false)

  const resizeStartRef = useRef({ x: 0, w: 0 })

  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    const x = e.clientX ?? e.touches?.[0]?.clientX
    resizeStartRef.current = { x, w: sidebarWidth }
    setIsResizing(true)
  }, [sidebarWidth])

  useEffect(() => {
    if (!isResizing) return
    const minW = 200
    const maxW = 480
    function move(e) {
      const x = e.clientX ?? e.touches?.[0]?.clientX
      if (x != null) {
        const delta = x - resizeStartRef.current.x
        const newW = Math.min(maxW, Math.max(minW, resizeStartRef.current.w + delta))
        resizeStartRef.current = { x, w: newW }
        setSidebarWidth(newW)
      }
    }
    function stop() {
      setIsResizing(false)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', stop)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', stop)
    }
  }, [isResizing])

  const loadProfiles = useCallback(async () => {
    const { data, error } = await listProfiles()
    if (error) return
    setProfiles(data ?? [])
  }, [])

  const handleAddNew = useCallback(() => {
    setEditingId(null)
    setFormData(null)
    setShowForm(true)
  }, [])

  useEffect(() => {
    if (addProfileRef) addProfileRef.current = handleAddNew
    return () => {
      if (addProfileRef) addProfileRef.current = null
    }
  }, [addProfileRef, handleAddNew])

  useEffect(() => {
    onFormVisibleChange?.(showForm)
  }, [showForm, onFormVisibleChange])

  useEffect(() => {
    setLoading(true)
    loadProfiles().finally(() => setLoading(false))
  }, [loadProfiles])

  async function handleEdit(id) {
    setEditingId(id)
    const { data } = await getProfile(id)
    setFormData(data ?? null)
    setShowForm(true)
  }

  function handleFormSave() {
    setShowForm(false)
    setEditingId(null)
    setFormData(null)
    loadProfiles()
    setCurrentPage(1)
  }

  function handleFormCancel() {
    setShowForm(false)
    setEditingId(null)
    setFormData(null)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this profile?')) return
    const { error } = await deleteProfile(id)
    if (error) return
    if (editingId === id) {
      setShowForm(false)
      setEditingId(null)
      setFormData(null)
    }
    loadProfiles()
  }

  useEffect(() => {
    if (profiles.length > 0 && currentPage > profiles.length) {
      setCurrentPage(profiles.length)
    }
  }, [profiles.length, currentPage])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <CircularProgress size={32} sx={{ color: 'var(--accent)', mb: 1.5 }} />
          <p className={styles.loading}>Loading profiles…</p>
        </div>
      </div>
    )
  }

  const selectedProfile = profiles[currentPage - 1] ?? profiles[0]

  return (
    <div className={styles.page}>
      <div
        className={styles.layout}
        style={{ userSelect: isResizing ? 'none' : undefined }}
      >
        {sidebarVisible && (
          <>
            <aside
              className={styles.sidebar}
              style={{ width: sidebarWidth }}
            >
              <div className={styles.sidebarHeader}>
                <span className={styles.sidebarTitle}>All profiles</span>
                <span className={styles.sidebarCount}>{profiles.length}</span>
                <button
                  type="button"
                  className={styles.btnSidebarToggle}
                  onClick={() => setSidebarVisible(false)}
                  title="Hide profile list"
                  aria-label="Hide profile list"
                >
                  <ChevronLeftIcon sx={{ fontSize: 20 }} />
                </button>
              </div>
              {profiles.length === 0 ? (
                <div className={styles.sidebarEmpty}>
                  <PersonSearchIcon sx={{ fontSize: 40, color: 'var(--text-muted)', opacity: 0.6, mb: 1 }} />
                  <p>No profiles yet.</p>
                </div>
              ) : (
                <ul className={styles.profileList} role="list">
                  {profiles.map((p) => {
                    const { company } = lastWorkExperience(p.work_experiences)
                    const isActive = selectedProfile?.id === p.id
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={`${styles.profileListItem} ${isActive ? styles.profileListItemActive : ''}`}
                          onClick={() => setCurrentPage(profiles.indexOf(p) + 1)}
                          aria-pressed={isActive}
                        >
                          <span className={styles.profileListName}>{p.full_name || 'Unnamed'}</span>
                          {company && company !== '—' && (
                            <span className={styles.profileListMeta}>{company}</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </aside>
            <div
              className={`${styles.resizeHandle} ${isResizing ? styles.resizeHandleActive : ''}`}
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={sidebarWidth}
              title="Drag to resize"
            />
          </>
        )}
        {!sidebarVisible && (
          <button
            type="button"
            className={styles.btnShowSidebar}
            onClick={() => setSidebarVisible(true)}
            title="Show profile list"
            aria-label="Show profile list"
          >
            <ChevronRightIcon sx={{ fontSize: 20 }} />
          </button>
        )}
        <main className={styles.main}>
          {showForm ? (
            <div className={styles.formWrapper}>
              <div className={styles.formPanel}>
                <div className={styles.formPanelHeader}>
                  <h2 className={styles.formPanelTitle}>
                    {editingId ? 'Edit Profile' : 'New Profile'}
                  </h2>
                  <button
                    type="button"
                    className={styles.formPanelBack}
                    onClick={handleFormCancel}
                    aria-label="Go back to profile list"
                    title="Go back to profile list"
                  >
                    <ArrowBackIcon sx={{ fontSize: 20 }} />
                  </button>
                </div>
                <ProfileForm
                  profileId={editingId}
                  initialData={formData}
                  onSave={handleFormSave}
                  onCancel={handleFormCancel}
                />
              </div>
            </div>
          ) : profiles.length === 0 ? (
                <div className={styles.emptyState}>
                  <PersonSearchIcon className={styles.emptyStateIcon} />
                  <p>No profiles yet.</p>
                  <p className={styles.emptyHint}>Click &quot;Add Profile&quot; to create your first profile.</p>
                </div>
              ) : selectedProfile ? (
                <article className={styles.profileCard}>
                  <header className={styles.profileCardHeader}>
                    <div className={styles.profileCardIdentity}>
                      <h2 className={styles.profileCardName}>{selectedProfile.full_name || '—'}</h2>
                      {selectedProfile.subtitle && (
                        <p className={styles.profileCardSubtitle}>{selectedProfile.subtitle}</p>
                      )}
                    </div>
                    <div className={styles.profileCardActions}>
                      <button
                        type="button"
                        className={styles.btnAction}
                        onClick={() => handleEdit(selectedProfile.id)}
                        title="Edit profile"
                      >
                        <EditIcon className={styles.btnActionIcon} />
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`${styles.btnAction} ${styles.btnActionDanger}`}
                        onClick={() => handleDelete(selectedProfile.id)}
                        title="Delete profile"
                      >
                        <DeleteOutlineIcon className={styles.btnActionIcon} />
                        Delete
                      </button>
                    </div>
                  </header>

                  <section className={styles.profileCardSection}>
                    <h3 className={styles.profileCardSectionTitle}>
                      <ContactMailIcon className={styles.profileCardSectionIcon} />
                      Contact
                    </h3>
                    <div className={styles.profileCardContact}>
                      {selectedProfile.email && (
                        <a href={`mailto:${selectedProfile.email}`} className={styles.profileCardContactItem}>
                          <EmailIcon className={styles.profileCardContactIcon} />
                          <span>{selectedProfile.email}</span>
                        </a>
                      )}
                      {selectedProfile.phone && (
                        <a href={`tel:${phoneToTel(selectedProfile.phone)}`} className={styles.profileCardContactItem}>
                          <PhoneIcon className={styles.profileCardContactIcon} />
                          <span>{formatPhoneDisplay(selectedProfile.phone)}</span>
                        </a>
                      )}
                      {selectedProfile.location && (
                        <span className={styles.profileCardContactItem}>
                          <LocationOnIcon className={styles.profileCardContactIcon} />
                          <span>{selectedProfile.location}</span>
                        </span>
                      )}
                      {!selectedProfile.email && !selectedProfile.phone && !selectedProfile.location && (
                        <span className={styles.profileCardEmpty}>No contact information</span>
                      )}
                    </div>
                  </section>

                  <section className={styles.profileCardSection}>
                    <h3 className={styles.profileCardSectionTitle}>
                      <WorkHistoryIcon className={styles.profileCardSectionIcon} />
                      Work Experience
                    </h3>
                    {(selectedProfile.work_experiences ?? []).length === 0 ? (
                      <p className={styles.profileCardEmpty}>No work experience added</p>
                    ) : (
                      <ul className={styles.profileCardExperienceList}>
                        {(selectedProfile.work_experiences ?? []).map((w, idx) => {
                          const jobTitle = (w.job_title || '').trim()
                          const company = (w.company_name || '').trim()
                          const period = formatDateRange(w.date_from, w.date_to)
                          const titlePart = jobTitle && company
                            ? <><span className={styles.profileCardExperienceTitle}>{jobTitle}</span> <span className={styles.profileCardExperienceSeparator}>–</span> <span className={styles.profileCardExperienceCompany}>{company}</span></>
                            : (jobTitle || company || '—')
                          return (
                            <li key={idx} className={styles.profileCardExperienceCard}>
                              <div className={styles.profileCardExperienceRow}>
                                <strong className={styles.profileCardExperienceTitleBlock}>
                                  {titlePart}
                                </strong>
                                {period && <span className={styles.profileCardExperienceDate}>{period}</span>}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>

                  <section className={styles.profileCardSection}>
                    <h3 className={styles.profileCardSectionTitle}>
                      <SchoolIcon className={styles.profileCardSectionIcon} />
                      Education
                    </h3>
                    {(selectedProfile.educations ?? []).length === 0 ? (
                      <p className={styles.profileCardEmpty}>No education added</p>
                    ) : (
                      <ul className={styles.profileCardExperienceList}>
                        {(selectedProfile.educations ?? []).map((e, idx) => {
                          const degree = (e.degree || '').trim()
                          const field = (e.field || '').trim()
                          const institution = (e.institution_name || '').trim()
                          const degreeField = [degree, field].filter(Boolean).join(' in ')
                          const period = formatDateRange(e.date_from, e.date_to)
                          const titlePart = degreeField && institution
                            ? <><span className={styles.profileCardExperienceTitle}>{degreeField}</span> <span className={styles.profileCardExperienceSeparator}>–</span> <span className={styles.profileCardExperienceCompany}>{institution}</span></>
                            : (degreeField || institution || '—')
                          return (
                            <li key={idx} className={styles.profileCardExperienceCard}>
                              <div className={styles.profileCardExperienceRow}>
                                <strong className={styles.profileCardExperienceTitleBlock}>
                                  {titlePart}
                                </strong>
                                {period && <span className={styles.profileCardExperienceDate}>{period}</span>}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>
                </article>
              ) : null}
        </main>
      </div>
    </div>
  )
}
