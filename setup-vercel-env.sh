#!/bin/bash
# Script para configurar variables de entorno en Vercel
# Requiere: vercel CLI instalado y token de Vercel configurado

echo "============================================================"
echo "  Configuración de Variables de Entorno en Vercel"
echo "  Control Personal Campo"
echo "============================================================"
echo ""

# Verificar si vercel está instalado
if ! command -v vercel &> /dev/null; then
    echo "ERROR: Vercel CLI no está instalado"
    echo "Instala Vercel CLI con: npm install -g vercel"
    exit 1
fi

# Verificar si hay token de Vercel
echo "Verificando token de Vercel..."
if ! vercel whoami &> /dev/null; then
    echo "ERROR: No hay token de Vercel configurado"
    echo ""
    echo "Pasos para configurar:"
    echo "1. Ve a https://vercel.com/account/tokens"
    echo "2. Crea un nuevo token"
    echo "3. Ejecuta: vercel login"
    echo "4. O exporta: export VERCEL_TOKEN=tu_token_aqui"
    echo ""
    exit 1
fi

echo "Token de Vercel encontrado: OK"
echo ""

# Verificar si el proyecto está enlazado
if [ -f ".vercel/project.json" ]; then
    echo "Proyecto ya enlazado"
elif [ -f ".vercel/repo.json" ]; then
    echo "Proyecto ya enlazado (via git)"
else
    echo "Proyecto no enlazado. Enlazando..."
    vercel link -y
    if [ $? -ne 0 ]; then
        echo "ERROR: No se pudo enlazar el proyecto"
        exit 1
    fi
fi

echo ""
echo "Configurando variables de entorno de Firebase..."
echo ""

# Configurar variables de Firebase
echo "Configurando VITE_FIREBASE_API_KEY..."
echo "AIzaSyDriDh1SC5_8T1rx5EmgFi0pUEKUGQU5xg" | vercel env add VITE_FIREBASE_API_KEY -y

echo "Configurando VITE_FIREBASE_AUTH_DOMAIN..."
echo "sistema-de-control-aee89.firebaseapp.com" | vercel env add VITE_FIREBASE_AUTH_DOMAIN -y

echo "Configurando VITE_FIREBASE_PROJECT_ID..."
echo "sistema-de-control-aee89" | vercel env add VITE_FIREBASE_PROJECT_ID -y

echo "Configurando VITE_FIREBASE_STORAGE_BUCKET..."
echo "sistema-de-control-aee89.firebasestorage.app" | vercel env add VITE_FIREBASE_STORAGE_BUCKET -y

echo "Configurando VITE_FIREBASE_MESSAGING_SENDER_ID..."
echo "265655332442" | vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID -y

echo "Configurando VITE_FIREBASE_APP_ID..."
echo "1:265655332442:web:c4e8617741e3b916987263" | vercel env add VITE_FIREBASE_APP_ID -y

echo "Configurando VITE_FIREBASE_MEASUREMENT_ID..."
echo "" | vercel env add VITE_FIREBASE_MEASUREMENT_ID -y

echo ""
echo "============================================================"
echo "  Variables de entorno configuradas exitosamente"
echo "============================================================"
echo ""
echo "Verificar configuración:"
vercel env ls
echo ""