class Ball {
    /**
     * 
     * @param {Object} config
     * @param {number} config.angularVelocity
     * @param {number} config.initialAngle
     * @param {number} config.friction
     */
    constructor(config) {
        const { angularVelocity, initialAngle, friction } = config;
        this.velocity = angularVelocity ?? 0;
        this.angle = initialAngle ?? 0;
        this.friction = friction;
        this.stopPosition = null;
        this.diff = null;
    }

    /**
     * Starts the ball with a given initial speed and resets its state.
     * @param {number} angularVelocity - The initial speed of the ball.
     * @param {number} [initialAngle=0] - The initial angle of the ball.
     */
    start(angularVelocity) {
        this.velocity = angularVelocity;
        this.stopPosition = null;
        this.diff = null;
    }

    #calculateCurrentSpeed(deltaTime) {
        const g = 9.81;
        const a = this.friction * g;
        return Math.max(this.velocity - a * deltaTime, 0);
    }

    updateSpeed(deltaTime) {
        this.velocity = this.#calculateCurrentSpeed(deltaTime);
        if (this.velocity <= 0) this.stopPosition = this.angle;

    }

    updateAngle(deltaTime) {
        this.angle = (this.velocity * deltaTime + this.angle) % (2 * Math.PI);
    }

    update(deltaTime) {
        this.updateSpeed(deltaTime);
        this.updateAngle(deltaTime);
    }

    get stopped() {
        return this.speed === 0;
    }

    get speed() {
        return Math.max(this.velocity, 0);
    }

    /**
     * 
     * @param {import("./withAngularSpeed").WithAngularSpeed} roulette
     * @returns {number}
     */
    getRelativeSpeed(roulette) {
        return Math.abs(this.speed - roulette.speed)
    }

    /**
     * 
     * @param {import("./roulette").Roulette} roulette
     * @returns {number}
     */
    getRelativeAngle(roulette) {
        let angleDifference = this.angle - roulette.angle;
        if (angleDifference < 0) angleDifference += 2 * Math.PI;
        return angleDifference;
    }

    /**
     * 
     * @param {import("./roulette").Roulette} roulette
     * @returns {number}
    */
    getFinalAngle(roulette) {
        if (this.stopPosition !== null) {
            if (!this.diff) this.diff = this.getRelativeAngle(roulette);
            return (roulette.angle + this.diff) % (2 * Math.PI);
        }
        return this.angle;
    }

    /**
     * 
     * @param {import("./roulette").Roulette} roulette
     * @returns {number} segments' id
    */
    calculateSegment(roulette) {
        const segmentSizeInRad = (2 * Math.PI) / 37;
        if (this.diff) return Math.floor(this.diff / segmentSizeInRad);
        return Math.floor(this.getRelativeAngle(roulette) / segmentSizeInRad);
    }

}

module.exports = {
    Ball
}