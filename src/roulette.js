/**
 * @typedef {import('./withAngularSpeed').WithAngularSpeed} WithAngularSpeed
 * /
/** 
 * @implements WithAngularSpeed
 */
class Roulette {
    /**
     * 
     * @param {Object} config
     * @param {number} [config.angularVelocity]
     * @param {number} config.friction
     * @param {number} [config.initialAngle]
     */
    constructor(config) {
        this.friction = config.friction;
        this.angularVelocity = config.angularVelocity ?? 0;
        this.angle = config.initialAngle ?? 0;
    }

    start(angularVelocity) {
        this.angularVelocity = angularVelocity;
    }

    update(deltaTime) {
        this.angle = (this.angle + this.angularVelocity * deltaTime) % (2 * Math.PI);
        this.angularVelocity = Math.max(0, this.angularVelocity - this.friction * deltaTime);
    }

    get stopped() {
        return this.angularVelocity <= 0;
    }

    get speed() {
        return this.angularVelocity;
    }
}

module.exports = {
    Roulette
}