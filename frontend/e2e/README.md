# Tests de bout en bout (Playwright)

```bash
cd frontend
npx playwright install chromium     # une fois
npm run dev                         # dans un autre terminal
npm run test:e2e
```

| Fichier | Base requise | Ce qui est vérifié |
|---|---|---|
| `security-regressions.spec.ts` | non | JSON-LD non injectable (KLT-1420), aucun traceur avant consentement |
| `booking.spec.ts` | oui | Formulaire du site et widget `book` d'un tenant de recette |

Variables : `E2E_BASE_URL` (défaut `http://localhost:3000`), `E2E_TENANT_SLUG`
(tenant de **recette**, jamais un tenant réel : les parcours peuvent créer des RDV).
