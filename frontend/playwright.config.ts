import { defineConfig, devices } from "@playwright/test";

// Tests de bout en bout (KLT-1929). Lancer l'application d'abord
// (`npm run dev` ou `npm run build && npm start`), puis `npm run test:e2e`.
// Les parcours qui écrivent en base ne tournent qu'avec un tenant de recette :
// voir e2e/README.md.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
