const API_BASE = 'http://localhost:8000/api/v1/live';
let sessionId = null;
let sessionTitle = '';
let isCapturing = false;
let screenshotInterval = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_STATE') {
    sendResponse({ isCapturing, sessionId, title: sessionTitle });
  } else if (request.type === 'START_SESSION') {
    startSession(request.title).then(sendResponse);
    return true; // async response
  } else if (request.type === 'STOP_SESSION') {
    stopSession().then(sendResponse);
    return true; // async response
  }
});

async function startSession(title) {
  try {
    const response = await fetch(`${API_BASE}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    const data = await response.json();
    
    if (data.session_id) {
      sessionId = data.session_id;
      sessionTitle = title;
      isCapturing = true;
      
      // 1. Start audio capture (via offscreen)
      await setupAudioCapture();
      
      // 2. Start periodic screenshots
      startScreenshots();
      
      return { success: true, sessionId };
    }
    return { success: false, error: 'No session ID returned' };
  } catch (err) {
    console.error('Failed to start session:', err);
    return { success: false, error: err.message };
  }
}

async function stopSession() {
  if (!sessionId) return { success: false };
  
  try {
    // 1. Stop screenshots
    if (screenshotInterval) clearInterval(screenshotInterval);
    
    // 2. Stop audio capture
    await chrome.offscreen.closeDocument();
    
    // 3. Stop session on backend
    const response = await fetch(`${API_BASE}/${sessionId}/stop`, {
      method: 'POST'
    });
    
    isCapturing = false;
    sessionId = null;
    return { success: true };
  } catch (err) {
    console.error('Failed to stop session:', err);
    return { success: false, error: err.message };
  }
}

async function setupAudioCapture() {
  // In MV3, tabCapture requires an offscreen document
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  
  // Check if offscreen doc already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  
  if (existingContexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['TAB_CAPTURE', 'AUDIO_PLAYBACK'],
      justification: 'Capture tab audio for AI lecture processing'
    });
  }
  
  // Get stream from current tab
  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id
  });
  
  // Send stream ID to offscreen doc
  chrome.runtime.sendMessage({
    type: 'START_RECORDING',
    target: 'offscreen',
    streamId,
    sessionId
  });
}

function startScreenshots() {
  // Capture every 5 seconds
  screenshotInterval = setInterval(async () => {
    if (!isCapturing || !sessionId) return;
    
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 });
      const blob = await (await fetch(dataUrl)).blob();
      
      const formData = new FormData();
      formData.append('file', blob, 'screenshot.jpg');
      formData.append('timestamp', (Date.now() / 1000).toString()); // Simple relative timestamp could be improved
      
      await fetch(`${API_BASE}/${sessionId}/upload-screenshot`, {
        method: 'POST',
        body: formData
      });
    } catch (err) {
      console.error('Screenshot upload failed:', err);
    }
  }, 5000);
}
