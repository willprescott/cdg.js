class CDGDecoder {
  static #CDG_ENUM = {
    VRAM_HEIGHT: 216, // Height of VRAM, in pixels.
    VISIBLE_WIDTH: 288, // Width (or pitch) of visible screen, in pixels.
    VISIBLE_HEIGHT: 192, // Height of visible screen, in pixels.
    FONT_WIDTH: 6, // Width of one "font" (or block).
    FONT_HEIGHT: 12, // Height of one "font" (or block).
    NUM_X_FONTS: 50, // Number of horizontal fonts contained in VRAM.
    NUM_Y_FONTS: 18, // Number of vertical fonts contained in VRAM.
    VISIBLE_X_FONTS: 48, // Number of visible horizontal font columns.
    VISIBLE_Y_FONTS: 16, // Number of visible vertical font rows.
    PALETTE_ENTRIES: 16, // Number of CLUT palette entries.
    CLUT_ENTRIES: 8, // Number of palette entries per LOAD_CLUT instruction.
    PACK_SIZE: 24, // Size of one CDG data pack, in bytes.
    PACKS_PER_SECOND: 300, // CD+G standard pack rate.
    TV_GRAPHICS: 0x09, // 50x18 (48x16) 16 color TV graphics mode.
    MEMORY_PRESET: 0x01, // Set all VRAM to palette index.
    BORDER_PRESET: 0x02, // Set border to palette index.
    LOAD_CLUT_LO: 0x1e, // Load Color Look Up Table index 0 through 7.
    LOAD_CLUT_HI: 0x1f, // Load Color Look Up Table index 8 through 15.
    COPY_FONT: 0x06, // Copy 12x6 pixel font to screen.
    XOR_FONT: 0x26, // XOR 12x6 pixel font with existing VRAM values.
    SCROLL_PRESET: 0x14, // Update scroll offset, copying if 0x20 or 0x10.
    SCROLL_COPY: 0x18, // Update scroll offset, setting color if 0x20 or 0x10.
    SMOOTHING_PACKS: 6, // Look-ahead buffer for smooth audio/graphics sync.
  };

  #borderEl;
  #rgbaContext;
  #rgbaImageData;
  #palette;
  #vram;
  #dirtyBlocks;
  #cdgData = null;
  #borderIndex = 0x00;
  #currentPack = 0x00;
  #borderDirty = false;
  #screenDirty = false;

  constructor(canvasEl, borderEl) {
    const e = CDGDecoder.#CDG_ENUM;
    this.#borderEl = borderEl;
    this.#rgbaContext = canvasEl.getContext("2d");
    this.#rgbaImageData = this.#rgbaContext.createImageData(
      e.VISIBLE_WIDTH,
      e.VISIBLE_HEIGHT,
    );
    this.#palette = new Uint32Array(e.PALETTE_ENTRIES);
    this.#vram = new Uint32Array(e.NUM_X_FONTS * e.VRAM_HEIGHT);
    this.#dirtyBlocks = new Uint8Array(e.NUM_X_FONTS * e.NUM_Y_FONTS);
    canvasEl.width = e.VISIBLE_WIDTH;
    canvasEl.height = e.VISIBLE_HEIGHT;
    this.#resetCdgState();
  }

  /**
   * Sets the raw CDG data buffer to be decoded.
   * @param {String} data
   */
  setCdgData(data) {
    this.#resetCdgState();
    this.#redrawCanvas();
    this.#cdgData = data;
  }

  /**
   * Updates the CDG frame based on the current playback time.
   * @param {float} currentTime
   */
  updateFrame(currentTime) {
    const e = CDGDecoder.#CDG_ENUM;
    let playPosition = Math.floor(currentTime * e.PACKS_PER_SECOND);
    let positionToPlay;
    playPosition = playPosition < 0 ? 0 : playPosition;
    // Render from the beginning of the stream if a reverse seek of more than one second occurred.
    if (playPosition < this.#currentPack - e.PACKS_PER_SECOND) {
      this.#resetCdgState();
      this.#currentPack = 0;
    }
    positionToPlay = this.#currentPack + e.SMOOTHING_PACKS;
    // Jump to the actual play position if it's ahead of our calculated smoothed position.
    positionToPlay =
      playPosition > positionToPlay ? playPosition : positionToPlay;
    // Check if we should render any packs, and do so if needed.
    if (positionToPlay > this.#currentPack) {
      this.#decodePacks(positionToPlay);
      this.#redrawCanvas();
    }
  }

  /** Resets all decoder state to initial values (pack counter, palette, VRAM, dirty flags). */
  #resetCdgState() {
    this.#currentPack = 0x00;
    this.#borderIndex = 0x00;
    this.#palette.fill(0);
    this.#clearVram(0x00);
    this.#dirtyBlocks.fill(0);
  }

  /** Flushes any pending state changes to the canvas and border element. */
  #redrawCanvas() {
    const e = CDGDecoder.#CDG_ENUM;
    if (this.#borderDirty || this.#screenDirty) {
      this.#borderEl.style.backgroundColor = this.#paletteIndexToRgbTuple(
        this.#borderIndex,
      );
      this.#borderDirty = false;
    }
    if (this.#screenDirty) {
      this.#renderScreenToRgb();
      this.#screenDirty = false;
      this.#dirtyBlocks.fill(0);
      this.#rgbaContext.putImageData(this.#rgbaImageData, 0, 0);
    } else {
      const localContext = this.#rgbaContext;
      const localRgbaImageData = this.#rgbaImageData;
      const localDirty = this.#dirtyBlocks;
      let blk = 0x00;
      for (let yBlk = 1; yBlk <= e.VISIBLE_Y_FONTS; ++yBlk) {
        blk = yBlk * e.NUM_X_FONTS + 1;
        for (let xBlk = 1; xBlk <= e.VISIBLE_X_FONTS; ++xBlk) {
          if (localDirty[blk]) {
            this.#renderBlockToRgb(xBlk, yBlk);
            localContext.putImageData(
              localRgbaImageData,
              0,
              0,
              (xBlk - 1) * e.FONT_WIDTH,
              (yBlk - 1) * e.FONT_HEIGHT,
              e.FONT_WIDTH,
              e.FONT_HEIGHT,
            );
            localDirty[blk] = 0x00;
          }
          ++blk;
        }
      }
    }
  }

  /**
   * Decodes CDG packs up to the given position.
   * @param {number} playbackPosition - Pack index to decode up to (exclusive)
   */
  #decodePacks(playbackPosition) {
    const e = CDGDecoder.#CDG_ENUM;
    for (
      let currPack = this.#currentPack;
      currPack < playbackPosition;
      currPack++
    ) {
      const startOffset = currPack * e.PACK_SIZE;
      const currCommand = this.#cdgData.charCodeAt(startOffset) & 0x3f;
      if (currCommand == e.TV_GRAPHICS) {
        const thisPack = this.#cdgData.slice(
          startOffset,
          startOffset + e.PACK_SIZE,
        );
        const currInstruction = thisPack.charCodeAt(1) & 0x3f;
        switch (currInstruction) {
          case e.MEMORY_PRESET:
            this.#procMemoryPreset(thisPack);
            break;
          case e.BORDER_PRESET:
            this.#procBorderPreset(thisPack);
            break;
          case e.LOAD_CLUT_LO:
          case e.LOAD_CLUT_HI:
            this.#procLoadClut(thisPack);
            break;
          case e.COPY_FONT:
          case e.XOR_FONT:
            this.#procWriteFont(thisPack);
            break;
          case e.SCROLL_PRESET:
          case e.SCROLL_COPY:
            this.#procDoScroll(thisPack);
            break;
        }
      }
    }
    this.#currentPack = playbackPosition;
  }

  #paletteIndexToRgbTuple(requestedIndex) {
    const pal = this.#palette;
    return (
      "rgb(" +
      ((pal[requestedIndex] >> 16) & 0xff) +
      "," +
      ((pal[requestedIndex] >> 8) & 0xff) +
      "," +
      ((pal[requestedIndex] >> 0) & 0xff) +
      ")"
    );
  }

  #fillLineWithPaletteIndex(requestedIndex) {
    let adjustedValue = requestedIndex;
    adjustedValue |= requestedIndex << 4;
    adjustedValue |= requestedIndex << 8;
    adjustedValue |= requestedIndex << 12;
    adjustedValue |= requestedIndex << 16;
    adjustedValue |= requestedIndex << 20;
    return adjustedValue;
  }

  #clearVram(colorIndex) {
    this.#vram.fill(this.#fillLineWithPaletteIndex(colorIndex));
    this.#screenDirty = true;
  }

  // Alpha is always 0xFF; CD+G's SET_TRANSPARENT instruction is rarely used on real discs.
  #writeLineSegment(rgba, offset, pal, lineIndices) {
    for (const shift of [0, 4, 8, 12, 16, 20]) {
      const rgb = pal[(lineIndices >> shift) & 0x0f];
      rgba[offset++] = (rgb >> 16) & 0xff;
      rgba[offset++] = (rgb >> 8) & 0xff;
      rgba[offset++] = rgb & 0xff;
      rgba[offset++] = 0xff;
    }
    return offset;
  }

  #renderScreenToRgb() {
    const e = CDGDecoder.#CDG_ENUM;
    const localRgba = this.#rgbaImageData.data;
    const localPal = this.#palette;
    const localVram = this.#vram;
    let vramLoc = e.NUM_X_FONTS * e.FONT_HEIGHT + 1; // Skip the top offscreen row and left border column.
    let rgbLoc = 0x00;
    for (let yPxl = 0; yPxl < e.VISIBLE_HEIGHT; ++yPxl) {
      for (let xPxl = 0; xPxl < e.VISIBLE_X_FONTS; ++xPxl) {
        rgbLoc = this.#writeLineSegment(
          localRgba,
          rgbLoc,
          localPal,
          localVram[vramLoc++],
        );
      }
      vramLoc += e.NUM_X_FONTS - e.VISIBLE_X_FONTS; // Skip the offscreen font blocks.
    }
  }

  #renderBlockToRgb(xStart, yStart) {
    const e = CDGDecoder.#CDG_ENUM;
    const localRgba = this.#rgbaImageData.data;
    const localPal = this.#palette;
    const localVram = this.#vram;
    let vramLoc = yStart * e.NUM_X_FONTS * e.FONT_HEIGHT + xStart;
    const vramInc = e.NUM_X_FONTS;
    const vramEnd = vramLoc + e.NUM_X_FONTS * e.FONT_HEIGHT;
    let rgbLoc = (yStart - 1) * e.FONT_HEIGHT * e.VISIBLE_WIDTH;
    rgbLoc += (xStart - 1) * e.FONT_WIDTH;
    rgbLoc *= 4;
    const rgbInc = (e.VISIBLE_WIDTH - e.FONT_WIDTH) * 4;
    while (vramLoc < vramEnd) {
      rgbLoc = this.#writeLineSegment(
        localRgba,
        rgbLoc,
        localPal,
        localVram[vramLoc],
      );
      vramLoc += vramInc;
      rgbLoc += rgbInc;
    }
  }

  #procBorderPreset(cdgPack) {
    // The border is a DIV element — only touch it when the RGB value actually changes,
    // as style changes can be expensive in some browsers.
    const newBorderIndex = cdgPack.charCodeAt(4) & 0x3f;
    if (this.#palette[newBorderIndex] != this.#palette[this.#borderIndex]) {
      this.#borderDirty = true;
    }
    this.#borderIndex = newBorderIndex;
  }

  #procMemoryPreset(cdgPack) {
    this.#clearVram(cdgPack.charCodeAt(4) & 0x3f);
  }

  #procLoadClut(cdgPack) {
    const e = CDGDecoder.#CDG_ENUM;
    const localPalette = this.#palette;
    // If instruction is 0x1E then 8*0=0, if 0x1F then 8*1=8 for offset.
    const palOffset = (cdgPack.charCodeAt(1) & 0x01) * e.CLUT_ENTRIES;
    for (let palInc = 0; palInc < e.CLUT_ENTRIES; palInc++) {
      const tempIdx = palInc + palOffset;
      let tempRgb = 0x00000000;
      let tempEntry = (cdgPack.charCodeAt(palInc * 2 + 4) & 0x3c) >> 2;
      tempRgb |= (tempEntry * 17) << 16;
      tempEntry =
        ((cdgPack.charCodeAt(palInc * 2 + 4) & 0x03) << 2) |
        ((cdgPack.charCodeAt(palInc * 2 + 5) & 0x30) >> 4);
      tempRgb |= (tempEntry * 17) << 8;
      tempEntry = cdgPack.charCodeAt(palInc * 2 + 5) & 0x0f;
      tempRgb |= (tempEntry * 17) << 0;
      // Only update if the color has changed; a CLUT load triggers a full screen redraw.
      if (tempRgb != localPalette[tempIdx]) {
        localPalette[tempIdx] = tempRgb;
        this.#screenDirty = true;
        if (tempIdx == this.#borderIndex) {
          this.#borderDirty = true;
        }
      }
    }
  }

  #procWriteFont(cdgPack) {
    const e = CDGDecoder.#CDG_ENUM;
    const localVram = this.#vram;
    const localDirty = this.#dirtyBlocks;
    // Hacky hack to play channels 0 and 1 only... Ideally, there should be a function and user option to get/set.
    const activeChannels = 0x03;
    const subcodeChannel =
      ((cdgPack.charCodeAt(4) & 0x30) >> 2) |
      ((cdgPack.charCodeAt(5) & 0x30) >> 4);
    const xorVar = cdgPack.charCodeAt(1) & 0x20;
    if (activeChannels >> subcodeChannel && 0x01) {
      const xLocation = cdgPack.charCodeAt(7) & 0x3f;
      const yLocation = cdgPack.charCodeAt(6) & 0x1f;
      // Verify we're not going to overrun the boundaries (i.e. bad data from a scratched disc).
      if (xLocation < e.NUM_X_FONTS && yLocation < e.NUM_Y_FONTS) {
        const startPixel =
          yLocation * e.NUM_X_FONTS * e.FONT_HEIGHT + xLocation;
        // NOTE: Profiling indicates charCodeAt() uses ~80% of the CPU consumed for this function.
        // Caching these values reduces that to a negligible amount.
        const currentIndexes = [
          cdgPack.charCodeAt(4) & 0x0f,
          cdgPack.charCodeAt(5) & 0x0f,
        ];
        let currentRow = 0x00;
        let tempPxl = 0x00;
        for (let yInc = 0; yInc < e.FONT_HEIGHT; yInc++) {
          const pixPos = yInc * e.NUM_X_FONTS + startPixel;
          currentRow = cdgPack.charCodeAt(yInc + 8);
          tempPxl = currentIndexes[(currentRow >> 5) & 0x01] << 0;
          tempPxl |= currentIndexes[(currentRow >> 4) & 0x01] << 4;
          tempPxl |= currentIndexes[(currentRow >> 3) & 0x01] << 8;
          tempPxl |= currentIndexes[(currentRow >> 2) & 0x01] << 12;
          tempPxl |= currentIndexes[(currentRow >> 1) & 0x01] << 16;
          tempPxl |= currentIndexes[(currentRow >> 0) & 0x01] << 20;
          if (xorVar) {
            localVram[pixPos] ^= tempPxl;
          } else {
            localVram[pixPos] = tempPxl;
          }
        }
        localDirty[yLocation * e.NUM_X_FONTS + xLocation] = 0x01;
      }
    }
  }

  #procDoScroll(cdgPack) {
    let direction;
    const copyFlag = (cdgPack.charCodeAt(1) & 0x08) >> 3;
    const color = cdgPack.charCodeAt(4) & 0x0f;
    if ((direction = (cdgPack.charCodeAt(5) & 0x30) >> 4)) {
      this.#procVramHscroll(direction, copyFlag, color);
    }
    if ((direction = (cdgPack.charCodeAt(6) & 0x30) >> 4)) {
      this.#procVramVscroll(direction, copyFlag, color);
    }
    this.#screenDirty = true;
  }

  #procVramHscroll(direction, copyFlag, color) {
    const e = CDGDecoder.#CDG_ENUM;
    let xSrc, ySrc, yStart, buf = 0;
    const lineColor = this.#fillLineWithPaletteIndex(color);
    const localVram = this.#vram;
    const vramSize = e.NUM_X_FONTS * e.VRAM_HEIGHT;
    if (direction == 0x02) {
      for (ySrc = 0; ySrc < vramSize; ySrc += e.NUM_X_FONTS) {
        yStart = ySrc;
        buf = localVram[yStart];
        for (xSrc = yStart + 1; xSrc < yStart + e.NUM_X_FONTS; xSrc++) {
          localVram[xSrc - 1] = localVram[xSrc];
        }
        localVram[yStart + e.NUM_X_FONTS - 1] = copyFlag ? buf : lineColor;
      }
    } else if (direction == 0x01) {
      for (ySrc = 0; ySrc < vramSize; ySrc += e.NUM_X_FONTS) {
        yStart = ySrc;
        buf = localVram[yStart + e.NUM_X_FONTS - 1];
        for (xSrc = yStart + e.NUM_X_FONTS - 2; xSrc >= yStart; xSrc--) {
          localVram[xSrc + 1] = localVram[xSrc];
        }
        localVram[yStart] = copyFlag ? buf : lineColor;
      }
    }
  }

  #procVramVscroll(direction, copyFlag, color) {
    const e = CDGDecoder.#CDG_ENUM;
    let dstIdx, srcIdx;
    const offscreenSize = e.NUM_X_FONTS * e.FONT_HEIGHT;
    const vramSize = e.NUM_X_FONTS * e.VRAM_HEIGHT;
    const scrollStart = e.NUM_X_FONTS * (e.VRAM_HEIGHT - e.FONT_HEIGHT);
    const buf = new Uint32Array(offscreenSize);
    const lineColor = this.#fillLineWithPaletteIndex(color);
    const localVram = this.#vram;
    if (direction == 0x02) {
      dstIdx = 0;
      for (srcIdx = 0; srcIdx < offscreenSize; srcIdx++) {
        buf[dstIdx++] = localVram[srcIdx];
      }
      dstIdx = 0;
      for (srcIdx = offscreenSize; srcIdx < vramSize; srcIdx++) {
        localVram[dstIdx++] = localVram[srcIdx];
      }
      dstIdx = scrollStart;
      for (srcIdx = 0; srcIdx < offscreenSize; srcIdx++) {
        localVram[dstIdx++] = copyFlag ? buf[srcIdx] : lineColor;
      }
    } else if (direction == 0x01) {
      dstIdx = 0;
      for (srcIdx = scrollStart; srcIdx < vramSize; srcIdx++) {
        buf[dstIdx++] = localVram[srcIdx];
      }
      for (srcIdx = scrollStart - 1; srcIdx > 0; srcIdx--) {
        localVram[srcIdx + offscreenSize] = localVram[srcIdx];
      }
      for (srcIdx = 0; srcIdx < offscreenSize; srcIdx++) {
        localVram[srcIdx] = copyFlag ? buf[srcIdx] : lineColor;
      }
    }
  }
}

export { CDGDecoder };
