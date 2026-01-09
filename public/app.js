import { getDatabase, ref, onValue, set, query, orderByKey, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// DOM Elements
const waterLevelEl = document.getElementById("waterLevel");
const flowRateEl = document.getElementById("flowRate");
const rainStatusEl = document.getElementById("rainStatus");
const systemStatusEl = document.getElementById("systemStatus");

// LED radios
const ledRadios = document.querySelectorAll(".switch-row input[type=radio]");
const buzzerSwitch = document.getElementById("buzzerSwitch");
const servoSwitch = document.getElementById("servoSwitch");

// Firebase DB
const db = getDatabase(window.firebaseApp);
let isUpdatingFromBackend = false;

// Chart instances
let waterChart, flowChart, rainChart;

// Initialize charts
function initCharts() {
  const ctxWater = document.getElementById("waterLevelChart").getContext("2d");
  const ctxFlow = document.getElementById("flowRateChart").getContext("2d");
  const ctxRain = document.getElementById("rainChart").getContext("2d");

  waterChart = new Chart(ctxWater, {
    type: "line",
    data: { labels: [], datasets: [{ label: "Water Level (cm)", data: [], borderColor: "blue", tension: 0.3 }] },
    options: { responsive: true, animation: false }
  });

  flowChart = new Chart(ctxFlow, {
    type: "line",
    data: { labels: [], datasets: [{ label: "Flow Rate (L/min)", data: [], borderColor: "green", tension: 0.3 }] },
    options: { responsive: true, animation: false }
  });

  rainChart = new Chart(ctxRain, {
    type: "line",
    data: { labels: [], datasets: [{ label: "Rain Status", data: [], borderColor: "orange", tension: 0, stepped: true }] },
    options: { responsive: true, animation: false, scales: { y: { min: 0, max: 1, ticks: { stepSize: 1, callback: v => v ? "Rain" : "No Rain" } } } }
  });
}

// Update chart with historical readings
function updateCharts(snapshot) {
  const data = snapshot.val();
  if (!data) return;

  const timestamps = [];
  const waterData = [];
  const flowData = [];
  const rainData = [];

  Object.keys(data).sort().forEach(ts => {
    const d = data[ts];
    timestamps.push(new Date(Number(ts)).toLocaleTimeString());
    waterData.push(d.waterLevel ?? 0);
    flowData.push(d.flowPulses ?? 0);
    rainData.push(d.rain ? 1 : 0);
  });

  waterChart.data.labels = timestamps;
  waterChart.data.datasets[0].data = waterData;
  waterChart.update();

  flowChart.data.labels = timestamps;
  flowChart.data.datasets[0].data = flowData;
  flowChart.update();

  rainChart.data.labels = timestamps;
  rainChart.data.datasets[0].data = rainData;
  rainChart.update();
}

// Latest sensor values
onValue(ref(db, "latest"), snap => {
  const data = snap.val();
  if (!data) return;
  waterLevelEl.innerText = data.waterLevel ?? "--";
  flowRateEl.innerText = data.flowPulses ?? "--";
  rainStatusEl.innerText = data.rain ? "Rain" : "No Rain";
});

// System / actuators
onValue(ref(db, "decision"), snap => {
  const data = snap.val();
  if (!data) return;

  isUpdatingFromBackend = true;

  systemStatusEl.innerText = data.status ?? "--";
  systemStatusEl.className = "status " + ((data.status ?? "").toLowerCase() || "normal");

  // Update actuators UI
  updateLEDUI(data);
  updateBuzzerUI(data.buzzer);
  updateServoUI(data.servoAngle);

  isUpdatingFromBackend = false;
});

// Manual control UI sync
onValue(ref(db, "manual_control"), snap => {
  const data = snap.val();
  if (!data) return;
  updateLEDUI(data);
  updateBuzzerUI(data.buzzer);
  updateServoUI(data.servoAngle);
});

// Historical chart
const histRef = query(ref(db, "sensor_readings"), orderByKey(), limitToLast(50));
onValue(histRef, snapshot => updateCharts(snapshot));

// ================== Manual Control Functions ==================

window.setLED = color => {
  if (isUpdatingFromBackend) return;

  const payload = { red: 0, yellow: 0, green: 0 };
  if (color) payload[color] = 1;
  set(ref(db, "manual_control"), payload);

  // enforce radio buttons
  ledRadios.forEach(rb => rb.checked = (rb.value === color));
};

window.setBuzzer = state => {
  if (isUpdatingFromBackend) return;
  set(ref(db, "manual_control"), { buzzer: state });
  updateBuzzerUI(state);
};

window.setServo = angle => {
  if (isUpdatingFromBackend) return;
  set(ref(db, "manual_control"), { servoAngle: angle });
  updateServoUI(angle);
};

// ================== UI update helpers ==================

function updateLEDUI(data) {
  ledRadios.forEach(rb => rb.checked = data[rb.value] === 1);
}

function updateBuzzerUI(state) {
  buzzerSwitch.checked = state === 1;
}

function updateServoUI(angle) {
  servoSwitch.checked = angle > 0;
}

// Initialize charts on load
initCharts();