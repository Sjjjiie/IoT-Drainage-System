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
      x: {
        title: { display: true, text: "Time" }
      },
      y: {
        title: { display: true, text: "Wet → Dry" },
        reverse: true,
        min: 0,
        max: 4095,
        ticks: {
          callback: function(value) {
            // invert values: 0 = 100%, 4095 = 0%
            return Math.round((1 - value / 4095) * 100) + "%";
          }
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

// ===== DASHBOARD SENSOR UPDATES =====
onValue(ref(db, "latest"), (snap) => {
  const data = snap.val();
  if (!data) return;

  const now = new Date().toLocaleTimeString();
  lastUpdate.innerText = "Last updated: " + now;

  const water = data.waterLevel ?? 0;
  const flow = data.flowPulses ?? 0;
  const rain = data.rain ?? 4095; // analog value 0-4095

  // Update cards
  waterLevelText.innerText = water + " cm";
  waterLevelFill.style.height = Math.min(water, 100) + "%";

  flowRateText.innerText = flow + " L/min";
  flowRateFill.style.height = Math.min(flow / 2, 100) + "%";

  // ===== 3 Rain statuses =====
  if (rain < 2000) {
    rainStatus.innerText = "Heavy Rain";
    rainStatusIcon.innerText = "☔️";
  } else if (rain < 3500) {
    rainStatus.innerText = "Light Rain";
    rainStatusIcon.innerText = "🌦";
  } else {
    rainStatus.innerText = "Dry";
    rainStatusIcon.innerText = "🌤";
  }

  // Update charts
  addDataToChart(waterLevelChart, now, water);
  addDataToChart(flowRateChart, now, flow);
  addDataToChart(rainChart, now, rain);
});

// ===== SYSTEM STATUS / ACTUATORS =====
onValue(ref(db, "latest"), (snap) => {
  const data = snap.val();
  if (!data) return;

  isUpdatingFromBackend = true;

  const currentStatus = data.status ?? "--";

  // Update system status text
  systemStatus.innerText = currentStatus;

  // Update system status color
  systemStatus.className = `system-indicator ${
    currentStatus.toLowerCase() === "safe" ? "safe" :
    currentStatus.toLowerCase() === "alert" ? "alert" :
    currentStatus.toLowerCase() === "danger" ? "danger" : ""
  }`;

  updateLEDUI(data);
  updateBuzzerUI(data.buzzer);
  updateServoUI(data.servoAngle);

  isUpdatingFromBackend = false;
});


// ===== MANUAL CONTROL =====
window.setLED = (color) => {
  if (isUpdatingFromBackend) return;

  const payload = { red: 0, yellow: 0, green: 0 };
  if (color) payload[color] = 1;
  set(ref(db, "manual_control"), payload);

  Object.values(ledButtons).forEach(btn => btn.classList.remove("selected"));
  if (ledButtons[color]) ledButtons[color].classList.add("selected");
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

// ===== UI UPDATE HELPERS =====
function updateServoUI(angle) {
  servoSlider.value = Math.min(angle * 33, 100);
  servoValue.innerText = Math.round(servoSlider.value) + "%";
}

function updateBuzzerUI(state) {
  buzzerBtn.className = state ? "buzzer-btn active" : "buzzer-btn";
  buzzerBtn.innerText = state ? "ON" : "OFF";
}

function updateLEDUI(data) {
  Object.keys(ledButtons).forEach(color => {
    ledButtons[color].classList.toggle("selected", data[color] === 1);
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
