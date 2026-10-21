"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFirestoreDB = getFirestoreDB;
exports.isUsingCloudFirestore = isUsingCloudFirestore;
const admin = __importStar(require("firebase-admin"));
let isFirebaseInitialized = false;
let db = null;
try {
    // Check if Firebase service account or emulator is present
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
        admin.initializeApp();
        db = admin.firestore();
        isFirebaseInitialized = true;
        console.log('[Firebase] Initialized Cloud Firestore successfully.');
    }
    else {
        console.log('[Firebase] Running in local/offline mode (in-memory data store active).');
    }
}
catch (err) {
    console.warn('[Firebase] Initialization skipped. Using local in-memory storage fallback.', err);
}
function getFirestoreDB() {
    return db;
}
function isUsingCloudFirestore() {
    return isFirebaseInitialized && db !== null;
}
//# sourceMappingURL=firebase.js.map