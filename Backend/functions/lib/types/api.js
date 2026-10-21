"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
function successResponse(data, message) {
    return {
        success: true,
        message,
        data,
        timestamp: new Date().toISOString(),
    };
}
function errorResponse(error, status = 400) {
    return {
        success: false,
        error,
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=api.js.map