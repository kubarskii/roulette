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
let bets = new Map(); // Map to store bets with WebSocket as the key

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

function getRandomValueInRange(min, max) {
    return Math.random() * (max - min) + min;
}

// Linear interpolation function
function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

class Roulette {
    constructor(radius) {
        this.radius = radius;
        this.angularVelocity = 0;  // rad/s
        this.friction = 0;  // Deceleration rate
        this.angle = 0;  // Start at 0 radians
    }

    start() {
        this.angularVelocity = getRandomValueInRange(4, 5);  // Randomize initial speed
        this.friction = getRandomValueInRange(0.1, 0.2);  // Randomize friction
    }

    update(deltaTime) {
        this.angle = (this.angle + this.angularVelocity * deltaTime) % (2 * Math.PI);  // Update angle
        this.angularVelocity = Math.max(0, this.angularVelocity - this.friction * deltaTime);  // Apply friction
    }

    isStopped() {
        return this.angularVelocity <= 0;
    }
}

class Ball {
    constructor(radius, rouletteRadius) {
        this.radius = radius;
        this.velocity = 0;  // m/s
        this.friction = 0;  // Deceleration rate specific to the ball
        this.angleRelativeToTable = 0;  // Start at 0 radians relative to the table
        this.rouletteRadius = rouletteRadius;
        this.hasFallen = false;  // Flag to check if the ball has fallen into a segment
        this.smoothingFactor = 0.1;  // Smoothing factor for angle transition
    }

    start() {
        this.velocity = getRandomValueInRange(4, 5);  // Randomize initial ball speed
        this.friction = getRandomValueInRange(0.3, 0.4);  // Randomize ball friction
        this.hasFallen = false;  // Reset the flag when starting
    }

    update(deltaTime, roulette) {
        if (this.velocity > 0) {
            this.angleRelativeToTable = (this.angleRelativeToTable + this.velocity * deltaTime / this.rouletteRadius) % (2 * Math.PI);  // Update angle relative to table
            this.velocity = Math.max(0, this.velocity - this.friction * deltaTime);  // Apply deceleration

            if (this.velocity < 0.1) {  // Near stopping
                // Reduce velocity even more smoothly
                this.velocity *= 0.9;
            }

            if (this.velocity === 0) {
                this.hasFallen = true;
                console.log(this.angleRelativeToTable, roulette.angle);
                // Smoothly transition the angle to align with the roulette's angle
                const targetAngle = (this.angleRelativeToTable + roulette.angle) % (2 * Math.PI);
                this.angleRelativeToTable = lerp(this.angleRelativeToTable, targetAngle, this.smoothingFactor);
            }
        } else if (this.hasFallen) {
            // Once the ball has fallen, it moves with the roulette wheel
            this.angleRelativeToTable = (this.angleRelativeToTable + roulette.angularVelocity * deltaTime) % (2 * Math.PI);
        }
    }

    isStopped() {
        return this.velocity <= 0 && this.hasFallen;
    }

    getAngleRelativeToRoulette(rouletteAngle) {
        // Calculate the ball's angle relative to the moving roulette wheel
        return (this.angleRelativeToTable - rouletteAngle + 2 * Math.PI) % (2 * Math.PI);
    }

    calculateSegment(rouletteAngle) {
        const anglePerSegment = 2 * Math.PI / segmentMap.length;
        const angleRelativeToRoulette = this.getAngleRelativeToRoulette(rouletteAngle);
        return Math.floor(angleRelativeToRoulette / anglePerSegment);
    }
}

function broadcastPositions(roulette, ball) {
    const segmentIndex = ball.calculateSegment(roulette.angle);
    const data = {
        rouletteAngle: roulette.angle,  // Send exact angle of roulette
        ballAngleRelativeToTable: ball.angleRelativeToTable,  // Send exact angle of ball relative to table
        ballAngleRelativeToRoulette: ball.getAngleRelativeToRoulette(roulette.angle),  // Send exact angle of ball relative to roulette
        velocity: ball.velocity.toFixed(2),
        segment: segmentMap[segmentIndex]?.number || "Unknown",
        color: segmentMap[segmentIndex]?.color || "Unknown"
    };

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

function broadcastFinalResult(segmentIndex) {
    const finalSegment = segmentMap[segmentIndex]?.number || "Unknown";
    const finalColor = segmentMap[segmentIndex]?.color || "Unknown";
    const finalResult = {
        message: 'Ball has stopped',
        finalSegment,
        color: finalColor
    };

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(finalResult));
            const bet = bets.get(client);
            if (bet) {
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

                console.log(`User wins: ${winnings}`);  // Debugging Output

                client.send(JSON.stringify({
                    message: 'Bet result',
                    bet,
                    winnings
                }));
                bets.delete(client);
            }
        }
    });

    simulationInProgress = false;
}

const roulette = new Roulette(0.5);  // Define roulette radius
const ball = new Ball(0.02, roulette.radius);  // Define ball radius and associate with roulette

function simulateRouletteWithWebSocket() {
    roulette.start();
    ball.start();
    const deltaTime = 0.01;  // Time step for the simulation
    simulationInProgress = true;
    currentSimulationInterval = setInterval(() => {
        roulette.update(deltaTime);
        ball.update(deltaTime, roulette);
        broadcastPositions(roulette, ball);
        if (roulette.isStopped() && ball.isStopped()) {
            broadcastFinalResult(ball.calculateSegment(roulette.angle));
            clearInterval(currentSimulationInterval);
            currentSimulationInterval = null;
        }
    }, deltaTime * 1000);
}

function resetSimulation() {
    if (currentSimulationInterval) {
        clearInterval(currentSimulationInterval);
        currentSimulationInterval = null;
    }
    simulationInProgress = false;
    bets.clear(); // Clear all bets on reset
}

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'startSimulation') {
            console.log('Starting roulette simulation');
            simulateRouletteWithWebSocket();
        } else if (data.type === 'resetSimulation') {
            resetSimulation();
        } else if (data.type === 'placeBet') {
            bets.set(ws, {
                type: data.betType,
                value: data.betValue,
                amount: data.amount
            });
            console.log(`Bet placed: ${data.amount} on ${data.betType} ${data.betValue}`);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        bets.delete(ws); // Remove bets for the disconnected client
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
