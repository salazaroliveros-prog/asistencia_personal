@echo off
REM Script para configurar variables de entorno en Vercel
REM Requiere: vercel CLI instalado y token de Vercel configurado

echo ============================================================
echo   Configuración de Variables de Entorno en Vercel
echo   Control Personal Campo
echo ============================================================
echo.

REM Verificar si vercel está instalado
where vercel >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Vercel CLI no está instalado
    echo Instala Vercel CLI con: npm install -g vercel
    pause
    exit /b 1
)

REM Verificar si hay token de Vercel
echo Verificando token de Vercel...
vercel whoami >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: No hay token de Vercel configurado
    echo.
    echo Pasos para configurar:
    echo 1. Ve a https://vercel.com/account/tokens
    echo 2. Crea un nuevo token
    echo 3. Ejecuta: vercel login
    echo 4. O exporta: set VERCEL_TOKEN=tu_token_aqui
    echo.
    pause
    exit /b 1
)

echo Token de Vercel encontrado: OK
echo.

REM Verificar si el proyecto está enlazado
if exist .vercel\project.json (
    echo Proyecto ya enlazado
) else if exist .vercel\repo.json (
    echo Proyecto ya enlazado (via git)
) else (
    echo Proyecto no enlazado. Enlazando...
    vercel link -y
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: No se pudo enlazar el proyecto
        pause
        exit /b 1
    )
)

echo.
echo Configurando variables de entorno de Firebase...
echo.

REM Configurar variables de Firebase
echo Configurando VITE_FIREBASE_API_KEY...
echo AIzaSyDriDh1SC5_8T1rx5EmgFi0pUEKUGQU5xg | vercel env add VITE_FIREBASE_API_KEY -y

echo Configurando VITE_FIREBASE_AUTH_DOMAIN...
echo sistema-de-control-aee89.firebaseapp.com | vercel env add VITE_FIREBASE_AUTH_DOMAIN -y

echo Configurando VITE_FIREBASE_PROJECT_ID...
echo sistema-de-control-aee89 | vercel env add VITE_FIREBASE_PROJECT_ID -y

echo Configurando VITE_FIREBASE_STORAGE_BUCKET...
echo sistema-de-control-aee89.firebasestorage.app | vercel env add VITE_FIREBASE_STORAGE_BUCKET -y

echo Configurando VITE_FIREBASE_MESSAGING_SENDER_ID...
echo 265655332442 | vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID -y

echo Configurando VITE_FIREBASE_APP_ID...
echo 1:265655332442:web:c4e8617741e3b916987263 | vercel env add VITE_FIREBASE_APP_ID -y

echo Configurando VITE_FIREBASE_MEASUREMENT_ID...
echo "" | vercel env add VITE_FIREBASE_MEASUREMENT_ID -y

echo.
echo ============================================================
echo   Variables de entorno configuradas exitosamente
echo ============================================================
echo.
echo Verificar configuración:
vercel env ls
echo.
pause