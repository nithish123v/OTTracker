import { supabase } from "./supabase";
import { getQueue, deleteQueueItem, putPatient, putSession } from "./localDb";

export async function syncNow() {
  if (!navigator.onLine || !supabase) return { synced: 0, skipped: true };

  const queue = await getQueue();
  let synced = 0;

  for (const item of queue) {
    try {
      const { error } = item.operation === "delete"
        ? await supabase.from(item.table).delete().eq("id", item.payload.id)
        : await supabase.from(item.table).upsert(item.payload, {
            onConflict: item.table === "session_records"
              ? "patient_id,session_date"
              : "id",
          });

      if (error) throw error;
      await deleteQueueItem(item.id);
      synced++;
    } catch (err) {
      console.warn("Sync stopped for item", item, err);
      break;
    }
  }

  const [{ data: patients }, { data: sessions }] = await Promise.all([
    supabase.from("patients").select("*"),
    supabase.from("session_records").select("*"),
  ]);

  for (const p of patients || []) await putPatient(p);
  for (const row of sessions || []) {
    await putSession({ ...row, id: row.id || `${row.patient_id}_${row.session_date}` });
  }

  return { synced, skipped: false };
}
