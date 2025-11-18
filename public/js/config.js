/**
 * Application Configuration
 * This file contains environment-specific settings
 * Works with: localhost, Render, Vercel, Netlify, custom domains
 */

(function() {
  // Detect environment
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;
  
  // Determine API base URL based on environment
  let API_BASE_URL;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Development environment
    const devPort = port || '5000';
    API_BASE_URL = `${protocol}//${hostname}:${devPort}`;
  } else if (hostname.includes('onrender.com')) {
    // Render.com deployment (frontend + backend together)
    API_BASE_URL = `${protocol}//${hostname}`;
  } else if (hostname.includes('vercel.app') || hostname.includes('netlify.app')) {
    // Vercel/Netlify deployment (frontend only)
    // Backend should be deployed separately
    API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || `${protocol}//${hostname}`;
  } else {
    // Custom domain or other hosting
    API_BASE_URL = `${protocol}//${hostname}`;
  }
  
  // Make configuration globally available
  window.APP_CONFIG = {
    API_BASE: API_BASE_URL,
    ENVIRONMENT: hostname === 'localhost' ? 'development' : 'production',
    VERSION: '1.0.0',
    HOSTNAME: hostname
  };
  
  console.log('🔧 App Config Loaded:', window.APP_CONFIG);
})();
