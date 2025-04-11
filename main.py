from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
import os
import base64
import json
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='static')

# Configure CORS to allow all origins
CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

# Get API key from environment variable
API_KEY = os.environ.get("GEMINI_API_KEY")
HF_API_KEY = os.environ.get("HF_API_KEY")

if not API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is not set")

if not HF_API_KEY:
    raise ValueError("HF_API_KEY environment variable is not set")



@app.route("/")
def index():
    # Serves static/index.html
    return app.send_static_file("index.html")


@app.route('/processAudio', methods=['POST', 'OPTIONS'])
def processAudio():
    try:
        if request.method == 'OPTIONS':
            return app.make_default_options_response()

        audio_file = request.files.get('audio')
        if audio_file is None:
            return jsonify({"error": "No audio file provided"}), 400
        
        if audio_file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        try:
            # --- Read audio file content into memory as bytes --- 
            print("Reading audio file into memory...")
            audio_bytes = audio_file.read()
            print(f"Read {len(audio_bytes)} bytes from audio file.")
            if not audio_bytes:
                 return jsonify({"error": "Audio file is empty"}), 400
            # --- End reading into memory ---

            client = InferenceClient(
                provider="hf-inference",
                api_key= HF_API_KEY  # Ensure correct env var name
            )

            output = client.automatic_speech_recognition(audio_bytes, model="openai/whisper-large-v3")
            transcript_text = output.get('text', '').strip()
            print(output)
            print(f"Processed Transcript: {transcript_text}")

            if not transcript_text:
                 print("Whisper returned empty transcript.")
                 response_payload = {"transcript": "", "summary": "No text transcribed to summarize."}
            else:
                 response_payload = {"transcript": transcript_text}
                 print("Summarizing transcript...")
                 gemini_client = genai.Client(api_key=API_KEY)
                 gen_response = gemini_client.models.generate_content(
                     model="gemini-1.5-flash", # Or your preferred model
                     contents=["Summarize the following text. Text: " + transcript_text],
                 )
                 summary = gen_response.text or "Sorry, I couldn't generate a summary."
                 response_payload["summary"] = summary
                 print("Summarization complete.")

            # No finally block needed here for file cleanup anymore
            
        except Exception as inner_e:
            # Log the inner exception for debugging
            app.logger.exception(f"Error during ASR/Summarization: {str(inner_e)}")
            return jsonify({"error": f"Failed during processing: {str(inner_e)}"}), 500

        return jsonify(response_payload)

    except Exception as outer_e:
        # Log the outer exception (e.g., reading file failed)
        app.logger.exception(f"Error processing audio request: {str(outer_e)}")
        return jsonify({"error": f"Failed to process audio request: {str(outer_e)}"}), 500


if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))


