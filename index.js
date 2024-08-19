const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const { Ball } = require('./src/ball');
const { Roulette } = require('./src/roulette');

const app = express();
const PORT = 3003;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let currentSimulationInterval = null;
let bets = new Map();

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

/**
 * Broadcasts the current positions of the roulette and ball.
 * @param {Roulette} roulette 
 * @param {Ball} ball 
 */
function broadcastPositions(roulette, ball) {
    const segmentIndex = ball.calculateSegment(roulette);
    const data = {
        rouletteAngle: roulette.angle,
        angle: ball.getFinalAngle(roulette),
        velocity: ball.velocity,
        segment: segmentMap[segmentIndex]?.number || 0,
        color: segmentMap[segmentIndex]?.color || "Green"
    };
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(data));
            } catch (error) {
                console.error('Error sending data to client:', error);
            }
        }
    });
}

/**
 * Broadcasts the final result and calculates winnings.
 * @param {number} segmentIndex
 */
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
            try {
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
                    client.send(JSON.stringify({
                        message: 'Bet result',
                        bet,
                        winnings
                    }));
                }
            } catch (error) {
                console.error('Error sending final result to client:', error);
            }
        }
    });

    // Clear bets after processing
    bets.clear();
}

/**
 * Generates a random integer between a range.
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
function randomIntFromInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

const roulette = new Roulette({ friction: 1, initialAngle: 0 });
const ball = new Ball({ friction: 0.6, initialAngle: 0 });

/**
 * Starts the roulette and ball simulation.
 */
function simulateRouletteWithWebSocket() {
    const deltaTime = 0.02;

    // Start roulette and ball with random initial speeds
    if (roulette.stopped) roulette.start(randomIntFromInterval(4, 6));
    if (ball.stopped) ball.start(randomIntFromInterval(15, 25));

    // Simulation loop
    currentSimulationInterval = setInterval(() => {
        roulette.update(deltaTime);
        ball.update(deltaTime);
        broadcastPositions(roulette, ball);
        if (roulette.stopped && ball.stopped) {
            broadcastFinalResult(ball.calculateSegment(roulette));
            clearInterval(currentSimulationInterval);
            currentSimulationInterval = null;
        }
    }, deltaTime * 1000);
}

/**
 * Resets the simulation and clears bets.
 */
function resetSimulation() {
    if (currentSimulationInterval) {
        clearInterval(currentSimulationInterval);
        currentSimulationInterval = null;
    }
    bets.clear();
}

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'startSimulation') {
            console.log('Starting roulette simulation');
            resetSimulation();
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

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
