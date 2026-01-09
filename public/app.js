import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// DOM Elements
const waterLevelFill = document.getElementById("waterLevelFill");
const waterLevelText = document.getElementById("waterLevelText");
const flowRateFill = document.getElementById("flowRateFill");
const flowRateText = document.getElementById("flowRateText");
const rainStatus = document.getElementById("rainStatus");
const rainStatusIcon = document.getElementById("rainStatusIcon");
const systemStatus = document.getElementById("systemStatus");
const lastUpdate = document.getElementById("lastUpdate");
const servoSlider = document.getElementById("servoSlider");
const servoValue = document.getElementById("servoValue");
const buzzerBtn = document.getElementById("buzzerBtn");

const db = getDatabase(window.firebaseApp);
let isUpdatingFromBackend = false;

// ----- DASHBOARD SENSOR UPDATES -----
onValue(ref(db, "latest"), (snap) => {
  const data = snap.val();
  if (!data) return;

  const now = new Date().toLocaleTimeString();
  lastUpdate.innerText = "Last updated: " + now;

  const water = data.waterLevel ?? 0;
  const flow = data.flowPulses ?? 0;
  const rain = data.rain ? 1 : 0;

  // Update cards
  waterLevelText.innerText = water + " cm";
  waterLevelFill.style.height = Math.min(water, 100) + "%";

  flowRateText.innerText = flow + " L/min";
  flowRateFill.style.height = Math.min(flow / 2, 100) + "%";

  rainStatus.innerText = data.rain ? "Rain" : "No Rain";
  rainStatusIcon.innerText = data.rain ? "☔️" : "🌤";

  // Update charts
  addDataToChart(waterLevelChart, now, water);
  addDataToChart(flowRateChart, now, flow);
  addDataToChart(rainChart, now, rain);
});

// ----- SYSTEM STATUS -----
onValue(ref(db, "decision"), (snap) => {
  const data = snap.val();
  if (!data) return;

  isUpdatingFromBackend = true;

  systemStatus.innerText = data.status ?? "--";
  systemStatus.className = `system-indicator ${ (data.status ?? "").toLowerCase() }`;

  updateLEDUI({ red: data.red, yellow: data.yellow, green: data.green });
  updateBuzzerUI(data.buzzer);
  updateServoUI(data.servoAngle);

  isUpdatingFromBackend = false;
});

// ----- MANUAL CONTROL -----
window.setLED = (color) => {
  if (isUpdatingFromBackend) return;

  const payload = { red: 0, yellow: 0, green: 0 };
  if (color) payload[color] = 1;
  set(ref(db, "manual_control"), payload);

  // Update button visuals
  document.querySelectorAll(".led-buttons button").forEach(btn => {
    btn.classList.remove("selected");
  });

  // Add selected to pressed button
  const btn = document.querySelector(`.led-buttons .${color}`);
  if (btn) btn.classList.add("selected");
};


window.setBuzzer = (state) => {
  if (isUpdatingFromBackend) return;
  set(ref(db, "manual_control"), { buzzer: state });
  updateBuzzerUI(state);
};

window.toggleBuzzer = () => {
  const state = buzzerBtn.classList.toggle("active");
  buzzerBtn.innerText = state ? "ON" : "OFF";
  setBuzzer(state ? 1 : 0);
};

window.setServo = (angle) => {
  if (isUpdatingFromBackend) return;
  set(ref(db, "manual_control"), { servoAngle: angle });
  updateServoUI(angle);
};

function updateServoUI(angle) {
  servoSlider.value = angle * 33; // 0-3 to 0-100%
  servoValue.innerText = Math.round(servoSlider.value) + "%";
}

function updateBuzzerUI(state) {
  buzzerBtn.className = state ? "buzzer-btn active" : "buzzer-btn";
  buzzerBtn.innerText = state ? "ON" : "OFF";
}

function updateLEDUI(data) {
  console.log("LED state:", data);
}

// ----- CHARTS -----
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
  data: { labels: [], datasets: [{ label: "Rain Status", data: [], borderColor: "#ffc107", backgroundColor: "rgba(255,193,7,0.2)", tension: 0.2, stepped: true }] },
  options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: "Time" } }, y: { min: 0, max: 1, ticks: { stepSize: 1 } } } }
});

function addDataToChart(chart, label, value) {
  if (chart.data.labels.length >= 20) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(value);
  chart.update();
}
