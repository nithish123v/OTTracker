import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./lib/supabase";




import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";

/* =========================================================
   COLORS
========================================================= */

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

/* =========================================================
   CATEGORIES
========================================================= */

const CATEGORIES = [
  "All",
  "TBI",
  "CVA",
  "Department",
  "New IOC Cases",
];

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
  TBI: {
    bg: "#fff3e0",
    color: "#e65100",
    border: "#ffcc80",
  },
  CVA: {
    bg: "#e8f5e9",
    color: "#2e7d32",
    border: "#a5d6a7",
  },
  Department: {
    bg: "#e3f2fd",
    color: "#1565c0",
    border: "#90caf9",
  },
  "New IOC Cases": {
    bg: "#f3e5f5",
    color: "#6a1b9a",
    border: "#ce93d8",
  },
};

/* =========================================================
   ASSESSMENT SCALES
   ONLY THESE 4 SCALES
========================================================= */

const ASSESSMENT_SCALES = [
  {
    id: "MRS",
    name: "Modified Rankin Scale",
    shortName: "MRS",
  },
  {
    id: "CRS-R",
    name: "Coma Recovery Scale – Revised",
    shortName: "CRS-R",
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

/* =====================================================
   HELPERS
===================================================== */

const today = () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const fmtDate = (d) => {
  if (!d) return "—";

  return new Date(d + "T00:00:00").toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
};

const fmtDateTime = (d) => {
  if (!d) return "—";

  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
  sessionTime: "",
  location: "",
  strokeType: "",
  isActive: true,
  admissionDate: "",
  dischargeDate: "",
  date: today(),
};
const emptyRecord = () => ({
  seen: null,
  reason: "",
  notes: "",
});

/* =========================================================
   PATIENT DB HELPERS
========================================================= */

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
    sessionTime: p.session_time || "",
    location: p.location || "",
    strokeType: p.stroke_type || "",
    isActive: p.is_active ?? true,
admissionDate: p.admission_date || "",
dischargeDate: p.discharge_date || "",
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
    session_time: p.sessionTime || null,
    location: p.location || null,
    stroke_type: p.strokeType || null,
    is_active: p.isActive ?? true,
admission_date: p.admissionDate || null,
discharge_date: p.dischargeDate || null,
    referral_date: p.date || null,
  };
}

function recordsFromDb(rows) {
  const result = {};

  for (const row of rows || []) {
    if (!result[row.session_date]) {
      result[row.session_date] = {};
    }

    result[row.session_date][row.patient_id] = {
      seen: row.seen ?? null,
      reason: row.reason || "",
      notes: row.notes || "",
    };
  }

  return result;
}

/* =========================================================
   LOGIN SCREEN
========================================================= */

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /* =====================================================
     NORMAL EMAIL + PASSWORD LOGIN
  ===================================================== */

  const signIn = async (e) => {
    e.preventDefault();

    setError("");

    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    setBusy(true);

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      /* Save the Supabase session securely.
         This is what biometric login will use later. */
      if (authData?.session) {
  await SecureStorage.set(
    "ottracker_session",
    JSON.stringify({
      email,
      password,
    })
  );
}
    } catch (error) {
      console.error(error);

      setError(
        error?.message ||
          "Unable to sign in."
      );
    } finally {
      setBusy(false);
    }
  };

  /* =====================================================
     BIOMETRIC LOGIN
  ===================================================== */

  const biometricLogin = async () => {
  setError("");
  setBusy(true);

  try {
    // Check whether fingerprint / face is available
    const { isAvailable } =
      await BiometricAuth.checkBiometry();

    if (!isAvailable) {
      setError(
        "Biometric authentication is not available on this device."
      );
      return;
    }

    // Ask Android for fingerprint / face
    await BiometricAuth.authenticate({
      reason: "Authenticate to open OTTracker",
      androidTitle: "OTTracker Login",
      androidSubtitle: "Use your fingerprint or face",
      allowDeviceCredential: true,
      androidConfirmationRequired: false,
    });

    // Get saved email + password
    const savedLogin =
      await SecureStorage.get("ottracker_session");

    if (!savedLogin) {
      setError(
        "No saved biometric login. Please login with email and password first."
      );
      return;
    }

    // Convert saved data back to an object
    const credentials =
      typeof savedLogin === "string"
        ? JSON.parse(savedLogin)
        : savedLogin;

    if (
      !credentials?.email ||
      !credentials?.password
    ) {
      setError(
        "Saved biometric login is invalid. Please login with email and password again."
      );

      await SecureStorage.remove(
        "ottracker_session"
      );

      return;
    }

    // Login to Supabase using saved credentials
    const {
      error: authError,
    } =
      await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

    if (authError) {
      console.error(authError);

      setError(
        "Biometric login failed. Please login with email and password again."
      );

      await SecureStorage.remove(
        "ottracker_session"
      );

      return;
    }

    // Supabase onAuthStateChange will update
    // the main OTTracker session automatically.
  } catch (error) {
    console.error(
      "Biometric login error:",
      error
    );

    setError(
      error?.message ||
        "Biometric authentication failed."
    );
  } finally {
    setBusy(false);
  }
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
        fontFamily:
          "'DM Sans','Segoe UI',sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          background: "#fff",
          borderRadius: 18,
          padding: 30,
          boxShadow:
            "0 10px 40px rgba(11,20,55,0.12)",
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 38 }}>
            🧠
          </div>

          <div
            style={{
              fontSize: 25,
              fontWeight: 900,
              color: COLORS.sidebar,
            }}
          >
            <span
              style={{
                color: COLORS.accent,
              }}
            >
              OT
            </span>
            Track
          </div>

          <div
            style={{
              color: COLORS.muted,
              fontSize: 12,
              marginTop: 5,
            }}
          >
            Occupational Therapy Patient
            Tracker
          </div>
        </div>

        <form onSubmit={signIn}>
          <label style={labelStyle}>
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            placeholder="staff email"
            style={inputStyle}
            autoComplete="email"
          />

          <label
            style={{
              ...labelStyle,
              marginTop: 13,
            }}
          >
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
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

          {/* NORMAL LOGIN */}

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
              cursor: busy
                ? "wait"
                : "pointer",
            }}
          >
            {busy
              ? "Signing in…"
              : "Sign in"}
          </button>

          {/* BIOMETRIC LOGIN */}

          <button
            type="button"
            onClick={biometricLogin}
            disabled={busy}
            style={{
              width: "100%",
              marginTop: 10,
              padding: 12,
              border: "1px solid #ddd",
              borderRadius: 10,
              background: "#fff",
              color: COLORS.accent,
              fontWeight: 800,
              cursor: busy
                ? "wait"
                : "pointer",
            }}
          >
            🔐 Login with Fingerprint / Face
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
          Access is controlled by your
          Supabase staff account.
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   COMMON STYLES
========================================================= */

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

/* =========================================================
   MRS
========================================================= */

function MRSForm({ data, setData }) {
  const options = [
    {
      value: 0,
      text: "0 – No symptoms at all",
    },
    {
      value: 1,
      text: "1 – No significant disability despite symptoms",
    },
    {
      value: 2,
      text: "2 – Slight disability",
    },
    {
      value: 3,
      text: "3 – Moderate disability",
    },
    {
      value: 4,
      text: "4 – Moderately severe disability",
    },
    {
      value: 5,
      text: "5 – Severe disability",
    },
    {
      value: 6,
      text: "6 – Dead",
    },
  ];

  return (
    <div>
      <div style={scaleInfo}>
        Modified Rankin Scale – Score 0 to 6
      </div>

      {options.map((item) => (
        <label
          key={item.value}
          style={radioCard(
            Number(data.score) === item.value
          )}
        >
          <input
            type="radio"
            name="mrs"
            checked={
              Number(data.score) === item.value
            }
            onChange={() =>
              setData((x) => ({
                ...x,
                score: item.value,
              }))
            }
          />

          <span>
            <strong>{item.value}</strong>{" "}
            – {item.text}
          </span>
        </label>
      ))}
    </div>
  );
}

/* =========================================================
   CRS-R
========================================================= */

function CRSForm({ data, setData }) {
  const sections = [
    {
      key: "auditory",
      title: "Auditory Function",
      max: 4,
      options: [
        "No response",
        "Auditory startle",
        "Localization to sound",
        "Reproducible movement to command",
        "Oriented response",
      ],
    },
    {
      key: "visual",
      title: "Visual Function",
      max: 5,
      options: [
        "No response",
        "Visual startle",
        "Localization to object",
        "Object manipulation",
        "Object recognition",
        "Object localization",
      ],
    },
    {
      key: "motor",
      title: "Motor Function",
      max: 6,
      options: [
        "No response",
        "Abnormal posturing",
        "Flexion withdrawal",
        "Object manipulation",
        "Automatic motor response",
        "Functional object use",
        "Functional communication",
      ],
    },
    {
      key: "oromotor",
      title: "Oromotor / Verbal Function",
      max: 3,
      options: [
        "No response",
        "Oral reflexive movement",
        "Object-related oral movement",
        "Intelligible verbalization",
      ],
    },
    {
      key: "communication",
      title: "Communication",
      max: 2,
      options: [
        "No communication",
        "Non-functional intentional communication",
        "Functional communication",
      ],
    },
    {
      key: "arousal",
      title: "Arousal",
      max: 3,
      options: [
        "Unarousable",
        "Eye opening with stimulation",
        "Eye opening without stimulation",
        "Attention",
      ],
    },
  ];

  const total = sections.reduce(
    (sum, section) =>
      sum + Number(data[section.key] || 0),
    0
  );

  return (
    <div>
      <div style={scaleInfo}>
        CRS-R – Coma Recovery Scale Revised.
        Total score: 0–23.
      </div>

      {sections.map((section) => (
        <div
          key={section.key}
          style={{
            marginBottom: 18,
            padding: 14,
            background: "#f8fafc",
            borderRadius: 10,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: 13,
              marginBottom: 9,
            }}
          >
            {section.title}
          </div>

          {section.options.map(
            (option, index) => (
              <label
                key={index}
                style={radioCard(
                  Number(data[section.key]) ===
                    index
                )}
              >
                <input
                  type="radio"
                  name={section.key}
                  checked={
                    Number(
                      data[section.key]
                    ) === index
                  }
                  onChange={() =>
                    setData((x) => ({
                      ...x,
                      [section.key]: index,
                    }))
                  }
                />

                <span>
                  <strong>{index}</strong>{" "}
                  – {option}
                </span>
              </label>
            )
          )}
        </div>
      ))}

      <ScoreBox>
        CRS-R Total Score: <strong>{total}/23</strong>
      </ScoreBox>
    </div>
  );
}

/* =========================================================
   FIM
========================================================= */

function FIMForm({ data, setData }) {
  const items = [
    "Eating",
    "Grooming",
    "Bathing",
    "Dressing – Upper Body",
    "Dressing – Lower Body",
    "Toileting",
    "Bladder Management",
    "Bowel Management",
    "Bed / Chair / Wheelchair Transfer",
    "Toilet Transfer",
    "Tub / Shower Transfer",
    "Walk / Wheelchair",
    "Stairs",
    "Comprehension",
    "Expression",
    "Social Interaction",
    "Problem Solving",
    "Memory",
  ];

  const levels = [
    "1 – Total Assistance",
    "2 – Maximal Assistance",
    "3 – Moderate Assistance",
    "4 – Minimal Assistance",
    "5 – Supervision / Setup",
    "6 – Modified Independence",
    "7 – Complete Independence",
  ];

  const total = items.reduce(
    (sum, _, index) =>
      sum +
      Number(
        data[`item_${index}`] || 0
      ),
    0
  );

  return (
    <div>
      <div style={scaleInfo}>
        FIM – 18 items. Each item scored 1–7.
        Total: 18–126.
      </div>

      {items.map((item, index) => (
        <div
          key={item}
          style={{
            marginBottom: 10,
            padding: 12,
            background: "#f8fafc",
            borderRadius: 9,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 12,
              marginBottom: 7,
            }}
          >
            {index + 1}. {item}
          </div>

          <select
            value={data[`item_${index}`] || ""}
            onChange={(e) =>
              setData((x) => ({
                ...x,
                [`item_${index}`]:
                  e.target.value,
              }))
            }
            style={inputStyle}
          >
            <option value="">
              Select score
            </option>

            {levels.map((level, i) => (
              <option
                key={i + 1}
                value={i + 1}
              >
                {level}
              </option>
            ))}
          </select>
        </div>
      ))}

      <ScoreBox>
        FIM Total Score:{" "}
        <strong>{total}/126</strong>
      </ScoreBox>
    </div>
  );
}

/* =========================================================
   NIHSS
========================================================= */

function NIHSSForm({ data, setData }) {
  const items = [
    {
      key: "1a",
      name: "1a. Level of Consciousness",
      max: 3,
      options: [
        "0 – Alert",
        "1 – Not alert, but arousable",
        "2 – Not alert, requires repeated stimulation",
        "3 – Responds only with reflex motor / autonomic effects",
      ],
    },
    {
      key: "1b",
      name: "1b. LOC Questions",
      max: 2,
      options: [
        "0 – Answers both correctly",
        "1 – Answers one correctly",
        "2 – Answers neither correctly",
      ],
    },
    {
      key: "1c",
      name: "1c. LOC Commands",
      max: 2,
      options: [
        "0 – Performs both tasks correctly",
        "1 – Performs one task correctly",
        "2 – Performs neither correctly",
      ],
    },
    {
      key: "2",
      name: "2. Best Gaze",
      max: 2,
      options: [
        "0 – Normal",
        "1 – Partial gaze palsy",
        "2 – Forced deviation / total gaze paresis",
      ],
    },
    {
      key: "3",
      name: "3. Visual",
      max: 3,
      options: [
        "0 – No visual loss",
        "1 – Partial hemianopia",
        "2 – Complete hemianopia",
        "3 – Bilateral hemianopia / blindness",
      ],
    },
    {
      key: "4",
      name: "4. Facial Palsy",
      max: 3,
      options: [
        "0 – Normal",
        "1 – Minor paralysis",
        "2 – Partial paralysis",
        "3 – Complete paralysis",
      ],
    },
    {
      key: "5a",
      name: "5a. Left Arm",
      max: 4,
      options: [
        "0 – No drift",
        "1 – Drift",
        "2 – Some effort against gravity",
        "3 – No effort against gravity",
        "4 – No movement",
      ],
    },
    {
      key: "5b",
      name: "5b. Right Arm",
      max: 4,
      options: [
        "0 – No drift",
        "1 – Drift",
        "2 – Some effort against gravity",
        "3 – No effort against gravity",
        "4 – No movement",
      ],
    },
    {
      key: "6a",
      name: "6a. Left Leg",
      max: 4,
      options: [
        "0 – No drift",
        "1 – Drift",
        "2 – Some effort against gravity",
        "3 – No effort against gravity",
        "4 – No movement",
      ],
    },
    {
      key: "6b",
      name: "6b. Right Leg",
      max: 4,
      options: [
        "0 – No drift",
        "1 – Drift",
        "2 – Some effort against gravity",
        "3 – No effort against gravity",
        "4 – No movement",
      ],
    },
    {
      key: "7",
      name: "7. Limb Ataxia",
      max: 2,
      options: [
        "0 – Absent",
        "1 – Present in one limb",
        "2 – Present in two limbs",
      ],
    },
    {
      key: "8",
      name: "8. Sensory",
      max: 2,
      options: [
        "0 – Normal",
        "1 – Mild to moderate sensory loss",
        "2 – Severe / total sensory loss",
      ],
    },
    {
      key: "9",
      name: "9. Best Language",
      max: 3,
      options: [
        "0 – No aphasia",
        "1 – Mild to moderate aphasia",
        "2 – Severe aphasia",
        "3 – Mute / global aphasia",
      ],
    },
    {
      key: "10",
      name: "10. Dysarthria",
      max: 2,
      options: [
        "0 – Normal",
        "1 – Mild to moderate dysarthria",
        "2 – Severe dysarthria / unintelligible",
      ],
    },
    {
      key: "11",
      name: "11. Extinction / Inattention",
      max: 2,
      options: [
        "0 – No abnormality",
        "1 – Inattention in one modality",
        "2 – Profound hemi-inattention",
      ],
    },
  ];

  const total = items.reduce(
    (sum, item) =>
      sum +
      Number(data[item.key] || 0),
    0
  );

  return (
    <div>
      <div style={scaleInfo}>
        NIHSS – National Institutes of Health
        Stroke Scale. Total: 0–42.
      </div>

      {items.map((item) => (
        <div
          key={item.key}
          style={{
            marginBottom: 12,
            padding: 12,
            background: "#f8fafc",
            borderRadius: 9,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: 12,
              marginBottom: 7,
            }}
          >
            {item.name}
          </div>

          <select
            value={data[item.key] ?? ""}
            onChange={(e) =>
              setData((x) => ({
                ...x,
                [item.key]:
                  e.target.value,
              }))
            }
            style={inputStyle}
          >
            <option value="">
              Select score
            </option>

            {item.options.map(
              (option, index) => (
                <option
                  key={index}
                  value={index}
                >
                  {option}
                </option>
              )
            )}
          </select>
        </div>
      ))}

      <ScoreBox>
        NIHSS Total Score:{" "}
        <strong>{total}/42</strong>
      </ScoreBox>
    </div>
  );
}

/* =========================================================
   ASSESSMENT FORM
========================================================= */

const scaleInfo = {
  padding: 12,
  marginBottom: 16,
  borderRadius: 10,
  background: "#ebedff",
  color: "#4e6ef2",
  fontSize: 12,
  fontWeight: 700,
};

const radioCard = (active) => ({
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "9px 11px",
  marginBottom: 6,
  borderRadius: 8,
  border: `1px solid ${
    active
      ? "#4e6ef2"
      : COLORS.border
  }`,
  background: active
    ? "#ebedff"
    : "#fff",
  cursor: "pointer",
  fontSize: 12,
});

function ScoreBox({ children }) {
  return (
    <div
      style={{
        marginTop: 15,
        padding: 14,
        borderRadius: 10,
        background: "#e6faf7",
        border: "1px solid #00c9a744",
        color: "#087f6c",
        fontSize: 15,
        fontWeight: 800,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function AssessmentForm({
  type,
  data,
  setData,
}) {
  if (type === "MRS") {
    return (
      <MRSForm
        data={data}
        setData={setData}
      />
    );
  }

  if (type === "CRS-R") {
    return (
      <CRSForm
        data={data}
        setData={setData}
      />
    );
  }

  if (type === "FIM") {
    return (
      <FIMForm
        data={data}
        setData={setData}
      />
    );
  }

  if (type === "NIHSS") {
    return (
      <NIHSSForm
        data={data}
        setData={setData}
      />
    );
  }

  return null;
}

/* =========================================================
   MAIN APP
========================================================= */

export default function OTTracker() {
  const [session, setSession] =
    useState(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [role, setRole] =
    useState("staff");

  const [patients, setPatients] =
    useState([]);

  const [activeTab, setActiveTab] =
    useState("All");

  const [sessionDate, setSessionDate] =
    useState(today());

  const [records, setRecords] =
    useState({});

  const [showAdd, setShowAdd] =
    useState(false);

  const [editingId, setEditingId] =
    useState(null);

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [expandedId, setExpandedId] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [toast, setToast] =
    useState(null);

  const [view, setView] =
    useState("today");

  const [loaded, setLoaded] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  /* =====================================================
     ASSESSMENT STATE
  ===================================================== */

  const [
    showAssessment,
    setShowAssessment,
  ] = useState(false);

  const [
    assessmentPatient,
    setAssessmentPatient,
  ] = useState(null);

  const [
    assessmentType,
    setAssessmentType,
  ] = useState("");

  const [
    assessmentData,
    setAssessmentData,
  ] = useState({});

  const [
    assessmentDate,
    setAssessmentDate,
  ] = useState(today());

  const [
    assessmentRows,
    setAssessmentRows,
  ] = useState([]);

  /* =====================================================
     TOAST
  ===================================================== */

  const showToast = (
    msg,
    type = "success"
  ) => {
    setToast({
      msg,
      type,
    });

    setTimeout(
      () => setToast(null),
      2500
    );
  };

  /* =====================================================
     LOAD DATA
  ===================================================== */

  const loadData = async (
    currentSession
  ) => {
    setLoaded(false);

    const [
      staffResult,
      patientResult,
      sessionResult,
      assessmentResult,
    ] = await Promise.all([
      supabase
        .from("staff_users")
        .select("role, active")
        .eq(
          "user_id",
          currentSession.user.id
        )
        .maybeSingle(),

      supabase
        .from("patients")
        .select("*")
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("session_records")
        .select("*")
        .order("session_date", {
          ascending: false,
        }),

      supabase
        .from("patient_assessments")
        .select("*")
        .order("assessment_date", {
          ascending: false,
        }),
    ]);

    const {
      data: staff,
      error: staffError,
    } = staffResult;

    const {
      data: patientRows,
      error: patientError,
    } = patientResult;

    const {
      data: sessionRows,
      error: sessionError,
    } = sessionResult;

    const {
      data: assessmentRowsFromDb,
      error: assessmentError,
    } = assessmentResult;

    if (staffError) {
      console.error(staffError);
      throw new Error(
        "Could not check your staff authorization."
      );
    }

    setAuthorized(
      Boolean(staff?.active)
    );

    setRole(
      staff?.role || "viewer"
    );

    if (patientError)
      throw patientError;

    if (sessionError)
      throw sessionError;

    if (assessmentError)
      throw assessmentError;

    setPatients(
      (patientRows || []).map(
        patientFromDb
      )
    );

    setRecords(
      recordsFromDb(
        sessionRows || []
      )
    );

    setAssessmentRows(
      assessmentRowsFromDb || []
    );

    setLoaded(true);
  };

  /* =====================================================
     AUTH
  ===================================================== */

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;

        setSession(
          data.session || null
        );

        setAuthLoading(false);
      });

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (!mounted) return;

          setSession(
            nextSession || null
          );

          if (!nextSession) {
            setAuthorized(false);
            setPatients([]);
            setRecords({});
            setAssessmentRows([]);
            setLoaded(false);
          }
        }
      );

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

        showToast(
          error.message ||
            "Could not load cloud data.",
          "warn"
        );

        setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  /* =====================================================
     ASSESSMENT FUNCTIONS
  ===================================================== */

  const openAssessment = (
    patient,
    type
  ) => {
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

  const calculateAssessmentTotal = (
    type,
    data
  ) => {
    if (type === "MRS") {
      return data.score !== undefined &&
        data.score !== ""
        ? Number(data.score)
        : null;
    }

    if (type === "CRS-R") {
      return [
        "auditory",
        "visual",
        "motor",
        "oromotor",
        "communication",
        "arousal",
      ].reduce(
        (sum, key) =>
          sum + Number(data[key] || 0),
        0
      );
    }

    if (type === "FIM") {
      return Array.from(
        { length: 18 },
        (_, i) =>
          Number(
            data[`item_${i}`] || 0
          )
      ).reduce(
        (sum, value) => sum + value,
        0
      );
    }

    if (type === "NIHSS") {
      const keys = [
        "1a",
        "1b",
        "1c",
        "2",
        "3",
        "4",
        "5a",
        "5b",
        "6a",
        "6b",
        "7",
        "8",
        "9",
        "10",
        "11",
      ];

      return keys.reduce(
        (sum, key) =>
          sum + Number(data[key] || 0),
        0
      );
    }

    return null;
  };

  const validateAssessment = () => {
    if (assessmentType === "MRS") {
      return (
        assessmentData.score !==
          undefined &&
        assessmentData.score !== ""
      );
    }

    if (assessmentType === "CRS-R") {
      const keys = [
        "auditory",
        "visual",
        "motor",
        "oromotor",
        "communication",
        "arousal",
      ];

      return keys.every(
        (key) =>
          assessmentData[key] !==
            undefined &&
          assessmentData[key] !== ""
      );
    }

    if (assessmentType === "FIM") {
      return Array.from(
        { length: 18 },
        (_, i) =>
          assessmentData[
            `item_${i}`
          ] !== undefined &&
          assessmentData[
            `item_${i}`
          ] !== ""
      ).every(Boolean);
    }

    if (assessmentType === "NIHSS") {
      const keys = [
        "1a",
        "1b",
        "1c",
        "2",
        "3",
        "4",
        "5a",
        "5b",
        "6a",
        "6b",
        "7",
        "8",
        "9",
        "10",
        "11",
      ];

      return keys.every(
        (key) =>
          assessmentData[key] !==
            undefined &&
          assessmentData[key] !== ""
      );
    }

    return false;
  };

  const saveAssessment = async () => {
    if (
      !assessmentPatient ||
      !assessmentType
    ) {
      return;
    }

    if (!validateAssessment()) {
      showToast(
        "Please complete all items of the assessment.",
        "warn"
      );
      return;
    }

    setSaving(true);

    try {
      const totalScore =
        calculateAssessmentTotal(
          assessmentType,
          assessmentData
        );

      /*
       IMPORTANT:
       entered_by = Supabase Auth user ID
       entered_by_email = logged-in staff email
      */

      const payload = {
        patient_id:
          assessmentPatient.id,

        assessment_type:
          assessmentType,

        assessment_date:
          assessmentDate,

        total_score:
          totalScore,

        scores:
          assessmentData,

        notes:
          assessmentData.notes ||
          null,

        entered_by:
          session.user.id,

        entered_by_email:
          session.user.email || "",
      };

      const {
        data,
        error,
      } = await supabase
        .from("patient_assessments")
        .insert(payload)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setAssessmentRows(
        (prev) => [
          data,
          ...prev,
        ]
      );

      showToast(
        `${assessmentType} assessment saved successfully!`
      );

      closeAssessment();
    } catch (error) {
      console.error(error);

      showToast(
        error.message ||
          "Could not save assessment.",
        "warn"
      );
    } finally {
      setSaving(false);
    }
  };

  /* =====================================================
     ASSESSMENT HISTORY
  ===================================================== */

  const patientAssessments =
    useMemo(() => {
      if (!assessmentPatient)
        return [];

      return assessmentRows
        .filter(
          (row) =>
            row.patient_id ===
            assessmentPatient.id
        )
        .sort(
          (a, b) =>
            new Date(
              b.assessment_date
            ) -
            new Date(
              a.assessment_date
            )
        );
    }, [
      assessmentRows,
      assessmentPatient,
    ]);

  const assessmentsForPatient = (
    patientId
  ) =>
    assessmentRows
      .filter(
        (row) =>
          row.patient_id ===
          patientId
      )
      .sort(
        (a, b) =>
          new Date(
            b.assessment_date
          ) -
          new Date(
            a.assessment_date
          )
      );

  /* =====================================================
     SIGN OUT
  ===================================================== */

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const selectView = (nextView) => {
    setView(nextView);
    setMobileMenuOpen(false);
  };

  /* =====================================================
     SESSION RECORDS
  ===================================================== */

  const getRecord = (pid) =>
    (records[sessionDate] || {})[
      pid
    ] || emptyRecord();

  const saveSessionRecord = async (
    patientId,
    date,
    record
  ) => {
    const payload = {
      patient_id: patientId,
      session_date: date,
      seen: record.seen,
      reason:
        record.reason || null,
      notes:
        record.notes || null,
    };

    const { error } =
      await supabase
        .from("session_records")
        .upsert(payload, {
          onConflict:
            "patient_id,session_date",
        });

    if (error)
      throw error;
  };

  const setRecord = (
    pid,
    patch
  ) => {
    const previous =
      getRecord(pid);

    const next = {
      ...previous,
      ...patch,
    };

    setRecords((prev) => ({
      ...prev,

      [sessionDate]: {
        ...(prev[sessionDate] || {}),
        [pid]: next,
      },
    }));

    setSaving(true);

    saveSessionRecord(
      pid,
      sessionDate,
      next
    )
      .then(() =>
        setSaving(false)
      )
      .catch((error) => {
        console.error(error);

        setSaving(false);

        showToast(
          error.message ||
            "Could not save session.",
          "warn"
        );
      });
  };

  const markSeen = (pid) => {
    setRecord(pid, {
      seen: true,
      reason: "",
    });

    showToast(
      "Marked as Seen ✓"
    );
  };

  const markNotSeen = (
    pid,
    reason
  ) => {
    setRecord(pid, {
      seen: false,
      reason,
    });
  };

  /* =====================================================
     PATIENT FORM
  ===================================================== */

  const openAddForm = () => {
    setEditingId(null);

    setForm({
      ...EMPTY_FORM,
      date: today(),
    });

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
    sessionTime: p.sessionTime || "",
    location: p.location || "",
   strokeType: p.strokeType || "",
isActive: p.isActive ?? true,
admissionDate: p.admissionDate || "",
dischargeDate: p.dischargeDate || "",
date: p.date,
  });

  setShowAdd(true);
  setExpandedId(null);
};

  const closeForm = () => {
    setShowAdd(false);
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      date: today(),
    });
  };

  const savePatient = async () => {
    if (
      !form.name.trim() ||
      !form.ipNo.trim() ||
      !form.diagnosis.trim()
    ) {
      showToast(
        "Name, IP number and diagnosis are required.",
        "warn"
      );

      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const row =
          patientToDb({
            ...form,
            id: editingId,
          });

        const {
          data,
          error,
        } = await supabase
          .from("patients")
          .update(row)
          .eq(
            "id",
            editingId
          )
          .select()
          .single();

        if (error)
          throw error;

        setPatients((p) =>
          p.map((x) =>
            x.id === editingId
              ? patientFromDb(data)
              : x
          )
        );

        showToast(
          "Patient updated!"
        );
      } else {
        const row =
          patientToDb({
            ...form,
            id: crypto.randomUUID(),
          });

        const {
          data,
          error,
        } = await supabase
          .from("patients")
          .insert(row)
          .select()
          .single();

        if (error)
          throw error;

        setPatients((p) => [
          patientFromDb(data),
          ...p,
        ]);

        showToast(
          "Patient added!"
        );
      }

      closeForm();
    } catch (error) {
      console.error(error);

      showToast(
        error.message ||
          "Could not save patient.",
        "warn"
      );
    } finally {
      setSaving(false);
    }
  };

  const removePatient = async (
    id
  ) => {
    if (
      !window.confirm(
        "Remove this patient and their session records?"
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      const { error } =
        await supabase
          .from("patients")
          .delete()
          .eq("id", id);

      if (error)
        throw error;

      setPatients((p) =>
        p.filter(
          (x) => x.id !== id
        )
      );

      setRecords((prev) => {
        const next = {};

        Object.keys(prev).forEach(
          (d) => {
            const {
              [id]: _drop,
              ...rest
            } = prev[d];

            next[d] = rest;
          }
        );

        return next;
      });

      setAssessmentRows((prev) =>
        prev.filter(
          (x) =>
            x.patient_id !== id
        )
      );

      setExpandedId(null);

      showToast(
        "Patient removed",
        "warn"
      );
    } catch (error) {
      console.error(error);

      showToast(
        error.message ||
          "Could not remove patient.",
        "warn"
      );
    } finally {
      setSaving(false);
    }
  };

  /* =====================================================
     EXPORT
  ===================================================== */

  const buildRows = () => {
    const rows = [
      [
        "Date",
        "IP No",
        "Reg No",
        "Name",
        "Category",
        "Diagnosis",
       "Consulting Dr",
"Room No",
"Session",
"Location",
"Stroke Type",
"Status",
"Reason / Notes",
      ],
    ];

    Object.keys(records)
      .sort()
      .forEach((d) => {
        patients.forEach((p) => {
          const r =
            (records[d] || {})[
              p.id
            ];

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
p.sessionTime || "",
p.location || "",
p.strokeType || "",
r.seen === true
  ? "Seen"
  : r.seen === false
  ? "Not Seen"
  : "Pending",
              r.seen === false
                ? r.reason
                : r.notes || "",
            ]);
          }
        });
      });

    return rows;
  };

  const exportExcel = () => {
  const wb = XLSX.utils.book_new();

  // =========================================================
  // SHEET 1 — SESSION RECORDS
  // =========================================================
  const rows = [
    [
      "Date",
      "IP No",
      "Reg No",
      "Name",
      "Category",
      "Diagnosis",
      "Consulting Dr",
      "Room No",
      "Status",
      "Reason / Notes",
    ],
  ];

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
            r.seen === true
              ? "Seen"
              : r.seen === false
              ? "Not Seen"
              : "Pending",
            r.seen === false ? r.reason : r.notes || "",
          ]);
        }
      });
    });

  const ws = XLSX.utils.aoa_to_sheet(rows);

ws["!cols"] = [
  { wch: 12 },
  { wch: 12 },
  { wch: 10 },
  { wch: 18 },
  { wch: 14 },
  { wch: 28 },
  { wch: 18 },
  { wch: 12 },
  { wch: 10 },
  { wch: 12 },
  { wch: 16 },
  { wch: 12 },
  { wch: 35 },
];

  XLSX.utils.book_append_sheet(wb, ws, "Session Records");


  // =========================================================
  // SHEET 2 — PATIENT LIST
  // =========================================================
  const patRows = [
    [
      "Name",
      "IP No",
      "Reg No",
      "Category",
      "Diagnosis",
      "Consulting Dr",
"Room No",
"Session",
"Location",
"Stroke Type",
"Date of Referral",
    ],
  ];

  patients.forEach((p) =>
    patRows.push([
      p.name,
      p.ipNo,
      p.regNo,
      p.category,
      p.diagnosis,
      p.consultingDr,
      p.roomNo,
      p.sessionTime || "",
      p.location || "",
      p.strokeType || "",
      p.date,
    ])
  );

  const ws2 = XLSX.utils.aoa_to_sheet(patRows);

 ws2["!cols"] = [
  { wch: 20 },
  { wch: 12 },
  { wch: 12 },
  { wch: 16 },
  { wch: 30 },
  { wch: 18 },
  { wch: 12 },
  { wch: 10 },
  { wch: 12 },
  { wch: 16 },
  { wch: 16 },
];

  XLSX.utils.book_append_sheet(wb, ws2, "Patient List");


  // =========================================================
  // SHEET 3 — ASSESSMENT SCALES
  // =========================================================

  const assessmentRowsForExcel = [
    [
      "Assessment Date",
      "IP No",
      "Reg No",
      "Patient Name",
      "Category",
      "Diagnosis",
      "Assessment Scale",
      "Total Score",
      "Entered By",
      "Scores / Data",
      "Notes",
    ],
  ];

  (assessmentRows || []).forEach((assessment) => {
    const patient = patients.find(
      (p) => String(p.id) === String(assessment.patient_id)
    );

    if (!patient) return;

    // Find the staff/user who entered it.
    // Supports different column names in case your Supabase
    // table uses one of these.
    const enteredBy =
      assessment.entered_by ||
      assessment.created_by ||
      assessment.user_id ||
      assessment.staff_id ||
      assessment.entered_by_email ||
      "—";

    // Convert the scores JSON into readable Excel text
    let scoreData = "";

    if (assessment.scores) {
      try {
        scoreData = Object.entries(assessment.scores)
          .filter(([key]) => key !== "notes")
          .map(([key, value]) => `${key}: ${value}`)
          .join(" | ");
      } catch {
        scoreData = JSON.stringify(assessment.scores);
      }
    }

    assessmentRowsForExcel.push([
      assessment.assessment_date || "",
      patient.ipNo || "",
      patient.regNo || "",
      patient.name || "",
      patient.category || "",
      patient.diagnosis || "",
      assessment.assessment_type || "",
      assessment.total_score ?? "",
      enteredBy,
      scoreData,
      assessment.notes || "",
    ]);
  });

  const ws3 = XLSX.utils.aoa_to_sheet(assessmentRowsForExcel);

  ws3["!cols"] = [
    { wch: 16 }, // Date
    { wch: 12 }, // IP
    { wch: 12 }, // Reg
    { wch: 20 }, // Name
    { wch: 16 }, // Category
    { wch: 30 }, // Diagnosis
    { wch: 25 }, // Scale
    { wch: 14 }, // Total score
    { wch: 30 }, // Entered by
    { wch: 60 }, // Scores
    { wch: 35 }, // Notes
  ];

  XLSX.utils.book_append_sheet(wb, ws3, "Assessment Scales");


  // =========================================================
  // DOWNLOAD EXCEL
  // =========================================================

  XLSX.writeFile(
    wb,
    `OTTrack_Complete_Records_${today()}.xlsx`
  );

  showToast("Complete Excel exported successfully! 📊");
};

  /* =====================================================
     FILTER
  ===================================================== */

  const filtered =
    useMemo(() => {
      return patients.filter(
        (p) => {
          const catMatch =
            activeTab === "All" ||
            p.category ===
              activeTab;

          const q =
            search.toLowerCase();

          const srch =
            !q ||
            [
              p.name,
              p.ipNo,
              p.regNo,
              p.diagnosis,
              p.consultingDr,
              p.roomNo,
            ].some((f) =>
              (f || "")
                .toLowerCase()
                .includes(q)
            );

          return (
            catMatch && srch
          );
        }
      );
    }, [
      patients,
      activeTab,
      search,
    ]);

  const todayRecs =
    records[sessionDate] ||
    {};

  const seen =
    patients.filter(
      (p) =>
        todayRecs[p.id]
          ?.seen === true
    ).length;

  const notSeen =
    patients.filter(
      (p) =>
        todayRecs[p.id]
          ?.seen === false
    ).length;

  const pending =
    patients.length -
    seen -
    notSeen;
    const cvaCount = patients.filter(
  (p) => p.category === "CVA"
).length;

const haemorrhageCount = patients.filter(
  (p) =>
    p.category === "CVA" &&
    p.strokeType === "Haemorrhage"
).length;

const infarctCount = patients.filter(
  (p) =>
    p.category === "CVA" &&
    p.strokeType === "Infarct"
).length;

const occlusionCount = patients.filter(
  (p) =>
    p.category === "CVA" &&
    p.strokeType === "Occlusion"
).length;

const tbiCount = patients.filter(
  (p) => p.category === "TBI"
).length;

const departmentCount = patients.filter(
  (p) => p.category === "Department"
).length;

const newIocCount = patients.filter(
  (p) => p.category === "New IOC Cases"
).length;

  const allDates =
    Object.keys(records)
      .filter(
        (d) =>
          Object.keys(
            records[d] || {}
          ).length > 0
      )
      .sort()
      .reverse();

  /* =====================================================
     LOADING
  ===================================================== */

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.bg,
          color: COLORS.muted,
        }}
      >
        Loading OTTrack…
      </div>
    );
  }

  if (!session)
    return <LoginScreen />;

  if (!loaded) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.bg,
          color: COLORS.muted,
        }}
      >
        Loading your OT records…
      </div>
    );
  }

  /* =====================================================
     APP
  ===================================================== */

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        fontFamily:
          "'DM Sans','Segoe UI',sans-serif",
        color: COLORS.text,
      }}
    >
      <style>{`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes popIn {
    from {
      opacity: 0;
      transform: scale(0.97);
    }

    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .hvr:hover {
    background: #f7faff !important;
  }

  .btn:hover {
    opacity: 0.85;
    transform: translateY(-1px);
  }

  textarea,
  input,
  select {
    outline: none;
    max-width: 100%;
  }

  input:focus,
  select:focus,
  textarea:focus {
    border-color: #4e6ef2 !important;
    box-shadow: 0 0 0 3px rgba(78, 110, 242, 0.10);
  }

  ::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: #cbd5e0;
    border-radius: 99px;
  }

  /* =====================================================
   ANDROID / MOBILE RESPONSIVE
   Desktop layout remains unchanged
===================================================== */

html,
body,
#root {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.ot-mobile-header,
.ot-mobile-menu,
.ot-mobile-menu-backdrop {
  display: none;
}

@media (max-width: 700px) {

  html,
  body {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-x: hidden !important;
  }

  body {
    -webkit-text-size-adjust: 100%;
  }

  #root {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }

  /* =========================================
     APP LAYOUT
  ========================================= */

  .ot-app-layout {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    max-width: 100vw !important;
    min-width: 0 !important;
    min-height: 100vh !important;
  }

  /* =========================================
     SIDEBAR → MOBILE TOP BAR
  ========================================= */

  .ot-sidebar {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    height: auto !important;
    min-height: 0 !important;

    display: block !important;
    position: relative !important;
    padding: calc(10px + env(safe-area-inset-top)) 12px 10px !important;
    overflow: visible !important;
    flex-shrink: 0 !important;
  }

  .ot-desktop-brand,
  .ot-desktop-nav-item,
  .ot-account-controls {
    display: none !important;
  }

  .ot-mobile-header {
    display: flex !important;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
  }

  .ot-mobile-brand {
    min-width: 0;
    color: #fff;
    font-size: 18px;
    font-weight: 900;
  }

  .ot-mobile-menu-button {
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    border: 1px solid #2d3a67;
    border-radius: 10px;
    background: #16204b;
    color: #fff;
    font-size: 25px;
    line-height: 1;
    cursor: pointer;
    touch-action: manipulation;
  }

  .ot-mobile-menu-backdrop {
    display: block !important;
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: transparent;
  }

  .ot-mobile-menu {
    display: flex !important;
    position: absolute;
    top: calc(100% - 6px);
    right: 12px;
    z-index: 1001;
    width: min(300px, calc(100vw - 24px));
    min-width: 0;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border: 1px solid #2d3a67;
    border-radius: 12px;
    background: #0b1437;
    box-shadow: 0 12px 30px rgba(0,0,0,.28);
  }

  .ot-mobile-menu-item {
    width: 100%;
    min-height: 44px;
    border: 0;
    border-radius: 8px;
    padding: 10px 12px;
    background: transparent;
    color: #fff;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
    touch-action: manipulation;
  }

  .ot-mobile-menu-item:active {
    background: #16204b;
  }

  .ot-mobile-account {
    min-width: 0;
    margin: 4px 4px;
    padding: 10px 8px;
    border-top: 1px solid #2d3a67;
    border-bottom: 1px solid #2d3a67;
    color: #a0aec0;
    font-size: 11px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  /* =========================================
     MAIN CONTENT
  ========================================= */

  .ot-main-content {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;

    flex: 1 1 auto !important;

    padding: 14px !important;
    margin: 0 !important;

    overflow-y: visible !important;
  }

  /* =========================================
     HEADER
  ========================================= */

  .ot-main-content h2 {
    font-size: 19px !important;
    line-height: 1.25 !important;
  }

  /* =========================================
     HEADER BUTTONS
  ========================================= */

  .ot-main-content > div:first-child {
    width: 100% !important;
    max-width: 100% !important;
  }

  .ot-main-content .btn {
    min-height: 40px !important;
    touch-action: manipulation;
  }

  /* =========================================
     CATEGORY BUTTONS
  ========================================= */

  .ot-main-content button {
    max-width: 100% !important;
  }

  /* =========================================
     INPUTS
  ========================================= */

  .ot-main-content input,
  .ot-main-content select,
  .ot-main-content textarea {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }

  /* =========================================
     SEARCH
  ========================================= */

  .ot-main-content input[placeholder*="Search"] {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;

    font-size: 12px !important;
  }

  /* =========================================
     ADD PATIENT FORM
  ========================================= */

  .ot-patient-form-grid {
    grid-template-columns: minmax(0, 1fr) !important;
    width: 100% !important;
    min-width: 0 !important;
  }

  /* =========================================
     PATIENT CARDS
  ========================================= */

  .ot-main-content > div {
    max-width: 100% !important;
    min-width: 0 !important;
  }

  .ot-main-content div {
    min-width: 0;
  }

  .ot-main-content .ot-user-text,
  .ot-main-content .ot-patient-text {
    overflow-wrap: anywhere;
  }

  /* =========================================
     MOBILE STATS
  ========================================= */

  .ot-stats-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr)) !important;

    width: 100% !important;
    max-width: 100% !important;

    gap: 9px !important;
  }

  /* =========================================
     PREVENT HORIZONTAL OVERFLOW
  ========================================= */

  .ot-stats-grid > div {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .ot-patient-card-header {
    grid-template-columns: minmax(0, 1fr) !important;
    align-items: start !important;
  }

  .ot-patient-card-header > div {
    min-width: 0;
  }

  .ot-patient-status {
    align-items: flex-start !important;
  }

  .ot-history-header {
    flex-wrap: wrap !important;
    align-items: flex-start !important;
    gap: 10px !important;
  }

  .ot-history-badges {
    flex-wrap: wrap !important;
  }

  .ot-assessment-overlay {
    align-items: flex-start !important;
    padding: 12px !important;
    overflow-y: auto;
  }

  .ot-assessment-modal {
    width: min(100%, 760px) !important;
    max-height: calc(100dvh - 24px) !important;
    min-width: 0;
  }

  .ot-assessment-header {
    align-items: flex-start !important;
    padding: 14px !important;
  }

  .ot-assessment-header-content {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .ot-assessment-body {
    padding: 14px !important;
    min-width: 0;
  }

  .ot-assessment-meta {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  .ot-assessment-email {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .ot-assessment-footer {
    flex-wrap: wrap !important;
  }

  .ot-assessment-footer button {
    min-width: 0;
  }

}

/* =============================================
   SMALL ANDROID PHONES
============================================= */

@media (max-width: 430px) {

  .ot-sidebar {
    padding: calc(8px + env(safe-area-inset-top)) 8px 8px !important;
  }

  .ot-main-content {
    padding: 10px !important;
  }

  .ot-main-content h2 {
    font-size: 18px !important;
  }

  .ot-main-content .btn {
    font-size: 12px !important;
  }

  .ot-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .ot-history-badges {
    width: 100%;
  }

  .ot-assessment-footer button {
    width: 100%;
  }

}
`}</style>

      {/* =================================================
          TOAST
      ================================================= */}

      {toast && (
        <div
          style={{
            position: "fixed",
            top: 18,
            right: 18,
            zIndex: 99999,
            background:
              toast.type === "warn"
                ? "#e63757"
                : "#00c9a7",
            color: "#fff",
            padding:
              "11px 22px",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 13,
            boxShadow:
              "0 8px 30px rgba(0,0,0,0.18)",
            animation:
              "fadeUp .25s ease",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* =================================================
          SAVING
      ================================================= */}

      {saving && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            right: 18,
            zIndex: 9999,
            background: "#1a2a5e",
            color: "#a0aec0",
            padding: "6px 14px",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 11,
          }}
        >
          Saving…
        </div>
      )}

      <div
  className="ot-app-layout"
  style={{
    display: "flex",
    minHeight: "100vh",
    width: "100%",
    maxWidth: "100vw",
  }}
>
  {/* =================================================
      SIDEBAR
  ================================================= */}

  <div
    className="ot-sidebar"
    style={{
      width: 210,
      background: COLORS.sidebar,
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      padding: "24px 0",
    }}
  >
          <div className="ot-mobile-header">
            <div className="ot-mobile-brand">
              🧠 <span style={{ color: "#4e6ef2" }}>OT</span>Track
            </div>

            <button
              className="ot-mobile-menu-button"
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              ⋮
            </button>
          </div>

          {mobileMenuOpen && (
            <>
              <div
                className="ot-mobile-menu-backdrop"
                onClick={() => setMobileMenuOpen(false)}
              />

              <div className="ot-mobile-menu">
                <button
                  className="ot-mobile-menu-item"
                  type="button"
                  onClick={() => selectView("today")}
                >
                  📋 Today's OT Cases
                </button>

                <button
                  className="ot-mobile-menu-item"
                  type="button"
                  onClick={() => selectView("history")}
                >
                  📅 Session History
                </button>

                <div className="ot-mobile-account">
                  <div>👤 {session.user.email}</div>
                  <div>Role: {role}</div>
                </div>

                <button
                  className="ot-mobile-menu-item"
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                >
                  🚪 Sign Out
                </button>
              </div>
            </>
          )}

          <div
            className="ot-desktop-brand"
            style={{
              padding:
                "0 18px 24px",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#fff",
              }}
            >
              🧠{" "}
              <span
                style={{
                  color: "#4e6ef2",
                }}
              >
                OT
              </span>
              Track
            </div>

            <div
              style={{
                fontSize: 10,
                color: "#4a5568",
                marginTop: 3,
                fontWeight: 600,
                textTransform:
                  "uppercase",
                letterSpacing: 1,
              }}
            >
              Occupational Therapy
            </div>
          </div>

          {[
            {
              id: "today",
              icon: "📋",
              label: "Today's Cases",
            },
            {
              id: "history",
              icon: "📅",
              label: "Session History",
            },
          ].map((item) => (
            <button
              className="ot-desktop-nav-item"
              key={item.id}
              onClick={() =>
                selectView(item.id)
              }
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: 10,
                width: "100%",
                border: 0,
                background:
                  view === item.id
                    ? "#16204b"
                    : "transparent",
                color:
                  view === item.id
                    ? "#fff"
                    : "#718096",
                padding:
                  "12px 18px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                textAlign:
                  "left",
                fontFamily:
                  "inherit",
              }}
            >
              <span>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}

          <div
            className="ot-account-controls"
            style={{
              marginTop: "auto",
              padding: 18,
            }}
          >
            <div
              className="ot-account-email"
              style={{
                color: "#718096",
                fontSize: 10,
                marginBottom: 6,
                overflow: "hidden",
                textOverflow:
                  "ellipsis",
                whiteSpace:
                  "nowrap",
              }}
            >
              {session.user.email}
            </div>

            <div
              className="ot-account-role"
              style={{
                color: "#4a5568",
                fontSize: 10,
                marginBottom: 10,
              }}
            >
              Role: {role}
            </div>

            <button
              className="ot-signout-button"
              onClick={signOut}
              style={{
                width: "100%",
                border:
                  "1px solid #2d3a67",
                background:
                  "transparent",
                color: "#a0aec0",
                padding: 8,
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* =================================================
            MAIN
        ================================================= */}

        <div
  className="ot-main-content"
  style={{
    flex: 1,
    padding:
      "28px 30px",
    maxWidth: 1250,
    width: "100%",
    margin: "0 auto",
  }}
>
          {/* HEADER */}

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              marginBottom: 22,
              gap: 15,
              flexWrap:
                "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 23,
                  fontWeight: 900,
                  color:
                    COLORS.sidebar,
                }}
              >
                {view ===
                "today"
                  ? "Today's OT Cases"
                  : "Session History"}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color:
                    COLORS.muted,
                  marginTop: 3,
                }}
              >
                Shared Supabase records
                •{" "}
                {fmtDate(
                  sessionDate
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap:
                  "wrap",
              }}
            >
              {authorized && (
                <button
                  className="btn"
                  onClick={
                    openAddForm
                  }
                  style={{
                    background:
                      "#4e6ef2",
                    border: 0,
                    color: "#fff",
                    padding:
                      "9px 16px",
                    borderRadius: 9,
                    fontWeight: 800,
                    fontSize: 12,
                    cursor:
                      "pointer",
                    fontFamily:
                      "inherit",
                  }}
                >
                  ＋ Add Patient
                </button>
              )}

<button
  className="btn"
  onClick={() => window.location.reload()}
  style={{
    background: "#ffffff",
    border: "1.5px solid #dbe3f0",
    color: COLORS.muted,
    padding: "9px 16px",
    borderRadius: 9,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
  }}
>
  🔄 Refresh
</button>

<button
  className="btn"
  onClick={
    exportExcel
  }

                style={{
                  background:
                    "#fff",
                  border: `1.5px solid ${COLORS.border}`,
                  color:
                    COLORS.muted,
                  padding:
                    "9px 16px",
                  borderRadius: 9,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor:
                    "pointer",
                  fontFamily:
                    "inherit",
                }}
              >
                📊 Export Excel
              </button>
            </div>
          </div>

          {/* =================================================
              TODAY
          ================================================= */}

          {view ===
            "today" && (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 7,
                  marginBottom: 18,
                  flexWrap:
                    "wrap",
                }}
              >
                {CATEGORIES.map(
                  (c) => (
                    <button
                      key={c}
                      onClick={() =>
                        setActiveTab(
                          c
                        )
                      }
                      style={{
                        border: `1.5px solid ${
                          activeTab ===
                          c
                            ? "#4e6ef2"
                            : COLORS.border
                        }`,
                        background:
                          activeTab ===
                          c
                            ? "#ebedff"
                            : "#fff",
                        color:
                          activeTab ===
                          c
                            ? "#4e6ef2"
                            : COLORS.muted,
                        padding:
                          "6px 13px",
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 11,
                        cursor:
                          "pointer",
                        fontFamily:
                          "inherit",
                      }}
                    >
                      {c}
                    </button>
                  )
                )}

                <input
                  type="date"
                  value={
                    sessionDate
                  }
                  onChange={(e) =>
                    setSessionDate(
                      e.target.value
                    )
                  }
                  style={{
                    marginLeft:
                      "auto",
                    padding:
                      "6px 10px",
                    borderRadius: 8,
                    border: `1.5px solid ${COLORS.border}`,
                    background:
                      "#fff",
                    color:
                      COLORS.text,
                    fontSize: 11,
                  }}
                />
              </div>

              {/* STAT CARDS */}

              <div
                className="ot-stats-grid"
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(4,1fr)",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                {[
                  {
  label: "Total",
  val: patients.length,
  color: "#4e6ef2",
  bg: "#ebedff",
  icon: "📋",

 detail: (
  <div
    style={{
      marginTop: 7,
      fontSize: 10,
      lineHeight: 1.4,
      color: COLORS.muted,
    }}
    >
      <div
  style={{
    fontWeight: 800,
    color: "#2e7d32",
    marginBottom: 1,
  }}
>
  CVA: {cvaCount}
</div>

<div style={{ paddingLeft: 8 }}>
  • Haemorrhage: {haemorrhageCount}
</div>

<div style={{ paddingLeft: 8 }}>
  • Infarct: {infarctCount}
</div>

<div style={{ paddingLeft: 8 }}>
  • Occlusion: {occlusionCount}
</div>

      <div
        style={{
          marginTop: 3,
          fontWeight: 800,
          color: "#e65100",
        }}
      >
        TBI: {tbiCount}
      </div>

      <div
        style={{
          fontWeight: 800,
          color: "#1565c0",
        }}
      >
        Department: {departmentCount}
      </div>

      <div
        style={{
          fontWeight: 800,
          color: "#6a1b9a",
        }}
      >
        New IOC: {newIocCount}
      </div>
    </div>
  ),
},
                  {
                    label:
                      "Seen",
                    val: seen,
                    color:
                      "#00c9a7",
                    bg:
                      "#e6faf7",
                    icon: "✅",
                  },
                  {
                    label:
                      "Not Seen",
                    val:
                      notSeen,
                    color:
                      "#e63757",
                    bg:
                      "#fdeef1",
                    icon: "❌",
                  },
                  {
                    label:
                      "Pending",
                    val:
                      pending,
                    color:
                      "#f6c90e",
                    bg:
                      "#fffbe6",
                    icon: "⏳",
                  },
                ].map(
                  (s) => (
                    <div
                      key={
                        s.label
                      }
                      style={{
  background: COLORS.card,
  borderRadius: 12,
  padding: "14px 16px",
  minHeight: 190,
  border: `1.5px solid ${s.color}22`,
  boxShadow:
    "0 2px 8px rgba(0,0,0,.05)",
}}
                    >
                      <div
                        style={{
                          fontSize: 18,
                          marginBottom: 4,
                        }}
                      >
                        {s.icon}
                      </div>

                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 900,
                          color:
                            s.color,
                        }}
                      >
                        {s.val}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color:
                            COLORS.muted,
                          fontWeight: 700,
                          textTransform:
                            "uppercase",
                        }}
                      >
                       {s.label}
</div>

{s.detail}

</div>
                  )
                )}
              </div>

              {/* =================================================
                  ADD PATIENT
              ================================================= */}

              {showAdd && (
                <div
                  style={{
                    background:
                      COLORS.card,
                    borderRadius: 14,
                    padding: 20,
                    marginBottom: 18,
                    border:
                      "1.5px solid #4e6ef244",
                    boxShadow:
                      "0 4px 20px rgba(78,110,242,.10)",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      color:
                        "#4e6ef2",
                      marginBottom: 14,
                      fontSize: 14,
                    }}
                  >
                    {editingId
                      ? "✏️ Edit Patient"
                      : "🧠 New OT Patient"}
                  </div>

<div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: 18,
  }}
>
  {/* =========================
      PATIENT
  ========================= */}
  <div>
    <div
      style={{
        fontSize: 10,
        fontWeight: 900,
        color: COLORS.sidebar,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 9,
      }}
    >
      Patient
    </div>

    <div
      className="ot-patient-form-grid"
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(180px,1fr))",
        gap: 10,
      }}
    >
      {[
        {
          key: "name",
          label: "Patient Name *",
          type: "text",
        },
        {
          key: "ipNo",
          label: "IP Number *",
          type: "text",
        },
        {
          key: "regNo",
          label: "Reg Number",
          type: "text",
        },
      ].map((f) => (
        <div
          key={f.key}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <label style={labelStyle}>
            {f.label}
          </label>

          <input
            type={f.type}
            value={form[f.key] || ""}
            onChange={(e) =>
              setForm((x) => ({
                ...x,
                [f.key]: e.target.value,
              }))
            }
            style={inputStyle}
          />
        </div>
      ))}
    </div>
  </div>

  {/* =========================
      CLINICAL
  ========================= */}
  <div>
    <div
      style={{
        fontSize: 10,
        fontWeight: 900,
        color: COLORS.sidebar,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 9,
      }}
    >
      Clinical
    </div>

    <div
      className="ot-patient-form-grid"
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(180px,1fr))",
        gap: 10,
      }}
    >
      {/* Category */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <label style={labelStyle}>
          Category
        </label>

        <select
          value={form.category}
          onChange={(e) =>
            setForm((x) => ({
              ...x,
              category: e.target.value,
              strokeType:
                e.target.value === "CVA"
                  ? x.strokeType
                  : "",
            }))
          }
          style={inputStyle}
        >
          {CATEGORIES.filter(
            (c) => c !== "All"
          ).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Stroke Type */}
      {(form.category === "CVA" ||
        /stroke|cva/i.test(
          form.diagnosis || ""
        )) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <label style={labelStyle}>
            Stroke Type
          </label>

          <select
            value={form.strokeType || ""}
            onChange={(e) =>
              setForm((x) => ({
                ...x,
                strokeType:
                  e.target.value,
              }))
            }
            style={inputStyle}
          >
            <option value="">
              Select Stroke Type
            </option>
            <option value="Haemorrhage">
              Haemorrhage
            </option>
            <option value="Occlusion">
              Occlusion
            </option>
            <option value="Infarct">
              Infarct
            </option>
          </select>
        </div>
      )}
      {/* Admission Date */}
<div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: 4,
  }}
>
  <label style={labelStyle}>
    Admission Date
  </label>

  <input
    type="date"
    value={form.admissionDate || ""}
    onChange={(e) =>
      setForm((x) => ({
        ...x,
        admissionDate: e.target.value,
      }))
    }
    style={inputStyle}
  />
</div>

{/* Discharge Date */}
<div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: 4,
  }}
>
  <label style={labelStyle}>
    Discharge Date
  </label>

  <input
    type="date"
    value={form.dischargeDate || ""}
    onChange={(e) =>
      setForm((x) => ({
        ...x,
        dischargeDate: e.target.value,
      }))
    }
    style={inputStyle}
  />
</div>

{/* Patient Status */}
<div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: 4,
  }}
>
  <label style={labelStyle}>
    Patient Status
  </label>

  <select
    value={form.isActive === false ? "Inactive" : "Active"}
    onChange={(e) =>
      setForm((x) => ({
        ...x,
        isActive: e.target.value === "Active",
      }))
    }
    style={inputStyle}
  >
    <option value="Active">Active</option>
    <option value="Inactive">Inactive</option>
  </select>
</div>

      {/* Diagnosis */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          gridColumn: "1 / -1",
        }}
      >
        <label style={labelStyle}>
          Diagnosis *
        </label>

        <input
          type="text"
          value={form.diagnosis || ""}
          onChange={(e) =>
            setForm((x) => ({
              ...x,
              diagnosis: e.target.value,
            }))
          }
          placeholder="Enter primary diagnosis..."
          style={inputStyle}
        />
      </div>
    </div>
  </div>

  {/* =========================
      LOCATION
  ========================= */}
  <div>
    <div
      style={{
        fontSize: 10,
        fontWeight: 900,
        color: COLORS.sidebar,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 9,
      }}
    >
      Location
    </div>

    <div
      className="ot-patient-form-grid"
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(180px,1fr))",
        gap: 10,
      }}
    >
      {/* Consulting Doctor */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <label style={labelStyle}>
          Consulting Doctor
        </label>

        <input
          type="text"
          value={form.consultingDr || ""}
          onChange={(e) =>
            setForm((x) => ({
              ...x,
              consultingDr:
                e.target.value,
            }))
          }
          style={inputStyle}
        />
      </div>

      {/* Room */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <label style={labelStyle}>
          Room / Bed No
        </label>

        <input
          type="text"
          value={form.roomNo || ""}
          onChange={(e) =>
            setForm((x) => ({
              ...x,
              roomNo: e.target.value,
            }))
          }
          style={inputStyle}
        />
      </div>
    </div>
  </div>

  {/* =========================
      SESSION
  ========================= */}
  <div>
    <div
      style={{
        fontSize: 10,
        fontWeight: 900,
        color: COLORS.sidebar,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 9,
      }}
    >
      Session
    </div>

    <div
      className="ot-patient-form-grid"
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(180px,1fr))",
        gap: 10,
      }}
    >
      {/* AM / PM */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <label style={labelStyle}>
          Session
        </label>

        <select
          value={form.sessionTime || ""}
          onChange={(e) =>
            setForm((x) => ({
              ...x,
              sessionTime:
                e.target.value,
            }))
          }
          style={inputStyle}
        >
          <option value="">
            Select Session
          </option>
          <option value="AM">
            AM
          </option>
          <option value="PM">
            PM
          </option>
        </select>
      </div>

      {/* Ward / ICU */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <label style={labelStyle}>
          Location
        </label>

        <select
          value={form.location || ""}
          onChange={(e) =>
            setForm((x) => ({
              ...x,
              location:
                e.target.value,
            }))
          }
          style={inputStyle}
        >
          <option value="">
            Select Location
          </option>
          <option value="Ward">
            Ward
          </option>
          <option value="ICU">
            ICU
          </option>
        </select>
      </div>

      {/* Referral Date */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <label style={labelStyle}>
          Date of Referral
        </label>

        <input
          type="date"
          value={form.date || ""}
          onChange={(e) =>
            setForm((x) => ({
              ...x,
              date: e.target.value,
            }))
          }
          style={inputStyle}
        />
      </div>
    </div>
  </div>
</div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "flex-end",
                    marginTop: 18,
                  }}
                >
                    <button
                      className="btn"
                      onClick={
                        savePatient
                      }
                      style={{
                        background:
                          "#4e6ef2",
                        border: 0,
                        color:
                          "#fff",
                        padding:
                          "11px 28px",
                        borderRadius: 10,
                        fontWeight: 700,
                        cursor:
                          "pointer",
                      }}
                    >
                      {editingId
                        ? "✓ Save Changes"
                        : "✓ Add Patient"}
                    </button>

                    <button
                      className="btn"
                      onClick={
                        closeForm
                      }
                      style={{
                        background:
                          "#f7fafc",
                        border: `1.5px solid ${COLORS.border}`,
                        color:
                          COLORS.muted,
                        padding:
                          "11px 20px",
                        borderRadius: 10,
                        fontWeight: 700,
                        cursor:
                          "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* SEARCH */}

              <input
                placeholder="🔍 Search by name, IP no, reg no, diagnosis, doctor, room..."
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                style={{
                  width: "100%",
                  padding:
                    "10px 14px",
                  borderRadius: 10,
                  border: `1.5px solid ${COLORS.border}`,
                  fontSize: 13,
                  fontFamily:
                    "inherit",
                  background:
                    "#fff",
                  marginBottom: 14,
                }}
              />

              {/* =================================================
                  PATIENT LIST
              ================================================= */}

              <div
                style={{
                  display:
                    "flex",
                  flexDirection:
                    "column",
                  gap: 10,
                }}
              >
                {filtered.length ===
                  0 && (
                  <div
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "50px 20px",
                      color:
                        COLORS.muted,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 36,
                      }}
                    >
                      🔍
                    </div>

                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        marginTop: 10,
                      }}
                    >
                      No patients
                      found
                    </div>
                  </div>
                )}

                {filtered.map(
                  (p) => {
                    const rec =
                      getRecord(
                        p.id
                      );

                    const catStyle =
                      CAT_COLORS[
                        p.category
                      ] || {
                        bg: "#f7fafc",
                        color:
                          "#718096",
                        border:
                          "#e2e8f0",
                      };

                    const isExpanded =
                      expandedId ===
                      p.id;

                    const pAssessments =
                      assessmentsForPatient(
                        p.id
                      );

                    return (
                      <div
                        key={p.id}
                        style={{
                          background:
                            COLORS.card,
                          borderRadius: 14,
                          border:
                            rec.seen ===
                            true
                              ? "1.5px solid #00c9a744"
                              : rec.seen ===
                                false
                              ? "1.5px solid #e6375744"
                              : `1.5px solid ${COLORS.border}`,
                          boxShadow:
                            "0 2px 8px rgba(0,0,0,.05)",
                          overflow:
                            "hidden",
                        }}
                      >
                        {/* PATIENT HEADER */}

                        <div
                          className="ot-patient-card-header"
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "1fr auto",
                            alignItems:
                              "center",
                            padding:
                              "14px 16px",
                            gap: 12,
                            cursor:
                              "pointer",
                          }}
                          onClick={() =>
                            setExpandedId(
                              isExpanded
                                ? null
                                : p.id
                            )
                          }
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "flex-start",
                              gap: 12,
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                background:
                                  catStyle.bg,
                                color:
                                  catStyle.color,
                                border: `1px solid ${catStyle.border}`,
                                padding: "3px 9px",
borderRadius: 7,
fontSize: 10,
fontWeight: 800,
whiteSpace: "nowrap",
flexShrink: 0,
                              }}
                            >
                              {p.category}
                            </div>

                            <div
                              style={{
                                minWidth: 0,
                              }}
                            >
                             <div
  className="ot-patient-text"
  style={{
    fontWeight: 900,
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 1.2,
  }}
>
  {p.name}
</div>

                              <div
  className="ot-patient-text"
  style={{
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
    fontWeight: 600,
  }}
>
  {p.diagnosis}
</div>

                              <div
                                style={{
                                  display:
                                    "flex",
                                  flexWrap:
                                    "wrap",
                                  gap: 6,
                                  marginTop: 6,
                                }}
                              >
                                {[
                                  {
                                    label:
                                      "IP",
                                    val:
                                      p.ipNo,
                                  },
                                  {
                                    label:
                                      "Reg",
                                    val:
                                      p.regNo,
                                  },
                                  {
                                    label:
                                      "Dr",
                                    val:
                                      p.consultingDr,
                                  },
                                  {
                                    label:
                                      "Room",
                                    val:
                                      p.roomNo,
                                  },
                                ].map(
                                  (f) =>
                                    f.val ? (
                                      <span
                                        key={
                                          f.label
                                        }
                                        style={{
                                          fontSize: 10,
background: "#f1f5f9",
color: "#4a5568",
padding: "3px 7px",
                                          borderRadius: 6,
                                          fontWeight: 600,
                                        }}
                                      >
                                        <span
                                          style={{
                                            color:
                                              COLORS.muted,
                                          }}
                                        >
                                          {
                                            f.label
                                          }
                                          :{" "}
                                        </span>
                                        {
                                          f.val
                                        }
                                      </span>
                                    ) : null
                                                               )}
                              </div>

                              {/* SESSION / LOCATION / STROKE TYPE */}

                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 6,
                                  marginTop: 6,
                                }}
                              >
                                {p.sessionTime && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      background: "#eef2ff",
                                      color: "#4e6ef2",
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                      fontWeight: 700,
                                    }}
                                  >
                                    🕐 {p.sessionTime}
                                  </span>
                                )}

                                {p.location && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      background: "#e6faf7",
                                      color: "#008f78",
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                      fontWeight: 700,
                                    }}
                                  >
                                    🏥 {p.location}
                                  </span>
                                )}

                                {p.strokeType && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      background: "#fff3e0",
                                      color: "#e65100",
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                      fontWeight: 700,
                                    }}
                                  >
                                    🧠 {p.strokeType}
                                  </span>
                                  )}
                                  
                                  {p.admissionDate && (
  <span
    style={{
      background: "#eef2ff",
      color: "#3730a3",
      padding: "3px 8px",
      borderRadius: 6,
      fontWeight: 600,
      fontSize: 10,
    }}
  >
    📅 Admit: {p.admissionDate}
  </span>
)}

{p.dischargeDate && (
  <span
    style={{
      background: "#fff1f2",
      color: "#be123c",
      padding: "3px 8px",
      borderRadius: 6,
      fontWeight: 600,
      fontSize: 10,
    }}
  >
    🏁 Discharge: {p.dischargeDate}
  </span>
)}

<span
  style={{
    fontSize: 10,
    background: p.isActive
      ? "#e6faf7"
      : "#fdeef1",
    color: p.isActive
      ? "#008f78"
      : "#e63757",
    padding: "3px 8px",
    borderRadius: 6,
    fontWeight: 700,
  }}
>
  {p.isActive ? "🟢 Active" : "🔴 Inactive"}
</span>
                          
                              </div>
                            </div>
                          </div>

                          <div
                            className="ot-patient-status"
                            style={{
                              display:
                                "flex",
                              flexDirection:
                                "column",
                              alignItems:
                                "flex-end",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                background:
                                  rec.seen ===
                                  true
                                    ? "#e6faf7"
                                    : rec.seen ===
                                      false
                                    ? "#fdeef1"
                                    : "#f7fafc",
                                color:
                                  rec.seen ===
                                  true
                                    ? "#00c9a7"
                                    : rec.seen ===
                                      false
                                    ? "#e63757"
                                    : "#a0aec0",
                                padding:
                                  "5px 14px",
                                borderRadius: 8,
                                fontWeight: 800,
                                fontSize: 12,
                              }}
                            >
                              {rec.seen ===
                              true
                                ? "✅ Seen"
                                : rec.seen ===
                                  false
                                ? "❌ Not Seen"
                                : "⏳ Pending"}
                            </div>

                            <div
                              style={{
                                fontSize: 11,
                                color:
                                  "#a0aec0",
                              }}
                            >
                              {isExpanded
                                ? "▲ collapse"
                                : "▼ expand"}
                            </div>
                          </div>
                        </div>

                        {/* EXPANDED */}

                        {isExpanded && (
                          <div
                            style={{
                              borderTop:
                                `1px solid ${COLORS.border}`,
                              padding: 16,
                              background:
                                "#fafcff",
                            }}
                          >
                            {/* ACTION BUTTONS */}

                            <div
                              style={{
                                display:
                                  "flex",
                                gap: 10,
                                marginBottom: 14,
                                flexWrap:
                                  "wrap",
                              }}
                            >
                              {authorized && (
                                <button
                                  className="btn"
                                  onClick={() =>
                                    markSeen(
                                      p.id
                                    )
                                  }
                                  style={{
                                    background:
                                      rec.seen ===
                                      true
                                        ? "#00c9a7"
                                        : "#e6faf7",
                                    border:
                                      "1.5px solid #00c9a7",
                                    color:
                                      rec.seen ===
                                      true
                                        ? "#fff"
                                        : "#00c9a7",
                                    padding:
                                      "9px 22px",
                                    borderRadius: 10,
                                    fontWeight: 800,
                                    cursor:
                                      "pointer",
                                  }}
                                >
                                  ✅ Seen
                                </button>
                              )}

                              {authorized && (
                                <button
                                  className="btn"
                                  onClick={() =>
                                    markNotSeen(
                                      p.id,
                                      rec.reason ||
                                        ""
                                    )
                                  }
                                  style={{
                                    background:
                                      rec.seen ===
                                      false
                                        ? "#e63757"
                                        : "#fdeef1",
                                    border:
                                      "1.5px solid #e63757",
                                    color:
                                      rec.seen ===
                                      false
                                        ? "#fff"
                                        : "#e63757",
                                    padding:
                                      "9px 22px",
                                    borderRadius: 10,
                                    fontWeight: 800,
                                    cursor:
                                      "pointer",
                                  }}
                                >
                                  ❌ Not Seen
                                </button>
                              )}

                              {/* ==========================
                                  FOUR ASSESSMENT BUTTONS
                              ========================== */}

                              {authorized &&
                                ASSESSMENT_SCALES.map(
                                  (scale) => (
                                    <button
                                      key={
                                        scale.id
                                      }
                                      className="btn"
                                      onClick={(
                                        e
                                      ) => {
                                        e.stopPropagation();

                                        openAssessment(
                                          p,
                                          scale.id
                                        );
                                      }}
                                      style={{
                                        background:
                                          "#ebedff",
                                        border:
                                          "1.5px solid #4e6ef2",
                                        color:
                                          "#4e6ef2",
                                        padding:
                                          "9px 14px",
                                        borderRadius: 10,
                                        fontWeight: 700,
                                        fontSize: 12,
                                        cursor:
                                          "pointer",
                                      }}
                                    >
                                      📋{" "}
                                      {
                                        scale.shortName
                                      }
                                    </button>
                                  )
                                )}

                              {authorized && (
                                <button
                                  className="btn"
                                  onClick={() =>
                                    openEditForm(
                                      p
                                    )
                                  }
                                  style={{
                                    background:
                                      "#fff",
                                    border:
                                      "1.5px solid #4e6ef2",
                                    color:
                                      "#4e6ef2",
                                    padding:
                                      "9px 18px",
                                    borderRadius: 10,
                                    fontWeight: 700,
                                    cursor:
                                      "pointer",
                                    marginLeft:
                                      "auto",
                                  }}
                                >
                                  ✏️ Edit
                                </button>
                              )}

                              {role ===
                                "admin" && (
                                <button
                                  className="btn"
                                  onClick={() =>
                                    removePatient(
                                      p.id
                                    )
                                  }
                                  style={{
                                    background:
                                      "#fff",
                                    border:
                                      `1.5px solid ${COLORS.border}`,
                                    color:
                                      COLORS.muted,
                                    padding:
                                      "9px 16px",
                                    borderRadius: 10,
                                    fontWeight: 700,
                                    cursor:
                                      "pointer",
                                  }}
                                >
                                  🗑 Remove
                                </button>
                              )}
                            </div>

                            {/* NOT SEEN */}

                            {authorized &&
                              rec.seen ===
                                false && (
                                <div
                                  style={{
                                    marginBottom: 12,
                                  }}
                                >
                                  <label
                                    style={{
                                      ...labelStyle,
                                      color:
                                        "#e63757",
                                    }}
                                  >
                                    Reason for Not Seen *
                                  </label>

                                  <div
                                    style={{
                                      display:
                                        "flex",
                                      flexWrap:
                                        "wrap",
                                      gap: 7,
                                      marginBottom: 8,
                                    }}
                                  >
                                    {NOT_SEEN_REASONS.map(
                                      (r) => (
                                        <button
                                          key={
                                            r
                                          }
                                          className="btn"
                                          onClick={() =>
                                            setRecord(
                                              p.id,
                                              {
                                                reason:
                                                  r,
                                              }
                                            )
                                          }
                                          style={{
                                            padding:
                                              "6px 13px",
                                            borderRadius: 8,
                                            border: `1.5px solid ${
                                              rec.reason ===
                                              r
                                                ? "#e63757"
                                                : "#e2e8f0"
                                            }`,
                                            background:
                                              rec.reason ===
                                              r
                                                ? "#fdeef1"
                                                : "#fff",
                                            color:
                                              rec.reason ===
                                              r
                                                ? "#e63757"
                                                : COLORS.muted,
                                            fontWeight:
                                              600,
                                            fontSize: 12,
                                            cursor:
                                              "pointer",
                                          }}
                                        >
                                          {r}
                                        </button>
                                      )
                                    )}
                                  </div>

                                  <input
                                    placeholder="Specify reason..."
                                    value={
                                      NOT_SEEN_REASONS.includes(
                                        rec.reason
                                      ) &&
                                      rec.reason !==
                                        "Other"
                                        ? ""
                                        : rec.reason
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      setRecord(
                                        p.id,
                                        {
                                          reason:
                                            e
                                              .target
                                              .value,
                                        }
                                      )
                                    }
                                    style={{
                                      width:
                                        "100%",
                                      padding:
                                        "9px 12px",
                                      borderRadius: 9,
                                      border:
                                        "1.5px solid #e63757",
                                      fontSize: 13,
                                    }}
                                  />
                                </div>
                              )}

                            {/* NOTES */}

                            <div>
                              <label
                                style={{
                                  ...labelStyle,
                                  marginBottom: 6,
                                }}
                              >
                                📝 Session Notes / Observations
                              </label>

                              {authorized ? (
                                <textarea
                                  placeholder="Treatment given, progress, goals, recommendations..."
                                  value={
                                    rec.notes ||
                                    ""
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    setRecord(
                                      p.id,
                                      {
                                        notes:
                                          e
                                            .target
                                            .value,
                                      }
                                    )
                                  }
                                  style={{
                                    width:
                                      "100%",
                                    minHeight: 80,
                                    padding:
                                      "10px 12px",
                                    borderRadius: 10,
                                    border: `1.5px solid ${COLORS.border}`,
                                    fontSize: 13,
                                    resize:
                                      "vertical",
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width:
                                      "100%",
                                    minHeight: 80,
                                    padding:
                                      "10px 12px",
                                    borderRadius: 10,
                                    border: `1.5px solid ${COLORS.border}`,
                                    background:
                                      "#f7fafc",
                                    whiteSpace:
                                      "pre-wrap",
                                  }}
                                >
                                  {rec.notes ||
                                    "Read-only view."}
                                </div>
                              )}
                            </div>

                            {/* =================================================
                                SAVED ASSESSMENTS
                            ================================================= */}

                            <div
                              style={{
                                marginTop: 20,
                                paddingTop: 16,
                                borderTop:
                                  `1px solid ${COLORS.border}`,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 900,
                                  color:
                                    COLORS.sidebar,
                                  marginBottom: 10,
                                }}
                              >
                                📊 Assessment History
                              </div>

                              {pAssessments.length ===
                              0 ? (
                                <div
                                  style={{
                                    padding: 14,
                                    background:
                                      "#f7fafc",
                                    borderRadius: 9,
                                    color:
                                      COLORS.muted,
                                    fontSize: 12,
                                  }}
                                >
                                  No assessments
                                  recorded
                                  yet.
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display:
                                      "flex",
                                    flexDirection:
                                      "column",
                                    gap: 8,
                                  }}
                                >
                                  {pAssessments.map(
                                    (
                                      a
                                    ) => (
                                      <div
                                        key={
                                          a.id
                                        }
                                        style={{
                                          background:
                                            "#fff",
                                          border:
                                            `1px solid ${COLORS.border}`,
                                          borderRadius: 10,
                                          padding:
                                            12,
                                          display:
                                            "flex",
                                          justifyContent:
                                            "space-between",
                                          gap: 12,
                                          flexWrap:
                                            "wrap",
                                        }}
                                      >
                                        <div>
                                          <div
                                            style={{
                                              fontWeight: 800,
                                              color:
                                                "#4e6ef2",
                                              fontSize: 13,
                                            }}
                                          >
                                            📋{" "}
                                            {
                                              a.assessment_type
                                            }
                                          </div>

                                          <div
                                            style={{
                                              fontSize: 11,
                                              color:
                                                COLORS.muted,
                                              marginTop: 4,
                                            }}
                                          >
                                            Date:{" "}
                                            {fmtDate(
                                              a.assessment_date
                                            )}
                                          </div>

                                          <div
                                            style={{
                                              fontSize: 11,
                                              color:
                                                COLORS.muted,
                                              marginTop: 3,
                                            }}
                                          >
                                            Entered by:{" "}
                                            <strong
                                              style={{
                                                color:
                                                  COLORS.text,
                                              }}
                                            >
                                              {a.entered_by_email ||
                                                a.entered_by ||
                                                "Unknown"}
                                            </strong>
                                          </div>
                                        </div>

                                        <div
                                          style={{
                                            background:
                                              "#e6faf7",
                                            color:
                                              "#087f6c",
                                            borderRadius: 9,
                                            padding:
                                              "8px 14px",
                                            fontWeight: 900,
                                            fontSize: 14,
                                          }}
                                        >
                                          Score:{" "}
                                          {
                                            a.total_score
                                          }
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </>
          )}

          {/* =================================================
              SESSION HISTORY
          ================================================= */}

          {view ===
            "history" && (
            <div>
              {allDates.length ===
              0 ? (
                <div
                  style={{
                    textAlign:
                      "center",
                    padding:
                      "60px 20px",
                    color:
                      COLORS.muted,
                  }}
                >
                  <div
                    style={{
                      fontSize: 40,
                    }}
                  >
                    📭
                  </div>

                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      marginTop: 10,
                    }}
                  >
                    No session records
                    yet
                  </div>
                </div>
              ) : (
                allDates.map(
                  (d) => {
                    const drec =
                      records[d] ||
                      {};

                    const s =
                      Object.values(
                        drec
                      ).filter(
                        (r) =>
                          r.seen ===
                          true
                      ).length;

                    const ns =
                      Object.values(
                        drec
                      ).filter(
                        (r) =>
                          r.seen ===
                          false
                      ).length;

                    const total =
                      Object.keys(
                        drec
                      ).length;

                    return (
                      <div
                        key={d}
                        style={{
                          background:
                            COLORS.card,
                          borderRadius: 14,
                          marginBottom: 12,
                          border:
                            `1px solid ${COLORS.border}`,
                          overflow:
                            "hidden",
                        }}
                      >
                        <div
                          className="ot-history-header"
                          style={{
                            padding:
                              "14px 18px",
                            borderBottom:
                              `1px solid ${COLORS.border}`,
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "center",
                            background:
                              "#f7fafc",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: 15,
                              }}
                            >
                              {fmtDate(
                                d
                              )}
                            </div>

                            <div
                              style={{
                                fontSize: 12,
                                color:
                                  COLORS.muted,
                                marginTop: 2,
                              }}
                            >
                              {
                                total
                              }{" "}
                              patients
                              recorded
                            </div>
                          </div>

                          <div
                            className="ot-history-badges"
                            style={{
                              display:
                                "flex",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                background:
                                  "#e6faf7",
                                color:
                                  "#00c9a7",
                                padding:
                                  "4px 12px",
                                borderRadius: 8,
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                            >
                              ✅ {s} Seen
                            </span>

                            <span
                              style={{
                                background:
                                  "#fdeef1",
                                color:
                                  "#e63757",
                                padding:
                                  "4px 12px",
                                borderRadius: 8,
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                            >
                              ❌ {ns} Not
                              Seen
                            </span>
                          </div>
                        </div>

                        <div
                          style={{
                            padding:
                              "12px 18px",
                            display:
                              "flex",
                            flexDirection:
                              "column",
                            gap: 8,
                          }}
                        >
                          {patients
                            .filter(
                              (p) =>
                                drec[
                                  p.id
                                ]
                            )
                            .map(
                              (p) => {
                                const r =
                                  drec[
                                    p.id
                                  ];

                                return (
                                  <div
                                    key={
                                      p.id
                                    }
                                    style={{
                                      display:
                                        "flex",
                                      alignItems:
                                        "center",
                                      gap: 10,
                                      flexWrap:
                                        "wrap",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontWeight: 600,
                                        fontSize: 13,
                                      }}
                                    >
                                      {p.name}
                                    </span>

                                    <span
                                      style={{
                                        fontSize: 11,
                                        color:
                                          COLORS.muted,
                                      }}
                                    >
                                      IP:{" "}
                                      {
                                        p.ipNo
                                      }
                                    </span>

                                    <span
                                      style={{
                                        fontSize: 11,
                                        color:
                                          COLORS.muted,
                                      }}
                                    >
                                      ·{" "}
                                      {
                                        p.diagnosis
                                      }
                                    </span>
{p.sessionTime && (
  <span
    style={{
      fontSize: 10,
      background: "#eef2ff",
      color: "#4e6ef2",
      padding: "3px 8px",
      borderRadius: 6,
      fontWeight: 700,
    }}
  >
    🕐 {p.sessionTime}
  </span>
)}

{p.location && (
  <span
    style={{
      fontSize: 10,
      background: "#e6faf7",
      color: "#008f78",
      padding: "3px 8px",
      borderRadius: 6,
      fontWeight: 700,
    }}
  >
    🏥 {p.location}
  </span>
)}

{p.strokeType && (
  <span
    style={{
      fontSize: 10,
      background: "#fff3e0",
      color: "#e65100",
      padding: "3px 8px",
      borderRadius: 6,
      fontWeight: 700,
    }}
  >
    🧠 {p.strokeType}
  </span>
)}
                                    <span
                                      style={{
                                        marginLeft:
                                          "auto",
                                        background:
                                          r.seen
                                            ? "#e6faf7"
                                            : "#fdeef1",
                                        color:
                                          r.seen
                                            ? "#00c9a7"
                                            : "#e63757",
                                        padding:
                                          "2px 10px",
                                        borderRadius: 7,
                                        fontWeight: 700,
                                        fontSize: 11,
                                      }}
                                    >
                                      {r.seen
                                        ? "✅ Seen"
                                        : `❌ ${
                                            r.reason ||
                                            "Not Seen"
                                          }`}
                                    </span>
                                  </div>
                                );
                              }
                            )}
                        </div>
                      </div>
                    );
                  }
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          ASSESSMENT MODAL
      ===================================================== */}

      {showAssessment &&
        assessmentPatient && (
          <div
            className="ot-assessment-overlay"
            style={{
              position: "fixed",
              inset: 0,
              background:
                "rgba(11,20,55,.55)",
              zIndex: 10000,
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              padding: 20,
            }}
          >
            <div
              className="ot-assessment-modal"
              style={{
                width: "100%",
                maxWidth: 760,
                maxHeight:
                  "92vh",
                overflowY:
                  "auto",
                background:
                  "#fff",
                borderRadius: 16,
                boxShadow:
                  "0 20px 60px rgba(0,0,0,.25)",
              }}
            >
              {/* MODAL HEADER */}

              <div
                className="ot-assessment-header"
                style={{
                  position:
                    "sticky",
                  top: 0,
                  zIndex: 2,
                  background:
                    "#fff",
                  padding:
                    "18px 20px",
                  borderBottom:
                    `1px solid ${COLORS.border}`,
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap: 10,
                }}
              >
                <div className="ot-assessment-header-content">
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 900,
                      color:
                        COLORS.sidebar,
                    }}
                  >
                    📋{" "}
                    {
                      ASSESSMENT_SCALES.find(
                        (s) =>
                          s.id ===
                          assessmentType
                      )?.name
                    }
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color:
                        COLORS.muted,
                      marginTop: 3,
                    }}
                  >
                    Patient:{" "}
                    <strong>
                      {
                        assessmentPatient.name
                      }
                    </strong>{" "}
                    • IP:{" "}
                    {
                      assessmentPatient.ipNo
                    }
                  </div>
                </div>

                <button
                  onClick={
                    closeAssessment
                  }
                  style={{
                    width: 34,
                    height: 34,
                    border: 0,
                    borderRadius:
                      8,
                    background:
                      "#f7fafc",
                    color:
                      COLORS.muted,
                    fontSize: 18,
                    cursor:
                      "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              {/* MODAL BODY */}

              <div
                className="ot-assessment-body"
                style={{
                  padding: 20,
                }}
              >
                <div
                  className="ot-assessment-meta"
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "1fr 1fr",
                    gap: 12,
                    marginBottom: 18,
                  }}
                >
                  <div>
                    <label
                      style={
                        labelStyle
                      }
                    >
                      Assessment Date
                    </label>

                    <input
                      type="date"
                      value={
                        assessmentDate
                      }
                      onChange={(
                        e
                      ) =>
                        setAssessmentDate(
                          e.target
                            .value
                        )
                      }
                      style={
                        inputStyle
                      }
                    />
                  </div>

                  <div>
                    <label
                      style={
                        labelStyle
                      }
                    >
                      Entered By
                    </label>

                    <div
                      className="ot-assessment-email"
                      style={{
                        ...inputStyle,
                        background:
                          "#f7fafc",
                        display:
                          "flex",
                        alignItems:
                          "center",
                      }}
                    >
                      {session.user.email}
                    </div>
                  </div>
                </div>

                <AssessmentForm
                  type={
                    assessmentType
                  }
                  data={
                    assessmentData
                  }
                  setData={
                    setAssessmentData
                  }
                />

                <div
                  style={{
                    marginTop: 16,
                  }}
                >
                  <label
                    style={
                      labelStyle
                    }
                  >
                    Notes
                  </label>

                  <textarea
                    value={
                      assessmentData.notes ||
                      ""
                    }
                    onChange={(e) =>
                      setAssessmentData(
                        (x) => ({
                          ...x,
                          notes:
                            e.target
                              .value,
                        })
                      )
                    }
                    placeholder="Additional assessment notes..."
                    style={{
                      ...inputStyle,
                      minHeight: 80,
                      resize:
                        "vertical",
                    }}
                  />
                </div>

                {/* SAVE */}

                <div
                  className="ot-assessment-footer"
                  style={{
                    display:
                      "flex",
                    gap: 10,
                    marginTop: 18,
                  }}
                >
                  <button
                    onClick={
                      saveAssessment
                    }
                    disabled={
                      saving
                    }
                    style={{
                      flex: 1,
                      border: 0,
                      background:
                        "#4e6ef2",
                      color:
                        "#fff",
                      padding: 12,
                      borderRadius: 10,
                      fontWeight: 800,
                      cursor:
                        saving
                          ? "wait"
                          : "pointer",
                    }}
                  >
                    {saving
                      ? "Saving…"
                      : "✓ Save Assessment"}
                  </button>

                  <button
                    onClick={
                      closeAssessment
                    }
                    style={{
                      padding:
                        "12px 22px",
                      borderRadius: 10,
                      border: `1.5px solid ${COLORS.border}`,
                      background:
                        "#f7fafc",
                      color:
                        COLORS.muted,
                      fontWeight: 700,
                      cursor:
                        "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
