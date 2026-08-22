import { defineConfig } from 'vitest/config'

/**
 * Config aparte para las pruebas de firestore.rules: necesitan el
 * emulador de Firestore andando (y Java), asi que no van en la corrida
 * normal de tests ni en el CI. Se corren con `npm run test:reglas`.
 */
export default defineConfig({
  test: {
    include: ['pruebas/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
})
