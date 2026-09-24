import os
import firebase_admin
from firebase_admin import credentials, firestore, auth
from app.config import settings

# Prevent re-initialization if the app reloads
if not firebase_admin._apps:
    cred_path = os.path.abspath(settings.FIREBASE_CREDENTIALS_PATH)
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

# Firestore database instance
db = firestore.client()

def get_db():
    """Dependency helper to get the Firestore client."""
    return db