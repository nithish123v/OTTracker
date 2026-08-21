import { openDB } from "idb";

const DB_NAME = "ottrack-local";
const DB_VERSION = 1;

export const db = openDB(DB_NAME, DB_VERSION, {
  upgrade(database) {
    if (!database.objectStoreNames.contains("patients")) {
      database.createObjectStore("patients", { keyPath: "id" });
    }
    if (!database.objectStoreNames.contains("sessions")) {
      const store = database.createObjectStore("sessions", { keyPath: "id" });
      store.createIndex("by-date", "session_date");
      store.createIndex("by-patient", "patient_id");
    }
    if (!database.objectStoreNames.contains("sync_queue")) {
      const store = database.createObjectStore("sync_queue", { keyPath: "id", autoIncrement: true });
      store.createIndex("by-created", "created_at");
    }
  }
});

export async function putPatient(patient) {
  return (await db).put("patients", patient);
}
export async function getPatients() {
  return (await db).getAll("patients");
}
export async function putSession(session) {
  return (await db).put("sessions", session);
}
export async function getSessions() {
  return (await db).getAll("sessions");
}
export async function queueChange(change) {
  return (await db).add("sync_queue", { ...change, created_at: new Date().toISOString() });
}
export async function getQueue() {
  return (await db).getAll("sync_queue");
}
export async function deleteQueueItem(id) {
  return (await db).delete("sync_queue", id);
}
