class ApiResponse {
    constructor(msg = null, payload = null, success = true) {
        this.success = success;
        this.msg = msg;
        this.payload = payload;
    }
}

module.exports = ApiResponse;
