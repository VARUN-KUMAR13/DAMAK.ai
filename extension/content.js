let observer = null;
let lastText = "";
let lastSpeaker = "";
let chunkStartTime = 0;

// Meet uses specific class names for closed captions. These change occasionally.
// Currently, captions often appear in elements with class 'iTTPOb' or similar container 'a4cQT'
// A more robust approach is watching for role="alert" or aria-live elements, but Meet is tricky.
const CAPTION_CONTAINER_SELECTOR = '.a4cQT'; // Generic container for captions
const SPEAKER_SELECTOR = '.zs7s8d'; // Class for speaker name
const TEXT_SELECTOR = '.iTTPOb'; // Class for actual text snippet

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "START_OBSERVING") {
    startObserving();
  } else if (request.type === "STOP_OBSERVING") {
    stopObserving();
  }
});

function startObserving() {
  if (observer) return;

  console.log("DAMAK AI: Starting to observe closed captions...");
  
  // Create an observer instance linked to the callback function
  observer = new MutationObserver(handleMutations);

  // Start observing the document body for added nodes
  // In a real robust extension, we'd wait for the caption container to appear
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function stopObserving() {
  if (observer) {
    observer.disconnect();
    observer = null;
    console.log("DAMAK AI: Stopped observing closed captions.");
  }
}

function handleMutations(mutationsList) {
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Look for text elements
          const textElements = node.classList && (node.classList.contains('iTTPOb') || node.classList.contains('CNusmb'))
            ? [node] 
            : node.querySelectorAll ? node.querySelectorAll('.iTTPOb, .CNusmb') : [];
            
          textElements.forEach(textEl => {
            // Find speaker (usually a sibling or parent context)
            let speaker = "Speaker";
            const speakerContainer = textEl.closest('.a4cQT, .TBMuR');
            if (speakerContainer) {
               const speakerEl = speakerContainer.querySelector('.zs7s8d, .name');
               if (speakerEl) speaker = speakerEl.textContent.trim();
            }

            const text = textEl.textContent.trim();
            if (text && text !== lastText) {
              lastText = text;
              lastSpeaker = speaker;
              
              // We send chunks as they come in. Google Meet updates text iteratively.
              // We'll just send it. The backend combines them based on approx 50 words anyway.
              sendChunk(speaker, text);
            }
          });
        }
      });
    }
  }
}

function sendChunk(speaker, text) {
  chrome.runtime.sendMessage({
    type: "TRANSCRIPT_CHUNK",
    payload: {
      speaker: speaker,
      text: text,
      start_time: 0.0, // Simplification for now
      is_final: true
    }
  });
}
