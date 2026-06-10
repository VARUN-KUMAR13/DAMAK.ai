document.addEventListener('DOMContentLoaded', async () => {
  const btnToggle = document.getElementById('btnToggle');
  const btnSimulate = document.getElementById('btnSimulate');
  const btnDashboard = document.getElementById('btnDashboard');
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');
  const errorMsg = document.getElementById('errorMsg');

  // Check current status from background script
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
    if (response) {
      updateUI(response.isCapturing);
    }
  });

  function updateUI(isCapturing) {
    if (isCapturing) {
      btnToggle.textContent = 'Stop Capture';
      btnToggle.className = 'btn-stop';
      statusText.textContent = 'Capturing';
      statusText.style.color = '#f97316';
      statusDot.classList.add('active');
      btnSimulate.style.display = 'block';
    } else {
      btnToggle.textContent = 'Start Capture';
      btnToggle.className = 'btn-start';
      statusText.textContent = 'Idle';
      statusText.style.color = '#ffffff';
      statusDot.classList.remove('active');
      btnSimulate.style.display = 'none';
    }
    errorMsg.textContent = '';
  }

  btnSimulate.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: "SIMULATE_CHUNK" });
    errorMsg.textContent = "Test text sent!";
    errorMsg.style.color = '#4ade80';
    setTimeout(() => { errorMsg.textContent = ''; errorMsg.style.color = '#ef4444'; }, 2000);
  });

  btnToggle.addEventListener('click', async () => {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes("meet.google.com")) {
      errorMsg.textContent = "Please navigate to Google Meet to start capture.";
      return;
    }

    const isStarting = btnToggle.textContent === 'Start Capture';
    
    if (isStarting) {
      btnToggle.textContent = 'Starting...';
      btnToggle.disabled = true;
      
      chrome.runtime.sendMessage({ type: "START_CAPTURE", tabId: tab.id }, (response) => {
        btnToggle.disabled = false;
        if (response && response.success) {
          updateUI(true);
        } else {
          updateUI(false);
          errorMsg.textContent = response?.error || "Failed to start capture";
        }
      });
    } else {
      btnToggle.textContent = 'Stopping...';
      btnToggle.disabled = true;
      
      chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }, (response) => {
        btnToggle.disabled = false;
        updateUI(false);
        if (response && !response.success) {
          errorMsg.textContent = response?.error || "Failed to stop capture properly";
        }
      });
    }
  });

  btnDashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: "http://localhost:3000" });
  });
});
