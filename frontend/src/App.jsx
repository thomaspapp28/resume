import { useState } from 'react'
import { Sidebar } from './layout/Sidebar'
import { ProfileManager } from './features/Profile'
import { ResumeGenerator } from './features/ResumeGenerator'
import styles from './App.module.css'

export default function App() {
  const [view, setView] = useState('profile')

  return (
    <div className={styles.app}>
      <Sidebar activeId={view} onSelect={setView} />
      <main className={styles.main}>
        {view === 'profile' && <ProfileManager />}
        {view === 'resume' && <ResumeGenerator />}
      </main>
    </div>
  )
}
