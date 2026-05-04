/**
 * Universal widget loader — saas-embed
 * Usage: <script src="https://your-app.com/embed.js" async></script>
 * Then place anywhere in your page:
 *   <div data-saas-widget="chatbot" data-saas-slug="your-slug"></div>
 *   <div data-saas-widget="book"    data-saas-slug="your-slug"></div>
 *   <div data-saas-widget="contact" data-saas-slug="your-slug"></div>
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
    book:    { path: "/embed/book/",    defaultW: "100%",  defaultH: "600px", fixed: false },
    contact: { path: "/embed/contact/", defaultW: "100%",  defaultH: "480px", fixed: false },
  };

  function initWidget(el) {
    var type = el.getAttribute("data-saas-widget");
    var slug = el.getAttribute("data-saas-slug");
    if (!type || !slug || !WIDGETS[type]) return;
    if (el.getAttribute("data-saas-init")) return; // prevent double-init
    el.setAttribute("data-saas-init", "1");

    var cfg = WIDGETS[type];
    var src = origin + cfg.path + encodeURIComponent(slug);

    var iframe = document.createElement("iframe");
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

  // Observe future elements (SPA / dynamic pages)
  if (typeof MutationObserver !== "undefined") {
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.getAttribute && node.getAttribute("data-saas-widget")) initWidget(node);
          if (node.querySelectorAll) node.querySelectorAll("[data-saas-widget]").forEach(initWidget);
        });
      });
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }
})();
