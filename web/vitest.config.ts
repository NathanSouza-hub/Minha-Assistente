import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // Testes de fluxo (vários cliques e formulários) passam de 5 s com a suíte inteira no CI.
      testTimeout: 15_000,
    },
  }),
)
