#include <WiFi.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>

/* ================= WIFI ================= */
const char* WIFI_SSID     = "connecting";
const char* WIFI_PASSWORD = "gotpassword";

/* ================= MQTT ================= */
const char* MQTT_SERVER = "34.9.3.146";
const int   MQTT_PORT   = 1883;

const char* MQTT_SENSOR_TOPIC = "FloodProject/sensors";
const char* MQTT_CTRL_TOPIC   = "FloodProject/controllers";

/* ================= SENSORS ================= */
const int RAIN_PIN = 34; // Rain sensor
const int FLOW_PIN = 33; // Flow sensor
volatile unsigned long pulseCount = 0;

#define TRIG_PIN 25 // Ultrasonic
#define ECHO_PIN 26

/* ================= ACTUATORS ================= */
#define GREEN  19
#define YELLOW 18
#define RED    5

#define BUZZER_PIN 14
const int SERVO_PIN = 17;
Servo gateServo;

/* ================= CLIENTS ================= */
WiFiClient espClient;
PubSubClient client(espClient);

/* ================= TIMERS ================= */
unsigned long previousSensorMillis = 0;
const long sensorInterval = 5000; // Publish every 5 seconds

/* ================= FLOW SENSOR ACCUMULATOR ================= */
unsigned long flowAccumulator = 0;

/* ================= BUZZER ================= */
unsigned long buzzerStart = 0;
bool buzzerActive = false;

/* ================= FLOW INTERRUPT ================= */
void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

/* ================= WIFI ================= */
void setupWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi connected");
  Serial.println(WiFi.localIP());
}

/* ================= BUZZER HANDLER ================= */
void handleBuzzer(bool activate) {
  if (activate && !buzzerActive) {
    digitalWrite(BUZZER_PIN, HIGH);
    buzzerStart = millis();
    buzzerActive = true;
  }

  if (buzzerActive && millis() - buzzerStart >= 300) {
    digitalWrite(BUZZER_PIN, LOW);
    buzzerActive = false;
  }
}

/* ================= MQTT CALLBACK ================= */
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  payload[length] = '\0';
  String msg = String((char*)payload);
  Serial.print("📥 Controller message: ");
  Serial.println(msg);

  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, msg);
  if (error) {
    Serial.println("❌ JSON parse failed");
    return;
  }

  // LEDs
  digitalWrite(GREEN,  doc["green"]  | 0);
  digitalWrite(YELLOW, doc["yellow"] | 0);
  digitalWrite(RED,    doc["red"]    | 0);

  // Servo mapping 
  int servoState = doc["servoAngle"].as<int>(); // expecting 0,1,2,3 
  int angle = 0; 
  switch (servoState) { 
    case 0: angle = 0; break; 
    case 1: angle = 60; break;
    case 2: angle = 120; break;
    case 3: angle = 180; break;
    default: angle = 0; break; 
  } 
  Serial.print("➡️ Servo state received: "); 
  Serial.print(servoState); 
  Serial.print(" → angle: "); 
  Serial.println(angle); 
  gateServo.write(angle);

  // Buzzer
  handleBuzzer(doc["buzzer"] == 1);
}

/* ================= MQTT CONNECT ================= */
void connectMQTT() {
  while (!client.connected()) {
    Serial.print("🔌 Connecting to MQTT...");
    if (client.connect("ESP32_Flood")) {
      Serial.println(" ✅ Connected");
      client.subscribe(MQTT_CTRL_TOPIC);
      Serial.println("📡 Subscribed to controller topic");
    } else {
      Serial.print(" ❌ Failed, rc=");
      Serial.print(client.state());
      Serial.println(" retrying...");
      delay(5000);
    }
  }
}

/* ================= SENSOR READINGS ================= */
int readRainSensor() {
  int count = 0;
  for (int i = 0; i < 10; i++) {
    if (digitalRead(RAIN_PIN) == LOW) count++;
    delay(10); // small delay for debouncing
  }
  return (count >= 5) ? 1 : 0;
}

unsigned long getFlowPulses() {
  noInterrupts();
  unsigned long pulses = flowAccumulator + pulseCount;
  pulseCount = 0;
  flowAccumulator = 0; // reset accumulator
  interrupts();
  return pulses;
}

long readWaterLevel() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  long distance = duration * 0.034 / 2;
  return (distance == 0) ? -1 : distance;
}

/* ================= SETUP ================= */
void setup() {
  Serial.begin(115200);
  Serial.println("=== ESP32 Flood Sensor Node ===");

  // Sensors
  pinMode(RAIN_PIN, INPUT);
  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseCounter, FALLING);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // Actuators
  pinMode(GREEN, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // Servo with explicit pulse range
  gateServo.attach(SERVO_PIN, 500, 2400);

  // WiFi + MQTT
  setupWiFi();
  client.setServer(MQTT_SERVER, MQTT_PORT);
  client.setCallback(mqttCallback);
}

/* ================= LOOP ================= */
void loop() {
  // Always process MQTT to respond to actuators quickly
  if (!client.connected()) connectMQTT();
  client.loop();

  // Accumulate flow pulses
  noInterrupts();
  flowAccumulator += pulseCount;
  pulseCount = 0;
  interrupts();

  // Handle non-blocking buzzer
  handleBuzzer(buzzerActive);

  // Publish sensor data every 5 seconds
  unsigned long currentMillis = millis();
  if (currentMillis - previousSensorMillis >= sensorInterval) {
    previousSensorMillis = currentMillis;

    int rain = readRainSensor();
    unsigned long flow = getFlowPulses();
    long water = readWaterLevel();

    String payload = "{";
    payload += "\"rain\":" + String(rain) + ",";
    payload += "\"flowPulses\":" + String(flow) + ",";
    payload += "\"waterLevel\":" + String(water);
    payload += "}";

    Serial.println("📤 Sensor data:");
    Serial.println(payload);

    client.publish(MQTT_SENSOR_TOPIC, payload.c_str());
  }

  delay(10); // small delay to prevent watchdog reset
}
