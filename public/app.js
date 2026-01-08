import {
  getDatabase,
  ref,
  onValue,
  set
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// DOM Elements
const waterLevel = document.getElementById("waterLevel");
const flowRate = document.getElementById("flowRate");
const rainStatus = document.getElementById("rainStatus");
const systemStatus = document.getElementById("systemStatus");

// Firebase Init
const db = getDatabase(window.firebaseApp);

// INTERNAL STATE (VERY IMPORTANT) To Prevent feedback loop
let isUpdatingFromBackend = false;

// Sensor Data
onValue(ref(db, "latest"), (snap) => {
  const data = snap.val();
  if (!data) return;

  waterLevel.innerText =
    data.waterLevel != null ? data.waterLevel + " cm" : "--";

  flowRate.innerText =
    data.flowPulses != null ? data.flowPulses + " L/min" : "--";

  rainStatus.innerText =
    data.rain != null ? (data.rain ? "Rain" : "No Rain") : "--";
});

// Decision / Actuator Status for Display Only
onValue(ref(db, "decision"), (snap) => {
  const data = snap.val();
  if (!data) return;

  isUpdatingFromBackend = true;

  // System status
  systemStatus.innerText = data.status ?? "--";

  let statusClass = "normal";
  switch ((data.status ?? "").toUpperCase()) {
    case "SAFE":
      statusClass = "safe";
      break;
    case "ALERT":
      statusClass = "alert";
      break;
    case "DANGER":
      statusClass = "danger";
      break;
  }
  systemStatus.className = `status ${statusClass}`;

  /* ---- LED display sync ---- */
  updateLEDUI({ red: data.red, yellow: data.yellow, green: data.green });

  /* ---- Buzzer display sync ---- */
  updateBuzzerUI(data.buzzer);

  /* ---- Servo display sync ---- */
  updateServoUI(data.servoAngle);

  isUpdatingFromBackend = false;
});

// Also listen to manual_control so UI reflects direct user toggles
onValue(ref(db, "manual_control"), (snap) => {
  const data = snap.val();
  if (!data) return;

  updateLEDUI({ red: data.red, yellow: data.yellow, green: data.green });
  updateBuzzerUI(data.buzzer);
  updateServoUI(data.servoAngle);
});

// Manual Control Functions, Write To Firebase only on User Action
window.setLED = (color) => {
  if (isUpdatingFromBackend) return;

  const payload = { red: 0, yellow: 0, green: 0 };
  if (color) {
    payload[color] = 1;
  }

  set(ref(db, "manual_control"), payload);

  // Update radios so only one stays selected
  document.querySelectorAll(".switch-row input[type=radio]").forEach(rb => {
    rb.checked = (rb.value === color);
  });
};

window.setBuzzer = (state) => {
  if (isUpdatingFromBackend) return;
  set(ref(db, "manual_control"), { buzzer: state });
  updateBuzzerUI(state); // update immediately
};

window.setServo = (angle) => {
  if (isUpdatingFromBackend) return;
  set(ref(db, "manual_control"), { servoAngle: angle });
  updateServoUI(angle); // update immediately
};

// UI Update
function updateLEDUI(data) {
  document.querySelectorAll(".switch-row input[type=radio]").forEach(rb => {
    const color = rb.value;
    rb.checked = (data[color] === 1);
  });
  console.log("Updating LED UI with:", data);
}

function updateBuzzerUI(state) {
  console.log("Buzzer state:", state ? "ON" : "OFF");
}

function updateServoUI(angle) {
  console.log("Servo angle:", angle);
}