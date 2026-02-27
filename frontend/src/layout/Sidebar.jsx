import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { useThemeMode } from '../ThemeProvider'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { id: 'profile', label: 'Profile', Icon: PersonOutlineIcon },
  { id: 'resume', label: 'Resume Tailor', Icon: DescriptionOutlinedIcon },
]

/**
 * @param {{ activeId: string, onSelect: (id: string) => void, showAddProfile?: boolean, onAddProfile?: () => void }} props
 */
export function Sidebar({ activeId, onSelect, showAddProfile, onAddProfile }) {
  const { mode, toggleColorMode } = useThemeMode()

  return (
    <aside className={styles.sidebar}>
      <span className={styles.logo}>
        <AutoAwesomeIcon className={styles.logoIcon} sx={{ fontSize: 22 }} />
        Resume
      </span>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.Icon
          return (
            <button
              key={item.id}
              type="button"
              className={`${styles.navItem} ${activeId === item.id ? styles.active : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <Icon className={styles.icon} sx={{ fontSize: 20 }} />
              {item.label}
            </button>
          )
        })}
      </nav>
      <div className={styles.menuRight}>
        {showAddProfile && (
          <button
            type="button"
            className={styles.btnAddProfile}
            onClick={onAddProfile}
            title="Add new profile"
          >
            <PersonAddIcon sx={{ fontSize: 18 }} />
            Add Profile
          </button>
        )}
        <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
          <IconButton
            onClick={toggleColorMode}
            aria-label="Toggle theme"
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': { color: 'primary.main' },
            }}
          >
            {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Tooltip>
      </div>
    </aside>
  )
}
