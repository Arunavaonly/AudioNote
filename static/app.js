document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const recordButton = document.getElementById('recordButton');
    const recordButtonText = recordButton.querySelector('span');
    const recordButtonIcon = recordButton.querySelector('i');
    const recordingStatus = document.getElementById('recordingStatus');
    const processingStatus = document.getElementById('processingStatus');
    const errorMessage = document.getElementById('errorMessage');
    const transcriptionResult = document.getElementById('transcriptionResult');
    const summaryResult = document.getElementById('summaryResult');
  
    // API base URL logic
    const API_BASE_URL = (() => {
        // Use configured URL if available
        if (config && config.apiUrl) {
            return config.apiUrl;
        }
        
        // Otherwise use automatic detection
        const host = window.location.hostname;
        if (window.location.protocol === 'file:') return 'http://localhost:5000';
        if ((host === 'localhost' || host === '127.0.0.1') && window.location.port !== '5000')
            return 'http://localhost:5000';
        return window.location.origin;
    })();
  
    // SpeechRecognition setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Speech recognition not supported—use Chrome, Edge, or Safari.');
        recordButton.disabled = true;
        return;
    }
    
    // Create recognition instance
    let recognition = null;
  
    // App state
    let isRecording = false;
    let transcriptText = '';
  
    // Only bind click event
    recordButton.addEventListener('click', toggleRecording);
  
    // Toggle recording
    function toggleRecording() {
        if (recordButton.hasAttribute('data-processing')) return;
        recordButton.setAttribute('data-processing','');
        
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
        
        setTimeout(() => recordButton.removeAttribute('data-processing'), 300);
    }
  
    // Start recording
    function startRecording() {
        // Clear any previous error messages
        hideErrorMessage();
        
        // Reset transcript and UI
        transcriptText = '';
        transcriptionResult.textContent = '';
        summaryResult.textContent = 'Your summary will appear here';
        
        // Create new recognition instance each time
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 3;
        
        // Set up event handlers
        setupRecognitionHandlers();
        
        // Start recording
        isRecording = true;
        updateUIForRecording(true);
        
        try { 
            recognition.start();
        } catch (e) {
            console.error(e);
            isRecording = false;
            updateUIForRecording(false);
            showErrorMessage('Could not start speech recognition');
        }
    }
    
    // Setup handlers for this recognition instance
    function setupRecognitionHandlers() {
        // When recognition starts
        recognition.onstart = () => {
            console.log('Speech recognition started');
        };
        
        // When recognition ends
        recognition.onend = () => {
            console.log('Speech recognition ended');
            
            // If we still think we're recording, it ended unexpectedly
            if (isRecording) {
                isRecording = false;
                updateUIForRecording(false);
                showErrorMessage('Speech recognition ended unexpectedly');
            } else if (transcriptText.trim().length > 10) {
                // If we have meaningful transcript, process it
                processingStatus.classList.remove('hidden');
                sendTranscriptionForSummary(transcriptText);
            }
        };
        
        // Process results
        recognition.onresult = event => {
            let interim = '', finalPart = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const t = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalPart += t + ' ';
                    transcriptText += t + ' ';
                } else {
                    interim += t;
                }
            }
            
            transcriptionResult.innerHTML = `
                <div>${transcriptText}</div>
                <div class="interim">${interim}</div>
            `;
            transcriptionResult.scrollTop = transcriptionResult.scrollHeight;
        };
        
        // Handle errors
        recognition.onerror = e => {
            console.warn('Recognition error:', e.error);
            
            // For all error types - stop recording and show appropriate message
            isRecording = false;
            updateUIForRecording(false);
            
            // Show different messages based on error type
            switch(e.error) {
                case 'no-speech':
                    showErrorMessage('No speech detected. Please try again.');
                    break;
                case 'aborted':
                    showErrorMessage('Speech recognition was aborted.');
                    break;
                case 'network':
                    showErrorMessage('Network error occurred. Please check your connection.');
                    break;
                case 'not-allowed':
                    showErrorMessage('Microphone access is required. Please allow access when prompted.');
                    break;
                case 'service-not-allowed':
                    showErrorMessage('Speech recognition service not allowed. Please try again later.');
                    break;
                case 'bad-grammar':
                    showErrorMessage('Speech recognition grammar error.');
                    break;
                case 'language-not-supported':
                    showErrorMessage('The language is not supported.');
                    break;
                default:
                    showErrorMessage(`An error occurred: ${e.error}`);
            }
        };
    }
  
    // Stop recording
    function stopRecording() {
        isRecording = false;
        updateUIForRecording(false);
        
        try { 
            if (recognition) {
                recognition.stop();
            }
        } catch (error) {
            console.error('Error stopping recognition:', error);
        }
    }
  
    // UI toggle for recording state
    function updateUIForRecording(on) {
        if (on) {
            recordButton.classList.add('recording');
            recordButtonText.textContent = 'Stop Recording';
            recordButtonIcon.classList.replace('fa-microphone','fa-stop');
            recordingStatus.classList.remove('hidden');
        } else {
            recordButton.classList.remove('recording');
            recordButtonText.textContent = 'Start Recording';
            recordButtonIcon.classList.replace('fa-stop','fa-microphone');
            recordingStatus.classList.add('hidden');
        }
    }
    
    // Show error message in UI
    function showErrorMessage(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            hideErrorMessage();
        }, 5000);
    }
    
    // Hide error message
    function hideErrorMessage() {
        errorMessage.classList.add('hidden');
        errorMessage.textContent = '';
    }
  
    // Send to backend & disable button while processing
    async function sendTranscriptionForSummary(text) {
        recordButton.disabled = true;
        processingStatus.classList.remove('hidden');
        
        try {
            const res = await fetch(`${API_BASE_URL}/summarize`, {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                mode: 'cors',
                body: JSON.stringify({ text })
            });
            
            if (!res.ok) throw new Error(res.statusText || 'Server error');
            
            const { summary } = await res.json();
            displaySummary(summary);
        } catch (err) {
            console.error(err);
            summaryResult.innerHTML = `<div class="error">Error: ${err.message}</div>`;
            addRetrySummaryButton();
        } finally {
            processingStatus.classList.add('hidden');
            recordButton.disabled = false;
        }
    }
  
    // Add retry button for failed summaries
    function addRetrySummaryButton() {
        if (document.getElementById('retrySummaryButton')) return;
        
        const btn = document.createElement('button');
        btn.id = 'retrySummaryButton';
        btn.className = 'btn retry-btn';
        btn.innerHTML = '<i class="fas fa-redo"></i><span>Retry</span>';
        btn.onclick = () => {
            processingStatus.classList.remove('hidden');
            summaryResult.textContent = 'Retrying…';
            sendTranscriptionForSummary(transcriptText);
        };
        
        document.getElementById('summaryControls').appendChild(btn);
    }
  
    // Display summary in UI
    function displaySummary(summary) {
        summaryResult.innerHTML = summary
            .split('\n')
            .map(l => l.trim() ? `<p>${l}</p>` : '<br>')
            .join('') || 'No summary generated';
            
        const retry = document.getElementById('retrySummaryButton');
        if (retry) retry.remove();
    }
});