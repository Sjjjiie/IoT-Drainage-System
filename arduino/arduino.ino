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
#define SERVO_PIN 17
Servo gateServo;

/* ================= CLIENTS ================= */
WiFiClient espClient;
PubSubClient client(espClient);

/* ================= TIMERS ================= */
unsigned long previousSensorMillis = 0;
const long sensorInterval = 5000; // Publish sensor data every 5 seconds

unsigned long lastBeep = 0;
const long beepInterval = 500;
bool buzzerState = false;

/* ================= FLOW SENSOR ACCUMULATOR ================= */
unsigned long flowAccumulator = 0;

/* ================= STRUCT ================= */
struct Outputs {
  int green;
  int yellow;
  int red;
  int servoAngle;
  int buzzer;
};

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
  unsigned long now = millis();
  if (activate) {
    if (now - lastBeep >= beepInterval) {
      buzzerState = !buzzerState;
      digitalWrite(BUZZER_PIN, buzzerState);
      lastBeep = now;
    }
  } else {
    digitalWrite(BUZZER_PIN, LOW);
    buzzerState = false;
  }
}

/* ================= SENSOR READINGS ================= */
int readRainSensor() {
  return analogRead(RAIN_PIN); // 0 = wet, 4095 = dry
}

String getRainStatus(int rainVal) {
  if (rainVal <= 1500) return "HEAVY";
  if (rainVal <= 3500) return "LIGHT";
  return "DRY";
}

unsigned long getFlowPulses() {
  noInterrupts();
  unsigned long pulses = flowAccumulator + pulseCount;
  pulseCount = 0;
  flowAccumulator = 0;
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

/* ================= DECISION LOGIC ================= */
String determineStatus(int rain, unsigned long flow, long level) {
  // 1. DANGER: Highest Priority (High Water OR Blockage)
  if (level <= 15 || (rain <= 3500 && flow < 5 && level <= 30)) {
    return "DANGER";
  }

  // 2. ALERT: Moderate Priority (Rising Water OR Any Rain)
  if (level <= 30 && rain <= 3500) {
    return "ALERT";
  }
  // 3. SAFE: Default state
  return "SAFE";
}

/* ================= ACTUATORS CONTROL ================= */
Outputs controlOutputs(String status) {
  Outputs out = {0,0,0,0,0};

  if (status == "SAFE") {
    digitalWrite(GREEN,HIGH);
    digitalWrite(YELLOW,LOW);
    digitalWrite(RED,LOW);
    gateServo.write(0);
    handleBuzzer(false);
    out.green = 1; out.servoAngle = 0; out.buzzer = 0;
  } 
  else if (status == "ALERT") {
    digitalWrite(GREEN,LOW);
    digitalWrite(YELLOW,HIGH);
    digitalWrite(RED,LOW);
    gateServo.write(0);
    handleBuzzer(true);
    out.yellow = 1; out.servoAngle = 0; out.buzzer = 1;
  } 
  else { // DANGER
    digitalWrite(GREEN,LOW);
    digitalWrite(YELLOW,LOW);
    digitalWrite(RED,HIGH);
    gateServo.write(180);
    handleBuzzer(true);
    out.red = 1; out.servoAngle = 180; out.buzzer = 1;
  }

  return out;
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

  // ================= LEDs =================
  digitalWrite(GREEN,  doc["green"]  | 0);
  digitalWrite(YELLOW, doc["yellow"] | 0);
  digitalWrite(RED,    doc["red"]    | 0);

  // ================= SERVO (ON / OFF) =================
  if (doc.containsKey("servoState")) {
    const char* servoState = doc["servoState"];

    if (strcmp(servoState, "ON") == 0) {
      gateServo.write(180);
      Serial.println("🚪 Servo ON → 180°");
    } 
    else {
      gateServo.write(0);
      Serial.println("🚪 Servo OFF → 0°");
    }
  }

  // ================= BUZZER =================
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

/* ================= SETUP ================= */
void setup() {
  Serial.begin(115200);
  Serial.println("=== ESP32 Flood Node ===");

  // Sensor pins
  pinMode(RAIN_PIN, INPUT);
  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseCounter, FALLING);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // Actuator pins
  pinMode(GREEN, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // Servo
  gateServo.attach(SERVO_PIN);

  // WiFi + MQTT
  setupWiFi();
  client.setServer(MQTT_SERVER, MQTT_PORT);
  client.setCallback(mqttCallback);
}

/* ================= LOOP ================= */
void loop() {
  if(!client.connected()) connectMQTT();
  client.loop();

  // Accumulate flow pulses
  noInterrupts();
  flowAccumulator += pulseCount;
  pulseCount = 0;
  interrupts();

  // Read and publish sensor data every sensorInterval
  unsigned long currentMillis = millis();
  if (currentMillis - previousSensorMillis >= sensorInterval) {
    previousSensorMillis = currentMillis;

    int rain = readRainSensor();
    String rainStatusStr = getRainStatus(rain);
    unsigned long flow = getFlowPulses();
    long water = readWaterLevel();

    String status = determineStatus(rain, flow, water);
    Outputs out = controlOutputs(status);

    // Prepare MQTT payload
    String payload = "{";
    payload += "\"rain\":" + String(rain) + ",";
    payload += "\"rainStatus\":\"" + rainStatusStr + "\",";
    payload += "\"flowPulses\":" + String(flow) + ",";
    payload += "\"waterLevel\":" + String(water) + ",";
    payload += "\"status\":\"" + status + "\",";
    payload += "\"outputs\":{";
    payload += "\"green\":" + String(out.green) + ",";
    payload += "\"yellow\":" + String(out.yellow) + ",";
    payload += "\"red\":" + String(out.red) + ",";
    payload += "\"servoAngle\":" + String(out.servoAngle) + ",";
    payload += "\"buzzer\":" + String(out.buzzer);
    payload += "}}";

    Serial.println("📤 Sensor data payload:");
    Serial.println(payload);

    client.publish(MQTT_SENSOR_TOPIC, payload.c_str());
  }

  // Small delay to prevent watchdog
  delay(10);
}