(function () {
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

  function init() {
    initMobileNav();
    initDynamicYear();
    initIcons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
