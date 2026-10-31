/**
 * Universal widget loader — saas-embed
 * Usage: <script src="https://your-app.com/embed.js" async></script>
 * Then place anywhere in your page:
 *   <div data-saas-widget="chatbot" data-saas-slug="your-slug"></div>
 *   <div data-saas-widget="book"    data-saas-slug="your-slug"></div>
 *   <div data-saas-widget="contact" data-saas-slug="your-slug"></div>
 *
 * Langue (optionnelle) : data-saas-lang="fr" | "en" | "de" | "nl" | "auto"
 *   - un code fixe la langue du widget ;
 *   - "auto" suit l'attribut lang de <html> du site hôte, y compris quand un
 *     sélecteur de langue le modifie après le chargement ;
 *   - absent → français.
 * Modifier l'attribut à chaud traduit le widget sans le recharger.
 *
 * Intégration : data-saas-integration="int_xxxxxxxxxxxx" (fourni par le
 * dashboard) rattache les leads et RDV à ce support. Le domaine de la page est
 * transmis pour la détection ; un ancien code sans identifiant est rattaché
 * automatiquement à une intégration nommée d'après le domaine.
 * Une intégration désactivée est masquée par le serveur, même si le code reste.
 */
(function () {
  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  var origin = (function () {
    try {
      var src = script.getAttribute("src") || "";
      var url = new URL(src, window.location.href);
      return url.origin;
    } catch (e) {
      return window.location.origin;
    }
  })();

  var WIDGETS = {
    chatbot: { path: "/embed/chatbot/", defaultW: "60px", defaultH: "60px", fixed: true },
    // Hauteurs du formulaire du site Klientys (consentement RGPD, questions
    // personnalisées, acompte) — plus haut que les anciens widgets simplifiés.
    book:    { path: "/embed/book/",    defaultW: "100%",  defaultH: "720px", fixed: false },
    contact: { path: "/embed/contact/", defaultW: "100%",  defaultH: "620px", fixed: false },
  };

  var LANGS = ["fr", "en", "de", "nl"];

  function normLang(value) {
    var code = String(value || "").trim().toLowerCase().slice(0, 2);
    return LANGS.indexOf(code) >= 0 ? code : null;
  }

  function resolveLang(el) {
    var attr = String(el.getAttribute("data-saas-lang") || "").trim().toLowerCase();
    if (attr === "auto") return normLang(document.documentElement.getAttribute("lang")) || "fr";
    return normLang(attr) || "fr";
  }

  // Widgets initialisés : { el, iframe, lang }
  var mounted = [];

  function sendLang(entry) {
    if (!entry.iframe.contentWindow) return;
    entry.iframe.contentWindow.postMessage({ type: "saas-set-lang", lang: entry.lang }, origin);
  }

  function syncLangs() {
    mounted.forEach(function (entry) {
      var lang = resolveLang(entry.el);
      if (lang === entry.lang) return;
      entry.lang = lang;
      sendLang(entry);
    });
  }

  function initWidget(el) {
    var type = el.getAttribute("data-saas-widget");
    var slug = el.getAttribute("data-saas-slug");
    if (!type || !slug || !WIDGETS[type]) return;
    if (el.getAttribute("data-saas-init")) return; // prevent double-init
    el.setAttribute("data-saas-init", "1");

    var cfg = WIDGETS[type];
    var lang = resolveLang(el);
    var src = origin + cfg.path + encodeURIComponent(slug) + "?lang=" + lang
      + "&host=" + encodeURIComponent(window.location.hostname);
    var integration = el.getAttribute("data-saas-integration");
    if (integration) src += "&integration=" + encodeURIComponent(integration);

    var iframe = document.createElement("iframe");
    mounted.push({ el: el, iframe: iframe, lang: lang });
    iframe.src = src;
    iframe.frameBorder = "0";
    iframe.scrolling = "no";
    iframe.allow = "clipboard-write";
    iframe.setAttribute("data-saas-type", type);

    if (cfg.fixed) {
      // Chatbot: injected as fixed overlay
      iframe.style.cssText = [
        "position:fixed",
        "bottom:24px",
        "right:24px",
        "width:" + cfg.defaultW,
        "height:" + cfg.defaultH,
        "border:none",
        "z-index:2147483647",
        "border-radius:50%",
        "box-shadow:0 4px 20px rgba(0,0,0,.15)",
        "transition:width .3s,height .3s,border-radius .3s",
        "background:transparent",
        "overflow:hidden",
      ].join(";");
      document.body.appendChild(iframe);
    } else {
      // Inline widgets: replace the placeholder div
      iframe.style.cssText = [
        "width:" + cfg.defaultW,
        "height:" + cfg.defaultH,
        "border:none",
        "border-radius:16px",
        "box-shadow:0 2px 16px rgba(0,0,0,.08)",
        "overflow:hidden",
        "display:block",
      ].join(";");
      el.style.display = "block";
      el.appendChild(iframe);
    }
  }

  // Un widget prêt réclame la langue courante : celle-ci a pu changer entre
  // la création de l'iframe et son chargement (message envoyé dans le vide).
  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !e.data || e.data.type !== "saas-widget-ready") return;
    mounted.forEach(function (entry) {
      if (entry.iframe.contentWindow === e.source) sendLang(entry);
    });
  });

  // Intégration désactivée (ou chatbot incomplet) : le widget demande à être
  // masqué. On retire l'iframe de la mise en page, pas seulement son contenu,
  // pour ne pas laisser un cadre vide sur le site du client.
  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !e.data || e.data.type !== "saas-widget-hide") return;
    mounted.forEach(function (entry) {
      if (entry.iframe.contentWindow !== e.source) return;
      entry.iframe.style.display = "none";
      if (!WIDGETS[entry.el.getAttribute("data-saas-widget")].fixed) entry.el.style.display = "none";
    });
  });

  // Listen for chatbot resize messages
  window.addEventListener("message", function (e) {
    if (!e.data || e.data.type !== "saas-chatbot-resize") return;
    var iframes = document.querySelectorAll("iframe[data-saas-type='chatbot']");
    iframes.forEach(function (iframe) {
      iframe.style.width = e.data.w || "60px";
      iframe.style.height = e.data.h || "60px";
      iframe.style.borderRadius = e.data.r || "50%";
    });
  });

  // Init all widgets already in DOM
  function initAll() {
    document.querySelectorAll("[data-saas-widget]").forEach(initWidget);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  // Observe future elements (SPA / dynamic pages) and language changes
  if (typeof MutationObserver !== "undefined") {
    var observer = new MutationObserver(function (mutations) {
      var langChanged = false;
      mutations.forEach(function (mutation) {
        if (mutation.type === "attributes") { langChanged = true; return; }
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.getAttribute && node.getAttribute("data-saas-widget")) initWidget(node);
          if (node.querySelectorAll) node.querySelectorAll("[data-saas-widget]").forEach(initWidget);
        });
      });
      if (langChanged) syncLangs();
    });
    observer.observe(document.body || document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["data-saas-lang"],
    });
    // <html lang> n'est pas dans le sous-arbre de <body> : observé à part, pour "auto"
    new MutationObserver(syncLangs).observe(document.documentElement, {
      attributes: true, attributeFilter: ["lang"],
    });
  }
})();
