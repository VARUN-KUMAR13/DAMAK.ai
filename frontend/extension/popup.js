let sessionId = null;

const setupView = document.getElementById('setup-view');
const activeView = document.getElementById('active-view');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const titleInput = document.getElementById('title');
const infoDiv = document.getElementById('session-info');

// Check current state
chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
  if (response && response.isCapturing) {
    showActive(response.sessionId, response.title);
  }
});

startBtn.addEventListener('click', async () => {
  const title = titleInput.value.trim() || 'Untitled Session';
  chrome.runtime.sendMessage({ type: 'START_SESSION', title }, (response) => {
    if (response && response.success) {
      showActive(response.sessionId, title);
    } else {
      alert('Failed to start session: ' + (response.error || 'Unknown error'));
    }
  });
});

stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_SESSION' }, (response) => {
    if (response && response.success) {
      showSetup();
    }
  });
});

function showActive(id, title) {
  sessionId = id;
  setupView.classList.add('hidden');
  activeView.classList.remove('hidden');
  infoDiv.textContent = `ID: ${id.substring(0, 8)}... | ${title}`;
}

function showSetup() {
  sessionId = null;
  setupView.classList.remove('hidden');
  activeView.classList.add('hidden');
}
