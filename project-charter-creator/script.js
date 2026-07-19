(function () {
  "use strict";

  const STORAGE_KEY = "charterDraft.v1";

  /* ---------- config for dynamic (single-input) lists ---------- */
  const LIST_CONFIG = {
    objectives: "e.g., Launch MVP to first 500 users",
    successCriteria: "e.g., 90% uptime in first quarter",
    inScope: "e.g., Web application redesign",
    outScope: "e.g., Native mobile app",
    assumptions: "e.g., Design assets delivered by Aug 1",
    constraints: "e.g., Must launch before fiscal year end"
  };

  /* ---------- config for tables ---------- */
  const TABLE_CONFIG = {
    stakeholdersTable: {
      row: () => `
        <td><input type="text" class="sh-name" placeholder="Name"></td>
        <td><input type="text" class="sh-role" placeholder="Role"></td>
        <td><input type="text" class="sh-resp" placeholder="Responsibility"></td>
        <td><select class="influence-select"><option>High</option><option>Medium</option><option>Low</option></select></td>
        <td class="col-remove"><button type="button" class="row-remove" aria-label="Remove row">&times;</button></td>`
    },
    deliverablesTable: {
      row: () => `
        <td><input type="text" class="del" placeholder="Deliverable"></td>
        <td><input type="text" class="owner" placeholder="Owner"></td>
        <td><input type="date" class="mile"></td>
        <td class="col-remove"><button type="button" class="row-remove" aria-label="Remove row">&times;</button></td>`
    },
    risksTable: {
      row: () => `
        <td><input type="text" class="risk" placeholder="Risk"></td>
        <td><select class="likelihood-select"><option>Low</option><option>Medium</option><option>High</option></select></td>
        <td><select class="impact-select"><option>Low</option><option>Medium</option><option>High</option></select></td>
        <td><input type="text" class="mit" placeholder="Mitigation strategy"></td>
        <td><input type="text" class="risk-owner" placeholder="Owner"></td>
        <td class="col-remove"><button type="button" class="row-remove" aria-label="Remove row">&times;</button></td>`
    }
  };

  const SECTION_IDS = ["sec-info", "sec-purpose", "sec-scope", "sec-stakeholders", "sec-deliverables", "sec-risks", "sec-approval"];

  let toastTimer = null;

  /* ================= Theme ================= */
  function initTheme() {
    const saved = localStorage.getItem("charterTheme");
    const isLight = saved ? saved === "light" : false;
    document.body.classList.toggle("light-mode", isLight);
    document.getElementById("themeToggle").setAttribute("aria-pressed", String(isLight));
  }

  document.getElementById("themeToggle").addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-mode");
    document.getElementById("themeToggle").setAttribute("aria-pressed", String(isLight));
    localStorage.setItem("charterTheme", isLight ? "light" : "dark");
  });

  /* ================= Dynamic single-input lists ================= */
  function addListLine(listId, value) {
    const container = document.getElementById(listId);
    const row = document.createElement("div");
    row.className = "dyn-row";
    row.innerHTML = `
      <input type="text" class="dyn-input" placeholder="${LIST_CONFIG[listId]}">
      <button type="button" class="line-remove" aria-label="Remove item">&times;</button>`;
    if (value) row.querySelector(".dyn-input").value = value;
    row.querySelector(".line-remove").addEventListener("click", () => {
      row.remove();
      updateProgress();
      scheduleSave();
    });
    row.querySelector(".dyn-input").addEventListener("input", () => {
      updateProgress();
      scheduleSave();
    });
    container.appendChild(row);
  }

  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      addListLine(btn.dataset.add);
      updateProgress();
      scheduleSave();
    });
  });

  /* ================= Tables ================= */
  function addTableRow(tableId, values) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector("tbody");
    const tr = document.createElement("tr");
    tr.innerHTML = TABLE_CONFIG[tableId].row();
    tbody.appendChild(tr);
    if (values) {
      tr.querySelectorAll("input, select").forEach((el, i) => {
        if (values[i] !== undefined) el.value = values[i];
      });
    }
    tr.querySelector(".row-remove").addEventListener("click", () => {
      tr.remove();
      updateProgress();
      scheduleSave();
    });
    tr.querySelectorAll("input, select").forEach((el) => {
      el.addEventListener("input", () => { updateProgress(); scheduleSave(); });
      el.addEventListener("change", () => { updateProgress(); scheduleSave(); });
    });
  }

  document.querySelectorAll(".add-row").forEach((btn) => {
    btn.addEventListener("click", () => {
      addTableRow(btn.dataset.table);
      updateProgress();
      scheduleSave();
    });
  });

  /* ================= Progress seal ================= */
  const CIRCUMFERENCE = 2 * Math.PI * 42;

  function sectionCompletion(id) {
    const section = document.getElementById(id);
    const fields = section.querySelectorAll("input, select, textarea");
    if (!fields.length) return 0;
    let filled = 0;
    fields.forEach((f) => { if (f.value && f.value.trim() !== "") filled++; });
    return filled / fields.length;
  }

  function updateProgress() {
    let total = 0;
    SECTION_IDS.forEach((id) => {
      const ratio = sectionCompletion(id);
      total += ratio;
      const navItem = document.querySelector(`.nav-item[data-target="${id}"]`);
      if (navItem) navItem.classList.toggle("complete", ratio >= 0.999);
    });
    const pct = Math.round((total / SECTION_IDS.length) * 100);
    const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
    document.getElementById("sealProgress").style.strokeDashoffset = offset;
    document.getElementById("sealPct").textContent = pct + "%";
  }

  document.getElementById("charterForm").addEventListener("input", () => {
    updateProgress();
    scheduleSave();
  });

  /* ================= Section nav active state ================= */
  function initNavObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const link = document.querySelector(`.nav-item[data-target="${entry.target.id}"]`);
          if (!link) return;
          if (entry.isIntersecting) {
            document.querySelectorAll(".nav-item").forEach((l) => l.classList.remove("active"));
            link.classList.add("active");
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    SECTION_IDS.forEach((id) => observer.observe(document.getElementById(id)));
  }

  /* ================= Autosave ================= */
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    const indicator = document.getElementById("autosaveIndicator");
    indicator.textContent = "Saving…";
    saveTimer = setTimeout(() => {
      saveDraft();
      indicator.textContent = "Draft saved";
    }, 500);
  }

  function collectState() {
    const state = { fields: {}, lists: {}, tables: {} };

    document.querySelectorAll("#charterForm input[id], #charterForm select[id], #charterForm textarea[id]").forEach((el) => {
      state.fields[el.id] = el.value;
    });

    Object.keys(LIST_CONFIG).forEach((listId) => {
      state.lists[listId] = Array.from(document.querySelectorAll(`#${listId} .dyn-input`)).map((i) => i.value);
    });

    Object.keys(TABLE_CONFIG).forEach((tableId) => {
      const rows = [];
      document.querySelectorAll(`#${tableId} tbody tr`).forEach((tr) => {
        rows.push(Array.from(tr.querySelectorAll("input, select")).map((el) => el.value));
      });
      state.tables[tableId] = rows;
    });

    return state;
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
    } catch (e) { /* storage unavailable, ignore */ }
  }

  function loadDraft() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) { return false; }
    if (!raw) return false;
    let state;
    try {
      state = JSON.parse(raw);
    } catch (e) { return false; }

    Object.entries(state.fields || {}).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });

    Object.entries(state.lists || {}).forEach(([listId, values]) => {
      document.getElementById(listId).innerHTML = "";
      if (values.length === 0) addListLine(listId);
      values.forEach((v) => addListLine(listId, v));
    });

    Object.entries(state.tables || {}).forEach(([tableId, rows]) => {
      document.querySelector(`#${tableId} tbody`).innerHTML = "";
      if (rows.length === 0) addTableRow(tableId);
      rows.forEach((r) => addTableRow(tableId, r));
    });

    return true;
  }

  function seedDefaults() {
    Object.keys(LIST_CONFIG).forEach((listId) => addListLine(listId));
    Object.keys(TABLE_CONFIG).forEach((tableId) => addTableRow(tableId));
  }

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (!confirm("Clear the entire draft? This can't be undone.")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    document.getElementById("charterForm").reset();
    Object.keys(LIST_CONFIG).forEach((id) => (document.getElementById(id).innerHTML = ""));
    Object.keys(TABLE_CONFIG).forEach((id) => (document.querySelector(`#${id} tbody`).innerHTML = ""));
    seedDefaults();
    updateProgress();
    showToast("Draft cleared");
  });

  /* ================= Toast ================= */
  function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  /* ================= PDF generation ================= */
  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function listValues(listId) {
    return Array.from(document.querySelectorAll(`#${listId} .dyn-input`))
      .map((i) => i.value.trim())
      .filter(Boolean);
  }

  function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 48;
    let y = 0;

    const ACCENT = [162, 128, 55];
    const INK = [30, 38, 51];
    const MUTED = [110, 122, 140];

    function footer() {
      const pageCount = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, 800, pageW - margin, 800);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text((val("pName") || "Project Charter"), margin, 812);
        doc.text(`Page ${p} of ${pageCount}`, pageW - margin, 812, { align: "right" });
      }
    }

    function ensureSpace(h) {
      if (y + h > 780) {
        doc.addPage();
        y = 60;
      }
    }

    function sectionTitle(num, title) {
      ensureSpace(40);
      doc.setDrawColor(...ACCENT);
      doc.setLineWidth(1);
      doc.line(margin, y, pageW - margin, y);
      y += 20;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...INK);
      doc.text(`${num}   ${title}`, margin, y);
      y += 16;
    }

    function fieldRow(label, value) {
      ensureSpace(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...MUTED);
      doc.text(label.toUpperCase(), margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      doc.text(value || "—", margin + 130, y);
      y += 17;
    }

    function paragraph(text) {
      if (!text) return;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(text, pageW - margin * 2);
      ensureSpace(lines.length * 13 + 6);
      doc.text(lines, margin, y);
      y += lines.length * 13 + 6;
    }

    function bulletList(title, items) {
      ensureSpace(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      doc.text(title.toUpperCase(), margin, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      if (!items.length) {
        doc.text("—", margin + 12, y);
        y += 14;
        return;
      }
      items.forEach((item) => {
        const lines = doc.splitTextToSize("•  " + item, pageW - margin * 2 - 12);
        ensureSpace(lines.length * 13);
        doc.text(lines, margin + 12, y);
        y += lines.length * 13;
      });
      y += 6;
    }

    function table(head, rows) {
      ensureSpace(30);
      doc.autoTable({
        startY: y,
        head: [head],
        body: rows.length ? rows : [head.map(() => "—")],
        margin: { left: margin, right: margin },
        styles: { font: "helvetica", fontSize: 9.5, cellPadding: 6, textColor: INK, lineColor: [225, 225, 225] },
        headStyles: { fillColor: [26, 41, 66], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 247, 243] },
        theme: "grid"
      });
      y = doc.lastAutoTable.finalY + 22;
    }

    /* Cover */
    y = 90;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...ACCENT);
    doc.text("FORMAL PROJECT RECORD", margin, y);
    y += 34;
    doc.setFont("times", "bold");
    doc.setFontSize(30);
    doc.setTextColor(...INK);
    doc.text(val("pName") || "Untitled Project", margin, y);
    y += 20;
    if (val("pCode")) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...MUTED);
      doc.text(val("pCode"), margin, y);
      y += 20;
    }
    y += 14;

    fieldRow("Sponsor", val("pSponsor"));
    fieldRow("Project manager", val("pManager"));
    fieldRow("Department", val("pDept"));
    fieldRow("Start date", val("startDate"));
    fieldRow("Target end date", val("endDate"));
    const currency = val("currency");
    const budget = val("budgetVal");
    fieldRow("Budget", budget ? `${currency} ${Number(budget).toLocaleString()}` : "");
    y += 10;

    /* 02 Purpose & Objectives */
    sectionTitle("02", "Purpose & Objectives");
    if (val("purpose")) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      doc.text("PURPOSE STATEMENT", margin, y);
      y += 14;
      paragraph(val("purpose"));
      y += 4;
    }
    bulletList("Objectives", listValues("objectives"));
    bulletList("Success criteria", listValues("successCriteria"));

    /* 03 Scope */
    sectionTitle("03", "Scope");
    bulletList("In scope", listValues("inScope"));
    bulletList("Out of scope", listValues("outScope"));
    bulletList("Assumptions", listValues("assumptions"));
    bulletList("Constraints", listValues("constraints"));

    /* 04 Stakeholders */
    sectionTitle("04", "Stakeholders");
    const stakeholderRows = Array.from(document.querySelectorAll("#stakeholdersTable tbody tr")).map((tr) => [
      tr.querySelector(".sh-name").value || "—",
      tr.querySelector(".sh-role").value || "—",
      tr.querySelector(".sh-resp").value || "—",
      tr.querySelector(".influence-select").value || "—"
    ]);
    table(["Name", "Role", "Responsibility", "Influence"], stakeholderRows);

    /* 05 Deliverables */
    sectionTitle("05", "Deliverables & Milestones");
    const deliverableRows = Array.from(document.querySelectorAll("#deliverablesTable tbody tr")).map((tr) => [
      tr.querySelector(".del").value || "—",
      tr.querySelector(".owner").value || "—",
      tr.querySelector(".mile").value || "—"
    ]);
    table(["Deliverable", "Owner", "Target date"], deliverableRows);

    /* 06 Risks */
    sectionTitle("06", "Risks & Mitigations");
    const riskRows = Array.from(document.querySelectorAll("#risksTable tbody tr")).map((tr) => [
      tr.querySelector(".risk").value || "—",
      tr.querySelector(".likelihood-select").value || "—",
      tr.querySelector(".impact-select").value || "—",
      tr.querySelector(".mit").value || "—",
      tr.querySelector(".risk-owner").value || "—"
    ]);
    table(["Risk", "Likelihood", "Impact", "Mitigation", "Owner"], riskRows);

    /* 07 Approval */
    sectionTitle("07", "Approval");
    ensureSpace(90);
    const colW = (pageW - margin * 2 - 30) / 2;
    [
      { name: val("sponsorSignName"), role: "Sponsor", date: val("sponsorSignDate") },
      { name: val("pmSignName"), role: "Project manager", date: val("pmSignDate") }
    ].forEach((sig, i) => {
      const x = margin + i * (colW + 30);
      doc.setDrawColor(200, 200, 200);
      doc.line(x, y + 40, x + colW, y + 40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      doc.text(sig.name || "—", x, y + 54);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(`${sig.role}${sig.date ? "  ·  " + sig.date : ""}`, x, y + 66);
    });

    footer();

    const filename = (val("pName") || "Project_Charter").replace(/[^a-z0-9]+/gi, "_") + ".pdf";
    doc.save(filename);
    showToast("PDF downloaded");
  }

  document.getElementById("downloadBtn").addEventListener("click", generatePDF);

  /* ================= Init ================= */
  initTheme();
  if (!loadDraft()) {
    seedDefaults();
  }
  updateProgress();
  initNavObserver();
})();
