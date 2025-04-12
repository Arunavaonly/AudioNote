# AudioNote: Voice Transcription and Summarization App
AudioNote is a full-stack web application that allows users to record audio directly from their browser, transcribe the recorded audio using OpenAI’s Whisper, and then generate a summary of the transcription using Google Gemini AI. In addition, users can manage their notes by saving and viewing summarized content. The app offers a responsive design that works seamlessly on both desktop and mobile devices.

## Overview

- **Voice Recording:**  
  Users can record their voice with an intuitive interface. The browser captures audio and passes it to the backend for processing.
  
- **Transcription:**  
  The recorded audio is processed using OpenAI’s Whisper model for high-quality transcription, ensuring that your speech is accurately converted to text.
  
- **AI-Powered Summarization:**  
  Once the transcription is complete, the application leverages Google Gemini AI to generate a concise and coherent summary of the recorded content.
  
- **Note Management:**  
  After summarization, users have the option to save the summary as a note. These notes are stored locally and can be viewed, managed, or deleted, allowing for easy organization and retrieval.
  
- **User Interface:**  
  The frontend is built using HTML, CSS, and JavaScript. It provides real-time feedback during recording, visualizes audio segments, and clearly displays both the transcript and summary.

## Features

- **Real-time voice recording** directly from the browser.
- **Accurate transcription** using OpenAI’s Whisper.
- **AI-powered summarization** with Google Gemini AI.
- **Local note management** for saving and retrieving important summaries.
- **Responsive design** ensuring optimal use on all devices.
- **Segmented recording sessions** that allow for longer recordings by auto-splitting audio.

## Technology Stack

- **Frontend:** HTML, CSS, JavaScript.
- **Backend:** Python with Flask.
- **Transcription Engine:** OpenAI Whisper.
- **Summarization Engine:** Google Gemini AI.
- **Note Storage:** Local storage for managing notes.

## Installation

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Set up a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   - Create a `.env` file in the root directory.
   - Add:
     ```env
     GEMINI_API_KEY=<your_google_gemini_api_key>
     HF_API_KEY=<your_huggingface_api_key>
     ```

## Running Locally

1. Start the Flask server:
   ```bash
   python main.py
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

3. Grant microphone permissions when prompted, then record audio, transcribe, summarize, and manage your notes seamlessly!

## Project Structure

- **`main.py`**: Backend server that handles audio processing, transcription, and summarization.
- **`static/`**: Contains the frontend files.
  - `index.html`: Main user interface.
  - `styles.css`: Styling for a responsive, modern look.
  - `app.js`: Frontend logic handling recording, transcription processing, summary generation, and note management.
- **`requirements.txt`**: Python dependencies required for running the application.

## API Endpoints

- **`POST /processAudio`**: Accepts audio files and returns the transcription.
- **`POST /summarize`**: Accepts transcriptions and returns a generated summary.

## Deployment

Deploy the Flask application on platforms supporting Python (e.g., Google Cloud App Engine). Configure environment variables on your hosting service as specified above.

## License

This project is licensed under the MIT License.

## Acknowledgements

- OpenAI Whisper for transcription.
- Google Gemini AI for summarization.
- Thanks to the developers and contributors who helped build this project.