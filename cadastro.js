(function () {
  const sb = window.sb;
  if (!sb) {
    console.error("Supabase client não encontrado. Ordem correta: supabase-js -> app.js -> cadastro.js");
    return;
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const SECTION_MAP = {
    atribuicao: { label: "Atribuição" },
    edital: { label: "Edital" },
    conselho: { label: "Conselho" },
    tutorial: { label: "Tutorial" },
  };

  const BUCKET = "portal-docs";
  const stepEls = $$(".step");
  const stepPanels = $$(".step-panel");
  const btnPrev = $("#btnPrev");
  const btnNext = $("#btnNext");
  const btnSave = $("#btnSave");
  const titleEl = $("#docTitle");
  const dateEl = $("#docDate");
  const sectionHidden = $("#docSection");
  const modeTabs = $$(".mode-tab");
  const modeHidden = $("#docMode");
  const linkEl = $("#docLink");
  const linkWrap = $("#linkWrap");
  const fileWrap = $("#fileWrap");
  const dropZone = $("#dropZone");
  const fileInput = $("#docFile");
  const filePill = $("#filePill");
  const fileNameEl = $("#fileName");
  const fileMetaEl = $("#fileMeta");
  const fileWarn = $("#fileWarn");
  const reviewBox = $("#reviewBox");
  const myUploadsTbody = $("#myUploadsTbody");
  let state = {
    step: 1,
    file: null,
    editingId: null,
    editExisting: null,
  };

  setStep(1);
  syncMode("file");
  renderMyUploads();
  makeRecentBoxCompact(makeRecentBoxCompact);

  $$(".choice").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".choice").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      sectionHidden.value = btn.dataset.value;
      updateButtons();
    });
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        btn.click();
      }
    });
  });

  function selectSection(val) {
    $$(".choice").forEach((b) => b.classList.toggle("selected", b.dataset.value === val));
    sectionHidden.value = val || "";
  }
  function makeRecentBoxCompact() {
    const tbody = document.querySelector("#myUploadsTbody");
    if (!tbody) return;

    const panel = tbody.closest(".panel");
    if (panel) panel.classList.add("recent-compact");
  }


  modeTabs.forEach((t) => {
    t.addEventListener("click", () => {
      modeTabs.forEach((x) => x.classList.remove("primary"));
      t.classList.add("primary");
      syncMode(t.dataset.mode);
      updateButtons();
    });
  });

  function syncMode(mode) {
    modeHidden.value = mode;
    if (mode === "link") {
      linkWrap.style.display = "block";
      fileWrap.style.display = "none";
      linkEl.focus?.();
    } else {
      linkWrap.style.display = "none";
      fileWrap.style.display = "block";
    }
  }

  // ===== arquivo
  $("#btnChooseFile")?.addEventListener("click", () => fileInput.click());

  fileInput?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  });

  if (dropZone) {
    ["dragenter", "dragover"].forEach((evt) =>
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
      })
    );
    dropZone.addEventListener("drop", (e) => {
      const f = e.dataTransfer.files?.[0];
      if (f) setFile(f);
    });
  }

  function setFile(f) {
    state.file = f;

    filePill.style.display = "inline-flex";
    fileNameEl.textContent = f.name;

    const sizeKb = f.size / 1024;
    const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(2)} MB` : `${Math.round(sizeKb)} KB`;
    fileMetaEl.textContent = `${f.type || "tipo desconhecido"} • ${sizeLabel}`;

    if (f.size > 35 * 1024 * 1024) {
      fileWarn.style.display = "block";
      fileWarn.innerHTML = `⚠️ Arquivo grande. Prefira publicar vídeos por <strong>link</strong>.`;
    } else {
      fileWarn.style.display = "none";
    }

    updateButtons();
  }

  // ===== navegação
  btnPrev.addEventListener("click", () => state.step > 1 && setStep(state.step - 1));
  btnNext.addEventListener("click", () => {
    if (state.step < 4 && canGoNext()) setStep(state.step + 1);
    else showWhyCantProceed();
  });

  btnSave.addEventListener("click", async () => {
    if (!canSave()) return showWhyCantProceed();
    await saveOrUpdate();
  });

  [titleEl, dateEl, linkEl].forEach((el) => el?.addEventListener("input", updateButtons));

  function setStep(n) {
    state.step = n;

    stepEls.forEach((s) => {
      const sn = parseInt(s.dataset.step, 10);
      s.classList.toggle("active", sn === n);
      s.classList.toggle("done", sn < n);
    });

    stepPanels.forEach((p) => {
      p.style.display = parseInt(p.dataset.step, 10) === n ? "block" : "none";
    });

    btnPrev.disabled = n === 1;
    btnNext.style.display = n < 4 ? "inline-flex" : "none";
    btnSave.style.display = n === 4 ? "inline-flex" : "none";

    if (n === 4) {
      btnSave.textContent = state.editingId ? "Salvar alterações" : "Salvar";
      renderReview();
    }

    updateButtons();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function canGoNext() {
    if (state.step === 1) return !!sectionHidden.value;
    if (state.step === 2) return titleEl.value.trim().length >= 3 && !!dateEl.value;
    if (state.step === 3) {
      if (modeHidden.value === "link") return isValidUrl(linkEl.value.trim());
      return !!state.file || (!!state.editExisting && state.editExisting.kind === "file");
    }
    return true;
  }

  function canSave() {
    const okBase = !!sectionHidden.value && titleEl.value.trim().length >= 3 && !!dateEl.value;
    if (!okBase) return false;

    if (modeHidden.value === "link") return isValidUrl(linkEl.value.trim());
    return !!state.file || (!!state.editExisting && state.editExisting.kind === "file");
  }

  function updateButtons() {
    btnNext.disabled = !(state.step < 4 && canGoNext());
    btnSave.disabled = !canSave();
  }

  function showWhyCantProceed() {
    if (state.step === 1) return window.showToast?.("Falta 1 passo", "Escolha a seção.");
    if (state.step === 2) return window.showToast?.("Quase lá", "Preencha título (mín. 3) e data.");
    if (state.step === 3) {
      if (modeHidden.value === "link") return window.showToast?.("Só mais isso", "Cole um link válido.");
      return window.showToast?.("Só mais isso", "Selecione um arquivo (ou use link para vídeo).");
    }
  }

  function renderReview() {
    const secKey = sectionHidden.value;
    const secLabel = SECTION_MAP[secKey]?.label || secKey || "—";
    const title = titleEl.value.trim() || "—";
    const date = dateEl.value ? new Date(dateEl.value + "T00:00:00").toLocaleDateString("pt-BR") : "—";
    const mode = modeHidden.value;

    const info =
      mode === "link"
        ? `<div class="inline-note"><strong>Link:</strong> ${escapeHtml(linkEl.value.trim())}</div>`
        : `<div class="inline-note"><strong>Arquivo:</strong> ${escapeHtml(state.file?.name || state.editExisting?.file_name || "—")}</div>`;

    reviewBox.innerHTML = `
      <div class="pills" style="margin-bottom:10px;">
        <span class="badge info">${escapeHtml(secLabel)}</span>
        <span class="badge">${escapeHtml(date)}</span>
      </div>
      <h4 style="margin:0 0 8px;">${escapeHtml(title)}</h4>
      ${info}
      <p class="help" style="margin-top:10px;">Ao salvar, aparece nas páginas públicas.</p>
    `;
  }

  async function uploadToStorage(section, file) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const ts = Date.now();
    const filename = `${ts}_${safeName(file.name)}`;
    const path = `${section}/${yyyy}/${mm}/${filename}`;

    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (upErr) throw upErr;

    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    return { path, publicUrl: pub?.publicUrl || "" };
  }

  async function saveOrUpdate() {
    const section = sectionHidden.value;
    const kind = modeHidden.value;

    const base = {
      section,
      title: titleEl.value.trim(),
      doc_date: dateEl.value,
      kind,
      published: true,
    };

    try {
      // UPDATE (se você deixar update liberado no SQL opcional)
      if (state.editingId) {
        let update = { ...base };

        if (kind === "link") {
          update.url = linkEl.value.trim();
          update.file_path = null;
          update.file_url = null;
          update.file_name = null;
          update.file_type = null;
          update.file_size = null;
        } else {
          if (state.file) {
            const oldPath = state.editExisting?.file_path || null;
            const uploaded = await uploadToStorage(section, state.file);

            update.url = null;
            update.file_path = uploaded.path;
            update.file_url = uploaded.publicUrl;
            update.file_name = state.file.name;
            update.file_type = state.file.type || null;
            update.file_size = state.file.size || null;

            // se você liberar delete do storage no SQL opcional, isso funciona:
            if (oldPath) await sb.storage.from(BUCKET).remove([oldPath]).catch(() => { });
          } else {
            update.url = null;
          }
        }

        const { error } = await sb.from("portal_docs").update(update).eq("id", state.editingId);
        if (error) throw error;

        window.showToast?.("Salvo!", "Alterações atualizadas.");
        clearEditing();
        await renderMyUploads();
        setStep(1);
        return;
      }

      // INSERT
      let insert = { ...base };

      if (kind === "link") {
        insert.url = linkEl.value.trim();
      } else {
        if (!state.file) return window.showToast?.("Arquivo", "Escolha um arquivo.");
        const uploaded = await uploadToStorage(section, state.file);

        insert.file_path = uploaded.path;
        insert.file_url = uploaded.publicUrl;
        insert.file_name = state.file.name;
        insert.file_type = state.file.type || null;
        insert.file_size = state.file.size || null;
      }

      const { error } = await sb.from("portal_docs").insert(insert);
      if (error) throw error;

      window.showToast?.("Publicado!", "Informações salvas.");
      resetForm();
      await renderMyUploads();
      setStep(1);
    } catch (err) {
      console.error(err);
      window.showToast?.("Erro", "Não consegui salvar. Veja o console.");
    }
  }

  async function renderMyUploads() {
    if (!myUploadsTbody) return;

    const { data, error } = await sb
      .from("portal_docs")
      .select("id, section, title, doc_date, kind, url, file_name, file_path, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
      myUploadsTbody.innerHTML = `<tr><td colspan="4" class="help" style="padding:14px 16px;">Erro ao carregar.</td></tr>`;
      return;
    }

    const items = data || [];
    if (!items.length) {
      myUploadsTbody.innerHTML = `<tr><td colspan="4" class="help" style="padding:14px 16px;">Sem publicações ainda.</td></tr>`;
      return;
    }

    myUploadsTbody.innerHTML = items
      .map((x) => {
        const dateLabel = x.doc_date ? new Date(x.doc_date + "T00:00:00").toLocaleDateString("pt-BR") : "—";
        const sec = SECTION_MAP[x.section]?.label || x.section || "—";
        const badge = x.kind === "link" ? `<span class="badge info">Link</span>` : `<span class="badge ok">Arquivo</span>`;
        const shown = x.kind === "link" ? (x.url || "—") : (x.file_name || "—");

        return `
          <tr>
            <td>
              <strong>${escapeHtml(x.title || "Sem título")}</strong>
              <div class="help">${escapeHtml(sec)} • ${escapeHtml(dateLabel)}</div>
            </td>
            <td>${badge}</td>
            <td class="help">${escapeHtml(shown)}</td>
            <td style="text-align:right;">
              <div class="row-actions">
                <button class="btn small" data-edit="${x.id}" type="button">Editar</button>
                <button class="btn small danger" data-del="${x.id}" type="button">Excluir</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    // Edit/Delete só funcionam se você liberar update/delete no SQL (opcional)
    $$("[data-edit]", myUploadsTbody).forEach((b) => b.addEventListener("click", () => startEditing(b.dataset.edit)));
    $$("[data-del]", myUploadsTbody).forEach((b) => b.addEventListener("click", () => deleteDoc(b.dataset.del)));
  }

  async function startEditing(id) {
    const { data, error } = await sb
      .from("portal_docs")
      .select("id, section, title, doc_date, kind, url, file_name, file_path")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return window.showToast?.("Ops!", "Não encontrei esse item.");

    state.editingId = data.id;
    state.editExisting = data;

    selectSection(data.section);
    titleEl.value = data.title || "";
    dateEl.value = data.doc_date || "";

    if (data.kind === "link") {
      modeTabs.forEach((x) => x.classList.toggle("primary", x.dataset.mode === "link"));
      syncMode("link");
      linkEl.value = data.url || "";
      state.file = null;
      fileInput.value = "";
      filePill.style.display = "none";
      fileWarn.style.display = "none";
    } else {
      modeTabs.forEach((x) => x.classList.toggle("primary", x.dataset.mode === "file"));
      syncMode("file");
      linkEl.value = "";
      state.file = null;
      fileInput.value = "";
      filePill.style.display = "inline-flex";
      fileNameEl.textContent = data.file_name || "arquivo";
      fileMetaEl.textContent = "arquivo existente";
    }

    window.showToast?.("Edição", "Edite e avance até a revisão.");
    setStep(1);
  }

  async function deleteDoc(id) {
    // apaga row
    const { data } = await sb.from("portal_docs").select("id, kind, file_path").eq("id", id).maybeSingle();
    const { error } = await sb.from("portal_docs").delete().eq("id", id);
    if (error) {
      console.error(error);
      return window.showToast?.("Erro", "Não consegui excluir (libere delete no SQL opcional).");
    }

    // apaga arquivo (só se você liberar delete no storage no SQL opcional)
    if (data?.kind === "file" && data.file_path) {
      await sb.storage.from(BUCKET).remove([data.file_path]).catch(() => { });
    }

    window.showToast?.("Removido", "Excluído.");
    clearEditing();
    await renderMyUploads();
  }

  function clearEditing() {
    state.editingId = null;
    state.editExisting = null;
    resetForm();
  }

  function resetForm() {
    titleEl.value = "";
    dateEl.value = "";
    linkEl.value = "";
    state.file = null;
    fileInput.value = "";
    filePill.style.display = "none";
    fileWarn.style.display = "none";
    $$(".choice").forEach((b) => b.classList.remove("selected"));
    sectionHidden.value = "";
    modeTabs.forEach((x) => x.classList.toggle("primary", x.dataset.mode === "file"));
    syncMode("file");
    updateButtons();
  }

  function isValidUrl(url) {
    try {
      const u = new URL(url);
      return ["http:", "https:"].includes(u.protocol);
    } catch {
      return false;
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeName(name) {
    return String(name || "arquivo")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 120);
  }
})();
