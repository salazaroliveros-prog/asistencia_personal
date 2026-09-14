# Product Overview — Control Personal Campo

## Purpose & Value Proposition

**Control Personal Campo** (v1.5.0) is a field workforce attendance management system designed for construction sites in Guatemala. It enables supervisors and administrators to track worker attendance in real time using GPS geofencing and QR code scanning, with offline-first capability and Firebase cloud sync.

## Key Features

- **Attendance Tracking**: Four daily check-in types — Entrada, Salida_Receso, Regreso_Receso, Salida_Obra — with punctuality status (A Tiempo, Tolerancia, Atraso, Ausencia).
- **Worker Registry (Personal)**: Full CRUD for workers with DPI/CUI validation, job roles (Albañil, Maestro de Obra, Electricista, etc.), photos, and QR ID cards.
- **GPS Geofencing**: Optional location enforcement with configurable center coordinates and radius (default 200 m).
- **QR Code Scanning**: Workers carry QR-coded ID cards; a dedicated field scanner (`field-scanner.html`) reads them for fast check-in.
- **Dashboard**: Real-time summary of daily attendance, shift status, and alerts.
- **Reports (Reportes)**: Daily/period PDF and export reports via jsPDF + AutoTable.
- **Offline-First**: LocalStorage cache with an offline queue that syncs to Firestore when connectivity is restored.
- **PWA + Native**: Installable as a Progressive Web App; also packaged for Android/iOS via Capacitor.
- **Role-Based Access**: Firebase Auth with custom claims (`admin` role) and a fixed authorized operator email for attendance creation.
- **Settings (Ajustes)**: Configurable work hours, tolerances, GPS parameters, logo, and Firebase connection.

## Target Users & Use Cases

| User | Role | Use Case |
|------|------|----------|
| Site Administrator | Admin (custom claim) | Manage workers, edit records, generate reports, configure system |
| Field Operator | Authorized operator email | Mark daily attendance via QR scan or manual search |
| Supervisor / Viewer | Authenticated user | View attendance dashboard and alerts |

## Application Scope

- Designed for Guatemalan construction sites (timezone: `America/Guatemala`, GMT-6).
- Supports all 22 Guatemalan departments for worker address data.
- Deployed via Firebase Hosting + Cloud Functions, with optional Vercel and Docker deployments.
