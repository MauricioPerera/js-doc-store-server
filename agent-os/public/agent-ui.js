const socket = io();

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
    if (!text) return;
    appendUserMessage(text);
    userInput.value = '';
    statusIndicator.textContent = 'Thinking…';
    socket.emit('agent:prompt', { text });
}

socket.on('agent:event', (event) => {
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
        // Tool output goes in a new bubble after — close the current text bubble.
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

socket.on('agent:session:updated', ({ sessionId }) => {
    updateSessionList(sessionId);
});

socket.on('agent:error', ({ message }) => {
    const div = document.createElement('div');
    div.className = 'message error-message';
    div.textContent = `Error: ${message}`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    statusIndicator.textContent = 'Idle';
});

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
    socket.emit('agent:session:new');
};

userInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
};
