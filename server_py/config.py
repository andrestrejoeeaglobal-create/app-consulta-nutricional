import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load env files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Try workspace root .env
root_env = os.path.join(BASE_DIR, "..", ".env")
# Try server .env
server_env = os.path.join(BASE_DIR, "..", "server", ".env")

if os.path.exists(root_env):
    load_dotenv(root_env)
elif os.path.exists(server_env):
    load_dotenv(server_env)
else:
    load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
