/* SHRM TRIVIA NIGHT - "draw yourself" pad for the phone.
   Mounts a square canvas with a palette, brush sizes, eraser, undo and clear.
   Exports a small transparent PNG (data URL) the host shows next to your name. */
(function () {
  "use strict";

  var COLORS = [
    { c: "#F3EEE3", n: "Cream" }, { c: "#0B1142", n: "Navy ink" }, { c: "#1C1C1C", n: "Black" },
    { c: "#F5B32A", n: "Gold" }, { c: "#A896EA", n: "Lavender" }, { c: "#9BD1FF", n: "Sky" },
    { c: "#F26A42", n: "Melon" }, { c: "#5CC98A", n: "Green" }, { c: "#F28FB1", n: "Pink" },
    { c: "#8C5A3C", n: "Brown" }, { c: "#C98A5C", n: "Caramel" }, { c: "#E7C39F", n: "Tan" },
    { c: "#FFE0C4", n: "Peach" }, { c: "#4A2C17", n: "Espresso" }
  ];
  var SIZES = [4, 9, 18];
  var SIZE = 320;       // internal pixels
  var EXPORT = 160;     // what gets sent to the host

  function mount(container, opts) {
    opts = opts || {};
    var color = opts.color || "#F3EEE3", size = SIZES[1], eraser = false;
    var undo = [], drawing = false, last = null, strokes = 0;

    container.innerHTML =
      '<div class="pad-wrap">' +
        '<canvas class="pad" width="' + SIZE + '" height="' + SIZE + '"></canvas>' +
        '<div class="pad-hint">draw yourself here</div>' +
      '</div>' +
      '<div class="pad-tools">' +
        '<div class="pad-colors">' + COLORS.map(function (k, i) {
          return '<button type="button" class="swatch' + (k.c === color ? " on" : "") + '" data-i="' + i +
            '" style="--c:' + k.c + '" title="' + k.n + '" aria-label="' + k.n + '"></button>';
        }).join("") + '</div>' +
        '<div class="pad-row">' +
          '<div class="pad-sizes">' + SIZES.map(function (s, i) {
            return '<button type="button" class="szbtn' + (s === size ? " on" : "") + '" data-i="' + i +
              '" aria-label="Brush ' + s + '"><i style="width:' + (6 + i * 6) + 'px;height:' + (6 + i * 6) + 'px"></i></button>';
          }).join("") + '</div>' +
          '<button type="button" class="padbtn" data-act="eraser">Eraser</button>' +
          '<button type="button" class="padbtn" data-act="undo">Undo</button>' +
          '<button type="button" class="padbtn" data-act="clear">Clear</button>' +
        '</div>' +
      '</div>';

    var canvas = container.querySelector(".pad");
    var hint = container.querySelector(".pad-hint");
    var ctx = canvas.getContext("2d");
    ctx.lineCap = "round"; ctx.lineJoin = "round";

    function pos(e) {
      var r = canvas.getBoundingClientRect();
      var p = e.touches ? e.touches[0] : e;
      return { x: (p.clientX - r.left) / r.width * SIZE, y: (p.clientY - r.top) / r.height * SIZE };
    }
    function stroke(a, b) {
      ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
      ctx.strokeStyle = color; ctx.lineWidth = size * (eraser ? 2 : 1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    function dot(a) {
      ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(a.x, a.y, size * (eraser ? 2 : 1) / 2, 0, Math.PI * 2); ctx.fill();
    }
    function down(e) {
      e.preventDefault();
      drawing = true; last = pos(e);
      undo.push(ctx.getImageData(0, 0, SIZE, SIZE)); if (undo.length > 24) undo.shift();
      dot(last); strokes++;
      hint.classList.add("off");
    }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pos(e); stroke(last, p); last = p;
    }
    function up() { drawing = false; last = null; }

    if (window.PointerEvent) {
      canvas.addEventListener("pointerdown", function (e) { canvas.setPointerCapture(e.pointerId); down(e); });
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);
    } else {
      canvas.addEventListener("touchstart", down, { passive: false });
      canvas.addEventListener("touchmove", move, { passive: false });
      canvas.addEventListener("touchend", up);
      canvas.addEventListener("mousedown", down);
      canvas.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    }

    container.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.classList.contains("swatch")) {
        color = COLORS[+b.dataset.i].c; eraser = false;
        container.querySelectorAll(".swatch").forEach(function (s) { s.classList.toggle("on", s === b); });
        container.querySelector('[data-act="eraser"]').classList.remove("on");
      } else if (b.classList.contains("szbtn")) {
        size = SIZES[+b.dataset.i];
        container.querySelectorAll(".szbtn").forEach(function (s) { s.classList.toggle("on", s === b); });
      } else if (b.dataset.act === "eraser") {
        eraser = !eraser; b.classList.toggle("on", eraser);
      } else if (b.dataset.act === "undo") {
        var im = undo.pop(); if (im) { ctx.putImageData(im, 0, 0); strokes = Math.max(0, strokes - 1); }
        if (!strokes) hint.classList.remove("off");
      } else if (b.dataset.act === "clear") {
        undo.push(ctx.getImageData(0, 0, SIZE, SIZE));
        ctx.clearRect(0, 0, SIZE, SIZE); strokes = 0; hint.classList.remove("off");
      }
    });

    return {
      isEmpty: function () { return strokes === 0; },
      toDataURL: function () {
        var out = document.createElement("canvas");
        out.width = EXPORT; out.height = EXPORT;
        var oc = out.getContext("2d");
        oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = "high";
        oc.drawImage(canvas, 0, 0, EXPORT, EXPORT);
        return out.toDataURL("image/png");
      },
      load: function (dataURL) {
        var im = new Image();
        im.onload = function () { ctx.globalCompositeOperation = "source-over"; ctx.drawImage(im, 0, 0, SIZE, SIZE); strokes = 1; hint.classList.add("off"); };
        im.src = dataURL;
      }
    };
  }

  /* Procedural doodle face for bots / tests, so a test lobby looks like a real one. */
  function randomFace(seed) {
    var c = document.createElement("canvas"); c.width = EXPORT; c.height = EXPORT;
    var x = c.getContext("2d");
    var r = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    var skins = ["#E7C39F", "#C98A5C", "#8C5A3C", "#FFE0C4", "#4A2C17"], hairs = ["#1C1C1C", "#4A2C17", "#F5B32A", "#A896EA", "#F26A42"];
    x.lineCap = "round"; x.lineJoin = "round";
    x.strokeStyle = skins[(r() * skins.length) | 0]; x.lineWidth = 7;
    x.beginPath(); x.arc(80, 86, 44 + r() * 8, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = hairs[(r() * hairs.length) | 0]; x.lineWidth = 9;
    x.beginPath();
    for (var i = 0; i < 6; i++) { var a = Math.PI + i * 0.55 + r() * 0.2; x.moveTo(80 + Math.cos(a) * 46, 86 + Math.sin(a) * 46); x.lineTo(80 + Math.cos(a) * (62 + r() * 14), 86 + Math.sin(a) * (62 + r() * 14)); }
    x.stroke();
    x.strokeStyle = "#F3EEE3"; x.lineWidth = 6;
    x.beginPath(); x.arc(64, 80, 3, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(96, 80, 3, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(80, 94, 16, 0.2 + r() * 0.3, Math.PI - 0.2 - r() * 0.3); x.stroke();
    return c.toDataURL("image/png");
  }

  window.AVATAR = { mount: mount, randomFace: randomFace, COLORS: COLORS };
})();
