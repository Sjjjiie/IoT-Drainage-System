import { ref, onValue, set, query, orderByKey, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ===== DOM ELEMENTS =====
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

const ledButtons = {
  green: document.querySelector(".led.green"),
  yellow: document.querySelector(".led.yellow"),
  red: document.querySelector(".led.red")
};

// ===== DATABASE =====
const db = window.db;
let isUpdatingFromBackend = false;

// ===== CHARTS =====
function createChart(id, label, color, isStepped=false) {
  return new Chart(document.getElementById(id), {
    type: "line",
    data: { labels: [], datasets: [{ label: label, data: [], borderColor: color, backgroundColor: color.replace(")", ",0.2)").replace("rgb", "rgba"), tension: 0.3, stepped: isStepped }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: "Time" } }, y: { beginAtZero: true, min: 0, max: id==="rainChart"?1:null, ticks: { stepSize: id==="rainChart"?1:null } } } }
  });
}

const waterLevelChart = createChart("waterLevelChart", "Water Level (cm)", "#0b5ed7");
const flowRateChart  = createChart("flowRateChart", "Flow Rate (L/min)", "#28a745");
const rainChart      = createChart("rainChart", "Rain Status", "#ffc107", true);

// ===== HELPER =====
function addDataToChart(chart, label, value) {
  if (chart.data.labels.length >= 20) { chart.data.labels.shift(); chart.data.datasets[0].data.shift(); }
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(value);
  chart.update();
}

// ===== DASHBOARD UPDATES =====
onValue(ref(db, "latest"), snap => {
  const data = snap.val(); if(!data) return;
  const now = new Date().toLocaleTimeString();
  lastUpdate.innerText = "Last updated: " + now;

  const water = data.waterLevel ?? 0;
  const flow = data.flowPulses ?? 0;
  const rain = data.rain ? 1 : 0;

  waterLevelText.innerText = water + " cm";
  waterLevelFill.style.height = Math.min(water,100) + "%";

  flowRateText.innerText = flow + " L/min";
  flowRateFill.style.height = Math.min(flow/2,100) + "%";

  rainStatus.innerText = rain?"Rain":"No Rain";
  rainStatusIcon.innerText = rain?"☔️":"🌤";

  

  addDataToChart(waterLevelChart, now, water);
  addDataToChart(flowRateChart, now, flow);
  addDataToChart(rainChart, now, rain);
});

// ===== SYSTEM STATUS =====
onValue(ref(db, "decision"), snap => {
  const data = snap.val(); if(!data) return;
  isUpdatingFromBackend = true;

  systemStatus.innerText = data.status ?? "--";
  systemStatus.className = `system-indicator ${(data.status ?? "").toLowerCase()}`;

  Object.keys(ledButtons).forEach(color => {
    ledButtons[color].classList.toggle("selected", data[color]===1);
  });
  buzzerBtn.className = data.buzzer ? "buzzer-btn active" : "buzzer-btn";
  buzzerBtn.innerText = data.buzzer ? "ON" : "OFF";

  servoSlider.value = Math.min((data.servoAngle??0)*33,100);
  servoValue.innerText = Math.round(servoSlider.value) + "%";

  isUpdatingFromBackend = false;
});

// ===== MANUAL CONTROL =====
window.setLED = color => {
  if(isUpdatingFromBackend) return;
  const payload = { red:0, yellow:0, green:0 };
  if(color) payload[color]=1;
  set(ref(db,"manual_control"), payload);
  Object.values(ledButtons).forEach(btn=>btn.classList.remove("selected"));
  if(ledButtons[color]) ledButtons[color].classList.add("selected");
};

window.setBuzzer = state => { if(!isUpdatingFromBackend) set(ref(db,"manual_control"),{buzzer:state}); };
window.toggleBuzzer = () => { const state = buzzerBtn.classList.toggle("active"); buzzerBtn.innerText = state?"ON":"OFF"; setBuzzer(state?1:0); };
window.setServo = angle => { if(!isUpdatingFromBackend) set(ref(db,"manual_control"),{servoAngle:angle}); servoSlider.value = Math.min(angle*33,100); servoValue.innerText = Math.round(servoSlider.value)+"%"; };

// ===== HISTORICAL DATA =====
const histRef = query(ref(db,"sensor_readings"), orderByKey(), limitToLast(50));
onValue(histRef, snap => {
  const data = snap.val(); if(!data) return;
  Object.keys(data).sort().forEach(ts=>{
    const d = data[ts], time = new Date(Number(ts)).toLocaleTimeString();
    addDataToChart(waterLevelChart, time, d.waterLevel??0);
    addDataToChart(flowRateChart, time, d.flowPulses??0);
    addDataToChart(rainChart, time, d.rain?1:0);
  });
});
