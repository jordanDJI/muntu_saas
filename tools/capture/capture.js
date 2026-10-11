#!/usr/bin/env node
/**
 * Capture les ecrans produit Klientys pour la pub motion design.
 *
 *   node capture.js                 -> toutes les etapes, dans l'ordre
 *   node capture.js dash agenda     -> seulement ces etapes
 *   node capture.js --show          -> navigateur visible (debug)
 *
 * L'etape `booking` cree un VRAI rendez-vous en attente dans le tenant cible :
 * c'est voulu, c'est ce qui produit la paire agenda-avant / agenda-apres.
 * A ne lancer que sur un tenant de demo.
 */

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT = __dirname;
const CFG_PATH = path.join(ROOT, "capture.config.json");

if (!fs.existsSync(CFG_PATH)) {
  console.error(
    "capture.config.json manquant.\n" +
      "  cp capture.config.example.json capture.config.json\n" +
      "puis renseigne email / password / tenantSlug."
  );
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(CFG_PATH, "utf8"));
const OUT = path.resolve(ROOT, cfg.outDir || "../../ad/assets");
const SESSION = path.join(ROOT, ".session.json");

const argv = process.argv.slice(2);
const SHOW = argv.includes("--show");
const WANTED = argv.filter((a) => !a.startsWith("--"));

// Date du creneau reserve, renseignee par l'etape `booking`,
// utilisee par l'etape `agenda2` pour amener le calendrier sur la bonne semaine.
let bookedDate = null;

// ── Utilitaires ───────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(...a) {
  console.log(...a);
}

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // semaine commencant le lundi, comme le calendrier du dashboard
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

async function preflight() {
  for (const [label, url] of [
    ["frontend", cfg.appUrl],
    ["backend", `${cfg.apiUrl}/docs`],
  ]) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      throw new Error(
        `${label} injoignable sur ${url} (${e.message}). ` +
          `Lance les deux serveurs avant la capture : les creneaux de reservation ` +
          `viennent du backend.`
      );
    }
  }
}

/** Fenetre + densite de pixels. */
async function setDevice(page, kind) {
  const d = kind === "mobile" ? cfg.mobile : cfg.desktop;
  await page.setViewport({
    width: d.width,
    height: d.height,
    deviceScaleFactor: d.scale,
    isMobile: kind === "mobile",
    hasTouch: kind === "mobile",
  });
}

/** Attend que la page soit visuellement stable. */
async function settle(page, extra = 500) {
  try {
    await page.evaluate(() => document.fonts && document.fonts.ready);
  } catch {}
  try {
    await page.waitForNetworkIdle({ idleTime: 600, timeout: 15000 });
  } catch {}
  await sleep(extra);
}

/** Masque le mobilier d'interface qui n'a rien a faire dans une pub. */
async function hideChrome(page) {
  const sel = cfg.hideSelectors || [];
  if (!sel.length) return;
  await page.evaluate((list) => {
    for (const s of list) {
      document.querySelectorAll(s).forEach((el) => {
        el.style.setProperty("display", "none", "important");
      });
    }
  }, sel);
}

/**
 * Le site public met `opacity: 0` en inline sur chaque [data-reveal] et attend
 * l'IntersectionObserver. Sur une capture pleine page, tout ce qui est sous la
 * ligne de flottaison resterait invisible.
 */
async function forceReveal(page) {
  await page.evaluate(() => {
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
      el.style.transition = "none";
    });
  });
}

/** Declenche le lazy-loading des images puis revient en haut. */
async function autoScroll(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await sleep(500);
}

async function go(page, pathname) {
  const url = pathname.startsWith("http") ? pathname : `${cfg.appUrl}${pathname}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
}

async function shot(page, name, { el = null, fullPage = false } = {}) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.png`);
  const target = el || page;
  await target.screenshot({ path: file, fullPage: el ? undefined : fullPage });
  const kb = Math.round(fs.statSync(file).size / 1024);
  log(`  ✓ ${name}.png  (${kb} ko)`);
}

/** Resout un ElementHandle depuis une fonction executee dans la page. */
async function findIn(page, fn, ...args) {
  const handle = await page.evaluateHandle(fn, ...args);
  const el = handle.asElement();
  if (!el) await handle.dispose();
  return el;
}

// ── Session ───────────────────────────────────────────────────────────────────

async function saveSession(browser, page) {
  const cookies = browser.cookies ? await browser.cookies() : await page.cookies();
  fs.writeFileSync(SESSION, JSON.stringify(cookies, null, 2));
}

async function restoreSession(browser, page) {
  if (!fs.existsSync(SESSION)) return false;
  try {
    const cookies = JSON.parse(fs.readFileSync(SESSION, "utf8"));
    if (!cookies.length) return false;
    if (browser.setCookie) await browser.setCookie(...cookies);
    else await page.setCookie(...cookies);
    return true;
  } catch {
    return false;
  }
}

async function login(page, browser) {
  await go(page, "/login");
  const pwd = await page.waitForSelector('input[type="password"]', { timeout: 30000 });
  const email = await findIn(
    page,
    (el) => el.closest("form").querySelector('input[type="email"]'),
    pwd
  );
  if (!email) throw new Error("Champ email du formulaire de connexion introuvable.");

  await email.type(cfg.email, { delay: 15 });
  await pwd.type(cfg.password, { delay: 15 });
  await page.evaluate(
    (el) => el.closest("form").querySelector('button[type="submit"]').click(),
    pwd
  );

  try {
    await page.waitForFunction(
      () => location.pathname.startsWith("/dashboard"),
      { timeout: 45000 }
    );
  } catch {
    const msg = await page
      .evaluate(() => document.body.innerText.slice(0, 400))
      .catch(() => "");
    throw new Error(`Connexion echouee. Contenu de la page :\n${msg}`);
  }
  await saveSession(browser, page);
  log("  · session enregistree dans .session.json");
}

/**
 * Le dashboard ne rend pas sa navigation quand l'abonnement est `trial_expired` :
 * un overlay plein ecran prend toute la place. C'est le piege n°1 de cette capture.
 */
async function waitDashboard(page) {
  try {
    await page.waitForSelector("#nav-dashboard", { timeout: 25000 });
  } catch {
    const expired = await page
      .evaluate(() => /essai|abonnement|plan/i.test(document.body.innerText))
      .catch(() => false);
    throw new Error(
      "Le dashboard ne s'est pas rendu." +
        (expired
          ? "\nCause probable : le tenant est en `trial_expired`, un overlay bloquant" +
            " masque toute l'interface.\nCorrige-le dans /admin/tenants/<id> ->" +
            " « Activer gratuitement », puis relance."
          : "\nVerifie que le compte a bien un membership sur un tenant.")
    );
  }
  await hideChrome(page);
}

// ── Etapes ────────────────────────────────────────────────────────────────────

const STEPS = {
  /** dash.png — le plan « tout est la » */
  async dash(page) {
    await setDevice(page, "desktop");
    await go(page, "/dashboard");
    await waitDashboard(page);
    await page.waitForSelector("#dash-kpis", { timeout: 20000 }).catch(() => {});
    await settle(page, 900);
    await hideChrome(page);
    await shot(page, "dash");
  },

  /** contacts.png — le plan CRM */
  async contacts(page) {
    await setDevice(page, "desktop");
    await go(page, "/dashboard/contacts");
    await waitDashboard(page);
    await settle(page, 900);
    await hideChrome(page);
    await shot(page, "contacts");
  },

  /** agenda-avant.png — l'etat AVANT la reservation */
  async agenda(page) {
    await setDevice(page, "desktop");
    await go(page, "/dashboard/appointments");
    await waitDashboard(page);
    await page.waitForSelector("#appts-calendar", { timeout: 20000 });
    await selectAgendaView(page, "week");
    await settle(page, 900);
    await hideChrome(page);
    await shot(page, "agenda-avant");
  },

  /** analytics.png — le plan preuve */
  async analytics(page) {
    await setDevice(page, "desktop");
    await go(page, "/dashboard/analytics");
    await waitDashboard(page);
    await page.waitForSelector("#analytics-kpis", { timeout: 20000 }).catch(() => {});
    // la carte « potentiel de demande » interroge Google Trends : elle est lente
    await settle(page, 3500);
    await hideChrome(page);
    await shot(page, "analytics");
    const gated = await page.evaluate(() =>
      /passer au plan|debloquer|upgrade/i.test(document.body.innerText)
    );
    if (gated) {
      log(
        "  ! la page affiche un ecran d'upgrade — le plan du tenant n'inclut pas" +
          " `analytics`. Active la feature via /admin/tenants/<id> -> overrides."
      );
    }
  },

  /** site-public.png + site-public-hero.png — le livrable vu par le client final */
  async site(page) {
    await setDevice(page, "desktop");
    await go(page, `/${cfg.tenantSlug}`);
    await page.waitForSelector("#hero", { timeout: 30000 });
    await autoScroll(page);
    await forceReveal(page);
    await settle(page, 800);
    await shot(page, "site-public-hero");
    await shot(page, "site-public", { fullPage: true });
  },

  /**
   * booking-creneau.png + booking-form.png + booking-confirme.png
   * Cree un vrai RDV en attente — c'est la source de `agenda-apres`.
   */
  async booking(page) {
    await setDevice(page, "desktop");
    await go(page, `/${cfg.tenantSlug}`);
    await page.waitForSelector("#contact", { timeout: 30000 });
    await forceReveal(page);

    // Bascule sur l'onglet reservation. « Envoyer un message » est un libelle
    // code en dur : c'est l'ancre la plus stable pour trouver le couple d'onglets.
    const bookBtn = await findIn(page, () => {
      const msg = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent.trim() === "Envoyer un message"
      );
      if (!msg || !msg.parentElement) return null;
      return msg.parentElement.querySelectorAll("button")[1] || null;
    });
    if (!bookBtn) {
      throw new Error(
        "Onglet de reservation introuvable. Le site n'a peut-etre pas de calendrier" +
          " actif (verifie les disponibilites du tenant)."
      );
    }
    await bookBtn.click();

    // Choix du jour : le premier jour ouvrable, en avancant jusqu'a 3 mois.
    let day = null;
    for (let month = 0; month < 3 && !day; month++) {
      await sleep(1600); // chargement de /booking/{slug}/available-days
      day = await findIn(page, () => {
        for (const g of document.querySelectorAll(".grid-cols-7")) {
          const b = g.querySelector("button:not([disabled])");
          if (b) return b;
        }
        return null;
      });
      if (!day && month < 2) {
        const next = await findIn(page, () =>
          Array.from(document.querySelectorAll("button")).find(
            (b) => b.textContent.trim() === "▶"
          ) || null
        );
        if (!next) break;
        await next.click();
      }
    }
    if (!day) {
      throw new Error(
        "Aucun jour disponible dans les 3 prochains mois. Ouvre des plages dans" +
          " /dashboard/appointments -> Disponibilites."
      );
    }
    // seul le numero du jour est lisible sur le bouton ; le mois est deduit
    // plus bas par `agenda2` (jour anterieur a aujourd'hui => mois suivant).
    bookedDate = { day: await day.evaluate((el) => parseInt(el.textContent.trim(), 10)) };
    await day.click();

    // Etape creneaux
    await page.waitForFunction(
      () => !!document.querySelector(".grid-cols-3 button"),
      { timeout: 20000 }
    );
    await settle(page, 700);
    let contact = await page.$("#contact");
    await shot(page, "booking-creneau", { el: contact });

    // Etape formulaire
    const slot = await page.$(".grid-cols-3 button");
    await slot.click();
    await page.waitForSelector('form[data-track-form="appointment"]', { timeout: 20000 });

    const c = cfg.bookingContact || {};
    const fill = async (placeholder, value) => {
      if (!value) return;
      const el = await page.$(`input[placeholder="${placeholder}"]`);
      if (el) await el.type(value, { delay: 10 });
    };
    await fill("Prénom *", c.firstName);
    await fill("Nom *", c.lastName);
    await fill("Email *", c.email);
    await fill("Téléphone", c.phone);
    if (c.message) {
      const ta = await page.$('form[data-track-form="appointment"] textarea');
      if (ta) await ta.type(c.message, { delay: 5 });
    }
    // consentements : premiere case (email)
    const cb = await page.$('form[data-track-form="appointment"] input[type="checkbox"]');
    if (cb) {
      const checked = await cb.evaluate((el) => el.checked);
      if (!checked) await cb.click();
    }
    await settle(page, 400);
    contact = await page.$("#contact");
    await shot(page, "booking-form", { el: contact });

    // Un acompte PayPal actif renvoie vers une 4e etape au lieu de confirmer.
    const label = await page.evaluate(() => {
      const b = document.querySelector(
        'form[data-track-form="appointment"] button[type="submit"]'
      );
      return b ? b.textContent.trim() : "";
    });
    if (/paiement/i.test(label)) {
      log(
        "  ! acompte PayPal actif sur ce site : la soumission mene a l'etape de" +
          " paiement.\n    booking-confirme.png et agenda-apres.png sont ignores." +
          "\n    Desactive le depot (Agenda -> Formulaire -> Paiement) et relance."
      );
      return;
    }

    await page.click('form[data-track-form="appointment"] button[type="submit"]');
    await page.waitForFunction(
      () => /Demande re.ue|Message envoy/i.test(document.body.innerText),
      { timeout: 30000 }
    );
    await settle(page, 600);
    contact = await page.$("#contact");
    await shot(page, "booking-confirme", { el: contact });
    log(`  · RDV en attente cree (jour ${bookedDate.day})`);
  },

  /** agenda-apres.png — le meme agenda, avec la demande qui vient d'arriver */
  async agenda2(page) {
    await setDevice(page, "desktop");
    await go(page, "/dashboard/appointments");
    await waitDashboard(page);
    await page.waitForSelector("#appts-calendar", { timeout: 20000 });
    await selectAgendaView(page, "week");

    // Amene le calendrier sur la semaine du creneau reserve, si on la connait.
    if (bookedDate && bookedDate.day) {
      const target = new Date();
      if (bookedDate.day < target.getDate()) target.setMonth(target.getMonth() + 1);
      target.setDate(bookedDate.day);
      const weeks = Math.round(
        (startOfWeek(target) - startOfWeek(new Date())) / (7 * 864e5)
      );
      for (let i = 0; i < Math.max(0, Math.min(weeks, 10)); i++) {
        await page.evaluate(() =>
          document.querySelectorAll("#appts-nav button")[1].click()
        );
        await sleep(450);
      }
      if (weeks > 0) log(`  · calendrier avance de ${weeks} semaine(s)`);
    }

    await settle(page, 1200);
    await hideChrome(page);
    await shot(page, "agenda-apres");

    const pending = await page.$("#appts-pending");
    if (pending) await shot(page, "agenda-pending", { el: pending });
  },

  /** mobile-dash.png + mobile-site.png */
  async mobile(page) {
    await setDevice(page, "mobile");
    await go(page, "/dashboard");
    await waitDashboard(page);
    await settle(page, 1000);
    await hideChrome(page);
    await shot(page, "mobile-dash");

    await go(page, `/${cfg.tenantSlug}`);
    await page.waitForSelector("#hero", { timeout: 30000 });
    await forceReveal(page);
    await settle(page, 800);
    await shot(page, "mobile-site");
  },
};

const ORDER = [
  "dash",
  "contacts",
  "agenda",
  "analytics",
  "site",
  "booking",
  "agenda2",
  "mobile",
];

/** `#appts-view-toggle` contient les boutons dans l'ordre jour / semaine / mois. */
async function selectAgendaView(page, view) {
  const idx = { day: 0, week: 1, month: 2 }[view];
  await page.evaluate((i) => {
    const btns = document.querySelectorAll("#appts-view-toggle button");
    if (btns[i]) btns[i].click();
  }, idx);
  await sleep(700);
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  await preflight();

  const steps = WANTED.length ? WANTED : ORDER;
  const unknown = steps.filter((s) => !STEPS[s]);
  if (unknown.length) {
    console.error(
      `Etape(s) inconnue(s) : ${unknown.join(", ")}\nDisponibles : ${ORDER.join(", ")}`
    );
    process.exit(1);
  }
  if (steps.includes("agenda2") && !steps.includes("booking")) {
    log(
      "! `agenda2` sans `booking` : la capture montrera l'agenda tel quel," +
        " sans nouvelle demande.\n"
    );
  }

  const browser = await puppeteer.launch({
    headless: SHOW ? false : true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.setBypassCSP(true);
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
    { name: "prefers-color-scheme", value: "light" },
  ]);
  // Consentement cookies pre-refuse : masque la banniere ET empeche GA4 /
  // Meta Pixel de se charger pendant les captures.
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem("klientys_cookie_consent", "refused");
      localStorage.setItem(
        "klientys_cookie_detail",
        JSON.stringify({ analytics: false, marketing: false })
      );
    } catch {}
  });

  try {
    const needsAuth = steps.some((s) =>
      ["dash", "contacts", "agenda", "analytics", "agenda2", "mobile"].includes(s)
    );
    if (needsAuth) {
      await setDevice(page, "desktop");
      const restored = await restoreSession(browser, page);
      let ok = false;
      if (restored) {
        await go(page, "/dashboard");
        ok = await page
          .waitForSelector("#nav-dashboard", { timeout: 12000 })
          .then(() => true)
          .catch(() => false);
        log(ok ? "Session reutilisee." : "Session expiree, reconnexion.");
      }
      if (!ok) await login(page, browser);
    }

    for (const name of steps) {
      log(`\n[${name}]`);
      await STEPS[name](page);
    }

    log(`\nTermine. Fichiers dans ${OUT}`);
  } catch (e) {
    console.error(`\nEchec : ${e.message}`);
    try {
      fs.mkdirSync(OUT, { recursive: true });
      const dbg = path.join(OUT, "_erreur.png");
      await page.screenshot({ path: dbg });
      console.error(`Capture de l'etat au moment de l'erreur : ${dbg}`);
    } catch {}
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
