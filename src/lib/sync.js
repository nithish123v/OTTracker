import { supabase } from "./supabase";
import { getQueue, deleteQueueItem, putPatient, putSession } from "./localDb";

export async function syncNow() {
  if (!navigator.onLine || !supabase) return { synced: 0, skipped: true };

  const queue = await getQueue();
  let synced = 0;

  for (const item of queue) {
    try {
      const table = item.table;
      const payload = item.payload;
      const { error } = item.operation === "delete"
        ? await supabase.from(table).delete().eq("id", payload.id)
        : await supabase.from(table).upsert(payload);

      if (error) throw error;
      await deleteQueueItem(item.id);
      synced++;
    } catch (err) {
      console.warn("Sync stopped for item", item, err);
      break;
    }
  }

  // Pull latest cloud data after pushing local changes.
  const [{ data: patients }, { data: sessions }] = await Promise.all([
    supabase.from("patients").select("*"),
    supabase.from("session_records").select("*")
  ]);

  for (const p of patients || []) await putPatient(p);
  for (const s of sessions || []) await putSession(s);

  return { synced, skipped: false };
}
