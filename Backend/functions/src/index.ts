/**
 * FestNet Cloud Functions entry point.
 * Each component exports its triggers from src/triggers/<component>.ts.
 */
import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

import { MAX_INSTANCES, REGION } from "./config/runtime";

initializeApp();
setGlobalOptions({ region: REGION, maxInstances: MAX_INSTANCES });

export * from "./triggers/health"; // C1
export * from "./triggers/alerts"; // C2
export * from "./triggers/crowd"; // C3
export * from "./triggers/wellness"; // C4
