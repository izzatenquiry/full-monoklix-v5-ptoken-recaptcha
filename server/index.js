
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

// ===============================
// ⚙️ CONFIG - UPDATED TO MATCH GOOGLE LABS
// ===============================
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const VEO_API_BASE = 'https://aisandbox-pa.googleapis.com/v1';

// Site Key & Project ID must match the ones used in the Electron extractor
const RECAPTCHA_SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';
const PROJECT_ID = 'gen-lang-client-0426593366';

// ===============================
// 🛠️ HELPERS
// ===============================
const log = (level, req, ...args) => {
  const timestamp = new Date().toISOString();
  const username = req?.headers?.['x-user-username'] || 'unknown';
  const prefix = `[${timestamp}] [${username}]`;
  
  if (level === 'error') {
    console.error(prefix, ...args);
  } else if (level === 'warn') {
    console.warn(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
};

const getJson = async (response, req) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    log('warn', req, '⚠️ Non-JSON response:', text.substring(0, 200));
    return { error: text };
  }
};

/**
 * Validates the reCAPTCHA token against Google Enterprise API
 */
async function validateRecaptchaToken(token, expectedAction) {
  if (!token || typeof token !== 'string') {
    log('warn', null, '⚠️ [reCAPTCHA] No token provided');
    return { valid: false, reason: 'NO_TOKEN' };
  }

  try {
    log('log', null, `🔐 [reCAPTCHA] Validating token for action: ${expectedAction}`);
    
    // Use the official assessment endpoint
    const assessmentUrl = `https://recaptchaenterprise.googleapis.com/v1/projects/${PROJECT_ID}/assessments?key=${GOOGLE_API_KEY}`;
    
    const requestBody = {
      event: {
        token: token,
        expectedAction: expectedAction,
        siteKey: RECAPTCHA_SITE_KEY
      }
    };

    const response = await fetch(assessmentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      log('error', null, `❌ [reCAPTCHA] Google API Error ${response.status}:`, errorText);
      return { valid: false, reason: 'GOOGLE_API_ERROR', status: response.status };
    }

    const data = await response.json();
    
    // Check if token is valid based on Google's response
    if (!data.tokenProperties || !data.tokenProperties.valid) {
      log('error', null, '❌ [reCAPTCHA] Token invalid:', data.tokenProperties?.invalidReason || 'unknown');
      return { valid: false, reason: data.tokenProperties?.invalidReason || 'INVALID_TOKEN' };
    }

    const score = data.riskAnalysis?.score ?? 0;
    const action = data.tokenProperties.action;

    // PINHOLE_GENERATE is the action used by VEO3
    log('log', null, `✅ [reCAPTCHA] Token verified! Action: ${action}, Score: ${score.toFixed(2)}`);
    return { valid: true, score: score, action: action };

  } catch (error) {
    log('error', null, '❌ [reCAPTCHA] Exception:', error.message);
    return { valid: false, reason: 'EXCEPTION', error: error.message };
  }
}

// ===============================
// 🧩 MIDDLEWARE
// ===============================
app.use(cors({
  origin: true, // Allow all origins for the proxy to be flexible
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Username'],
  maxAge: 86400
}));

app.use(express.json({ limit: '50mb' }));

// ===============================
// ========== VEO3 ENDPOINTS ==========
// ===============================

// Logic sharing for T2V and I2V
async function handleVeoGeneration(req, res, apiPath) {
  const authToken = req.headers.authorization?.replace('Bearer ', '');
  if (!authToken) {
    return res.status(401).json({ error: 'Unauthorized: Missing User Token' });
  }

  const recaptchaToken = req.body.recaptchaToken;
  let requestBody = { ...req.body };
  delete requestBody.recaptchaToken; // Cleanup body before forwarding

  if (recaptchaToken) {
    // Validate the token sent from frontend
    // We use PINHOLE_GENERATE as the expected action
    const validation = await validateRecaptchaToken(recaptchaToken, 'PINHOLE_GENERATE');
    
    if (validation.valid) {
      if (!requestBody.clientContext) requestBody.clientContext = {};
      requestBody.clientContext.recaptchaToken = recaptchaToken;
    } else {
      log('error', req, '❌ Blocked: Invalid reCAPTCHA token');
      return res.status(403).json({ error: 'INVALID_RECAPTCHA', requiresRecaptcha: true });
    }
  }

  log('log', req, `📤 Forwarding to VEO API: ${apiPath}`);
  
  const response = await fetch(`${VEO_API_BASE}/${apiPath}`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': GOOGLE_API_KEY,
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      'Origin': 'https://labs.google',
      'Referer': 'https://labs.google/'
    },
    body: JSON.stringify(requestBody)
  });

  const data = await getJson(response, req);
  
  if (!response.ok) {
    log('error', req, '❌ VEO API Failure:', data);
    // If Google still asks for reCAPTCHA even with a token, notify frontend
    if (response.status === 403 || JSON.stringify(data).includes('RECAPTCHA_REQUIRED')) {
      return res.status(403).json({ error: 'RECAPTCHA_REQUIRED', requiresRecaptcha: true });
    }
    return res.status(response.status).json(data);
  }

  res.json(data);
}

app.post('/api/veo/generate-t2v', (req, res) => handleVeoGeneration(req, res, 'video:batchAsyncGenerateVideoText'));
app.post('/api/veo/generate-i2v', (req, res) => handleVeoGeneration(req, res, 'video:batchAsyncGenerateVideoStartImage'));

app.post('/api/veo/status', async (req, res) => {
  try {
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    const response = await fetch(`${VEO_API_BASE}/video:batchCheckAsyncVideoGenerationStatus`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': GOOGLE_API_KEY,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Origin': 'https://labs.google'
      },
      body: JSON.stringify(req.body)
    });
    const data = await getJson(response, req);
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/veo/upload', async (req, res) => {
  try {
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    const response = await fetch(`${VEO_API_BASE}:uploadUserImage`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': GOOGLE_API_KEY,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Origin': 'https://labs.google'
      },
      body: JSON.stringify(req.body)
    });
    const data = await getJson(response, req);
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// IMAGEN Endpoints (Similar Proxy Logic)
app.post('/api/imagen/generate', async (req, res) => {
  try {
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    const response = await fetch(`${VEO_API_BASE}/whisk:generateImage`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': GOOGLE_API_KEY,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Origin': 'https://labs.google'
      },
      body: JSON.stringify(req.body)
    });
    const data = await getJson(response, req);
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ... (Other endpoints remain the same but use the updated headers)

app.get('/api/veo/download-video', async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'Missing URL' });
    const response = await fetch(videoUrl);
    res.setHeader('Content-Type', 'video/mp4');
    response.body.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Proxy Server running on port ${PORT}`);
  console.log(`🔐 Using reCAPTCHA Site Key: ${RECAPTCHA_SITE_KEY}`);
});
