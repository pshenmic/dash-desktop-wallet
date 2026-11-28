import {resolve} from 'path'
import {defineConfig} from 'vitest/config'

export default defineConfig({
  // CI, Windows especially, is several times slower than a dev machine and the
  // API suites derive HD/BLS keys and run PBKDF2 per test.
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  }
})