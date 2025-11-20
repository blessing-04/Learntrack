// ============================================
// GLOBAL TOKEN MANAGEMENT & API WRAPPER
// ============================================

// Token management utilities
window.AuthManager = {
  // Get token from sessionStorage
  getToken() {
    return sessionStorage.getItem('auth_token') || null;
  },

  // Store token in sessionStorage
  setToken(token) {
    if (token) {
      sessionStorage.setItem('auth_token', token);
    } else {
      sessionStorage.removeItem('auth_token');
    }
  },

  // Clear token (logout)
  clearToken() {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_role');
    sessionStorage.removeItem('user_email');
  },

  // Store user info
  setUserInfo(data) {
    if (data.role) sessionStorage.setItem('user_role', data.role);
    if (data.email) sessionStorage.setItem('user_email', data.email);
  },

  // Get user role
  getUserRole() {
    return sessionStorage.getItem('user_role') || null;
  },

  // Check if authenticated
  isAuthenticated() {
    return !!this.getToken();
  }
};

// Global fetch wrapper that automatically includes auth token
window.apiFetch = async function(url, options = {}) {
  const token = window.AuthManager.getToken();
  
  // Set up default headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Add token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Merge options
  const fetchOptions = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, fetchOptions);
    
    // Handle 401 - token expired or invalid
    if (response.status === 401) {
      window.AuthManager.clearToken();
      alert('Session expired. Please sign in again.');
      window.location.href = '/signIn.html';
      throw new Error('Unauthorized');
    }

    return response;
  } catch (error) {
    console.error('API Fetch error:', error);
    throw error;
  }
};

// Initialize token from Supabase session on page load
window.addEventListener('DOMContentLoaded', async () => {
  // If Supabase is available, sync token
  if (window.supabase) {
    try {
      const { data } = await window.supabase.auth.getSession();
      if (data.session) {
        window.AuthManager.setToken(data.session.access_token);
        window.AuthManager.setUserInfo({
          role: data.session.user?.user_metadata?.role,
          email: data.session.user?.email
        });
      }
    } catch (err) {
      console.error('Session sync error:', err);
    }
  }
});

// ============================================
// GLOBAL UI UTILITIES
// ============================================
(function () {
  // Header scroll effect
  const header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;
      if (currentScroll > 50) header.classList.add('header-scrolled');
      else header.classList.remove('header-scrolled');
    });
  }

  // Mobile menu controls (landing header style)
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const closeMenu = document.getElementById('close-menu');
  if (mobileMenuBtn && mobileMenu && closeMenu) {
    mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.add('open'));
    closeMenu.addEventListener('click', () => mobileMenu.classList.remove('open'));
    mobileMenu.querySelectorAll('a').forEach((link) =>
      link.addEventListener('click', () => mobileMenu.classList.remove('open'))
    );
  }

  // Sidebar toggle (dashboard-style)
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  // Animate counters when visible
  const animateCounter = (el, target, duration) => {
    let start = 0;
    const increment = target / (duration / 16);
    const update = () => {
      start += increment;
      if (start < target) {
        el.textContent = Math.floor(start).toLocaleString();
        requestAnimationFrame(update);
      } else {
        el.textContent = target.toLocaleString();
      }
    };
    update();
  };

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = parseInt(entry.target.getAttribute('data-target'));
          if (!isNaN(target)) animateCounter(entry.target, target, 2000);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  document.querySelectorAll('[data-target]').forEach((el) => counterObserver.observe(el));

  // Fade-up observer
  const fadeUpObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll('.fade-up').forEach((el) => fadeUpObserver.observe(el));

  // Smooth scroll for hash links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href && href !== '#') {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
})();
