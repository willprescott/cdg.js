import { describe, it, expect, beforeEach } from "vitest";
import { CDGDecoder } from "../src/cdg.js";

// ─── CDG pack construction helpers ───────────────────────────────────────────

const TV_GRAPHICS = 0x09;
const MEMORY_PRESET = 0x01;
const BORDER_PRESET = 0x02;
const LOAD_CLUT_LO = 0x1e;
const LOAD_CLUT_HI = 0x1f;
const COPY_FONT = 0x06;
const XOR_FONT = 0x26;
const SCROLL_COPY = 0x18;

// Builds a 24-byte CDG pack as a string. Data bytes are placed starting at
// offset 4 (the subcode data region); bytes outside data default to 0.
function makePack(command, instruction, data = []) {
  const bytes = new Array(24).fill(0);
  bytes[0] = command;
  bytes[1] = instruction;
  data.forEach((b, i) => {
    bytes[4 + i] = b;
  });
  return String.fromCharCode(...bytes);
}

// Encodes a single 4-bit-per-channel RGB color into the two-byte CDG CLUT
// format. Each component is 0-15.
function clutEntry(r, g, b) {
  return [
    ((r & 0x0f) << 2) | ((g >> 2) & 0x03),
    ((g & 0x03) << 4) | (b & 0x0f),
  ];
}

// Builds a LOAD_CLUT pack from an array of up to 8 [r, g, b] triples.
// Unspecified entries default to black.
function makeClutPack(instruction, colors) {
  const data = [];
  for (let i = 0; i < 8; i++) {
    const [r, g, b] = colors[i] ?? [0, 0, 0];
    data.push(...clutEntry(r, g, b));
  }
  return makePack(TV_GRAPHICS, instruction, data);
}

// Builds a COPY_FONT or XOR_FONT pack. color0/color1 are palette indices (0-15).
// rows is an array of up to 12 bytes (6 pixels each, MSB = leftmost pixel).
function makeFontPack(instruction, xLoc, yLoc, color0, color1, rows = []) {
  const rowBytes = new Array(12).fill(0);
  rows.forEach((b, i) => {
    rowBytes[i] = b;
  });
  return makePack(TV_GRAPHICS, instruction, [
    color0 & 0x0f,
    color1 & 0x0f,
    yLoc & 0x1f,
    xLoc & 0x3f,
    ...rowBytes,
  ]);
}

// ─── Mock canvas / border ─────────────────────────────────────────────────────

function createMockCanvas() {
  const imageData = { data: new Uint8ClampedArray(288 * 192 * 4) };
  return {
    canvas: {
      getContext: () => ({
        createImageData: () => imageData,
        putImageData: () => {},
      }),
    },
    imageData,
  };
}

function createBorderDiv() {
  return { style: { backgroundColor: "" } };
}

// Returns the RGBA tuple of the pixel at (px, py) in imageData.
function pixelAt(imageData, px, py) {
  const i = (py * 288 + px) * 4;
  return Array.from(imageData.data.slice(i, i + 4));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CDGDecoder", () => {
  let decoder;
  let mock;
  let borderDiv;

  beforeEach(() => {
    mock = createMockCanvas();
    borderDiv = createBorderDiv();
    decoder = new CDGDecoder(mock.canvas, borderDiv);
  });

  // ── setCdgData ──────────────────────────────────────────────────────────────

  describe("setCdgData", () => {
    it("immediately clears the canvas to black", () => {
      // Render a red frame first, then load new data and verify canvas resets.
      decoder.setCdgData(makeClutPack(LOAD_CLUT_LO, [[15, 0, 0]]));
      decoder.updateFrame(0);
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([255, 0, 0, 255]);

      decoder.setCdgData(makePack(0x00, 0x00));
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 0, 0, 255]);
    });
  });

  // ── updateFrame — instruction processing ────────────────────────────────────

  describe("LOAD_CLUT_LO", () => {
    it("loads palette entries 0-7 and renders them correctly", () => {
      decoder.setCdgData(makeClutPack(LOAD_CLUT_LO, [[15, 0, 0]]));
      decoder.updateFrame(0);
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([255, 0, 0, 255]);
    });

    it("does not alter pixels when the loaded color matches the existing value", () => {
      decoder.setCdgData(makeClutPack(LOAD_CLUT_LO, [[0, 0, 0]]));
      decoder.updateFrame(0);
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 0, 0, 255]);
    });
  });

  describe("LOAD_CLUT_HI", () => {
    it("loads palette entries 8-15 and renders them correctly", () => {
      // palette[8] = blue via CLUT_HI, then MEMORY_PRESET fills VRAM with index 8.
      const clutPack = makeClutPack(LOAD_CLUT_HI, [[0, 0, 15]]);
      const memPreset = makePack(TV_GRAPHICS, MEMORY_PRESET, [8]);
      decoder.setCdgData(clutPack + memPreset);
      decoder.updateFrame(0);
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 0, 255, 255]);
    });
  });

  describe("MEMORY_PRESET", () => {
    it("fills the entire visible area with the specified palette color", () => {
      // palette[1] = green, MEMORY_PRESET fills all VRAM with index 1.
      const clutPack = makeClutPack(LOAD_CLUT_LO, [[0, 0, 0], [0, 15, 0]]);
      const memPreset = makePack(TV_GRAPHICS, MEMORY_PRESET, [1]);
      decoder.setCdgData(clutPack + memPreset);
      decoder.updateFrame(0);
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 255, 0, 255]);
      expect(pixelAt(mock.imageData, 287, 191)).toEqual([0, 255, 0, 255]);
    });
  });

  describe("BORDER_PRESET", () => {
    it("sets the border div background color to the specified palette entry", () => {
      const clutPack = makeClutPack(LOAD_CLUT_LO, [[0, 0, 0], [0, 0, 15]]);
      const borderPack = makePack(TV_GRAPHICS, BORDER_PRESET, [1]);
      decoder.setCdgData(clutPack + borderPack);
      decoder.updateFrame(0);
      expect(borderDiv.style.backgroundColor).toBe("rgb(0,0,255)");
    });

    it("reflects palette changes in the border color when the index is unchanged", () => {
      // Border index defaults to 0. Loading red into palette[0] should update
      // the border without an explicit BORDER_PRESET instruction.
      decoder.setCdgData(makeClutPack(LOAD_CLUT_LO, [[15, 0, 0]]));
      decoder.updateFrame(0);
      expect(borderDiv.style.backgroundColor).toBe("rgb(255,0,0)");
    });
  });

  describe("COPY_FONT", () => {
    it("writes pixel data into VRAM and renders the block correctly", () => {
      // palette[0]=black, palette[1]=red. CLUT and WRITE_FONT are processed
      // in the same updateFrame call; the full-screen render (triggered by the
      // CLUT's screenDirty) reads the already-updated VRAM.
      const clutPack = makeClutPack(LOAD_CLUT_LO, [[0, 0, 0], [15, 0, 0]]);
      const fontPack = makeFontPack(COPY_FONT, 1, 1, 0, 1, new Array(12).fill(0x3f));
      decoder.setCdgData(clutPack + fontPack);
      decoder.updateFrame(0);
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([255, 0, 0, 255]);
    });
  });

  describe("XOR_FONT", () => {
    it("XORs pixel data into VRAM, toggling written pixels back to the original color", () => {
      // COPY_FONT writes all-green block (1,1), then XOR_FONT with the same
      // pattern XORs it back to all-black (index 0).
      const clutPack = makeClutPack(LOAD_CLUT_LO, [[0, 0, 0], [0, 15, 0]]);
      const allOnes = new Array(12).fill(0x3f);
      const copyPack = makeFontPack(COPY_FONT, 1, 1, 0, 1, allOnes);
      const xorPack = makeFontPack(XOR_FONT, 1, 1, 0, 1, allOnes);
      decoder.setCdgData(clutPack + copyPack + xorPack);
      decoder.updateFrame(0);
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 0, 0, 255]);
    });
  });

  describe("SCROLL_COPY vertical", () => {
    it("preserves uniform VRAM content after a vertical copy scroll", () => {
      // Fill VRAM with blue (palette[8]) then scroll down with copyFlag=1.
      // Since all rows are identical, wrapping the offscreen row back in leaves
      // every pixel unchanged — verifying Uint32Array copy in procVramVscroll.
      const clutPack = makeClutPack(LOAD_CLUT_HI, [[0, 0, 15]]);
      const memPreset = makePack(TV_GRAPHICS, MEMORY_PRESET, [8]);
      // data[0]=color, data[1]=h-dir (0=none), data[2]=v-dir (0x20 = down)
      const scrollPack = makePack(TV_GRAPHICS, SCROLL_COPY, [0, 0, 0x20]);
      decoder.setCdgData(clutPack + memPreset + scrollPack);
      decoder.updateFrame(0);
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 0, 255, 255]);
      expect(pixelAt(mock.imageData, 287, 191)).toEqual([0, 0, 255, 255]);
    });
  });

  describe("SCROLL_COPY horizontal", () => {
    it("preserves uniform VRAM content after a horizontal copy scroll", () => {
      // Fill VRAM with blue (palette[8]) then scroll left with copyFlag=1.
      // Since all columns are identical, wrapping the offscreen column back in
      // leaves every pixel unchanged — verifying Uint32Array copy in procVramHscroll.
      const clutPack = makeClutPack(LOAD_CLUT_HI, [[0, 0, 15]]);
      const memPreset = makePack(TV_GRAPHICS, MEMORY_PRESET, [8]);
      // data[0]=color, data[1]=h-dir (0x20 = left), data[2]=v-dir (0=none)
      const scrollPack = makePack(TV_GRAPHICS, SCROLL_COPY, [0, 0x20, 0]);
      decoder.setCdgData(clutPack + memPreset + scrollPack);
      decoder.updateFrame(0);
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 0, 255, 255]);
      expect(pixelAt(mock.imageData, 287, 191)).toEqual([0, 0, 255, 255]);
    });
  });

  describe("max-value palette entry", () => {
    it("stores and renders a white palette entry (0xFFFFFF) correctly via Uint32Array", () => {
      // palette[15] = white (R=15, G=15, B=15 → 0xFFFFFF), which is the largest
      // value stored in palette's Uint32Array. MEMORY_PRESET(15) fills all VRAM.
      const clutPack = makeClutPack(LOAD_CLUT_HI, [
        [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
        [0, 0, 0], [0, 0, 0], [0, 0, 0], [15, 15, 15],
      ]);
      const memPreset = makePack(TV_GRAPHICS, MEMORY_PRESET, [15]);
      decoder.setCdgData(clutPack + memPreset);
      decoder.updateFrame(0);
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([255, 255, 255, 255]);
      expect(pixelAt(mock.imageData, 143, 95)).toEqual([255, 255, 255, 255]);
    });
  });

  it("ignores non-TV_GRAPHICS commands", () => {
    decoder.setCdgData(makePack(0x00, MEMORY_PRESET));
    decoder.updateFrame(0);
    expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 0, 0, 255]);
  });

  it("ignores unknown TV_GRAPHICS instructions", () => {
    decoder.setCdgData(makePack(TV_GRAPHICS, 0x99));
    decoder.updateFrame(0);
    expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 0, 0, 255]);
  });

  // ── updateFrame — sync behaviour ────────────────────────────────────────────

  describe("backward seek", () => {
    it("resets state and re-decodes from the start when seeking back more than one second", () => {
      // Pack 0: blue palette. Pack 300: red palette (overwrites blue).
      // After playing to pack 306, palette[0] = red → pixels are red.
      // Seeking back to time 0 triggers a reset because playPosition (0) is
      // more than one second (300 packs) behind currentPack (306).
      // Re-decoding from pack 0 only reaches the blue CLUT, not the red one.
      const bluePack = makeClutPack(LOAD_CLUT_LO, [[0, 0, 15]]);
      const emptyPacks = makePack(0x00, 0x00).repeat(299);
      const redPack = makeClutPack(LOAD_CLUT_LO, [[15, 0, 0]]);
      decoder.setCdgData(bluePack + emptyPacks + redPack);

      decoder.updateFrame(306 / 300); // advances to pack 306; palette[0] = red
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([255, 0, 0, 255]);

      decoder.updateFrame(0); // seeks back; resets + re-decodes packs 0-5 only
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 0, 255, 255]);
    });
  });
});
