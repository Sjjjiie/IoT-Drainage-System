def evaluate(data):
    rain = data["rain"]
    flow = data["flowPulses"]
    level = data["waterLevel"]

    if rain == 0 and flow < 5 and level > 10:
        status = "SAFE"
        servo = 0
    elif rain == 1 and level <= 10:
        status = "ALERT"
        servo = 90
    else:
        status = "DANGER"
        servo = 180

    return {
        "status": status,
        "servoAngle": servo,
        "buzzer": 1 if status == "DANGER" else 0
    }