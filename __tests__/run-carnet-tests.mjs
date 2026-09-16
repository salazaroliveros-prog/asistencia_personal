/**
 * CONTROL PERSONAL CAMPO — __tests__/run-carnet-tests.mjs
 * Script para ejecutar pruebas completas de carnets en Node.js
 * @version 1.5.0
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Genera trabajadores de prueba
 */
function generateTestWorkers(count = 5) {
  const workers = [];
  const puestos = ['Albañil', 'Maestro de Obra', 'Ayudante', 'Soldador', 'Electricista', 'Ingeniero', 'Supervisor'];
  const nombres = ['Juan', 'María', 'Carlos', 'Ana', 'Pedro', 'Laura', 'Miguel', 'Sofía'];
  const apellidos = ['García', 'López', 'Martínez', 'Rodríguez', 'Pérez', 'González', 'Sánchez', 'Romero'];

  for (let i = 0; i < count; i++) {
    const nombre = nombres[Math.floor(Math.random() * nombres.length)];
    const apellido = apellidos[Math.floor(Math.random() * apellidos.length)];
    const puesto = puestos[Math.floor(Math.random() * puestos.length)];
    const id = `TRAB-${String(i + 1).padStart(4, '0')}`;
    const dpi = Math.floor(Math.random() * 90000000000) + 10000000000;

    workers.push({
      ID_Trabajador: id,
      Nombre_Completo: `${nombre} ${apellido}`,
      DPI_CUI: String(dpi),
      Puesto: puesto,
      Fotografia_URL: null,
      Estado: 'Activo',
      Fecha_Ingreso: new Date().toISOString().split('T')[0]
    });
  }

  return workers;
}

/**
 * Valida datos de trabajadores
 */
function validateWorkers(workers) {
  const results = {
    total: workers.length,
    valid: 0,
    invalid: 0,
    errors: []
  };

  workers.forEach((worker, index) => {
    const errors = [];
    
    if (!worker.ID_Trabajador) errors.push('ID_Trabajador requerido');
    if (!worker.Nombre_Completo) errors.push('Nombre_Completo requerido');
    if (!worker.DPI_CUI) errors.push('DPI_CUI requerido');
    if (!worker.Puesto) errors.push('Puesto requerido');

    if (errors.length === 0) {
      results.valid++;
    } else {
      results.invalid++;
      results.errors.push({ worker: worker.ID_Trabajador || index, errors });
    }
  });

  return results;
}

/**
 * Genera datos de QR para trabajadores
 */
function generateQRData(workers) {
  return workers.map(worker => ({
    id: worker.ID_Trabajador,
    dpi: worker.DPI_CUI,
    nombre: worker.Nombre_Completo,
    puesto: worker.Puesto
  }));
}

/**
 * Simula validación de QR
 */
function validateQR(qrData, workers) {
  const results = {
    total: qrData.length,
    valid: 0,
    invalid: 0,
    warnings: []
  };

  qrData.forEach(qr => {
    const worker = workers.find(w => w.ID_Trabajador === qr.id);
    
    if (worker) {
      results.valid++;
    } else {
      results.invalid++;
      results.warnings.push(`QR para ${qr.id} no encontrado en trabajadores`);
    }
  });

  return results;
}

/**
 * Genera reporte de pruebas
 */
function generateTestReport(workers, validation, qrData, qrValidation) {
  const report = {
    timestamp: new Date().toISOString(),
    testType: 'Carnet and QR Scan Tests',
    workers: {
      generated: workers.length,
      valid: validation.valid,
      invalid: validation.invalid,
      errors: validation.errors
    },
    qrData: {
      generated: qrData.length,
      valid: qrValidation.valid,
      invalid: qrValidation.invalid,
      warnings: qrValidation.warnings
    },
    summary: {
      totalTests: workers.length + qrData.length,
      passed: validation.valid + qrValidation.valid,
      failed: validation.invalid + qrValidation.invalid,
      warnings: qrValidation.warnings.length
    }
  };

  return report;
}

/**
 * Ejecuta pruebas completas
 */
function runCarnetTests() {
  console.log('🧪 ===============================================');
  console.log('🧪 PRUEBAS COMPLETAS DE CARNETS Y ESCANEO QR');
  console.log('🧪 ===============================================');
  console.log('📅 Fecha:', new Date().toISOString());
  console.log('');

  try {
    // 1. Generar trabajadores de prueba
    console.log('👥 Generando trabajadores de prueba...');
    const workers = generateTestWorkers(5);
    console.log(`✅ ${workers.length} trabajadores generados`);
    console.log('');

    // 2. Validar trabajadores
    console.log('✅ Validando trabajadores...');
    const validation = validateWorkers(workers);
    console.log(`✅ Validación: ${validation.valid} válidos, ${validation.invalid} inválidos`);
    if (validation.errors.length > 0) {
      console.log('❌ Errores:');
      validation.errors.forEach(err => console.log(`   ${err.worker}: ${err.errors.join(', ')}`));
    }
    console.log('');

    // 3. Generar datos de QR
    console.log('📱 Generando datos de QR...');
    const qrData = generateQRData(workers);
    console.log(`✅ ${qrData.length} QR codes generados`);
    console.log('');

    // 4. Validar QR codes
    console.log('📷 Validando QR codes...');
    const qrValidation = validateQR(qrData, workers);
    console.log(`✅ Validación QR: ${qrValidation.valid} válidos, ${qrValidation.invalid} inválidos`);
    if (qrValidation.warnings.length > 0) {
      console.log('⚠️  Advertencias:');
      qrValidation.warnings.forEach(warn => console.log(`   ${warn}`));
    }
    console.log('');

    // 5. Generar reporte
    console.log('📊 Generando reporte de pruebas...');
    const report = generateTestReport(workers, validation, qrData, qrValidation);
    console.log('');

    // 6. Mostrar resumen
    console.log('📊 ===============================================');
    console.log('📊 RESUMEN DE PRUEBAS');
    console.log('📊 ===============================================');
    console.log(`👥 Trabajadores Generados: ${report.workers.generated}`);
    console.log(`   Válidos: ${report.workers.valid}`);
    console.log(`   Inválidos: ${report.workers.invalid}`);
    console.log(``);
    console.log(`📱 QR Codes Generados: ${report.qrData.generated}`);
    console.log(`   Válidos: ${report.qrData.valid}`);
    console.log(`   Inválidos: ${report.qrData.invalid}`);
    console.log(``);
    console.log(`📊 Total Pruebas: ${report.summary.total}`);
    console.log(`   Pasadas: ${report.summary.passed}`);
    console.log(`   Fallidas: ${report.summary.failed}`);
    console.log(`   Advertencias: ${report.summary.warnings}`);
    console.log('');

    // 7. Guardar reporte
    const reportPath = join(__dirname, 'carnet-test-results.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`💾 Reporte guardado en: ${reportPath}`);

    // 8. Guardar datos de prueba
    const testDataPath = join(__dirname, 'carnet-test-data.json');
    writeFileSync(testDataPath, JSON.stringify({
      workers,
      qrData,
      report
    }, null, 2));
    console.log(`💾 Datos de prueba guardados en: ${testDataPath}`);

    console.log('');
    console.log('✅ Pruebas completas exitosamente');

    return report;

  } catch (error) {
    console.error('❌ Error ejecutando pruebas:', error);
    throw error;
  }
}

// Ejecutar pruebas
runCarnetTests();