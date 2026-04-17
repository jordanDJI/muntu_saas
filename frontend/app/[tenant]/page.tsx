import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getSiteData(slug: string) {
  const { data: tenant } = await supabase
    .from("tenant")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!tenant) return null;

  const { data: site } = await supabase
    .from("site")
    .select("*, service_offer(*), service_area(*)")
    .eq("tenant_id", tenant.id)
    .eq("status", "published")
    .single();

  return site ? { ...site, tenant } : null;
}

export default async function TenantSitePage({ params }: { params: { tenant: string } }) {
  const site = await getSiteData(params.tenant);

  if (!site) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Site introuvable ou non publié.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Absence banner */}
      {site.absence_mode && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-center py-3 px-4 text-sm">
          {site.absence_message ?? "Actuellement indisponible — merci de revenir ultérieurement."}
        </div>
      )}

      {/* Hero */}
      <section className="bg-indigo-700 text-white py-20 px-6 text-center">
        <h1 className="text-4xl font-bold">{site.title}</h1>
        {site.service_area?.length > 0 && (
          <p className="mt-3 text-indigo-200 text-lg">
            {site.service_area.map((a: any) => a.city).filter(Boolean).join(" · ")}
          </p>
        )}
      </section>

      {/* Services */}
      {site.service_offer?.length > 0 && (
        <section className="max-w-4xl mx-auto py-16 px-6">
          <h2 className="text-2xl font-bold mb-8 text-center">Nos prestations</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {site.service_offer.map((offer: any) => (
              <div key={offer.id} className="border rounded-xl p-5 shadow-sm">
                <h3 className="font-semibold text-lg">{offer.name}</h3>
                {offer.description && <p className="text-gray-600 mt-2 text-sm">{offer.description}</p>}
                <div className="flex gap-4 mt-3 text-sm text-gray-500">
                  {offer.duration_min && <span>{offer.duration_min} min</span>}
                  {offer.price_eur && <span>{offer.price_eur} €</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact form */}
      <section className="max-w-xl mx-auto py-16 px-6">
        <h2 className="text-2xl font-bold mb-6 text-center">Prendre contact</h2>
        <ContactForm tenantSlug={params.tenant} />
      </section>
    </main>
  );
}

function ContactForm({ tenantSlug }: { tenantSlug: string }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  return (
    <form
      action={`${apiUrl}/api/v1/leads/public/${tenantSlug}`}
      method="POST"
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <input name="first_name" placeholder="Prénom" required className="border rounded-lg px-3 py-2 w-full" />
        <input name="last_name" placeholder="Nom" required className="border rounded-lg px-3 py-2 w-full" />
      </div>
      <input name="email" type="email" placeholder="Email" className="border rounded-lg px-3 py-2 w-full" />
      <input name="phone" type="tel" placeholder="Téléphone" className="border rounded-lg px-3 py-2 w-full" />
      <input type="hidden" name="source" value="website" />
      <input type="hidden" name="audience_type" value="b2c" />
      <input type="hidden" name="request_type" value="contact" />
      <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700">
        Envoyer ma demande
      </button>
    </form>
  );
}
