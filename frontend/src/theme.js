import { createTheme } from '@mui/material/styles'

const shared = {
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.025em' },
    h2: { fontWeight: 600, letterSpacing: '-0.02em' },
    h3: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 10,
  },
}

/* Indigo theme – professional, modern */
const primaryMain = '#6366f1'
const primaryDark = '#4f46e5'
const primaryLight = '#818cf8'

export const lightTheme = createTheme({
  ...shared,
  palette: {
    mode: 'light',
    primary: {
      main: primaryMain,
      dark: primaryDark,
      light: primaryLight,
    },
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a1a2e',
      secondary: '#4b5563',
      disabled: '#9ca3af',
    },
    divider: '#e5e7eb',
    action: {
      hover: 'rgba(99, 102, 241, 0.04)',
      selected: 'rgba(99, 102, 241, 0.08)',
    },
    success: { main: '#10b981' },
    error: { main: '#ef4444' },
  },
})

export const darkTheme = createTheme({
  ...shared,
  palette: {
    mode: 'dark',
    primary: {
      main: primaryLight,
      dark: primaryMain,
      light: '#a5b4fc',
    },
    background: {
      default: '#0f0f1a',
      paper: '#1a1a2e',
    },
    text: {
      primary: '#f4f4f5',
      secondary: '#a1a1aa',
      disabled: '#71717a',
    },
    divider: '#27272a',
    action: {
      hover: 'rgba(129, 140, 248, 0.08)',
      selected: 'rgba(99, 102, 241, 0.15)',
    },
    success: { main: '#10b981' },
    error: { main: '#ef4444' },
  },
})
