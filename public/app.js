// js-doc-store Admin UI - OPTIMIZED VERSION
const App = {
  // Estado
  currentTable: null,
  tableData: [],

  init() {
    // Theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);

    const token = localStorage.getItem('token');
    const apiUrl = localStorage.getItem('apiUrl');

    const loginScreen = document.getElementById('login-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');

    if (!loginScreen || !dashboardScreen) return;

    if (token && apiUrl) {
      loginScreen.classList.remove('active');
      dashboardScreen.classList.add('active');
      this.loadTables();
      this.updateUserInfo();
    } else {
      loginScreen.classList.add('active');
      dashboardScreen.classList.remove('active');
    }

    this.bindEvents();
  },

  bindEvents() {
    // Login
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) btnLogin.onclick = () => this.login();

    // Enter key en password
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
      passwordInput.onkeypress = (e) => {
        if (e.key === 'Enter') this.login();
      };
    }

    // Logout
    const logoutBtn = document.querySelector('.user-menu-btn');
    if (logoutBtn) logoutBtn.onclick = () => this.logout();

    // Navigation tabs - solo tabs existentes
    document.querySelectorAll('.nav-item').forEach(item => {
      item.onclick = () => {
        const tabName = item.dataset.tab;
        // Vector y Query son placeholders por ahora
        if (tabName === 'vectors' || tabName === 'query') {
          this.toast('info', 'Próximamente', 'Esta funcionalidad estará disponible pronto');
          return;
        }
        this.switchTab(tabName);
      };
    });

    // Theme
    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) themeBtn.onclick = () => this.toggleTheme();

    // Notifications (placeholder)
    const notifBtn = document.getElementById('btn-notifications');
    if (notifBtn) {
      notifBtn.onclick = () => {
        this.toast('info', 'Notificaciones', 'No hay notificaciones pendientes');
      };
    }

    // Create Table button - disabled con tooltip
    const createTableBtn = document.getElementById('btn-create-table');
    if (createTableBtn) {
      createTableBtn.onclick = () => {
        this.toast('info', 'Crear tabla', 'Usa la API o CLI para crear tablas');
      };
    }

    // Mobile menu toggle
    this.initMobileMenu();
  },

  initMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const topHeader = document.querySelector('.top-header');

    if (!sidebar || !mainContent || !topHeader) return;

    // Crear botón hamburguesa si no existe
    let menuToggle = document.querySelector('.menu-toggle');
    if (!menuToggle) {
      menuToggle = document.createElement('button');
      menuToggle.className = 'menu-toggle';
      menuToggle.innerHTML = '☰';
      menuToggle.setAttribute('aria-label', 'Toggle menu');
      menuToggle.onclick = () => {
        sidebar.classList.toggle('mobile-open');
      };
      topHeader.insertBefore(menuToggle, topHeader.firstChild);
    }
  },

  async login() {
    const apiUrlInput = document.getElementById('api-url');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorDiv = document.getElementById('login-error');

    const apiUrl = apiUrlInput?.value?.trim();
    const email = emailInput?.value?.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
      if (errorDiv) {
        errorDiv.textContent = 'Please fill in email and password';
        errorDiv.classList.add('visible');
        setTimeout(() => errorDiv.classList.remove('visible'), 5000);
      }
      return;
    }

    // Loading state
    const btnLogin = document.getElementById('btn-login');
    const originalText = btnLogin.innerHTML;
    btnLogin.disabled = true;
    btnLogin.innerHTML = '⏳ Signing in...';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(apiUrl + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('apiUrl', apiUrl);
        this.init();
        this.toast('success', 'Welcome!', `Logged in as ${email}`);
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (e) {
      if (errorDiv) {
        errorDiv.textContent = e.name === 'AbortError'
          ? 'Connection timeout. Please check the API URL.'
          : 'Error: ' + e.message;
        errorDiv.classList.add('visible');
        setTimeout(() => errorDiv.classList.remove('visible'), 5000);
      }
    } finally {
      btnLogin.disabled = false;
      btnLogin.innerHTML = originalText;
    }
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('apiUrl');
    this.init();
    this.toast('info', 'Logged out', 'See you next time!');
  },

  updateUserInfo() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const avatar = document.getElementById('user-avatar');
    const name = document.getElementById('user-name');
    const role = document.getElementById('user-role');
    const settingsUser = document.getElementById('settings-user');
    const settingsRoles = document.getElementById('settings-roles');
    const settingsApiUrl = document.getElementById('settings-api-url');

    if (avatar) avatar.textContent = (user.email || 'U').charAt(0).toUpperCase();
    if (name) name.textContent = user.email || 'User';
    if (role) role.textContent = (user.roles?.[0] || 'User').toUpperCase();
    if (settingsUser) settingsUser.textContent = user.email || '-';
    if (settingsRoles) settingsRoles.textContent = user.roles?.join(', ') || '-';
    if (settingsApiUrl) settingsApiUrl.textContent = localStorage.getItem('apiUrl') || '-';
  },

  switchTab(tabName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    // Update breadcrumb
    const breadcrumb = document.getElementById('breadcrumb-current');
    if (breadcrumb) {
      const names = { tables: 'Tables', settings: 'Settings', help: 'Documentation' };
      breadcrumb.textContent = names[tabName] || tabName;
    }

    // Load tab data
    if (tabName === 'tables') this.loadTables();
  },

  toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    this.updateThemeIcon(next);
  },

  updateThemeIcon(theme) {
    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
      themeBtn.textContent = theme === 'light' ? '🌙' : '☀️';
    }
  },

  async loadTables() {
    const token = localStorage.getItem('token');
    const apiUrl = localStorage.getItem('apiUrl');

    if (!token || !apiUrl) return;

    const tablesGrid = document.getElementById('tables-grid');
    const tableCount = document.getElementById('table-count');
    if (!tablesGrid) return;

    // Mostrar skeleton loading
    tablesGrid.innerHTML = `
      <div class="card skeleton skeleton-card"></div>
      <div class="card skeleton skeleton-card"></div>
      <div class="card skeleton skeleton-card"></div>
    `;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(apiUrl + '/admin/tables', {
        headers: { 'Authorization': 'Bearer ' + token },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.success && Array.isArray(data.tables)) {
        const tables = data.tables;
        if (tableCount) tableCount.textContent = tables.length;

        if (tables.length === 0) {
          tablesGrid.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">📊</div>
              <div class="empty-state-title">No tables yet</div>
              <p class="empty-state-description">Create your first table to start storing data</p>
              <button class="btn btn-primary" onclick="App.loadTables()" style="margin-top:1rem;">🔄 Reload</button>
            </div>
          `;
        } else {
          tablesGrid.innerHTML = tables.map(table => `
            <div class="card card-hover" onclick="App.viewTable('${table}')" style="cursor:pointer;">
              <div class="card-header">
                <div class="card-icon table-icon">📊</div>
                <div class="card-info">
                  <div class="card-title">${this.escapeHtml(table)}</div>
                  <div class="card-description">Click to view data</div>
                </div>
              </div>
            </div>
          `).join('');
        }
      } else {
        throw new Error(data.message || 'Failed to load tables');
      }
    } catch (e) {
      console.error('Error loading tables:', e);
      tablesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-title">Error loading tables</div>
          <p class="empty-state-description">${e.name === 'AbortError' ? 'Connection timeout' : e.message}</p>
          <button class="btn btn-primary" onclick="App.loadTables()" style="margin-top:1rem;">🔄 Retry</button>
        </div>
      `;
    }
  },

  viewTable(tableName) {
    this.currentTable = tableName;
    const modal = document.getElementById('modal-table-view');
    const title = document.getElementById('view-table-name');
    if (title) title.textContent = `Table: ${tableName}`;
    if (modal) modal.classList.add('visible');
    this.loadTableData(tableName);
  },

  async loadTableData(tableName) {
    const container = document.getElementById('table-data-container');
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading data...</div>';

    const token = localStorage.getItem('token');
    const apiUrl = localStorage.getItem('apiUrl');

    if (!token || !apiUrl) {
      container.innerHTML = '<div class="empty-state">Not authenticated</div>';
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(apiUrl + '/admin/query', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tableName, filter: {}, limit: 100 }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        this.tableData = data.data;
        this.renderTableData();
      } else {
        throw new Error(data.message || 'No data');
      }
    } catch (e) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-title">Error loading data</div>
          <p class="empty-state-description">${e.message}</p>
        </div>
      `;
    }
  },

  renderTableData() {
    const container = document.getElementById('table-data-container');
    if (!container || this.tableData.length === 0) {
      container.innerHTML = '<div class="empty-state">No data in this table</div>';
      return;
    }

    const columns = Object.keys(this.tableData[0]).filter(k => !k.startsWith('_'));
    const rows = this.tableData.slice(0, 100); // Limitar a 100 rows para performance

    let html = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${columns.map(col => `<th>${this.escapeHtml(col)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${columns.map(col => `<td>${this.escapeHtml(String(row[col] ?? ''))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${rows.length < this.tableData.length ? `<div style="padding:1rem;text-align:center;color:var(--text-secondary);">Showing ${rows.length} of ${this.tableData.length} rows</div>` : ''}
      </div>
    `;

    container.innerHTML = html;
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('visible');
  },

  // Util: Escape HTML para prevenir XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Toast notifications
  toast(type, title, message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const icon = icons[type] || 'ℹ️';

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <div class="toast-content">
        <div class="toast-title">${this.escapeHtml(title)}</div>
        <div class="toast-message">${this.escapeHtml(message)}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto-remove después de 5 segundos
    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }
};

// Quick login helper
function quickLogin() {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  if (emailInput) emailInput.value = 'admin@example.com';
  if (passwordInput) passwordInput.value = 'Admin123!';
  App.login();
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
