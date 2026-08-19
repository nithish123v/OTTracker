import { putPatient, putSession, queueChange } from "./localDb";

export async function savePatientOfflineFirst(patient) {
  const row = {
    id: patient.id,
    name: patient.name,
    ip_no: patient.ipNo,
    reg_no: patient.regNo,
    diagnosis: patient.diagnosis,
    category: patient.category,
    consulting_dr: patient.consultingDr,
    room_no: patient.roomNo,
    referral_date: patient.date,
  };
  await putPatient(row);
  await queueChange({ table: "patients", operation: "upsert", payload: row });
  return row;
}

export async function saveSessionOfflineFirst({ patientId, date, record, userId = null }) {
  const row = {
    patient_id: patientId,
    session_date: date,
    seen: record.seen,
    reason: record.reason || "",
    notes: record.notes || "",
  };
  await putSession({ ...row, id: `${patientId}_${date}` });
  await queueChange({ table: "session_records", operation: "upsert", payload: row });
  return row;
}

export function watchConnectivity(onChange) {
  const online = () => onChange(true);
  const offline = () => onChange(false);
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  return () => {
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
  };
}
