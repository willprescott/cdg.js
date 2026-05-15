/*
 *  This library is heavily based upon CD+Graphics Magic HTML5 CD+G Player
 *  (http://cdgmagic.sourceforge.net/html5_cdgplayer/), which
 *  is distributed under the following licence conditions:
 *
 *  CD+Graphics Magic is free software: you can redistribute it and/or
 *  modify it under the terms of the GNU General Public License as
 *  published by the Free Software Foundation, either version 2 of the
 *  License, or (at your option) any later version.
 *
 *  CD+Graphics Magic is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with CD+Graphics Magic. If not, see <http://www.gnu.org/licenses/>.
 */

const CDG_ENUM = {
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
};

function CDGDecoder(canvasEl, borderEl) {
  const borderDiv = borderEl; // DIV element behind graphics canvas.
  const rgbaContext = canvasEl.getContext("2d"); // 2D context of canvas element.
  const rgbaImageData = rgbaContext.createImageData(
    CDG_ENUM.VISIBLE_WIDTH,
    CDG_ENUM.VISIBLE_HEIGHT,
  ); // 288x192 image data.
  const palette = new Array(CDG_ENUM.PALETTE_ENTRIES); // Array containing the 16 RGB palette entries.
  const vram = new Array(CDG_ENUM.NUM_X_FONTS * CDG_ENUM.VRAM_HEIGHT); // Array used for graphics VRAM.

  let borderIndex = 0x00; // The current border palette index.
  let currentPack = 0x00; // The current playback position.

  let borderDirty = false; // State variable used to determine if the background DIV needs updated.
  let screenDirty = false; // State variable used to determine if a full screen update is needed.
  const dirtyBlocks = new Array(CDG_ENUM.NUM_X_FONTS * CDG_ENUM.NUM_Y_FONTS); // Array used to determine if a given font/block has changed.

  // Reset all the CDG state variables back to initial values.
  function resetCdgState() {
    currentPack = 0x00;
    borderIndex = 0x00;
    clearPalette();
    clearVram(0x00);
    clearDirtyBlocks();
  }

  function getCurrentPack() {
    return currentPack;
  }

  function redrawCanvas() {
    // If the border color has changed, then update the background div color.
    if (borderDirty || screenDirty) {
      borderDiv.style.backgroundColor = paletteIndexToRgbTuple(borderIndex);
      borderDirty = false;
    }

    // If the screen is dirty, then it needs a full update.
    if (screenDirty) {
      renderScreenToRgb();
      screenDirty = false;
      clearDirtyBlocks();
      rgbaContext.putImageData(rgbaImageData, 0, 0);
    } else {
      const localContext = rgbaContext;
      const localRgbaImageData = rgbaImageData;
      const localDirty = dirtyBlocks;
      const localFontWidth = CDG_ENUM.FONT_WIDTH;
      const localFontHeight = CDG_ENUM.FONT_HEIGHT;
      let blk = 0x00;
      for (let yBlk = 1; yBlk <= CDG_ENUM.VISIBLE_Y_FONTS; ++yBlk) {
        blk = yBlk * CDG_ENUM.NUM_X_FONTS + 1;
        for (let xBlk = 1; xBlk <= CDG_ENUM.VISIBLE_X_FONTS; ++xBlk) {
          if (localDirty[blk]) {
            renderBlockToRgb(xBlk, yBlk);
            localContext.putImageData(
              localRgbaImageData,
              0,
              0,
              (xBlk - 1) * localFontWidth,
              (yBlk - 1) * localFontHeight,
              localFontWidth,
              localFontHeight,
            );
            localDirty[blk] = 0x00;
          }
          ++blk;
        }
      }
    }
  }

  // Decode to pack playbackPosition, using cdgFileData.
  function decodePacks(cdgFileData, playbackPosition) {
    for (let currPack = currentPack; currPack < playbackPosition; currPack++) {
      const startOffset = currPack * CDG_ENUM.PACK_SIZE;
      const currCommand = cdgFileData.charCodeAt(startOffset) & 0x3f;
      if (currCommand == CDG_ENUM.TV_GRAPHICS) {
        // Slice the file array down to a single pack array.
        const thisPack = cdgFileData.slice(
          startOffset,
          startOffset + CDG_ENUM.PACK_SIZE,
        );
        // Pluck out the graphics instruction.
        const currInstruction = thisPack.charCodeAt(1) & 0x3f;
        // Perform the instruction action.
        switch (currInstruction) {
          case CDG_ENUM.MEMORY_PRESET:
            procMemoryPreset(thisPack);
            break;
          case CDG_ENUM.BORDER_PRESET:
            procBorderPreset(thisPack);
            break;

          case CDG_ENUM.LOAD_CLUT_LO:
          case CDG_ENUM.LOAD_CLUT_HI:
            procLoadClut(thisPack);
            break;

          case CDG_ENUM.COPY_FONT:
          case CDG_ENUM.XOR_FONT:
            procWriteFont(thisPack);
            break;

          case CDG_ENUM.SCROLL_PRESET:
          case CDG_ENUM.SCROLL_COPY:
            procDoScroll(thisPack);
            break;
        }
      }
    }
    currentPack = playbackPosition;
  }

  // Convenience function to return the string "rgb(r,g,b)" CSS style tuple of a palette index.
  function paletteIndexToRgbTuple(requestedIndex) {
    return (
      "rgb(" +
      ((palette[requestedIndex] >> 16) & 0xff) +
      "," +
      ((palette[requestedIndex] >> 8) & 0xff) +
      "," +
      ((palette[requestedIndex] >> 0) & 0xff) +
      ")"
    );
  }

  // Convenience function to return a line of special packed palette values.
  function fillLineWithPaletteIndex(requestedIndex) {
    let adjustedValue = requestedIndex; // Pixel 0
    adjustedValue |= requestedIndex << 4; // Pixel 1
    adjustedValue |= requestedIndex << 8; // Pixel 2
    adjustedValue |= requestedIndex << 12; // Pixel 3
    adjustedValue |= requestedIndex << 16; // Pixel 4
    adjustedValue |= requestedIndex << 20; // Pixel 5
    return adjustedValue;
  }

  // Reset the state of all font/blocks to clean.
  function clearDirtyBlocks() {
    for (
      let blk = 0;
      blk < CDG_ENUM.NUM_X_FONTS * CDG_ENUM.NUM_Y_FONTS;
      blk++
    ) {
      dirtyBlocks[blk] = 0x00;
    }
  }

  // Reset all the palette RGB values to black.
  function clearPalette() {
    const totalPaletteEntries = CDG_ENUM.PALETTE_ENTRIES;
    for (let idx = 0; idx < totalPaletteEntries; idx++) {
      palette[idx] = 0x00;
    }
  }

  // Set all the VRAM index values to requested index.
  function clearVram(colorIndex) {
    const localVram = vram;
    const totalVramSize = localVram.length;
    const packedLineValue = fillLineWithPaletteIndex(colorIndex);
    for (let pxl = 0; pxl < totalVramSize; pxl++) {
      localVram[pxl] = packedLineValue;
    }
    screenDirty = true;
  }

  // Write one 6-pixel line segment (one VRAM word) into the RGBA buffer.
  // Alpha is always 0xFF; CD+G's SET_TRANSPARENT instruction is rarely used on real discs.
  function writeLineSegment(rgba, offset, pal, lineIndices) {
    for (const shift of [0, 4, 8, 12, 16, 20]) {
      const rgb = pal[(lineIndices >> shift) & 0x0f];
      rgba[offset++] = (rgb >> 16) & 0xff;
      rgba[offset++] = (rgb >> 8) & 0xff;
      rgba[offset++] = rgb & 0xff;
      rgba[offset++] = 0xff;
    }
    return offset;
  }

  function renderScreenToRgb() {
    const localRgba = rgbaImageData.data;
    const localPal = palette;
    const localVram = vram;

    let vramLoc = CDG_ENUM.NUM_X_FONTS * CDG_ENUM.FONT_HEIGHT + 1; // Skip the top offscreen row and left border column.
    let rgbLoc = 0x00;

    for (let yPxl = 0; yPxl < CDG_ENUM.VISIBLE_HEIGHT; ++yPxl) {
      for (let xPxl = 0; xPxl < CDG_ENUM.VISIBLE_X_FONTS; ++xPxl) {
        rgbLoc = writeLineSegment(
          localRgba,
          rgbLoc,
          localPal,
          localVram[vramLoc++],
        );
      }
      vramLoc += CDG_ENUM.NUM_X_FONTS - CDG_ENUM.VISIBLE_X_FONTS; // Skip the offscreen font blocks.
    }
  }

  function renderBlockToRgb(xStart, yStart) {
    const localRgba = rgbaImageData.data;
    const localPal = palette;
    const localVram = vram;

    let vramLoc = yStart * CDG_ENUM.NUM_X_FONTS * CDG_ENUM.FONT_HEIGHT + xStart;
    const vramInc = CDG_ENUM.NUM_X_FONTS;
    const vramEnd = vramLoc + CDG_ENUM.NUM_X_FONTS * CDG_ENUM.FONT_HEIGHT;
    let rgbLoc = (yStart - 1) * CDG_ENUM.FONT_HEIGHT * CDG_ENUM.VISIBLE_WIDTH;
    rgbLoc += (xStart - 1) * CDG_ENUM.FONT_WIDTH;
    rgbLoc *= 4;
    const rgbInc = (CDG_ENUM.VISIBLE_WIDTH - CDG_ENUM.FONT_WIDTH) * 4;

    while (vramLoc < vramEnd) {
      rgbLoc = writeLineSegment(
        localRgba,
        rgbLoc,
        localPal,
        localVram[vramLoc],
      );
      vramLoc += vramInc;
      rgbLoc += rgbInc;
    }
  }

  function procBorderPreset(cdgPack) {
    // NOTE: The "border" is actually a DIV element, which can be very expensive to change in some browsers.
    // This somewhat bizarre check ensures that the DIV is only touched if the actual RGB color is different,
    // but the border index variable is always set... A similar check is also performed during palette update.
    const newBorderIndex = cdgPack.charCodeAt(4) & 0x3f; // Get the border index from subcode.
    // Check if the new border **RGB** color is different from the old one.
    if (palette[newBorderIndex] != palette[borderIndex]) {
      borderDirty = true; // Border needs updating.
    }
    borderIndex = newBorderIndex; // Set the new index.
  }

  function procMemoryPreset(cdgPack) {
    clearVram(cdgPack.charCodeAt(4) & 0x3f);
  }

  function procLoadClut(cdgPack) {
    const localPalette = palette;
    // If instruction is 0x1E then 8*0=0, if 0x1F then 8*1=8 for offset.
    const palOffset = (cdgPack.charCodeAt(1) & 0x01) * CDG_ENUM.CLUT_ENTRIES;
    // Step through the eight color indices, setting the RGB values.
    for (let palInc = 0; palInc < CDG_ENUM.CLUT_ENTRIES; palInc++) {
      const tempIdx = palInc + palOffset;
      let tempRgb = 0x00000000;
      let tempEntry = 0x00000000;
      // Set red.
      tempEntry = (cdgPack.charCodeAt(palInc * 2 + 4) & 0x3c) >> 2;
      tempRgb |= (tempEntry * 17) << 16;
      // Set green.
      tempEntry =
        ((cdgPack.charCodeAt(palInc * 2 + 4) & 0x03) << 2) |
        ((cdgPack.charCodeAt(palInc * 2 + 5) & 0x30) >> 4);
      tempRgb |= (tempEntry * 17) << 8;
      // Set blue.
      tempEntry = cdgPack.charCodeAt(palInc * 2 + 5) & 0x0f;
      tempRgb |= (tempEntry * 17) << 0;
      // Put the full RGB value into the index position, but only if it's different.
      if (tempRgb != localPalette[tempIdx]) {
        localPalette[tempIdx] = tempRgb;
        screenDirty = true; // The colors are now different, so we need to update the whole screen.
        if (tempIdx == borderIndex) {
          borderDirty = true;
        } // The border color has changed.
      }
    }
  }

  function procWriteFont(cdgPack) {
    const localVram = vram;
    const localDirty = dirtyBlocks;
    // Hacky hack to play channels 0 and 1 only... Ideally, there should be a function and user option to get/set.
    const activeChannels = 0x03;
    // First, get the channel...
    const subcodeChannel =
      ((cdgPack.charCodeAt(4) & 0x30) >> 2) |
      ((cdgPack.charCodeAt(5) & 0x30) >> 4);
    const xorVar = cdgPack.charCodeAt(1) & 0x20;
    // Then see if we should display it.
    if (activeChannels >> subcodeChannel && 0x01) {
      const xLocation = cdgPack.charCodeAt(7) & 0x3f; // Get horizontal font location.
      const yLocation = cdgPack.charCodeAt(6) & 0x1f; // Get vertical font location.

      // Verify we're not going to overrun the boundaries (i.e. bad data from a scratched disc).
      if (
        xLocation < CDG_ENUM.NUM_X_FONTS &&
        yLocation < CDG_ENUM.NUM_Y_FONTS
      ) {
        const startPixel =
          yLocation * CDG_ENUM.NUM_X_FONTS * CDG_ENUM.FONT_HEIGHT + xLocation; // Location of first pixel of this font in linear VRAM.
        // NOTE: Profiling indicates charCodeAt() uses ~80% of the CPU consumed for this function.
        // Caching these values reduces that to a negligible amount.
        const currentIndexes = [
          cdgPack.charCodeAt(4) & 0x0f,
          cdgPack.charCodeAt(5) & 0x0f,
        ]; // Current colors.
        let currentRow = 0x00; // Subcode byte for current pixel row.
        let tempPxl = 0x00; // Decoded and packed 4bit pixel index values of current row.
        for (let yInc = 0; yInc < CDG_ENUM.FONT_HEIGHT; yInc++) {
          const pixPos = yInc * CDG_ENUM.NUM_X_FONTS + startPixel; // Location of the first pixel of this row in linear VRAM.
          currentRow = cdgPack.charCodeAt(yInc + 8); // Get the subcode byte for the current row.
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
        } // End of Y loop.
        // Mark this block as needing an update.
        localDirty[yLocation * CDG_ENUM.NUM_X_FONTS + xLocation] = 0x01;
      } // End of location check.
    } // End of channel check.
  }

  function procDoScroll(cdgPack) {
    let direction;
    const copyFlag = (cdgPack.charCodeAt(1) & 0x08) >> 3;
    const color = cdgPack.charCodeAt(4) & 0x0f; // Color index to use for preset type.

    // Process horizontal commands.
    if ((direction = (cdgPack.charCodeAt(5) & 0x30) >> 4)) {
      procVramHscroll(direction, copyFlag, color);
    }
    // Process vertical commands.
    if ((direction = (cdgPack.charCodeAt(6) & 0x30) >> 4)) {
      procVramVscroll(direction, copyFlag, color);
    }
    screenDirty = true; // Entire screen needs to be redrawn.
  }

  function procVramHscroll(direction, copyFlag, color) {
    let xSrc,
      ySrc,
      yStart,
      buf = 0;
    const lineColor = fillLineWithPaletteIndex(color);
    const localVram = vram;
    const vramSize = CDG_ENUM.NUM_X_FONTS * CDG_ENUM.VRAM_HEIGHT;
    if (direction == 0x02) {
      // Step through the lines one at a time...
      for (ySrc = 0; ySrc < vramSize; ySrc += CDG_ENUM.NUM_X_FONTS) {
        yStart = ySrc;
        buf = localVram[yStart];
        for (xSrc = yStart + 1; xSrc < yStart + CDG_ENUM.NUM_X_FONTS; xSrc++) {
          localVram[xSrc - 1] = localVram[xSrc];
        }
        if (copyFlag) {
          localVram[yStart + CDG_ENUM.NUM_X_FONTS - 1] = buf;
        } else {
          localVram[yStart + CDG_ENUM.NUM_X_FONTS - 1] = lineColor;
        }
      }
    } else if (direction == 0x01) {
      // Step through the lines one at a time.
      for (ySrc = 0; ySrc < vramSize; ySrc += CDG_ENUM.NUM_X_FONTS) {
        // Copy the last element to the buffer.
        yStart = ySrc;
        buf = localVram[yStart + CDG_ENUM.NUM_X_FONTS - 1];
        for (xSrc = yStart + CDG_ENUM.NUM_X_FONTS - 2; xSrc >= yStart; xSrc--) {
          localVram[xSrc + 1] = localVram[xSrc];
        }
        if (copyFlag) {
          localVram[yStart] = buf;
        } else {
          localVram[yStart] = lineColor;
        }
      }
    }
  }

  function procVramVscroll(direction, copyFlag, color) {
    let dstIdx, srcIdx;
    const offscreenSize = CDG_ENUM.NUM_X_FONTS * CDG_ENUM.FONT_HEIGHT;
    const vramSize = CDG_ENUM.NUM_X_FONTS * CDG_ENUM.VRAM_HEIGHT;
    const scrollStart =
      CDG_ENUM.NUM_X_FONTS * (CDG_ENUM.VRAM_HEIGHT - CDG_ENUM.FONT_HEIGHT);
    const buf = new Array(offscreenSize);
    const lineColor = fillLineWithPaletteIndex(color);
    const localVram = vram;
    if (direction == 0x02) {
      dstIdx = 0; // Buffer destination starts at 0.
      // Copy the top offscreen row into the buffer.
      for (srcIdx = 0; srcIdx < offscreenSize; srcIdx++) {
        buf[dstIdx++] = localVram[srcIdx];
      }
      dstIdx = 0; // Destination starts at the first line.
      for (srcIdx = offscreenSize; srcIdx < vramSize; srcIdx++) {
        localVram[dstIdx++] = localVram[srcIdx];
      }
      dstIdx = scrollStart; // Destination begins at the last font row.
      if (copyFlag) {
        for (srcIdx = 0; srcIdx < offscreenSize; srcIdx++) {
          localVram[dstIdx++] = buf[srcIdx];
        }
      } else {
        for (srcIdx = 0; srcIdx < offscreenSize; srcIdx++) {
          localVram[dstIdx++] = lineColor;
        }
      }
    } else if (direction == 0x01) {
      dstIdx = 0; // Buffer destination starts at 0.
      // Copy the bottom offscreen row into the buffer.
      for (srcIdx = scrollStart; srcIdx < vramSize; srcIdx++) {
        buf[dstIdx++] = localVram[srcIdx];
      }
      for (srcIdx = scrollStart - 1; srcIdx > 0; srcIdx--) {
        localVram[srcIdx + offscreenSize] = localVram[srcIdx];
      }
      if (copyFlag) {
        for (srcIdx = 0; srcIdx < offscreenSize; srcIdx++) {
          localVram[srcIdx] = buf[srcIdx];
        }
      } else {
        for (srcIdx = 0; srcIdx < offscreenSize; srcIdx++) {
          localVram[srcIdx] = lineColor;
        }
      }
    }
  }

  // Bind the public functions to member variables.
  this.getCurrentPack = getCurrentPack;
  this.resetCdgState = resetCdgState;
  this.redrawCanvas = redrawCanvas;
  this.decodePacks = decodePacks;
  this.resetCdgState();
}

function CDGPlayer(containerId, initOptions) {
  const UPDATE_INTERVAL_MS = 20; // Canvas refresh rate.
  const SMOOTHING_PACKS = 6; // Look-ahead buffer for smooth audio/graphics sync.

  const defaults = {
    mediaPath: "",
    audioFormat: "mp3",
    cdgFileExtension: "cdg",
  };
  const audioTypes = {
    mp3: 'audio/mpeg; codecs="mp3"',
    ogg: 'audio/ogg; codecs="vorbis"',
  };
  const listeners = {};
  let audioPlayer = null;
  let audioSourceElement = null;
  let cdgIntervalID = null;
  let cdgData = null;
  let cdgDecoder = null;

  function emit(event, ...args) {
    if (listeners[event] && listeners[event].length > 0) {
      for (const handler of listeners[event]) {
        handler(...args);
      }
    } else if (event === "error") {
      console.error(...args);
    }
  }

  function on(event, handler) {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(handler);
    return this;
  }

  function handleAudioError() {
    if (audioPlayer.error) {
      const errorResult = audioPlayer.error.code
        ? audioPlayer.error.code
        : audioPlayer.error;
      emit(
        "error",
        new Error(
          "The audio control fired an error event. Could be: " + errorResult,
        ),
      );
    }
  }

  function updatePlayPosition() {
    if (cdgData != null) {
      let playPosition = Math.floor(
        audioPlayer.currentTime * CDG_ENUM.PACKS_PER_SECOND,
      );
      let currentPack = cdgDecoder.getCurrentPack();
      let positionToPlay;
      playPosition = playPosition < 0 ? 0 : playPosition;
      // Render from the beginning of the stream if a reverse seek of more than one second occurred.
      if (playPosition < currentPack - CDG_ENUM.PACKS_PER_SECOND) {
        cdgDecoder.resetCdgState();
        currentPack = 0;
      }
      positionToPlay = currentPack + SMOOTHING_PACKS;
      // Jump to the actual play position if it's ahead of our calculated smoothed position.
      positionToPlay =
        playPosition > positionToPlay ? playPosition : positionToPlay;
      // Check if we should render any packs, and do so if needed.
      if (positionToPlay > currentPack) {
        cdgDecoder.decodePacks(cdgData, positionToPlay);
        cdgDecoder.redrawCanvas();
      }
    }
  }

  function setCDGInterval() {
    cdgIntervalID = setInterval(updatePlayPosition, UPDATE_INTERVAL_MS);
  }

  function clearCDGInterval() {
    clearInterval(cdgIntervalID);
  }

  function play() {
    audioPlayer.play();
  }

  function pause() {
    audioPlayer.pause();
  }

  function stop() {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  }

  function parseTrackOptions(trackOptions) {
    if (
      !trackOptions ||
      Array.isArray(trackOptions) ||
      (typeof trackOptions !== "string" && typeof trackOptions !== "object")
    ) {
      throw new Error("No track information specified, nothing to load!");
    }
    let audioFilePrefix;
    let cdgFilePrefix;
    let mediaPath = defaults.mediaPath;
    let audioFormat = defaults.audioFormat;
    let cdgFileExtension = defaults.cdgFileExtension;
    if (typeof trackOptions === "object") {
      if (!trackOptions.audioFilePrefix) {
        throw new Error(
          "No audioFilePrefix property defined, nothing to load!",
        );
      } else {
        audioFilePrefix = trackOptions.audioFilePrefix;
      }
      cdgFilePrefix = trackOptions.cdgFilePrefix
        ? trackOptions.cdgFilePrefix
        : trackOptions.audioFilePrefix;
      if (trackOptions.mediaPath) {
        mediaPath = trackOptions.mediaPath;
      }
      if (trackOptions.audioFormat) {
        if (!audioTypes[trackOptions.audioFormat]) {
          throw new Error("Unsupported audio format specified");
        }
        audioFormat = trackOptions.audioFormat;
      }
      if (trackOptions.cdgFileExtension) {
        cdgFileExtension = trackOptions.cdgFileExtension;
      }
    } else {
      // If only a string has been passed treat it as shorthand for setting the filename prefix for both
      // audio and CDG files
      audioFilePrefix = cdgFilePrefix = trackOptions;
    }

    return {
      audioFilePrefix: audioFilePrefix,
      cdgFilePrefix: cdgFilePrefix,
      mediaPath: mediaPath,
      audioFormat: audioFormat,
      cdgFileExtension: cdgFileExtension,
    };
  }

  async function loadTrack(trackOptions) {
    const trackInfo = parseTrackOptions(trackOptions);
    clearCDGInterval();
    cdgDecoder.resetCdgState();
    cdgDecoder.redrawCanvas();
    cdgData = null;
    if (audioSourceElement == null) {
      audioSourceElement = document.createElement("source");
    }
    audioSourceElement.type = audioTypes[trackInfo.audioFormat];
    audioSourceElement.src =
      trackInfo.mediaPath +
      trackInfo.audioFilePrefix +
      "." +
      trackInfo.audioFormat;
    audioPlayer.appendChild(audioSourceElement);
    audioPlayer.load();
    try {
      const cdgUrl =
        trackInfo.mediaPath +
        trackInfo.cdgFilePrefix +
        "." +
        trackInfo.cdgFileExtension;
      const response = await fetch(cdgUrl);
      if (!response.ok) {
        throw new Error(`CDG file failed to load: ${response.status}`);
      }
      cdgData = await response.text();
    } catch (error) {
      emit("error", error);
    }
    return this;
  }

  function init(containerId, initOptions) {
    if (!containerId) {
      throw new Error("Required initialisation parameter missing.");
    }
    const containerEl = document.getElementById(containerId);
    const borderEl = document.createElement("div");
    const canvasEl = document.createElement("canvas");
    audioPlayer = document.createElement("audio");
    borderEl.id = containerId + "-border";
    borderEl.className = "cdg-border";
    canvasEl.id = containerId + "-canvas";
    canvasEl.width = CDG_ENUM.VISIBLE_WIDTH;
    canvasEl.height = CDG_ENUM.VISIBLE_HEIGHT;
    canvasEl.className = "cdg-canvas";
    audioPlayer.id = containerId + "-audio";
    audioPlayer.className = "cdg-audio";
    borderEl.appendChild(canvasEl);
    containerEl.appendChild(borderEl);
    containerEl.appendChild(audioPlayer);
    audioPlayer.style.width = canvasEl.offsetWidth + "px";
    audioPlayer.controls = !(initOptions && initOptions.showControls == false);
    audioPlayer.autoplay = !(initOptions && initOptions.autoplay == false);
    audioPlayer.addEventListener("error", handleAudioError, true);
    audioPlayer.addEventListener("play", setCDGInterval, true);
    audioPlayer.addEventListener("pause", clearCDGInterval, true);
    audioPlayer.addEventListener("abort", clearCDGInterval, true);
    audioPlayer.addEventListener(
      "ended",
      () => {
        clearCDGInterval();
        emit("ended");
      },
      true,
    );
    cdgDecoder = new CDGDecoder(canvasEl, borderEl);
  }

  init(containerId, initOptions);

  // Bind the public functions to member variables.
  this.loadTrack = loadTrack;
  this.play = play;
  this.stop = stop;
  this.pause = pause;
  this.on = on;
}

export function init(containerId, initOptions) {
  return new CDGPlayer(containerId, initOptions);
}
