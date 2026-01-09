import json
import paho.mqtt.client as mqtt
from firebase_service import save_sensor_data

MQTT_BROKER = "34.9.3.146"
MQTT_PORT = 1883
MQTT_TOPIC = "FloodProject/sensors"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to MQTT Broker")
        client.subscribe(MQTT_TOPIC)
        print(f"📡 Subscribed to topic: {MQTT_TOPIC}")
    else:
        print(f"❌ MQTT connection failed with code {rc}")

def on_message(client, userdata, msg):
    payload = msg.payload.decode()
    print(f"📥 MQTT message received: {payload}")

    try:
        data = json.loads(payload)
        save_sensor_data(data)
    except Exception as e:
        print(f"❌ Processing error: {e}")

def start_mqtt():
    print("🔌 Starting MQTT client...")

    client = mqtt.Client(
        client_id="Backend_Controller",
        callback_api_version=mqtt.CallbackAPIVersion.VERSION1
    )

    client.on_connect = on_connect
    client.on_message = on_message

    print("🌐 Connecting to broker...")
    client.connect(MQTT_BROKER, MQTT_PORT, 60)

    # IMPORTANT
    client.loop_start()