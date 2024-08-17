const express = require('express');
const http = require('http');
const WebSocket = require('ws');

// Create an Express app and HTTP server
const app = express();
const PORT = 3003;
const server = http.createServer(app);

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

let currentSimulationInterval = null; // Store the current simulation interval
let simulationInProgress = false; // Track if the simulation is in progress
let bets = []; // Array to store bets placed by users

// Mapping of segment index to roulette number and color (European roulette)
const segmentMap = [
    { number: 32, color: 'red' }, { number: 15, color: 'black' }, { number: 19, color: 'red' },
    { number: 4, color: 'black' }, { number: 21, color: 'red' }, { number: 2, color: 'black' },
    { number: 25, color: 'red' }, { number: 17, color: 'black' }, { number: 34, color: 'red' },
    { number: 6, color: 'black' }, { number: 27, color: 'red' }, { number: 13, color: 'black' },
    { number: 36, color: 'red' }, { number: 11, color: 'black' }, { number: 30, color: 'red' },
    { number: 8, color: 'black' }, { number: 23, color: 'red' }, { number: 10, color: 'black' },
    { number: 5, color: 'red' }, { number: 24, color: 'black' }, { number: 16, color: 'red' },
    { number: 33, color: 'black' }, { number: 1, color: 'red' }, { number: 20, color: 'black' },
    { number: 14, color: 'red' }, { number: 31, color: 'black' }, { number: 9, color: 'red' },
    { number: 22, color: 'black' }, { number: 18, color: 'red' }, { number: 29, color: 'black' },
    { number: 7, color: 'red' }, { number: 28, color: 'black' }, { number: 12, color: 'red' },
    { number: 35, color: 'black' }, { number: 3, color: 'red' }, { number: 26, color: 'black' },
    { number: 0, color: 'green' }
];

// Class to simulate the roulette wheel
class Roulette {
    constructor(radius, initialAngularVelocity, friction) {
        this.radius = radius;
        this.angularVelocity = initialAngularVelocity; // rad/s
        this.friction = friction; // deceleration in rad/s^2
        this.angle = 0; // Current angle of the roulette
    }

    // Update the angle based on time elapsed
    update(deltaTime) {
        this.angle += this.angularVelocity * deltaTime;
        this.angularVelocity -= this.friction * deltaTime;

        if (this.angularVelocity < 0) {
            this.angularVelocity = 0; // Stop the wheel if it slows down completely
        }
    }
}

// Class to simulate the roulette ball
class Ball {
    constructor(radius, initialVelocity, rouletteRadius) {
        this.radius = radius;
        this.velocity = initialVelocity; // m/s
        this.rouletteRadius = rouletteRadius;
        this.angle = 0; // Current angle of the ball on the roulette wheel
        this.position = 0; // Linear position along the circumference
        this.obstacles = this.generateObstacles(); // Generate random obstacles
        this.initialSlowdownThreshold = initialVelocity * 0.3; // Threshold below which the ball starts encountering obstacles
    }

    // Generate random obstacles around the roulette wheel
    generateObstacles() {
        const obstacles = [];
        const numberOfObstacles = 5;
        for (let i = 0; i < numberOfObstacles; i++) {
            obstacles.push({
                position: Math.random() * 2 * Math.PI, // Random position on the wheel
                effect: Math.random() * 0.1 + 0.05 // Effect on velocity (5% to 15%)
            });
        }
        return obstacles;
    }

    // Check if the ball hits an obstacle
    checkForObstacles() {
        if (this.velocity > this.initialSlowdownThreshold) {
            return; // No obstacles until the ball slows down enough
        }

        this.obstacles.forEach(obstacle => {
            const distance = Math.abs(this.angle - obstacle.position);
            if (distance < 0.1) { // Ball hits the obstacle
                this.velocity *= (1 - obstacle.effect); // Decrease velocity
                this.angle += 0.05; // Simulate a small jump by changing angle slightly
            }
        });
    }

    // Update the ball's position based on time elapsed
    update(deltaTime, rouletteAngularVelocity) {
        // Ball moves along the circumference of the roulette wheel
        this.position += this.velocity * deltaTime;

        // Calculate angular displacement due to the roulette wheel's rotation
        this.angle = this.position / this.rouletteRadius - rouletteAngularVelocity * deltaTime;

        // Apply reduced friction to decelerate the ball more slowly initially
        if (this.velocity > this.initialSlowdownThreshold) {
            this.velocity -= 0.3 * this.velocity * deltaTime; // Slow deceleration at high speeds
        } else {
            this.velocity -= 0.8 * this.velocity * deltaTime; // Faster deceleration at lower speeds
        }

        // Check for obstacles and apply their effects
        this.checkForObstacles();

        if (this.velocity < 0) {
            this.velocity = 0; // Stop the ball if it slows down completely
        }
    }

    // Calculate the segment based on the ball's angle
    getSegment() {
        const segments = 37; // Number of segments (0-36)
        const anglePerSegment = 2 * Math.PI / segments; // Angle per segment in radians
        const normalizedAngle = (this.angle + 2 * Math.PI) % (2 * Math.PI); // Normalize angle between 0 and 2π
        return Math.floor(normalizedAngle / anglePerSegment);
    }
}

// Broadcast the current ball position and segment to all connected clients
function broadcastBallPosition(ball) {
    const segmentIndex = ball.getSegment();
    const velocity = ball.velocity.toFixed(2);
    const ballPosition = {
        angle: ball.angle.toFixed(2), // Angular position of the ball on the wheel
        velocity, // Current speed of the ball
        segment: segmentMap[segmentIndex].number, // Current segment value based on segment index
        color: segmentMap[segmentIndex].color // Current segment color
    };

    if (Number(velocity) > 0) {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(ballPosition));
            }
        });
    } else {
        broadcastFinalResult(ball);
        const finalSegment = segmentMap[segmentIndex].number;
        const finalColor = segmentMap[segmentIndex].color;
        calculateWinnings(finalSegment, finalColor); // Calculate and broadcast winnings
        calculateWinnings
    }
}

// Broadcast the final result when the ball stops and calculate winnings
function broadcastFinalResult(ball) {
    if (simulationInProgress) {
        const segmentIndex = ball.getSegment();
        const finalSegment = segmentMap[segmentIndex].number;
        const finalColor = segmentMap[segmentIndex].color;

        const finalResult = {
            message: 'Ball has stopped',
            finalSegment,
            color: finalColor
        };

        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(finalResult));
            }
        });

        simulationInProgress = false; // Mark the simulation as complete
    }
}

// Calculate winnings based on the result and notify users
function calculateWinnings(finalSegment, finalColor) {
    bets.forEach(bet => {
        let winnings = 0;
        if (bet.type === 'number' && bet.value === finalSegment) {
            winnings = bet.amount * 35; // Payout for number bet
        } else if (bet.type === 'color' && bet.value === finalColor) {
            winnings = bet.amount * 2; // Payout for color bet
        } else if (bet.type === 'even-odd' && bet.value === (finalSegment % 2 === 0 ? 'even' : 'odd')) {
            winnings = bet.amount * 2; // Payout for even/odd bet
        } else {
            winnings = -bet.amount; // Loss
        }

        // Notify user of their winnings or losses
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client.id === bet.userId) {
                client.send(JSON.stringify({
                    message: 'Bet result',
                    bet: bet,
                    winnings: winnings
                }));
            }
        });
    });

    // Clear bets after processing
    bets = [];
}

// Function to simulate the roulette and ball movement, broadcasting the ball position
function simulateRouletteWithWebSocket() {
    const roulette = new Roulette(0.5, 20, 0.01); // High initial speed, low friction
    const ball = new Ball(0.02, 10, roulette.radius); // High initial ball speed

    let timeElapsed = 0;
    const deltaTime = 0.01; // Simulate in 10 ms time steps
    simulationInProgress = true;

    currentSimulationInterval = setInterval(() => {
        roulette.update(deltaTime);
        ball.update(deltaTime, roulette.angularVelocity);
        timeElapsed += deltaTime;
        broadcastBallPosition(ball);
        if (ball.velocity <= 0) {
            clearInterval(currentSimulationInterval);
            currentSimulationInterval = null; // Clear the interval and set to null
        }
    }, deltaTime * 1000); // Convert deltaTime to milliseconds for setInterval
}

// Reset the simulation
function resetSimulation() {
    if (currentSimulationInterval) {
        clearInterval(currentSimulationInterval); // Clear the current simulation interval if running
        currentSimulationInterval = null; // Set to null to indicate no simulation is running
    }
    simulationInProgress = false; // Reset the simulation status
    bets = []; // Clear any bets placed
    console.log('Roulette simulation reset.');
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'startSimulation') {
            console.log('Starting roulette simulation');
            resetSimulation(); // Reset any existing simulation before starting a new one
            simulateRouletteWithWebSocket();
        } else if (data.type === 'resetSimulation') {
            resetSimulation();
        } else if (data.type === 'placeBet') {
            // Place a bet
            bets.push({
                userId: ws.id,
                type: data.betType,
                value: data.betValue,
                amount: data.amount
            });
            console.log(`Bet placed: ${data.amount} on ${data.betType} ${data.betValue}`);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    // Assign a unique ID to each client
    ws.id = Date.now().toString(); // Use timestamp as a unique identifier
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
