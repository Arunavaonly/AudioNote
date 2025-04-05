from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
import os
from dotenv import load_dotenv

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
if not API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is not set")


@app.route("/")
def index():
    # Serves static/index.html
    return app.send_static_file("index.html")


@app.route('/summarize', methods=['POST', 'OPTIONS'])
def summarize():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response
        
    data = request.get_json()
    text = data.get('text', '').strip()
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
    
    try:
        client = genai.Client(api_key=API_KEY)

        response = client.models.generate_content(
            model="gemini-2.5-pro-exp-03-25",
            contents=["Summarize the following text. Text: " + text]
        )
        
        summary = response.text or "Sorry, I couldn't generate a summary."
        return jsonify({"summary": summary})
    
    except Exception as e:
        app.logger.error(f"Error generating summary: {str(e)}")
        return jsonify({"error": f"Failed to generate summary: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))


