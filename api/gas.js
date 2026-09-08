/**
 * Vercel Serverless Function — GAS proxy
 *
 * Por qué existe:
 *   Google Apps Script Web Apps puede responder con redirecciones a
 *   script.googleusercontent.com. Este proxy reenvía el mismo request al
 *   backend real y devuelve la respuesta final, evitando errores de CORS/CSP
 *   en el frontend.
 *
 * Uso desde frontend:
 *   fetch('/api/gas', {
 *     method:'POST',
 *     headers:{'Content-Type':'application/json','X-GAS-URL':'https://...'},
 *     body: JSON.stringify({action:'ping'})
 *   })
 *
 * Importante:
 *   Este proxy NO incluye una URL fija. Cada request debe enviar
 *   'X-GAS-URL' con la URL del Web App del usuario.
 */

function _isGoogleAppsScriptUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'script.google.com' && parsed.pathname.includes('/macros/s/');
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  try {
    const method = (req.method || 'GET').toUpperCase();

    if (method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-GAS-URL');
      res.status(204).send('');
      return;
    }

    const headerGasUrl = (req.headers['x-gas-url'] || req.headers['X-GAS-URL'] || '').trim();

    if (!headerGasUrl || !_isGoogleAppsScriptUrl(headerGasUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Falta el header X-GAS-URL con la URL del Web App de Google Apps Script.'
      });
    }

    const target = new URL(headerGasUrl);
    const headers = new Headers(req.headers || {});
    headers.set('Content-Type', 'application/json');

    const gasRes = await fetch(target.toString(), {
      method,
      headers,
      body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(req.body || {}) : undefined,
      redirect: 'follow',
    });

    const text = await gasRes.text();
    res.status(gasRes.status);
    res.setHeader('Content-Type', gasRes.headers.get('content-type') || 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(text);
  } catch (err) {
    res.status(502).json({ success: false, error: 'Proxy error: ' + err.message });
  }
}
