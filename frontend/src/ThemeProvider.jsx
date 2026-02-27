import { createContext, useContext, useMemo, useState, useEffect } from 'react'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { lightTheme, darkTheme } from './theme'

const ThemeModeContext = createContext({ mode: 'dark', toggleColorMode: () => {} })

const STORAGE_KEY = 'resume-app-theme'

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext)
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider')
  return ctx
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(STORAGE_KEY) || 'dark')
    }
    return 'dark'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const toggleColorMode = () => {
    setModeState((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const theme = useMemo(
    () => (mode === 'light' ? lightTheme : darkTheme),
    [mode],
  )

  const contextValue = useMemo(
    () => ({ mode, toggleColorMode }),
    [mode],
  )

  // Sync MUI theme to CSS variables for existing CSS modules
  useEffect(() => {
    const p = theme.palette
    const isDark = mode === 'dark'
    const root = document.documentElement
    const rgb = p.primary.main.startsWith('#')
      ? (() => {
          const hex = p.primary.main.slice(1)
          return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16),
          ]
        })()
      : [99, 102, 241]
    root.style.setProperty('--bg', p.background.default)
    root.style.setProperty('--bg-elevated', isDark ? '#16162a' : '#f4f4f5')
    root.style.setProperty('--surface', p.background.paper)
    root.style.setProperty('--surface-hover', isDark ? '#252538' : 'rgba(99, 102, 241, 0.04)')
    root.style.setProperty('--border', p.divider)
    root.style.setProperty('--border-focus', isDark ? '#3f3f5c' : '#a5b4fc')
    root.style.setProperty('--text', p.text.primary)
    root.style.setProperty('--text-secondary', p.text.secondary)
    root.style.setProperty('--text-muted', p.text.disabled)
    root.style.setProperty('--accent', p.primary.main)
    root.style.setProperty('--accent-hover', p.primary.dark)
    root.style.setProperty('--accent-muted', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${isDark ? 0.12 : 0.15})`)
    root.style.setProperty('--success', p.success.main)
    root.style.setProperty('--success-muted', 'rgba(16, 185, 129, 0.12)')
    root.style.setProperty('--error', p.error.main)
    root.style.setProperty('--error-muted', 'rgba(239, 68, 68, 0.12)')
    root.setAttribute('data-theme', mode)
    root.style.colorScheme = mode
  }, [theme, mode])

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeModeContext.Provider>
  )
}
