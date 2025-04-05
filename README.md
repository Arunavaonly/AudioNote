# Voice Transcription and Summarization App

A web application that transcribes voice input from the user's microphone in real-time and provides a summary using Gemini AI.

## Features

- Real-time voice recording and transcription directly in the browser
- Client-side speech recognition using the Web Speech API
- Summarization of transcribed text using Gemini AI
- Responsive design that works on both desktop and mobile devices
- Clean, modern UI with intuitive controls

## Prerequisites

- Python 3.9 or higher
- Flask
- Google AI Python SDK
- Google Cloud Platform account (for deployment)

## Installation

1. Clone this repository:
   ```
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`:
     ```
     cp .env.example .env
     ```
   - Update the `.env` file with your Gemini API key
   - Copy `app.yaml.example` to `app.yaml`:
     ```
     cp app.yaml.example app.yaml
     ```
   - Update the `app.yaml` file with your App Engine configuration

## Running Locally

1. Start the Flask server:
   ```
   python main.py
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

3. Grant microphone permissions when prompted.

4. Click the "Start Recording" button and speak into your microphone.

5. Click "Stop Recording" when you're done, and wait for the summary to be generated.

## Deploying to Google Cloud App Engine

1. Make sure you have the Google Cloud SDK installed and initialized.

2. Set up environment variables in App Engine:
   - Go to the App Engine dashboard
   - Navigate to Settings > Environment Variables
   - Add your `GEMINI_API_KEY` and other environment variables

3. Deploy the application:
   ```
   gcloud app deploy app.yaml
   ```

4. Access your deployed application:
   ```
   gcloud app browse -s voice-transcription-summary
   ```

## Environment Variables

The following environment variables are required:

- `GEMINI_API_KEY`: Your Google Gemini API key
- `FLASK_ENV`: Development environment (development/production)
- `FLASK_DEBUG`: Debug mode (1/0)
- `PORT`: Server port (default: 5000)

## Mobile App Considerations

The current web application is designed to be responsive and mobile-friendly. To convert it to a native mobile app, you could use:

- **Progressive Web App (PWA)**: Add a manifest.json file and service workers to make the web app installable on mobile devices.
- **Hybrid App Framework**: Use Capacitor or Cordova to wrap the web app into a native container.
- **React Native**: Rebuild the UI using React Native while keeping the same API communication.

## Security Notes

- Never commit API keys or sensitive information to version control
- Use environment variables for all sensitive data
- Keep your `.env` and `app.yaml` files local and secure
- Use App Engine's environment variables for production deployment

## License

MIT

## Acknowledgements

- Google Gemini AI for text summarization
- Web Speech API for voice recognition 