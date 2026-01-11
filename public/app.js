import { ref, onValue, set, query, orderByKey, limitToLast } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ===== DOM ELEMENTS =====
const waterLevelFill = document.getElementById("waterLevelFill");
const waterLevelText = document.getElementById("waterLevelText");
const flowRateFill = document.getElementById("flowRateFill");
const flowRateText = document.getElementById("flowRateText");
const rainStatus = document.getElementById("rainStatus");
const rainStatusIcon = document.getElementById("rainStatusIcon");
const systemStatus = document.getElementById("systemStatus");
const lastUpdate = document.getElementById("lastUpdate");

const servoSwitch = document.getElementById("servoSwitch");
const buzzerSwitch = document.getElementById("buzzerSwitch");

const ledButtons = {
  green: document.querySelector("input[value='green']"),
  yellow: document.querySelector("input[value='yellow']"),
  red: document.querySelector("input[value='red']")
};

// ===== DATABASE =====
const db = window.db;
let isUpdatingFromBackend = false;

// ===== CHARTS =====
const waterLevelChart = new Chart(document.getElementById("waterLevelChart"), {
  type: "line",
  data: { labels: [], datasets: [{ label: "Water Level (cm)", data: [], borderColor: "#0b5ed7", backgroundColor: "rgba(11,94,215,0.2)", tension: 0.3 }] },
  options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: "Time" } }, y: { beginAtZero: true } } }
});

const flowRateChart = new Chart(document.getElementById("flowRateChart"), {
  type: "line",
  data: { labels: [], datasets: [{ label: "Flow Rate (L/min)", data: [], borderColor: "#28a745", backgroundColor: "rgba(40,167,69,0.2)", tension: 0.3 }] },
  options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: "Time" } }, y: { beginAtZero: true } } }
});

const rainChart = new Chart(document.getElementById("rainChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "Rain Sensor (%)",
      data: [],
      borderColor: "#ffc107",
      backgroundColor: "rgba(255,193,7,0.2)",
      tension: 0.2
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { title: { display: true, text: "Time" } },
      y: {
        title: { display: true, text: "Wet → Dry" },
        reverse: true,
        min: 0,
        max: 4095,
        ticks: {
          callback: (value) => Math.round((1 - value / 4095) * 100) + "%"
        }
      }
    }
  }
});

// ===== HELPER =====
function addDataToChart(chart, label, value) {
  if (chart.data.labels.length >= 20) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(value);
  chart.update();
}

// ===== DASHBOARD SENSOR UPDATES & STATUS =====
onValue(ref(db, "latest"), (snap) => {
  const data = snap.val();
  if (!data) return;

  const now = new Date().toLocaleTimeString();
  lastUpdate.innerText = "Last updated: " + now;

  // --- Sensor Data ---
const water = data.waterLevel ?? 0;
  const flow  = data.flowPulses ?? 0;
  const rain  = data.rain ?? 4095;
  const currentRainStatus = data.rainStatus ?? "DRY"; 

  waterLevelText.innerText = water + " cm";
  waterLevelFill.style.height = Math.min(water, 100) + "%";

  flowRateText.innerText = flow + " L/min";
  flowRateFill.style.height = Math.min(flow / 2, 100) + "%";

  rainStatus.innerText = currentRainStatus; 

  if (currentRainStatus === "HEAVY") {
    rainStatusIcon.innerText = "☔️";
  } else if (currentRainStatus === "LIGHT") {
    rainStatusIcon.innerText = "🌦";
  } else {
    rainStatusIcon.innerText = "🌤";
  }

  addDataToChart(waterLevelChart, now, water);
  addDataToChart(flowRateChart, now, flow);
  addDataToChart(rainChart, now, rain);

  // --- System Status ---
  const status = data.status ?? "--";
  systemStatus.innerText = status;
  systemStatus.className = `system-indicator ${
    status.toLowerCase() === "safe" ? "safe" :
    status.toLowerCase() === "alert" ? "alert" :
    status.toLowerCase() === "danger" ? "danger" : ""
  }`;
});

// ===== ACTUATORS UPDATES =====
onValue(ref(db, "latest/outputs"), (snap) => {
  const outputs = snap.val();
  if (!outputs) return;

  isUpdatingFromBackend = true;

  updateLEDUI(outputs);
  updateBuzzerUI(outputs.buzzer);
  const angle = outputs.servoAngle ?? 0; 
  const servoState = (angle === 0) ? "OFF" : "ON"; 
  updateServoUI(servoState);

  isUpdatingFromBackend = false;
});

// ===== MANUAL CONTROL =====
window.setLED = (color) => {
  if (isUpdatingFromBackend) return;

  const payload = { green: 0, yellow: 0, red: 0 };
  payload[color] = 1;

  set(ref(db, "manual_control"), payload);
};

window.setBuzzer = (state) => {
  if (isUpdatingFromBackend) return;
  set(ref(db, "manual_control"), { buzzer: state });
};

window.setServo = (state) => {
  if (isUpdatingFromBackend) return;
  // Save ON/OFF string
  set(ref(db, "manual_control"), { servoState: state ? "ON" : "OFF" });
};

// ===== UI UPDATE HELPERS =====
function updateServoUI(state) {
  servoSwitch.checked = state === "ON";
}

function updateBuzzerUI(state) {
  buzzerSwitch.checked = !!state;
}

function updateLEDUI(outputs) {
  Object.keys(ledButtons).forEach(color => {
    ledButtons[color].checked = outputs[color] === 1;
  });
}

// ===== HISTORICAL DATA =====
const histRef = query(ref(db, "sensor_readings"), orderByKey(), limitToLast(50));
onValue(histRef, (snap) => {
  const data = snap.val();
  if (!data) return;

  Object.keys(data).sort().forEach(ts => {
    const d = data[ts];
    const time = new Date(Number(ts)).toLocaleTimeString();
    addDataToChart(waterLevelChart, time, d.waterLevel ?? 0);
    addDataToChart(flowRateChart, time, d.flowPulses ?? 0);
    addDataToChart(rainChart, time, d.rain ?? 4095);
  });
});