/*!
*  cdg.js - a CD+G player for the web, based upon CD+Graphics Magic HTML5 CD+G Player
*  (http://cdgmagic.sourceforge.net/html5_cdgplayer/). Visit project for full license
*  information and documentation: https://github.com/willprescott/cdg.js
*/
//#region src/cdg.js
function e(e, t) {
	let n = {
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
		SCROLL_COPY: 24,
		SMOOTHING_PACKS: 6
	}, r = e.getContext("2d"), i = r.createImageData(n.VISIBLE_WIDTH, n.VISIBLE_HEIGHT), a = Array(n.PALETTE_ENTRIES), o = Array(n.NUM_X_FONTS * n.VRAM_HEIGHT), s = Array(n.NUM_X_FONTS * n.NUM_Y_FONTS), c = null, l = 0, u = 0, d = !1, f = !1;
	function p() {
		u = 0, l = 0, x(), S(0), b();
	}
	function m(e) {
		p(), h(), c = e;
	}
	function h() {
		if ((d || f) && (t.style.backgroundColor = v(l), d = !1), f) w(), f = !1, b(), r.putImageData(i, 0, 0);
		else {
			let e = r, t = i, a = s, o = n.FONT_WIDTH, c = n.FONT_HEIGHT, l = 0;
			for (let r = 1; r <= n.VISIBLE_Y_FONTS; ++r) {
				l = r * n.NUM_X_FONTS + 1;
				for (let i = 1; i <= n.VISIBLE_X_FONTS; ++i) a[l] && (T(i, r), e.putImageData(t, 0, 0, (i - 1) * o, (r - 1) * c, o, c), a[l] = 0), ++l;
			}
		}
	}
	function g(e) {
		let t = Math.floor(e * n.PACKS_PER_SECOND), r;
		t = t < 0 ? 0 : t, t < u - n.PACKS_PER_SECOND && (p(), u = 0), r = u + n.SMOOTHING_PACKS, r = t > r ? t : r, r > u && (_(r), h());
	}
	function _(e) {
		for (let t = u; t < e; t++) {
			let e = t * n.PACK_SIZE;
			if ((c.charCodeAt(e) & 63) == n.TV_GRAPHICS) {
				let t = c.slice(e, e + n.PACK_SIZE);
				switch (t.charCodeAt(1) & 63) {
					case n.MEMORY_PRESET:
						D(t);
						break;
					case n.BORDER_PRESET:
						E(t);
						break;
					case n.LOAD_CLUT_LO:
					case n.LOAD_CLUT_HI:
						O(t);
						break;
					case n.COPY_FONT:
					case n.XOR_FONT:
						k(t);
						break;
					case n.SCROLL_PRESET:
					case n.SCROLL_COPY:
						A(t);
						break;
				}
			}
		}
		u = e;
	}
	function v(e) {
		return "rgb(" + (a[e] >> 16 & 255) + "," + (a[e] >> 8 & 255) + "," + (a[e] >> 0 & 255) + ")";
	}
	function y(e) {
		let t = e;
		return t |= e << 4, t |= e << 8, t |= e << 12, t |= e << 16, t |= e << 20, t;
	}
	function b() {
		for (let e = 0; e < n.NUM_X_FONTS * n.NUM_Y_FONTS; e++) s[e] = 0;
	}
	function x() {
		let e = n.PALETTE_ENTRIES;
		for (let t = 0; t < e; t++) a[t] = 0;
	}
	function S(e) {
		let t = o, n = t.length, r = y(e);
		for (let e = 0; e < n; e++) t[e] = r;
		f = !0;
	}
	function C(e, t, n, r) {
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
	function w() {
		let e = i.data, t = a, r = o, s = n.NUM_X_FONTS * n.FONT_HEIGHT + 1, c = 0;
		for (let i = 0; i < n.VISIBLE_HEIGHT; ++i) {
			for (let i = 0; i < n.VISIBLE_X_FONTS; ++i) c = C(e, c, t, r[s++]);
			s += n.NUM_X_FONTS - n.VISIBLE_X_FONTS;
		}
	}
	function T(e, t) {
		let r = i.data, s = a, c = o, l = t * n.NUM_X_FONTS * n.FONT_HEIGHT + e, u = n.NUM_X_FONTS, d = l + n.NUM_X_FONTS * n.FONT_HEIGHT, f = (t - 1) * n.FONT_HEIGHT * n.VISIBLE_WIDTH;
		f += (e - 1) * n.FONT_WIDTH, f *= 4;
		let p = (n.VISIBLE_WIDTH - n.FONT_WIDTH) * 4;
		for (; l < d;) f = C(r, f, s, c[l]), l += u, f += p;
	}
	function E(e) {
		let t = e.charCodeAt(4) & 63;
		a[t] != a[l] && (d = !0), l = t;
	}
	function D(e) {
		S(e.charCodeAt(4) & 63);
	}
	function O(e) {
		let t = a, r = (e.charCodeAt(1) & 1) * n.CLUT_ENTRIES;
		for (let i = 0; i < n.CLUT_ENTRIES; i++) {
			let n = i + r, a = 0, o = 0;
			o = (e.charCodeAt(i * 2 + 4) & 60) >> 2, a |= o * 17 << 16, o = (e.charCodeAt(i * 2 + 4) & 3) << 2 | (e.charCodeAt(i * 2 + 5) & 48) >> 4, a |= o * 17 << 8, o = e.charCodeAt(i * 2 + 5) & 15, a |= o * 17 << 0, a != t[n] && (t[n] = a, f = !0, n == l && (d = !0));
		}
	}
	function k(e) {
		let t = o, r = s, i = (e.charCodeAt(4) & 48) >> 2 | (e.charCodeAt(5) & 48) >> 4, a = e.charCodeAt(1) & 32;
		if (3 >> i) {
			let i = e.charCodeAt(7) & 63, o = e.charCodeAt(6) & 31;
			if (i < n.NUM_X_FONTS && o < n.NUM_Y_FONTS) {
				let s = o * n.NUM_X_FONTS * n.FONT_HEIGHT + i, c = [e.charCodeAt(4) & 15, e.charCodeAt(5) & 15], l = 0, u = 0;
				for (let r = 0; r < n.FONT_HEIGHT; r++) {
					let i = r * n.NUM_X_FONTS + s;
					l = e.charCodeAt(r + 8), u = c[l >> 5 & 1] << 0, u |= c[l >> 4 & 1] << 4, u |= c[l >> 3 & 1] << 8, u |= c[l >> 2 & 1] << 12, u |= c[l >> 1 & 1] << 16, u |= c[l >> 0 & 1] << 20, a ? t[i] ^= u : t[i] = u;
				}
				r[o * n.NUM_X_FONTS + i] = 1;
			}
		}
	}
	function A(e) {
		let t, n = (e.charCodeAt(1) & 8) >> 3, r = e.charCodeAt(4) & 15;
		(t = (e.charCodeAt(5) & 48) >> 4) && j(t, n, r), (t = (e.charCodeAt(6) & 48) >> 4) && M(t, n, r), f = !0;
	}
	function j(e, t, r) {
		let i, a, s, c = 0, l = y(r), u = o, d = n.NUM_X_FONTS * n.VRAM_HEIGHT;
		if (e == 2) for (a = 0; a < d; a += n.NUM_X_FONTS) {
			for (s = a, c = u[s], i = s + 1; i < s + n.NUM_X_FONTS; i++) u[i - 1] = u[i];
			t ? u[s + n.NUM_X_FONTS - 1] = c : u[s + n.NUM_X_FONTS - 1] = l;
		}
		else if (e == 1) for (a = 0; a < d; a += n.NUM_X_FONTS) {
			for (s = a, c = u[s + n.NUM_X_FONTS - 1], i = s + n.NUM_X_FONTS - 2; i >= s; i--) u[i + 1] = u[i];
			t ? u[s] = c : u[s] = l;
		}
	}
	function M(e, t, r) {
		let i, a, s = n.NUM_X_FONTS * n.FONT_HEIGHT, c = n.NUM_X_FONTS * n.VRAM_HEIGHT, l = n.NUM_X_FONTS * (n.VRAM_HEIGHT - n.FONT_HEIGHT), u = Array(s), d = y(r), f = o;
		if (e == 2) {
			for (i = 0, a = 0; a < s; a++) u[i++] = f[a];
			for (i = 0, a = s; a < c; a++) f[i++] = f[a];
			if (i = l, t) for (a = 0; a < s; a++) f[i++] = u[a];
			else for (a = 0; a < s; a++) f[i++] = d;
		} else if (e == 1) {
			for (i = 0, a = l; a < c; a++) u[i++] = f[a];
			for (a = l - 1; a > 0; a--) f[a + s] = f[a];
			if (t) for (a = 0; a < s; a++) f[a] = u[a];
			else for (a = 0; a < s; a++) f[a] = d;
		}
	}
	this.setCdgData = m, this.updateFrame = g, p(), e.width = n.VISIBLE_WIDTH, e.height = n.VISIBLE_HEIGHT;
}
function t(t, n) {
	let r = {
		mediaPath: "",
		audioFormat: "mp3",
		cdgFileExtension: "cdg"
	}, i = {
		mp3: "audio/mpeg; codecs=\"mp3\"",
		ogg: "audio/ogg; codecs=\"vorbis\""
	}, a = {}, o = null, s = null, c = null, l = null;
	async function u(e) {
		let t = y(e), n = null;
		v(), s ??= document.createElement("source"), s.type = i[t.audioFormat], s.src = t.mediaPath + t.audioFilePrefix + "." + t.audioFormat, o.appendChild(s), o.load();
		try {
			let e = t.mediaPath + t.cdgFilePrefix + "." + t.cdgFileExtension, r = await fetch(e);
			if (!r.ok) throw Error(`CDG file failed to load: ${r.status}`);
			n = await r.text(), l.setCdgData(n);
		} catch (e) {
			h("error", e);
		}
		return this;
	}
	function d(e, t) {
		return a[e] || (a[e] = []), a[e].push(t), this;
	}
	function f() {
		o.pause();
	}
	function p() {
		o.play();
	}
	function m() {
		o.pause(), o.currentTime = 0;
	}
	function h(e, ...t) {
		if (a[e] && a[e].length > 0) for (let n of a[e]) n(...t);
		else e === "error" && console.error(...t);
	}
	function g() {
		if (o.error) {
			let e = o.error.code ? o.error.code : o.error;
			h("error", /* @__PURE__ */ Error("The audio control fired an error event. Could be: " + e));
		}
	}
	function _() {
		c = setInterval(() => {
			l.updateFrame(o.currentTime);
		}, 20);
	}
	function v() {
		clearInterval(c);
	}
	function y(e) {
		if (!e || Array.isArray(e) || typeof e != "string" && typeof e != "object") throw Error("No track information specified, nothing to load!");
		let t, n, a = r.mediaPath, o = r.audioFormat, s = r.cdgFileExtension;
		if (typeof e == "object") {
			if (e.audioFilePrefix) t = e.audioFilePrefix;
			else throw Error("No audioFilePrefix property defined, nothing to load!");
			if (n = e.cdgFilePrefix ? e.cdgFilePrefix : e.audioFilePrefix, e.mediaPath && (a = e.mediaPath), e.audioFormat) {
				if (!i[e.audioFormat]) throw Error("Unsupported audio format specified");
				o = e.audioFormat;
			}
			e.cdgFileExtension && (s = e.cdgFileExtension);
		} else t = n = e;
		return {
			audioFilePrefix: t,
			cdgFilePrefix: n,
			mediaPath: a,
			audioFormat: o,
			cdgFileExtension: s
		};
	}
	function b(e) {
		document.fullscreenElement ? document.exitFullscreen?.() : e.target.requestFullscreen();
	}
	function x() {
		o.paused ? o.play() : o.pause();
	}
	function S(t, n) {
		if (!t) throw Error("Required initialisation parameter missing.");
		let r = document.getElementById(t), i = document.createElement("div"), a = document.createElement("canvas");
		o = document.createElement("audio"), i.id = t + "-border", i.className = "cdg-border", a.id = t + "-canvas", a.className = "cdg-canvas", n && n.allowClickToPlay !== !1 && a.addEventListener("click", x, !0), n && n.allowFullscreen !== !1 && a.addEventListener("dblclick", b, !0), o.id = t + "-audio", o.className = "cdg-audio", i.appendChild(a), r.appendChild(i), r.appendChild(o), o.style.width = a.offsetWidth + "px", o.controls = !(n && n.showControls == 0), o.autoplay = !(n && n.autoplay == 0), o.addEventListener("error", g, !0), o.addEventListener("play", _, !0), o.addEventListener("pause", v, !0), o.addEventListener("abort", v, !0), o.addEventListener("ended", () => {
			v(), h("ended");
		}, !0), l = new e(a, i);
	}
	S(t, n), this.loadTrack = u, this.play = p, this.stop = m, this.pause = f, this.on = d;
}
function n(e, n) {
	return new t(e, n);
}
//#endregion
export { e as CDGDecoder, n as init };

//# sourceMappingURL=cdg.js.map