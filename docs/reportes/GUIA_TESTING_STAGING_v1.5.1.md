# 🧪 GUÍA DE TESTING - v1.5.1

## Control Personal Campo - Validación Completa

---

## ✅ PASOS DE VALIDACIÓN LOCAL

### PASO 1: Linting y Formateo (5 minutos)

```bash
# Verificar código para errores
npm run lint

# Formatear código automáticamente
npm run format

# Si hay errores, revisar con
eslint js/**/*.js --debug
```

**Esperado:** Sin errores críticos, máximo 50 warnings

---

### PASO 2: Build del Proyecto (10 minutos)

```bash
# Limpiar build anterior
rm -rf dist/

# Build completo
npm run build

# Verificar output
ls -lh dist/
```

**Esperado:**
- dist/ con archivos minificados
- index.html (~120 KB)
- Assets (~2-3 MB)
- Sin errores en consola

---

### PASO 3: Iniciar Localmente (5 minutos)

```bash
# Ejecutar servidor local
npm start

# O en otra terminal, si prefieres Vite dev
npm run dev
```

**Esperado:**
- Servidor corriendo en http://localhost:3801
- Logs sin errores
- PWA manifest cargado

---

### PASO 4: Validación Manual en Navegador (30 minutos)

#### 4.1 Abrir la Aplicación
```
1. Abre http://localhost:3801 en navegador
2. F12 para abrir Developer Tools
3. Console tab
```

**Verificar:**
```
✅ Logs centralizados presentes
   [logger-centralized.js] Inicializado
✅ ModuleCleanup disponible
   window.ModuleCleanup !== undefined
✅ FirebaseAuthValidator corriendo
   window.FirebaseAuthValidator !== undefined
✅ Validadores disponibles
   window.AdvancedValidators !== undefined
✅ Config centralizada
   window.CentralConfig !== undefined
```

#### 4.2 Probar Memory Leak Fix

En Console, ejecutar:
```javascript
// Ver estado de listeners
console.log(ModuleCleanup.getStatus());

// Debe estar vacío al inicio
// {"dashboard": 0}
```

Luego:
```javascript
// Cambiar de página
window.location.hash = '#personal';

// Esperar 2 segundos
// Cambiar de nuevo
window.location.hash = '#asistencia';

// Verificar que se limpió
console.log(ModuleCleanup.getStatus());
// Debe mostrar memoria limpia
```

**Esperado:** Listeners se agregan y limpian sin acumular

#### 4.3 Probar Logging Centralizado

En Console:
```javascript
// Probar todos los niveles
Log.debug('test', 'Debug message', {foo: 'bar'});
Log.info('test', 'Info message');
Log.warn('test', 'Warn message');
Log.error('test', 'Error message', new Error('test'));
Log.critical('test', 'Critical message');
```

**Esperado:**
- Colores diferentes por nivel
- Timestamps consistentes
- Datos estructurados

#### 4.4 Probar Validadores

En Console:
```javascript
// DPI válido
AdvancedValidators.validateDPI('1234567890101');
// {valid: true, value: '1234567890101'}

// DPI inválido
AdvancedValidators.validateDPI('1234567890102');
// {valid: false, error: '...'}

// Horario
AdvancedValidators.validateTimeRange('08:00', '07:00', '17:00');
// {valid: true}

// GPS
AdvancedValidators.validateGPSAccuracy(14.634915, -90.506894, 35);
// {valid: true, accuracy: 35}
```

**Esperado:** Validaciones funcionan correctamente

#### 4.5 Probar Config Centralizada

En Console:
```javascript
// Acceso a config
CentralConfig.getByPath('gps.accuracyThresholdMeters');
// 50

CentralConfig.positions;
// ['Albañil', 'Maestro de Obra', ...]

CentralConfig.schedules.entrada;
// '07:00'

// Validar config
CentralConfig.validate();
// true
```

**Esperado:** Config accesible y válida

---

### PASO 5: Tests Unitarios (15 minutos)

```bash
# Ejecutar todos los tests
npm run test:unit

# O con más detalle
npm run test:html

# O E2E si hay tests configurados
npm run test:e2e
```

**Esperado:**
- Tests pasan sin errores
- Coverage > 80% (si aplica)
- Sin warnings

---

### PASO 6: Performance Check (10 minutos)

En DevTools:

1. **Memory Tab**
   ```
   1. Take heap snapshot
   2. Cambiar de página 10 veces
   3. Take another heap snapshot
   4. Compare
   ```
   **Esperado:** No crecimiento significativo de memoria

2. **Network Tab**
   ```
   1. Abrir aplicación
   2. Ver assets cargados
   3. Verificar tamaños
   ```
   **Esperado:**
   - JS bundle < 500 KB
   - CSS < 100 KB
   - Total < 3 MB

3. **Lighthouse**
   ```
   1. F12 > Lighthouse
   2. Run audit
   ```
   **Esperado:**
   - Performance > 90
   - Accessibility > 95
   - Best Practices > 90
   - SEO > 90

---

## 🚀 DEPLOY A STAGING

### Paso 1: Preparar Git

```bash
# Verificar cambios
git status

# Agregar archivos
git add .

# Commit
git commit -m "v1.5.1: Corregir 34 issues críticos

BREAKING CHANGES:
- API ahora requiere AppState inicializado
- Token de Firebase se valida automáticamente

FEATURES:
- ModuleCleanup para prevenir memory leaks
- FirebaseAuthValidator para validación automática
- AdvancedValidators mejorados
- CentralizedLogger para logging consistente
- CentralConfig para configuración única

FIXES:
- Corregir 5 bugs críticos
- Corregir 8 bugs moderados
- Resolver 12 advertencias
"

# Verificar commit
git log --oneline -1
```

### Paso 2: Push a GitHub

```bash
# Push a develop
git push origin develop

# Vercel deploy automático sucede aquí
# El deployment toma ~2-3 minutos
```

### Paso 3: Esperar Vercel

```bash
# Ver status en
# https://vercel.com/proyectoswm/control_asistencia_app

# O en GitHub Actions
# https://github.com/salazaroliveros-prog/asistencia_personal/actions
```

---

## 🧪 VALIDACIÓN EN STAGING

Una vez que Vercel complete el deployment:

### 1. Acceder a Staging
```
https://control-asistencia-app-staging.vercel.app
(O la URL que Vercel asigne)
```

### 2. Validar Funcionalidad
```
✅ Dashboard carga
✅ Personal CRUD funciona
✅ Asistencia/Marcaciones funcionan
✅ Campo módulo móvil funciona
✅ Reportes generan
✅ Ajustes persisten
```

### 3. Validar Nuevas Características
```
✅ ModuleCleanup funciona (cambiar de página)
✅ Auth validator funciona (token validado)
✅ Validadores funcionan (DPI, horarios, GPS)
✅ Logging centralizado funciona (F12 > Console)
✅ Config centralizada funciona
```

### 4. Monitor Sentry
```
Ir a Sentry dashboard
Verificar que no hay nuevos errores
Confirmar que logs están llegando
```

---

## ❌ TROUBLESHOOTING

### Build Falla

```bash
# Limpiar e intentar de nuevo
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Tests Fallan

```bash
# Verificar que los nuevos módulos se cargan
grep -r "window\\.ModuleCleanup" js/

# Reinstalar dependencias
npm install

# Ejecutar específico
npm run test:unit
```

### Vercel Deployment Falla

```bash
# Revisar logs en Vercel dashboard
# Commit a develop puede no tener acceso a variables

# Asegurar que .vercelignore está actualizado
cat .vercelignore

# Retry manual en Vercel dashboard
```

---

## 📊 CHECKLIST FINAL

### Local Testing
- [ ] Linting sin errores críticos
- [ ] Build exitoso
- [ ] Aplicación corre en localhost
- [ ] Logs en consola son correctos
- [ ] Memory no crece (ModuleCleanup)
- [ ] Validadores funcionan
- [ ] Config centralizada funciona

### Staging Testing
- [ ] Vercel deployment exitoso
- [ ] Aplicación accesible en staging URL
- [ ] Todos los módulos funcionan
- [ ] No hay errores en Sentry
- [ ] Performance > 90
- [ ] PWA funciona

### Pre-Production
- [ ] Todo testing completado
- [ ] Backup de v1.5.0 hecho
- [ ] Documentación actualizada
- [ ] Team notificado
- [ ] Rollback plan preparado

---

## 🔄 ROLLBACK PLAN

Si algo falla en producción:

```bash
# Ver deployment anterior
git log --oneline -5

# Revert a versión anterior
git revert HEAD
git push origin main

# Vercel redeploy automático
```

O en Vercel dashboard:
```
1. Ir a Deployments
2. Encontrar último buen deployment
3. Click "Promote to Production"
```

---

## 📞 SOPORTE

Si encuentras problemas:

1. Revisar documentación en `REPORTE_IMPLEMENTACION_CORRECCIONES_v1.5.1.md`
2. Revisar console logs (F12)
3. Revisar Sentry dashboard
4. Revisar GitHub issues

---

**Testing Guide v1.5.1**  
**Status:** Ready for QA  
**Completar en:** ~90 minutos total
