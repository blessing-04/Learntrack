/**
 * Centralized Authentication Helper
 * Provides consistent token management across the app
 */

const AuthHelper = {
  /**
   * Get authentication token from sessionStorage
   * Checks multiple keys for compatibility
   */
  getToken() {
    const token = sessionStorage.getItem('token') || 
                  sessionStorage.getItem('auth_token') || 
                  sessionStorage.getItem('supabase_token');
    
    if (!token) {
      console.warn('⚠️  No authentication token found in sessionStorage');
      console.log('Available keys:', Object.keys(sessionStorage));
    } else {
      console.log('✅ Token found');
    }
    
    return token;
  },

  /**
   * Store authentication token in sessionStorage
   * Stores in multiple keys for compatibility
   */
  setToken(token) {
    if (!token) {
      console.error('❌ Cannot store null/undefined token');
      return false;
    }
    
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('auth_token', token);
    sessionStorage.setItem('supabase_token', token);
    
    console.log('✅ Token stored in all keys');
    return true;
  },

  /**
   * Clear all authentication data
   */
  clearAuth() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('supabase_token');
    sessionStorage.removeItem('user_id');
    sessionStorage.removeItem('user_email');
    sessionStorage.removeItem('user_role');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('email');
    
    console.log('🗑️  All auth data cleared');
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getToken();
  },

  /**
   * Redirect to sign in if not authenticated
   */
  requireAuth() {
    if (!this.isAuthenticated()) {
      console.warn('⚠️  Not authenticated, redirecting to sign in');
      window.location.href = '/signIn.html';
      return false;
    }
    return true;
  },

  /**
   * Get user role
   */
  getUserRole() {
    return sessionStorage.getItem('role') || sessionStorage.getItem('user_role');
  },

  /**
   * Get user email
   */
  getUserEmail() {
    return sessionStorage.getItem('email') || sessionStorage.getItem('user_email');
  },

  /**
   * Store user data
   */
  setUserData(data) {
    if (data.token) this.setToken(data.token);
    if (data.role) {
      sessionStorage.setItem('role', data.role);
      sessionStorage.setItem('user_role', data.role);
    }
    if (data.email) {
      sessionStorage.setItem('email', data.email);
      sessionStorage.setItem('user_email', data.email);
    }
    if (data.user_id || data.userId) {
      sessionStorage.setItem('user_id', data.user_id || data.userId);
    }
  }
};

// Make it globally available
window.AuthHelper = AuthHelper;
