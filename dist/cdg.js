/*!
*  cdg.js - a CD+G player for the web, based upon CD+Graphics Magic HTML5 CD+G Player
*  (http://cdgmagic.sourceforge.net/html5_cdgplayer/). Visit project for full license
*  information and documentation: https://github.com/willprescott/cdg.js
*/
//#region src/CDGDecoder.js
var e = class e {
	static #e = {
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
	};
	#t;
	#n;
	#r;
	#i;
	#a;
	#o;
	#s = null;
	#c = 0;
	#l = 0;
	#u = !1;
	#d = !1;
	constructor(t, n) {
		let r = e.#e;
		this.#t = n, this.#n = t.getContext("2d"), this.#r = this.#n.createImageData(r.VISIBLE_WIDTH, r.VISIBLE_HEIGHT), this.#i = new Uint32Array(r.PALETTE_ENTRIES), this.#a = new Uint32Array(r.NUM_X_FONTS * r.VRAM_HEIGHT), this.#o = new Uint8Array(r.NUM_X_FONTS * r.NUM_Y_FONTS), t.width = r.VISIBLE_WIDTH, t.height = r.VISIBLE_HEIGHT, this.#f();
	}
	setCdgData(e) {
		this.#f(), this.#p(), this.#s = e;
	}
	updateFrame(t) {
		let n = e.#e, r = Math.floor(t * n.PACKS_PER_SECOND), i;
		r = r < 0 ? 0 : r, r < this.#l - n.PACKS_PER_SECOND && (this.#f(), this.#l = 0), i = this.#l + n.SMOOTHING_PACKS, i = r > i ? r : i, i > this.#l && (this.#m(i), this.#p());
	}
	#f() {
		this.#l = 0, this.#c = 0, this.#i.fill(0), this.#_(0), this.#o.fill(0);
	}
	#p() {
		let t = e.#e;
		if ((this.#u || this.#d) && (this.#t.style.backgroundColor = this.#h(this.#c), this.#u = !1), this.#d) this.#y(), this.#d = !1, this.#o.fill(0), this.#n.putImageData(this.#r, 0, 0);
		else {
			let e = this.#n, n = this.#r, r = this.#o, i = 0;
			for (let a = 1; a <= t.VISIBLE_Y_FONTS; ++a) {
				i = a * t.NUM_X_FONTS + 1;
				for (let o = 1; o <= t.VISIBLE_X_FONTS; ++o) r[i] && (this.#b(o, a), e.putImageData(n, 0, 0, (o - 1) * t.FONT_WIDTH, (a - 1) * t.FONT_HEIGHT, t.FONT_WIDTH, t.FONT_HEIGHT), r[i] = 0), ++i;
			}
		}
	}
	#m(t) {
		let n = e.#e;
		for (let e = this.#l; e < t; e++) {
			let t = e * n.PACK_SIZE;
			if ((this.#s.charCodeAt(t) & 63) == n.TV_GRAPHICS) {
				let e = this.#s.slice(t, t + n.PACK_SIZE);
				switch (e.charCodeAt(1) & 63) {
					case n.MEMORY_PRESET:
						this.#S(e);
						break;
					case n.BORDER_PRESET:
						this.#x(e);
						break;
					case n.LOAD_CLUT_LO:
					case n.LOAD_CLUT_HI:
						this.#C(e);
						break;
					case n.COPY_FONT:
					case n.XOR_FONT:
						this.#w(e);
						break;
					case n.SCROLL_PRESET:
					case n.SCROLL_COPY:
						this.#T(e);
						break;
				}
			}
		}
		this.#l = t;
	}
	#h(e) {
		let t = this.#i;
		return "rgb(" + (t[e] >> 16 & 255) + "," + (t[e] >> 8 & 255) + "," + (t[e] >> 0 & 255) + ")";
	}
	#g(e) {
		let t = e;
		return t |= e << 4, t |= e << 8, t |= e << 12, t |= e << 16, t |= e << 20, t;
	}
	#_(e) {
		this.#a.fill(this.#g(e)), this.#d = !0;
	}
	#v(e, t, n, r) {
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
	#y() {
		let t = e.#e, n = this.#r.data, r = this.#i, i = this.#a, a = t.NUM_X_FONTS * t.FONT_HEIGHT + 1, o = 0;
		for (let e = 0; e < t.VISIBLE_HEIGHT; ++e) {
			for (let e = 0; e < t.VISIBLE_X_FONTS; ++e) o = this.#v(n, o, r, i[a++]);
			a += t.NUM_X_FONTS - t.VISIBLE_X_FONTS;
		}
	}
	#b(t, n) {
		let r = e.#e, i = this.#r.data, a = this.#i, o = this.#a, s = n * r.NUM_X_FONTS * r.FONT_HEIGHT + t, c = r.NUM_X_FONTS, l = s + r.NUM_X_FONTS * r.FONT_HEIGHT, u = (n - 1) * r.FONT_HEIGHT * r.VISIBLE_WIDTH;
		u += (t - 1) * r.FONT_WIDTH, u *= 4;
		let d = (r.VISIBLE_WIDTH - r.FONT_WIDTH) * 4;
		for (; s < l;) u = this.#v(i, u, a, o[s]), s += c, u += d;
	}
	#x(e) {
		let t = e.charCodeAt(4) & 63;
		this.#i[t] != this.#i[this.#c] && (this.#u = !0), this.#c = t;
	}
	#S(e) {
		this.#_(e.charCodeAt(4) & 63);
	}
	#C(t) {
		let n = e.#e, r = this.#i, i = (t.charCodeAt(1) & 1) * n.CLUT_ENTRIES;
		for (let e = 0; e < n.CLUT_ENTRIES; e++) {
			let n = e + i, a = 0, o = (t.charCodeAt(e * 2 + 4) & 60) >> 2;
			a |= o * 17 << 16, o = (t.charCodeAt(e * 2 + 4) & 3) << 2 | (t.charCodeAt(e * 2 + 5) & 48) >> 4, a |= o * 17 << 8, o = t.charCodeAt(e * 2 + 5) & 15, a |= o * 17 << 0, a != r[n] && (r[n] = a, this.#d = !0, n == this.#c && (this.#u = !0));
		}
	}
	#w(t) {
		let n = e.#e, r = this.#a, i = this.#o, a = (t.charCodeAt(4) & 48) >> 2 | (t.charCodeAt(5) & 48) >> 4, o = t.charCodeAt(1) & 32;
		if (3 >> a) {
			let e = t.charCodeAt(7) & 63, a = t.charCodeAt(6) & 31;
			if (e < n.NUM_X_FONTS && a < n.NUM_Y_FONTS) {
				let s = a * n.NUM_X_FONTS * n.FONT_HEIGHT + e, c = [t.charCodeAt(4) & 15, t.charCodeAt(5) & 15], l = 0, u = 0;
				for (let e = 0; e < n.FONT_HEIGHT; e++) {
					let i = e * n.NUM_X_FONTS + s;
					l = t.charCodeAt(e + 8), u = c[l >> 5 & 1] << 0, u |= c[l >> 4 & 1] << 4, u |= c[l >> 3 & 1] << 8, u |= c[l >> 2 & 1] << 12, u |= c[l >> 1 & 1] << 16, u |= c[l >> 0 & 1] << 20, o ? r[i] ^= u : r[i] = u;
				}
				i[a * n.NUM_X_FONTS + e] = 1;
			}
		}
	}
	#T(e) {
		let t, n = (e.charCodeAt(1) & 8) >> 3, r = e.charCodeAt(4) & 15;
		(t = (e.charCodeAt(5) & 48) >> 4) && this.#E(t, n, r), (t = (e.charCodeAt(6) & 48) >> 4) && this.#D(t, n, r), this.#d = !0;
	}
	#E(t, n, r) {
		let i = e.#e, a, o, s, c = 0, l = this.#g(r), u = this.#a, d = i.NUM_X_FONTS * i.VRAM_HEIGHT;
		if (t == 2) for (o = 0; o < d; o += i.NUM_X_FONTS) {
			for (s = o, c = u[s], a = s + 1; a < s + i.NUM_X_FONTS; a++) u[a - 1] = u[a];
			u[s + i.NUM_X_FONTS - 1] = n ? c : l;
		}
		else if (t == 1) for (o = 0; o < d; o += i.NUM_X_FONTS) {
			for (s = o, c = u[s + i.NUM_X_FONTS - 1], a = s + i.NUM_X_FONTS - 2; a >= s; a--) u[a + 1] = u[a];
			u[s] = n ? c : l;
		}
	}
	#D(t, n, r) {
		let i = e.#e, a, o, s = i.NUM_X_FONTS * i.FONT_HEIGHT, c = i.NUM_X_FONTS * i.VRAM_HEIGHT, l = i.NUM_X_FONTS * (i.VRAM_HEIGHT - i.FONT_HEIGHT), u = new Uint32Array(s), d = this.#g(r), f = this.#a;
		if (t == 2) {
			for (a = 0, o = 0; o < s; o++) u[a++] = f[o];
			for (a = 0, o = s; o < c; o++) f[a++] = f[o];
			for (a = l, o = 0; o < s; o++) f[a++] = n ? u[o] : d;
		} else if (t == 1) {
			for (a = 0, o = l; o < c; o++) u[a++] = f[o];
			for (o = l - 1; o > 0; o--) f[o + s] = f[o];
			for (o = 0; o < s; o++) f[o] = n ? u[o] : d;
		}
	}
}, t = class t {
	static #e = 20;
	static #t = {
		mediaPath: "",
		audioFormat: "mp3",
		cdgFileExtension: "cdg"
	};
	static #n = {
		mp3: "audio/mpeg; codecs=\"mp3\"",
		ogg: "audio/ogg; codecs=\"vorbis\""
	};
	#r = null;
	#i = null;
	#a = null;
	#o = null;
	#s = {};
	constructor(e, t) {
		this.#h(e, t);
	}
	async loadTrack(e) {
		let n = this.#f(e), r = null;
		this.#d(), this.#i ??= document.createElement("source"), this.#i.type = t.#n[n.audioFormat], this.#i.src = n.mediaPath + n.audioFilePrefix + "." + n.audioFormat, this.#r.appendChild(this.#i), this.#r.load();
		try {
			let e = n.mediaPath + n.cdgFilePrefix + "." + n.cdgFileExtension, t = await fetch(e);
			if (!t.ok) throw Error(`CDG file failed to load: ${t.status}`);
			r = await t.text(), this.#o.setCdgData(r);
		} catch (e) {
			this.#c("error", e);
		}
		return this;
	}
	on(e, t) {
		return this.#s[e] || (this.#s[e] = []), this.#s[e].push(t), this;
	}
	pause() {
		this.#r.pause();
	}
	play() {
		this.#r.play();
	}
	stop() {
		this.#r.pause(), this.#r.currentTime = 0;
	}
	#c(e, ...t) {
		if (this.#s[e] && this.#s[e].length > 0) for (let n of this.#s[e]) n(...t);
		else e === "error" && console.error(...t);
	}
	#l() {
		if (this.#r.error) {
			let e = this.#r.error.code ? this.#r.error.code : this.#r.error;
			this.#c("error", /* @__PURE__ */ Error("The audio control fired an error event. Could be: " + e));
		}
	}
	#u() {
		this.#a = setInterval(() => {
			this.#o.updateFrame(this.#r.currentTime);
		}, t.#e);
	}
	#d() {
		clearInterval(this.#a);
	}
	#f(e) {
		if (!e || Array.isArray(e) || typeof e != "string" && typeof e != "object") throw Error("No track information specified, nothing to load!");
		let n, r, i = t.#t.mediaPath, a = t.#t.audioFormat, o = t.#t.cdgFileExtension;
		if (typeof e == "object") {
			if (e.audioFilePrefix) n = e.audioFilePrefix;
			else throw Error("No audioFilePrefix property defined, nothing to load!");
			if (r = e.cdgFilePrefix ? e.cdgFilePrefix : e.audioFilePrefix, e.mediaPath && (i = e.mediaPath), e.audioFormat) {
				if (!t.#n[e.audioFormat]) throw Error("Unsupported audio format specified");
				a = e.audioFormat;
			}
			e.cdgFileExtension && (o = e.cdgFileExtension);
		} else n = r = e;
		return {
			audioFilePrefix: n,
			cdgFilePrefix: r,
			mediaPath: i,
			audioFormat: a,
			cdgFileExtension: o
		};
	}
	#p(e) {
		document.fullscreenElement ? document.exitFullscreen?.() : e.target.requestFullscreen();
	}
	#m() {
		this.#r.paused ? this.#r.play() : this.#r.pause();
	}
	#h(t, n) {
		if (!t) throw Error("Required initialisation parameter missing.");
		let r = document.getElementById(t), i = document.createElement("div"), a = document.createElement("canvas");
		this.#r = document.createElement("audio"), i.id = t + "-border", i.className = "cdg-border", a.id = t + "-canvas", a.className = "cdg-canvas", n && n.allowClickToPlay !== !1 && a.addEventListener("click", () => this.#m(), !0), n && n.allowFullscreen !== !1 && a.addEventListener("dblclick", (e) => this.#p(e), !0), this.#r.id = t + "-audio", this.#r.className = "cdg-audio", i.appendChild(a), r.appendChild(i), r.appendChild(this.#r), this.#r.style.width = a.offsetWidth + "px", this.#r.controls = !(n && n.showControls == 0), this.#r.autoplay = !(n && n.autoplay == 0), this.#r.addEventListener("error", () => this.#l(), !0), this.#r.addEventListener("play", () => this.#u(), !0), this.#r.addEventListener("pause", () => this.#d(), !0), this.#r.addEventListener("abort", () => this.#d(), !0), this.#r.addEventListener("ended", () => {
			this.#d(), this.#c("ended");
		}, !0), this.#o = new e(a, i);
	}
};
//#endregion
//#region src/cdg.js
function n(e, n) {
	return new t(e, n);
}
//#endregion
export { e as CDGDecoder, n as init };

//# sourceMappingURL=cdg.js.map