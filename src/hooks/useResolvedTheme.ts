import type { Appearance } from '../types'
import type { ResolvedTheme } from '../utils/theme'
import { useMediaQuery } from './useMediaQuery'

export function useResolvedTheme(appearance: Appearance): ResolvedTheme {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  if (appearance === 'system') return prefersDark ? 'dark' : 'light'
  return appearance
}
