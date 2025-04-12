document.addEventListener('DOMContentLoaded', () => {
    recreateNotesFromStorage();
    const script = document.createElement('script');


        // DOM elements
        const recordButton = document.getElementById('recordButton');
        //const recordButtonText = recordButton.querySelector('span');
        const recordButtonIcon = recordButton.querySelector('i');
        const processingStatus = document.getElementById('processingStatus');
        const errorMessage = document.getElementById('errorMessage');
        const transcriptionResult = document.getElementById('transcriptionResult');
        const summaryResult = document.getElementById('summaryResult');


        // Get the newly added elements
        const segmentTimeline = document.getElementById('segmentTimeline');
        const segmentTime = document.getElementById('segmentTime');
        const totalTime = document.getElementById('totalTime');
        const continueButton = document.getElementById('continueButton');
        const pauseButton = document.getElementById('pauseButton');
        const timerStatus = document.getElementById('timerStatus');
        const noteButton = document.getElementById('noteButton');
        const notes = document.getElementById('notes');
        const noteContent = document.getElementById('note-content');

        window.noteContent = noteContent;

        
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
        let isPaused = false;
        let mediaRecorder;
        let recordedChunks = [];
        let recordingTimer = null; // Timer for max recording duration
        
        // Smart Segments state
        let isLongRecordingSession = false; // Track if we're in a multi-segment session
        let segmentCount = 0;
        let totalRecordingSeconds = 0;
        let segmentSeconds = 0;
        let segmentTimer = null;
        let accumulatedTranscript = ""; // Store transcript across segments in client memory
        let segmentStream = null; // Store the media stream for reuse
        let summary =""; // Store the summary
        
        // Bind click events
        recordButton.addEventListener('click', toggleRecording);
        continueButton.addEventListener('click', continueRecording);
        pauseButton.addEventListener('click', pauseRecording);
        noteButton.addEventListener('click', createNote);
      
        
        function recreateNotesFromStorage() {
            const notesContainer = document.getElementById('notes');
            
            if (localStorage.length === 0) return; // No notes to display
            // Gather all keys that start with "note"

            const noteKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith("note")) {
                    noteKeys.push(key);
                }
            }
            
            // Sort keys in descending order by extracting the numeric part
            noteKeys.sort((a, b) => {
                const noteNumA = parseInt(a.replace("note", ""), 10);
                const noteNumB = parseInt(b.replace("note", ""), 10);
                return noteNumA - noteNumB;
            });
            
            // Clear the container first if needed
            notesContainer.innerHTML = '';
            
            // Loop over the sorted keys and create note elements
            noteKeys.forEach(key => {
                const noteNumber = key.replace("note", "");
                
                const noteElement = document.createElement('div');
                noteElement.className = 'note';
                noteElement.innerHTML = `
                    <div class="show-note" onclick="showNote(${noteNumber})">Note ${noteNumber}</div>
                    <div class="note-controls">
                        <button class="delete-note" onclick="deleteNote(${noteNumber})">Delete</button>
                    </div>
                `;
                notesContainer.appendChild(noteElement);
            });
        }        
        // Toggle recording
        function toggleRecording() {
            if (recordButton.hasAttribute('data-processing')) return;
            recordButton.setAttribute('data-processing','');
            
            if (isRecording) {
                stopRecording(false); // false = user initiated stop, not auto-segment
            } else {
                startRecording(false); // false = new recording, not continuing
            }
            
            setTimeout(() => recordButton.removeAttribute('data-processing'), 300);
        }

        // Pause recording
        function pauseRecording() {
            if (!isRecording || isPaused) return;
            
            // Update state
            isPaused = true;
            
            // Process current segment like auto-pause
            stopRecording(true); // true = auto/manual segment, not final stop
            
            // Update UI to show paused state
            recordButton.textContent = 'Recording Paused';
            recordButton.disabled = true;
            recordButtonIcon.classList.replace('fa-microphone','fa-pause');

            pauseButton.classList.add('hidden');
            continueButton.classList.remove('hidden');
        }

        // Continue recording after auto-pause or manual pause
        function continueRecording() {
            continueButton.classList.add('hidden');
            recordButton.textContent = 'Stop Recording';
            recordButton.disabled = false;
            recordButtonIcon.classList.replace('fa-pause','fa-microphone');
            
            
            // Clear auto-paused message if present
            if (timerStatus.classList.contains('auto-paused')) {
                timerStatus.classList.remove('auto-paused');
                timerStatus.textContent = 'Recording...';
            }
            
            // Reset pause state
            isPaused = false;
            
            // Continue recording
            startRecording(true); // true = continuing previous session
        }

        window.toggleRecording = toggleRecording;
      
        // Start recording
        async function startRecording(isContinuing = false) {
            isRecording = true;
            updateUIForRecording(true);
            
            // If starting a new recording session (not continuing)
            if (!isContinuing) {
                isLongRecordingSession = false;
                segmentCount = 0;
                totalRecordingSeconds = 0;
                accumulatedTranscript = "";
                transcriptionResult.textContent = 'Recording...';
                summaryResult.textContent = '';
                updateSegmentTimeline();
            } else {
                // We're continuing, so this is a long session
                isLongRecordingSession = true;
                addSegmentSeparator();
            }
            
            errorMessage.classList.add('hidden'); // Hide previous errors
            processingStatus.classList.add('hidden'); // Hide processing status

            try {
                // Get stream or reuse existing
                if (!segmentStream) {
                    segmentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                }
                
                // Always create a new MediaRecorder for each segment
                mediaRecorder = new MediaRecorder(segmentStream, { mimeType: 'audio/webm' });
                
                // Clear previous chunks
                recordedChunks = []; 
                
                // Reset segment seconds
                segmentSeconds = 0;
                
                // Show pause button when recording starts
                pauseButton.classList.remove('hidden');
                
                // Start segment timer
                segmentTimer = setInterval(() => {
                    segmentSeconds++;
                    totalRecordingSeconds++;
                    updateTimerDisplay();
                    
                    // Show timer status
                    if (!timerStatus.classList.contains('hidden')) {
                        timerStatus.textContent = 'Recording...';
                    }
                    
                    // Auto-pause warning when approaching 28 seconds
                    if (segmentSeconds >= 25 && segmentSeconds < 28) {
                        timerStatus.textContent = `Auto-pausing in ${28 - segmentSeconds} seconds...`;
                    }
                }, 1000);
                
                // Add ondataavailable handler
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        recordedChunks.push(event.data);
                        console.log(`Recorded chunk size: ${event.data.size}`);
                    } else {
                        console.log("Received empty data chunk.");
                    }
                };
                
                mediaRecorder.start(); // Start recording AFTER handlers are set
                
                mediaRecorder.onstart = () => {
                    console.log("Recording started");
                    // Set a timeout to stop recording at 28 seconds (just under 30s limit)
                    recordingTimer = setTimeout(() => {
                        console.log("Segment limit reached. Auto-stopping.");
                        
                        // Show auto-paused message
                        timerStatus.textContent = 'Auto-paused after 28 seconds';
                        timerStatus.classList.add('auto-paused');
                        timerStatus.classList.remove('hidden');
                        
                        // Auto-pause the recording
                        pauseRecording();
                    }, 28000); // 28 seconds
                };
                
                mediaRecorder.onstop = (event) => {
                    console.log("Recording stopped");
                    isRecording = false;
                    updateUIForRecording(false);
                    
                    // Clear interval timer
                    if (segmentTimer) {
                        clearInterval(segmentTimer);
                        segmentTimer = null;
                    }

                    // Create the final Blob and send it
                    if (recordedChunks.length > 0) {
                        processingStatus.classList.remove('hidden');
                        processingStatus.textContent = 'Processing audio...';
                        const finalBlob = new Blob(recordedChunks, { type: 'audio/webm' });
                        sendAudio(finalBlob);
                    } else {
                        console.warn("No chunks recorded.");
                        transcriptionResult.textContent = 'No audio was recorded.';
                    }
                    
                    // Clear chunks for the next recording
                    recordedChunks = [];
                    
                    // Clear the timeout timer
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
                
                // Reset session data on error
                resetRecordingSession();
                
                // Clear the timeout timer if an error occurred during startup
                if (recordingTimer) {
                    clearTimeout(recordingTimer);
                    recordingTimer = null;
                }
                if (segmentTimer) {
                    clearInterval(segmentTimer);
                    segmentTimer = null;
                }
            }
        }

        // Stop recording
        function stopRecording(isAutoSegment = false) {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                // If auto segment, increment count and update UI
                
                if (isAutoSegment) {
                    segmentCount++;
                    updateSegmentTimeline();
                } else {
                    // User manually stopped, end the long recording session
                    isLongRecordingSession = false;
                    
                    // Hide action buttons on complete stop
                    pauseButton.classList.add('hidden');
                    continueButton.classList.add('hidden');
                }
                
                mediaRecorder.stop(); // This will trigger the onstop event handler
            } else {
                console.log("Stop called but recorder not active.");
                // Cleanup timers
                if (recordingTimer) {
                    clearTimeout(recordingTimer);
                    recordingTimer = null;
                }
                if (segmentTimer) {
                    clearInterval(segmentTimer);
                    segmentTimer = null;
                }
            }
        }
        
        // Reset all recording session data
        function resetRecordingSession() {
            isLongRecordingSession = false;
            isPaused = false;
            segmentCount = 0;
            totalRecordingSeconds = 0;
            segmentSeconds = 0;
            accumulatedTranscript = "";
            
            // Release the media stream
            if (segmentStream) {
                segmentStream.getTracks().forEach(track => track.stop());
                segmentStream = null;
            }
            
            // Hide action buttons
            pauseButton.classList.add('hidden');
            continueButton.classList.add('hidden');

            
            // Reset UI
            updateSegmentTimeline();
            updateTimerDisplay();
            timerStatus.classList.add('hidden');
        }
        
        // Update timer displays
        function updateTimerDisplay() {
            segmentTime.textContent = formatTime(segmentSeconds);
            totalTime.textContent = formatTime(totalRecordingSeconds);
            
            // Show timer status
            timerStatus.classList.remove('hidden');
        }
        
        // Format seconds to MM:SS
        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        
        // Update segment timeline visualization
        function updateSegmentTimeline() {
            segmentTimeline.innerHTML = '';
            
            // Add completed segments
            for (let i = 0; i < segmentCount; i++) {
                const segment = document.createElement('div');
                segment.className = 'segment completed';
                segment.title = `Segment ${i+1}`;
                segmentTimeline.appendChild(segment);
            }
            
            // Add current segment if recording
            if (isRecording) {
                const currentSegment = document.createElement('div');
                currentSegment.className = 'segment current';
                currentSegment.title = `Current segment`;
                segmentTimeline.appendChild(currentSegment);
            }
        }
        
        // Add visual separator between segments in transcript
        function addSegmentSeparator() {
            if (transcriptionResult.textContent && transcriptionResult.textContent !== 'Recording...') {
                const separator = document.createElement('div');
                separator.className = 'segment-separator';
                separator.innerHTML = `<span class="segment-marker">Segment ${segmentCount+1}</span>`;
                transcriptionResult.appendChild(separator);
            }
        }
      
        // UI toggle for recording state
        function updateUIForRecording(on) {
            if (on) {
                recordButton.classList.add('recording');
                recordButton.textContent = 'Stop Recording';
                recordButtonIcon.classList.replace('fa-microphone','fa-stop');
                timerStatus.classList.remove('hidden');
                timerStatus.textContent = 'Recording...';
                recordButton.disabled = false;
                updateSegmentTimeline();
            } else {
                recordButton.classList.remove('recording');
                recordButton.textContent = 'Start Recording';
                recordButtonIcon.classList.replace('fa-stop','fa-microphone');
                timerStatus.classList.add('hidden');
                
                // If we're paused, keep the button disabled with paused text;
                // Otherwise, reset to "Start Recording"
                if (isPaused) {
                    recordButton.textContent = 'Recording Paused';
                    recordButton.disabled = true;
                } else {
                    recordButton.textContent = 'Start Recording';
                    recordButton.disabled = false;
        }

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
        async function sendAudio(audioBlob) {
            processingStatus.textContent = 'Uploading and processing...';
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
                    // Check if the transcript contains no meaningful speech
                    const transcript = data.transcript;
                    if (hasNoSpeech(transcript)) {
                        showNoSpeechMessage();
                        // If this is not part of a long recording session, reset
                        if (!isLongRecordingSession && !isPaused) {
                            resetRecordingSession();
                        }
                    } else {
                        // If this is part of a long recording session
                        if (isLongRecordingSession || isPaused) {
                            // Append the new transcript to accumulated transcript
                            accumulatedTranscript += (accumulatedTranscript ? " " : "") + transcript;
                            console.log(accumulatedTranscript);
                            
                            // Show the accumulated transcript
                            processData(accumulatedTranscript, null); // Don't show summary yet
                            
                            // Show continue button if paused
                            if (isPaused) {
                                continueButton.classList.remove('hidden');
                            }
                        } else {
                            // Single recording or final segment
                            accumulatedTranscript += (accumulatedTranscript ? " " : "") + transcript;
                            console.log(accumulatedTranscript);
                            const summary_response = await fetch(`${API_BASE_URL}/summarize`, {
                                method: 'POST',
                                headers: { 
                                    'Content-Type': 'application/json'},

                                body: JSON.stringify({ "transcript": accumulatedTranscript }),
                            });

                            const summary_data = await summary_response.json();
                            console.log(summary_data);

                            summary = summary_data.summary;

                            if (segmentCount > 0) {
                                // This was a multi-segment recording that's now complete
                                // Use the accumulated transcript + final segment
                                console.log("Finalizing multi-segment recording...");
                                processData(accumulatedTranscript, summary_data.summary);
                            } else {
                                // Normal single-segment processing
                                console.log("Finalizing single-segment recording...");
                                processData(transcript, summary_data.summary);
                            }
                            
                            // Reset session data
                            resetRecordingSession();
                        }
                    }
                }
            } catch (error) {
                console.error('Error:', error);
                showErrorMessage("Error processing audio. Please try again.");
            } finally {
                processingStatus.classList.add('hidden');
            }
        }
      
        // Function to detect if transcript indicates no speech was detected
        function hasNoSpeech(transcript) {
            if (!transcript || transcript.trim() === '') return true;
            
            // Common patterns that Whisper returns when there's no speech
            const noSpeechPatterns = [
                /^(\.+|\s+|\,+|um+|ah+|oh+|mm+)$/i,    // Just dots, commas, spaces, or filler sounds
                /^(background noise|silence|music|static|noise|inaudible|unclear)$/i, // Common placeholders
                /^(\[.*\]|\(.*\))$/i,  // Just annotations in brackets or parentheses
                /^\b(\w+)\b(?:\s+\1){4,}$/i, // Single word repeated 5+ times
                /^(\b\w+\b(?:\s+\b\w+\b)+)(?:\s+\1){4,}$/i, // Phrase repeated 5+ times
                /^thank you\.?$/i // "Thank you." as a regular expression
            ];
            
            // If transcript matches any of these patterns, consider as no speech
            for (const pattern of noSpeechPatterns) {
                if (pattern.test(transcript.trim())) {
                    console.log(`No speech detected (matched pattern): "${accumulatedTranscript}"`);
                    return true;
                }
            }
            
            // If transcript is extremely short (less than 4 meaningful characters), double-check
            if (transcript.replace(/[\s\.,\?\!\-\(\)\[\]]/g, '').length < 4) {
                console.log(`Possible no speech (very short): "${transcript}"`);
                return true;
            }
            
            return false;
        }

        // Show message that no speech was detected
        function showNoSpeechMessage() {
            const message = isPaused ? 
                "No speech detected in this segment. You can continue recording." : 
                "No speech detected. Please try speaking louder or checking your microphone.";
            
            // Create message element
            const noSpeechElement = document.createElement('div');
            noSpeechElement.className = 'no-speech-message';
            noSpeechElement.innerHTML = `
                <i class="fas fa-volume-mute"></i>
                <span>${message}</span>
            `;
            
            // If there's already a message, replace it
            const existingMessage = transcriptionResult.querySelector('.no-speech-message');
            if (existingMessage) {
                existingMessage.replaceWith(noSpeechElement);
            } 
            // Otherwise add it to the beginning of the transcript area
            else if (transcriptionResult.childNodes.length > 0) {
                if (transcriptionResult.firstChild.textContent === 'Recording...' ||
                    transcriptionResult.firstChild.textContent === 'Your transcription will appear here') {
                    transcriptionResult.innerHTML = '';
                }
                transcriptionResult.insertBefore(noSpeechElement, transcriptionResult.firstChild);
            }
            // Or replace the entire content
            else {
                transcriptionResult.innerHTML = '';
                transcriptionResult.appendChild(noSpeechElement);
            }
        }

        // Create a note from the summary

        function createNote() {
            const notenumber = localStorage.length +1;
            localStorage.setItem('note' + notenumber, summary); // Store the note in session storage
            console.log(localStorage.getItem('note' + notenumber));
            noteButton.classList.add('hidden');


            const noteElement = document.createElement('div');
            noteElement.className = 'note';
            noteElement.id = 'noteElement';
            noteElement.innerHTML = `
            <div class="show-note" onclick="showNote(${notenumber})">Note ${notenumber}</div>
            <div class="note-controls">
             <button class="delete-note" onclick="deleteNote(${notenumber})">Delete</button>
            </div>
        `;
            notes.appendChild(noteElement);
        }

        function deleteNote(noteNumber) {
            // Remove the note from local storage
            localStorage.removeItem('note' + noteNumber);
            console.log(`Note ${noteNumber} deleted`);

            // Remove the note element from the UI
            const noteElement = document.querySelector(`#notes .note:nth-child(${noteNumber})`);
            if (noteElement) {
                noteElement.remove();
            }
        }

        window.deleteNote = deleteNote;



        function showNote(noteNumber) {
            // Retrieve the note from session storage using the note number
            const noteData = localStorage.getItem('note' + noteNumber);
            
            // Display the note in a modal or alert (for simplicity, using alert here)
            if (noteData) {
                noteContent.textContent = noteData;
            } else {
                noteContent.textContent = `No note found for Note ${noteNumber}`;
            }

        };

        // Expose showNote globally, so inline event handlers can access it
        window.showNote = showNote;

      
        // Display response in UI
        function processData(transcript, summary) {
            if (transcript) {
                transcriptionResult.innerHTML = '';
                
                // Create segments from transcript
                const segments = transcript.split('\n').filter(line => line.trim());
                
                if (segments.length === 0) {
                    transcriptionResult.textContent = 'No transcript generated';
                    return;
                }
                
                // Add each segment as a paragraph
                segments.forEach((segment, index) => {
                    const p = document.createElement('p');
                    p.textContent = segment;
                    transcriptionResult.appendChild(p);
                });
            }
            
            if (summary) {
                summaryResult.innerHTML = '';
                
                // Create segments from summary
                const segments = summary.split('\n').filter(line => line.trim());
                
                if (segments.length === 0) {
                    summaryResult.textContent = 'No summary generated';
                    return;
                }
                
                // Add each segment as a paragraph
                segments.forEach((segment, index) => {
                    const p = document.createElement('p');
                    p.textContent = segment;
                    summaryResult.appendChild(p);
                });
                 noteButton.classList.remove('hidden');
            }
        }

    document.head.appendChild(script);
});

