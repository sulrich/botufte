// botufte theme — vanilla js, no build step.
// stage 1: theme toggle, back-to-top, mobile menu. search/toc/copy added later.
(function () {
  "use strict";

  // ---- dark / light toggle ----
  function initThemeToggle() {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var isDark = document.body.getAttribute("theme") === "dark";
      if (isDark) {
        document.body.removeAttribute("theme");
        localStorage.setItem("theme", "light");
      } else {
        document.body.setAttribute("theme", "dark");
        localStorage.setItem("theme", "dark");
      }
    });
  }

  // ---- back to top ----
  function initBackToTop() {
    var btn = document.getElementById("back-to-top");
    if (!btn) return;
    function onScroll() {
      if (window.scrollY > 300) btn.classList.add("show");
      else btn.classList.remove("show");
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    // defer the initial scrollY read to the next frame so it doesn't force a
    // synchronous layout while the defer scripts are still running (reflow).
    requestAnimationFrame(onScroll);
  }

  // ---- mobile menu ----
  function initMenu() {
    var toggle = document.getElementById("menu-toggle");
    var header = document.querySelector(".header");
    if (!toggle || !header) return;
    toggle.addEventListener("click", function () {
      header.classList.toggle("menu-open");
    });
    // on small screens, tapping a parent with children opens its submenu
    document.querySelectorAll(".menu .has-children > a").forEach(function (a) {
      a.addEventListener("click", function (e) {
        if (window.matchMedia("(max-width: 680px)").matches) {
          e.preventDefault();
          a.parentElement.classList.toggle("open");
        }
      });
    });
  }

  // ---- footnotes -> tufte sidenotes ----
  function initFootnotes() {
    var content = document.getElementById("content");
    if (!content) return;
    var block = content.querySelector(".footnotes");
    if (!block) return;

    var refs = content.querySelectorAll('sup[id^="fnref"]');
    refs.forEach(function (sup) {
      var anchor = sup.querySelector("a");
      if (!anchor) return;
      var num = anchor.textContent.trim();
      var href = anchor.getAttribute("href") || ""; // "#fn:1"
      // ids contain a colon (fn:1) which breaks #id selectors — match by attribute
      var targetId = href.charAt(0) === "#" ? href.slice(1) : href;
      var li = targetId ? block.querySelector('[id="' + targetId + '"]') : null;
      if (!li) return;

      // pull the note html, minus the back-reference link
      var clone = li.cloneNode(true);
      clone.querySelectorAll(".footnote-backref").forEach(function (b) { b.remove(); });
      var html = clone.innerHTML.trim();

      var id = "fnsn-" + num;
      var label = document.createElement("label");
      label.className = "margin-toggle";
      label.setAttribute("for", id);
      label.innerHTML = "<sup>" + num + "</sup>";

      var input = document.createElement("input");
      input.type = "checkbox";
      input.className = "margin-toggle";
      input.id = id;

      var span = document.createElement("span");
      span.className = "sidenote no-counter";
      span.innerHTML = "<sup class='sidenote-num'>" + num + "</sup> " + html;

      var parent = sup.parentNode;
      parent.insertBefore(label, sup);
      parent.insertBefore(input, sup);
      parent.insertBefore(span, sup);
      parent.removeChild(sup);
    });

    block.style.display = "none";
  }

  // ---- copy button on code blocks ----
  function initCodeCopy() {
    document.querySelectorAll(".highlight").forEach(function (block) {
      var btn = document.createElement("button");
      btn.className = "code-copy";
      btn.type = "button";
      btn.textContent = "copy";
      btn.addEventListener("click", function () {
        // with line numbers, code lives in the last table cell; else in <pre>
        var codeCell = block.querySelector("td:last-child pre") || block.querySelector("pre");
        var text = codeCell ? codeCell.innerText : "";
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = "copied";
          setTimeout(function () { btn.textContent = "copy"; }, 1500);
        });
      });
      block.appendChild(btn);
    });
  }

  // ---- search (lunr, lazy-loaded on first open) ----
  function initSearch() {
    var wrap = document.querySelector(".search");
    if (!wrap) return;
    var openBtn = document.getElementById("search-open");
    var panel = document.getElementById("search-panel");
    var input = document.getElementById("search-input");
    var results = document.getElementById("search-results");
    if (!openBtn || !panel || !input || !results) return;

    var maxResults = parseInt(wrap.getAttribute("data-max"), 10) || 10;
    var snippetLen = parseInt(wrap.getAttribute("data-snippet"), 10) || 100;
    var idx = null, docs = {}, loading = false;

    function loadScript(src) {
      return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    function build() {
      if (idx || loading) return Promise.resolve();
      loading = true;
      var lunrSrc = wrap.getAttribute("data-lunr");
      var indexSrc = wrap.getAttribute("data-index");
      return loadScript(lunrSrc)
        .then(function () { return fetch(indexSrc); })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          idx = lunr(function () {
            this.ref("ref");
            this.field("title", { boost: 10 });
            this.field("tags", { boost: 5 });
            this.field("content");
            data.forEach(function (d) {
              docs[d.ref] = d;
              this.add({ ref: d.ref, title: d.title, tags: (d.tags || []).join(" "), content: d.content });
            }, this);
          });
        });
    }

    function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

    function snippet(text, terms) {
      var lower = text.toLowerCase();
      var at = -1;
      terms.forEach(function (t) { if (at < 0) at = lower.indexOf(t.toLowerCase()); });
      if (at < 0) at = 0;
      var start = Math.max(0, at - 30);
      var frag = text.slice(start, start + snippetLen);
      frag = esc(frag);
      terms.forEach(function (t) {
        if (!t) return;
        frag = frag.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<em>$1</em>");
      });
      return (start > 0 ? "…" : "") + frag + "…";
    }

    function render(q) {
      results.innerHTML = "";
      q = q.trim();
      if (!q || !idx) return;
      var terms = q.split(/\s+/);
      var hits;
      try { hits = idx.search(q + " " + q + "*"); }
      catch (e) { hits = idx.search(q); }
      if (!hits.length) { results.innerHTML = '<li class="search-empty">no results</li>'; return; }
      hits.slice(0, maxResults).forEach(function (h) {
        var d = docs[h.ref];
        if (!d) return;
        var li = document.createElement("li");
        li.innerHTML =
          '<a href="' + d.ref + '">' +
          '<div class="result-title">' + esc(d.title) + "</div>" +
          '<div class="result-meta">' + esc(d.section) + " · " + esc(d.date || "") + "</div>" +
          '<div class="result-snippet">' + snippet(d.content || "", terms) + "</div>" +
          "</a>";
        results.appendChild(li);
      });
    }

    function open() {
      panel.hidden = false;
      build().then(function () { input.focus(); if (input.value) render(input.value); });
      input.focus();
    }
    function close() { panel.hidden = true; }

    openBtn.addEventListener("click", function () { panel.hidden ? open() : close(); });
    input.addEventListener("input", function () { render(input.value); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) close();
    });
  }

  // ---- toc scrollspy (left rail) ----
  function initToc() {
    var rail = document.querySelector(".toc-rail");
    var content = document.getElementById("content");
    if (!rail || !content || !("IntersectionObserver" in window)) return;

    var links = {};
    rail.querySelectorAll('a[href^="#"]').forEach(function (a) {
      links[decodeURIComponent(a.getAttribute("href").slice(1))] = a;
    });
    var headings = content.querySelectorAll("h2[id], h3[id], h4[id]");
    if (!headings.length) return;

    var current = null;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var link = links[e.target.id];
        if (!link) return;
        if (e.isIntersecting) {
          if (current) current.classList.remove("active");
          link.classList.add("active");
          current = link;
        }
      });
    }, { rootMargin: "-10% 0px -80% 0px", threshold: 0 });

    headings.forEach(function (h) { obs.observe(h); });
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    initThemeToggle();
    initBackToTop();
    initMenu();
    initFootnotes();
    initToc();
    initCodeCopy();
    initSearch();
  });
})();
