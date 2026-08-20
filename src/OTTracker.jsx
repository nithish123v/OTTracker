import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./lib/supabase";

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
  TBI: { bg: "#fff3e0", color: "#e65100", border: "#ffcc80" },
  CVA: { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7" },
  Department: { bg: "#e3f2fd", color: "#1565c0", border: "#90caf9" },
  "New IOC Cases": { bg: "#f3e5f5", color: "#6a1b9a", border: "#ce93d8" },
};

const today = () => new Date().toISOString().split("T")[0];
const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const EMPTY_FORM = {
  name: "",
  ipNo: "",
  regNo: "",
  diagnosis: "",
  category: "CVA",
  consultingDr: "",
  roomNo: "",
  date: today(),
};

const emptyRecord = () => ({ seen: null, reason: "", notes: "" });
const ASSESSMENT_SCALES = [
  {
    id: "MRS",
    name: "Modified Rankin Scale",
    shortName: "MRS",
  },
  {
    id: "CRS",
    name: "Coma Recovery Scale",
    shortName: "CRS",
  },
  {
    id: "FIM",
    name: "Functional Independence Measure",
    shortName: "FIM",
  },
  {
    id: "NIHSS",
    name: "National Institutes of Health Stroke Scale",
    shortName: "NIHSS",
  },
];

function recordsFromDb(rows) {
  const result = {};
  for (const row of rows || []) {
    if (!result[row.session_date]) result[row.session_date] = {};
    result[row.session_date][row.patient_id] = {
      seen: row.seen ?? null,
      reason: row.reason || "",
      notes: row.notes || "",
    };
  }
  return result;
}

const ASSESSMENT_SCALES = [
  {
    id: "MRS",
    name: "Modified Rankin Scale",
    shortName: "MRS",
  },
  {
    id: "CRS",
    name: "Coma Recovery Scale",
    shortName: "CRS",
  },
  {
    id: "FIM",
    name: "Functional Independence Measure",
    shortName: "FIM",
  },
  {
    id: "NIHSS",
    name: "National Institutes of Health Stroke Scale",
    shortName: "NIHSS",
  },
];

function LoginScreen() {

function patientFromDb(p) {
  return {
    id: p.id,
    name: p.name,
    ipNo: p.ip_no,
    regNo: p.reg_no || "",
    diagnosis: p.diagnosis,
    category: p.category,
    consultingDr: p.consulting_dr || "",
    roomNo: p.room_no || "",
    date: p.referral_date || today(),
  };
}

function patientToDb(p) {
  return {
    id: p.id,
    name: p.name.trim(),
    ip_no: p.ipNo.trim(),
    reg_no: p.regNo?.trim() || null,
    diagnosis: p.diagnosis.trim(),
    category: p.category,
    consulting_dr: p.consultingDr?.trim() || null,
    room_no: p.roomNo?.trim() || null,
    referral_date: p.date || null,
  };
}

function recordsFromDb(rows) {
  const result = {};
  for (const row of rows || []) {
    if (!result[row.session_date]) result[row.session_date] = {};
    result[row.session_date][row.patient_id] = {
      seen: row.seen ?? null,
      reason: row.reason || "",
      notes: row.notes || "",
    };
  }
  return result;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const signIn = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (authError) setError(authError.message);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "'DM Sans','Segoe UI',sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          background: "#fff",
          borderRadius: 18,
          padding: 30,
          boxShadow: "0 10px 40px rgba(11,20,55,0.12)",
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 38 }}>🧠</div>
          <div style={{ fontSize: 25, fontWeight: 900, color: COLORS.sidebar }}>
            <span style={{ color: COLORS.accent }}>OT</span>Track
          </div>
          <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 5 }}>
            Occupational Therapy Patient Tracker
          </div>
        </div>

        <form onSubmit={signIn}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff email"
            style={inputStyle}
            autoComplete="email"
          />

          <label style={{ ...labelStyle, marginTop: 13 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            style={inputStyle}
            autoComplete="current-password"
          />

          {error && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 9,
                background: "#fdeef1",
                color: COLORS.notseen,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              width: "100%",
              marginTop: 18,
              padding: 12,
              border: 0,
              borderRadius: 10,
              background: COLORS.accent,
              color: "#fff",
              fontWeight: 800,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div
          style={{
            marginTop: 16,
            fontSize: 11,
            lineHeight: 1.5,
            color: COLORS.muted,
            textAlign: "center",
          }}
        >
          Access is controlled by your Supabase staff account.
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: COLORS.muted,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  marginBottom: 5,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 9,
  border: `1.5px solid ${COLORS.border}`,
  fontSize: 13,
  fontFamily: "inherit",
  background: "#f7fafc",
  color: COLORS.text,
  outline: "none",
};

export default function OTTracker() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState("staff");

  const [patients, setPatients] = useState([]);
  const [activeTab, setActiveTab] = useState("All");
  const [sessionDate, setSessionDate] = useState(today());
  const [records, setRecords] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [view, setView] = useState("today");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentPatient, setAssessmentPatient] = useState(null);
  const [assessmentType, setAssessmentType] = useState("");
  const [assessmentData, setAssessmentData] = useState({});
  const [assessmentDate, setAssessmentDate] = useState(today());

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const loadData = async (currentSession) => {
    setLoaded(false);

    const [
      { data: staff, error: staffError },
      { data: patientRows, error: patientError },
      { data: sessionRows, error: sessionError },
      { data: assessmentData, error: assessmentError },
    ] =
      await Promise.all([
        supabase
          .from("staff_users")
          .select("role, active")
          .eq("user_id", currentSession.user.id)
          .maybeSingle(),
        supabase.from("patients").select("*").order("created_at", { ascending: false }),
        supabase.from("session_records").select("*").order("session_date", { ascending: false }),
                supabase
          .from("patient_assessments")
          .select("*")
          .order("assessment_date", { ascending: false }),
      ]);

    if (staffError) {
      console.error(staffError);
      throw new Error("Could not check your staff authorization.");
    }
    setAuthorized(Boolean(staff?.active));
    setRole(staff?.role || "viewer");

    if (patientError) throw patientError;
if (sessionError) throw sessionError;
if (assessmentError) throw assessmentError;

    setPatients((patientRows || []).map(patientFromDb));
    setRecords(recordsFromDb(sessionRows || []));
    setAssessmentRows(assessmentData || []);
    setLoaded(true);
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession || null);
      if (!nextSession) {
        setAuthorized(false);
        setPatients([]);
        setRecords({});
        setLoaded(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    (async () => {
      try {
        await loadData(session);
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        showToast(error.message || "Could not load cloud data.", "warn");
        setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);
const openAssessment = (patient, type) => {
  setAssessmentPatient(patient);
  setAssessmentType(type);
  setAssessmentDate(sessionDate);
  setAssessmentData({});
  setShowAssessment(true);
};

const closeAssessment = () => {
  setShowAssessment(false);
  setAssessmentPatient(null);
  setAssessmentType("");
  setAssessmentData({});
};

const saveAssessment = async () => {
  if (!assessmentPatient || !assessmentType) return;

  setSaving(true);

  try {
    let totalScore = null;

    if (assessmentType === "MRS") {
      if (assessmentData.score === undefined || assessmentData.score === "") {
        showToast("Please select an MRS score.", "warn");
        setSaving(false);
        return;
      }

      totalScore = Number(assessmentData.score);
    }

    const payload = {
      patient_id: assessmentPatient.id,
      assessment_type: assessmentType,
      assessment_date: assessmentDate,
      total_score: totalScore,
      scores: assessmentData,
      notes: assessmentData.notes || null,
    };

    const { data, error } = await supabase
      .from("patient_assessments")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    setAssessmentRows((prev) => [data, ...prev]);

    showToast(`${assessmentType} assessment saved successfully!`);
    closeAssessment();
  } catch (error) {
    console.error(error);
    showToast(
      error.message || "Could not save assessment.",
      "warn"
    );
  } finally {
    setSaving(false);
  }
};

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const getRecord = (pid) =>
    (records[sessionDate] || {})[pid] || emptyRecord();

  const saveSessionRecord = async (patientId, date, record) => {
    const payload = {
      patient_id: patientId,
      session_date: date,
      seen: record.seen,
      reason: record.reason || null,
      notes: record.notes || null,
    };

    const { error } = await supabase
      .from("session_records")
      .upsert(payload, { onConflict: "patient_id,session_date" });

    if (error) throw error;
  };

  const setRecord = (pid, patch) => {
    const previous = getRecord(pid);
    const next = { ...previous, ...patch };

    setRecords((prev) => ({
      ...prev,
      [sessionDate]: {
        ...(prev[sessionDate] || {}),
        [pid]: next,
      },
    }));

    // Save in the cloud immediately. RLS decides whether this user can write.
    setSaving(true);
    saveSessionRecord(pid, sessionDate, next)
      .then(() => setSaving(false))
      .catch((error) => {
        console.error(error);
        setSaving(false);
        showToast(error.message || "Could not save session.", "warn");
      });
  };

  const markSeen = (pid) => {
    setRecord(pid, { seen: true, reason: "" });
    showToast("Marked as Seen ✓");
  };

  const markNotSeen = (pid, reason) => {
    setRecord(pid, { seen: false, reason });
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, date: today() });
    setShowAdd(true);
  };

  const openEditForm = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      ipNo: p.ipNo,
      regNo: p.regNo,
      diagnosis: p.diagnosis,
      category: p.category,
      consultingDr: p.consultingDr,
      roomNo: p.roomNo,
      date: p.date,
    });
    setShowAdd(true);
    setExpandedId(null);
  };

  const closeForm = () => {
    setShowAdd(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM, date: today() });
  };

  const savePatient = async () => {
    if (!form.name.trim() || !form.ipNo.trim() || !form.diagnosis.trim()) {
      showToast("Name, IP number and diagnosis are required.", "warn");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const row = patientToDb({ ...form, id: editingId });
        const { data, error } = await supabase
          .from("patients")
          .update(row)
          .eq("id", editingId)
          .select()
          .single();

        if (error) throw error;
        setPatients((p) => p.map((x) => (x.id === editingId ? patientFromDb(data) : x)));
        showToast("Patient updated!");
      } else {
        const row = patientToDb({ ...form, id: crypto.randomUUID() });
        const { data, error } = await supabase
          .from("patients")
          .insert(row)
          .select()
          .single();

        if (error) throw error;
        setPatients((p) => [patientFromDb(data), ...p]);
        showToast("Patient added!");
      }
      closeForm();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not save patient.", "warn");
    } finally {
      setSaving(false);
    }
  };

  const removePatient = async (id) => {
    if (!window.confirm("Remove this patient and their session records?")) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("patients").delete().eq("id", id);
      if (error) throw error;

      setPatients((p) => p.filter((x) => x.id !== id));
      setRecords((prev) => {
        const next = {};
        Object.keys(prev).forEach((d) => {
          const { [id]: _drop, ...rest } = prev[d];
          next[d] = rest;
        });
        return next;
      });
      setExpandedId(null);
      showToast("Patient removed", "warn");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not remove patient.", "warn");
    } finally {
      setSaving(false);
    }
  };

  const buildRows = () => {
    const rows = [["Date", "IP No", "Reg No", "Name", "Category", "Diagnosis", "Consulting Dr", "Room No", "Status", "Reason / Notes"]];
    Object.keys(records)
      .sort()
      .forEach((d) => {
        patients.forEach((p) => {
          const r = (records[d] || {})[p.id];
          if (r) {
            rows.push([
              d,
              p.ipNo,
              p.regNo,
              p.name,
              p.category,
              p.diagnosis,
              p.consultingDr,
              p.roomNo,
              r.seen === true ? "Seen" : r.seen === false ? "Not Seen" : "Pending",
              r.seen === false ? r.reason : r.notes || "",
            ]);
          }
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

    const patRows = [["Name", "IP No", "Reg No", "Category", "Diagnosis", "Consulting Dr", "Room No", "Date of Referral"]];
    patients.forEach((p) => patRows.push([p.name, p.ipNo, p.regNo, p.category, p.diagnosis, p.consultingDr, p.roomNo, p.date]));
    const ws2 = XLSX.utils.aoa_to_sheet(patRows);
    ws2["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 9 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Patient List");

    XLSX.writeFile(wb, `OT_records_${today()}.xlsx`);
    showToast("Exported to Excel!");
  };

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      const catMatch = activeTab === "All" || p.category === activeTab;
      const q = search.toLowerCase();
      const srch =
        !q ||
        [p.name, p.ipNo, p.regNo, p.diagnosis, p.consultingDr, p.roomNo].some((f) =>
          (f || "").toLowerCase().includes(q)
        );
      return catMatch && srch;
    });
  }, [patients, activeTab, search]);

  const todayRecs = records[sessionDate] || {};
  const seen = patients.filter((p) => todayRecs[p.id]?.seen === true).length;
  const notSeen = patients.filter((p) => todayRecs[p.id]?.seen === false).length;
  const pending = patients.length - seen - notSeen;
  const allDates = Object.keys(records)
    .filter((d) => Object.keys(records[d] || {}).length > 0)
    .sort()
    .reverse();

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.bg, color: COLORS.muted }}>
        Loading OTTrack…
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.bg, color: COLORS.muted, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
        Loading your OT records…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'DM Sans','Segoe UI',sans-serif", color: COLORS.text }}>
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
        .hvr:hover { background:#f7faff !important; }
        .btn:hover { opacity:0.85; transform:translateY(-1px); }
        textarea, input, select { outline:none; }
        input:focus, select:focus, textarea:focus { border-color:#4e6ef2 !important; box-shadow:0 0 0 3px rgba(78,110,242,0.10); }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:#cbd5e0; border-radius:99px; }
      `}</style>

      {toast && (
        <div style={{ position:"fixed", top:18, right:18, zIndex:9999, background:toast.type==="warn"?"#e63757":"#00c9a7", color:"#fff", padding:"11px 22px", borderRadius:12, fontWeight:700, fontSize:13, boxShadow:"0 8px 30px rgba(0,0,0,0.18)", animation:"fadeUp 0.25s ease" }}>
          {toast.msg}
        </div>
      )}

      {saving && (
        <div style={{ position:"fixed", bottom:16, right:18, zIndex:9999, background:"#1a2a5e", color:"#a0aec0", padding:"6px 14px", borderRadius:10, fontWeight:600, fontSize:11 }}>
          Saving…
        </div>
      )}

      <div style={{ display:"flex", minHeight:"100vh" }}>
        <div style={{ width:210, background:COLORS.sidebar, display:"flex", flexDirection:"column", flexShrink:0, padding:"24px 0" }}>
          <div style={{ padding:"0 18px 24px" }}>
            <div style={{ fontSize:18, fontWeight:900, color:"#fff", letterSpacing:-0.5 }}>
              🧠 <span style={{ color:"#4e6ef2" }}>OT</span>Track
            </div>
            <div style={{ fontSize:10, color:"#4a5568", marginTop:3, fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>
              Occupational Therapy
            </div>
          </div>

          {[
            { id:"today", icon:"📋", label:"Today's Cases" },
            { id:"history", icon:"📅", label:"Session History" },
          ].map((item) => (
            <button key={item.id} onClick={() => setView(item.id)} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", border:0, background:view===item.id?"#16204b":"transparent", color:view===item.id?"#fff":"#718096", padding:"12px 18px", cursor:"pointer", fontWeight:700, fontSize:13, textAlign:"left", fontFamily:"inherit" }}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}

          <div style={{ marginTop:"auto", padding:"18px" }}>
            <div style={{ color:"#718096", fontSize:10, marginBottom:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {session.user.email}
            </div>
            <div style={{ color:"#4a5568", fontSize:10, marginBottom:10 }}>Role: {role}</div>
            <button onClick={signOut} style={{ width:"100%", border:"1px solid #2d3a67", background:"transparent", color:"#a0aec0", padding:"8px", borderRadius:8, cursor:"pointer", fontSize:11, fontWeight:700 }}>
              Sign out
            </button>
          </div>
        </div>

        <div style={{ flex:1, padding:"28px 30px", maxWidth:1250, width:"100%", margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22, gap:15, flexWrap:"wrap" }}>
            <div>
              <div style={{ fontSize:23, fontWeight:900, color:COLORS.sidebar }}>
                {view==="today" ? "Today's OT Cases" : "Session History"}
              </div>
              <div style={{ fontSize:12, color:COLORS.muted, marginTop:3 }}>
                Shared Supabase records • {fmtDate(sessionDate)}
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {authorized && <button className="btn" onClick={openAddForm} style={{ background:"#4e6ef2", border:0, color:"#fff", padding:"9px 16px", borderRadius:9, fontWeight:800, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>＋ Add Patient</button>}
              <button className="btn" onClick={exportExcel} style={{ background:"#fff", border:`1.5px solid ${COLORS.border}`, color:COLORS.muted, padding:"9px 16px", borderRadius:9, fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>📊 Export Excel</button>
            </div>
          </div>

          {view==="today" && (
            <>
              <div style={{ display:"flex", gap:7, marginBottom:18, flexWrap:"wrap" }}>
                {CATEGORIES.map((c) => (
                  <button key={c} onClick={() => setActiveTab(c)} style={{ border:`1.5px solid ${activeTab===c?"#4e6ef2":COLORS.border}`, background:activeTab===c?"#ebedff":"#fff", color:activeTab===c?"#4e6ef2":COLORS.muted, padding:"6px 13px", borderRadius:8, fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{c}</button>
                ))}
                <input type="date" value={sessionDate} onChange={(e)=>setSessionDate(e.target.value)} style={{ marginLeft:"auto", padding:"6px 10px", borderRadius:8, border:`1.5px solid ${COLORS.border}`, background:"#fff", color:COLORS.text, fontSize:11 }} />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
                {[
                  {label:"Total",val:patients.length,color:"#4e6ef2",bg:"#ebedff",icon:"📋"},
                  {label:"Seen",val:seen,color:"#00c9a7",bg:"#e6faf7",icon:"✅"},
                  {label:"Not Seen",val:notSeen,color:"#e63757",bg:"#fdeef1",icon:"❌"},
                  {label:"Pending",val:pending,color:"#f6c90e",bg:"#fffbe6",icon:"⏳"},
                ].map(s=>(
                  <div key={s.label} style={{ background:COLORS.card,borderRadius:12,padding:"14px 16px",border:`1.5px solid ${s.color}22`,boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
                    <div style={{fontSize:18,marginBottom:4}}>{s.icon}</div>
                    <div style={{fontSize:24,fontWeight:900,color:s.color}}>{s.val}</div>
                    <div style={{fontSize:11,color:COLORS.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>{s.label}</div>
                  </div>
                ))}
              </div>

              {showAdd && (
                <div style={{ background:COLORS.card,borderRadius:14,padding:20,marginBottom:18,border:"1.5px solid #4e6ef244",boxShadow:"0 4px 20px rgba(78,110,242,0.10)",animation:"popIn .25s ease" }}>
                  <div style={{fontWeight:800,color:"#4e6ef2",marginBottom:14,fontSize:14}}>{editingId?"✏️ Edit Patient":"🧠 New OT Patient"}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
                    {[
                      {key:"name",label:"Patient Name *",type:"text"},
                      {key:"ipNo",label:"IP Number *",type:"text"},
                      {key:"regNo",label:"Reg Number",type:"text"},
                      {key:"consultingDr",label:"Consulting Doctor",type:"text"},
                      {key:"roomNo",label:"Room / Bed No",type:"text"},
                      {key:"date",label:"Date of Referral",type:"date"},
                    ].map(f=>(
                      <div key={f.key} style={{display:"flex",flexDirection:"column",gap:4}}>
                        <label style={labelStyle}>{f.label}</label>
                        <input type={f.type} value={form[f.key]} onChange={e=>setForm(x=>({...x,[f.key]:e.target.value}))} style={inputStyle}/>
                      </div>
                    ))}
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      <label style={labelStyle}>Category</label>
                      <select value={form.category} onChange={e=>setForm(x=>({...x,category:e.target.value}))} style={inputStyle}>
                        {CATEGORIES.filter(c=>c!=="All").map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,gridColumn:"1/-1"}}>
                      <label style={labelStyle}>Diagnosis *</label>
                      <input type="text" value={form.diagnosis} onChange={e=>setForm(x=>({...x,diagnosis:e.target.value}))} placeholder="Enter primary diagnosis..." style={inputStyle}/>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10,marginTop:14}}>
                    <button className="btn" onClick={savePatient} style={{background:"#4e6ef2",border:0,color:"#fff",padding:"11px 28px",borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{editingId?"✓ Save Changes":"✓ Add Patient"}</button>
                    <button className="btn" onClick={closeForm} style={{background:"#f7fafc",border:`1.5px solid ${COLORS.border}`,color:COLORS.muted,padding:"11px 20px",borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                  </div>
                </div>
              )}

              <input placeholder="🔍  Search by name, IP no, reg no, diagnosis, doctor, room..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1.5px solid ${COLORS.border}`,fontSize:13,fontFamily:"inherit",background:"#fff",marginBottom:14,color:COLORS.text}}/>

              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {filtered.length===0 && <div style={{textAlign:"center",padding:"50px 20px",color:COLORS.muted}}><div style={{fontSize:36}}>🔍</div><div style={{fontWeight:700,fontSize:16,marginTop:10}}>No patients found</div></div>}
                {filtered.map(p=>{
                  const rec=getRecord(p.id);
                  const catStyle=CAT_COLORS[p.category]||{bg:"#f7fafc",color:"#718096",border:"#e2e8f0"};
                  const isExpanded=expandedId===p.id;
                  return (
                    <div key={p.id} style={{background:COLORS.card,borderRadius:14,border:rec.seen===true?"1.5px solid #00c9a744":rec.seen===false?"1.5px solid #e6375744":`1.5px solid ${COLORS.border}`,boxShadow:"0 2px 8px rgba(0,0,0,0.05)",overflow:"hidden"}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr auto",alignItems:"center",padding:"14px 16px",gap:12,cursor:"pointer"}} onClick={()=>setExpandedId(isExpanded?null:p.id)}>
                        <div style={{display:"flex",alignItems:"flex-start",gap:12,minWidth:0}}>
                          <div style={{background:catStyle.bg,color:catStyle.color,border:`1px solid ${catStyle.border}`,padding:"3px 10px",borderRadius:7,fontSize:10,fontWeight:800,whiteSpace:"nowrap",marginTop:2}}>{p.category}</div>
                          <div style={{minWidth:0}}>
                            <div style={{fontWeight:800,fontSize:14}}>{p.name}</div>
                            <div style={{fontSize:12,color:COLORS.muted,marginTop:2}}>{p.diagnosis}</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                              {[{label:"IP",val:p.ipNo},{label:"Reg",val:p.regNo},{label:"Dr",val:p.consultingDr},{label:"Room",val:p.roomNo}].map(f=>f.val?<span key={f.label} style={{fontSize:11,background:"#f0f4f8",color:"#4a5568",padding:"2px 8px",borderRadius:6,fontWeight:600}}><span style={{color:COLORS.muted}}>{f.label}: </span>{f.val}</span>:null)}
                            </div>
                          </div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                          <div style={{background:rec.seen===true?"#e6faf7":rec.seen===false?"#fdeef1":"#f7fafc",color:rec.seen===true?"#00c9a7":rec.seen===false?"#e63757":"#a0aec0",border:`1.5px solid ${rec.seen===true?"#00c9a7":rec.seen===false?"#e63757":"#e2e8f0"}`,padding:"5px 14px",borderRadius:8,fontWeight:800,fontSize:12,whiteSpace:"nowrap"}}>{rec.seen===true?"✅ Seen":rec.seen===false?"❌ Not Seen":"⏳ Pending"}</div>
                          <div style={{fontSize:11,color:"#a0aec0"}}>{isExpanded?"▲ collapse":"▼ expand"}</div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{borderTop:`1px solid ${COLORS.border}`,padding:16,background:"#fafcff"}}>
                          <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                            {authorized && <button className="btn" onClick={()=>markSeen(p.id)} style={{background:rec.seen===true?"#00c9a7":"#e6faf7",border:"1.5px solid #00c9a7",color:rec.seen===true?"#fff":"#00c9a7",padding:"9px 22px",borderRadius:10,fontWeight:800,fontSize:13,cursor:"pointer"}}>✅ Seen</button>}
                            {authorized && <button className="btn" onClick={()=>markNotSeen(p.id,rec.reason||"")} style={{background:rec.seen===false?"#e63757":"#fdeef1",border:"1.5px solid #e63757",color:rec.seen===false?"#fff":"#e63757",padding:"9px 22px",borderRadius:10,fontWeight:800,fontSize:13,cursor:"pointer"}}>❌ Not Seen</button>}
                           {authorized && (
  <button
    className="btn"
    onClick={(e) => {
      e.stopPropagation();
      openAssessment(p, "MRS");
    }}
    style={{
      background: "#e8f5e9",
      border: "1.5px solid #43a047",
      color: "#2e7d32",
      padding: "9px 18px",
      borderRadius: 10,
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
    }}
  >
    📋 MRS
  </button>
)}
                            {authorized && <button className="btn" onClick={()=>openEditForm(p)} style={{background:"#ebedff",border:"1.5px solid #4e6ef2",color:"#4e6ef2",padding:"9px 18px",borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer",marginLeft:"auto"}}>✏️ Edit</button>}
                            {role==="admin" && <button className="btn" onClick={()=>removePatient(p.id)} style={{background:"#f7fafc",border:`1.5px solid ${COLORS.border}`,color:COLORS.muted,padding:"9px 16px",borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer"}}>🗑 Remove</button>}
                          </div>

                          {authorized && rec.seen===false && (
                            <div style={{marginBottom:12}}>
                              <label style={{fontSize:11,fontWeight:700,color:"#e63757",textTransform:"uppercase",letterSpacing:.6,display:"block",marginBottom:6}}>Reason for Not Seen *</label>
                              <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:8}}>
                                {NOT_SEEN_REASONS.map(r=><button key={r} className="btn" onClick={()=>setRecord(p.id,{reason:r})} style={{padding:"6px 13px",borderRadius:8,border:`1.5px solid ${rec.reason===r?"#e63757":"#e2e8f0"}`,background:rec.reason===r?"#fdeef1":"#fff",color:rec.reason===r?"#e63757":COLORS.muted,fontWeight:rec.reason===r?700:500,fontSize:12,cursor:"pointer"}}>{r}</button>)}
                              </div>
                              {(rec.reason==="Other"||!NOT_SEEN_REASONS.slice(0,-1).includes(rec.reason)) && <input placeholder="Specify reason..." value={NOT_SEEN_REASONS.includes(rec.reason)&&rec.reason!=="Other"?"":rec.reason} onChange={e=>setRecord(p.id,{reason:e.target.value})} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:"1.5px solid #e63757",fontSize:13,fontFamily:"inherit",background:"#fff5f5",color:COLORS.text}}/>}
                            </div>
                          )}

                          <div>
                            <label style={{fontSize:11,fontWeight:700,color:COLORS.muted,textTransform:"uppercase",letterSpacing:.6,display:"block",marginBottom:6}}>📝 Session Notes / Observations</label>
                            {authorized ? (
                              <textarea placeholder="Treatment given, progress, goals, recommendations..." value={rec.notes||""} onChange={e=>setRecord(p.id,{notes:e.target.value})} style={{width:"100%",minHeight:80,padding:"10px 12px",borderRadius:10,border:`1.5px solid ${COLORS.border}`,fontSize:13,fontFamily:"inherit",resize:"vertical",color:COLORS.text,background:"#fff"}}/>
                            ) : (
                              <div style={{width:"100%",minHeight:80,padding:"10px 12px",borderRadius:10,border:`1.5px solid ${COLORS.border}`,fontSize:13,color:rec.notes?COLORS.text:"#a0aec0",background:"#f7fafc",whiteSpace:"pre-wrap"}}>
                                {rec.notes || "Read-only view. Authorized staff can add session notes."}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {view==="history" && (
            <div>
              {allDates.length===0 ? (
                <div style={{textAlign:"center",padding:"60px 20px",color:COLORS.muted}}><div style={{fontSize:40}}>📭</div><div style={{fontWeight:700,fontSize:16,marginTop:10}}>No session records yet</div></div>
              ) : allDates.map(d=>{
                const drec=records[d]||{};
                const s=Object.values(drec).filter(r=>r.seen===true).length;
                const ns=Object.values(drec).filter(r=>r.seen===false).length;
                const total=Object.keys(drec).length;
                return (
                  <div key={d} style={{background:COLORS.card,borderRadius:14,marginBottom:12,border:`1px solid ${COLORS.border}`,boxShadow:"0 2px 8px rgba(0,0,0,.05)",overflow:"hidden"}}>
                    <div style={{padding:"14px 18px",borderBottom:`1px solid ${COLORS.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f7fafc"}}>
                      <div><div style={{fontWeight:800,fontSize:15}}>{fmtDate(d)}</div><div style={{fontSize:12,color:COLORS.muted,marginTop:2}}>{total} patients recorded</div></div>
                      <div style={{display:"flex",gap:8}}><span style={{background:"#e6faf7",color:"#00c9a7",padding:"4px 12px",borderRadius:8,fontWeight:700,fontSize:12}}>✅ {s} Seen</span><span style={{background:"#fdeef1",color:"#e63757",padding:"4px 12px",borderRadius:8,fontWeight:700,fontSize:12}}>❌ {ns} Not Seen</span></div>
                    </div>
                    <div style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:8}}>
                      {patients.filter(p=>drec[p.id]).map(p=>{
                        const r=drec[p.id]; const catStyle=CAT_COLORS[p.category]||{};
                        return <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <span style={{background:catStyle.bg,color:catStyle.color,border:`1px solid ${catStyle.border}`,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:800}}>{p.category}</span>
                          <span style={{fontWeight:600,fontSize:13}}>{p.name}</span>
                          <span style={{fontSize:11,color:COLORS.muted}}>IP: {p.ipNo}</span>
                          <span style={{fontSize:11,color:COLORS.muted}}>· {p.diagnosis}</span>
                          {authorized && <button className="btn" onClick={()=>{setSessionDate(d);setView("today");setExpandedId(p.id)}} style={{background:"#ebedff",border:"1px solid #4e6ef244",color:"#4e6ef2",padding:"2px 10px",borderRadius:7,fontWeight:700,fontSize:11,cursor:"pointer"}}>✏️ Edit</button>}
                          <span style={{marginLeft:"auto",background:r.seen?"#e6faf7":"#fdeef1",color:r.seen?"#00c9a7":"#e63757",padding:"2px 10px",borderRadius:7,fontWeight:700,fontSize:11}}>{r.seen?"✅ Seen":`❌ ${r.reason||"Not Seen"}`}</span>
                        </div>;
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
