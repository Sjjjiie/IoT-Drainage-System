# decision_engine.py

def evaluate(data):
    """
    Evaluate flood conditions based on sensor data.

    Parameters:
        data (dict): Sensor readings with keys:
            - rain (0 or 1)
            - flowPulses (int)
            - waterLevel (cm)

    Returns:
        dict: Contains:
            - status (str): "SAFE", "ALERT", or "DANGER"
            - servoAngle (int): 0-3 (Arduino servo state)
            - buzzer (0 or 1)
    """

    rain = data.get("rain", 0)
    flow = data.get("flowPulses", 0)
    level = data.get("waterLevel", -1)

    # Default values
    status = "SAFE"
    servo_state = 0
    buzzer = 0

    # Decision logic
    if rain == 0 and flow < 5 and level > 10:
        status = "SAFE"
        servo_state = 0  # Arduino maps 0 -> 0°
    elif rain == 1 and level <= 10:
        status = "ALERT"
        servo_state = 1  # Arduino maps 1 -> 60°
    else:
        status = "DANGER"
        servo_state = 3  # Arduino maps 3 -> 180°
        buzzer = 1

    return {
        "status": status,
        "servoAngle": servo_state,
        "buzzer": buzzer
    }


# Example usage
if __name__ == "__main__":
    # Simulated sensor input
    sample_data = {
        "rain": 1,
        "flowPulses": 10,
        "waterLevel": 5
    }

    decision = evaluate(sample_data)
    print("Decision output:", decision)
