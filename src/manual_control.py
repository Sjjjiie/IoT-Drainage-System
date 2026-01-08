import json
from firebase_admin import db

def listen_manual_control(mqtt_client):
    ref = db.reference("manual_control")

    def listener(event):
        # Ignore deletions
        if event.data is None:
            return

        # Ensure all keys exist to avoid backend errors
        payload = {
            "green": event.data.get("green", 0),
            "yellow": event.data.get("yellow", 0),
            "red": event.data.get("red", 0),
            "buzzer": event.data.get("buzzer", 0),
            "servoAngle": event.data.get("servoAngle", 0)
        }

        print("🎮 Manual control received:", payload)

        # Send to ESP32
        mqtt_client.publish(
            "FloodProject/controllers",
            json.dumps(payload)
        )
        print("📤 Manual control sent to ESP32")

    # Start listening
    ref.listen(listener)
