// The game page's stage: Shard Kingdom's road as the game draws it. Each world's backdrop is the game's own render
// (the road, its structures, the wall and the gun); the crystals on it are drawn here with the game's projection and
// numbers (world/view.gd, entities/enemy.gd, ui/style.gd, data/level_data.gd), each a stack of glass gems from the
// game's own gem renders, fading into the world's fog beyond the range line. It plays by itself; a tap on a gem button
// fires that gem at the closest crystal of its color, as in the game, and a wrong one misses. When a world's crystals
// are all broken, it moves on to the next of the six.
(function () {
  "use strict";
  var canvas = document.getElementById("stage");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var ART = canvas.getAttribute("data-art") || "/images/shard-kingdom/";
  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-gem]"));
  var frame = canvas.parentNode;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- The game's numbers ---
  var W = 720, H = 860; // base units shown: the road down to just below the wall
  var TOWER_Y = 1280 * 0.62, FIELD_TOP = 192, FAR = 0.5;
  var HORIZON = (FIELD_TOP - TOWER_Y * FAR) / (1 - FAR);
  var PLAY_HALF = 236, LANES = 5, ENEMY_R = 18, GEM_R = 12, FLOAT = 1.25, STEP = 1.5, SWAY = 0.9, BULGE = 48;
  var ARRIVE_Z = 0.15, RANGE_Z = 0.7, QUEUE_GAP = 1 / 14, SPEED = 0.085, THROW_EVERY = 2.6;
  var AUTO_Z = 0.42; // playing by itself, it lets crystals come this close first, so the road fills as in a round
  var MUZZLE = { x: 360, y: 614 };
  var COLORS = ["#ff3b5c", "#2f80ff", "#ffb524", "#12c98a", "#a259ff"];
  var NAMES = ["Ruby", "Sapphire", "Topaz", "Emerald", "Amethyst"];
  var WORLDS = [
    { id: "dawn", name: "Dawn", path: [90, 0], fog: "#ffffff", ink: "#2b3440", gems: 3, coin: "#8a6a2c" },
    { id: "mist", name: "Mist", path: [-120, 0], fog: "#f4fbfa", ink: "#22383a", gems: 3, coin: "#8a6a2c" },
    { id: "bloom", name: "Bloom", path: [140, 1.1], fog: "#fff8fb", ink: "#3a2b3a", gems: 4, coin: "#8a6a2c" },
    { id: "ember", name: "Ember", path: [-160, 1.4], fog: "#fff1e2", ink: "#3d2416", gems: 4, coin: "#7a5a1f" },
    { id: "dusk", name: "Dusk", path: [180, 1.9], fog: "#4a4a78", ink: "#f2eeff", gems: 5, coin: "#e0c48a", glow: true },
    { id: "abyss", name: "Abyss", path: [200, 2.4], fog: "#141b3a", ink: "#e6ecff", gems: 5, coin: "#e0c48a", glow: true }
  ];
  var WAVE = 11; // crystals a world

  // --- State ---
  var world = 0, prevWorld = -1, fade = 1, t = 0, last = 0, running = false, visible = true;
  var crystals = [], shots = [], bits = [], words = [];
  var spawned = 0, nextSpawn = 1.2, clearedAt = -1, nextLook = 0.8, userUntil = 0, shake = 0, kPx = 1;
  var images = {}, gemSheet = null, tinted = {};

  function load(src) {
    if (images[src]) return images[src];
    var im = new Image();
    im.decoding = "async";
    im.src = src;
    images[src] = im;
    return im;
  }
  function backdrop(i) { return load(ART + "worlds/" + WORLDS[i].id + ".webp"); }
  gemSheet = load(ART + "art/gems.webp");
  backdrop(0);

  // --- Projection (world/view.gd) ---
  function center(z, w) {
    var p = WORLDS[w].path;
    return p[1] === 0 ? p[0] * z * z : p[0] * z * Math.sin(z * Math.PI * p[1]);
  }
  function project(xw, z, h) {
    var s = 1 / (1 + z);
    return { x: 360 + (xw + center(z, world)) * s, y: HORIZON + (TOWER_Y - HORIZON) * s - (h || 0) * s, s: s };
  }
  function laneX(l) { return -PLAY_HALF + PLAY_HALF * 2 / LANES * (l + 0.5); }
  function shownZ(c) { // never past where the floor meets the drawn wall
    var u = c.xw / 360, d = (BULGE * (1 - u * u) + 10) / (TOWER_Y - HORIZON);
    return Math.max(c.z, d / (1 - d));
  }
  function wallTop(x) { var u = (x - 360) / 360; return TOWER_Y - BULGE * (1 - u * u); }
  function gemHeight(i) { return ENEMY_R * (FLOAT + i * STEP); }
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // A gem from the game's renders, blended toward the world's fog (ui/draw.gd _recolor: its color 0.7 of the way at
  // full fog, and fainter), cached per world, gem and step of fog.
  function gemImage(gem, fogT) {
    var q = Math.round(fogT * 16), key = world + ":" + gem + ":" + q;
    if (tinted[key]) return tinted[key];
    if (!gemSheet.complete || !gemSheet.naturalWidth) return null;
    var cell = gemSheet.naturalHeight, c = document.createElement("canvas");
    c.width = c.height = cell;
    var g = c.getContext("2d");
    g.drawImage(gemSheet, gem * cell, 0, cell, cell, 0, 0, cell, cell);
    if (q > 0) {
      g.globalCompositeOperation = "source-atop";
      g.globalAlpha = q / 16 * 0.7;
      g.fillStyle = WORLDS[world].fog;
      g.fillRect(0, 0, cell, cell);
    }
    tinted[key] = c;
    return c;
  }
  // The sheet's gems are drawn at radius 32 units in 80-unit cells: an image 2.5 radii across.
  function drawGem(gem, x, y, r, fogT, alpha, rot) {
    var im = gemImage(gem, fogT || 0);
    if (!im) return;
    var size = r * 2.5;
    ctx.save();
    ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * (1 - (fogT || 0) * 0.45);
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(im, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  // --- The round ---
  function spawn() {
    var w = WORLDS[world], lane = Math.floor(Math.random() * LANES), z = 1.02;
    for (var i = 0; i < crystals.length; i++) if (crystals[i].lane === lane) z = Math.max(z, crystals[i].z + QUEUE_GAP);
    var hp = Math.random() < 0.35 ? 1 : (Math.random() < 0.6 ? 2 : 3);
    crystals.push({ lane: lane, xw: laneX(lane), z: z, gem: Math.floor(Math.random() * w.gems), hp: hp, value: hp, pending: 0,
      bob: Math.random() * 6, focus: 0, arrived: false, throwT: rand(0.6, 1.6) });
    spawned++;
  }

  function targetFor(gem) { // main.gd find_target(): the closest of its color within range still needing hits
    var best = null;
    for (var i = 0; i < crystals.length; i++) {
      var c = crystals[i];
      if (c.gem === gem && c.z <= RANGE_Z && c.hp - c.pending > 0 && (!best || c.z < best.z)) best = c;
    }
    return best;
  }

  function topOf(c) {
    var p = project(c.xw, shownZ(c));
    return { x: p.x, y: p.y - gemHeight(c.hp - 1) * p.s + Math.sin(t * 2 + c.bob) * 3 * p.s, s: p.s };
  }

  function press(gem, byUser) {
    if (gem >= WORLDS[world].gems) return;
    var c = targetFor(gem);
    var from = { x: MUZZLE.x, y: MUZZLE.y };
    if (c) {
      c.pending++;
      shots.push({ gem: gem, from: from, target: c, t: 0, dur: (0.25 + 0.45 * c.z) * 0.6 });
    } else { // a miss: short of the closest of its color (or up the road), smashing on the road
      var near = null;
      for (var i = 0; i < crystals.length; i++) if (crystals[i].gem === gem && (!near || crystals[i].z < near.z)) near = crystals[i];
      var z = near ? Math.max(0.2, near.z - 0.12) : 0.45, xw = near ? near.xw : laneX(Math.floor(Math.random() * LANES));
      shots.push({ gem: gem, from: from, miss: { xw: xw, z: z }, t: 0, dur: (0.25 + 0.45 * z) * 0.6 });
    }
    if (byUser) userUntil = t + 5;
    wake();
  }

  function burst(x, y, gem, n, s, speed) {
    for (var i = 0; i < n; i++) {
      var a = rand(0, Math.PI * 2), v = rand(0.4, 1) * speed;
      bits.push({ kind: "shard", gem: gem, x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.5,
        rot: rand(0, 6), spin: rand(-9, 9), size: rand(5, 9) * s, life: 0, max: rand(0.5, 0.8) });
    }
  }
  function ring(x, y, r, color, max) { bits.push({ kind: "ring", x: x, y: y, r: r, color: color, life: 0, max: max || 0.45 }); }
  function say(text, x, y, color, size) { words.push({ text: text, x: x, y: y, color: color, size: size || 26, life: 0, max: 0.9 }); }

  function land(s) {
    if (s.miss) {
      var p = project(s.miss.xw, s.miss.z);
      burst(p.x, p.y - 6 * p.s, s.gem, 7, p.s, 260 * p.s);
      say("MISS", p.x, p.y - 40 * p.s, WORLDS[world].ink, 24);
      return;
    }
    var c = s.target;
    c.pending = Math.max(0, c.pending - 1);
    if (crystals.indexOf(c) < 0 || c.hp <= 0) return;
    var top = topOf(c);
    c.hp--;
    if (c.hp > 0) { // the top gem knocked off, tumbling away
      bits.push({ kind: "gem", gem: c.gem, x: top.x, y: top.y, vx: rand(-1, 1) * 160 * top.s, vy: -220 * top.s,
        rot: 0, spin: rand(-8, 8), size: ENEMY_R * top.s, life: 0, max: 0.7, fog: 0 });
      burst(top.x, top.y, c.gem, 5, top.s, 220 * top.s);
      ring(top.x, top.y, ENEMY_R * top.s * 1.6, "rgba(255,255,255,", 0.35);
    } else { // shattered, paying its coins
      burst(top.x, top.y, c.gem, 14, top.s * 1.3, 340 * top.s);
      ring(top.x, top.y, ENEMY_R * top.s * 2.6, "rgba(255,255,255,", 0.5);
      crystals.splice(crystals.indexOf(c), 1);
      say("+" + c.value, top.x, top.y - 24 * top.s, WORLDS[world].coin, 26);
    }
  }

  function autoplay() { // a calm player: the closest crystal still needing hits, once it's come close
    var best = null;
    for (var i = 0; i < crystals.length; i++) {
      var c = crystals[i];
      if (c.z <= RANGE_Z && c.hp - c.pending > 0 && (!best || c.z < best.z)) best = c;
    }
    if (best && (best.z <= AUTO_Z || spawned >= WAVE)) press(best.gem, false);
  }

  function nextWorld() {
    prevWorld = world;
    world = (world + 1) % WORLDS.length;
    fade = 0;
    tinted = {};
    spawned = 0;
    nextSpawn = 1.3;
    clearedAt = -1;
    backdrop((world + 1) % WORLDS.length); // the one after, ahead of time
    showButtons();
  }

  function step(dt) {
    t += dt;
    if (fade < 1) fade = Math.min(1, fade + dt / 0.9);
    // Spawning, a wave a world
    if (spawned < WAVE && fade >= 1) {
      nextSpawn -= dt;
      if (nextSpawn <= 0) { spawn(); nextSpawn = rand(0.55, 1.2); }
    }
    // Crystals march, queue a road tile apart in their lane, stop at the throwing line and throw at the wall
    crystals.sort(function (a, b) { return a.z - b.z; });
    for (var i = 0; i < crystals.length; i++) {
      var c = crystals[i], stop = ARRIVE_Z;
      for (var j = 0; j < i; j++) if (crystals[j].lane === c.lane) stop = Math.max(stop, crystals[j].z + QUEUE_GAP);
      c.z = Math.max(stop, c.z - SPEED * dt);
      c.arrived = c.z <= stop + 1e-6;
      c.focus = Math.max(0, Math.min(1, c.focus + (c.z <= RANGE_Z ? dt : -dt) / 0.35));
      if (c.arrived) {
        c.throwT -= dt;
        if (c.throwT <= 0) {
          c.throwT = THROW_EVERY;
          var top = topOf(c);
          bits.push({ kind: "throw", gem: c.gem, x0: top.x, y0: top.y, x1: top.x * 0.7 + 108, y1: wallTop(top.x * 0.7 + 108) - 6,
            life: 0, max: 0.5, s: top.s });
        }
      }
    }
    // The gun: by itself unless a visitor is playing
    if (t > userUntil) {
      nextLook -= dt;
      if (nextLook <= 0) { autoplay(); nextLook = rand(0.32, 0.55); }
    }
    // Shots in flight
    for (var k = shots.length - 1; k >= 0; k--) {
      var s = shots[k];
      s.t += dt / s.dur;
      if (s.t >= 1) { shots.splice(k, 1); land(s); }
    }
    // Shards, rings, knocked-off gems, words, thrown shards
    for (var b = bits.length - 1; b >= 0; b--) {
      var bit = bits[b];
      bit.life += dt;
      if (bit.kind === "shard" || bit.kind === "gem") {
        bit.vy += 900 * dt * (bit.kind === "gem" ? 1 : 0.7);
        bit.x += bit.vx * dt; bit.y += bit.vy * dt; bit.rot += bit.spin * dt;
      }
      if (bit.kind === "throw" && bit.life >= bit.max) {
        shake = 0.3;
        burst(bit.x1, bit.y1, bit.gem, 6, 0.8, 200);
      }
      if (bit.life >= bit.max) bits.splice(b, 1);
    }
    for (var w = words.length - 1; w >= 0; w--) { words[w].life += dt; if (words[w].life >= words[w].max) words.splice(w, 1); }
    if (shake > 0) shake = Math.max(0, shake - dt);
    // A world cleared: on to the next
    if (spawned >= WAVE && crystals.length === 0 && shots.length === 0) {
      if (clearedAt < 0) clearedAt = t;
      else if (t - clearedAt > 1.1) nextWorld();
    }
  }

  // --- Drawing ---
  function draw() {
    var cw = canvas.width, ch = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    kPx = cw / W;
    var sx = 0, sy = 0;
    if (shake > 0) { var a = shake / 0.3; sx = rand(-5, 5) * a; sy = rand(-3, 3) * a; }
    ctx.setTransform(kPx, 0, 0, kPx, sx * kPx, sy * kPx);
    // The world (and the one it's leaving, fading out)
    var now = backdrop(world);
    if (prevWorld >= 0 && fade < 1) {
      var was = backdrop(prevWorld);
      if (was.complete && was.naturalWidth) ctx.drawImage(was, 0, 0, W, H);
      ctx.globalAlpha = smooth(fade);
    }
    if (now.complete && now.naturalWidth) ctx.drawImage(now, 0, 0, W, H);
    ctx.globalAlpha = 1;
    var appear = smooth(fade);

    // The world's name, as the game's HUD writes it
    ctx.fillStyle = WORLDS[world].ink;
    ctx.globalAlpha = 0.8 * appear;
    ctx.font = "600 22px Outfit, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "4px";
    ctx.fillText(WORLDS[world].name.toUpperCase(), 28, 46);
    ctx.globalAlpha = 0.55 * appear;
    ctx.font = "500 17px Outfit, system-ui, sans-serif";
    ctx.fillText("WORLD " + (world + 1) + " OF 6", 28, 72);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.globalAlpha = 1;

    // The range line: the gun's reach on the road (world/range_line.gd), a faint band across it
    ctx.strokeStyle = WORLDS[world].ink;
    ctx.globalAlpha = 0.18 * appear;
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    for (var u = -1; u <= 1.0001; u += 0.1) {
      var rp = project(u * 300, RANGE_Z);
      if (u === -1) ctx.moveTo(rp.x, rp.y); else ctx.lineTo(rp.x, rp.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Crystals, far to near: a contact shadow, then the stack bottom first
    var order = crystals.slice().sort(function (a, b) { return b.z - a.z; });
    for (var i = 0; i < order.length; i++) {
      var c = order[i], z = shownZ(c), p = project(c.xw, z), r = ENEMY_R * p.s;
      var fog = Math.max(0, Math.min(1, (z - 0.25) / 0.65));
      fog = Math.max(fog, 0.6) + (fog * 0.4 - Math.max(fog, 0.6)) * smooth(c.focus);
      var enter = Math.min(1, (1.06 - c.z) / 0.08); // out of the haze at the far end
      ctx.globalAlpha = 0.16 * enter;
      ctx.fillStyle = WORLDS[world].ink;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * 0.95, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      var bob = Math.sin(t * 2 + c.bob) * 3 * p.s;
      if (WORLDS[world].glow) halo(p.x, p.y - gemHeight((c.hp - 1) / 2) * p.s, r * 2.4 * Math.max(1, c.hp * 0.7), COLORS[c.gem], 0.22 * enter);
      for (var g = 0; g < c.hp; g++) {
        var sway = Math.sin(t * 1.7 + c.bob + g * 0.9) * SWAY * g * p.s;
        drawGem(c.gem, p.x + sway, p.y - gemHeight(g) * p.s + bob, r, fog, enter);
      }
    }

    // Shots: a gem arcing from the gun to its crystal's top gem (or to the road, missing)
    for (var k = 0; k < shots.length; k++) {
      var s = shots[k], to, scale;
      if (s.miss) { var mp = project(s.miss.xw, s.miss.z); to = { x: mp.x, y: mp.y - 6 * mp.s }; scale = mp.s; }
      else { var tp = topOf(s.target); to = tp; scale = tp.s; }
      var e = s.t, x = s.from.x + (to.x - s.from.x) * e, y = s.from.y + (to.y - s.from.y) * e - Math.sin(Math.PI * e) * 70;
      var rr = GEM_R * (1 + (scale - 1) * e);
      drawGem(s.gem, x, y, rr, 0, 1, e * 6);
    }

    // Effects
    for (var b = 0; b < bits.length; b++) {
      var bit = bits[b], life = bit.life / bit.max;
      if (bit.kind === "shard") shard(bit.x, bit.y, bit.size, bit.rot, COLORS[bit.gem], 1 - life);
      else if (bit.kind === "gem") drawGem(bit.gem, bit.x, bit.y, bit.size, 0, 1 - life * life, bit.rot);
      else if (bit.kind === "ring") {
        ctx.strokeStyle = bit.color + (0.8 * (1 - life)).toFixed(3) + ")";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(bit.x, bit.y, bit.r * (0.6 + life * 0.9), 0, Math.PI * 2);
        ctx.stroke();
      } else if (bit.kind === "throw") {
        var tx = bit.x0 + (bit.x1 - bit.x0) * life, ty = bit.y0 + (bit.y1 - bit.y0) * life - Math.sin(Math.PI * life) * 90 * bit.s;
        shard(tx, ty, 7 + 3 * life, life * 9, COLORS[bit.gem], 1);
      }
    }
    ctx.textAlign = "center";
    for (var w = 0; w < words.length; w++) {
      var word = words[w], wl = word.life / word.max;
      ctx.globalAlpha = 1 - wl * wl;
      ctx.fillStyle = word.color;
      ctx.font = "700 " + word.size + "px Outfit, system-ui, sans-serif";
      ctx.fillText(word.text, word.x, word.y - wl * 46);
    }
    ctx.globalAlpha = 1;
  }

  function shard(x, y, size, rot, color, alpha) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.62, size * 0.55);
    ctx.lineTo(-size * 0.5, size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.8);
    ctx.lineTo(size * 0.18, size * 0.1);
    ctx.lineTo(-size * 0.14, size * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function halo(x, y, r, color, alpha) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color + "80");
    g.addColorStop(1, color + "00");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  // --- The loop, only while the stage is on screen and the page is showing ---
  function frameLoop(ms) {
    if (!running) return;
    var dt = last ? Math.min(0.05, (ms - last) / 1000) : 0;
    last = ms;
    step(dt);
    draw();
    if (reduce && t > userUntil && shots.length === 0 && bits.length === 0) { running = false; return; }
    requestAnimationFrame(frameLoop);
  }
  function wake() {
    if (running || !visible || document.hidden) return;
    running = true;
    last = 0;
    requestAnimationFrame(frameLoop);
  }
  function sleep() { running = false; }

  function resize() {
    var r = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.width * H / W * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    draw();
  }

  function showButtons() {
    var n = WORLDS[world].gems;
    buttons.forEach(function (b) {
      var on = +b.getAttribute("data-gem") < n;
      b.hidden = !on;
    });
  }

  buttons.forEach(function (b) {
    var gem = +b.getAttribute("data-gem");
    var fire = function () {
      b.classList.remove("pressed");
      void b.offsetWidth;
      b.classList.add("pressed");
      press(gem, true);
    };
    b.addEventListener("pointerdown", function (e) { if (e.button === 0 || e.pointerType !== "mouse") { e.preventDefault(); fire(); } });
    b.addEventListener("click", function (e) { if (e.detail === 0) fire(); }); // the keyboard
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) wake(); else sleep();
    }, { threshold: 0.05 }).observe(frame);
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden) sleep(); else wake(); });
  window.addEventListener("resize", resize);

  // A first look: a few crystals already on the road, then it plays
  for (var i = 0; i < 4; i++) { spawn(); crystals[crystals.length - 1].z = 0.95 - i * 0.16; }
  showButtons();
  frame.classList.add("live");
  var ready = function () { resize(); if (!reduce) wake(); else { step(0); draw(); } };
  if (gemSheet.complete) ready(); else gemSheet.addEventListener("load", ready);
  backdrop(0).addEventListener("load", function () { draw(); });
  backdrop(1);
  if (document.fonts && document.fonts.load) document.fonts.load("600 22px Outfit").then(draw, function () {});
})();
