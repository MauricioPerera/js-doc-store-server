// js-doc-store Admin UI
// Vanilla JavaScript - No frameworks

const App = {
  // State
  apiUrl: localStorage.getItem('apiUrl') || '',
  token: localStorage.getItem('token') || '',
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  tables: [],
  currentTable: null,
  tableData: [],
  collections: [],
  darkMode: localStorage.getItem('darkMode') !== 'false',

  // DOM Elements
  elements: {},

  // Toast Notification System
  toast(type, title, message, duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  },

  // Skeleton loader helpers
  showSkeleton(container, count = 3, type = 'card') {
    container.innerHTML = Array(count).fill(0).map(() =>
      `<div class="card skeleton ${type === 'card' ? 'skeleton-card' : ''}">
        <div class="skeleton-text" style="width: 60%"></div>
        <div class="skeleton-text" style="width: 40%"></div>
      </div>`
    ).join('');
  },

  init() {
    this.cacheElements();
    this.bindEvents();
    this.loadTheme();

    // Check if already logged in
    if (this.token && this.apiUrl) {
      this.showDashboard();
      this.loadInitialData();
    }
  },

  cacheElements() {
    // Screens
    this.elements.loginScreen = document.getElementById('login-screen');
    this.elements.dashboardScreen = document.getElementById('dashboard-screen');

    // Login
    this.elements.apiUrl = document.getElementById('api-url');
    this.elements.email = document.getElementById('email');
    this.elements.password = document.getElementById('password');
    this.elements.btnLogin = document.getElementById('btn-login');
    this.elements.loginError = document.getElementById('login-error');

    // Navigation
    this.elements.navTabs = document.querySelectorAll('.nav-tab, .nav-item');
    this.elements.tabContents = document.querySelectorAll('.tab-content');
    this.elements.btnLogout = document.getElementById('btn-logout');
    this.elements.btnTheme = document.getElementById('btn-theme');
    this.elements.userName = document.getElementById('user-name');
    this.elements.userAvatar = document.getElementById('user-avatar');
    this.elements.userRole = document.getElementById('user-role');
    this.elements.breadcrumbCurrent = document.getElementById('breadcrumb-current');
    this.elements.tableCount = document.getElementById('table-count');

    // Tables Tab
    this.elements.tablesGrid = document.getElementById('tables-grid');
    this.elements.btnCreateTable = document.getElementById('btn-create-table');

    // Vector Tab
    this.elements.vectorQuery = document.getElementById('vector-query');
    this.elements.vectorCollection = document.getElementById('vector-collection');
    this.elements.vectorLimit = document.getElementById('vector-limit');
    this.elements.vectorType = document.getElementById('vector-type');
    this.elements.btnVectorSearch = document.getElementById('btn-vector-search');
    this.elements.vectorResults = document.getElementById('vector-results');
    this.elements.collectionsList = document.getElementById('collections-list');

    // Query Tab
    this.elements.queryTable = document.getElementById('query-table');
    this.elements.queryLimit = document.getElementById('query-limit');
    this.elements.queryFilter = document.getElementById('query-filter');
    this.elements.querySortField = document.getElementById('query-sort-field');
    this.elements.querySortOrder = document.getElementById('query-sort-order');
    this.elements.btnRunQuery = document.getElementById('btn-run-query');
    this.elements.queryResults = document.getElementById('query-results');

    // Settings Tab
    this.elements.settingsApiUrl = document.getElementById('settings-api-url');
    this.elements.settingsUser = document.getElementById('settings-user');
    this.elements.settingsRoles = document.getElementById('settings-roles');
    this.elements.btnToggleTheme = document.getElementById('btn-toggle-theme');

    // Modals
    this.elements.modalCreateTable = document.getElementById('modal-create-table');
    this.elements.modalTableView = document.getElementById('modal-table-view');
    this.elements.modalInsert = document.getElementById('modal-insert');
  },

  bindEvents() {
    // Login
    this.elements.btnLogin.addEventListener('click', () => this.login());
    this.elements.password.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.login();
    });

    // Navigation
    this.elements.navTabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    this.elements.btnLogout.addEventListener('click', () => this.logout());
    this.elements.btnTheme.addEventListener('click', () => this.toggleTheme());

    // Tables
    this.elements.btnCreateTable.addEventListener('click', () => this.openModal('modal-create-table'));

    // Vector Search
    this.elements.btnVectorSearch.addEventListener('click', () => this.vectorSearch());

    // Query
    this.elements.btnRunQuery.addEventListener('click', () => this.runQuery());

    // Settings
    this.elements.btnToggleTheme.addEventListener('click', () => this.toggleTheme());

    // Close modals on background click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal(modal.id);
      });
    });
  },

  // Theme
  loadTheme() {
    if (!this.darkMode) {
      document.documentElement.setAttribute('data-theme', 'light');
      this.elements.btnTheme.textContent = '☀️';
      this.elements.btnToggleTheme.textContent = 'Switch to Dark';
    }
  },

  toggleTheme() {
    this.darkMode = !this.darkMode;
    localStorage.setItem('darkMode', this.darkMode);

    if (this.darkMode) {
      document.documentElement.removeAttribute('data-theme');
      this.elements.btnTheme.textContent = '🌙';
      this.elements.btnToggleTheme.textContent = 'Switch to Light';
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      this.elements.btnTheme.textContent = '☀️';
      this.elements.btnToggleTheme.textContent = 'Switch to Dark';
    }
  },

  // API Helpers
  async apiCall(endpoint, options = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        ...options.headers
      },
      ...options
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      return { success: response.ok, status: response.status, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Authentication
  async login() {
    const apiUrl = this.elements.apiUrl.value.trim();
    const email = this.elements.email.value.trim();
    const password = this.elements.password.value;

    if (!apiUrl || !email || !password) {
      this.showLoginError('Please fill in all fields');
      return;
    }

    this.apiUrl = apiUrl.replace(/\/$/, '');

    const result = await this.apiCall('/auth/login', {
      method: 'POST',
      body: { email, password }
    });

    if (result.success && result.data.token) {
      this.token = result.data.token;
      this.user = result.data.user;
      localStorage.setItem('apiUrl', this.apiUrl);
      localStorage.setItem('token', this.token);
      localStorage.setItem('user', JSON.stringify(this.user));
      this.showDashboard();
      this.loadInitialData();
    } else {
      this.showLoginError(result.data?.message || 'Login failed');
    }
  },

  logout() {
    this.toast('info', 'Logged out', 'See you next time!');
    this.token = '';
    this.user = null;
    this.tables = [];
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.showLogin();
  },

  showLoginError(message) {
    this.elements.loginError.textContent = message;
    this.elements.loginError.classList.add('visible');
    setTimeout(() => {
      this.elements.loginError.classList.remove('visible');
    }, 5000);
  },

  // Navigation
  showLogin() {
    this.elements.loginScreen.classList.add('active');
    this.elements.dashboardScreen.classList.remove('active');
  },

  showDashboard() {
    this.elements.loginScreen.classList.remove('active');
    this.elements.dashboardScreen.classList.add('active');

    // Update settings
    this.elements.settingsApiUrl.textContent = this.apiUrl;
    if (this.user) {
      this.elements.settingsUser.textContent = this.user.email;
      this.elements.settingsRoles.textContent = this.user.roles?.join(', ') || 'user';

      // Update sidebar user info
      if (this.elements.userName) {
        this.elements.userName.textContent = this.user.email;
      }
      if (this.elements.userAvatar) {
        this.elements.userAvatar.textContent = this.user.email?.charAt(0).toUpperCase() || 'U';
      }
      if (this.elements.userRole) {
        const role = this.user.roles?.find(r => r === 'admin') || this.user.roles?.[0] || 'User';
        this.elements.userRole.textContent = role.charAt(0).toUpperCase() + role.slice(1);
      }
    }

    // Show toast
    this.toast('success', 'Welcome back!', `Logged in as ${this.user?.email}`);
  },

  switchTab(tabName) {
    // Update nav tabs
    this.elements.navTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab contents
    this.elements.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    // Update breadcrumb
    const tabNames = {
      tables: 'Tables',
      vectors: 'Vector Search',
      query: 'Query Builder',
      settings: 'Settings',
      help: 'Documentation'
    };
    if (this.elements.breadcrumbCurrent) {
      this.elements.breadcrumbCurrent.textContent = tabNames[tabName] || tabName;
    }

    // Load tab specific data
    if (tabName === 'tables') {
      this.loadTables();
    } else if (tabName === 'vectors') {
      this.loadCollections();
    } else if (tabName === 'query') {
      this.loadQueryTables();
    }
  },

  // Data Loading
  async loadInitialData() {
    await Promise.all([
      this.loadTables(),
      this.loadCollections()
    ]);
  },

  async loadTables() {
    const result = await this.apiCall('/admin/tables');

    if (result.success) {
      this.tables = result.data.tables || [];
      this.renderTables();
      this.updateQueryTables();
    } else {
      this.elements.tablesGrid.innerHTML = '<div class="empty-state">Error loading tables</div>';
    }
  },

  renderTables() {
    // Update sidebar badge
    if (this.elements.tableCount) {
      this.elements.tableCount.textContent = this.tables.length;
    }

    if (this.tables.length === 0) {
      this.elements.tablesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-title">No tables yet</div>
          <p class="empty-state-description">Create your first table to start storing data</p>
          <button class="btn btn-primary" onclick="App.openModal('modal-create-table')">
            + Create Table
          </button>
        </div>`;
      return;
    }

    this.elements.tablesGrid.innerHTML = this.tables.map((table, index) => `
      <div class="card card-hover" onclick="App.viewTable('${table}')">
        <div class="card-header">
          <div class="card-icon table-icon">📊</div>
          <div class="card-info">
            <div class="card-title">${table}</div>
            <div class="card-description">Click to view and manage data</div>
          </div>
        </div>
      </div>
    `).join('');
  },

  updateQueryTables() {
    const options = this.tables.map(t => `<option value="${t}">${t}</option>`).join('');
    this.elements.queryTable.innerHTML = '<option value="">Select table...</option>' + options;
  },

  // Collections
  async loadCollections() {
    const result = await this.apiCall('/admin/vector/collections');

    if (result.success) {
      this.collections = result.data.collections || [];
      this.renderCollections();
      this.updateVectorCollections();
    }
  },

  renderCollections() {
    if (this.collections.length === 0) {
      this.elements.collectionsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🧠</div>
          <div class="empty-state-title">No collections</div>
          <p class="empty-state-description">Vector collections will appear here once you start indexing</p>
        </div>`;
      return;
    }

    this.elements.collectionsList.innerHTML = this.collections.map(col => `
      <div class="card card-hover">
        <div class="card-header">
          <div class="card-icon collection-icon">🧠</div>
          <div class="card-info">
            <div class="card-title">${col.name}</div>
            <div class="card-description">${col.count} documents indexed</div>
          </div>
        </div>
        <div class="card-footer">
          <div class="card-stats">
            <div class="card-stat">
              <span>📝</span>
              <span class="card-stat-value">${col.count}</span>
              <span>docs</span>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  },

  updateVectorCollections() {
    const options = this.collections.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    this.elements.vectorCollection.innerHTML = '<option value="">All Collections</option>' + options;
  },

  // Vector Search
  async vectorSearch() {
    const query = this.elements.vectorQuery.value.trim();
    if (!query) return;

    const collection = this.elements.vectorCollection.value;
    const limit = parseInt(this.elements.vectorLimit.value) || 10;
    const type = this.elements.vectorType.value;

    this.elements.vectorResults.innerHTML = '<div class="loading">Searching...</div>';

    let result;
    if (type === 'hybrid') {
      result = await this.apiCall('/admin/vector/search-hybrid', {
        method: 'POST',
        body: {
          ...(collection && { collection }),
          query,
          limit
        }
      });
    } else {
      // Use search-by-text endpoint
      result = await this.apiCall('/admin/vector/search-by-text', {
        method: 'POST',
        body: {
          ...(collection && { collection }),
          query,
          limit
        }
      });
    }

    if (result.success) {
      this.renderVectorResults(result.data.results || []);
    } else {
      this.elements.vectorResults.innerHTML = '<div class="empty-state">Search failed</div>';
    }
  },

  renderVectorResults(results) {
    if (results.length === 0) {
      this.elements.vectorResults.innerHTML = '<div class="empty-state">No results found</div>';
      return;
    }

    this.elements.vectorResults.innerHTML = results.map(r => `
      <div class="result-card">
        <div class="result-header">
          <strong>ID: ${r.id}</strong>
          <span class="result-score">Score: ${(r.score * 100).toFixed(1)}%</span>
        </div>
        <div class="result-content">
          ${r.metadata ? `<pre>${JSON.stringify(r.metadata, null, 2)}</pre>` : 'No metadata'}
        </div>
      </div>
    `).join('');
  },

  // Query
  async runQuery() {
    const tableName = this.elements.queryTable.value;
    if (!tableName) {
      alert('Please select a table');
      return;
    }

    const limit = parseInt(this.elements.queryLimit.value) || 100;
    const filterText = this.elements.queryFilter.value.trim();
    const sortField = this.elements.querySortField.value.trim();
    const sortOrder = this.elements.querySortOrder.value;

    let filter = {};
    if (filterText) {
      try {
        filter = JSON.parse(filterText);
      } catch (e) {
        alert('Invalid JSON in filter');
        return;
      }
    }

    const body = { tableName, filter, limit };
    if (sortField) {
      body.sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };
    }

    this.elements.queryResults.innerHTML = '<div class="loading">Running query...</div>';

    const result = await this.apiCall('/admin/query', {
      method: 'POST',
      body
    });

    if (result.success) {
      this.renderQueryResults(result.data.data || []);
    } else {
      this.elements.queryResults.innerHTML = `<div class="empty-state">Query failed: ${result.data?.message || 'Unknown error'}</div>`;
    }
  },

  renderQueryResults(data) {
    if (data.length === 0) {
      this.elements.queryResults.innerHTML = '<div class="empty-state">No results</div>';
      return;
    }

    const columns = Object.keys(data[0]).filter(k => !k.startsWith('_'));

    let html = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${columns.map(col => `<th>${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                ${columns.map(col => `<td>${this.formatValue(row[col])}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 1rem; color: var(--text-secondary);">
        Showing ${data.length} results
      </div>
    `;

    this.elements.queryResults.innerHTML = html;
  },

  formatValue(value) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value).substring(0, 100);
    return String(value).substring(0, 100);
  },

  // Table View
  async viewTable(tableName) {
    this.currentTable = tableName;
    document.getElementById('view-table-name').textContent = tableName;
    this.openModal('modal-table-view');
    await this.loadTableData(tableName);
  },

  async loadTableData(tableName) {
    const container = document.getElementById('table-data-container');
    container.innerHTML = '<div class="loading">Loading data...</div>';

    const result = await this.apiCall('/admin/query', {
      method: 'POST',
      body: { tableName, filter: {}, limit: 1000 }
    });

    if (result.success) {
      this.tableData = result.data.data || [];
      this.renderTableData();
    } else {
      container.innerHTML = '<div class="empty-state">Failed to load data</div>';
    }
  },

  renderTableData() {
    const container = document.getElementById('table-data-container');

    if (this.tableData.length === 0) {
      container.innerHTML = '<div class="empty-state">No data in this table</div>';
      return;
    }

    const columns = Object.keys(this.tableData[0]);

    let html = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${columns.map(col => `<th>${col}</th>`).join('')}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.tableData.map((row, idx) => `
              <tr>
                ${columns.map(col => `<td>${this.formatValue(row[col])}</td>`).join('')}
                <td>
                  <button class="btn-secondary" onclick="App.editRow(${idx})">Edit</button>
                  <button class="btn-remove" onclick="App.deleteRow('${row._id}')">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
  },

  // Create Table
  addColumn() {
    const container = document.getElementById('columns-list');
    const row = document.createElement('div');
    row.className = 'column-row';
    row.innerHTML = `
      <input type="text" placeholder="Column name" class="col-name">
      <select class="col-type">
        <option value="text">text</option>
        <option value="number">number</option>
        <option value="select">select</option>
        <option value="multiselect">multiselect</option>
        <option value="checkbox">checkbox</option>
        <option value="email">email</option>
        <option value="url">url</option>
      </select>
      <button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(row);
  },

  async createTable() {
    const tableName = document.getElementById('new-table-name').value.trim();
    if (!tableName) {
      alert('Please enter a table name');
      return;
    }

    const columnRows = document.querySelectorAll('.column-row');
    const columns = [];

    columnRows.forEach(row => {
      const name = row.querySelector('.col-name').value.trim();
      const type = row.querySelector('.col-type').value;
      if (name) {
        columns.push({ name, type });
      }
    });

    if (columns.length === 0) {
      alert('Please add at least one column');
      return;
    }

    const result = await this.apiCall('/admin/create-table', {
      method: 'POST',
      body: { tableName, columns }
    });

    if (result.success) {
      this.closeModal('modal-create-table');
      this.loadTables();
      // Reset form
      document.getElementById('new-table-name').value = '';
      document.getElementById('columns-list').innerHTML = '';
    } else {
      alert('Failed to create table: ' + (result.data?.message || 'Unknown error'));
    }
  },

  // Insert/Edit
  showInsertModal() {
    if (!this.currentTable) return;

    document.getElementById('insert-title').textContent = `Insert into ${this.currentTable}`;
    const form = document.getElementById('insert-form');
    form.innerHTML = '';

    // Get schema from first row or use defaults
    const sampleRow = this.tableData[0] || {};
    const fields = Object.keys(sampleRow).filter(k => !k.startsWith('_') && k !== 'created' && k !== 'updated');

    fields.forEach(field => {
      const group = document.createElement('div');
      group.className = 'form-group';
      group.innerHTML = `
        <label>${field}</label>
        <input type="text" name="${field}" placeholder="Enter ${field}">
      `;
      form.appendChild(group);
    });

    this.openModal('modal-insert');
  },

  async saveData() {
    if (!this.currentTable) return;

    const form = document.getElementById('insert-form');
    const inputs = form.querySelectorAll('input');
    const data = {};

    inputs.forEach(input => {
      if (input.value) {
        data[input.name] = input.value;
      }
    });

    const result = await this.apiCall('/admin/insert', {
      method: 'POST',
      body: { tableName: this.currentTable, data }
    });

    if (result.success) {
      this.closeModal('modal-insert');
      this.loadTableData(this.currentTable);
    } else {
      alert('Failed to insert: ' + (result.data?.message || 'Unknown error'));
    }
  },

  editRow(index) {
    const row = this.tableData[index];
    // TODO: Implement edit functionality
    alert('Edit functionality coming soon! Row ID: ' + row._id);
  },

  async deleteRow(id) {
    if (!confirm('Are you sure you want to delete this record?')) return;

    const result = await this.apiCall('/admin/remove', {
      method: 'POST',
      body: { tableName: this.currentTable, filter: { _id: id } }
    });

    if (result.success) {
      this.loadTableData(this.currentTable);
    } else {
      alert('Failed to delete');
    }
  },

  // Modal Management
  openModal(modalId) {
    document.getElementById(modalId).classList.add('visible');
  },

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('visible');
  }
};

// Quick Login Helper
function quickLogin() {
  document.getElementById('email').value = 'admin@example.com';
  document.getElementById('password').value = 'Admin123!';
  App.login();
}

// Initialize App when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
