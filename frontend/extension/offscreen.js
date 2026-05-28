const API_BASE = 'http://localhost:8000/api/v1/live';
let mediaRecorder = null;
let sessionId = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== 'offscreen') return;
  
  if (message.type === 'START_RECORDING') {
    startRecording(message.streamId, message.sessionId);
  }
});

async function startRecording(streamId, id) {
  sessionId = id;
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    });
    
    // Play audio so user can still hear it
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(audioContext.destination);
    
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    
    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && sessionId) {
        const formData = new FormData();
        formData.append('file', event.data, 'chunk.webm');
        
        try {
          await fetch(`${API_BASE}/${sessionId}/upload-audio`, {
            method: 'POST',
            body: formData
          });
        } catch (err) {
          console.error('Audio chunk upload failed:', err);
        }
      }
    };
    
    // Request data every 3 seconds
    mediaRecorder.start(3000);
    
  } catch (err) {
    console.error('Failed to start audio recording:', err);
  }
}
