/** Cloud Functions deployment settings. */

// The default RTDB instance (festnetproject-default-rtdb.firebaseio.com) lives in us-central1;
// database triggers must run in the same region.
export const REGION = "us-central1";
export const DB_INSTANCE = "festnetproject-default-rtdb";
export const MAX_INSTANCES = 10;
