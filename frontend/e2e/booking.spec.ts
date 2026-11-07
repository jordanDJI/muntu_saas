import { expect, test } from "@playwright/test";

// Parcours de réservation publique sur un tenant de recette SANS acompte.
// E2E_TENANT_SLUG doit désigner un site publié avec des créneaux ouverts.
const slug = process.env.E2E_TENANT_SLUG;

test.describe("réservation publique", () => {
  test.skip(!slug, "E2E_TENANT_SLUG non défini");

  test("le site public affiche le formulaire de rendez-vous", async ({ page }) => {
    await page.goto(`/${slug}#rdv`);
    await expect(page.locator("form").first()).toBeVisible();
  });

  test("le widget book se charge dans une page tierce", async ({ page }) => {
    await page.goto(`/embed/book/${slug}`);
    await expect(page.locator("form").first()).toBeVisible();
  });
});
