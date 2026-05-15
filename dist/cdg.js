const e = {
  VRAM_HEIGHT: 216,
  // Height of VRAM, in pixels.
  VISIBLE_WIDTH: 288,
  // Width (or pitch) of visible screen, in pixels.
  VISIBLE_HEIGHT: 192,
  // Height of visible screen, in pixels.
  FONT_WIDTH: 6,
  // Width of one "font" (or block).
  FONT_HEIGHT: 12,
  // Height of one "font" (or block).
  NUM_X_FONTS: 50,
  // Number of horizontal fonts contained in VRAM.
  NUM_Y_FONTS: 18,
  // Number of vertical fonts contained in VRAM.
  VISIBLE_X_FONTS: 48,
  // Number of visible horizontal font columns.
  VISIBLE_Y_FONTS: 16,
  // Number of visible vertical font rows.
  PALETTE_ENTRIES: 16,
  // Number of CLUT palette entries.
  CLUT_ENTRIES: 8,
  // Number of palette entries per LOAD_CLUT instruction.
  PACK_SIZE: 24,
  // Size of one CDG data pack, in bytes.
  PACKS_PER_SECOND: 300,
  // CD+G standard pack rate.
  TV_GRAPHICS: 9,
  // 50x18 (48x16) 16 color TV graphics mode.
  MEMORY_PRESET: 1,
  // Set all VRAM to palette index.
  BORDER_PRESET: 2,
  // Set border to palette index.
  LOAD_CLUT_LO: 30,
  // Load Color Look Up Table index 0 through 7.
  LOAD_CLUT_HI: 31,
  // Load Color Look Up Table index 8 through 15.
  COPY_FONT: 6,
  // Copy 12x6 pixel font to screen.
  XOR_FONT: 38,
  // XOR 12x6 pixel font with existing VRAM values.
  SCROLL_PRESET: 20,
  // Update scroll offset, copying if 0x20 or 0x10.
  SCROLL_COPY: 24
  // Update scroll offset, setting color if 0x20 or 0x10.
};
function z(A, g) {
  const Y = g, R = A.getContext("2d"), h = R.createImageData(
    e.VISIBLE_WIDTH,
    e.VISIBLE_HEIGHT
  ), I = new Array(e.PALETTE_ENTRIES), S = new Array(e.NUM_X_FONTS * e.VRAM_HEIGHT);
  let i = 0, m = 0, O = !1, F = !1;
  const C = new Array(e.NUM_X_FONTS * e.NUM_Y_FONTS);
  function D() {
    m = 0, i = 0, X(), p(0), M();
  }
  function U() {
    return m;
  }
  function V() {
    if ((O || F) && (Y.style.backgroundColor = w(i), O = !1), F)
      G(), F = !1, M(), R.putImageData(h, 0, 0);
    else {
      const t = R, a = h, f = C, n = e.FONT_WIDTH, o = e.FONT_HEIGHT;
      let r = 0;
      for (let s = 1; s <= e.VISIBLE_Y_FONTS; ++s) {
        r = s * e.NUM_X_FONTS + 1;
        for (let T = 1; T <= e.VISIBLE_X_FONTS; ++T)
          f[r] && (v(T, s), t.putImageData(
            a,
            0,
            0,
            (T - 1) * n,
            (s - 1) * o,
            n,
            o
          ), f[r] = 0), ++r;
      }
    }
  }
  function b(t, a) {
    for (let f = m; f < a; f++) {
      const n = f * e.PACK_SIZE;
      if ((t.charCodeAt(n) & 63) == e.TV_GRAPHICS) {
        const r = t.slice(
          n,
          n + e.PACK_SIZE
        );
        switch (r.charCodeAt(1) & 63) {
          case e.MEMORY_PRESET:
            W(r);
            break;
          case e.BORDER_PRESET:
            B(r);
            break;
          case e.LOAD_CLUT_LO:
          case e.LOAD_CLUT_HI:
            l(r);
            break;
          case e.COPY_FONT:
          case e.XOR_FONT:
            c(r);
            break;
          case e.SCROLL_PRESET:
          case e.SCROLL_COPY:
            u(r);
            break;
        }
      }
    }
    m = a;
  }
  function w(t) {
    return "rgb(" + (I[t] >> 16 & 255) + "," + (I[t] >> 8 & 255) + "," + (I[t] >> 0 & 255) + ")";
  }
  function L(t) {
    let a = t;
    return a |= t << 4, a |= t << 8, a |= t << 12, a |= t << 16, a |= t << 20, a;
  }
  function M() {
    for (let t = 0; t < e.NUM_X_FONTS * e.NUM_Y_FONTS; t++)
      C[t] = 0;
  }
  function X() {
    const t = e.PALETTE_ENTRIES;
    for (let a = 0; a < t; a++)
      I[a] = 0;
  }
  function p(t) {
    const a = S, f = a.length, n = L(t);
    for (let o = 0; o < f; o++)
      a[o] = n;
    F = !0;
  }
  function H(t, a, f, n) {
    for (const o of [0, 4, 8, 12, 16, 20]) {
      const r = f[n >> o & 15];
      t[a++] = r >> 16 & 255, t[a++] = r >> 8 & 255, t[a++] = r & 255, t[a++] = 255;
    }
    return a;
  }
  function G() {
    const t = h.data, a = I, f = S;
    let n = e.NUM_X_FONTS * e.FONT_HEIGHT + 1, o = 0;
    for (let r = 0; r < e.VISIBLE_HEIGHT; ++r) {
      for (let s = 0; s < e.VISIBLE_X_FONTS; ++s)
        o = H(
          t,
          o,
          a,
          f[n++]
        );
      n += e.NUM_X_FONTS - e.VISIBLE_X_FONTS;
    }
  }
  function v(t, a) {
    const f = h.data, n = I, o = S;
    let r = a * e.NUM_X_FONTS * e.FONT_HEIGHT + t;
    const s = e.NUM_X_FONTS, T = r + e.NUM_X_FONTS * e.FONT_HEIGHT;
    let d = (a - 1) * e.FONT_HEIGHT * e.VISIBLE_WIDTH;
    d += (t - 1) * e.FONT_WIDTH, d *= 4;
    const N = (e.VISIBLE_WIDTH - e.FONT_WIDTH) * 4;
    for (; r < T; )
      d = H(
        f,
        d,
        n,
        o[r]
      ), r += s, d += N;
  }
  function B(t) {
    const a = t.charCodeAt(4) & 63;
    I[a] != I[i] && (O = !0), i = a;
  }
  function W(t) {
    p(t.charCodeAt(4) & 63);
  }
  function l(t) {
    const a = I, f = (t.charCodeAt(1) & 1) * e.CLUT_ENTRIES;
    for (let n = 0; n < e.CLUT_ENTRIES; n++) {
      const o = n + f;
      let r = 0, s = 0;
      s = (t.charCodeAt(n * 2 + 4) & 60) >> 2, r |= s * 17 << 16, s = (t.charCodeAt(n * 2 + 4) & 3) << 2 | (t.charCodeAt(n * 2 + 5) & 48) >> 4, r |= s * 17 << 8, s = t.charCodeAt(n * 2 + 5) & 15, r |= s * 17 << 0, r != a[o] && (a[o] = r, F = !0, o == i && (O = !0));
    }
  }
  function c(t) {
    const a = S, f = C, n = 3, o = (t.charCodeAt(4) & 48) >> 2 | (t.charCodeAt(5) & 48) >> 4, r = t.charCodeAt(1) & 32;
    if (n >> o) {
      const s = t.charCodeAt(7) & 63, T = t.charCodeAt(6) & 31;
      if (s < e.NUM_X_FONTS && T < e.NUM_Y_FONTS) {
        const d = T * e.NUM_X_FONTS * e.FONT_HEIGHT + s, N = [
          t.charCodeAt(4) & 15,
          t.charCodeAt(5) & 15
        ];
        let _ = 0, P = 0;
        for (let y = 0; y < e.FONT_HEIGHT; y++) {
          const K = y * e.NUM_X_FONTS + d;
          _ = t.charCodeAt(y + 8), P = N[_ >> 5 & 1] << 0, P |= N[_ >> 4 & 1] << 4, P |= N[_ >> 3 & 1] << 8, P |= N[_ >> 2 & 1] << 12, P |= N[_ >> 1 & 1] << 16, P |= N[_ >> 0 & 1] << 20, r ? a[K] ^= P : a[K] = P;
        }
        f[T * e.NUM_X_FONTS + s] = 1;
      }
    }
  }
  function u(t) {
    let a;
    const f = (t.charCodeAt(1) & 8) >> 3, n = t.charCodeAt(4) & 15;
    (a = (t.charCodeAt(5) & 48) >> 4) && E(a, f, n), (a = (t.charCodeAt(6) & 48) >> 4) && x(a, f, n), F = !0;
  }
  function E(t, a, f) {
    let n, o, r, s = 0;
    const T = L(f), d = S, N = e.NUM_X_FONTS * e.VRAM_HEIGHT;
    if (t == 2)
      for (o = 0; o < N; o += e.NUM_X_FONTS) {
        for (r = o, s = d[r], n = r + 1; n < r + e.NUM_X_FONTS; n++)
          d[n - 1] = d[n];
        a ? d[r + e.NUM_X_FONTS - 1] = s : d[r + e.NUM_X_FONTS - 1] = T;
      }
    else if (t == 1)
      for (o = 0; o < N; o += e.NUM_X_FONTS) {
        for (r = o, s = d[r + e.NUM_X_FONTS - 1], n = r + e.NUM_X_FONTS - 2; n >= r; n--)
          d[n + 1] = d[n];
        a ? d[r] = s : d[r] = T;
      }
  }
  function x(t, a, f) {
    let n, o;
    const r = e.NUM_X_FONTS * e.FONT_HEIGHT, s = e.NUM_X_FONTS * e.VRAM_HEIGHT, T = e.NUM_X_FONTS * (e.VRAM_HEIGHT - e.FONT_HEIGHT), d = new Array(r), N = L(f), _ = S;
    if (t == 2) {
      for (n = 0, o = 0; o < r; o++)
        d[n++] = _[o];
      for (n = 0, o = r; o < s; o++)
        _[n++] = _[o];
      if (n = T, a)
        for (o = 0; o < r; o++)
          _[n++] = d[o];
      else
        for (o = 0; o < r; o++)
          _[n++] = N;
    } else if (t == 1) {
      for (n = 0, o = T; o < s; o++)
        d[n++] = _[o];
      for (o = T - 1; o > 0; o--)
        _[o + r] = _[o];
      if (a)
        for (o = 0; o < r; o++)
          _[o] = d[o];
      else
        for (o = 0; o < r; o++)
          _[o] = N;
    }
  }
  this.getCurrentPack = U, this.resetCdgState = D, this.redrawCanvas = V, this.decodePacks = b, this.resetCdgState();
}
function j(A, g) {
  const h = {
    mediaPath: "",
    audioFormat: "mp3",
    cdgFileExtension: "cdg"
  }, I = {
    mp3: 'audio/mpeg; codecs="mp3"',
    ogg: 'audio/ogg; codecs="vorbis"'
  }, S = {};
  let i = null, m = null, O = null, F = null, C = null;
  async function D(l) {
    const c = G(l);
    H(), C.resetCdgState(), C.redrawCanvas(), F = null, m == null && (m = document.createElement("source")), m.type = I[c.audioFormat], m.src = c.mediaPath + c.audioFilePrefix + "." + c.audioFormat, i.appendChild(m), i.load();
    try {
      const u = c.mediaPath + c.cdgFilePrefix + "." + c.cdgFileExtension, E = await fetch(u);
      if (!E.ok)
        throw new Error(`CDG file failed to load: ${E.status}`);
      F = await E.text();
    } catch (u) {
      L("error", u);
    }
    return this;
  }
  function U(l, c) {
    return S[l] || (S[l] = []), S[l].push(c), this;
  }
  function V() {
    i.pause();
  }
  function b() {
    i.play();
  }
  function w() {
    i.pause(), i.currentTime = 0;
  }
  function L(l, ...c) {
    if (S[l] && S[l].length > 0)
      for (const u of S[l])
        u(...c);
    else l === "error" && console.error(...c);
  }
  function M() {
    if (i.error) {
      const l = i.error.code ? i.error.code : i.error;
      L(
        "error",
        new Error(
          "The audio control fired an error event. Could be: " + l
        )
      );
    }
  }
  function X() {
    if (F != null) {
      let l = Math.floor(
        i.currentTime * e.PACKS_PER_SECOND
      ), c = C.getCurrentPack(), u;
      l = l < 0 ? 0 : l, l < c - e.PACKS_PER_SECOND && (C.resetCdgState(), c = 0), u = c + 6, u = l > u ? l : u, u > c && (C.decodePacks(F, u), C.redrawCanvas());
    }
  }
  function p() {
    O = setInterval(X, 20);
  }
  function H() {
    clearInterval(O);
  }
  function G(l) {
    if (!l || Array.isArray(l) || typeof l != "string" && typeof l != "object")
      throw new Error("No track information specified, nothing to load!");
    let c, u, E = h.mediaPath, x = h.audioFormat, t = h.cdgFileExtension;
    if (typeof l == "object") {
      if (l.audioFilePrefix)
        c = l.audioFilePrefix;
      else
        throw new Error(
          "No audioFilePrefix property defined, nothing to load!"
        );
      if (u = l.cdgFilePrefix ? l.cdgFilePrefix : l.audioFilePrefix, l.mediaPath && (E = l.mediaPath), l.audioFormat) {
        if (!I[l.audioFormat])
          throw new Error("Unsupported audio format specified");
        x = l.audioFormat;
      }
      l.cdgFileExtension && (t = l.cdgFileExtension);
    } else
      c = u = l;
    return {
      audioFilePrefix: c,
      cdgFilePrefix: u,
      mediaPath: E,
      audioFormat: x,
      cdgFileExtension: t
    };
  }
  function v(l) {
    var c;
    document.fullscreenElement ? (c = document.exitFullscreen) == null || c.call(document) : l.target.requestFullscreen();
  }
  function B() {
    i.paused ? i.play() : i.pause();
  }
  function W(l, c) {
    if (!l)
      throw new Error("Required initialisation parameter missing.");
    const u = document.getElementById(l), E = document.createElement("div"), x = document.createElement("canvas");
    i = document.createElement("audio"), E.id = l + "-border", E.className = "cdg-border", x.id = l + "-canvas", x.width = e.VISIBLE_WIDTH, x.height = e.VISIBLE_HEIGHT, x.className = "cdg-canvas", c && c.allowClickToPlay !== !1 && x.addEventListener("click", B, !0), c && c.allowFullscreen !== !1 && x.addEventListener("dblclick", v, !0), i.id = l + "-audio", i.className = "cdg-audio", E.appendChild(x), u.appendChild(E), u.appendChild(i), i.style.width = x.offsetWidth + "px", i.controls = !(c && c.showControls == !1), i.autoplay = !(c && c.autoplay == !1), i.addEventListener("error", M, !0), i.addEventListener("play", p, !0), i.addEventListener("pause", H, !0), i.addEventListener("abort", H, !0), i.addEventListener(
      "ended",
      () => {
        H(), L("ended");
      },
      !0
    ), C = new z(x, E);
  }
  W(A, g), this.loadTrack = D, this.play = b, this.stop = w, this.pause = V, this.on = U;
}
function Z(A, g) {
  return new j(A, g);
}
export {
  Z as init
};
//# sourceMappingURL=cdg.js.map
