# ARQUITECTURA DEL SISTEMA - CONTROL PERSONAL CAMPO
**Versión:** 1.5.0  
**Fecha:** 2026-09-19  
**Tipo:** Documentación de Arquitectura Interactiva

---

## 📊 Diagrama de Arquitectura Completa

```mermaid
graph TB
    subgraph "FRONTEND - Capa de Presentación"
        A[index.html] --> B[app.js - Router SPA]
        B --> C[ModuloDashboard]
        B --> D[ModuloPersonal]
        B --> E[ModuloAsistencia]
        B --> F[ModuloCampo]
        B --> G[ModuloReportes]
        B --> H[ModuloAjustes]
    end

    subgraph "CAPA DE LÓGICA DE NEGOCIO"
        I[api.js - API CRUD] --> J[firebase-client.js]
        C --> I
        D --> I
        E --> I
        F --> I
        G --> I
        H --> I
    end

    subgraph "SERVICIOS Y UTILIDADES"
        K[AppState - Estado Global]
        L[Alerts - Notificaciones]
        M[QRGenerator - Generación QR]
        N[CameraSession - Gestión Cámaras]
        O[GPS - Geolocalización]
        P[Validators - Validación Datos]
        Q[PDFBuilder - Generación PDF]
        R[DataExport - Exportación Datos]
        S[CacheManager - Gestión Caché]
        T[AIEngine - Diagnóstico IA]
        U[AIPredictor - Predicción IA]
    end

    subgraph "SINCRONIZACIÓN OFFLINE"
        V[localStorage - Almacenamiento Local]
        W[OFFLINE_QUEUE - Cola Sincronización]
        X[SYNC_INDICATOR - Indicador Estado]
        Y[Service Worker - PWA]
    end

    subgraph "BACKEND - Firebase"
        Z[firebase-config.js]
        AA[Firestore - Base de Datos]
        AB[Authentication - Auth]
        AC[Cloud Functions - Funciones Backend]
    end

    subgraph "ALMACENAMIENTO EXTERNO"
        AD[Firestore Database]
        AE[Firebase Storage]
        AF[Google Apps Script - Opcional]
    end

    I --> K
    I --> L
    I --> M
    I --> N
    I --> O
    I --> P
    I --> Q
    I --> R
    I --> S
    I --> T
    I --> U

    I --> V
    I --> W
    V --> X
    Y --> V

    J --> Z
    J --> AA
    J --> AB
    J --> AC

    W --> AA
    W --> AC

    AA --> AD
    AC --> AE
    AC --> AF

    style A fill:#e1f5ff
    style B fill:#fff4e6
    style I fill:#f0f0f0
    style J fill:#ffe6e6
    style V fill:#e6ffe6
    style AA fill:#ffe6cc
    style AD fill:#e6e6ff
```

---

## 🔄 Flujo de Datos Detallado

### 1. Inicialización del Sistema

```mermaid
sequenceDiagram
    participant U as Usuario
    participant H as index.html
    participant A as app.js
    participant FC as firebase-client.js
    participant FS as Firestore
    participant LS as localStorage
    participant SW as Service Worker

    U->>H: Abre aplicación
    H->>A: DOMContentLoaded
    A->>A: Limpiar datos demo
    A->>A: Renderizar iconos Lucide
    A->>FC: FirebaseClient.initialize()
    FC->>FC: Validar config Firebase
    FC->>FS: Inicializar conexión
    FS-->>FC: Conexión establecida
    FC->>FC: onAuthStateChanged
    FC->>A: Estado: connected
    A->>A: Inicializar módulos
    A->>LS: Restaurar estado desde localStorage
    LS-->>A: Datos cache restaurados
    A->>A: Iniciar router SPA
    A->>SW: Registrar Service Worker
    SW-->>A: PWA activo
    A-->>U: Aplicación lista
```

### 2. Flujo de Registro de Personal

```mermaid
sequenceDiagram
    participant U as Usuario
    participant MP as ModuloPersonal
    participant API as api.js
    participant FC as firebase-client.js
    participant LS as localStorage
    participant FS as Firestore
    participant AI as AIEngine

    U->>MP: Formulario nuevo trabajador
    MP->>P: Validators.validateWorker()
    P-->>MP: Datos validados
    MP->>MP: Generar QR Data
    MP->>M: QRGenerator.generate()
    M-->>MP: QR generado
    MP->>API: API.registrarPersonal()
    
    alt Conexión Online
        API->>FC: FirebaseClient.save('personal')
        FC->>FS: Firestore personal collection
        FS-->>FC: Guardado exitoso
        FC-->>API: Success
        API->>LS: Actualizar cache personal
        API->>T: AIEngine.logOperation()
    else Sin Conexión
        API->>LS: Guardar en localStorage
        API->>W: Agregar a OFFLINE_QUEUE
        API-->>MP: Modo offline activado
    end
    
    API-->>MP: Resultado operación
    MP->>L: Alerts.success()
    MP->>K: AppState.actualizarPersonal()
    MP-->>U: Trabajador registrado
```

### 3. Flujo de Marcación de Asistencia

```mermaid
sequenceDiagram
    participant U as Usuario
    participant MA as ModuloAsistencia
    participant CAM as Campo Module
    participant QR as MobileQRScanner
    participant GPS as GPS Service
    participant API as api.js
    participant FC as firebase-client.js
    participant LS as localStorage
    participant FS as Firestore

    U->>MA: Botón marcar asistencia
    MA->>MA: Obtener trabajador activo
    MA->>GPS: GPS.getCurrentPosition()
    GPS-->>MA: Coordenadas GPS
    
    alt Marcación QR
        U->>CAM: Escanear QR carné
        CAM->>QR: MobileQRScanner.start()
        QR-->>CAM: QR Data decodificado
        CAM->>API: API.marcarAsistencia()
    else Marcación Manual
        U->>MA: Formulario manual
        MA->>API: API.marcarAsistencia()
    end
    
    API->>P: Validators.validateAttendance()
    P-->>API: Datos validados
    API->>API: normalizeAttendance()
    
    alt Conexión Online
        API->>FC: FirebaseClient.save('asistencias')
        FC->>FS: Firestore asistencias collection
        FS-->>FC: Guardado exitoso
        FC-->>API: Success
        API->>LS: Actualizar cache asistencias
    else Sin Conexión
        API->>LS: Guardar en localStorage
        API->>W: Agregar a OFFLINE_QUEUE
        API-->>MA: Modo offline activado
    end
    
    API-->>MA: Resultado operación
    MA->>L: Alerts.success()
    MA->>K: AppState.actualizarAsistencias()
    MA-->>U: Marcación registrada
```

### 4. Flujo de Sincronización Offline

```mermaid
sequenceDiagram
    participant X as SYNC_INDICATOR
    participant W as OFFLINE_QUEUE
    participant API as api.js
    participant FC as firebase-client.js
    participant FS as Firestore
    participant LS as localStorage

    Note over X,LS: Sistema detecta reconexión
    
    X->>API: checkSyncStatus()
    API->>W: processOfflineQueue()
    
    loop Para cada operación pendiente
        W->>API: Operación de cola
        API->>FC: FirebaseClient.save()
        FC->>FS: Ejecutar operación Firestore
        FS-->>FC: Resultado
        FC-->>API: Success/Error
        API->>W: Marcar como procesada
    end
    
    W->>LS: Limpiar operaciones procesadas
    W->>X: Actualizar indicador
    X-->>API: Sincronización completada
    API->>L: Alerts.success('Sincronización completada')
```

### 5. Flujo de Consulta y Visualización

```mermaid
sequenceDiagram
    participant U as Usuario
    participant MOD as Módulo (Dashboard/Personal/etc)
    participant API as api.js
    participant FC as firebase-client.js
    participant LS as localStorage
    participant FS as Firestore
    participant K as AppState

    U->>MOD: Solicitar datos
    MOD->>API: API.obtenerDatos()
    
    alt Conexión Online
        API->>FC: FirebaseClient.list()
        FC->>FS: Query Firestore
        FS-->>FC: Datos obtenidos
        FC-->>API: Success con datos
        API->>LS: Actualizar cache
        API->>K: AppState.set('datos')
    else Sin Conexión
        API->>LS: Leer desde localStorage
        LS-->>API: Datos cache
        API->>K: AppState.set('datos')
        API-->>MOD: Modo offline
    end
    
    API-->>MOD: Datos retornados
    MOD->>MOD: Renderizar vista
    MOD-->>U: Datos visualizados
```

---

## 🗄️ Modelo de Datos y Almacenamiento

### Estructura de Base de Datos Firestore

```mermaid
erDiagram
    PERSONAL ||--o{ ASISTENCIAS : "registra"
    PERSONAL ||--o{ ALERTAS : "genera"
    PERSONAL ||--o{ CONFIGURACION : "configura"
    
    PERSONAL {
        string ID_Trabajador PK
        string Nombre_Completo
        string DPI_CUI
        string Puesto
        string Estado
        string Fecha_Registro
        string Telefono
        string WhatsApp
        string Direccion
        string Fotografia_URL
        string Codigo_QR_Data
    }
    
    ASISTENCIAS {
        string ID_Marcacion PK
        string ID_Trabajador FK
        string Nombre_Trabajador
        string Fecha
        string Tipo_Marcacion
        string Hora_Real
        string Estado_Marcacion
        string Metodo_Registro
        number Horas_Extra
        string Ubicacion_Obra
        float GPS_Latitud
        float GPS_Longitud
        float GPS_Accuracy
        boolean Geofence_Inside
        number Timestamp
    }
    
    ALERTAS {
        string ID_Alerta PK
        string ID_Trabajador FK
        string Tipo_Alerta
        string Mensaje
        string Fecha
        boolean Leida
        number Timestamp
    }
    
    CONFIGURACION {
        string ID_Config PK
        string Parametro
        string Valor
        string Ultima_Actualizacion
    }
```

### Estrategia de Almacenamiento Local

```mermaid
graph LR
    subgraph "localStorage - Estructura"
        A[cpc_personal_cache]
        B[cpc_attendance_cache]
        C[cpc_alerts_cache]
        D[cpc_config]
        E[cpc_firebase_config]
        F[cpc_offline_queue]
        G[cpc_last_sync]
        H[cpc_error_history]
        I[cpc_ai_logs]
    end
    
    subgraph "AppState - Memoria Volátil"
        J[personal]
        K[asistencias]
        L[alertas]
        M[config]
        N[connected]
        O[backendMode]
    end
    
    A --> J
    B --> K
    C --> L
    D --> M
    E --> Z
    F --> W
    G --> X
    H --> T
    I --> T
```

---

## 🔐 Flujo de Autenticación y Seguridad

```mermaid
sequenceDiagram
    participant U as Usuario
    participant AUTH as Firebase Auth
    participant FC as firebase-client.js
    participant FS as Firestore Rules
    participant DB as Firestore Database

    U->>AUTH: Iniciar sesión
    AUTH->>AUTH: Verificar credenciales
    AUTH-->>FC: onAuthStateChanged(user)
    
    alt Usuario verificado
        FC->>FC: setConnectionState('connected')
        FC->>FS: Subscribe to collections
        FS->>DB: Validar permisos rules
        DB-->>FS: Access granted
        FS-->>FC: Real-time data flow
        FC-->>U: Aplicación conectada
    else Usuario no verificado
        FC->>FC: setConnectionState('disconnected')
        FC->>FC: Activar modo local
        FC-->>U: Modo offline activado
    end
    
    Note over FC,DB: Firestore Rules Security:
    Note over FC,DB: - isAuthenticated()
    Note over FC,DB: - isAuthorizedOperator()
    Note over FC,DB: - isValidWorkerData()
    Note over FC,DB: - isValidAttendanceData()
```

---

## 📱 Arquitectura PWA y Service Worker

```mermaid
graph TB
    subgraph "PWA - Progressive Web App"
        A[Manifest.json]
        B[Service Worker]
        C[Workbox Precaching]
        D[Install Event]
        E[Activate Event]
        F[Fetch Event]
    end
    
    subgraph "Estrategias de Caching"
        G[Cache-First - Assets Estáticos]
        H[Network-First - Navegación]
        I[Stale-While-Revalidate - API]
        J[Network-Only - Cámaras/QR]
    end
    
    subgraph "Assets Precacheados"
        K[index.html]
        L[CSS files]
        M[JS modules]
        N[Icons]
        O[Manifest]
    end
    
    A --> D
    D --> C
    C --> K
    C --> L
    C --> M
    C --> N
    C --> O
    
    F --> G
    F --> H
    F --> I
    F --> J
    
    G --> K
    H --> A
    I --> FS
    J --> CAM
```

---

## 🤖 Arquitectura de Inteligencia Artificial

```mermaid
graph TB
    subgraph "AI Engine - Sistema de Diagnóstico"
        A[AIEngine.initialize]
        B[AutoHealing Module]
        C[Learning Module]
        D[Health Check]
    end
    
    subgraph "AI Predictor - Sistema de Predicción"
        E[AIPredictor.setThresholds]
        F[Anomaly Detection]
        G[Performance Prediction]
        H[Resource Forecasting]
    end
    
    subgraph "AI Logger - Sistema de Logs"
        I[AILogger.logError]
        J[Pattern Recognition]
        K[Solution Generation]
        L[History Storage]
    end
    
    subgraph "Data Sources"
        M[Error History]
        N[Performance Metrics]
        O[User Behavior]
        P[System Logs]
    end
    
    A --> D
    D --> B
    D --> C
    B --> M
    C --> N
    
    E --> F
    F --> G
    G --> H
    H --> O
    
    I --> J
    J --> K
    K --> L
    L --> P
```

---

## 🔄 Ciclo de Vida de Datos

```mermaid
stateDiagram-v2
    [*] --> Inicialización: app.js
    Inicialización --> CargaMódulos: DOMContentLoaded
    CargaMódulos --> EstadoRestaurado: localStorage
    EstadoRestaurado --> FirebaseConnect: firebase-client.js
    FirebaseConnect --> Conectado: onAuthStateChanged
    FirebaseConnect --> Offline: Sin conexión
    
    Conectado --> OperaciónOnline: Usuario acción
    Offline --> OperaciónOffline: Usuario acción
    
    OperacionOnline --> Validación: Validators
    OperacionOffline --> Validación: Validators
    
    Validación --> GuardadoFirestore: Conexión activa
    Validación --> GuardadoLocal: Sin conexión
    
    GuardadoFirestore --> ActualizarCache: localStorage
    GuardadoLocal --> ColaOffline: OFFLINE_QUEUE
    
    ActualizarCache --> ActualizarUI: AppState
    ColaOffline --> ActualizarUI: AppState
    
    ActualizarUI --> [*]: Operación completada
    
    [*] --> Sincronización: Conexión restaurada
    Sincronización --> ProcesarCola: OFFLINE_QUEUE
    ProcesarCola --> GuardadoFirestore: Firebase
```

---

## 📊 Métricas y Monitoreo

```mermaid
graph TB
    subgraph "Métricas de Sistema"
        A[Performance Metrics]
        B[Network Metrics]
        C[Storage Metrics]
        D[User Behavior Metrics]
    end
    
    subgraph "Health Check"
        E[Connection State]
        F[Sync Status]
        G[Cache Status]
        H[Error Rate]
    end
    
    subgraph "Alerting"
        I[Threshold Alerts]
        J[Anomaly Detection]
        K[Auto-healing Triggers]
    end
    
    A --> E
    B --> F
    C --> G
    D --> H
    
    E --> I
    F --> I
    G --> J
    H --> K
    
    I --> L[Notifications]
    J --> L
    K --> M[Auto-correction]
```

---

## 🎯 Conclusiones de Arquitectura

### ✅ Fortalezas del Diseño

1. **Offline-First**: Sistema robusto que funciona sin conexión
2. **Sincronización Automática**: Cola de operaciones para reconexión
3. **Real-time Updates**: Listeners nativos de Firebase
4. **Modularidad**: Separación clara de responsabilidades
5. **Escalabilidad**: Arquitectura preparada para crecimiento
6. **Seguridad**: Validación de datos en múltiples capas
7. **PWA**: Funciona como app nativa instalable
8. **AI Integration**: Diagnóstico y predicción de problemas

### 🔒 Seguridad de Datos

- **Firebase Rules**: Validación a nivel de base de datos
- **Input Validation**: Validación en frontend y backend
- **Authentication**: Requiere email verificado
- **Role-Based Access**: Control de acceso por roles
- **CSP**: Content Security Policy configurado
- **HTTPS**: Requerido para cámaras y GPS

### 📱 Optimización Móvil

- **Responsive Design**: Adaptado a múltiples tamaños
- **PWA**: Instalable como app nativa
- **Camera Optimizations**: Ajustes específicos por dispositivo
- **Touch Targets**: Tamaño mínimo 44px para accesibilidad
- **Performance**: Service Worker para caching inteligente

---

**Fin de Documentación de Arquitectura Completa**