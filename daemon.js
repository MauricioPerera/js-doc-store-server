const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const SERVER_JS = path.join(__dirname, 'server.js');
const PID_FILE = path.join(__dirname, '.server.pid');
const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, '.server.log');

function isRunning() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}/public/tables`, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 404); // 404 si no hay tablas públicas, pero server responde
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

function startServer() {
  console.log('[daemon] Starting js-doc-store-server...');
  const out = fs.openSync(LOG_FILE, 'a');
  const err = fs.openSync(LOG_FILE, 'a');

  const proc = spawn('node', [SERVER_JS], {
    detached: true,
    stdio: ['ignore', out, err],
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'development' }
  });

  fs.writeFileSync(PID_FILE, String(proc.pid));
  proc.unref();
  console.log(`[daemon] Server started with PID ${proc.pid} → http://localhost:${PORT}`);
  console.log(`[daemon] Logs: ${LOG_FILE}`);
}

function stopServer() {
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`[daemon] Sent SIGTERM to PID ${pid}`);
    } catch (e) {
      console.log(`[daemon] Could not kill PID ${pid}: ${e.message}`);
    }
    fs.unlinkSync(PID_FILE);
  }
}

async function main() {
  const action = process.argv[2] || 'start';

  if (action === 'stop') {
    stopServer();
    return;
  }

  if (action === 'status') {
    const ok = await isRunning();
    console.log(ok ? '[daemon] Server is RUNNING ✅' : '[daemon] Server is STOPPED ❌');
    if (fs.existsSync(PID_FILE)) {
      console.log(`[daemon] PID file: ${fs.readFileSync(PID_FILE, 'utf8')}`);
    }
    return;
  }

  if (action === 'restart') {
    stopServer();
    await new Promise(r => setTimeout(r, 1000));
  }

  const running = await isRunning();
  if (running) {
    console.log('[daemon] Server already running ✅ → http://localhost:' + PORT);
    return;
  }

  startServer();
  // Esperar a que levante
  let attempts = 0;
  while (attempts < 10) {
    await new Promise(r => setTimeout(r, 800));
    if (await isRunning()) {
      console.log('[daemon] Server confirmed UP ✅');
      return;
    }
    attempts++;
  }
  console.log('[daemon] WARNING: Server may have failed to start. Check logs.');
}

main().catch(console.error);
