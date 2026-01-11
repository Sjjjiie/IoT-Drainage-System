from firebase_service import init_firebase, save_sensor_data
from manual_control import listen_manual_control

import json
import paho.mqtt.client as mqtt
import threading

# ===== MQTT CONFIG =====
MQTT_BROKER = "34.9.3.146"
MQTT_PORT = 1883
SENSOR_TOPIC = "FloodProject/sensors" 
CTRL_TOPIC   = "FloodProject/controllers"

# ===== GLOBAL MQTT CLIENT =====
mqtt_client = None

# ===== CALLBACK FOR SENSOR DATA =====
def on_message(client, userdata, msg):
    payload = msg.payload.decode()
    print(f"📥 Sensor data received: {payload}")

    try:
        data = json.loads(payload)

        # 1️⃣ Save sensor data (latest + historical)
        save_sensor_data(data)
        print("💾 Sensor data saved to Firebase")

    except Exception as e:
        print(f"❌ Error processing message: {e}")

# ===== MQTT CONNECT CALLBACK =====
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to MQTT broker")
        client.subscribe(SENSOR_TOPIC)
        print(f"📡 Subscribed to {SENSOR_TOPIC}")
    else:
        print(f"❌ MQTT connection failed with code {rc}")


# ===== START MQTT CLIENT =====
def start_mqtt():
    global mqtt_client

    mqtt_client = mqtt.Client(client_id="Backend_Controller")
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message

    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    return mqtt_client


# ===== MAIN =====
if __name__ == "__main__":
    print("🚀 Backend starting...")

    # 1️⃣ Initialize Firebase
    init_firebase()

    # 2️⃣ Start MQTT
    mqtt_client = start_mqtt()

    # 3️⃣ Start Firebase manual control listener (NON-BLOCKING)
    threading.Thread(
        target=listen_manual_control,
        args=(mqtt_client,),
        daemon=True
    ).start()
    print("🎮 Manual control listener started")

    try:
        mqtt_client.loop_forever()  # blocks and handles MQTT internally
    except KeyboardInterrupt:
        print("🛑 Backend stopped by user")