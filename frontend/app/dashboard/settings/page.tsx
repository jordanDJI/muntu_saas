"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [site, setSite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [absenceMode, setAbsenceMode] = useState(false);
  const [absenceMessage, setAbsenceMessage] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.getSites()
      .then((sites) => {
        const s = sites[0];
        if (s) {
          setSite(s);
          setTitle(s.title ?? "");
          setAbsenceMode(s.absence_mode ?? false);
          setAbsenceMessage(s.absence_message ?? "");
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!site) return;
    setSaving(true);
    setMsg("");
    try {
      const updated = await api.updateSite(site.id, {
        title,
        absence_mode: absenceMode,
        absence_message: absenceMessage || null,
      });
      setSite(updated);
      setMsg("Modifications sauvegardées.");
    } catch {
      setMsg("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublish() {
    if (!site) return;
    try {
      if (site.status === "published") {
        await api.unpublishSite(site.id);
        setSite({ ...site, status: "draft" });
      } else {
        await api.publishSite(site.id);
        setSite({ ...site, status: "published" });
      }
    } catch {
      setMsg("Erreur lors du changement de statut.");
    }
  }

  if (loading) return <div className="p-6 text-gray-400">Chargement...</div>;

  if (!site) return (
    <div className="p-6">
      <p className="text-gray-500 mb-4">Aucun site créé.</p>
      <button onClick={() => router.push("/dashboard")} className="text-indigo-600 hover:underline">
        Retour au tableau de bord
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">←</button>
        <h1 className="text-2xl font-bold">Paramètres du site</h1>
      </div>

      {/* Infos site */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold text-gray-700">Apparence</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Titre affiché</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="absence"
            checked={absenceMode}
            onChange={(e) => setAbsenceMode(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="absence" className="text-sm font-medium">Mode absence</label>
        </div>

        {absenceMode && (
          <div>
            <label className="block text-sm font-medium mb-1">Message d'absence</label>
            <input
              value={absenceMessage}
              onChange={(e) => setAbsenceMessage(e.target.value)}
              placeholder="Ex: Actuellement en congé, retour le 15 mai."
              className="border rounded-lg px-3 py-2 w-full"
            />
          </div>
        )}

        {msg && <p className={`text-sm ${msg.includes("Erreur") ? "text-red-500" : "text-green-600"}`}>{msg}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </button>
      </div>

      {/* Publication */}
      <div className="bg-white rounded-xl shadow p-6 flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-gray-700">Publication</h2>
          <p className="text-sm text-gray-500 mt-1">
            Statut :{" "}
            <span className={site.status === "published" ? "text-green-600 font-medium" : "text-gray-400"}>
              {site.status === "published" ? "Publié" : "Brouillon"}
            </span>
          </p>
        </div>
        <button
          onClick={handleTogglePublish}
          className={`px-4 py-2 rounded-lg font-medium text-sm ${
            site.status === "published"
              ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {site.status === "published" ? "Dépublier" : "Publier"}
        </button>
      </div>

      {/* Lien vitrine */}
      <p className="text-sm text-gray-400">
        Vitrine :{" "}
        <a
          href={`http://localhost:3000/nkwax`}
          target="_blank"
          rel="noreferrer"
          className="text-indigo-500 hover:underline"
        >
          localhost:3000/nkwax
        </a>
      </p>
    </div>
  );
}
