import { expect, test } from "@playwright/test";

// Sans base de données : verrouille deux correctifs de sécurité / RGPD.

test("KLT-1420 — un segment d'URL ne peut pas fermer la balise JSON-LD", async ({ page }) => {
  let alerted = false;
  page.on("dialog", async (d) => { alerted = true; await d.dismiss(); });
  const payload = encodeURIComponent("</script><script>alert(1)</script>");
  await page.goto(`/annuaire/kinesitherapeute/${payload}`);
  await page.waitForLoadState("networkidle");
  expect(alerted).toBe(false);
  for (const block of await page.locator('script[type="application/ld+json"]').allTextContents()) {
    expect(block).not.toContain("</script>");
    expect(() => JSON.parse(block)).not.toThrow();
  }
});

test("Traceurs Klientys absents avant consentement", async ({ page }) => {
  const trackers: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("googletagmanager.com") || u.includes("connect.facebook.net")) trackers.push(u);
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(trackers).toEqual([]);
});
