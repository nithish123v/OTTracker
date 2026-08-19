import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const COLORS = {
  bg: "#f0f4f8",
  card: "#ffffff",
  sidebar: "#0b1437",
  accent: "#4e6ef2",
  seen: "#00c9a7",
  notseen: "#e63757",
  text: "#1a202c",
  muted: "#718096",
  border: "#e2e8f0",
};

const CATEGORIES = ["All", "TBI", "CVA", "Department", "New IOC Cases"];

const NOT_SEEN_REASONS = [
  "Patient not available",
  "Refused therapy",
  "Medical condition / unwell",
  "Procedure / surgery scheduled",
  "Discharged",
  "Weekend / holiday",
  "Doctor's orders",
  "Family request",
  "Other",
];

const CAT_COLORS = {
  TBI:            { bg: "#fff3e0", color: "#e65100", border: "#ffcc80" },
  CVA:            { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7" },
  Department:     { bg: "#e3f2fd", color: "#1565c0", border: "#90caf9" },
  "New IOC Cases":{ bg: "#f3e5f5", color: "#6a1b9a", border: "#ce93d8" },
};

const today = () => new Date().toISOString().split("T")[0];
const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const SAMPLE = [
  { id:1, name:"Ravi Kumar",    ipNo:"IP2408001", regNo:"REG001", diagnosis:"Left MCA Infarct with Hemiplegia",   category:"CVA",             consultingDr:"Dr. Mehta",  roomNo:"N-04", date: today() },
  { id:2, name:"Ananya Sharma", ipNo:"IP2408002", regNo:"REG002", diagnosis:"Traumatic Brain Injury - Grade III", category:"TBI",             consultingDr:"Dr. Pillai", roomNo:"N-07", date: today() },
  { id:3, name:"Suresh Babu",   ipNo:"IP2408003", regNo:"REG003", diagnosis:"Post-op Hand Reconstruction",        category:"Department",      consultingDr:"Dr. Singh",  roomNo:"O-03", date: today() },
  { id:4, name:"Priya Nair",    ipNo:"IP2408004", regNo:"REG004", diagnosis:"Spastic Diplegia",                   category:"New IOC Cases",   consultingDr:"Dr. Kavitha",roomNo:"P-07", date: today() },
  { id:5, name:"Mohammed Asif", ipNo:"IP2408005", regNo:"REG005", diagnosis:"Right MCA Infarct",                  category:"CVA",             consultingDr:"Dr. Rao",    roomNo:"N-02", date: today() },
  { id:6, name:"Lakshmi Devi",  ipNo:"IP2408006", regNo:"REG006", diagnosis:"Diffuse Axonal Injury",              category:"TBI",             consultingDr:"Dr. Iyer",   roomNo:"I-03", date: today() },
];

const EMPTY_FORM = { name:"", ipNo:"", regNo:"", diagnosis:"", category:"CVA", consultingDr:"", roomNo:"", date: today() };

const PATIENTS_KEY = "ot-patients";
const RECORDS_KEY = "ot-records";

export default function OTTracker() {
  const [patients, setPatients]         = useState([]);
  const [activeTab, setActiveTab]       = useState("All");
  const [sessionDate, setSessionDate]   = useState(today());
  const [records, setRecords]           = useState({});   // { date: { patientId: { seen, reason, notes } } }
  const [showAdd, setShowAdd]           = useState(false);
  const [editingId, setEditingId]       = useState(null); // id of patient being edited, or null when adding new
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [expandedId, setExpandedId]     = useState(null);
  const [search, setSearch]             = useState("");
  const [toast, setToast]               = useState(null);
  const [view, setView]                 = useState("today"); // "today" | "history"
  const [loaded, setLoaded]             = useState(false);
  const [saving, setSaving]             = useState(false);
  const loadedOnce = useRef(false);

  const showToast = (msg, type="success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  // ── Load persisted data on mount ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loadedPatients = null;
      let loadedRecords = null;
      try {
        const p = await window.storage.get(PATIENTS_KEY);
        if (p && p.value) loadedPatients = JSON.parse(p.value);
      } catch (e) { /* key not found yet - first run */ }
      try {
        const r = await window.storage.get(RECORDS_KEY);
        if (r && r.value) loadedRecords = JSON.parse(r.value);
      } catch (e) { /* key not found yet - first run */ }

      if (cancelled) return;
      setPatients(loadedPatients && loadedPatients.length ? loadedPatients : SAMPLE);
      setRecords(loadedRecords || {});
      setLoaded(true);
      loadedOnce.current = true;
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Persist patients whenever they change ──
  useEffect(() => {
    if (!loadedOnce.current) return;
    (async () => {
      setSaving(true);
      try {
        await window.storage.set(PATIENTS_KEY, JSON.stringify(patients));
      } catch (e) { showToast("Could not save patients", "warn"); }
      setSaving(false);
    })();
  }, [patients]);

  // ── Persist records whenever they change ──
  useEffect(() => {
    if (!loadedOnce.current) return;
    (async () => {
      setSaving(true);
      try {
        await window.storage.set(RECORDS_KEY, JSON.stringify(records));
      } catch (e) { showToast("Could not save records", "warn"); }
      setSaving(false);
    })();
  }, [records]);

  const getRecord = (pid) => (records[sessionDate] || {})[pid] || { seen: null, reason: "", notes: "" };

  const setRecord = (pid, patch) => {
    setRecords(prev => ({
      ...prev,
      [sessionDate]: {
        ...(prev[sessionDate] || {}),
        [pid]: { ...getRecord(pid), ...patch }
      }
    }));
  };

  const markSeen = (pid) => { setRecord(pid, { seen: true, reason: "" }); showToast("Marked as Seen ✓"); };
  const markNotSeen = (pid, reason) => { setRecord(pid, { seen: false, reason }); };

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowAdd(true);
  };

  const openEditForm = (p) => {
    setEditingId(p.id);
    setForm({ name:p.name, ipNo:p.ipNo, regNo:p.regNo, diagnosis:p.diagnosis, category:p.category, consultingDr:p.consultingDr, roomNo:p.roomNo, date:p.date });
    setShowAdd(true);
    setExpandedId(null);
  };

  const closeForm = () => { setShowAdd(false); setEditingId(null); setForm(EMPTY_FORM); };

  const savePatient = () => {
    if (!form.name.trim() || !form.ipNo.trim()) return;
    if (editingId) {
      setPatients(p => p.map(x => x.id === editingId ? { ...x, ...form } : x));
      showToast("Patient updated!");
    } else {
      setPatients(p => [{ ...form, id: Date.now() }, ...p]);
      showToast("Patient added!");
    }
    closeForm();
  };

  const removePatient = (id) => {
    setPatients(p => p.filter(x => x.id !== id));
    setRecords(prev => {
      const next = {};
      Object.keys(prev).forEach(d => {
        const { [id]: _drop, ...rest } = prev[d];
        next[d] = rest;
      });
      return next;
    });
    setExpandedId(null);
    showToast("Patient removed", "warn");
  };

  const buildRows = () => {
    const rows = [["Date","IP No","Reg No","Name","Category","Diagnosis","Consulting Dr","Room No","Status","Reason / Notes"]];
    Object.keys(records).sort().forEach(d => {
      patients.forEach(p => {
        const r = (records[d] || {})[p.id];
        if (r) rows.push([d, p.ipNo, p.regNo, p.name, p.category, p.diagnosis, p.consultingDr, p.roomNo,
          r.seen === true ? "Seen" : r.seen === false ? "Not Seen" : "Pending",
          r.seen === false ? r.reason : r.notes || ""]);
      });
    });
    return rows;
  };

  const exportExcel = () => {
    const rows = buildRows();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 14 },
      { wch: 28 }, { wch: 14 }, { wch: 9 }, { wch: 10 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Session Records");

    const patRows = [["Name","IP No","Reg No","Category","Diagnosis","Consulting Dr","Room No","Date of Referral"]];
    patients.forEach(p => patRows.push([p.name,p.ipNo,p.regNo,p.category,p.diagnosis,p.consultingDr,p.roomNo,p.date]));
    const ws2 = XLSX.utils.aoa_to_sheet(patRows);
    ws2["!cols"] = [{ wch:18 },{ wch:12 },{ wch:10 },{ wch:14 },{ wch:28 },{ wch:14 },{ wch:9 },{ wch:14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Patient List");

    XLSX.writeFile(wb, `OT_records_${today()}.xlsx`);
    showToast("Exported to Excel!");
  };

  const filtered = patients.filter(p => {
    const catMatch = activeTab === "All" || p.category === activeTab;
    const q = search.toLowerCase();
    const srch = !q || [p.name,p.ipNo,p.regNo,p.diagnosis,p.consultingDr,p.roomNo].some(f=>(f||"").toLowerCase().includes(q));
    return catMatch && srch;
  });

  const todayRecs = records[sessionDate] || {};
  const seen    = patients.filter(p => todayRecs[p.id]?.seen === true).length;
  const notSeen = patients.filter(p => todayRecs[p.id]?.seen === false).length;
  const pending = patients.length - seen - notSeen;

  const allDates = Object.keys(records).filter(d => Object.keys(records[d]||{}).length > 0).sort().reverse();

  if (!loaded) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
        background: COLORS.bg, fontFamily:"'DM Sans','Segoe UI',sans-serif", color: COLORS.muted }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🧠</div>
          <div style={{ fontWeight:700 }}>Loading your OT records…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background: COLORS.bg, fontFamily:"'DM Sans','Segoe UI',sans-serif", color: COLORS.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn   { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
        .hvr:hover { background:#f7faff !important; }
        .btn:hover { opacity:0.85; transform:translateY(-1px); }
        textarea, input, select { outline:none; }
        input:focus, select:focus, textarea:focus { border-color:#4e6ef2 !important; box-shadow:0 0 0 3px rgba(78,110,242,0.10); }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:#cbd5e0; border-radius:99px; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:18, right:18, zIndex:9999,
          background: toast.type==="warn" ? "#e63757" : "#00c9a7",
          color:"#fff", padding:"11px 22px", borderRadius:12, fontWeight:700, fontSize:13,
          boxShadow:"0 8px 30px rgba(0,0,0,0.18)", animation:"fadeUp 0.25s ease" }}>
          {toast.msg}
        </div>
      )}

      {/* Saving indicator */}
      {saving && (
        <div style={{ position:"fixed", bottom:16, right:18, zIndex:9999,
          background:"#1a2a5e", color:"#a0aec0", padding:"6px 14px", borderRadius:10,
          fontWeight:600, fontSize:11 }}>
          Saving…
        </div>
      )}

      <div style={{ display:"flex", minHeight:"100vh" }}>

        {/* ── SIDEBAR ── */}
        <div style={{ width:210, background: COLORS.sidebar, display:"flex", flexDirection:"column", flexShrink:0, padding:"24px 0" }}>
          <div style={{ padding:"0 18px 24px" }}>
            <div style={{ fontSize:18, fontWeight:900, color:"#fff", letterSpacing:-0.5 }}>
              🧠 <span style={{ color:"#4e6ef2" }}>OT</span>Track
            </div>
            <div style={{ fontSize:10, color:"#4a5568", marginTop:3, fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>
              Occupational Therapy
            </div>
          </div>

          {[
            { id:"today",   icon:"📋", label:"Today's Cases" },
            { id:"history", icon:"📅", label:"Session History" },
          ].map(item => (
            <button key={item.id} onClick={() => setView(item.id)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 18px",
                background: view===item.id ? "#1a2a5e" : "transparent",
                border:"none", color: view===item.id ? "#fff" : "#718096",
                fontFamily:"inherit", fontSize:13, fontWeight: view===item.id ? 700 : 500,
                cursor:"pointer", textAlign:"left", width:"100%",
                borderLeft: view===item.id ? "3px solid #4e6ef2" : "3px solid transparent",
                transition:"all 0.18s" }}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}

          <div style={{ height:1, background:"#1e2a4a", margin:"16px 18px" }} />

          {/* Category filters */}
          <div style={{ padding:"0 18px 8px", fontSize:10, color:"#4a5568", fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>
            Category
          </div>
          {CATEGORIES.map(cat => {
            const count = cat === "All" ? patients.length : patients.filter(p=>p.category===cat).length;
            return (
              <button key={cat} onClick={() => setActiveTab(cat)}
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"8px 18px", background: activeTab===cat ? "#1a2a5e" : "transparent",
                  border:"none", color: activeTab===cat ? "#fff" : "#718096",
                  fontFamily:"inherit", fontSize:12, fontWeight: activeTab===cat ? 700 : 500,
                  cursor:"pointer", textAlign:"left", width:"100%",
                  borderLeft: activeTab===cat ? "3px solid #4e6ef2" : "3px solid transparent",
                  transition:"all 0.18s" }}>
                <span>{cat}</span>
                <span style={{ background: activeTab===cat ? "#4e6ef2" : "#1e2a4a", color:"#fff",
                  borderRadius:99, padding:"1px 7px", fontSize:10, fontWeight:800 }}>{count}</span>
              </button>
            );
          })}

          <div style={{ flex:1 }} />

          <div style={{ padding:"0 14px", display:"flex", flexDirection:"column", gap:8 }}>
            <button className="btn" onClick={() => (showAdd ? closeForm() : openAddForm())}
              style={{ background: showAdd?"#1e2a4a":"#4e6ef2", border:"none", color:"#fff",
                padding:"10px", borderRadius:10, fontWeight:700, fontSize:12, cursor:"pointer",
                fontFamily:"inherit", transition:"all 0.2s" }}>
              {showAdd ? "✕ Cancel" : "+ Add Patient"}
            </button>
            <button className="btn" onClick={exportExcel}
              style={{ background:"#1e2a4a", border:"1px solid #2a3a5e", color:"#a0aec0",
                padding:"10px", borderRadius:10, fontWeight:700, fontSize:12, cursor:"pointer",
                fontFamily:"inherit", transition:"all 0.2s" }}>
              ⬇ Export Excel
            </button>
          </div>
        </div>

        {/* ── MAIN ── */}
        <div style={{ flex:1, padding:"24px", overflow:"auto" }}>

          {/* ── HEADER ── */}
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
            <div>
              <h2 style={{ fontWeight:900, fontSize:22, color: COLORS.text }}>
                {view==="today" ? "Today's OT Cases" : "Session History"}
              </h2>
              <p style={{ color: COLORS.muted, fontSize:12, marginTop:3 }}>
                {view==="today" ? `${filtered.length} patients · ${activeTab} category` : `${allDates.length} session records`}
              </p>
            </div>
            {view==="today" && (
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <label style={{ fontSize:12, fontWeight:600, color: COLORS.muted }}>Session Date</label>
                <input type="date" value={sessionDate} onChange={e=>setSessionDate(e.target.value)}
                  style={{ padding:"8px 12px", borderRadius:9, border:`1.5px solid ${COLORS.border}`,
                    fontSize:13, fontFamily:"inherit", fontWeight:600, background:"#fff", color: COLORS.text }} />
              </div>
            )}
          </div>

          {/* ── STATS ROW ── */}
          {view==="today" && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
              {[
                { label:"Total", val: patients.length, color:"#4e6ef2", bg:"#ebedff", icon:"📋" },
                { label:"Seen",  val: seen,            color:"#00c9a7", bg:"#e6faf7", icon:"✅" },
                { label:"Not Seen", val: notSeen,      color:"#e63757", bg:"#fdeef1", icon:"❌" },
                { label:"Pending",  val: pending,      color:"#f6c90e", bg:"#fffbe6", icon:"⏳" },
              ].map(s => (
                <div key={s.label} style={{ background: COLORS.card, borderRadius:12, padding:"14px 16px",
                  border:`1.5px solid ${s.color}22`, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
                  <div style={{ fontSize:18, marginBottom:4 }}>{s.icon}</div>
                  <div style={{ fontSize:24, fontWeight:900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize:11, color: COLORS.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── ADD / EDIT PATIENT FORM ── */}
          {showAdd && (
            <div style={{ background: COLORS.card, borderRadius:14, padding:20, marginBottom:18,
              border:`1.5px solid #4e6ef244`, boxShadow:"0 4px 20px rgba(78,110,242,0.10)", animation:"popIn 0.25s ease" }}>
              <div style={{ fontWeight:800, color:"#4e6ef2", marginBottom:14, fontSize:14 }}>
                {editingId ? "✏️ Edit Patient" : "🧠 New OT Patient"}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10 }}>
                {[
                  { key:"name",        label:"Patient Name *",    type:"text",   full:false },
                  { key:"ipNo",        label:"IP Number *",       type:"text",   full:false },
                  { key:"regNo",       label:"Reg Number",        type:"text",   full:false },
                  { key:"consultingDr",label:"Consulting Doctor", type:"text",   full:false },
                  { key:"roomNo",      label:"Room / Bed No",     type:"text",   full:false },
                  { key:"date",        label:"Date of Referral",  type:"date",   full:false },
                ].map(f => (
                  <div key={f.key} style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    <label style={{ fontSize:11, fontWeight:700, color: COLORS.muted, textTransform:"uppercase", letterSpacing:0.6 }}>{f.label}</label>
                    <input type={f.type} value={form[f.key]} onChange={e=>setForm(x=>({...x,[f.key]:e.target.value}))}
                      style={{ padding:"9px 12px", borderRadius:9, border:`1.5px solid ${COLORS.border}`,
                        fontSize:13, fontFamily:"inherit", background:"#f7fafc", color: COLORS.text, transition:"all 0.2s" }} />
                  </div>
                ))}

                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={{ fontSize:11, fontWeight:700, color: COLORS.muted, textTransform:"uppercase", letterSpacing:0.6 }}>Category</label>
                  <select value={form.category} onChange={e=>setForm(x=>({...x,category:e.target.value}))}
                    style={{ padding:"9px 12px", borderRadius:9, border:`1.5px solid ${COLORS.border}`,
                      fontSize:13, fontFamily:"inherit", background:"#f7fafc", color: COLORS.text }}>
                    {CATEGORIES.filter(c=>c!=="All").map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:4, gridColumn:"1/-1" }}>
                  <label style={{ fontSize:11, fontWeight:700, color: COLORS.muted, textTransform:"uppercase", letterSpacing:0.6 }}>Diagnosis *</label>
                  <input type="text" value={form.diagnosis} onChange={e=>setForm(x=>({...x,diagnosis:e.target.value}))}
                    placeholder="Enter primary diagnosis..."
                    style={{ padding:"9px 12px", borderRadius:9, border:`1.5px solid ${COLORS.border}`,
                      fontSize:13, fontFamily:"inherit", background:"#f7fafc", color: COLORS.text, transition:"all 0.2s" }} />
                </div>
              </div>
              <div style={{ display:"flex", gap:10, marginTop:14 }}>
                <button className="btn" onClick={savePatient}
                  style={{ background:"#4e6ef2", border:"none", color:"#fff",
                    padding:"11px 28px", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer",
                    fontFamily:"inherit", transition:"all 0.2s" }}>
                  {editingId ? "✓ Save Changes" : "✓ Add Patient"}
                </button>
                <button className="btn" onClick={closeForm}
                  style={{ background:"#f7fafc", border:`1.5px solid ${COLORS.border}`, color: COLORS.muted,
                    padding:"11px 20px", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer",
                    fontFamily:"inherit", transition:"all 0.2s" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── SEARCH ── */}
          {view==="today" && (
            <input placeholder="🔍  Search by name, IP no, reg no, diagnosis, doctor, room..."
              value={search} onChange={e=>setSearch(e.target.value)}
              style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:`1.5px solid ${COLORS.border}`,
                fontSize:13, fontFamily:"inherit", background:"#fff", marginBottom:14, color: COLORS.text, transition:"all 0.2s" }} />
          )}

          {/* ── TODAY'S PATIENT LIST ── */}
          {view==="today" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10, animation:"fadeUp 0.3s ease" }}>
              {filtered.length === 0 && (
                <div style={{ textAlign:"center", padding:"50px 20px", color: COLORS.muted }}>
                  <div style={{ fontSize:36 }}>🔍</div>
                  <div style={{ fontWeight:700, fontSize:16, marginTop:10 }}>No patients found</div>
                </div>
              )}
              {filtered.map(p => {
                const rec = getRecord(p.id);
                const catStyle = CAT_COLORS[p.category] || { bg:"#f7fafc", color:"#718096", border:"#e2e8f0" };
                const isExpanded = expandedId === p.id;

                return (
                  <div key={p.id} style={{ background: COLORS.card, borderRadius:14,
                    border: rec.seen === true  ? "1.5px solid #00c9a744" :
                            rec.seen === false ? "1.5px solid #e6375744" : `1.5px solid ${COLORS.border}`,
                    boxShadow:"0 2px 8px rgba(0,0,0,0.05)", overflow:"hidden", transition:"all 0.2s" }}>

                    {/* Row */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr auto", alignItems:"center",
                      padding:"14px 16px", gap:12, cursor:"pointer" }}
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}>

                      <div style={{ display:"flex", alignItems:"flex-start", gap:12, minWidth:0 }}>
                        {/* Category badge */}
                        <div style={{ background: catStyle.bg, color: catStyle.color,
                          border:`1px solid ${catStyle.border}`, padding:"3px 10px", borderRadius:7,
                          fontSize:10, fontWeight:800, whiteSpace:"nowrap", marginTop:2, flexShrink:0 }}>
                          {p.category}
                        </div>

                        <div style={{ minWidth:0 }}>
                          <div style={{ fontWeight:800, fontSize:14 }}>{p.name}</div>
                          <div style={{ fontSize:12, color: COLORS.muted, marginTop:2 }}>{p.diagnosis}</div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
                            {[
                              { label:"IP", val: p.ipNo },
                              { label:"Reg", val: p.regNo },
                              { label:"Dr", val: p.consultingDr },
                              { label:"Room", val: p.roomNo },
                            ].map(f => f.val ? (
                              <span key={f.label} style={{ fontSize:11, background:"#f0f4f8",
                                color:"#4a5568", padding:"2px 8px", borderRadius:6, fontWeight:600 }}>
                                <span style={{ color: COLORS.muted }}>{f.label}: </span>{f.val}
                              </span>
                            ) : null)}
                          </div>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
                        <div style={{
                          background: rec.seen === true  ? "#e6faf7" : rec.seen === false ? "#fdeef1" : "#f7fafc",
                          color:       rec.seen === true  ? "#00c9a7" : rec.seen === false ? "#e63757" : "#a0aec0",
                          border:      `1.5px solid ${rec.seen===true?"#00c9a7":rec.seen===false?"#e63757":"#e2e8f0"}`,
                          padding:"5px 14px", borderRadius:8, fontWeight:800, fontSize:12, whiteSpace:"nowrap"
                        }}>
                          {rec.seen === true ? "✅ Seen" : rec.seen === false ? "❌ Not Seen" : "⏳ Pending"}
                        </div>
                        <div style={{ fontSize:11, color:"#a0aec0" }}>{isExpanded ? "▲ collapse" : "▼ expand"}</div>
                      </div>
                    </div>

                    {/* Expanded panel */}
                    {isExpanded && (
                      <div style={{ borderTop:`1px solid ${COLORS.border}`, padding:"16px", background:"#fafcff", animation:"fadeUp 0.2s ease" }}>

                        {/* Seen / Not Seen / Edit / Remove buttons */}
                        <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
                          <button className="btn" onClick={() => markSeen(p.id)}
                            style={{ background: rec.seen===true ? "#00c9a7" : "#e6faf7",
                              border:`1.5px solid #00c9a7`, color: rec.seen===true?"#fff":"#00c9a7",
                              padding:"9px 22px", borderRadius:10, fontWeight:800, fontSize:13,
                              cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s" }}>
                            ✅ Seen
                          </button>
                          <button className="btn" onClick={() => markNotSeen(p.id, rec.reason || "")}
                            style={{ background: rec.seen===false ? "#e63757" : "#fdeef1",
                              border:`1.5px solid #e63757`, color: rec.seen===false?"#fff":"#e63757",
                              padding:"9px 22px", borderRadius:10, fontWeight:800, fontSize:13,
                              cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s" }}>
                            ❌ Not Seen
                          </button>
                          <button className="btn" onClick={() => openEditForm(p)}
                            style={{ background:"#ebedff", border:`1.5px solid #4e6ef2`,
                              color:"#4e6ef2", padding:"9px 18px", borderRadius:10, fontWeight:700, fontSize:13,
                              cursor:"pointer", fontFamily:"inherit", marginLeft:"auto", transition:"all 0.2s" }}>
                            ✏️ Edit
                          </button>
                          <button className="btn" onClick={() => removePatient(p.id)}
                            style={{ background:"#f7fafc", border:`1.5px solid ${COLORS.border}`,
                              color: COLORS.muted, padding:"9px 16px", borderRadius:10, fontWeight:700, fontSize:13,
                              cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s" }}>
                            🗑 Remove
                          </button>
                        </div>

                        {/* Not seen reason */}
                        {rec.seen === false && (
                          <div style={{ marginBottom:12, animation:"fadeUp 0.2s ease" }}>
                            <label style={{ fontSize:11, fontWeight:700, color:"#e63757", textTransform:"uppercase", letterSpacing:0.6, display:"block", marginBottom:6 }}>
                              Reason for Not Seen *
                            </label>
                            <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:8 }}>
                              {NOT_SEEN_REASONS.map(r => (
                                <button key={r} className="btn" onClick={() => setRecord(p.id, { reason: r })}
                                  style={{ padding:"6px 13px", borderRadius:8, border:`1.5px solid ${rec.reason===r?"#e63757":"#e2e8f0"}`,
                                    background: rec.reason===r ? "#fdeef1" : "#fff",
                                    color: rec.reason===r ? "#e63757" : COLORS.muted,
                                    fontWeight: rec.reason===r ? 700 : 500, fontSize:12,
                                    cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" }}>
                                  {r}
                                </button>
                              ))}
                            </div>
                            {(rec.reason === "Other" || !NOT_SEEN_REASONS.slice(0,-1).includes(rec.reason)) && (
                              <input placeholder="Specify reason..."
                                value={NOT_SEEN_REASONS.includes(rec.reason) && rec.reason!=="Other" ? "" : rec.reason}
                                onChange={e => setRecord(p.id, { reason: e.target.value })}
                                style={{ width:"100%", padding:"9px 12px", borderRadius:9, border:`1.5px solid #e63757`,
                                  fontSize:13, fontFamily:"inherit", background:"#fff5f5", color: COLORS.text }} />
                            )}
                          </div>
                        )}

                        {/* Session notes */}
                        <div>
                          <label style={{ fontSize:11, fontWeight:700, color: COLORS.muted, textTransform:"uppercase", letterSpacing:0.6, display:"block", marginBottom:6 }}>
                            📝 Session Notes / Observations
                          </label>
                          <textarea
                            placeholder="Treatment given, progress, goals, recommendations..."
                            value={rec.notes || ""}
                            onChange={e => setRecord(p.id, { notes: e.target.value })}
                            style={{ width:"100%", minHeight:80, padding:"10px 12px", borderRadius:10,
                              border:`1.5px solid ${COLORS.border}`, fontSize:13, fontFamily:"inherit",
                              resize:"vertical", color: COLORS.text, background:"#fff", transition:"all 0.2s" }} />
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── SESSION HISTORY ── */}
          {view==="history" && (
            <div style={{ animation:"fadeUp 0.3s ease" }}>
              {allDates.length === 0 ? (
                <div style={{ textAlign:"center", padding:"60px 20px", color: COLORS.muted }}>
                  <div style={{ fontSize:40 }}>📭</div>
                  <div style={{ fontWeight:700, fontSize:16, marginTop:10 }}>No session records yet</div>
                  <div style={{ fontSize:13, marginTop:6 }}>Mark patients as seen/not seen to build history</div>
                </div>
              ) : allDates.map(d => {
                const drec = records[d] || {};
                const s = Object.values(drec).filter(r=>r.seen===true).length;
                const ns= Object.values(drec).filter(r=>r.seen===false).length;
                const total = Object.keys(drec).length;
                return (
                  <div key={d} style={{ background: COLORS.card, borderRadius:14, marginBottom:12,
                    border:`1px solid ${COLORS.border}`, boxShadow:"0 2px 8px rgba(0,0,0,0.05)", overflow:"hidden" }}>
                    <div style={{ padding:"14px 18px", borderBottom:`1px solid ${COLORS.border}`,
                      display:"flex", justifyContent:"space-between", alignItems:"center", background:"#f7fafc" }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:15 }}>{fmtDate(d)}</div>
                        <div style={{ fontSize:12, color: COLORS.muted, marginTop:2 }}>{total} patients recorded</div>
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <span style={{ background:"#e6faf7", color:"#00c9a7", padding:"4px 12px", borderRadius:8, fontWeight:700, fontSize:12 }}>✅ {s} Seen</span>
                        <span style={{ background:"#fdeef1", color:"#e63757", padding:"4px 12px", borderRadius:8, fontWeight:700, fontSize:12 }}>❌ {ns} Not Seen</span>
                      </div>
                    </div>
                    <div style={{ padding:"12px 18px", display:"flex", flexDirection:"column", gap:8 }}>
                      {patients.filter(p => drec[p.id]).map(p => {
                        const r = drec[p.id];
                        const catStyle = CAT_COLORS[p.category] || {};
                        return (
                          <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                            <span style={{ background: catStyle.bg, color: catStyle.color,
                              border:`1px solid ${catStyle.border}`, padding:"2px 8px", borderRadius:6,
                              fontSize:10, fontWeight:800, whiteSpace:"nowrap" }}>{p.category}</span>
                            <span style={{ fontWeight:600, fontSize:13 }}>{p.name}</span>
                            <span style={{ fontSize:11, color: COLORS.muted }}>IP: {p.ipNo}</span>
                            <span style={{ fontSize:11, color: COLORS.muted }}>· {p.diagnosis}</span>
                            <button className="btn" onClick={() => { setSessionDate(d); setView("today"); setExpandedId(p.id); }}
                              style={{ background:"#ebedff", border:"1px solid #4e6ef244", color:"#4e6ef2",
                                padding:"2px 10px", borderRadius:7, fontWeight:700, fontSize:11, cursor:"pointer",
                                fontFamily:"inherit" }}>
                              ✏️ Edit
                            </button>
                            <span style={{ marginLeft:"auto",
                              background: r.seen ? "#e6faf7" : "#fdeef1",
                              color: r.seen ? "#00c9a7" : "#e63757",
                              padding:"2px 10px", borderRadius:7, fontWeight:700, fontSize:11, whiteSpace:"nowrap" }}>
                              {r.seen ? "✅ Seen" : `❌ ${r.reason || "Not Seen"}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
