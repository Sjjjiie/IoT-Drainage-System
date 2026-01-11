import time
import firebase_admin
from firebase_admin import credentials, db
from config import DATABASE_URL, SERVICE_ACCOUNT_PATH

def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {
            "databaseURL": DATABASE_URL
        })
    print("✅ Firebase initialized")

def save_sensor_data(data):
    timestamp = int(time.time())

    # Save latest snapshot
    db.reference("latest").set({
        **data,
        "timestamp": timestamp
    })

    # Save historical record
    db.reference("sensor_readings").child(str(timestamp)).set(data)
