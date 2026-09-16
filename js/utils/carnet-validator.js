/**
 * CONTROL PERSONAL CAMPO — utils/carnet-validator.js
 * Sistema de validación de carnets y QR codes
 * @version 1.5.0
 */

const CarnetValidator = (() => {
  /**
   * Valida un QR code escaneado
   * @param {string} qrData - Datos del QR escaneado
   * @param {Object} personalData - Datos de trabajadores disponibles
   * @returns {Object} Resultado de validación
   */
  function validateQR(qrData, personalData) {
    const result = {
      valid: false,
      worker: null,
      errors: [],
      warnings: [],
    };

    try {
      // Intentar parsear como JSON
      let parsedData;
      try {
        parsedData = JSON.parse(qrData);
      } catch (_) {
        // Si no es JSON, tratar como string simple (ID)
        parsedData = { id: qrData };
      }

      // Validar estructura mínima
      if (!parsedData.id && !parsedData.ID_Trabajador) {
        result.errors.push('QR no contiene ID válido');
        return result;
      }

      const workerId = parsedData.id || parsedData.ID_Trabajador;

      // Buscar trabajador en datos disponibles
      if (Array.isArray(personalData)) {
        result.worker = personalData.find((p) => 
          p.ID_Trabajador === workerId || 
          (p.DPI_CUI && String(p.DPI_CUI).replace(/\D/g, '') === String(workerId).replace(/\D/g, '')),
        );
      }

      if (!result.worker) {
        result.errors.push('Trabajador no encontrado en base de datos');
        result.warnings.push('El QR puede ser de un trabajador no sincronizado');
      } else {
        result.valid = true;

        // Validaciones adicionales
        if (!result.worker.Nombre_Completo) {
          result.warnings.push('Trabajador sin nombre completo');
        }

        if (!result.worker.Puesto) {
          result.warnings.push('Trabajador sin puesto asignado');
        }

        if (!result.worker.DPI_CUI) {
          result.warnings.push('Trabajador sin DPI/CUI');
        }

        // Validar que el QR coincida con los datos actuales
        if (parsedData.dpi && result.worker.DPI_CUI) {
          const qrDPI = String(parsedData.dpi).replace(/\D/g, '');
          const workerDPI = String(result.worker.DPI_CUI).replace(/\D/g, '');
          if (qrDPI !== workerDPI) {
            result.warnings.push('DPI en QR no coincide con datos actuales del trabajador');
          }
        }
      }

    } catch (error) {
      result.errors.push('Error al procesar QR: ' + error.message);
    }

    return result;
  }

  /**
   * Verifica si un carnet es válido para escaneo
   * @param {Object} carnet - Datos del carnet
   * @returns {Object} Resultado de verificación
   */
  function verifyCarnet(carnet) {
    const result = {
      valid: false,
      errors: [],
      warnings: [],
    };

    if (!carnet) {
      result.errors.push('Carnet no proporcionado');
      return result;
    }

    if (!carnet.trabajador) {
      result.errors.push('Carnet sin datos de trabajador');
      return result;
    }

    if (!carnet.qrDataUrl) {
      result.errors.push('Carnet sin QR code');
      return result;
    }

    if (!carnet.imageDataUrl) {
      result.warnings.push('Carnet sin imagen generada');
    }

    // Verificar fecha de expiración
    if (carnet.fechaExpiracion) {
      const expiracion = new Date(carnet.fechaExpiracion);
      const hoy = new Date();
      if (expiracion < hoy) {
        result.errors.push('Carnet expirado');
      } else if (expiracion < new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000)) {
        result.warnings.push('Carnet expira pronto (menos de 30 días)');
      }
    }

    if (result.errors.length === 0) {
      result.valid = true;
    }

    return result;
  }

  /**
   * Genera datos de prueba para trabajadores
   * @param {number} count - Cantidad de trabajadores a generar
   * @returns {Array} Array de trabajadores de prueba
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
        Fecha_Ingreso: new Date().toISOString().split('T')[0],
      });
    }

    return workers;
  }

  /**
   * Simula escaneo de QR con datos de prueba
   * @param {Object} worker - Trabajador a escanear
   * @returns {Object} Resultado del escaneo simulado
   */
  function simulateQRScan(worker) {
    const qrData = {
      id: worker.ID_Trabajador,
      dpi: worker.DPI_CUI,
      nombre: worker.Nombre_Completo,
      puesto: worker.Puesto,
    };

    return {
      success: true,
      qrData: JSON.stringify(qrData),
      worker,
      timestamp: Date.now(),
    };
  }

  /**
   * Valida sistema de cámara para escaneo
   * @returns {Promise<Object>} Resultado de validación de cámara
   */
  async function validateCameraSystem() {
    const result = {
      supported: false,
      cameras: [],
      errors: [],
      warnings: [],
      recommendations: [],
    };

    try {
      // Verificar soporte de mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        result.errors.push('getUserMedia no está disponible en este navegador');
        result.recommendations.push('Usa un navegador moderno (Chrome, Firefox, Safari)');
        return result;
      }

      // Verificar protocolo seguro
      const protocol = window.location.protocol;
      if (protocol !== 'https:' && protocol !== 'http:' && protocol !== 'capacitor:') {
        result.errors.push('Protocolo no soportado: ' + protocol);
        result.recommendations.push('Usa HTTPS para acceso a cámara');
        return result;
      }

      result.supported = true;

      // Solicitar permisos y enumerar cámaras
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((track) => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        result.cameras = devices
          .filter((device) => device.kind === 'videoinput')
          .map((device, index) => ({
            id: device.deviceId,
            label: device.label || `Cámara ${index + 1}`,
            groupId: device.groupId,
          }));

        if (result.cameras.length === 0) {
          result.warnings.push('No se detectaron cámaras');
          result.recommendations.push('Verifica que el dispositivo tiene cámara disponible');
        } else if (result.cameras.length === 1) {
          result.warnings.push('Solo se detectó una cámara');
        } else {
          result.recommendations.push(`Se detectaron ${result.cameras.length} cámaras disponibles`);
        }

      } catch (error) {
        result.errors.push('Error al acceder a cámara: ' + error.message);
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          result.recommendations.push('Permite acceso a cámara en configuración del navegador');
        } else if (error.name === 'NotFoundError') {
          result.recommendations.push('Verifica que el dispositivo tiene cámara disponible');
        } else if (error.name === 'NotReadableError') {
          result.recommendations.push('Otra aplicación puede estar usando la cámara');
        }
      }

    } catch (error) {
      result.errors.push('Error inesperado: ' + error.message);
    }

    return result;
  }

  /**
   * Valida sistema de escaneo QR
   * @returns {Object} Resultado de validación de escáner
   */
  function validateQRScannerSystem() {
    const result = {
      supported: false,
      html5Qrcode: false,
      mobileOptimized: false,
      errors: [],
      warnings: [],
      recommendations: [],
    };

    // Verificar Html5Qrcode
    if (typeof Html5Qrcode === 'undefined') {
      result.errors.push('Html5Qrcode no está disponible');
      result.recommendations.push('Verifica que html5-qrcode.min.js está cargado');
      return result;
    }

    result.html5Qrcode = true;
    result.supported = true;

    // Verificar optimización móvil
    if (window.MobileQRScanner) {
      result.mobileOptimized = true;
      result.recommendations.push('Sistema de escaneo móvil optimizado disponible');
    } else {
      result.warnings.push('Sistema de escaneo móvil optimizado no disponible');
      result.recommendations.push('El sistema usará configuración estándar');
    }

    // Verificar capacidades del dispositivo
    const deviceInfo = window.MobileCameraOptimizer?.getDeviceInfo() || {};
    if (deviceInfo.isMobile) {
      result.recommendations.push(`Dispositivo móvil detectado: ${deviceInfo.deviceType}`);
      
      if (deviceInfo.deviceType === 'ios') {
        result.recommendations.push('iOS: Usa facingMode "environment" para mejor calidad');
      } else if (deviceInfo.deviceType === 'android') {
        result.recommendations.push('Android: Verifica permisos en configuración del sistema');
      }
    } else {
      result.recommendations.push('Dispositivo desktop detectado');
    }

    return result;
  }

  /**
   * Ejecuta prueba completa de escaneo
   * @param {Array} workers - Trabajadores para probar
   * @returns {Promise<Object>} Resultado de la prueba
   */
  async function runScanTest(workers) {
    const result = {
      cameraValidation: null,
      scannerValidation: null,
      scanResults: [],
      summary: {
        total: workers.length,
        successful: 0,
        failed: 0,
        warnings: 0,
      },
    };

    // Validar sistema de cámara
    result.cameraValidation = await validateCameraSystem();

    // Validar sistema de escáner
    result.scannerValidation = validateQRScannerSystem();

    // Si el sistema no está soportado, no continuar con pruebas
    if (!result.cameraValidation.supported || !result.scannerValidation.supported) {
      return result;
    }

    // Ejecutar pruebas de escaneo simulado
    for (const worker of workers) {
      try {
        const scanResult = simulateQRScan(worker);
        
        // Validar QR escaneado
        const validation = validateQR(scanResult.qrData, workers);
        
        result.scanResults.push({
          worker: worker.ID_Trabajador,
          scanSuccess: scanResult.success,
          validation: validation,
          timestamp: scanResult.timestamp,
        });

        if (validation.valid) {
          result.summary.successful++;
        } else {
          result.summary.failed++;
        }

        if (validation.warnings.length > 0) {
          result.summary.warnings += validation.warnings.length;
        }

      } catch (error) {
        result.scanResults.push({
          worker: worker.ID_Trabajador,
          scanSuccess: false,
          error: error.message,
          timestamp: Date.now(),
        });
        result.summary.failed++;
      }
    }

    return result;
  }

  return {
    validateQR,
    verifyCarnet,
    generateTestWorkers,
    simulateQRScan,
    validateCameraSystem,
    validateQRScannerSystem,
    runScanTest,
  };
})();

// Exponer el módulo globalmente
window.CarnetValidator = CarnetValidator;