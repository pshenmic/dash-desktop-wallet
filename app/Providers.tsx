'use client'

import { ThemeProvider } from 'dash-ui-kit/react'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider initialTheme="light">{children}</ThemeProvider>
}