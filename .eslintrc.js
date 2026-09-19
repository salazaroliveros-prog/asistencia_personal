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
    AutoHealing: 'readonly',
    HardwareDiagnostics: 'readonly',
    MobileQRScanner: 'readonly',
    ErrorHandler: 'readonly',
    AILogger: 'readonly',
    DashboardEnhancer: 'readonly',
    
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
    TIPOS_MARCACION: 'readonly',
    PUESTOS: 'readonly',
    PUESTO_COLORES: 'readonly',
    DEPARTAMENTOS_GT: 'readonly',
    
    // Helper globals
    CPC: 'readonly',
    
    // AI globals
    AIEngine: 'readonly',
    AIPredictor: 'readonly',
    validateConfigGPS: 'readonly',
    
    // Helper functions
    inicialesDeNombre: 'readonly',
    colorPorPuesto: 'readonly',
    htmlToImage: 'readonly',
    Constants: 'readonly',
  },
  rules: {
    // Possible errors
    'no-console': 'off',
    'no-debugger': 'warn',
    'no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    'no-empty': 'warn',
    'no-unreachable': 'warn',
    'no-useless-escape': 'warn',
    'no-prototype-builtins': 'warn',
    'no-const-assign': 'warn',
    'no-useless-catch': 'warn',
    
    // Best practices
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-with': 'error',
    'no-return-await': 'off',
    
    // Stylistic
    'indent': ['error', 2, { SwitchCase: 1 }],
    // linebreak-style DESACTIVADO a propósito: el repositorio tiene finales de
    // línea mixtos (LF en los archivos escritos por herramientas y CRLF en los
    // que git convierte con core.autocrlf=true en Windows). Fijarlo a 'windows'
    // generaba ~1100 errores en cualquier checkout con LF y contradecía a
    // .prettierrc (endOfLine). La regla se delega a git/prettier para que
    // `npm run lint` no dependa del sistema operativo del desarrollador.
    'linebreak-style': 'off',
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['warn', 'always-multiline'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always',
    }],
    
    // ES6
    'arrow-parens': ['warn', 'always'],
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