/**
 * CONTROL PERSONAL CAMPO — __tests__/carnet-test.js
 * Pruebas completas de generación de carnets, impresión y escaneo QR
 * @version 1.5.0
 */

const CarnetTest = (() => {
  /**
   * Ejecuta pruebas completas de carnets
   */
  async function runCarnetTests() {
    console.log('🧪 ===============================================');
    console.log('🧪 PRUEBAS COMPLETAS DE CARNETS');
    console.log('🧪 ===============================================');
    console.log('📅 Fecha:', new Date().toISOString());
    console.log('');

    const results = {
      generation: { total: 0, successful: 0, failed: 0, errors: [] },
      validation: { total: 0, valid: 0, invalid: 0, warnings: [] },
      camera: { supported: false, cameras: 0, errors: [] },
      scanner: { supported: false, errors: [] },
      scan: { total: 0, successful: 0, failed: 0, warnings: [] }
    };

    try {
      // 1. Generar trabajadores de prueba
      console.log('👥 Generando trabajadores de prueba...');
      const workers = window.CarnetValidator?.generateTestWorkers(5) || [];
      console.log(`✅ ${workers.length} trabajadores generados`);
      console.log('');

      // 2. Validar sistema de cámara
      console.log('📷 Validando sistema de cámara...');
      const cameraValidation = await window.CarnetValidator?.validateCameraSystem() || {};
      results.camera = cameraValidation;
      
      if (cameraValidation.supported) {
        console.log(`✅ Sistema de cámara soportado`);
        console.log(`✅ ${cameraValidation.cameras.length} cámaras detectadas`);
        if (cameraValidation.recommendations) {
          cameraValidation.recommendations.forEach(rec => console.log(`💡 ${rec}`));
        }
      } else {
        console.log(`❌ Sistema de cámara no soportado`);
        cameraValidation.errors.forEach(err => console.log(`❌ ${err}`));
      }
      console.log('');

      // 3. Validar sistema de escáner QR
      console.log('📱 Validando sistema de escáner QR...');
      const scannerValidation = window.CarnetValidator?.validateQRScannerSystem() || {};
      results.scanner = scannerValidation;
      
      if (scannerValidation.supported) {
        console.log(`✅ Sistema de escáner QR soportado`);
        if (scannerValidation.mobileOptimized) {
          console.log(`✅ Sistema móvil optimizado disponible`);
        }
        if (scannerValidation.recommendations) {
          scannerValidation.recommendations.forEach(rec => console.log(`💡 ${rec}`));
        }
      } else {
        console.log(`❌ Sistema de escáner QR no soportado`);
        scannerValidation.errors.forEach(err => console.log(`❌ ${err}`));
      }
      console.log('');

      // 4. Generar carnets
      console.log('🎨 Generando carnets...');
      results.generation.total = workers.length;
      
      for (const worker of workers) {
        try {
          const validation = window.CarnetGenerator?.validateWorkerForCarnet(worker);
          
          if (!validation.valid) {
            console.log(`⚠️  Trabajador ${worker.ID_Trabajador} no válido para carnet:`, validation.errors);
            results.generation.errors.push({ worker: worker.ID_Trabajador, errors: validation.errors });
            results.generation.failed++;
            continue;
          }

          if (validation.warnings.length > 0) {
            console.log(`⚠️  Trabajador ${worker.ID_Trabajador} tiene advertencias:`, validation.warnings);
          }

          const carnet = await window.CarnetGenerator?.generateCarnet(worker);
          
          if (carnet && carnet.html) {
            console.log(`✅ Carnet generado para ${worker.ID_Trabajador}`);
            results.generation.successful++;
            
            // Guardar en localStorage para referencia
            try {
              const carnets = JSON.parse(localStorage.getItem('cpc_test_carnets') || '[]');
              carnets.push({
                workerId: worker.ID_Trabajador,
                carnetHTML: carnet.html,
                carnetImage: carnet.imageDataUrl,
                qrImage: carnet.qrDataUrl,
                timestamp: Date.now()
              });
              localStorage.setItem('cpc_test_carnets', JSON.stringify(carnets));
            } catch (e) {
              console.warn('No se pudo guardar carnet en localStorage:', e);
            }
          } else {
            console.log(`❌ Error generando carnet para ${worker.ID_Trabajador}`);
            results.generation.failed++;
          }
        } catch (error) {
          console.log(`❌ Error procesando ${worker.ID_Trabajador}:`, error.message);
          results.generation.errors.push({ worker: worker.ID_Trabajador, error: error.message });
          results.generation.failed++;
        }
      }
      console.log('');

      // 5. Validar carnets generados
      console.log('✅ Validando carnets generados...');
      try {
        const carnets = JSON.parse(localStorage.getItem('cpc_test_carnets') || '[]');
        results.validation.total = carnets.length;
        
        for (const carnet of carnets) {
          const verification = window.CarnetValidator?.verifyCarnet(carnet);
          
          if (verification.valid) {
            console.log(`✅ Carnet ${carnet.workerId} válido`);
            results.validation.valid++;
          } else {
            console.log(`❌ Carnet ${carnet.workerId} inválido:`, verification.errors);
            results.validation.invalid++;
          }
          
          if (verification.warnings.length > 0) {
            console.log(`⚠️  Carnet ${carnet.workerId} advertencias:`, verification.warnings);
            results.validation.warnings.push(...verification.warnings);
          }
        }
      } catch (error) {
        console.log('❌ Error al validar carnets:', error.message);
      }
      console.log('');

      // 6. Ejecutar pruebas de escaneo
      console.log('📷 Ejecutando pruebas de escaneo QR...');
      const scanTest = await window.CarnetValidator?.runScanTest(workers) || {};
      
      if (scanTest.summary) {
        results.scan = scanTest.summary;
        console.log(`📊 Escaneos: ${scanTest.summary.successful} exitosos, ${scanTest.summary.failed} fallidos`);
        
        if (scanTest.scanResults) {
          scanTest.scanResults.forEach(result => {
            if (result.validation.valid) {
              console.log(`✅ Escaneo ${result.worker}: válido`);
            } else {
              console.log(`❌ Escaneo ${result.worker}: inválido`);
            }
          });
        }
      }
      console.log('');

      // 7. Generar reporte final
      console.log('📊 ===============================================');
      console.log('📊 RESUMEN DE PRUEBAS');
      console.log('📊 ===============================================');
      console.log(`🎨 Generación de Carnets:`);
      console.log(`   Total: ${results.generation.total}`);
      console.log(`   Exitosos: ${results.generation.successful}`);
      console.log(`   Fallidos: ${results.generation.failed}`);
      console.log(``);
      console.log(`✅ Validación de Carnets:`);
      console.log(`   Total: ${results.validation.total}`);
      console.log(`   Válidos: ${results.validation.valid}`);
      console.log(`   Inválidos: ${results.validation.invalid}`);
      console.log(`   Advertencias: ${results.validation.warnings.length}`);
      console.log(``);
      console.log(`📷 Sistema de Cámara:`);
      console.log(`   Soportado: ${results.camera.supported ? '✅' : '❌'}`);
      console.log(`   Cámaras: ${results.camera.cameras.length}`);
      console.log(``);
      console.log(`📱 Sistema de Escáner QR:`);
      console.log(`   Soportado: ${results.scanner.supported ? '✅' : '❌'}`);
      console.log(`   Móvil optimizado: ${results.scanner.mobileOptimized ? '✅' : '❌'}`);
      console.log(``);
      console.log(`📷 Pruebas de Escaneo:`);
      console.log(`   Total: ${results.scan.total}`);
      console.log(`   Exitosos: ${results.scan.successful}`);
      console.log(`   Fallidos: ${results.scan.failed}`);
      console.log(`   Advertencias: ${results.scan.warnings}`);
      console.log(``);

      // Guardar resultados
      try {
        localStorage.setItem('cpc_carnet_test_results', JSON.stringify({
          timestamp: Date.now(),
          results
        }));
        console.log('💾 Resultados guardados en localStorage');
      } catch (e) {
        console.warn('No se pudo guardar resultados:', e);
      }

      return results;

    } catch (error) {
      console.error('❌ Error ejecutando pruebas:', error);
      throw error;
    }
  }

  /**
   * Genera reporte HTML de carnets generados
   */
  function generateCarnetReport() {
    try {
      const carnets = JSON.parse(localStorage.getItem('cpc_test_carnets') || '[]');
      
      if (carnets.length === 0) {
        console.log('❌ No hay carnets generados para mostrar reporte');
        return;
      }

      const reportHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Reporte de Carnets - Control Personal Campo</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
            .header { text-align: center; margin-bottom: 30px; }
            .carnet-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
            .carnet-item { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .carnet-actions { margin-top: 15px; display: flex; gap: 10px; }
            .btn { padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; }
            .btn-primary { background: #667eea; color: white; }
            .btn-secondary { background: #764ba2; color: white; }
            .carnet-preview { margin-top: 15px; border: 1px solid #ddd; padding: 10px; border-radius: 5px; }
            .timestamp { font-size: 12px; color: #666; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎨 Reporte de Carnets Generados</h1>
            <p>Control Personal Campo - Pruebas de Carnets y Escaneo QR</p>
            <p>${new Date().toLocaleString('es-GT')}</p>
          </div>
          
          <div class="carnet-grid">
            ${carnets.map(carnet => `
              <div class="carnet-item">
                <h3>${carnet.workerId}</h3>
                <div class="carnet-preview">
                  ${carnet.carnetHTML}
                </div>
                <div class="carnet-actions">
                  <button class="btn btn-primary" onclick="window.CarnetGenerator?.printCarnet('${carnet.workerId}')">
                    🖨️ Imprimir
                  </button>
                  <button class="btn btn-secondary" onclick="window.CarnetGenerator?.downloadCarnet('${carnet.workerId}', 'carnet-${carnet.workerId}.png')">
                    💾 Descargar
                  </button>
                </div>
                <div class="timestamp">Generado: ${new Date(carnet.timestamp).toLocaleString('es-GT')}</div>
              </div>
            `).join('')}
          </div>
        </body>
        </html>
      `;

      // Abrir reporte en nueva ventana
      const reportWindow = window.open('', '_blank');
      reportWindow.document.write(reportHTML);
      reportWindow.document.close();

    } catch (error) {
      console.error('Error generando reporte:', error);
    }
  }

  return {
    runCarnetTests,
    generateCarnetReport
  };
})();

// Exponer globalmente
if (typeof window !== 'undefined') {
  window.CarnetTest = CarnetTest;
}