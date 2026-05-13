const TOKEN_KEY = 'agent-os-token';

const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');

let socket = null;

function showLogin(message) {
    loginOverlay.classList.add('visible');
    loginError.textContent = message || '';
}

function hideLogin() {
    loginOverlay.classList.remove('visible');
    loginError.textContent = '';
}

async function login(email, password) {
    const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
        throw new Error(data.message || `Login failed (HTTP ${res.status})`);
    }
    return data.token;
}

function logout(reason) {
    localStorage.removeItem(TOKEN_KEY);
    if (socket) { try { socket.close(); } catch {} socket = null; }
    showLogin(reason || '');
}

function connectSocket(token) {
    socket = io({ auth: { token } });
    bindSocketEvents(socket);
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    try {
        const token = await login(loginEmail.value.trim(), loginPassword.value);
        localStorage.setItem(TOKEN_KEY, token);
        hideLogin();
        connectSocket(token);
    } catch (err) {
        loginError.textContent = err.message;
    }
});

btnLogout?.addEventListener('click', () => logout('Signed out.'));

const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const btnSend = document.getElementById('btn-send');
const btnNewSession = document.getElementById('btn-new-session');
const sessionList = document.getElementById('session-list');
const skillsList = document.getElementById('skills-list');
const statusIndicator = document.getElementById('agent-status');

let currentMessageElement = null;
const toolCallElements = new Map(); // toolCallId -> DOM node

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatJson(value) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function clearWelcome() {
    const welcome = chatWindow.querySelector('.welcome-msg');
    if (welcome) welcome.remove();
}

function appendUserMessage(content) {
    clearWelcome();
    const div = document.createElement('div');
    div.className = 'message user-message';
    div.textContent = content;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function appendAgentMessageContainer() {
    clearWelcome();
    const div = document.createElement('div');
    div.className = 'message agent-message';
    div.textContent = '';
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}

function renderToolStart(event) {
    clearWelcome();
    const card = document.createElement('div');
    card.className = 'tool-card running';
    card.dataset.toolCallId = event.toolCallId || '';
    card.innerHTML = `
        <div class="tool-header">
            <span class="tool-spinner">⏳</span>
            <span class="tool-name">${escapeHtml(event.toolName)}</span>
            <span class="tool-status">running…</span>
            <button class="tool-toggle" type="button" aria-expanded="true">▾</button>
        </div>
        <div class="tool-body">
            <div class="tool-section">
                <div class="tool-section-label">arguments</div>
                <pre class="tool-args">${escapeHtml(formatJson(event.args ?? {}))}</pre>
            </div>
        </div>
    `;
    chatWindow.appendChild(card);
    const toggle = card.querySelector('.tool-toggle');
    toggle.addEventListener('click', () => {
        const collapsed = card.classList.toggle('collapsed');
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.textContent = collapsed ? '▸' : '▾';
    });
    chatWindow.scrollTop = chatWindow.scrollHeight;
    if (event.toolCallId) toolCallElements.set(event.toolCallId, card);
    return card;
}

function renderToolEnd(event) {
    const card = (event.toolCallId && toolCallElements.get(event.toolCallId))
        || chatWindow.querySelector('.tool-card.running:last-of-type');
    if (!card) return;

    card.classList.remove('running');
    card.classList.add(event.isError ? 'error' : 'success');

    const spinner = card.querySelector('.tool-spinner');
    if (spinner) spinner.textContent = event.isError ? '❌' : '✅';
    const status = card.querySelector('.tool-status');
    if (status) status.textContent = event.isError ? 'error' : 'ok';

    // Pull a short summary out of the tool result content[].text + details
    const result = event.result || {};
    const text = Array.isArray(result.content)
        ? result.content.map((c) => c.text || '').join('\n')
        : '';
    const body = card.querySelector('.tool-body');
    const resultSection = document.createElement('div');
    resultSection.className = 'tool-section';
    resultSection.innerHTML = `
        <div class="tool-section-label">result</div>
        <pre class="tool-result">${escapeHtml(text || formatJson(result))}</pre>
    `;
    body.appendChild(resultSection);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function sendMessage() {
    const text = userInput.value.trim();
    if (!text || !socket) return;
    appendUserMessage(text);
    userInput.value = '';
    statusIndicator.textContent = 'Thinking…';
    socket.emit('agent:prompt', { text });
}

function bindSocketEvents(sock) {
    sock.on('connect_error', (err) => {
        // socket.io middleware errors come through here. Treat anything that
        // mentions auth/forbidden as a credential problem and force re-login.
        const msg = err?.message || 'Connection failed';
        if (/unauthor|forbidden|token/i.test(msg)) {
            logout(msg);
        } else {
            statusIndicator.textContent = `Disconnected: ${msg}`;
        }
    });

    sock.on('agent:event', (event) => {
        if (event.type === 'message_update') {
            const ev = event.assistantMessageEvent;
            if (ev && ev.type === 'text_delta' && ev.delta) {
                if (!currentMessageElement) {
                    currentMessageElement = appendAgentMessageContainer();
                }
                currentMessageElement.textContent += ev.delta;
                chatWindow.scrollTop = chatWindow.scrollHeight;
            }
        } else if (event.type === 'tool_execution_start') {
            statusIndicator.textContent = `Running tool: ${event.toolName}…`;
            renderToolStart(event);
            currentMessageElement = null;
        } else if (event.type === 'tool_execution_end') {
            renderToolEnd(event);
            statusIndicator.textContent = 'Thinking…';
        } else if (event.type === 'message_end' || event.type === 'agent_end') {
            currentMessageElement = null;
            if (event.type === 'agent_end') {
                statusIndicator.textContent = 'Idle';
            }
        }
    });

    sock.on('agent:session:updated', ({ sessionId }) => {
        updateSessionList(sessionId);
    });

    sock.on('agent:error', ({ message }) => {
        const div = document.createElement('div');
        div.className = 'message error-message';
        div.textContent = `Error: ${message}`;
        chatWindow.appendChild(div);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        statusIndicator.textContent = 'Idle';
    });
}

function updateSessionList(activeId) {
    sessionList.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'session-item active';
    div.textContent = `Session ${activeId.substring(0, 8)}…`;
    sessionList.appendChild(div);
}

btnSend.onclick = sendMessage;
btnNewSession.onclick = () => {
    chatWindow.innerHTML = '';
    toolCallElements.clear();
    currentMessageElement = null;
    socket?.emit('agent:session:new');
};

userInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
};

// Boot: if we already have a token, try to connect with it; otherwise prompt.
(function boot() {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
        hideLogin();
        connectSocket(saved);
    } else {
        showLogin();
    }
})();
