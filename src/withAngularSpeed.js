/**
 * @interface
 */
class WithAngularSpeed {
    constructor() { }
    get speed() {
        throw new Error('Not implemented');
    }
}

module.exports = {
    WithAngularSpeed
}