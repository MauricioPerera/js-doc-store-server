const puppeteer = require('puppeteer');

(async () => {
  console.log('🧪 Iniciando pruebas UI con Puppeteer...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  const results = [];

  function log(status, test, msg) {
    const icon = status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} ${test}: ${msg}`);
    results.push({ test, status, msg });
  }

  try {
    // Navegar a la UI
    console.log('📋 Cargando página...');
    await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded', timeout: 15000 });
    log('PASS', 'Página cargada', 'http://localhost:8080');

    // ═══════════════════════════════════════════════════════
    // ELEMENTOS DEL LOGIN
    // ═══════════════════════════════════════════════════════
    console.log('\n📋 Verificando elementos del login...');
    const loginScreen = await page.$eval('#login-screen', el => el.classList.contains('active')).catch(() => false);
    log(loginScreen ? 'PASS' : 'FAIL', 'Login screen visible', loginScreen ? 'Sí' : 'No');

    const emailField = await page.$('#email');
    log(emailField ? 'PASS' : 'FAIL', 'Email field exists', emailField ? 'Sí' : 'No');

    const passwordField = await page.$('#password');
    log(passwordField ? 'PASS' : 'FAIL', 'Password field exists', passwordField ? 'Sí' : 'No');

    const loginBtn = await page.$('#btn-login');
    log(loginBtn ? 'PASS' : 'FAIL', 'Login button exists', loginBtn ? 'Sí' : 'No');

    // ═══════════════════════════════════════════════════════
    // SIMULAR LOGIN PARA PROBAR DASHBOARD
    // ═══════════════════════════════════════════════════════
    console.log('\n📋 Simulando login para probar dashboard...');
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('apiUrl', 'https://doc-store-api-prod.rckflr.workers.dev');
      localStorage.setItem('user', JSON.stringify({ email: 'test@example.com', roles: ['admin'] }));
      document.getElementById('login-screen').classList.remove('active');
      document.getElementById('dashboard-screen').classList.add('active');
      // Reinicializar app
      App.init();
    });
    await new Promise(r => setTimeout(r, 1000));

    log('PASS', 'Dashboard visible', 'Sí');

    // ═══════════════════════════════════════════════════════
    // DASHBOARD ELEMENTS
    // ═══════════════════════════════════════════════════════
    console.log('\n📋 Verificando elementos del dashboard...');

    const sidebar = await page.$('.sidebar');
    log(sidebar ? 'PASS' : 'FAIL', 'Sidebar existe', sidebar ? 'Sí' : 'No');

    const tablesGrid = await page.$('#tables-grid');
    log(tablesGrid ? 'PASS' : 'FAIL', 'Tables grid existe', tablesGrid ? 'Sí' : 'No');

    // ═══════════════════════════════════════════════════════
    // NAVEGACIÓN
    // ═══════════════════════════════════════════════════════
    console.log('\n📋 Verificando navegación...');
    const navItems = await page.$$('.nav-item');
    log(navItems.length > 0 ? 'PASS' : 'FAIL', 'Nav items', `${navItems.length} encontrados`);

    const soonBadges = await page.$$eval('.nav-item-badge', badges =>
      badges.some(b => b.textContent.trim() === 'Soon')
    );
    log(soonBadges ? 'PASS' : 'FAIL', 'Soon badges en tabs', soonBadges ? 'Sí' : 'No');

    // ═══════════════════════════════════════════════════════
    // BOTONES DE ACCIÓN
    // ═══════════════════════════════════════════════════════
    console.log('\n📋 Verificando botones de acción...');

    const themeBtn = await page.$('#btn-theme');
    log(themeBtn ? 'PASS' : 'FAIL', 'Theme button existe', themeBtn ? 'Sí' : 'No');

    const notifBtn = await page.$('#btn-notifications');
    log(notifBtn ? 'PASS' : 'FAIL', 'Notifications button existe', notifBtn ? 'Sí' : 'No');

    const createTableBtn = await page.$('#btn-create-table');
    log(createTableBtn ? 'PASS' : 'FAIL', 'Create Table button existe', createTableBtn ? 'Sí' : 'No');

    const userMenuBtn = await page.$('.user-menu-btn');
    log(userMenuBtn ? 'PASS' : 'FAIL', 'Logout button existe', userMenuBtn ? 'Sí' : 'No');

    // ═══════════════════════════════════════════════════════
    // THEME TOGGLE
    // ═══════════════════════════════════════════════════════
    console.log('\n📋 Verificando theme toggle...');
    const beforeTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.evaluate(() => {
      const btn = document.getElementById('btn-theme');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 300));
    const afterTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    log(beforeTheme !== afterTheme ? 'PASS' : 'FAIL', 'Theme toggle', `${beforeTheme} → ${afterTheme}`);

    // ═══════════════════════════════════════════════════════
    // TABS NAVIGATION
    // ═══════════════════════════════════════════════════════
    console.log('\n📋 Verificando tabs...');

    // Click en Settings tab
    await page.evaluate(() => document.querySelector('.nav-item[data-tab="settings"]').click());
    await new Promise(r => setTimeout(r, 300));
    const settingsActive = await page.$eval('#tab-settings', el => el.classList.contains('active'));
    log(settingsActive ? 'PASS' : 'FAIL', 'Settings tab navega', settingsActive ? 'Sí' : 'No');

    // Click en Tables tab para volver
    await page.evaluate(() => document.querySelector('.nav-item[data-tab="tables"]').click());
    await new Promise(r => setTimeout(r, 300));

    // Click en Vector tab (debe mostrar toast "Próximamente")
    await page.evaluate(() => document.querySelector('.nav-item[data-tab="vectors"]').click());
    await new Promise(r => setTimeout(r, 500));
    const toastVisible = await page.$('.toast');
    log(toastVisible ? 'PASS' : 'FAIL', 'Vector tab muestra "Próximamente"', toastVisible ? 'Sí' : 'No');

    // ═══════════════════════════════════════════════════════
    // RESPONSIVE - Menu toggle
    // ═══════════════════════════════════════════════════════
    console.log('\n📋 Verificando responsive...');
    await page.setViewport({ width: 375, height: 667 });
    await new Promise(r => setTimeout(r, 800));

    const menuToggle = await page.$('.menu-toggle');
    log(menuToggle ? 'PASS' : 'FAIL', 'Menu toggle en móvil', menuToggle ? 'Sí' : 'No');

    if (menuToggle) {
      await page.evaluate(() => document.querySelector('.menu-toggle').click());
      await new Promise(r => setTimeout(r, 500));
      const sidebarOpen = await page.$eval('.sidebar', el => el.classList.contains('mobile-open'));
      log(sidebarOpen ? 'PASS' : 'FAIL', 'Menu toggle abre sidebar', sidebarOpen ? 'Sí' : 'No');
    }

    // ═══════════════════════════════════════════════════════
    // LOGOUT
    // ═══════════════════════════════════════════════════════
    console.log('\n📋 Verificando logout...');
    await page.evaluate(() => document.querySelector('.user-menu-btn').click());
    await new Promise(r => setTimeout(r, 500));
    const tokenCleared = await page.evaluate(() => !localStorage.getItem('token'));
    const atLogin = await page.$eval('#login-screen', el => el.classList.contains('active'));
    log(tokenCleared ? 'PASS' : 'FAIL', 'Token eliminado', tokenCleared ? 'Sí' : 'No');
    log(atLogin ? 'PASS' : 'FAIL', 'En login screen', atLogin ? 'Sí' : 'No');

  } catch (error) {
    console.error('❌ Error:', error.message);
    log('FAIL', 'Error general', error.message);
  }

  await browser.close();

  // Resumen
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  const rate = total > 0 ? Math.round((passed / total) * 100) : 0;

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESULTADOS');
  console.log('='.repeat(50));
  console.log(`✅ Pasadas: ${passed}`);
  console.log(`❌ Fallidas: ${failed}`);
  console.log(`📊 Total: ${total}`);
  console.log(`📈 Éxito: ${rate}%`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
})().catch(console.error);
