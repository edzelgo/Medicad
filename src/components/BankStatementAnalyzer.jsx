import { useState, useCallback, useRef, useEffect } from "react";

// ─── jsPDF loader (CDN, no install needed) ───────────────────────────────────
function loadJsPDF() {
  return new Promise((resolve) => {
    if (window.jspdf) return resolve(window.jspdf.jsPDF);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve(window.jspdf.jsPDF);
    document.head.appendChild(script);
  });
}

const MEDICAID_RULES = {
  individual: { monthlyIncomeLimit: 1677, assetLimit: 2000 },
  couple: { monthlyIncomeLimit: 2268, assetLimit: 3000 },
};
const MAX_FILES = 60;
const STORAGE_KEY = "mediflow_cases";

function genCaseId() {
  const now = new Date();
  return `MF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
function fmt(n) { return n != null ? `$${Number(n).toLocaleString()}` : "—"; }

async function exportToPDF(caseData) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: "pt", format: "letter" });
  const W = 612, margin = 48;
  let y = margin;
  const colors = {
    navy: [10, 30, 70], blue: [27, 86, 160], lightBlue: [59, 125, 216],
    green: [34, 197, 94], red: [239, 68, 68], gray: [100, 116, 139],
    lightGray: [226, 232, 240], white: [255, 255, 255], amber: [245, 158, 11],
  };
  doc.setFillColor(...colors.navy);
  doc.rect(0, 0, W, 72, "F");
  doc.setTextColor(...colors.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("MediFlow Pro", margin, 32);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.lightBlue);
  doc.text("Medicaid Eligibility Report", margin, 48);
  doc.setTextColor(...colors.gray);
  doc.text(`Case ID: ${caseData.caseId}  ·  Generated: ${new Date().toLocaleString()}`, margin, 64);
  y = 100;

  doc.setFillColor(240, 245, 255);
  doc.roundedRect(margin, y, W - margin * 2, 80, 6, 6, "F");
  doc.setTextColor(...colors.navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("PATIENT INFORMATION", margin + 16, y + 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...colors.gray);
  const patientFields = [
    ["Patient Name", caseData.patientName || "—"],
    ["Date of Birth", caseData.dob || "—"],
    ["Case Worker", caseData.caseWorker || "—"],
    ["Household Type", caseData.householdType || "Individual"],
    ["State", caseData.state || "—"],
    ["Statements Analyzed", String(caseData.statementsAnalyzed || 0)],
  ];
  patientFields.forEach(([label, val], i) => {
    const col = i < 3 ? 0 : 1;
    const row = i % 3;
    const x = margin + 16 + col * 240;
    const ly = y + 36 + row * 16;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.navy);
    doc.text(label + ":", x, ly);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.gray);
    doc.text(val, x + 100, ly);
  });
  y += 100;

  const qualified = caseData.qualified;
  doc.setFillColor(...(qualified ? colors.green : colors.red));
  doc.roundedRect(margin, y, W - margin * 2, 54, 8, 8, "F");
  doc.setTextColor(...colors.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(qualified ? "✓  QUALIFIED FOR MEDICAID" : "✗  DOES NOT QUALIFY", margin + 20, y + 22);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Confidence: ${caseData.confidence ?? 0}%  ·  ${caseData.monthsCovered ?? "—"} months of bank data reviewed`, margin + 20, y + 40);
  y += 74;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, W - margin * 2, 76, 6, 6, "F");
  doc.setTextColor(...colors.navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("FINANCIAL SUMMARY", margin + 16, y + 18);
  const metrics = [
    ["Avg Monthly Income", fmt(caseData.avgMonthlyIncome), caseData.incomeFlag],
    ["Income Limit", fmt(MEDICAID_RULES[caseData.householdType]?.monthlyIncomeLimit), false],
    ["Avg Assets", fmt(caseData.avgAssets), caseData.assetFlag],
    ["Asset Limit", fmt(MEDICAID_RULES[caseData.householdType]?.assetLimit), false],
  ];
  metrics.forEach(([label, val, flag], i) => {
    const x = margin + 16 + i * 128;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...colors.gray);
    doc.text(label, x, y + 36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...(flag ? colors.red : colors.navy));
    doc.text(val, x, y + 56);
  });
  y += 96;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...colors.navy);
  doc.text("AI ANALYSIS SUMMARY", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...colors.gray);
  const summaryLines = doc.splitTextToSize(caseData.summary || "No summary available.", W - margin * 2);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 14 + 16;

  if (caseData.flags?.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...colors.amber);
    doc.text("⚠ FLAGS & NOTES", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    caseData.flags.forEach((flag) => {
      doc.setTextColor(...colors.amber);
      doc.text("•", margin, y);
      doc.setTextColor(...colors.gray);
      const lines = doc.splitTextToSize(flag, W - margin * 2 - 16);
      doc.text(lines, margin + 12, y);
      y += lines.length * 14 + 4;
    });
    y += 8;
  }

  doc.setFillColor(235, 244, 255);
  const recLines = doc.splitTextToSize(caseData.recommendation || "No recommendation.", W - margin * 2 - 32);
  const recH = recLines.length * 14 + 28;
  doc.roundedRect(margin, y, W - margin * 2, recH, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...colors.blue);
  doc.text("RECOMMENDATION", margin + 16, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.navy);
  doc.text(recLines, margin + 16, y + 30);
  y += recH + 20;

  doc.setFillColor(...colors.navy);
  doc.rect(0, 720, W, 72, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...colors.lightBlue);
  doc.text("MediFlow Pro · Powered by Claude AI · For authorized case worker use only", margin, 742);
  doc.setTextColor(...colors.gray);
  doc.text("This report is for informational purposes only and does not constitute a legal Medicaid determination.", margin, 756);
  doc.text(`Case ID: ${caseData.caseId}  ·  ${new Date().toLocaleString()}`, margin, 770);

  doc.save(`MediFlow-${caseData.caseId}.pdf`);
}

function Field({ label, value, onChange, placeholder, type = "text", disabled }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ color: "#a0b4d0", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          background: "rgba(10,20,45,0.9)", border: "1px solid #2a4a7f", borderRadius: 8,
          padding: "10px 12px", color: "#e2e8f0", fontSize: 14, outline: "none",
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </div>
  );
}

function UploadZone({ onFiles, disabled }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    onFiles(Array.from(e.dataTransfer.files).filter((f) => f.type === "application/pdf" || f.type.startsWith("image/")));
  }, [onFiles, disabled]);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? "#3b7dd8" : "#2a4a7f"}`,
        borderRadius: 12, padding: "36px 24px", textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        background: dragging ? "rgba(59,125,216,0.08)" : "rgba(15,30,60,0.6)",
        transition: "all 0.2s", opacity: disabled ? 0.5 : 1,
      }}
    >
      <input ref={inputRef} type="file" multiple accept=".pdf,image/*"
        style={{ display: "none" }} onChange={(e) => onFiles(Array.from(e.target.files))} disabled={disabled} />
      <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
      <p style={{ color: "#a0b4d0", margin: 0, fontSize: 14 }}>
        Drag & drop bank statements, or <span style={{ color: "#3b7dd8", fontWeight: 600 }}>browse files</span>
      </p>
      <p style={{ color: "#4a6080", margin: "6px 0 0", fontSize: 12 }}>PDF or images · Up to {MAX_FILES} statements</p>
    </div>
  );
}

function FileList({ files, onRemove }) {
  if (!files.length) return null;
  return (
    <div style={{ marginTop: 12, maxHeight: 180, overflowY: "auto" }}>
      {files.map((f, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "7px 12px", marginBottom: 5, background: "rgba(20,40,80,0.7)", borderRadius: 8, fontSize: 12, color: "#a0b4d0" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span>📋</span>
            <span style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
            <span style={{ color: "#4a6080" }}>({(f.size / 1024).toFixed(0)}KB)</span>
          </span>
          <button onClick={() => onRemove(i)} style={{ background: "none", border: "none", color: "#e05555", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ current, total, label }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12, color: "#a0b4d0" }}>
        <span>{label}</span><span>{pct}%</span>
      </div>
      <div style={{ background: "rgba(20,40,80,0.8)", borderRadius: 99, height: 7, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#1a56a0,#3b7dd8)", borderRadius: 99, transition: "width 0.4s ease" }} />
      </div>
      <p style={{ color: "#4a6080", fontSize: 11, marginTop: 5 }}>Processing {current} of {total} statements…</p>
    </div>
  );
}

function VerdictCard({ result, patientName, caseId, onExport, exporting }) {
  const qualified = result.qualified;
  const color = qualified ? "#22c55e" : "#ef4444";
  const bg = qualified ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)";
  return (
    <div style={{ border: `1.5px solid ${color}`, borderRadius: 14, padding: 24, background: bg, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>{qualified ? "✅" : "❌"}</span>
          <div>
            <h2 style={{ margin: 0, color, fontSize: 20, fontWeight: 800 }}>
              {qualified ? "QUALIFIED FOR MEDICAID" : "DOES NOT QUALIFY"}
            </h2>
            <p style={{ margin: "3px 0 0", color: "#a0b4d0", fontSize: 12 }}>
              {patientName && <strong style={{ color: "#e2e8f0" }}>{patientName} · </strong>}
              Case {caseId} · {result.statementsAnalyzed} statements · {result.monthsCovered} months
            </p>
          </div>
        </div>
        <button
          onClick={onExport}
          disabled={exporting}
          style={{
            padding: "10px 18px", background: "rgba(27,86,160,0.85)", border: "1px solid #3b7dd8",
            borderRadius: 8, color: "#e2e8f0", fontSize: 13, fontWeight: 600, cursor: exporting ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
          }}
        >
          {exporting ? "⏳ Generating…" : "📥 Export PDF Report"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Avg Monthly Income", value: fmt(result.avgMonthlyIncome), flag: result.incomeFlag },
          { label: "Avg Monthly Assets", value: fmt(result.avgAssets), flag: result.assetFlag },
          { label: "Household Type", value: result.householdType ?? "Individual", flag: false },
          { label: "Confidence", value: `${result.confidence ?? 0}%`, flag: false },
        ].map((m, i) => (
          <div key={i} style={{ background: "rgba(10,20,45,0.7)", borderRadius: 9, padding: "12px 14px", borderLeft: `3px solid ${m.flag ? "#ef4444" : "#2a4a7f"}` }}>
            <p style={{ margin: 0, color: "#4a6080", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{m.label}</p>
            <p style={{ margin: "5px 0 0", color: m.flag ? "#ef4444" : "#e2e8f0", fontSize: 17, fontWeight: 700 }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: "rgba(10,20,45,0.5)", borderRadius: 9, padding: 16, marginBottom: 14 }}>
        <p style={{ margin: "0 0 6px", color: "#a0b4d0", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>AI Analysis</p>
        <p style={{ margin: 0, color: "#e2e8f0", fontSize: 13, lineHeight: 1.7 }}>{result.summary}</p>
      </div>

      {result.flags?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: "0 0 8px", color: "#f59e0b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>⚠️ Flags</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {result.flags.map((f, i) => <li key={i} style={{ color: "#f59e0b", fontSize: 13, marginBottom: 4 }}>{f}</li>)}
          </ul>
        </div>
      )}

      <div style={{ padding: 14, background: "rgba(59,125,216,0.1)", borderRadius: 9, borderLeft: "3px solid #3b7dd8" }}>
        <p style={{ margin: "0 0 4px", color: "#3b7dd8", fontSize: 12, fontWeight: 600 }}>📋 Recommendation</p>
        <p style={{ margin: 0, color: "#a0b4d0", fontSize: 13, lineHeight: 1.6 }}>{result.recommendation}</p>
      </div>
    </div>
  );
}

function CaseTracker({ cases, onSelect, onClear, selectedId }) {
  if (!cases.length) return (
    <div style={{ textAlign: "center", padding: "32px 16px", color: "#4a6080" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
      <p style={{ margin: 0, fontSize: 13 }}>No cases yet.<br />Run your first analysis to begin tracking.</p>
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ color: "#a0b4d0", fontSize: 12, fontWeight: 600 }}>{cases.length} case{cases.length !== 1 ? "s" : ""} on record</span>
        <button onClick={onClear} style={{ background: "none", border: "1px solid #2a4a7f", borderRadius: 6, color: "#4a6080", fontSize: 11, cursor: "pointer", padding: "3px 10px" }}>
          Clear All
        </button>
      </div>
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {[...cases].reverse().map((c) => (
          <div
            key={c.caseId}
            onClick={() => onSelect(c)}
            style={{
              padding: "12px 14px", marginBottom: 8, borderRadius: 10, cursor: "pointer",
              background: selectedId === c.caseId ? "rgba(59,125,216,0.15)" : "rgba(15,30,60,0.7)",
              border: `1px solid ${selectedId === c.caseId ? "#3b7dd8" : "rgba(42,74,127,0.3)"}`,
              transition: "all 0.15s",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{c.patientName || "Unnamed Patient"}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                background: c.qualified ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                color: c.qualified ? "#22c55e" : "#ef4444",
              }}>
                {c.qualified ? "QUALIFIED" : "NOT QUALIFIED"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
              <span style={{ color: "#4a6080", fontSize: 11 }}>{c.caseId}</span>
              <span style={{ color: "#4a6080", fontSize: 11 }}>{new Date(c.analysisDate).toLocaleDateString()}</span>
              <span style={{ color: "#4a6080", fontSize: 11 }}>{c.statementsAnalyzed} stmts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BankStatementAnalyzer() {
  const [patientName, setPatientName] = useState("");
  const [dob, setDob] = useState("");
  const [caseWorker, setCaseWorker] = useState("");
  const [householdType, setHouseholdType] = useState("individual");
  const [state, setState] = useState("florida");

  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [currentCaseId, setCurrentCaseId] = useState(null);

  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [view, setView] = useState("analyzer");

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      setCases(stored);
    } catch { setCases([]); }
  }, []);

  const saveCases = (updated) => {
    setCases(updated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
  };

  const addFiles = useCallback((newFiles) => {
    setFiles((prev) => {
      const merged = [...prev, ...newFiles];
      if (merged.length > MAX_FILES) {
        alert(`Max ${MAX_FILES} statements. Only first ${MAX_FILES} will be used.`);
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
  }, []);

  const reset = () => {
    setFiles([]); setResult(null); setError(""); setStatus("idle");
    setProgress({ current: 0, total: 0, label: "" }); setCurrentCaseId(null);
    setPatientName(""); setDob(""); setCaseWorker("");
  };

  async function extractFromStatements(fileObjects) {
    const batches = chunkArray(fileObjects, 5);
    const extracted = [];
    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
      const batch = batches[bIdx];
      setProgress({ current: bIdx * 5 + batch.length, total: fileObjects.length, label: `Extracting batch ${bIdx + 1} of ${batches.length}…` });
      const contentBlocks = [];
      for (const file of batch) {
        const b64 = await fileToBase64(file);
        const isPdf = file.type === "application/pdf";
        contentBlocks.push({ type: isPdf ? "document" : "image", source: { type: "base64", media_type: isPdf ? "application/pdf" : file.type, data: b64 } });
      }
      contentBlocks.push({
        type: "text",
        text: `You are a Medicaid financial analyst. Extract data from ${batch.length} bank statement(s). Return a JSON array (no markdown): [{"statementMonth":"Jan 2024","holderName":"...","totalDeposits":0,"totalWithdrawals":0,"beginBalance":0,"endBalance":0,"recurringIncome":0,"irregularDeposits":0,"notes":"..."}]`,
      });
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: contentBlocks }] }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      const text = data.content?.find((b) => b.type === "text")?.text ?? "[]";
      try { const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); extracted.push(...(Array.isArray(parsed) ? parsed : [parsed])); }
      catch { extracted.push({ parseError: true }); }
    }
    return extracted;
  }

  async function synthesizeVerdict(extractedData) {
    const rules = MEDICAID_RULES[householdType];
    setProgress({ current: files.length, total: files.length, label: "Synthesizing eligibility verdict…" });
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Medicaid eligibility specialist. Review financial data from ${files.length} bank statements. HOUSEHOLD: ${householdType} | STATE: ${state.toUpperCase()} | INCOME LIMIT: $${rules.monthlyIncomeLimit}/mo | ASSET LIMIT: $${rules.assetLimit}. DATA: ${JSON.stringify(extractedData.filter(r => !r.parseError), null, 2)}. Return ONLY JSON (no markdown): {"qualified":true,"statementsAnalyzed":0,"monthsCovered":0,"avgMonthlyIncome":0,"avgAssets":0,"householdType":"${householdType}","confidence":0,"incomeFlag":false,"assetFlag":false,"summary":"...","recommendation":"...","flags":[]}`,
        }],
      }),
    });
    if (!resp.ok) throw new Error(`Synthesis API ${resp.status}`);
    const data = await resp.json();
    const text = data.content?.find((b) => b.type === "text")?.text ?? "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  }

  const runAnalysis = async () => {
    if (!files.length) return;
    setStatus("processing"); setError(""); setResult(null);
    const caseId = genCaseId();
    setCurrentCaseId(caseId);
    try {
      const extracted = await extractFromStatements(files);
      const verdict = await synthesizeVerdict(extracted);
      const caseRecord = {
        caseId, patientName, dob, caseWorker, householdType, state,
        analysisDate: new Date().toISOString(), statementsAnalyzed: files.length,
        ...verdict,
      };
      saveCases([...cases, caseRecord]);
      setResult(verdict);
      setStatus("done");
    } catch (err) {
      setError(err.message || "Analysis failed."); setStatus("error");
    }
  };

  const handleExport = async () => {
    if (!result) return;
    setExporting(true);
    try {
      await exportToPDF({ caseId: currentCaseId, patientName, dob, caseWorker, householdType, state, statementsAnalyzed: files.length, ...result });
    } catch (e) { alert("PDF export failed: " + e.message); }
    setExporting(false);
  };

  const handleExportFromTracker = async (c) => {
    setExporting(true);
    try { await exportToPDF(c); } catch (e) { alert("PDF export failed: " + e.message); }
    setExporting(false);
  };

  const S = {
    page: { minHeight: "100vh", background: "linear-gradient(135deg,#060d1f 0%,#0a1628 50%,#0d1f3c 100%)", fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", padding: "28px 16px", color: "#e2e8f0" },
    card: { background: "rgba(15,30,60,0.8)", borderRadius: 14, padding: 22, border: "1px solid rgba(59,125,216,0.15)", marginBottom: 18 },
    label: { color: "#a0b4d0", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 },
    select: { width: "100%", background: "rgba(10,20,45,0.9)", border: "1px solid #2a4a7f", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 14 },
    tabBtn: (active) => ({ padding: "10px 20px", background: active ? "rgba(59,125,216,0.2)" : "transparent", border: active ? "1px solid #3b7dd8" : "1px solid #2a4a7f", borderRadius: 9, color: active ? "#3b7dd8" : "#4a6080", fontSize: 13, fontWeight: active ? 700 : 400, cursor: "pointer" }),
    primaryBtn: (disabled) => ({ flex: 1, padding: "13px 20px", background: disabled ? "rgba(59,125,216,0.3)" : "linear-gradient(135deg,#1a56a0,#3b7dd8)", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer" }),
    ghostBtn: { padding: "13px 18px", background: "rgba(20,40,80,0.7)", border: "1px solid #2a4a7f", borderRadius: 10, color: "#a0b4d0", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  };

  return (
    <div style={S.page}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: "linear-gradient(135deg,#1a56a0,#3b7dd8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏥</div>
            <span style={{ fontSize: 12, color: "#4a6080", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>MediFlow Pro</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(20px,4vw,30px)", fontWeight: 800, background: "linear-gradient(90deg,#e2e8f0,#3b7dd8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: -0.5 }}>
            Bank Statement Eligibility Analyzer
          </h1>
          <p style={{ color: "#4a6080", marginTop: 6, fontSize: 13 }}>AI-powered Medicaid financial qualification · Up to {MAX_FILES} statements</p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button style={S.tabBtn(view === "analyzer")} onClick={() => setView("analyzer")}>🔍 Analyzer</button>
          <button style={S.tabBtn(view === "tracker")} onClick={() => setView("tracker")}>
            📁 Case Tracker {cases.length > 0 && <span style={{ marginLeft: 6, background: "#3b7dd8", color: "#fff", borderRadius: 99, fontSize: 10, padding: "1px 7px", fontWeight: 700 }}>{cases.length}</span>}
          </button>
        </div>

        {view === "analyzer" && (
          <>
            <div style={S.card}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#a0b4d0", textTransform: "uppercase", letterSpacing: 1 }}>Patient Information</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
                <Field label="Patient Full Name" value={patientName} onChange={setPatientName} placeholder="Jane Doe" disabled={status === "processing"} />
                <Field label="Date of Birth" value={dob} onChange={setDob} type="date" disabled={status === "processing"} />
                <Field label="Case Worker Name" value={caseWorker} onChange={setCaseWorker} placeholder="Your name" disabled={status === "processing"} />
              </div>
            </div>

            <div style={{ ...S.card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={S.label}>Household Type</label>
                <select value={householdType} onChange={(e) => setHouseholdType(e.target.value)} disabled={status === "processing"} style={{ ...S.select, marginTop: 6 }}>
                  <option value="individual">Individual ($1,677/mo limit)</option>
                  <option value="couple">Couple ($2,268/mo limit)</option>
                </select>
              </div>
              <div>
                <label style={S.label}>State</label>
                <select value={state} onChange={(e) => setState(e.target.value)} disabled={status === "processing"} style={{ ...S.select, marginTop: 6 }}>
                  {["florida","texas","california","new york","illinois","georgia","ohio","pennsylvania","michigan","north carolina","arizona","tennessee","washington","colorado","nevada"].map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 14, fontWeight: 700 }}>Bank Statements</h3>
                {files.length > 0 && (
                  <span style={{ background: "rgba(59,125,216,0.2)", color: "#3b7dd8", borderRadius: 99, padding: "3px 12px", fontSize: 12, fontWeight: 600 }}>
                    {files.length} / {MAX_FILES} loaded
                  </span>
                )}
              </div>
              <UploadZone onFiles={addFiles} disabled={status === "processing"} />
              <FileList files={files} onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))} />
              {status === "processing" && <ProgressBar current={progress.current} total={progress.total} label={progress.label} />}
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <button onClick={runAnalysis} disabled={!files.length || status === "processing"} style={S.primaryBtn(!files.length || status === "processing")}>
                {status === "processing" ? "⏳ Analyzing…" : `🔍 Analyze ${files.length || ""} Statement${files.length !== 1 ? "s" : ""}`}
              </button>
              {(result || files.length > 0 || status === "error") && (
                <button onClick={reset} style={S.ghostBtn}>Reset</button>
              )}
            </div>

            {status === "error" && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: 18, marginBottom: 18, color: "#ef4444", fontSize: 13 }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {result && (
              <VerdictCard result={result} patientName={patientName} caseId={currentCaseId} onExport={handleExport} exporting={exporting} />
            )}
          </>
        )}

        {view === "tracker" && (
          <div style={S.card}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>Case History</h3>
            <CaseTracker
              cases={cases}
              selectedId={selectedCase?.caseId}
              onSelect={setSelectedCase}
              onClear={() => { if (window.confirm("Clear all cases?")) { saveCases([]); setSelectedCase(null); } }}
            />
            {selectedCase && (
              <div style={{ marginTop: 20, borderTop: "1px solid rgba(42,74,127,0.4)", paddingTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h4 style={{ margin: 0, color: "#e2e8f0", fontSize: 15 }}>{selectedCase.patientName || "Unnamed"} — {selectedCase.caseId}</h4>
                  <button
                    onClick={() => handleExportFromTracker(selectedCase)}
                    disabled={exporting}
                    style={{ padding: "8px 16px", background: "rgba(27,86,160,0.8)", border: "1px solid #3b7dd8", borderRadius: 8, color: "#e2e8f0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {exporting ? "⏳" : "📥 Export PDF"}
                  </button>
                </div>
                <VerdictCard result={selectedCase} patientName={selectedCase.patientName} caseId={selectedCase.caseId} onExport={() => handleExportFromTracker(selectedCase)} exporting={exporting} />
              </div>
            )}
          </div>
        )}

        <p style={{ textAlign: "center", color: "#2a4a7f", fontSize: 11, marginTop: 28 }}>
          MediFlow Pro · Powered by Claude AI · Case worker use only — not a legal Medicaid determination
        </p>
      </div>
    </div>
  );
}
