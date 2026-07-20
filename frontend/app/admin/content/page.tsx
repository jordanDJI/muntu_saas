"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const K = {
  teal: "#0D4B58", tealL: "#1A6E82", tealXL: "#2A8FA5",
  gold: "#DDAA40",
  card: "#0D1B25", card2: "#0A1520",
  border: "rgba(170,189,216,0.10)",
  text: "#EEF2F5", muted: "#8BA5B0",
  danger: "#E06060", success: "#4ACA7A",
};

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}`, ...(options.headers ?? {}) },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
  return res.json();
}

const BLOG_CATEGORIES = ["Comparatifs", "Prix & ROI", "Acquisition clients", "Outils", "Témoignages", "Actualités"];
const BLOG_METIERS = ["Santé", "Artisans & services", "Beauté", "Coaching", "Finance", "Restaurant", "Commerce"];

type BlogPost = {
  id: string; slug: string; title: string; description?: string;
  category?: string; metier?: string; body_html?: string;
  reading_minutes: number; status: string; published_at?: string; updated_at?: string;
};

type Testimonial = {
  id: string; name: string; role?: string; text: string;
  initials?: string; bg_color: string; text_color: string;
  sort_order: number; active: boolean;
};

const BLANK_POST: Omit<BlogPost, "id" | "updated_at"> = {
  slug: "", title: "", description: "", category: "", metier: "",
  body_html: "", reading_minutes: 5, status: "draft", published_at: "",
};

const BLANK_TESTI: Omit<Testimonial, "id"> = {
  name: "", role: "", text: "", initials: "",
  bg_color: "rgba(13,75,88,.4)", text_color: "var(--l-teal-xl)",
  sort_order: 0, active: true,
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  published: { bg: "rgba(74,202,122,0.12)", color: "#4ACA7A" },
  draft:     { bg: "rgba(221,170,64,0.12)", color: "#DDAA40" },
};

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs block mb-1" style={{ color: K.muted }}>{label}</label>
      {children}
    </div>
  );
}

const inp = {
  className: "w-full rounded-lg px-3 py-2 text-sm focus:outline-none",
  style: { background: K.card2, border: `1px solid rgba(170,189,216,0.15)`, color: K.text },
} as const;

export default function ContentPage() {
  const [tab, setTab] = useState<"blog" | "testimonials">("blog");
  const [toast, setToast] = useState("");
  const [toastOk, setToastOk] = useState(true);
  const [busy, setBusy] = useState(false);

  // ── Blog state ──
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [editPost, setEditPost] = useState<Partial<BlogPost> | null>(null);
  const [previewHtml, setPreviewHtml] = useState(false);

  // ── Testimonials state ──
  const [testis, setTestis] = useState<Testimonial[]>([]);
  const [editTesti, setEditTesti] = useState<Partial<Testimonial> | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok); setTimeout(() => setToast(""), 3000);
  };

  const loadPosts = useCallback(async () => {
    try { setPosts(await adminFetch("/api/v1/admin/content/blog")); } catch {}
  }, []);

  const loadTestis = useCallback(async () => {
    try { setTestis(await adminFetch("/api/v1/admin/content/testimonials")); } catch {}
  }, []);

  useEffect(() => { loadPosts(); loadTestis(); }, [loadPosts, loadTestis]);

  // ── Blog handlers ──
  const savePost = async () => {
    if (!editPost?.title || !editPost?.slug) { showToast("Titre et slug requis", false); return; }
    setBusy(true);
    try {
      const method = editPost.id ? "PATCH" : "POST";
      const path = editPost.id ? `/api/v1/admin/content/blog/${editPost.id}` : "/api/v1/admin/content/blog";
      await adminFetch(path, { method, body: JSON.stringify({
        slug: editPost.slug, title: editPost.title, description: editPost.description || null,
        category: editPost.category || null, metier: editPost.metier || null,
        body_html: editPost.body_html || null, reading_minutes: editPost.reading_minutes || 5,
        status: editPost.status || "draft",
        published_at: editPost.published_at || null,
      }) });
      showToast(editPost.id ? "Article mis à jour ✓" : "Article créé ✓");
      setEditPost(null);
      await loadPosts();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  const deletePost = async (id: string) => {
    if (!confirm("Supprimer cet article ?")) return;
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/content/blog/${id}`, { method: "DELETE" });
      showToast("Article supprimé"); await loadPosts();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  // ── Testimonial handlers ──
  const saveTesti = async () => {
    if (!editTesti?.name || !editTesti?.text) { showToast("Nom et texte requis", false); return; }
    setBusy(true);
    try {
      const method = editTesti.id ? "PATCH" : "POST";
      const path = editTesti.id ? `/api/v1/admin/content/testimonials/${editTesti.id}` : "/api/v1/admin/content/testimonials";
      await adminFetch(path, { method, body: JSON.stringify({
        name: editTesti.name, role: editTesti.role || null, text: editTesti.text,
        initials: editTesti.initials || null, bg_color: editTesti.bg_color || BLANK_TESTI.bg_color,
        text_color: editTesti.text_color || BLANK_TESTI.text_color,
        sort_order: editTesti.sort_order ?? 0, active: editTesti.active ?? true,
      }) });
      showToast(editTesti.id ? "Témoignage mis à jour ✓" : "Témoignage ajouté ✓");
      setEditTesti(null);
      await loadTestis();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  const deleteTesti = async (id: string) => {
    if (!confirm("Supprimer ce témoignage ?")) return;
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/content/testimonials/${id}`, { method: "DELETE" });
      showToast("Témoignage supprimé"); await loadTestis();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-8 max-w-6xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 text-sm px-4 py-2 rounded-lg shadow-lg"
          style={{ background: toastOk ? K.teal : "#7A1A1A", color: "#fff", border: `1px solid ${toastOk ? K.tealL : K.danger}` }}>
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-0.5" style={{ color: K.text }}>Contenu</h1>
        <p className="text-sm" style={{ color: K.muted }}>Blog &amp; témoignages de la landing page — sans toucher au code</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ background: "rgba(170,189,216,0.04)" }}>
        {(["blog", "testimonials"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 text-xs rounded-md transition-colors capitalize"
            style={tab === t ? { background: "rgba(13,75,88,0.35)", color: "#7DD8E8" } : { color: K.muted }}>
            {t === "blog" ? `Blog (${posts.length})` : `Témoignages (${testis.length})`}
          </button>
        ))}
      </div>

      {/* ── BLOG ── */}
      {tab === "blog" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Liste */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium" style={{ color: K.muted }}>Articles</span>
              <button onClick={() => { setEditPost({ ...BLANK_POST }); setPreviewHtml(false); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: K.teal, color: "#fff" }}>
                + Nouvel article
              </button>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: K.card, border: `1px solid ${K.border}` }}>
              {posts.length === 0 ? (
                <p className="p-8 text-center text-sm" style={{ color: "rgba(170,189,216,0.25)" }}>Aucun article</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs" style={{ borderBottom: `1px solid ${K.border}`, color: K.muted }}>
                      <th className="text-left px-4 py-3 font-medium">Titre</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Catégorie</th>
                      <th className="text-left px-4 py-3 font-medium">Statut</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((p) => {
                      const b = STATUS_BADGE[p.status] ?? STATUS_BADGE.draft;
                      return (
                        <tr key={p.id} style={{ borderBottom: `1px solid rgba(170,189,216,0.04)` }}>
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium" style={{ color: K.text }}>{p.title}</p>
                            <p className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(170,189,216,0.3)" }}>{p.slug}</p>
                          </td>
                          <td className="px-4 py-3 text-xs hidden sm:table-cell" style={{ color: K.muted }}>{p.category ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: b.bg, color: b.color }}>
                              {p.status === "published" ? "Publié" : "Brouillon"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center gap-3 justify-end">
                              <button onClick={() => { setEditPost({ ...p }); setPreviewHtml(false); }}
                                className="text-xs" style={{ color: K.tealXL }}>Éditer</button>
                              <button onClick={() => deletePost(p.id)} disabled={busy}
                                className="text-xs" style={{ color: K.danger }}>Supprimer</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Formulaire */}
          {editPost && (
            <div className="lg:col-span-2">
              <div className="rounded-xl p-5 space-y-3 sticky top-6" style={{ background: K.card, border: `1px solid ${K.border}` }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium" style={{ color: K.text }}>
                    {editPost.id ? "Modifier l'article" : "Nouvel article"}
                  </h3>
                  <button onClick={() => setEditPost(null)} style={{ color: K.muted }} className="text-xs">✕</button>
                </div>

                <Field label="Titre *">
                  <input {...inp} value={editPost.title ?? ""} onChange={(e) => {
                    const t = e.target.value;
                    setEditPost((p) => ({ ...p, title: t, slug: p?.id ? p.slug : slugify(t) }));
                  }} placeholder="Titre de l'article" />
                </Field>

                <Field label="Slug (URL) *">
                  <input {...inp} value={editPost.slug ?? ""} onChange={(e) =>
                    setEditPost((p) => ({ ...p, slug: slugify(e.target.value) }))} />
                  <p className="text-[10px] mt-1" style={{ color: "rgba(170,189,216,0.3)" }}>
                    /blog/{editPost.slug || "slug-de-larticle"}
                  </p>
                </Field>

                <Field label="Description (extrait)">
                  <textarea {...inp} rows={2} value={editPost.description ?? ""}
                    onChange={(e) => setEditPost((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Court résumé affiché sur la liste du blog" />
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Catégorie">
                    <select {...inp} value={editPost.category ?? ""} onChange={(e) => setEditPost((p) => ({ ...p, category: e.target.value }))}>
                      <option value="">—</option>
                      {BLOG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Métier">
                    <select {...inp} value={editPost.metier ?? ""} onChange={(e) => setEditPost((p) => ({ ...p, metier: e.target.value }))}>
                      <option value="">—</option>
                      {BLOG_METIERS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Temps de lecture (min)">
                    <input {...inp} type="number" min={1} max={60} value={editPost.reading_minutes ?? 5}
                      onChange={(e) => setEditPost((p) => ({ ...p, reading_minutes: Number(e.target.value) }))} />
                  </Field>
                  <Field label="Date de publication">
                    <input {...inp} type="date" value={editPost.published_at ?? ""}
                      onChange={(e) => setEditPost((p) => ({ ...p, published_at: e.target.value }))} />
                  </Field>
                </div>

                <Field label="Statut">
                  <div className="flex gap-2">
                    {["draft", "published"].map((s) => (
                      <button key={s} onClick={() => setEditPost((p) => ({ ...p, status: s }))}
                        className="flex-1 py-1.5 rounded-lg text-xs transition-colors"
                        style={editPost.status === s
                          ? { background: s === "published" ? "rgba(74,202,122,0.15)" : "rgba(221,170,64,0.15)",
                              color: s === "published" ? K.success : K.gold,
                              border: `1px solid ${s === "published" ? "rgba(74,202,122,0.3)" : "rgba(221,170,64,0.3)"}` }
                          : { background: "rgba(170,189,216,0.05)", color: K.muted, border: `1px solid ${K.border}` }}>
                        {s === "draft" ? "Brouillon" : "Publié"}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label={
                  <div className="flex items-center justify-between">
                    <span>Contenu HTML</span>
                    <button onClick={() => setPreviewHtml((v) => !v)} className="text-[10px]" style={{ color: K.tealXL }}>
                      {previewHtml ? "Éditer" : "Aperçu"}
                    </button>
                  </div> as any
                }>
                  {previewHtml ? (
                    <div className="rounded-lg p-3 text-sm prose prose-invert max-w-none overflow-auto max-h-64"
                      style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.15)`, color: K.text, lineHeight: 1.7 }}
                      dangerouslySetInnerHTML={{ __html: editPost.body_html ?? "<p style='color:rgba(170,189,216,0.3)'>Aucun contenu</p>" }} />
                  ) : (
                    <textarea {...inp} rows={10}
                      value={editPost.body_html ?? ""}
                      onChange={(e) => setEditPost((p) => ({ ...p, body_html: e.target.value }))}
                      placeholder={"<p>Votre contenu ici...</p>\n<h2>Titre de section</h2>\n<p>Paragraphe...</p>\n<ul><li>Point 1</li></ul>"} />
                  )}
                  <p className="text-[10px] mt-1" style={{ color: "rgba(170,189,216,0.25)" }}>
                    Balises supportées : &lt;h2&gt; &lt;h3&gt; &lt;p&gt; &lt;strong&gt; &lt;em&gt; &lt;ul&gt;&lt;li&gt; &lt;a href&gt;
                  </p>
                </Field>

                <button onClick={savePost} disabled={busy}
                  className="w-full py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                  style={{ background: K.teal, color: "#fff" }}>
                  {busy ? "Enregistrement…" : editPost.id ? "Mettre à jour" : "Créer l'article"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TÉMOIGNAGES ── */}
      {tab === "testimonials" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Liste */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium" style={{ color: K.muted }}>Témoignages landing page</span>
              <button onClick={() => setEditTesti({ ...BLANK_TESTI })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: K.teal, color: "#fff" }}>
                + Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {testis.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: "rgba(170,189,216,0.25)" }}>Aucun témoignage</p>
              ) : testis.map((t) => (
                <div key={t.id} className="rounded-xl p-4" style={{ background: K.card, border: `1px solid ${K.border}` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: t.bg_color, color: t.text_color }}>
                        {t.initials ?? t.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-medium" style={{ color: K.text }}>{t.name}</p>
                        <p className="text-[10px] mb-1" style={{ color: K.muted }}>{t.role}</p>
                        <p className="text-xs italic leading-relaxed" style={{ color: "rgba(170,189,216,0.6)" }}>
                          "{t.text.slice(0, 120)}{t.text.length > 120 ? "…" : ""}"
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: t.active ? "rgba(74,202,122,0.1)" : "rgba(224,96,96,0.1)", color: t.active ? K.success : K.danger }}>
                        {t.active ? "Visible" : "Masqué"}
                      </span>
                      <button onClick={() => setEditTesti({ ...t })} className="text-xs" style={{ color: K.tealXL }}>Éditer</button>
                      <button onClick={() => deleteTesti(t.id)} disabled={busy} className="text-xs" style={{ color: K.danger }}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formulaire témoignage */}
          {editTesti && (
            <div className="lg:col-span-2">
              <div className="rounded-xl p-5 space-y-3 sticky top-6" style={{ background: K.card, border: `1px solid ${K.border}` }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium" style={{ color: K.text }}>
                    {editTesti.id ? "Modifier le témoignage" : "Nouveau témoignage"}
                  </h3>
                  <button onClick={() => setEditTesti(null)} style={{ color: K.muted }} className="text-xs">✕</button>
                </div>

                {/* Preview */}
                <div className="rounded-xl p-4" style={{ background: "#07222F", border: "1px solid rgba(170,189,216,0.08)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: editTesti.bg_color || BLANK_TESTI.bg_color, color: editTesti.text_color || BLANK_TESTI.text_color }}>
                      {(editTesti.initials || editTesti.name?.slice(0, 2) || "??").toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: K.text }}>{editTesti.name || "Nom"}</p>
                      <p className="text-[10px]" style={{ color: K.muted }}>{editTesti.role || "Rôle"}</p>
                    </div>
                  </div>
                  <p className="text-xs mt-2 italic" style={{ color: "rgba(170,189,216,0.6)" }}>
                    "{editTesti.text || "Contenu du témoignage…"}"
                  </p>
                </div>

                <Field label="Nom *">
                  <input {...inp} value={editTesti.name ?? ""} placeholder="Marie Dupont"
                    onChange={(e) => setEditTesti((p) => ({ ...p, name: e.target.value }))} />
                </Field>

                <Field label="Rôle / Métier">
                  <input {...inp} value={editTesti.role ?? ""} placeholder="Kinésithérapeute, Lyon"
                    onChange={(e) => setEditTesti((p) => ({ ...p, role: e.target.value }))} />
                </Field>

                <Field label="Texte du témoignage *">
                  <textarea {...inp} rows={4} value={editTesti.text ?? ""}
                    placeholder="Mon activité a triplé depuis que j'utilise Klientys…"
                    onChange={(e) => setEditTesti((p) => ({ ...p, text: e.target.value }))} />
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Initiales (avatar)">
                    <input {...inp} value={editTesti.initials ?? ""} maxLength={3} placeholder="MD"
                      onChange={(e) => setEditTesti((p) => ({ ...p, initials: e.target.value.toUpperCase() }))} />
                  </Field>
                  <Field label="Ordre d'affichage">
                    <input {...inp} type="number" min={0} value={editTesti.sort_order ?? 0}
                      onChange={(e) => setEditTesti((p) => ({ ...p, sort_order: Number(e.target.value) }))} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Couleur fond avatar">
                    <input {...inp} value={editTesti.bg_color ?? BLANK_TESTI.bg_color}
                      placeholder="rgba(13,75,88,.4)"
                      onChange={(e) => setEditTesti((p) => ({ ...p, bg_color: e.target.value }))} />
                  </Field>
                  <Field label="Couleur texte avatar">
                    <input {...inp} value={editTesti.text_color ?? BLANK_TESTI.text_color}
                      placeholder="var(--l-teal-xl)"
                      onChange={(e) => setEditTesti((p) => ({ ...p, text_color: e.target.value }))} />
                  </Field>
                </div>

                <Field label="Visibilité">
                  <div className="flex gap-2">
                    {[true, false].map((v) => (
                      <button key={String(v)} onClick={() => setEditTesti((p) => ({ ...p, active: v }))}
                        className="flex-1 py-1.5 rounded-lg text-xs transition-colors"
                        style={editTesti.active === v
                          ? { background: v ? "rgba(74,202,122,0.15)" : "rgba(224,96,96,0.12)", color: v ? K.success : K.danger, border: `1px solid ${v ? "rgba(74,202,122,0.3)" : "rgba(224,96,96,0.3)"}` }
                          : { background: "rgba(170,189,216,0.05)", color: K.muted, border: `1px solid ${K.border}` }}>
                        {v ? "Visible" : "Masqué"}
                      </button>
                    ))}
                  </div>
                </Field>

                <button onClick={saveTesti} disabled={busy}
                  className="w-full py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                  style={{ background: K.teal, color: "#fff" }}>
                  {busy ? "Enregistrement…" : editTesti.id ? "Mettre à jour" : "Ajouter"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
