"use client";
import { useState } from "react";

export default function ContactForm({ tenantSlug }: { tenantSlug: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const get = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement)?.value || undefined;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    try {
      const res = await fetch(`${apiUrl}/api/v1/leads/public/${tenantSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: get("first_name"),
          last_name: get("last_name"),
          email: get("email"),
          phone: get("phone"),
          source: "website",
          audience_type: "b2c",
          request_type: "contact",
        }),
      });
      if (!res.ok) throw new Error("Erreur lors de l'envoi");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue");
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <p className="text-green-600 font-semibold text-lg">Demande envoyée</p>
        <p className="text-gray-500 mt-2 text-sm">Nous vous recontacterons très prochainement.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <input name="first_name" placeholder="Prénom" required className="border rounded-lg px-3 py-2 w-full" />
        <input name="last_name" placeholder="Nom" required className="border rounded-lg px-3 py-2 w-full" />
      </div>
      <input name="email" type="email" placeholder="Email" className="border rounded-lg px-3 py-2 w-full" />
      <input name="phone" type="tel" placeholder="Téléphone" className="border rounded-lg px-3 py-2 w-full" />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700">
        Envoyer ma demande
      </button>
    </form>
  );
}
