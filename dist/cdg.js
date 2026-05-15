/*!
*  cdg.js - a CD+G player for the web, based upon CD+Graphics Magic HTML5 CD+G Player
*  (http://cdgmagic.sourceforge.net/html5_cdgplayer/). Visit project for full license
*  information and documentation: https://github.com/willprescott/cdg.js
*/
//#region src/cdg.js
var e = {
	VRAM_HEIGHT: 216,
	VISIBLE_WIDTH: 288,
	VISIBLE_HEIGHT: 192,
	FONT_WIDTH: 6,
	FONT_HEIGHT: 12,
	NUM_X_FONTS: 50,
	NUM_Y_FONTS: 18,
	VISIBLE_X_FONTS: 48,
	VISIBLE_Y_FONTS: 16,
	PALETTE_ENTRIES: 16,
	CLUT_ENTRIES: 8,
	PACK_SIZE: 24,
	PACKS_PER_SECOND: 300,
	TV_GRAPHICS: 9,
	MEMORY_PRESET: 1,
	BORDER_PRESET: 2,
	LOAD_CLUT_LO: 30,
	LOAD_CLUT_HI: 31,
	COPY_FONT: 6,
	XOR_FONT: 38,
	SCROLL_PRESET: 20,
	SCROLL_COPY: 24
};
function t(t, n) {
	let r = n, i = t.getContext("2d"), a = i.createImageData(e.VISIBLE_WIDTH, e.VISIBLE_HEIGHT), o = Array(e.PALETTE_ENTRIES), s = Array(e.NUM_X_FONTS * e.VRAM_HEIGHT), c = 0, l = 0, u = !1, d = !1, f = Array(e.NUM_X_FONTS * e.NUM_Y_FONTS);
	function p() {
		l = 0, c = 0, b(), x(0), y();
	}
	function m() {
		return l;
	}
	function h() {
		if ((u || d) && (r.style.backgroundColor = _(c), u = !1), d) C(), d = !1, y(), i.putImageData(a, 0, 0);
		else {
			let t = i, n = a, r = f, o = e.FONT_WIDTH, s = e.FONT_HEIGHT, c = 0;
			for (let i = 1; i <= e.VISIBLE_Y_FONTS; ++i) {
				c = i * e.NUM_X_FONTS + 1;
				for (let a = 1; a <= e.VISIBLE_X_FONTS; ++a) r[c] && (w(a, i), t.putImageData(n, 0, 0, (a - 1) * o, (i - 1) * s, o, s), r[c] = 0), ++c;
			}
		}
	}
	function g(t, n) {
		for (let r = l; r < n; r++) {
			let n = r * e.PACK_SIZE;
			if ((t.charCodeAt(n) & 63) == e.TV_GRAPHICS) {
				let r = t.slice(n, n + e.PACK_SIZE);
				switch (r.charCodeAt(1) & 63) {
					case e.MEMORY_PRESET:
						E(r);
						break;
					case e.BORDER_PRESET:
						T(r);
						break;
					case e.LOAD_CLUT_LO:
					case e.LOAD_CLUT_HI:
						D(r);
						break;
					case e.COPY_FONT:
					case e.XOR_FONT:
						O(r);
						break;
					case e.SCROLL_PRESET:
					case e.SCROLL_COPY:
						k(r);
						break;
				}
			}
		}
		l = n;
	}
	function _(e) {
		return "rgb(" + (o[e] >> 16 & 255) + "," + (o[e] >> 8 & 255) + "," + (o[e] >> 0 & 255) + ")";
	}
	function v(e) {
		let t = e;
		return t |= e << 4, t |= e << 8, t |= e << 12, t |= e << 16, t |= e << 20, t;
	}
	function y() {
		for (let t = 0; t < e.NUM_X_FONTS * e.NUM_Y_FONTS; t++) f[t] = 0;
	}
	function b() {
		let t = e.PALETTE_ENTRIES;
		for (let e = 0; e < t; e++) o[e] = 0;
	}
	function x(e) {
		let t = s, n = t.length, r = v(e);
		for (let e = 0; e < n; e++) t[e] = r;
		d = !0;
	}
	function S(e, t, n, r) {
		for (let i of [
			0,
			4,
			8,
			12,
			16,
			20
		]) {
			let a = n[r >> i & 15];
			e[t++] = a >> 16 & 255, e[t++] = a >> 8 & 255, e[t++] = a & 255, e[t++] = 255;
		}
		return t;
	}
	function C() {
		let t = a.data, n = o, r = s, i = e.NUM_X_FONTS * e.FONT_HEIGHT + 1, c = 0;
		for (let a = 0; a < e.VISIBLE_HEIGHT; ++a) {
			for (let a = 0; a < e.VISIBLE_X_FONTS; ++a) c = S(t, c, n, r[i++]);
			i += e.NUM_X_FONTS - e.VISIBLE_X_FONTS;
		}
	}
	function w(t, n) {
		let r = a.data, i = o, c = s, l = n * e.NUM_X_FONTS * e.FONT_HEIGHT + t, u = e.NUM_X_FONTS, d = l + e.NUM_X_FONTS * e.FONT_HEIGHT, f = (n - 1) * e.FONT_HEIGHT * e.VISIBLE_WIDTH;
		f += (t - 1) * e.FONT_WIDTH, f *= 4;
		let p = (e.VISIBLE_WIDTH - e.FONT_WIDTH) * 4;
		for (; l < d;) f = S(r, f, i, c[l]), l += u, f += p;
	}
	function T(e) {
		let t = e.charCodeAt(4) & 63;
		o[t] != o[c] && (u = !0), c = t;
	}
	function E(e) {
		x(e.charCodeAt(4) & 63);
	}
	function D(t) {
		let n = o, r = (t.charCodeAt(1) & 1) * e.CLUT_ENTRIES;
		for (let i = 0; i < e.CLUT_ENTRIES; i++) {
			let e = i + r, a = 0, o = 0;
			o = (t.charCodeAt(i * 2 + 4) & 60) >> 2, a |= o * 17 << 16, o = (t.charCodeAt(i * 2 + 4) & 3) << 2 | (t.charCodeAt(i * 2 + 5) & 48) >> 4, a |= o * 17 << 8, o = t.charCodeAt(i * 2 + 5) & 15, a |= o * 17 << 0, a != n[e] && (n[e] = a, d = !0, e == c && (u = !0));
		}
	}
	function O(t) {
		let n = s, r = f, i = (t.charCodeAt(4) & 48) >> 2 | (t.charCodeAt(5) & 48) >> 4, a = t.charCodeAt(1) & 32;
		if (3 >> i) {
			let i = t.charCodeAt(7) & 63, o = t.charCodeAt(6) & 31;
			if (i < e.NUM_X_FONTS && o < e.NUM_Y_FONTS) {
				let s = o * e.NUM_X_FONTS * e.FONT_HEIGHT + i, c = [t.charCodeAt(4) & 15, t.charCodeAt(5) & 15], l = 0, u = 0;
				for (let r = 0; r < e.FONT_HEIGHT; r++) {
					let i = r * e.NUM_X_FONTS + s;
					l = t.charCodeAt(r + 8), u = c[l >> 5 & 1] << 0, u |= c[l >> 4 & 1] << 4, u |= c[l >> 3 & 1] << 8, u |= c[l >> 2 & 1] << 12, u |= c[l >> 1 & 1] << 16, u |= c[l >> 0 & 1] << 20, a ? n[i] ^= u : n[i] = u;
				}
				r[o * e.NUM_X_FONTS + i] = 1;
			}
		}
	}
	function k(e) {
		let t, n = (e.charCodeAt(1) & 8) >> 3, r = e.charCodeAt(4) & 15;
		(t = (e.charCodeAt(5) & 48) >> 4) && A(t, n, r), (t = (e.charCodeAt(6) & 48) >> 4) && j(t, n, r), d = !0;
	}
	function A(t, n, r) {
		let i, a, o, c = 0, l = v(r), u = s, d = e.NUM_X_FONTS * e.VRAM_HEIGHT;
		if (t == 2) for (a = 0; a < d; a += e.NUM_X_FONTS) {
			for (o = a, c = u[o], i = o + 1; i < o + e.NUM_X_FONTS; i++) u[i - 1] = u[i];
			n ? u[o + e.NUM_X_FONTS - 1] = c : u[o + e.NUM_X_FONTS - 1] = l;
		}
		else if (t == 1) for (a = 0; a < d; a += e.NUM_X_FONTS) {
			for (o = a, c = u[o + e.NUM_X_FONTS - 1], i = o + e.NUM_X_FONTS - 2; i >= o; i--) u[i + 1] = u[i];
			n ? u[o] = c : u[o] = l;
		}
	}
	function j(t, n, r) {
		let i, a, o = e.NUM_X_FONTS * e.FONT_HEIGHT, c = e.NUM_X_FONTS * e.VRAM_HEIGHT, l = e.NUM_X_FONTS * (e.VRAM_HEIGHT - e.FONT_HEIGHT), u = Array(o), d = v(r), f = s;
		if (t == 2) {
			for (i = 0, a = 0; a < o; a++) u[i++] = f[a];
			for (i = 0, a = o; a < c; a++) f[i++] = f[a];
			if (i = l, n) for (a = 0; a < o; a++) f[i++] = u[a];
			else for (a = 0; a < o; a++) f[i++] = d;
		} else if (t == 1) {
			for (i = 0, a = l; a < c; a++) u[i++] = f[a];
			for (a = l - 1; a > 0; a--) f[a + o] = f[a];
			if (n) for (a = 0; a < o; a++) f[a] = u[a];
			else for (a = 0; a < o; a++) f[a] = d;
		}
	}
	this.getCurrentPack = m, this.resetCdgState = p, this.redrawCanvas = h, this.decodePacks = g, this.resetCdgState();
}
function n(n, r) {
	let i = {
		mediaPath: "",
		audioFormat: "mp3",
		cdgFileExtension: "cdg"
	}, a = {
		mp3: "audio/mpeg; codecs=\"mp3\"",
		ogg: "audio/ogg; codecs=\"vorbis\""
	}, o = {}, s = null, c = null, l = null, u = null, d = null;
	async function f(e) {
		let t = S(e);
		x(), d.resetCdgState(), d.redrawCanvas(), u = null, c ??= document.createElement("source"), c.type = a[t.audioFormat], c.src = t.mediaPath + t.audioFilePrefix + "." + t.audioFormat, s.appendChild(c), s.load();
		try {
			let e = t.mediaPath + t.cdgFilePrefix + "." + t.cdgFileExtension, n = await fetch(e);
			if (!n.ok) throw Error(`CDG file failed to load: ${n.status}`);
			u = await n.text();
		} catch (e) {
			_("error", e);
		}
		return this;
	}
	function p(e, t) {
		return o[e] || (o[e] = []), o[e].push(t), this;
	}
	function m() {
		s.pause();
	}
	function h() {
		s.play();
	}
	function g() {
		s.pause(), s.currentTime = 0;
	}
	function _(e, ...t) {
		if (o[e] && o[e].length > 0) for (let n of o[e]) n(...t);
		else e === "error" && console.error(...t);
	}
	function v() {
		if (s.error) {
			let e = s.error.code ? s.error.code : s.error;
			_("error", /* @__PURE__ */ Error("The audio control fired an error event. Could be: " + e));
		}
	}
	function y() {
		if (u != null) {
			let t = Math.floor(s.currentTime * e.PACKS_PER_SECOND), n = d.getCurrentPack(), r;
			t = t < 0 ? 0 : t, t < n - e.PACKS_PER_SECOND && (d.resetCdgState(), n = 0), r = n + 6, r = t > r ? t : r, r > n && (d.decodePacks(u, r), d.redrawCanvas());
		}
	}
	function b() {
		l = setInterval(y, 20);
	}
	function x() {
		clearInterval(l);
	}
	function S(e) {
		if (!e || Array.isArray(e) || typeof e != "string" && typeof e != "object") throw Error("No track information specified, nothing to load!");
		let t, n, r = i.mediaPath, o = i.audioFormat, s = i.cdgFileExtension;
		if (typeof e == "object") {
			if (e.audioFilePrefix) t = e.audioFilePrefix;
			else throw Error("No audioFilePrefix property defined, nothing to load!");
			if (n = e.cdgFilePrefix ? e.cdgFilePrefix : e.audioFilePrefix, e.mediaPath && (r = e.mediaPath), e.audioFormat) {
				if (!a[e.audioFormat]) throw Error("Unsupported audio format specified");
				o = e.audioFormat;
			}
			e.cdgFileExtension && (s = e.cdgFileExtension);
		} else t = n = e;
		return {
			audioFilePrefix: t,
			cdgFilePrefix: n,
			mediaPath: r,
			audioFormat: o,
			cdgFileExtension: s
		};
	}
	function C(e) {
		document.fullscreenElement ? document.exitFullscreen?.() : e.target.requestFullscreen();
	}
	function w() {
		s.paused ? s.play() : s.pause();
	}
	function T(n, r) {
		if (!n) throw Error("Required initialisation parameter missing.");
		let i = document.getElementById(n), a = document.createElement("div"), o = document.createElement("canvas");
		s = document.createElement("audio"), a.id = n + "-border", a.className = "cdg-border", o.id = n + "-canvas", o.width = e.VISIBLE_WIDTH, o.height = e.VISIBLE_HEIGHT, o.className = "cdg-canvas", r && r.allowClickToPlay !== !1 && o.addEventListener("click", w, !0), r && r.allowFullscreen !== !1 && o.addEventListener("dblclick", C, !0), s.id = n + "-audio", s.className = "cdg-audio", a.appendChild(o), i.appendChild(a), i.appendChild(s), s.style.width = o.offsetWidth + "px", s.controls = !(r && r.showControls == 0), s.autoplay = !(r && r.autoplay == 0), s.addEventListener("error", v, !0), s.addEventListener("play", b, !0), s.addEventListener("pause", x, !0), s.addEventListener("abort", x, !0), s.addEventListener("ended", () => {
			x(), _("ended");
		}, !0), d = new t(o, a);
	}
	T(n, r), this.loadTrack = f, this.play = h, this.stop = g, this.pause = m, this.on = p;
}
function r(e, t) {
	return new n(e, t);
}
//#endregion
export { r as init };

//# sourceMappingURL=cdg.js.map