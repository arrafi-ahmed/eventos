class ApiResponse {
    constructor(msg = null, payload = null) {
        this.msg = msg;
        this.payload = payload;
    }
}

module.exports = ApiResponse;
