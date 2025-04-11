document.addEventListener('DOMContentLoaded', () => {
    const script = document.createElement('script');


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
            if (config && config.apiUrl) {
                return config.apiUrl;
            }
            
            const host = window.location.hostname;
            if (window.location.protocol === 'file:') return 'http://localhost:5000';
            if ((host === 'localhost' || host === '127.0.0.1') && window.location.port !== '5000')
                return 'http://localhost:5000';
            return window.location.origin;
        })();
      
      
        // App state
        let isRecording = false;
        let mediaRecorder;
        let recordedChunks = [];
        let recordingTimer = null; // Timer for max recording duration
      
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

    window.toggleRecording = toggleRecording;
      
        // Start recording
        async function startRecording() {
            isRecording = true;
            updateUIForRecording(true);
            transcriptionResult.textContent = 'Recording...';
            summaryResult.textContent = '';
            errorMessage.classList.add('hidden'); // Hide previous errors
            processingStatus.classList.add('hidden'); // Hide processing status

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                
                // Clear previous chunks
                recordedChunks = []; 
                
                // --- Add ondataavailable handler back --- 
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        recordedChunks.push(event.data);
                        console.log(`Recorded chunk size: ${event.data.size}`); // Optional: log chunk size
                    } else {
                        console.log("Received empty data chunk.");
                    }
                };
                // --- End of added handler ---
                
                mediaRecorder.start(); // Start recording AFTER handlers are set
                mediaRecorder.onstart = () => {
                    console.log("Recording started");
                    // Set a timeout to stop recording after 5 minutes (300,000 ms)
                    recordingTimer = setTimeout(() => {
                        console.log("Max recording time reached. Stopping.");
                        stopRecording();
                    }, 29000); // 29 seconds
                  };
                
                
                mediaRecorder.onstop = (event) => {
                    console.log("Recording stopped");
                    isRecording = false;
                    updateUIForRecording(false);


                    // Create the final Blob and send it
                    if (recordedChunks.length > 0) {
                        processingStatus.classList.remove('hidden'); // Show processing status
                        processingStatus.textContent = 'Processing audio...';
                        const finalBlob = new Blob(recordedChunks, { type: 'audio/webm' });
                        sendAudio(finalBlob);
                    } else {
                        console.warn("No chunks recorded.");
                        transcriptionResult.textContent = 'No audio was recorded.';
                    }
                     // Clear chunks for the next recording
                    recordedChunks = [];
                     // Clear the timeout timer if it exists
                    if (recordingTimer) {
                        clearTimeout(recordingTimer);
                        recordingTimer = null;
                    }
                };
                
                }
            catch (err) {
                console.error(err);
                showErrorMessage("Error accessing microphone. Please check your permissions.");
                isRecording = false;
                updateUIForRecording(false);
                 // Clear the timeout timer if an error occurred during startup
                if (recordingTimer) {
                    clearTimeout(recordingTimer);
                    recordingTimer = null;
                }
            }
        }

    // Stop recording

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop(); // This will trigger the onstop event handler
            // No need to update UI or clear timer here, onstop handles it
        } else {
            console.log("Stop called but recorder not active.");
            // Manually clear timer if stop is called unexpectedly without recorder being active
            if (recordingTimer) {
                clearTimeout(recordingTimer);
                recordingTimer = null;
            }
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
      
        // Send audio for transcription
        async function sendAudio(audioBlob) { // Removed isFinal
            processingStatus.textContent = 'Uploading and processing...'; // Update status text
            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio.webm');

            try {
                const response = await fetch(`${API_BASE_URL}/processAudio`, {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();

                if (data.error) {
                    showErrorMessage(data.error);
                } else {
                    processData(data.transcript, data.summary);
                }
            } catch (error) {
                console.error('Error:', error);
                showErrorMessage("Error processing audio. Please try again.");
            } finally {
                 processingStatus.classList.add('hidden'); // Hide processing status regardless of outcome
            }
        }
      
      
        // Display response in UI
        function processData(transcript, summary) {
            if(summary) {
            summaryResult.innerHTML = summary
                .split('\n')
                .map(l => l.trim() ? `<p>${l}</p>` : '<br>')
                .join('') || 'No summary generated';
                
        }
        if(transcript) {
            transcriptionResult.innerHTML = transcript
                .split('\n')
                .map(l => l.trim() ? `<p>${l}</p>` : '<br>')
                .join('') || 'No transcript generated';
        }
        };

    document.head.appendChild(script);
});

