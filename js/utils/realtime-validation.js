/**
 * CONTROL PERSONAL CAMPO — utils/realtime-validation.js
 * Sistema de validación en tiempo real para formularios
 * @version 1.0.0
 */

const RealtimeValidation = (() => {
  
  const validationRules = {
    nombre: {
      required: true,
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]+$/,
      message: 'Nombre debe tener entre 2-100 caracteres, solo letras y espacios'
    },
    dpi: {
      required: true,
      pattern: /^\d{13}$|^\d{15}$/,
      message: 'DPI debe tener 13 o 15 dígitos'
    },
    puesto: {
      required: true,
      minLength: 2,
      maxLength: 50,
      message: 'Puesto debe tener entre 2-50 caracteres'
    },
    telefono: {
      required: false,
      pattern: /^\d{8}$/,
      message: 'Teléfono debe tener 8 dígitos'
    },
    whatsapp: {
      required: false,
      pattern: /^\d{8}$/,
      message: 'WhatsApp debe tener 8 dígitos'
    },
    email: {
      required: false,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Email debe tener formato válido'
    }
  };
  
  function validateField(fieldName, value) {
    const rule = validationRules[fieldName];
    if (!rule) return { valid: true, message: '' };
    
    // Check required
    if (rule.required && (!value || value.trim() === '')) {
      return { valid: false, message: 'Este campo es requerido' };
    }
    
    // Skip validation if not required and empty
    if (!rule.required && (!value || value.trim() === '')) {
      return { valid: true, message: '' };
    }
    
    // Check length
    if (rule.minLength && value.length < rule.minLength) {
      return { valid: false, message: `Mínimo ${rule.minLength} caracteres` };
    }
    
    if (rule.maxLength && value.length > rule.maxLength) {
      return { valid: false, message: `Máximo ${rule.maxLength} caracteres` };
    }
    
    // Check pattern
    if (rule.pattern && !rule.pattern.test(value)) {
      return { valid: false, message: rule.message };
    }
    
    return { valid: true, message: '' };
  }
  
  function setupFormValidation(formId, fieldConfigs) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    fieldConfigs.forEach(config => {
      const input = document.getElementById(config.inputId);
      if (!input) return;
      
      // Add validation on input
      input.addEventListener('input', (e) => {
        const result = validateField(config.fieldName, e.target.value);
        showValidationFeedback(config.inputId, result);
      });
      
      // Add validation on blur
      input.addEventListener('blur', (e) => {
        const result = validateField(config.fieldName, e.target.value);
        showValidationFeedback(config.inputId, result);
      });
    });
  }
  
  function showValidationFeedback(inputId, result) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    // Remove existing feedback
    const existingFeedback = input.parentElement.querySelector('.validation-feedback');
    if (existingFeedback) existingFeedback.remove();
    
    // Remove existing classes
    input.classList.remove('valid', 'invalid');
    
    if (input.value.trim() === '') {
      return; // Don't show feedback for empty non-required fields
    }
    
    // Add feedback
    const feedback = document.createElement('span');
    feedback.className = 'validation-feedback';
    feedback.textContent = result.message;
    
    if (result.valid) {
      input.classList.add('valid');
      feedback.className = 'validation-feedback success';
      feedback.textContent = '✓ Válido';
    } else {
      input.classList.add('invalid');
      feedback.className = 'validation-feedback error';
    }
    
    input.parentElement.appendChild(feedback);
  }
  
  function validateForm(formId, fieldConfigs) {
    const form = document.getElementById(formId);
    if (!form) return { valid: true, errors: [] };
    
    const errors = [];
    
    fieldConfigs.forEach(config => {
      const input = document.getElementById(config.inputId);
      if (!input) return;
      
      const result = validateField(config.fieldName, input.value);
      if (!result.valid) {
        errors.push({
          field: config.fieldName,
          message: result.message
        });
        showValidationFeedback(config.inputId, result);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  return {
    validateField,
    setupFormValidation,
    validateForm
  };
})();

if (typeof window !== 'undefined') {
  window.RealtimeValidation = RealtimeValidation;
}