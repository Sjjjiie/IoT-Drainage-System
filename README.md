# IoT Drainage System 🚰

An integrated IoT solution for monitoring and controlling a smart drainage system.  
This repository contains **Arduino firmware**, a **web dashboard**, and a **Python backend service** that work together to collect sensor data, visualize it, and control actuators via MQTT and Firebase.

---

## 📂 Repository Structure

- **arduino/** → Code for ESP32 board to read sensors (water level, flow, rain) and control actuators (servo gate, buzzer, LEDs).  
- **public/** → Dashboard UI for monitoring system status and sending manual control commands.  
- **src/** → Backend service that:
  - Receives sensor data via MQTT
  - Saves data to Firebase
  - Listens for manual control commands from the dashboard
  - Sends MQTT messages back to actuators

---

## ⚙️ System Flow

1. **Prepare hardware**:  
   - ESP32 board  
   - Sensors: water level, flow, rain  
   - Actuators: servo motor (gate), buzzer, LEDs  
   - Wire components to the correct pins.

2. **Upload Arduino firmware**:  
   - Connect ESP32 via USB.  
   - Open `arduino/` folder in Arduino IDE.  
   - Upload the sketch to the board.  
   - The board starts sending sensor data via MQTT.

3. **Run backend service**:  
   - Python service (`src/main.py`) receives sensor data, saves to Firebase, and listens for manual control commands.  
   - Manual commands from the dashboard are sent back to actuators via MQTT.

4. **Open dashboard**:  
   - The dashboard (`public/`) displays sensor readings, charts, and control switches.  
   - Users can toggle LEDs, servo, and buzzer from the UI.

---

## 🚀 Running Locally

```bash
# Clone repository
git clone https://github.com/Sjjjiie/IoT-Drainage-System.git
cd IoT-Drainage-System

# Create virtual environment
python3 -m venv venv
source venv/bin/activate   # Linux/Mac
venv\Scripts\activate      # Windows PowerShell

# Install dependencies
pip install -r requirements.txt

# Add Firebase credentials
mkdir -p credentials
nano credentials/firebase-key.json
# Paste your Firebase service account JSON here

# Run backend service
PYTHONPATH=src python src/main.py
```

## ☁️ Running on Google Cloud Platform (GCP)

```bash
# Install Python if not already installed
sudo apt-get update
sudo apt-get install python3 python3-venv python3-pip -y

# Clone repository
git clone https://github.com/Sjjjiie/IoT-Drainage-System.git
cd IoT-Drainage-System

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Add Firebase credentials
mkdir -p credentials
nano credentials/firebase-key.json
# Paste your Firebase service account JSON here

# Run backend service
PYTHONPATH=src python src/main.py
```

## 🖥️ Dashboard

The dashboard is located in the `public/` folder.

You can serve it using any static file server (e.g., `python -m http.server`) or deploy to Firebase Hosting.

It connects to the backend service and Firebase to display sensor data and control actuators.

---

## 🔧 Hardware Requirements

- ESP32 microcontroller  
- Water level sensor  
- Flow sensor  
- Rain sensor  
- Servo motor (gate control)  
- Buzzer  
- LEDs (Green, Yellow, Red)  

---

## 📊 Features

- Real-time sensor monitoring (water level, flow rate, rain status)  
- System status indicator (Safe / Alert / Danger)  
- Historical data visualization with charts  
- Manual control panel for actuators:  
  - Toggle LEDs (Green, Yellow, Red)  
  - Open/close gate servo  
  - Activate buzzer  
