# 🚑 GreenRoute: Emergency Traffic Priority Simulator

### Drive Fast. Save Time. Clear the Way.

GreenRoute is a 3D open-world emergency vehicle driving game that demonstrates intelligent emergency vehicle routing and traffic signal priority. Players can drive ambulances, fire engines, and police vehicles through a procedurally generated city, activate emergency sirens, receive automatically generated missions, and experience intelligent traffic signal coordination that helps emergency vehicles reach their destinations faster.

The project combines interactive 3D gameplay with the concept of Intelligent Transportation Systems (ITS), demonstrating how technology can reduce emergency response delays at busy traffic intersections.

---

## 🌆 Project Overview

In urban areas, emergency vehicles often lose valuable time waiting at traffic signals and navigating congested roads. GreenRoute explores a smarter approach by combining GPS-based positioning, route optimization, emergency request handling, and intelligent traffic signal prioritization.

GreenRoute transforms this concept into an interactive 3D driving experience where players manually control emergency vehicles while the traffic management system coordinates signals along their routes.

## 🎮 Game Features

- **3D Open-World City:** Explore a procedurally generated city featuring interconnected roads, buildings, intersections, and public-service facilities.
- **Multiple Emergency Vehicles:** Choose between an Ambulance, Fire Brigade, and Police Vehicle.
- **Free-Roam Driving:** Freely explore the city using keyboard controls.
- **Emergency Siren Activation:** Press CAPS LOCK to activate the emergency siren and initiate a mission.
- **Intelligent Destination Detection:** Automatically identifies the nearest reachable hospital, fire station, or police station based on the selected vehicle.
- **Dynamic Route Navigation:** Calculates routes using road-network pathfinding and provides navigation guidance.
- **Mission-Based Gameplay:** Complete emergency missions within a countdown timer.
- **Smart Traffic Signal Priority:** Traffic signals prepare to grant green priority before the emergency vehicle reaches an intersection.
- **Safe Signal Transitions:** Implements Yellow, All-Red, and Green signal sequences.
- **Civilian Traffic Simulation:** Simulates regular vehicles navigating city roads and responding to traffic signals.
- **Mission Success & Failure:** Complete missions, earn scores, retry failed missions, and return to free roam.
- **Third-Person Camera:** Experience the city through a vehicle-following camera.

## 🚗 Available Vehicles

| Vehicle | Emergency Mission | Destination |
|---|---|---|
| 🚑 Ambulance | Medical Emergency | Nearest Hospital |
| 🚒 Fire Brigade | Fire Emergency | Nearest Fire Station |
| 🚓 Police Vehicle | Police Emergency | Nearest Police Station |

The city includes four hospitals, four fire stations, and four police stations distributed across different locations.

## 🕹️ Controls

| Key | Action |
|---|---|
| W / ↑ | Accelerate |
| S / ↓ | Brake / Reverse |
| A / ← | Steer Left |
| D / → | Steer Right |
| CAPS LOCK | Activate Emergency Siren / Start Mission |
| SPACE | Handbrake |
| R | Reset Vehicle |
| C | Change Camera View |
| M | Toggle Minimap |
| ESC | Pause / Resume |

## 🧠 How GreenRoute Works

The game demonstrates the following workflow:

1. **Vehicle Selection:** The player selects an emergency vehicle.
2. **Random Spawn:** The vehicle appears at a valid random location in the city.
3. **Free Roam:** The player explores and drives through the city.
4. **Emergency Activation:** Pressing CAPS LOCK activates the siren.
5. **Location Detection:** The system identifies the vehicle's simulated GPS position.
6. **Destination Selection:** The nearest reachable destination of the appropriate type is identified.
7. **Route Calculation:** A pathfinding algorithm calculates a suitable route through the connected road network.
8. **Mission Activation:** A countdown timer starts and the route is displayed.
9. **Traffic Signal Priority:** Upcoming intersections prepare to grant emergency vehicle priority.
10. **Mission Completion:** The player reaches the destination before the timer expires.

## 🚦 Intelligent Traffic Signal Priority

The core concept behind GreenRoute is to minimize emergency vehicle waiting time at traffic intersections.

When an emergency vehicle approaches an intersection:

- Its position and estimated arrival time are monitored.
- The upcoming intersection is identified.
- The requested movement is checked for conflicts.
- The traffic signal begins a safe transition.
- Conflicting traffic receives yellow and all-red clearance.
- The emergency vehicle receives a green signal.
- Priority is released after the vehicle passes.

The system also explores priority arbitration when multiple emergency vehicles request conflicting movements.

## 🏗️ System Architecture

GreenRoute is inspired by a hardware-plus-software emergency traffic management architecture.

### 1. Emergency Vehicle Node
- ESP32
- GPS Module
- Emergency Priority Request
- MQTT Communication

### 2. GreenRoute Backend
- Python FastAPI
- Request Authentication
- ETA Calculation
- Conflict Detection
- Priority Arbitration Engine
- Request Queue Management

### 3. Intersection Controller
- ESP32 Controller
- Traffic Signal State Machine
- Safe Signal Transitions
- Watchdog and Timeout
- Automatic Return to Normal Operation

**Note:** The browser game simulates these components locally. It does not currently imply a live connection to physical ESP32 hardware, GPS modules, an MQTT broker, or a production FastAPI backend.

## 🎯 Project Objectives

- Demonstrate intelligent emergency vehicle traffic management.
- Reduce unnecessary waiting time at traffic intersections.
- Explore GPS-based emergency vehicle positioning.
- Implement dynamic route calculation and navigation.
- Demonstrate conflict-aware traffic signal prioritization.
- Explore safe coordination of multiple emergency vehicle requests.
- Present Intelligent Transportation Systems through interactive 3D gameplay.

## 🔮 Future Enhancements

- Integration with physical ESP32 hardware.
- Real GPS-based vehicle tracking.
- Live MQTT communication.
- Python FastAPI backend integration.
- Real-time traffic density estimation.
- Advanced emergency request arbitration.
- Multiplayer emergency response simulation.
- More realistic vehicle physics and city environments.
- Advanced traffic optimization using AI.

---

### 🚦 GreenRoute
**Every Second Matters. Every Signal Counts.**
