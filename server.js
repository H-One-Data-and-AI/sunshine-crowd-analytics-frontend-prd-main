/* eslint-disable no-undef */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 2. Add ALL Security Headers
app.use((req, res, next) => {
  // --- EXISTING HEADERS (From previous steps) ---
  
  // 1. HSTS (Strict-Transport-Security)
  // Forces browser to use HTTPS for 2 years (63072000 seconds)
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  
  // 2. X-Content-Type-Options
  // Stops the browser from guessing file types (MIME sniffing)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // 3. Permissions-Policy
  // Blocks access to sensitive hardware like Camera/Mic
  res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(), camera=()');
  
  // 4. Content-Security-Policy (CSP)
  // Controls where scripts/styles/images can load from
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    // Scripts: Allow self, Google, Microsoft, and CDN (Required for App)
    "script-src 'self' 'unsafe-inline' https://apis.google.com https://login.microsoftonline.com https://cdn.jsdelivr.net; " +
    
    // Styles: Allow self and CDN
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    
    // Images: Allow data: and blob: (Required for Map Tiles)
    "img-src 'self' data: https: blob:; " + 
    
    // Fonts
    "font-src 'self' data:; " +
    
    // Connections: Allow your backends and auth providers
    "connect-src 'self' https://api.maptiler.com https://login.microsoftonline.com https://graph.microsoft.com htts://sunshineca-be-sea.azurewebsites.net; " + 
    
    // Frames: Allow Microsoft Login
    "frame-src 'self' https://login.microsoftonline.com; " +
    
    // Workers: Allow Blob (CRITICAL for Map Performance)
    "worker-src 'self' blob:; " +
    
    // Fixes "Clickjacking" (Low Severity) - Prevents embedding
    "frame-ancestors 'self'; "           
  );

  // --- NEW HEADERS (Added for this report) --

  // 5. X-Frame-Options
  // Stops other sites from putting your site in a fake <iframe> (Clickjacking protection)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // 6. Referrer-Policy
  // Controls how much info is sent when a user clicks a link to another site
  // 'strict-origin-when-cross-origin' is the modern secure standard
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
});

// 3. Serve Static Files
app.use(express.static(path.join(__dirname, 'dist')));

// 4. Handle React Routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 5. Start Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Secure Frontend Server running on port ${PORT}`);
});
