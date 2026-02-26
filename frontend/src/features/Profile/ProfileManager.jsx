import { useState, useEffect, useCallback } from 'react'
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
  date_from: defaultDateFrom(),
  date_to: defaultDateTo(),
})

const emptyEducation = () => ({
  institution_name: '',
  date_from: defaultDateFrom(),
  date_to: defaultDateTo(),
})

const PRESENT = 'present'

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

function sortKeyForDate(dateVal) {
  if (!dateVal || dateVal === PRESENT) return '9999-12'
  return String(dateVal).slice(0, 7)
}

function lastWorkExperience(workExperiences) {
  const arr = workExperiences ?? []
  if (!arr.length) return { company: '—', period: '' }
  const sorted = [...arr].filter((w) => w.date_to || w.date_from || w.company_name?.trim()).sort(
    (a, b) => sortKeyForDate(b.date_to || b.date_from).localeCompare(sortKeyForDate(a.date_to || a.date_from))
  )
  const last = sorted[0] ?? arr[arr.length - 1]
  const company = last.company_name?.trim() || '—'
  const period = formatDateRange(last.date_from, last.date_to)
  return { company, period }
}

function lastEducation(educations) {
  const arr = educations ?? []
  if (!arr.length) return { institution: '—', period: '' }
  const sorted = [...arr].filter((e) => e.date_to || e.date_from || e.institution_name?.trim()).sort(
    (a, b) => sortKeyForDate(b.date_to || b.date_from).localeCompare(sortKeyForDate(a.date_to || a.date_from))
  )
  const last = sorted[0] ?? arr[arr.length - 1]
  const institution = last.institution_name?.trim() || '—'
  const period = formatDateRange(last.date_from, last.date_to)
  return { institution, period }
}

function ProfileForm({ profileId, onSave, onCancel, initialData }) {
  const [fullName, setFullName] = useState(initialData?.full_name ?? '')
  const [email, setEmail] = useState(initialData?.email ?? '')
  const [location, setLocation] = useState(initialData?.location ?? '')
  const [phone, setPhone] = useState(initialData?.phone ?? '')
  const [workExperiences, setWorkExperiences] = useState(
    initialData?.work_experiences?.length
      ? initialData.work_experiences.map((w) => ({
          company_name: w.company_name ?? '',
          date_from: w.date_from || defaultDateFrom(),
          date_to: (w.date_to === PRESENT || w.date_to === 'present') ? PRESENT : (w.date_to || defaultDateTo()),
        }))
      : [emptyWorkExp()]
  )
  const [educations, setEducations] = useState(
    initialData?.educations?.length
      ? initialData.educations.map((e) => ({
          institution_name: e.institution_name ?? '',
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
    const workExps = workExperiences.filter((w) => w.company_name.trim() || w.date_from || w.date_to).map((w) => ({
      ...w,
      date_to: w.date_to === PRESENT ? 'present' : w.date_to,
    }))
    const eduExps = educations.filter((e) => e.institution_name.trim() || e.date_from || e.date_to).map((e) => ({
      ...e,
      date_to: e.date_to === PRESENT ? 'present' : e.date_to,
    }))
    const payload = {
      full_name: fullName,
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
        <h2 className={styles.sectionTitle}>Contact</h2>
        <div className={styles.grid}>
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
            <label htmlFor="location">Location</label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="San Francisco, CA"
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
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Work experience</h2>
        <p className={styles.hint}>Company name and period. Check Present for current role.</p>
        {workExperiences.map((we, idx) => (
          <div key={idx} className={styles.workRow}>
            <input
              type="text"
              value={we.company_name}
              onChange={(e) => updateWorkExp(idx, 'company_name', e.target.value)}
              placeholder="Company name"
              className={styles.workCompany}
            />
            <input
              type="month"
              value={we.date_from || defaultDateFrom()}
              onChange={(e) => updateWorkExp(idx, 'date_from', e.target.value)}
              className={styles.workDate}
              title="From (month)"
            />
            <div className={styles.dateToGroup}>
              <input
                type="month"
                value={we.date_to === PRESENT ? defaultDateTo() : (we.date_to || defaultDateTo())}
                onChange={(e) => updateWorkExp(idx, 'date_to', e.target.value)}
                className={styles.workDate}
                title="To (month)"
                disabled={we.date_to === PRESENT}
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
            <button
              type="button"
              className={styles.btnRemove}
              onClick={() => removeWorkExperience(idx)}
              title="Remove"
              disabled={workExperiences.length <= 1}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className={styles.btnAdd} onClick={addWorkExperience}>
          + Add company
        </button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Education</h2>
        <p className={styles.hint}>Institution name and period. Check Present for current study.</p>
        {educations.map((ed, idx) => (
          <div key={idx} className={styles.workRow}>
            <input
              type="text"
              value={ed.institution_name}
              onChange={(e) => updateEducation(idx, 'institution_name', e.target.value)}
              placeholder="Institution name"
              className={styles.workCompany}
            />
            <input
              type="month"
              value={ed.date_from || defaultDateFrom()}
              onChange={(e) => updateEducation(idx, 'date_from', e.target.value)}
              className={styles.workDate}
              title="From (month)"
            />
            <div className={styles.dateToGroup}>
              <input
                type="month"
                value={ed.date_to === PRESENT ? defaultDateTo() : (ed.date_to || defaultDateTo())}
                onChange={(e) => updateEducation(idx, 'date_to', e.target.value)}
                className={styles.workDate}
                title="To (month)"
                disabled={ed.date_to === PRESENT}
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
            <button
              type="button"
              className={styles.btnRemove}
              onClick={() => removeEducation(idx)}
              title="Remove"
              disabled={educations.length <= 1}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className={styles.btnAdd} onClick={addEducation}>
          + Add institution
        </button>
      </section>

      <div className={styles.actions}>
        <button type="submit" className={styles.btnPrimary} disabled={saving}>
          {saving ? 'Saving…' : profileId ? 'Update profile' : 'Create profile'}
        </button>
        <button type="button" className={styles.btnSecondary} onClick={onCancel}>
          Cancel
        </button>
        <span className={`${styles.status} ${status.type ? styles[status.type] : ''}`}>
          {status.text}
        </span>
      </div>
    </form>
  )
}

export function ProfileManager() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(null)

  const loadProfiles = useCallback(async () => {
    const { data, error } = await listProfiles()
    if (error) return
    setProfiles(data ?? [])
  }, [])

  useEffect(() => {
    setLoading(true)
    loadProfiles().finally(() => setLoading(false))
  }, [loadProfiles])

  function handleAddNew() {
    setEditingId(null)
    setFormData(null)
    setShowForm(true)
  }

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

  if (loading) {
    return (
      <div className={styles.container}>
        <p className={styles.loading}>Loading profiles…</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Profiles</h1>
            <p className={styles.subtitle}>
              Manage resume profiles. Add new or edit existing.
            </p>
          </div>
          <button type="button" className={styles.btnAddProfile} onClick={handleAddNew}>
            + Add New Profile
          </button>
        </div>
      </header>

      {showForm ? (
        <div className={styles.formPanel}>
          <h2 className={styles.formPanelTitle}>
            {editingId ? 'Edit Profile' : 'New Profile'}
          </h2>
          <ProfileForm
            profileId={editingId}
            initialData={formData}
            onSave={handleFormSave}
            onCancel={handleFormCancel}
          />
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Location</th>
                <th>Phone</th>
                <th>Last company</th>
                <th>Last university</th>
                <th className={styles.colActions}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>
                    No profiles yet. Click &quot;Add New Profile&quot; to create one.
                  </td>
                </tr>
              ) : (
                profiles.map((p) => (
                  <tr key={p.id}>
                    <td>{p.full_name || '—'}</td>
                    <td>{p.email || '—'}</td>
                    <td>{p.location || '—'}</td>
                    <td>{p.phone || '—'}</td>
                    <td>
                      {(() => {
                        const { company, period } = lastWorkExperience(p.work_experiences)
                        return period ? (
                          <span title={period}>{company}<br /><small className={styles.period}>{period}</small></span>
                        ) : (
                          company
                        )
                      })()}
                    </td>
                    <td>
                      {(() => {
                        const { institution, period } = lastEducation(p.educations)
                        return period ? (
                          <span title={period}>{institution}<br /><small className={styles.period}>{period}</small></span>
                        ) : (
                          institution
                        )
                      })()}
                    </td>
                    <td className={styles.colActions}>
                      <button
                        type="button"
                        className={styles.btnTable}
                        onClick={() => handleEdit(p.id)}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`${styles.btnTable} ${styles.btnTableDanger}`}
                        onClick={() => handleDelete(p.id)}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
