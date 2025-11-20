// Minimal Supabase client bootstrap for frontend pages
// 1) Copy values from your Supabase project from .env
// 2) This file is intended for local development. For production, consider an auth proxy.

// Read from environment or override here
const SUPABASE_URL = window.__SUPABASE_URL__ || 'https://oyochmpyzpraqpasxcoj.supabase.co';
const SUPABASE_ANON = window.__SUPABASE_ANON__ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95b2NobXB5enByYXFwYXN4Y29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMjA4OTAsImV4cCI6MjA3NDg5Njg5MH0.WHhxcujbMpLysMdBTQGfgYno2E64Xy822egr5XF7HGw';

// Check if Supabase library is loaded
if (typeof window.supabase === 'undefined' || !window.supabase || !window.supabase.createClient) {
  console.error('Supabase JS CDN not loaded. Include https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 before this file.');
} else {
  // Create the Supabase client
  window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { 
      persistSession: true, 
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  console.log('Supabase client initialized');
}
