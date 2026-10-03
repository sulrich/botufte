// botufte trip reports + strava cards. vanilla js, no build step.
// loaded only on pages that set .Store "hasTrip" (see baseof.html), after leaflet
// and photoswipe. reads:
//   #map-config  tile source (params.maps)
//   #trip-data   places, days, photos for a trip report (absent on plain pages)
// see docs/trip-reports.md.
(function () {
  "use strict";
  if (!window.L) return;

  // ---------------------------------------------------------------- helpers
  function readJSON(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { console.error("trip.js: bad #" + id, e); return null; }
  }
  var cfg = readJSON("map-config") || {};
  var data = readJSON("trip-data");

  // theme tokens live on body (body[theme="dark"]), so read them from there
  function css(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  var DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  function fmtDate(iso) {
    var d = new Date(iso + "T12:00:00");
    return DOW[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()];
  }

  // google/strava encoded polyline -> [[lat, lng], ...]
  function decodePolyline(str) {
    var i = 0, lat = 0, lng = 0, out = [];
    while (i < str.length) {
      for (var k = 0; k < 2; k++) {
        var r = 0, sh = 0, b;
        do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
        var v = (r & 1) ? ~(r >> 1) : (r >> 1);
        if (k === 0) lat += v; else lng += v;
      }
      out.push([lat / 1e5, lng / 1e5]);
    }
    return out;
  }

  function hav(a, b) {
    var R = 6371, r = Math.PI / 180;
    var dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
    var h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.pow(Math.sin(dLon / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function pathKm(pts) { var s = 0; for (var i = 1; i < pts.length; i++) s += hav(pts[i - 1], pts[i]); return s; }
  function fmtDist(km, mode) {
    return (mode === "sail" || mode === "ferry") ? Math.round(km / 1.852) + " nm" : km.toFixed(1) + " km";
  }

  // ---------------------------------------------------------------- map plumbing
  var styled = []; // [layer, fn() -> style], re-applied when the theme flips
  function addStyled(layer, fn, map) { layer.setStyle(fn()); styled.push([layer, fn]); layer.addTo(map); return layer; }

  function legStyle(mode, weight) {
    weight = weight || 2.5;
    return function () {
      switch (mode) {
        case "sail":  return { color: css("--map-sail"), weight: weight, dashArray: "6 5" };
        case "ferry": return { color: css("--map-sail"), weight: weight - 0.5, dashArray: "1 5", lineCap: "round" };
        case "hike":  return { color: css("--map-hike"), weight: weight };
        case "walk":  return { color: css("--map-hike"), weight: weight - 0.5 };
        default:      return { color: css("--map-rail"), weight: weight - 0.5 }; // train, drive, ...
      }
    };
  }

  function baseMap(el, opts) {
    // a provisional view so layers can be added before fitBounds
    // whole zoom levels keep raster tiles crisp (fractional zoom stretches them)
    var map = L.map(el, Object.assign({ center: [0, 0], zoom: 2, scrollWheelZoom: false }, opts || {}));
    if (map.attributionControl) map.attributionControl.setPrefix(false);
    if (cfg.tileURL) {
      L.tileLayer(cfg.tileURL, { maxZoom: cfg.maxZoom || 18, attribution: cfg.attribution || "" }).addTo(map);
    }
    return map;
  }

  function photoPin(p, map, onClick, tip) {
    var icon = L.divIcon({ className: "", html: '<div class="photo-pin' + (p.featured ? " featured" : "") + '"></div>', iconSize: [8, 8], iconAnchor: [4, 4] });
    var m = L.marker([p.lat, p.lon], { icon: icon, keyboard: false }).addTo(map);
    if (tip !== false) {
      m.bindTooltip('<img src="' + esc(p.thumb) + '" alt=""><div>' + esc(p.title || p.id) + "</div>", { className: "map-tip photo-tip", direction: "top", offset: [0, -6] });
    }
    if (onClick) m.on("click", function () { onClick(p.id); });
    return m;
  }

  // ---------------------------------------------------------------- lightbox
  var gallery = [];
  var openPhoto = function () {};
  if (data && data.photos && data.photos.length && window.PhotoSwipeLightbox) {
    gallery = data.photos.map(function (p) {
      return { src: p.full, width: p.w || 1600, height: p.h || 1067, alt: p.title || p.id, msrc: p.thumb, photo: p };
    });
    var lightbox = new PhotoSwipeLightbox({
      pswpModule: window.PhotoSwipe, bgOpacity: 1, showHideAnimationType: "fade",
      padding: { top: 20, bottom: 110, left: 16, right: 16 },
    });
    lightbox.on("uiRegister", function () {
      lightbox.pswp.ui.registerElement({
        name: "trip-caption", order: 9, isButton: false, appendTo: "root",
        onInit: function (el, pswp) {
          el.className = "pswp-trip-caption";
          var set = function () {
            var p = pswp.currSlide.data.photo;
            var meta = [fmtDate(p.day) + (p.time ? " " + p.time : ""), p.camera].filter(Boolean).map(esc).join(" &middot; ");
            el.innerHTML = '<div class="inner">' + (p.title ? "<b>" + esc(p.title) + "</b>" : "") +
              (p.caption ? (p.title ? " - " : "") + p.caption : "") + '<div class="meta">' + meta + "</div></div>";
          };
          pswp.on("change", set);
          set();
        },
      });
    });
    lightbox.init();
    openPhoto = function (id) {
      var i = gallery.findIndex(function (g) { return g.photo.id === id; });
      if (i >= 0) lightbox.loadAndOpen(i, gallery);
    };
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-photo]");
      if (b) { e.preventDefault(); openPhoto(b.dataset.photo); }
    });
  }

  // ---------------------------------------------------------------- trip report
  var places = {}, legsByDay = {};
  if (data) {
    places = data.places || {};
    // hugo serializes an empty route/mode list as null
    data.days = (data.days || []).map(function (d) {
      return Object.assign({}, d, { route: d.route || [], modes: d.modes || [], strava: d.strava || [] });
    });
    var photos = data.photos || [];
    var withGps = photos.filter(function (p) { return p.lat != null && p.lon != null; });
    var ll = function (k) { return [places[k].lat, places[k].lon]; };

    // places without coords: average of the last few gps photos on the arrival day
    Object.keys(places).forEach(function (k) {
      var pl = places[k];
      if (pl.lat != null) return;
      var day = data.days.find(function (d) { return d.route.length && d.route[d.route.length - 1] === k; });
      var pts = day ? withGps.filter(function (p) { return p.day === day.date; }).slice(-3) : [];
      if (!pts.length) { console.warn("trip.js: no position for place " + k); return; }
      pl.lat = pts.reduce(function (s, p) { return s + p.lat; }, 0) / pts.length;
      pl.lon = pts.reduce(function (s, p) { return s + p.lon; }, 0) / pts.length;
      pl.derived = true;
    });

    // legs per day: strava routes, photo tracks, or straight lines between places
    data.days.forEach(function (d) {
      var legs = [];
      if (d.track === "strava") {
        (d.strava || []).forEach(function (s, i) {
          var pts = decodePolyline(s.polyline || "");
          if (pts.length) legs.push({ mode: d.modes[i] || "walk", pts: pts, km: s.km, date: d.date });
        });
      } else {
        var dayPts = withGps.filter(function (p) { return p.day === d.date; }).map(function (p) { return [p.lat, p.lon]; });
        for (var i = 0; i < d.route.length - 1; i++) {
          var a = d.route[i], b = d.route[i + 1];
          if (places[a].lat == null || places[b].lat == null) continue;
          var pts = [ll(a), ll(b)];
          if (d.track === "photos" && d.route.length === 2) pts = [ll(a)].concat(dayPts, [ll(b)]);
          legs.push({ mode: d.modes[i], pts: pts, from: a, to: b, date: d.date, index: i });
        }
      }
      legsByDay[d.date] = legs;
    });

    // distances in the day margins
    document.querySelectorAll(".leg-dist").forEach(function (el) {
      var leg = (legsByDay[el.dataset.day] || []).find(function (l) { return String(l.index) === el.dataset.leg; });
      if (leg) el.textContent = fmtDist(leg.km || pathKm(leg.pts), leg.mode);
    });
    var sailKm = 0;
    Object.keys(legsByDay).forEach(function (k) {
      legsByDay[k].forEach(function (l) { if (l.mode === "sail") sailKm += l.km || pathKm(l.pts); });
    });
    var sailEl = document.querySelector(".trip-sail");
    if (sailEl && sailKm > 0) { sailEl.textContent = " · ~" + Math.round(sailKm / 1.852) + " nm under sail"; sailEl.hidden = false; }

    function scrollToDay(date) {
      var el = document.getElementById("d-" + date.replace(/-/g, ""));
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }

    function placeMarker(k, map, labels) {
      var pl = places[k];
      if (!pl || pl.kind === "waypoint" || pl.lat == null) return null;
      var r = { city: 4.5, port: 4, anchorage: 3.5, trail: 3.5 }[pl.kind] || 4;
      var m = addStyled(L.circleMarker([pl.lat, pl.lon], { radius: r }), function () {
        return {
          color: pl.kind === "trail" ? css("--map-hike") : css("--map-dot"), weight: 1.5,
          fillColor: pl.kind === "city" ? css("--map-dot") : css("--bg"), fillOpacity: 1,
        };
      }, map);
      if (labels) {
        var minor = pl.kind === "anchorage" || pl.kind === "trail";
        m.bindTooltip(esc(pl.name || k), { permanent: true, direction: "right", offset: [4, 0], className: "place-label" + (minor ? " minor" : "") });
      }
      return m;
    }

    // overview
    var ovEl = document.getElementById("trip-map");
    if (ovEl) {
      var ov = baseMap(ovEl);
      var bounds = L.latLngBounds([]);
      data.days.forEach(function (d) {
        legsByDay[d.date].forEach(function (l) {
          var line = addStyled(L.polyline(l.pts), legStyle(l.mode), ov);
          var what = l.from ? esc(places[l.from].name) + " -> " + esc(places[l.to].name) : esc(d.title);
          line.bindTooltip(fmtDate(d.date) + " &middot; " + what + " &middot; " + esc(l.mode), { sticky: true, className: "map-tip" });
          line.on("click", function () { scrollToDay(d.date); });
          bounds.extend(line.getBounds());
        });
      });
      var used = {};
      data.days.forEach(function (d) { d.route.forEach(function (k) { used[k] = true; }); });
      Object.keys(used).forEach(function (k) {
        var m = placeMarker(k, ov, true);
        if (!m) return;
        bounds.extend(m.getLatLng());
        m.on("click", function () {
          var d = data.days.find(function (x) { return x.hasNotes && x.route.indexOf(k) >= 0; }) ||
                  data.days.find(function (x) { return x.route.indexOf(k) >= 0; });
          if (d) scrollToDay(d.date);
        });
      });
      withGps.filter(function (p) { return p.featured; }).forEach(function (p) { photoPin(p, ov, openPhoto); });
      var fitAll = function () { if (bounds.isValid()) ov.fitBounds(bounds, { padding: [24, 24] }); };
      fitAll();

      // optional extra views (front matter mapViews: [{name, bounds: [[s, w], [n, e]]}])
      var buttons = document.querySelectorAll(".trip-map-tools [data-view]");
      buttons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var v = btn.dataset.view;
          if (v === "all") fitAll(); else ov.fitBounds(data.views[+v].bounds, { padding: [10, 10] });
          buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        });
      });
    }

    // a small map of each written-up day, in its margin
    document.querySelectorAll(".trip-minimap").forEach(function (el) {
      var date = el.dataset.day;
      var day = data.days.find(function (d) { return d.date === date; });
      if (!day) return;
      var map = baseMap(el, {
        zoomControl: false, dragging: false, doubleClickZoom: false, boxZoom: false,
        keyboard: false, touchZoom: false, attributionControl: false,
      });
      var b = L.latLngBounds([]);
      legsByDay[date].forEach(function (l) { b.extend(addStyled(L.polyline(l.pts), legStyle(l.mode, 2), map).getBounds()); });
      day.route.forEach(function (k) { var m = placeMarker(k, map, false); if (m) b.extend(m.getLatLng()); });
      withGps.filter(function (p) { return p.day === date; }).forEach(function (p) {
        b.extend(photoPin(p, map, openPhoto, false).getLatLng());
      });
      if (!b.isValid()) { el.hidden = true; return; }
      if (b.getNorthEast().distanceTo(b.getSouthWest()) < 300) map.setView(b.getCenter(), 15);
      else map.fitBounds(b, { padding: [10, 10], maxZoom: 16 });
    });

    // day rail: highlight the day in view
    var railLinks = Array.prototype.slice.call(document.querySelectorAll(".trip-rail a"));
    if (railLinks.length && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          railLinks.forEach(function (a) { a.classList.toggle("active", a.dataset.day === e.target.id); });
        });
      }, { rootMargin: "-10% 0px -80% 0px" });
      document.querySelectorAll(".trip-day").forEach(function (s) { io.observe(s); });
    }
  }

  // ---------------------------------------------------------------- strava cards (any page)
  document.querySelectorAll(".strava-card-map").forEach(function (el) {
    var pts = decodePolyline(el.dataset.polyline || "");
    if (!pts.length) { el.hidden = true; return; }
    var map = baseMap(el);
    var line = addStyled(L.polyline(pts), function () { return { color: css("--map-hike"), weight: 3 }; }, map);
    addStyled(L.circleMarker(pts[0], { radius: 5 }), function () {
      return { color: css("--bg"), weight: 1.5, fillColor: css("--map-start"), fillOpacity: 1 };
    }, map).bindTooltip("start");
    addStyled(L.circleMarker(pts[pts.length - 1], { radius: 5 }), function () {
      return { color: css("--bg"), weight: 1.5, fillColor: css("--map-finish"), fillOpacity: 1 };
    }, map).bindTooltip("finish");
    if (data && data.photos) {
      data.photos.filter(function (p) { return p.day === el.dataset.day && p.lat != null; })
        .forEach(function (p) { photoPin(p, map, openPhoto); });
    }
    map.fitBounds(line.getBounds(), { padding: [18, 18] });
  });

  // ---------------------------------------------------------------- theme flips
  new MutationObserver(function () {
    styled.forEach(function (s) { s[0].setStyle(s[1]()); });
  }).observe(document.body, { attributes: true, attributeFilter: ["theme"] });
})();
