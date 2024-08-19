# Roulette Simulation Server

This project is a simulation of a roulette game using Node.js, WebSocket, and a simple server-client architecture. The server handles the spinning of the roulette and the ball, broadcasts their positions to connected clients, and manages bets placed by clients.

## Features

- **Roulette and Ball Simulation**: Simulates the motion of a roulette and a ball with configurable friction and initial speeds.
- **Real-time Updates**: Broadcasts the current positions and velocity of the roulette and ball to all connected clients in real-time using WebSocket.
- **Bet Management**: Allows clients to place bets on specific numbers, colors, or even/odd outcomes. The server calculates and broadcasts the winnings or losses based on the final position of the ball.
- **Reset and Restart**: Clients can reset the simulation or start a new game.

## Prerequisites

- **Node.js** (v14 or higher recommended)
- **npm** (comes with Node.js)

## Installation

1. **Clone the Repository**:

    ```bash
    git clone ...
    ```

2. **Install Dependencies**:

    ```bash
    npm install
    ```

3. **Run the Server**:

    ```bash
    node index.js
    ```

    The server will start on `http://localhost:3003`.

## File Structure

- **`index.js`**: The main server file that handles WebSocket connections, manages the simulation, and processes bets.
- **`/src`**:
  - **`ball.js`**: Contains the `Ball` class that simulates the motion of the ball on the roulette wheel.
  - **`roulette.js`**: Contains the `Roulette` class that simulates the motion of the roulette wheel.

## Usage

1. **Start the Server**: Use `npm start` to start the server.

2. **Connect Clients**: Clients should connect to the WebSocket server at `ws://localhost:3003`.

3. **Place Bets**: Clients can place bets by sending the appropriate WebSocket message.

4. **Start Simulation**: The simulation can be started by sending a `startSimulation` message.

5. **View Results**: The server will broadcast the positions of the ball and roulette in real-time, and the final result will be sent when the ball stops.

