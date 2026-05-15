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

  // ── Pack counter ────────────────────────────────────────────────────────────

  describe("getCurrentPack", () => {
    it("starts at 0", () => {
      expect(decoder.getCurrentPack()).toBe(0);
    });
  });

  describe("decodePacks", () => {
    it("advances the pack counter to the requested position", () => {
      decoder.decodePacks(makePack(0x00, 0x00).repeat(5), 5);
      expect(decoder.getCurrentPack()).toBe(5);
    });

    it("skips non-TV_GRAPHICS commands without error", () => {
      decoder.decodePacks(makePack(0x00, MEMORY_PRESET), 1);
      expect(decoder.getCurrentPack()).toBe(1);
    });

    it("skips unknown TV_GRAPHICS instructions without error", () => {
      decoder.decodePacks(makePack(TV_GRAPHICS, 0x99), 1);
      expect(decoder.getCurrentPack()).toBe(1);
    });
  });

  describe("resetCdgState", () => {
    it("resets the pack counter to 0", () => {
      decoder.decodePacks(makePack(0x00, 0x00).repeat(10), 10);
      decoder.resetCdgState();
      expect(decoder.getCurrentPack()).toBe(0);
    });

    it("clears the canvas to black on the next redrawCanvas call", () => {
      // Load palette[0] = red, verify it renders, then reset
      const clutPack = makeClutPack(LOAD_CLUT_LO, [[15, 0, 0]]);
      decoder.decodePacks(clutPack, 1);
      decoder.redrawCanvas();
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([255, 0, 0, 255]);

      decoder.resetCdgState();
      decoder.redrawCanvas();
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 0, 0, 255]);
    });
  });

  // ── Palette loading ─────────────────────────────────────────────────────────

  describe("LOAD_CLUT_LO", () => {
    it("loads palette entries 0-7 and renders them correctly", () => {
      // palette[0] = red (15, 0, 0). All VRAM starts as index 0, so all
      // pixels should become red after redrawCanvas.
      const pack = makeClutPack(LOAD_CLUT_LO, [[15, 0, 0]]);
      decoder.decodePacks(pack, 1);
      decoder.redrawCanvas();
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([255, 0, 0, 255]);
    });

    it("does not alter pixels when the loaded color matches the existing value", () => {
      // Loading black over the default black palette should leave pixels black.
      const pack = makeClutPack(LOAD_CLUT_LO, [[0, 0, 0]]);
      decoder.decodePacks(pack, 1);
      decoder.redrawCanvas();
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 0, 0, 255]);
    });
  });

  describe("LOAD_CLUT_HI", () => {
    it("loads palette entries 8-15 and renders them correctly", () => {
      // palette[8] = blue. MEMORY_PRESET fills all VRAM with index 8.
      const clutPack = makeClutPack(LOAD_CLUT_HI, [[0, 0, 15]]);
      const memPreset = makePack(TV_GRAPHICS, MEMORY_PRESET, [8]);
      decoder.decodePacks(clutPack + memPreset, 2);
      decoder.redrawCanvas();
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 0, 255, 255]);
    });
  });

  // ── VRAM operations ─────────────────────────────────────────────────────────

  describe("MEMORY_PRESET", () => {
    it("fills the entire VRAM with the specified palette index", () => {
      // palette[1] = green. MEMORY_PRESET with index 1 → all pixels green.
      const clutPack = makeClutPack(LOAD_CLUT_LO, [[0, 0, 0], [0, 15, 0]]);
      const memPreset = makePack(TV_GRAPHICS, MEMORY_PRESET, [1]);
      decoder.decodePacks(clutPack + memPreset, 2);
      decoder.redrawCanvas();
      // Check top-left and bottom-right of the visible area
      expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 255, 0, 255]);
      expect(pixelAt(mock.imageData, 287, 191)).toEqual([0, 255, 0, 255]);
    });
  });

  describe("BORDER_PRESET", () => {
    it("sets the border div background color to the specified palette entry", () => {
      // palette[1] = blue. BORDER_PRESET with index 1 → border turns blue.
      const clutPack = makeClutPack(LOAD_CLUT_LO, [[0, 0, 0], [0, 0, 15]]);
      const borderPack = makePack(TV_GRAPHICS, BORDER_PRESET, [1]);
      decoder.decodePacks(clutPack + borderPack, 2);
      decoder.redrawCanvas();
      expect(borderDiv.style.backgroundColor).toBe("rgb(0,0,255)");
    });

    it("reflects palette changes in the border color when the index is unchanged", () => {
      // palette[0] starts black (default border index). Loading red into
      // palette[0] should update the border to red on the next redraw.
      const clutPack = makeClutPack(LOAD_CLUT_LO, [[15, 0, 0]]);
      decoder.decodePacks(clutPack, 1);
      decoder.redrawCanvas();
      expect(borderDiv.style.backgroundColor).toBe("rgb(255,0,0)");
    });
  });

  // ── Font rendering ──────────────────────────────────────────────────────────

  describe("COPY_FONT", () => {
    it("writes pixel data into VRAM and renders the block correctly", () => {
      // palette[0]=black, palette[1]=red. Write font at block (1,1) with
      // all pixels = color1 (red), then verify the top-left visible pixel.
      const clutPack = makeClutPack(LOAD_CLUT_LO, [[0, 0, 0], [15, 0, 0]]);
      const fontPack = makeFontPack(COPY_FONT, 1, 1, 0, 1, new Array(12).fill(0x3f));
      const cdgData = clutPack + fontPack;

      decoder.decodePacks(cdgData, 1); // CLUT → screenDirty
      decoder.redrawCanvas();          // full render clears screenDirty (all black)
      decoder.decodePacks(cdgData, 2); // WRITE_FONT → marks block (1,1) dirty
      decoder.redrawCanvas();          // block render writes red into block (1,1)

      expect(pixelAt(mock.imageData, 0, 0)).toEqual([255, 0, 0, 255]);
    });
  });

  describe("XOR_FONT", () => {
    it("XORs pixel data into VRAM, toggling written pixels back to the original color", () => {
      // palette[0]=black, palette[1]=green. Write all-green block, then
      // XOR with the same pattern → the block XORs back to all-black.
      const clutPack = makeClutPack(LOAD_CLUT_LO, [[0, 0, 0], [0, 15, 0]]);
      const allOnes = new Array(12).fill(0x3f);
      const copyPack = makeFontPack(COPY_FONT, 1, 1, 0, 1, allOnes);
      const xorPack = makeFontPack(XOR_FONT, 1, 1, 0, 1, allOnes);
      const cdgData = clutPack + copyPack + xorPack;

      decoder.decodePacks(cdgData, 1); // CLUT
      decoder.redrawCanvas();          // full render (all black)
      decoder.decodePacks(cdgData, 2); // COPY_FONT → block (1,1) = green
      decoder.decodePacks(cdgData, 3); // XOR_FONT  → block (1,1) XOR green = black
      decoder.redrawCanvas();          // block render

      expect(pixelAt(mock.imageData, 0, 0)).toEqual([0, 0, 0, 255]);
    });
  });
});
