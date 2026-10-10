export default [{
  files: ['**/*.js'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: {
      AbortController: 'readonly',
      Blob: 'readonly',
      TextDecoder: 'readonly',
      TextEncoder: 'readonly',
      DOMParser: 'readonly',
      FileReader: 'readonly',
      FormData: 'readonly',
      URL: 'readonly',
      URLSearchParams: 'readonly',
      File: 'readonly',
      structuredClone: 'readonly',
      setInterval: 'readonly',
      atob: 'readonly',
      btoa: 'readonly',
      caches: 'readonly',
      clearTimeout: 'readonly',
      console: 'readonly',
      crypto: 'readonly',
      document: 'readonly',
      fetch: 'readonly',
      globalThis: 'readonly',
      localStorage: 'readonly',
      module: 'readonly',
      navigator: 'readonly',
      self: 'readonly',
      setTimeout: 'readonly',
      window: 'readonly'
    }
  },
  rules: {
    'no-duplicate-imports': 'error',
    'no-unreachable': 'error',
    'no-undef': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
  }
}];
