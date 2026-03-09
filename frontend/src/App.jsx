import { useState, useRef } from 'react'
import { Sidebar } from './layout/Sidebar'
import { ProfileManager } from './features/Profile'
import { ResumeGenerator } from './features/ResumeGenerator'
import { JobrightJobs } from './features/JobrightJobs'
import styles from './App.module.css'

export default function App() {
  const [view, setView] = useState('jobs')
  const [profileFormVisible, setProfileFormVisible] = useState(false)
  const addProfileRef = useRef(null)

  return (
    <div className={styles.app}>
      <Sidebar
        activeId={view}
        onSelect={setView}
        showAddProfile={view === 'profile' && !profileFormVisible}
        onAddProfile={() => addProfileRef.current?.()}
      />
      <main className={styles.main}>
        {view === 'profile' && (
          <ProfileManager
            addProfileRef={addProfileRef}
            onFormVisibleChange={setProfileFormVisible}
          />
        )}
        {view === 'resume' && <ResumeGenerator />}
        {view === 'jobs' && <JobrightJobs />}
      </main>
    </div>
  )
}
