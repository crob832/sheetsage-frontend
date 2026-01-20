(function () {
  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function initMobileNav() {
    var button = document.getElementById("mobileMenuButton");
    var menu = document.getElementById("mobileMenu");
    var overlay = document.getElementById("mobileMenuOverlay");
    if (!button || !menu) return;

    var lastFocused = null;

    function setOpen(isOpen) {
      menu.classList.toggle("hidden", !isOpen);
      if (overlay) overlay.classList.toggle("hidden", !isOpen);
      button.setAttribute("aria-expanded", String(isOpen));

      if (isOpen) {
        lastFocused = document.activeElement;
        document.body.classList.add("ss-scroll-locked");
        var firstLink = menu.querySelector("a");
        if (firstLink && typeof firstLink.focus === "function") {
          firstLink.focus();
        }
        return;
      }

      document.body.classList.remove("ss-scroll-locked");
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
        lastFocused = null;
      } else {
        button.focus();
      }
    }

    button.addEventListener("click", function () {
      var isOpen = button.getAttribute("aria-expanded") === "true";
      setOpen(!isOpen);
    });

    menu.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || target.tagName !== "A") return;
      setOpen(false);
    });

    if (overlay) {
      overlay.addEventListener("click", function () {
        setOpen(false);
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      setOpen(false);
    });

    if (typeof window.matchMedia === "function") {
      var mql = window.matchMedia("(min-width: 768px)");
      mql.addEventListener("change", function (event) {
        if (!event.matches) return;
        setOpen(false);
      });
    }
  }

  function initDynamicYear() {
    var year = String(new Date().getFullYear());
    var nodes = document.querySelectorAll("[data-year]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = year;
    }
  }

  function initIcons() {
    if (typeof window.lucide === "undefined" || !window.lucide || !window.lucide.createIcons) return;
    window.lucide.createIcons();
  }

  function initToc() {
    var tocTargets = document.querySelectorAll("[data-toc]");
    if (!tocTargets || tocTargets.length === 0) return;

    var contentRoot = document.querySelector("[data-toc-content]");
    if (!contentRoot) return;

    var headings = contentRoot.querySelectorAll("h2, h3");
    if (!headings || headings.length === 0) return;

    var usedIds = {};
    var items = [];

    for (var i = 0; i < headings.length; i++) {
      var heading = headings[i];
      var level = heading.tagName === "H3" ? 3 : 2;
      var title = (heading.textContent || "").trim();
      if (!title) continue;

      var id = heading.getAttribute("id");
      if (!id) {
        id = slugify(title);
        if (!id) continue;

        var uniqueId = id;
        var counter = 2;
        while (document.getElementById(uniqueId) || usedIds[uniqueId]) {
          uniqueId = id + "-" + counter;
          counter += 1;
        }
        id = uniqueId;
        heading.setAttribute("id", id);
      }

      usedIds[id] = true;
      items.push({ id: id, title: title, level: level });
    }

    function buildList() {
      var ul = document.createElement("ul");
      ul.className = "space-y-1";

      for (var j = 0; j < items.length; j++) {
        var item = items[j];
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#" + item.id;
        a.textContent = item.title;
        a.className =
          item.level === 3
            ? "block pl-4 text-sm text-slate-500 hover:text-emerald-700 transition leading-snug py-1"
            : "block text-sm text-slate-600 hover:text-emerald-700 font-medium transition leading-snug py-1";
        li.appendChild(a);
        ul.appendChild(li);
      }

      return ul;
    }

    for (var t = 0; t < tocTargets.length; t++) {
      var target = tocTargets[t];
      while (target.firstChild) target.removeChild(target.firstChild);

      var label = target.getAttribute("data-toc-label") || "Table of contents";
      target.setAttribute("aria-label", label);
      target.appendChild(buildList());
    }
  }

  function initStickyCta() {
    var cta = document.querySelector("[data-sticky-cta]");
    if (!cta) return;

    var storageKey = "ssStickyCtaDismissed:v1";
    try {
      if (window.sessionStorage && window.sessionStorage.getItem(storageKey) === "1") {
        return;
      }
    } catch (e) {
      // Ignore storage errors (privacy modes, disabled storage).
    }

    var dismissBtn = cta.querySelector("[data-sticky-cta-dismiss]");
    var isShown = false;

    function setShown(next) {
      if (isShown === next) return;
      isShown = next;
      cta.classList.toggle("hidden", !next);
      cta.setAttribute("aria-hidden", next ? "false" : "true");
    }

    function update() {
      var doc = document.documentElement;
      var maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      var progress = (window.scrollY || window.pageYOffset || 0) / maxScroll;
      setShown(progress >= 0.2);
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();

    if (dismissBtn) {
      dismissBtn.addEventListener("click", function () {
        setShown(false);
        try {
          if (window.sessionStorage) window.sessionStorage.setItem(storageKey, "1");
        } catch (e) {
          // Ignore storage errors.
        }
      });
    }
  }

  function init() {
    initMobileNav();
    initDynamicYear();
    initIcons();
    initToc();
    initStickyCta();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
