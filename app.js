(function () {
  const SUPABASE_URL = "https://pfcpebtlshekbrxetmmu.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmY3BlYnRsc2hla2JyeGV0bW11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODEzNjcsImV4cCI6MjA4MTE1NzM2N30.4gb0py4MrnQnp6AbYbZZaYdCJs-DiNNlYkFByVuAXZA";

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.sb = sb;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // marca nav ativo (se você usar data-nav)
  const page = document.body?.dataset?.page || "";
  $$("[data-nav]").forEach((a) => {
    if (a.dataset.nav === page) a.classList.add("primary");
  });

  window.showToast = function (title, message) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.className = "toast";
      t.innerHTML = "<p class='t'></p><p class='m'></p>";
      document.body.appendChild(t);
    }
    $(".t", t).textContent = title || "Pronto!";
    $(".m", t).textContent = message || "";
    t.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  };

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replaceAll("`", "&#096;");
  }
  function isPdf(name, type) {
    const n = (name || "").toLowerCase();
    return (type || "").includes("pdf") || n.endsWith(".pdf");
  }

  // ====== PÚBLICO: listar docs por seção
  window.renderDocsForSection = async function (section) {
    const list = document.getElementById("docsList");
    if (!list) return;

    const q = (document.getElementById("searchInput")?.value || "").trim();
    const empty = document.getElementById("emptyState");

    list.innerHTML = `
      <tr>
        <td colspan="3" class="help" style="padding:14px 16px;">Carregando…</td>
      </tr>
    `;
    if (empty) empty.style.display = "none";

    try {
      let query = sb
        .from("portal_docs")
        .select("id, section, title, doc_date, kind, url, file_url, file_name, file_type, published, created_at")
        .eq("published", true)
        .eq("section", section)
        .order("doc_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (q) {
        const qq = q.replaceAll(",", " ");
        query = query.or(`title.ilike.%${qq}%,file_name.ilike.%${qq}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const items = data || [];

      if (items.length === 0) {
        list.innerHTML = "";
        if (empty) empty.style.display = "block";
        return;
      }

      if (empty) empty.style.display = "none";

      list.innerHTML = items
        .map((x) => {
          const date = x.doc_date ? new Date(x.doc_date + "T00:00:00") : null;
          const dateLabel = date ? date.toLocaleDateString("pt-BR") : "—";

          const badgeClass = x.kind === "link" ? "info" : "ok";
          const badgeText = x.kind === "link" ? "Link" : "Arquivo";

          let action = "";
          if (x.kind === "link" && x.url) {
            action = `<a class="btn small primary" href="${escapeAttr(x.url)}" target="_blank" rel="noopener">Abrir</a>`;
          } else if (x.file_url) {
            action = isPdf(x.file_name, x.file_type)
              ? `<a class="btn small primary" href="${escapeAttr(x.file_url)}" target="_blank" rel="noopener">Ver PDF</a>`
              : `<a class="btn small primary" href="${escapeAttr(x.file_url)}" target="_blank" rel="noopener">Baixar</a>`;
          } else {
            action = `<span class="badge warn">Indisponível</span>`;
          }

          return `
            <tr>
              <td>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <strong>${escapeHtml(x.title || "Sem título")}</strong>
                  <span class="help">${escapeHtml(x.file_name || (x.kind === "link" ? "Link" : "Arquivo"))} • ${escapeHtml(dateLabel)}</span>
                </div>
              </td>
              <td><span class="badge ${badgeClass}">${badgeText}</span></td>
              <td style="text-align:right;">${action}</td>
            </tr>
          `;
        })
        .join("");
    } catch (err) {
      list.innerHTML = `
        <tr>
          <td colspan="3" class="help" style="padding:14px 16px;">
            Erro ao carregar. Tente atualizar a página.
          </td>
        </tr>
      `;
      window.showToast?.("Erro", "Não consegui buscar os dados no Supabase.");
      console.error(err);
    }
  };
})();
