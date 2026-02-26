import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'resume', label: 'Resume Tailor', icon: '📄' },
]

/**
 * @param {{ activeId: string, onSelect: (id: string) => void }} props
 */
export function Sidebar({ activeId, onSelect }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>Resume</div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.navItem} ${activeId === item.id ? styles.active : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <span className={styles.icon}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
