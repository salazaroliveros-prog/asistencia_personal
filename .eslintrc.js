module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  globals: {
    // Firebase globals
    firebase: 'readonly',
    
    // App globals
    window: 'readonly',
    document: 'readonly',
    console: 'readonly',
    localStorage: 'readonly',
    navigator: 'readonly',
    
    // Module globals
    AppState: 'readonly',
    API: 'readonly',
    FirebaseClient: 'readonly',
    ModuloDashboard: 'readonly',
    ModuloPersonal: 'readonly',
    ModuloAsistencia: 'readonly',
    ModuloCampo: 'readonly',
    ModuloReportes: 'readonly',
    ModuloAjustes: 'readonly',
    UserManagement: 'readonly',
    BackupManager: 'readonly',
    ThemeManager: 'readonly',
    KeyboardShortcuts: 'readonly',
    PerformanceOptimizer: 'readonly',
    UpdateManager: 'readonly',
    
    // Utility globals
    Alerts: 'readonly',
    Logger: 'readonly',
    Validators: 'readonly',
    QRGenerator: 'readonly',
    CacheManager: 'readonly',
    CameraSession: 'readonly',
    GPS: 'readonly',
    MapViewer: 'readonly',
    PDFBuilder: 'readonly',
    RequestOptimizer: 'readonly',
    DataValidator: 'readonly',
    DataExport: 'readonly',
    BulkOperations: 'readonly',
    
    // Library globals
    lucide: 'readonly',
    QRCode: 'readonly',
    Html5Qrcode: 'readonly',
    L: 'readonly',
    Chart: 'readonly',
    html2canvas: 'readonly',
    jspdf: 'readonly',
    
    // Config globals
    LS_KEYS: 'readonly',
    DEFAULT_CONFIG: 'readonly',
    APP_VERSION: 'readonly',
    APP_NAME: 'readonly',
    
    // Helper globals
    CPC: 'readonly',
  },
  rules: {
    // Possible errors
    'no-console': 'off',
    'no-debugger': 'warn',
    'no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    
    // Best practices
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-with': 'error',
    'no-return-await': 'off',
    
    // Stylistic
    'indent': ['error', 2, { SwitchCase: 1 }],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always',
    }],
    
    // ES6
    'arrow-parens': ['error', 'as-needed'],
    'arrow-spacing': 'error',
    'no-duplicate-imports': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-arrow-callback': 'error',
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'functions/node_modules/',
    'public/vendor/',
    '*.min.js',
    'playwright-report/',
    '.playwright-browsers/',
  ],
};