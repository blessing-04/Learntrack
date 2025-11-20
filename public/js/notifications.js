/**
 * Toast Notification System
 * Replaces window.alert() with beautiful, non-blocking notifications
 */

class NotificationSystem {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.init());
      } else {
        setTimeout(() => this.init(), 10);
      }
      return;
    }

    // Create notification container
    if (!document.getElementById('notification-container')) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      this.container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-md';
      this.container.style.cssText = 'pointer-events: none;';
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('notification-container');
    }
  }

  /**
   * Show a notification
   * @param {string} message - The message to display
   * @param {string} type - 'success', 'error', 'warning', 'info'
   * @param {number} duration - Duration in ms (0 = no auto-dismiss)
   */
  show(message, type = 'info', duration = 5000) {
    const notification = this.createNotification(message, type);
    this.container.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.classList.remove('translate-x-full', 'opacity-0');
      notification.classList.add('translate-x-0', 'opacity-100');
    }, 10);

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(notification);
      }, duration);
    }

    return notification;
  }

  createNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = 'pointer-events: auto;';
    
    const colors = {
      success: {
        bg: 'bg-green-600',
        border: 'border-green-700',
        text: 'text-white',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      },
      error: {
        bg: 'bg-red-600',
        border: 'border-red-700',
        text: 'text-white',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
      },
      warning: {
        bg: 'bg-orange-500',
        border: 'border-orange-600',
        text: 'text-white',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
      },
      info: {
        bg: 'bg-blue-600',
        border: 'border-blue-700',
        text: 'text-white',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
      }
    };

    const style = colors[type] || colors.info;
    
    notification.className = `
      ${style.bg} ${style.text} ${style.border}
      border-l-4 p-4 rounded-lg shadow-2xl
      transform translate-x-full opacity-0
      transition-all duration-300 ease-out
      flex items-start gap-3
      min-w-[320px] max-w-md
    `.trim().replace(/\s+/g, ' ');

    notification.innerHTML = `
      <div class="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm font-bold text-white text-lg">
        ${style.icon}
      </div>
      <div class="flex-1 text-sm font-semibold leading-relaxed">${this.escapeHtml(message)}</div>
      <button class="flex-shrink-0 ml-2 hover:opacity-70 transition-opacity text-xl leading-none text-white" onclick="window.Notifications.dismiss(this.parentElement)">
        ×
      </button>
    `;

    return notification;
  }

  dismiss(notification) {
    notification.classList.remove('translate-x-0', 'opacity-100');
    notification.classList.add('translate-x-full', 'opacity-0');
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.parentElement.removeChild(notification);
      }
    }, 300);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Convenience methods
  success(message, duration = 5000) {
    return this.show(message, 'success', duration);
  }

  error(message, duration = 7000) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration = 6000) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration = 5000) {
    return this.show(message, 'info', duration);
  }

  /**
   * Show a confirmation dialog
   * @param {string} message - The confirmation message
   * @param {Function} onConfirm - Callback when confirmed
   * @param {Function} onCancel - Callback when cancelled
   */
  async confirm(message, onConfirm, onCancel) {
    return new Promise((resolve) => {
      const modal = this.createConfirmModal(message, () => {
        this.removeConfirmModal(modal);
        if (onConfirm) onConfirm();
        resolve(true);
      }, () => {
        this.removeConfirmModal(modal);
        if (onCancel) onCancel();
        resolve(false);
      });
      
      document.body.appendChild(modal);
      
      // Animate in
      setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('.modal-content').classList.remove('scale-95');
        modal.querySelector('.modal-content').classList.add('scale-100');
      }, 10);
    });
  }

  createConfirmModal(message, onConfirm, onCancel) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 opacity-0 transition-opacity duration-200';
    
    modal.innerHTML = `
      <div class="modal-content bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform scale-95 transition-transform duration-200">
        <div class="flex items-start gap-4 mb-6">
          <div class="flex-shrink-0 w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-2xl">
            <span class="text-white">❓</span>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-bold text-gray-900 mb-2">Confirm Action</h3>
            <p class="text-gray-700 text-sm leading-relaxed">${this.escapeHtml(message)}</p>
          </div>
        </div>
        <div class="flex gap-3 justify-end">
          <button class="cancel-btn px-5 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button class="confirm-btn px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg transition-colors">
            Confirm
          </button>
        </div>
      </div>
    `;

    // Event listeners
    modal.querySelector('.confirm-btn').addEventListener('click', onConfirm);
    modal.querySelector('.cancel-btn').addEventListener('click', onCancel);
    
    // Click outside to cancel
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        onCancel();
      }
    });

    // ESC key to cancel
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        onCancel();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    return modal;
  }

  removeConfirmModal(modal) {
    modal.classList.add('opacity-0');
    modal.querySelector('.modal-content').classList.remove('scale-100');
    modal.querySelector('.modal-content').classList.add('scale-95');
    
    setTimeout(() => {
      if (modal.parentElement) {
        modal.parentElement.removeChild(modal);
      }
    }, 200);
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Create global instance
window.Notifications = new NotificationSystem();

// Override window.alert (optional, for backward compatibility)
// Uncomment if you want to automatically replace all alert() calls
/*
window.alert = function(message) {
  window.Notifications.info(message);
};
*/
