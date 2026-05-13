const socket = io();

const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const btnSend = document.getElementById('btn-send');
const btnNewSession = document.getElementById('btn-new-session');
const sessionList = document.getElementById('session-list');
const skillsList = document.getElementById('skills-list');
const statusIndicator = document.getElementById('agent-status');

let currentMessageElement = null;

// Handle Sending
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // UI: Add user message
    appendMessage('user', text);
    userInput.value = '';
    
    // Socket: Prompt Agent
    socket.emit('agent:prompt', { text });
}

function appendMessage(role, content) {
    if (role === 'user') {
        const div = document.createElement('div');
        div.className = 'message user-message';
        div.textContent = content;
        chatWindow.appendChild(div);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        return div;
    } else {
        const div = document.createElement('div');
        div.className = 'message agent-message';
        div.textContent = '';
        chatWindow.appendChild(div);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        return div;
    }
}

// Socket Events
socket.on('agent:event', (event) => {
    if (event.type === 'message_update') {
        const ev = event.assistantMessageEvent;
        // Only text_delta carries user-visible streaming text. thinking_delta
        // exists but belongs to the model's reasoning, not the reply body.
        if (ev && ev.type === 'text_delta' && ev.delta) {
            if (!currentMessageElement) {
                currentMessageElement = appendMessage('agent', '');
            }
            currentMessageElement.textContent += ev.delta;
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }
    }

    if (event.type === 'tool_execution_start') {
        statusIndicator.textContent = `Agent is executing tool: ${event.toolName}...`;
        const toolDiv = document.createElement('div');
        toolDiv.className = 'tool-call';
        toolDiv.textContent = `⚙️ Calling ${event.toolName}...`;
        chatWindow.appendChild(toolDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    if (event.type === 'tool_execution_end') {
        statusIndicator.textContent = 'Idle';
        const lastTool = chatWindow.querySelector('.tool-call:last-child');
        if (lastTool) {
            lastTool.textContent += event.isError ? ' ❌ Error' : ' ✅ Success';
        }
    }

    if (event.type === 'message_end' || event.type === 'agent_end') {
        currentMessageElement = null;
        statusIndicator.textContent = 'Idle';
    }
});

socket.on('agent:session:updated', ({ sessionId }) => {
    updateSessionList(sessionId);
});

socket.on('agent:error', ({ message }) => {
    alert(`Agent Error: ${message}`);
});

function updateSessionList(activeId) {
    sessionList.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'session-item active';
    div.textContent = `Session ${activeId.substring(0, 8)}...`;
    sessionList.appendChild(div);
}

// Event Listeners
btnSend.onclick = sendMessage;
btnNewSession.onclick = () => socket.emit('agent:session:new');

userInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
};
