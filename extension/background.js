let isCapturing = false;
let activeSessionId = null;
let targetTabId = null;
const API_URL = "http://127.0.0.1:8000/api/v1/meetings";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_STATUS") {
    sendResponse({ isCapturing, sessionId: activeSessionId });
    return true;
  }

  if (request.type === "START_CAPTURE") {
    handleStartCapture(request.tabId)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (request.type === "STOP_CAPTURE") {
    handleStopCapture()
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === "TRANSCRIPT_CHUNK") {
    if (isCapturing && activeSessionId) {
      sendTranscriptChunk(request.payload);
    }
  }

  if (request.type === "SIMULATE_CHUNK") {
    if (isCapturing && activeSessionId) {
      sendTranscriptChunk({
        speaker: "Test Speaker",
        text: "This is a simulated sentence generated directly from the extension to prove the API connection works perfectly! " + new Date().toLocaleTimeString(),
        start_time: 0.0,
        is_final: true
      });
    }
  }
});

async function handleStartCapture(tabId) {
  if (isCapturing) return { success: true };

  try {
    // 1. Notify Backend to start meeting
    const title = `Google Meet ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const response = await fetch(`${API_URL}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title, platform: "Meet" })
    });

    if (!response.ok) {
      throw new Error("Backend failed to start meeting");
    }

    const data = await response.json();
    activeSessionId = data.session_id;
    isCapturing = true;
    targetTabId = tabId;

    // 2. Inject script into the active tab
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"]
    });

    // 3. Tell content script to start observing
    chrome.tabs.sendMessage(tabId, { type: "START_OBSERVING" });

    return { success: true, sessionId: activeSessionId };
  } catch (err) {
    console.error("Start capture error:", err);
    throw err;
  }
}

async function handleStopCapture() {
  if (!isCapturing) return { success: true };

  try {
    // Tell content script to stop
    if (targetTabId) {
      chrome.tabs.sendMessage(targetTabId, { type: "STOP_OBSERVING" }).catch(() => {});
    }

    // Tell Backend to end meeting
    if (activeSessionId) {
      await fetch(`${API_URL}/${activeSessionId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
    }

    isCapturing = false;
    activeSessionId = null;
    targetTabId = null;

    return { success: true };
  } catch (err) {
    console.error("Stop capture error:", err);
    
    // Force stop locally anyway
    isCapturing = false;
    activeSessionId = null;
    targetTabId = null;
    
    throw err;
  }
}

async function sendTranscriptChunk(payload) {
  try {
    await fetch(`${API_URL}/${activeSessionId}/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("Failed to send chunk:", err);
  }
}
