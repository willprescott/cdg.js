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
  VRAM_HEIGHT: 216,         // Height of VRAM, in pixels.
  VISIBLE_WIDTH: 288,       // Width (or pitch) of visible screen, in pixels.
  VISIBLE_HEIGHT: 192,      // Height of visible screen, in pixels.
  FONT_WIDTH: 6,            // Width of one "font" (or block).
  FONT_HEIGHT: 12,          // Height of one "font" (or block).
  NUM_X_FONTS: 50,          // Number of horizontal fonts contained in VRAM.
  NUM_Y_FONTS: 18,          // Number of vertical fonts contained in VRAM.
  VISIBLE_X_FONTS: 48,      // Number of visible horizontal font columns.
  VISIBLE_Y_FONTS: 16,      // Number of visible vertical font rows.
  PALETTE_ENTRIES: 16,      // Number of CLUT palette entries.
  CLUT_ENTRIES: 8,          // Number of palette entries per LOAD_CLUT instruction.
  PACK_SIZE: 24,            // Size of one CDG data pack, in bytes.
  PACKS_PER_SECOND: 300,    // CD+G standard pack rate.
  TV_GRAPHICS: 0x09,        // 50x18 (48x16) 16 color TV graphics mode.
  MEMORY_PRESET: 0x01,      // Set all VRAM to palette index.
  BORDER_PRESET: 0x02,      // Set border to palette index.
  LOAD_CLUT_LO: 0x1E,       // Load Color Look Up Table index 0 through 7.
  LOAD_CLUT_HI: 0x1F,       // Load Color Look Up Table index 8 through 15.
  COPY_FONT: 0x06,          // Copy 12x6 pixel font to screen.
  XOR_FONT: 0x26,           // XOR 12x6 pixel font with existing VRAM values.
  SCROLL_PRESET: 0x14,      // Update scroll offset, copying if 0x20 or 0x10.
  SCROLL_COPY: 0x18         // Update scroll offset, setting color if 0x20 or 0x10.
};

function CDGDecoder(canvasEl, borderEl) {

  const internal_border_div = borderEl; // DIV element behind graphics canvas.
  const internal_rgba_context = canvasEl.getContext("2d");  // 2D context of canvas element.
  const internal_rgba_imagedata = internal_rgba_context.createImageData(CDG_ENUM.VISIBLE_WIDTH, CDG_ENUM.VISIBLE_HEIGHT);  // 288x192 image data.
  const internal_palette = new Array(CDG_ENUM.PALETTE_ENTRIES);                                        // Array containing the 16 RGB palette entries.
  const internal_vram = new Array(CDG_ENUM.NUM_X_FONTS * CDG_ENUM.VRAM_HEIGHT);                       // Array used for graphics VRAM.

  let internal_border_index = 0x00;  // The current border palette index.
  let internal_current_pack = 0x00;  // The current playback position.

  let internal_border_dirty = false;                                                                    // State variable used to determine if the background DIV needs updated.
  let internal_screen_dirty = false;                                                                    // State variable used to determine if a full screen update is needed.
  const internal_dirty_blocks = new Array(CDG_ENUM.NUM_X_FONTS * CDG_ENUM.NUM_Y_FONTS);               // Array used to determine if a given font/block has changed.

  // Reset all the CDG state variables back to initial values.
  function reset_cdg_state() {
    internal_current_pack = 0x00;
    internal_border_index = 0x00;
    clear_palette();
    clear_vram(0x00);
    clear_dirty_blocks();
  }

  function get_current_pack() {
    return internal_current_pack;
  }

  function redraw_canvas() {
    // If the border color has changed, then update the background div color.
    if (internal_border_dirty || internal_screen_dirty) {
      internal_border_div.style.backgroundColor = palette_index_to_rgb_tuple(internal_border_index);
      internal_border_dirty = false;
    }

    // If the screen is dirty, then it needs a full update.
    if (internal_screen_dirty) {
      render_screen_to_rgb();
      internal_screen_dirty = false;
      clear_dirty_blocks();
      internal_rgba_context.putImageData(internal_rgba_imagedata, 0, 0);
    }
    else {
      const local_context = internal_rgba_context;
      const local_rgba_imagedata = internal_rgba_imagedata;
      const local_dirty = internal_dirty_blocks;
      const local_fontwidth = CDG_ENUM.FONT_WIDTH;
      const local_fontheight = CDG_ENUM.FONT_HEIGHT;
      let blk = 0x00;
      for (let y_blk = 1; y_blk <= CDG_ENUM.VISIBLE_Y_FONTS; ++y_blk) {
        blk = y_blk * CDG_ENUM.NUM_X_FONTS + 1;
        for (let x_blk = 1; x_blk <= CDG_ENUM.VISIBLE_X_FONTS; ++x_blk) {
          if (local_dirty[blk]) {
            render_block_to_rgb(x_blk, y_blk);
            local_context.putImageData(local_rgba_imagedata, 0, 0,
              (x_blk - 1) * local_fontwidth,
              (y_blk - 1) * local_fontheight,
              local_fontwidth,
              local_fontheight);
            local_dirty[blk] = 0x00;
          }
          ++blk;
        }
      }
    }
  }

  // Decode to pack playback_position, using cdg_file_data.
  function decode_packs(cdg_file_data, playback_position) {
    for (let curr_pack = internal_current_pack; curr_pack < playback_position; curr_pack++) {
      const start_offset = curr_pack * CDG_ENUM.PACK_SIZE;
      const curr_command = cdg_file_data.charCodeAt(start_offset) & 0x3F;
      if (curr_command == CDG_ENUM.TV_GRAPHICS) {
        // Slice the file array down to a single pack array.
        const this_pack = cdg_file_data.slice(start_offset, start_offset + CDG_ENUM.PACK_SIZE);
        // Pluck out the graphics instruction.
        const curr_instruction = this_pack.charCodeAt(1) & 0x3F;
        // Perform the instruction action.
        switch (curr_instruction) {
          case CDG_ENUM.MEMORY_PRESET:
            proc_MEMORY_PRESET(this_pack);
            break;
          case CDG_ENUM.BORDER_PRESET:
            proc_BORDER_PRESET(this_pack);
            break;

          case CDG_ENUM.LOAD_CLUT_LO:
          case CDG_ENUM.LOAD_CLUT_HI:
            proc_LOAD_CLUT(this_pack);
            break;

          case CDG_ENUM.COPY_FONT:
          case CDG_ENUM.XOR_FONT:
            proc_WRITE_FONT(this_pack);
            break;

          case CDG_ENUM.SCROLL_PRESET:
          case CDG_ENUM.SCROLL_COPY:
            proc_DO_SCROLL(this_pack);
            break;
        }
      }
    }
    internal_current_pack = playback_position;
  }

  // Convenience function to return the string "rgb(r,g,b)" CSS style tuple of a palette index.
  function palette_index_to_rgb_tuple(requested_index) {
    return "rgb(" + (internal_palette[requested_index] >> 16 & 0xFF) + "," + (internal_palette[requested_index] >> 8 & 0xFF) + "," + (internal_palette[requested_index] >> 0 & 0xFF) + ")";
  }

  // Convenience function to return a line of special packed palette values.
  function fill_line_with_palette_index(requested_index) {
    let adjusted_value = requested_index;           // Pixel 0
    adjusted_value |= (requested_index << 4);  // Pixel 1
    adjusted_value |= (requested_index << 8);  // Pixel 2
    adjusted_value |= (requested_index << 12);  // Pixel 3
    adjusted_value |= (requested_index << 16);  // Pixel 4
    adjusted_value |= (requested_index << 20);  // Pixel 5
    return adjusted_value;
  }

  // Reset the state of all font/blocks to clean.
  function clear_dirty_blocks() {
    for (let blk = 0; blk < CDG_ENUM.NUM_X_FONTS * CDG_ENUM.NUM_Y_FONTS; blk++) {
      internal_dirty_blocks[blk] = 0x00;
    }
  }

  // Reset all the palette RGB values to black.
  function clear_palette() {
    const total_palette_entries = CDG_ENUM.PALETTE_ENTRIES;
    for (let idx = 0; idx < total_palette_entries; idx++) {
      internal_palette[idx] = 0x00;
    }
  }

  // Set all the VRAM index values to requested index.
  function clear_vram(color_index) {
    const local_vram = internal_vram;
    const total_vram_size = local_vram.length;
    const packed_line_value = fill_line_with_palette_index(color_index);
    for (let pxl = 0; pxl < total_vram_size; pxl++) {
      local_vram[pxl] = packed_line_value;
    }
    internal_screen_dirty = true;
  }

  // Write one 6-pixel line segment (one VRAM word) into the RGBA buffer.
  // Alpha is always 0xFF; CD+G's SET_TRANSPARENT instruction is rarely used on real discs.
  function write_line_segment(rgba, offset, palette, line_indices) {
    for (const shift of [0, 4, 8, 12, 16, 20]) {
      const rgb = palette[(line_indices >> shift) & 0x0F];
      rgba[offset++] = (rgb >> 16) & 0xFF;
      rgba[offset++] = (rgb >> 8) & 0xFF;
      rgba[offset++] = rgb & 0xFF;
      rgba[offset++] = 0xFF;
    }
    return offset;
  }

  function render_screen_to_rgb() {
    const local_rgba = internal_rgba_imagedata.data;
    const local_pal = internal_palette;
    const local_vram = internal_vram;

    let vram_loc = CDG_ENUM.NUM_X_FONTS * CDG_ENUM.FONT_HEIGHT + 1;  // Skip the top offscreen row and left border column.
    let rgb_loc = 0x00;

    for (let y_pxl = 0; y_pxl < CDG_ENUM.VISIBLE_HEIGHT; ++y_pxl) {
      for (let x_pxl = 0; x_pxl < CDG_ENUM.VISIBLE_X_FONTS; ++x_pxl) {
        rgb_loc = write_line_segment(local_rgba, rgb_loc, local_pal, local_vram[vram_loc++]);
      }
      vram_loc += CDG_ENUM.NUM_X_FONTS - CDG_ENUM.VISIBLE_X_FONTS;  // Skip the offscreen font blocks.
    }
  }

  function render_block_to_rgb(x_start, y_start) {
    const local_rgba = internal_rgba_imagedata.data;
    const local_pal = internal_palette;
    const local_vram = internal_vram;

    let vram_loc = (y_start * CDG_ENUM.NUM_X_FONTS * CDG_ENUM.FONT_HEIGHT) + x_start;
    const vram_inc = CDG_ENUM.NUM_X_FONTS;
    const vram_end = vram_loc + (CDG_ENUM.NUM_X_FONTS * CDG_ENUM.FONT_HEIGHT);
    let rgb_loc = (y_start - 1) * CDG_ENUM.FONT_HEIGHT * CDG_ENUM.VISIBLE_WIDTH;
    rgb_loc += (x_start - 1) * CDG_ENUM.FONT_WIDTH;
    rgb_loc *= 4;
    const rgb_inc = (CDG_ENUM.VISIBLE_WIDTH - CDG_ENUM.FONT_WIDTH) * 4;

    while (vram_loc < vram_end) {
      rgb_loc = write_line_segment(local_rgba, rgb_loc, local_pal, local_vram[vram_loc]);
      vram_loc += vram_inc;
      rgb_loc += rgb_inc;
    }
  }

  function proc_BORDER_PRESET(cdg_pack) {
    // NOTE: The "border" is actually a DIV element, which can be very expensive to change in some browsers.
    // This somewhat bizarre check ensures that the DIV is only touched if the actual RGB color is different,
    // but the border index variable is always set... A similar check is also performed during palette update.
    const new_border_index = cdg_pack.charCodeAt(4) & 0x3F; // Get the border index from subcode.
    // Check if the new border **RGB** color is different from the old one.
    if (internal_palette[new_border_index] != internal_palette[internal_border_index]) {
      internal_border_dirty = true;                     // Border needs updating.
    }
    internal_border_index = new_border_index;             // Set the new index.
  }

  function proc_MEMORY_PRESET(cdg_pack) {
    clear_vram(cdg_pack.charCodeAt(4) & 0x3F);
  }


  function proc_LOAD_CLUT(cdg_pack) {
    const local_palette = internal_palette;
    // If instruction is 0x1E then 8*0=0, if 0x1F then 8*1=8 for offset.
    const pal_offset = (cdg_pack.charCodeAt(1) & 0x01) * CDG_ENUM.CLUT_ENTRIES;
    // Step through the eight color indices, setting the RGB values.
    for (let pal_inc = 0; pal_inc < CDG_ENUM.CLUT_ENTRIES; pal_inc++) {
      const temp_idx = pal_inc + pal_offset;
      let temp_rgb = 0x00000000;
      let temp_entry = 0x00000000;
      // Set red.
      temp_entry = (cdg_pack.charCodeAt(pal_inc * 2 + 4) & 0x3C) >> 2;
      temp_rgb |= (temp_entry * 17) << 16;
      // Set green.
      temp_entry = ((cdg_pack.charCodeAt(pal_inc * 2 + 4) & 0x03) << 2) | ((cdg_pack.charCodeAt(pal_inc * 2 + 5) & 0x30) >> 4);
      temp_rgb |= (temp_entry * 17) << 8;
      // Set blue.
      temp_entry = cdg_pack.charCodeAt(pal_inc * 2 + 5) & 0x0F;
      temp_rgb |= (temp_entry * 17) << 0;
      // Put the full RGB value into the index position, but only if it's different.
      if (temp_rgb != local_palette[temp_idx]) {
        local_palette[temp_idx] = temp_rgb;
        internal_screen_dirty = true; // The colors are now different, so we need to update the whole screen.
        if (temp_idx == internal_border_index) {
          internal_border_dirty = true;
        } // The border color has changed.
      }
    }
  }

  function proc_WRITE_FONT(cdg_pack) {
    const local_vram = internal_vram;
    const local_dirty = internal_dirty_blocks;
    // Hacky hack to play channels 0 and 1 only... Ideally, there should be a function and user option to get/set.
    const active_channels = 0x03;
    // First, get the channel...
    const subcode_channel = ((cdg_pack.charCodeAt(4) & 0x30) >> 2) | ((cdg_pack.charCodeAt(5) & 0x30) >> 4);
    const xor_var = cdg_pack.charCodeAt(1) & 0x20;
    // Then see if we should display it.
    if ((active_channels >> subcode_channel) && 0x01) {
      const x_location = cdg_pack.charCodeAt(7) & 0x3F; // Get horizontal font location.
      const y_location = cdg_pack.charCodeAt(6) & 0x1F; // Get vertical font location.

      // Verify we're not going to overrun the boundaries (i.e. bad data from a scratched disc).
      if (x_location < CDG_ENUM.NUM_X_FONTS && y_location < CDG_ENUM.NUM_Y_FONTS) {
        const start_pixel = y_location * CDG_ENUM.NUM_X_FONTS * CDG_ENUM.FONT_HEIGHT + x_location; // Location of first pixel of this font in linear VRAM.
        // NOTE: Profiling indicates charCodeAt() uses ~80% of the CPU consumed for this function.
        // Caching these values reduces that to a negligible amount.
        const current_indexes = [(cdg_pack.charCodeAt(4) & 0x0F), (cdg_pack.charCodeAt(5) & 0x0F)]; // Current colors.
        let current_row = 0x00; // Subcode byte for current pixel row.
        let temp_pxl = 0x00; // Decoded and packed 4bit pixel index values of current row.
        for (let y_inc = 0; y_inc < CDG_ENUM.FONT_HEIGHT; y_inc++) {
          const pix_pos = y_inc * CDG_ENUM.NUM_X_FONTS + start_pixel;  // Location of the first pixel of this row in linear VRAM.
          current_row = cdg_pack.charCodeAt(y_inc + 8);  // Get the subcode byte for the current row.
          temp_pxl = (current_indexes[(current_row >> 5) & 0x01] << 0);
          temp_pxl |= (current_indexes[(current_row >> 4) & 0x01] << 4);
          temp_pxl |= (current_indexes[(current_row >> 3) & 0x01] << 8);
          temp_pxl |= (current_indexes[(current_row >> 2) & 0x01] << 12);
          temp_pxl |= (current_indexes[(current_row >> 1) & 0x01] << 16);
          temp_pxl |= (current_indexes[(current_row >> 0) & 0x01] << 20);
          if (xor_var) {
            local_vram[pix_pos] ^= temp_pxl;
          } else {
            local_vram[pix_pos] = temp_pxl;
          }
        } // End of Y loop.
        // Mark this block as needing an update.
        local_dirty[y_location * CDG_ENUM.NUM_X_FONTS + x_location] = 0x01;
      } // End of location check.
    } // End of channel check.
  }

  function proc_DO_SCROLL(cdg_pack) {
    let direction;
    const copy_flag = (cdg_pack.charCodeAt(1) & 0x08) >> 3;
    const color = cdg_pack.charCodeAt(4) & 0x0F;             // Color index to use for preset type.

    // Process horizontal commands.
    if ((direction = ((cdg_pack.charCodeAt(5) & 0x30) >> 4))) {
      proc_VRAM_HSCROLL(direction, copy_flag, color);
    }
    // Process vertical commands.
    if ((direction = ((cdg_pack.charCodeAt(6) & 0x30) >> 4))) {
      proc_VRAM_VSCROLL(direction, copy_flag, color);
    }
    internal_screen_dirty = true;  // Entire screen needs to be redrawn.
  }

  function proc_VRAM_HSCROLL(direction, copy_flag, color) {
    let x_src, y_src, y_start, buf = 0;
    const line_color = fill_line_with_palette_index(color);
    const local_vram = internal_vram;
    const vram_size = CDG_ENUM.NUM_X_FONTS * CDG_ENUM.VRAM_HEIGHT;
    if (direction == 0x02) {
      // Step through the lines one at a time...
      for (y_src = 0; y_src < vram_size; y_src += CDG_ENUM.NUM_X_FONTS) {
        y_start = y_src;
        buf = local_vram[y_start];
        for (x_src = y_start + 1; x_src < y_start + CDG_ENUM.NUM_X_FONTS; x_src++) {
          local_vram[x_src - 1] = local_vram[x_src];
        }
        if (copy_flag) {
          local_vram[y_start + CDG_ENUM.NUM_X_FONTS - 1] = buf;
        } else {
          local_vram[y_start + CDG_ENUM.NUM_X_FONTS - 1] = line_color;
        }
      }
    }
    else if (direction == 0x01) {
      // Step through the lines one at a time.
      for (y_src = 0; y_src < vram_size; y_src += CDG_ENUM.NUM_X_FONTS) {
        // Copy the last element to the buffer.
        y_start = y_src;
        buf = local_vram[y_start + CDG_ENUM.NUM_X_FONTS - 1];
        for (x_src = y_start + CDG_ENUM.NUM_X_FONTS - 2; x_src >= y_start; x_src--) {
          local_vram[x_src + 1] = local_vram[x_src];
        }
        if (copy_flag) {
          local_vram[y_start] = buf;
        } else {
          local_vram[y_start] = line_color;
        }
      }
    }
  }

  function proc_VRAM_VSCROLL(direction, copy_flag, color) {
    let dst_idx, src_idx;
    const offscreen_size = CDG_ENUM.NUM_X_FONTS * CDG_ENUM.FONT_HEIGHT;
    const vram_size = CDG_ENUM.NUM_X_FONTS * CDG_ENUM.VRAM_HEIGHT;
    const scroll_start = CDG_ENUM.NUM_X_FONTS * (CDG_ENUM.VRAM_HEIGHT - CDG_ENUM.FONT_HEIGHT);
    const buf = new Array(offscreen_size);
    const line_color = fill_line_with_palette_index(color);
    const local_vram = internal_vram;
    if (direction == 0x02) {
      dst_idx = 0;  // Buffer destination starts at 0.
      // Copy the top offscreen row into the buffer.
      for (src_idx = 0; src_idx < offscreen_size; src_idx++) {
        buf[dst_idx++] = local_vram[src_idx];
      }
      dst_idx = 0; // Destination starts at the first line.
      for (src_idx = offscreen_size; src_idx < vram_size; src_idx++) {
        local_vram[dst_idx++] = local_vram[src_idx];
      }
      dst_idx = scroll_start; // Destination begins at the last font row.
      if (copy_flag) {
        for (src_idx = 0; src_idx < offscreen_size; src_idx++) {
          local_vram[dst_idx++] = buf[src_idx];
        }
      }
      else {
        for (src_idx = 0; src_idx < offscreen_size; src_idx++) {
          local_vram[dst_idx++] = line_color;
        }
      }
    }
    else if (direction == 0x01) {
      dst_idx = 0;  // Buffer destination starts at 0.
      // Copy the bottom offscreen row into the buffer.
      for (src_idx = scroll_start; src_idx < vram_size; src_idx++) {
        buf[dst_idx++] = local_vram[src_idx];
      }
      for (src_idx = scroll_start - 1; src_idx > 0; src_idx--) {
        local_vram[src_idx + offscreen_size] = local_vram[src_idx];
      }
      if (copy_flag) {
        for (src_idx = 0; src_idx < offscreen_size; src_idx++) {
          local_vram[src_idx] = buf[src_idx];
        }
      }
      else {
        for (src_idx = 0; src_idx < offscreen_size; src_idx++) {
          local_vram[src_idx] = line_color;
        }
      }
    }
  }

  // Bind the public functions to member variables.
  this.get_current_pack = get_current_pack;
  this.reset_cdg_state = reset_cdg_state;
  this.redraw_canvas = redraw_canvas;
  this.decode_packs = decode_packs;
  this.reset_cdg_state();
}

function CDGPlayer(containerId, initOptions) {

  const UPDATE_INTERVAL_MS = 20;  // Canvas refresh rate.
  const SMOOTHING_PACKS = 6;      // Look-ahead buffer for smooth audio/graphics sync.

  const defaults = {
    mediaPath: '',
    audioFormat: 'mp3',
    cdgFileExtension: 'cdg'
  };
  const audioTypes = {
    mp3: 'audio/mpeg; codecs="mp3"',
    ogg: 'audio/ogg; codecs="vorbis"'
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
    } else if (event === 'error') {
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
      const error_result = audioPlayer.error.code ? audioPlayer.error.code : audioPlayer.error;
      emit('error', new Error("The audio control fired an error event. Could be: " + error_result));
    }
  }

  function updatePlayPosition() {
    if (cdgData != null) {
      let play_position = Math.floor(audioPlayer.currentTime * CDG_ENUM.PACKS_PER_SECOND);
      let current_pack = cdgDecoder.get_current_pack();
      let position_to_play;
      play_position = (play_position < 0) ? 0 : play_position;
      // Render from the beginning of the stream if a reverse seek of more than one second occurred.
      if (play_position < (current_pack - CDG_ENUM.PACKS_PER_SECOND)) {
        cdgDecoder.reset_cdg_state();
        current_pack = 0;
      }
      position_to_play = current_pack + SMOOTHING_PACKS;
      // Jump to the actual play position if it's ahead of our calculated smoothed position.
      position_to_play = (play_position > position_to_play) ? play_position : position_to_play;
      // Check if we should render any packs, and do so if needed.
      if (position_to_play > current_pack) {
        cdgDecoder.decode_packs(cdgData, position_to_play);
        cdgDecoder.redraw_canvas();
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
    if (!trackOptions || Array.isArray(trackOptions) || (typeof trackOptions !== 'string' && typeof trackOptions !== 'object')) {
      throw new Error('No track information specified, nothing to load!');
    }
    let audioFilePrefix;
    let cdgFilePrefix;
    let mediaPath = defaults.mediaPath;
    let audioFormat = defaults.audioFormat;
    let cdgFileExtension = defaults.cdgFileExtension;
    if (typeof trackOptions === 'object') {
      if (!trackOptions.audioFilePrefix) {
        throw new Error('No audioFilePrefix property defined, nothing to load!');
      } else {
        audioFilePrefix = trackOptions.audioFilePrefix;
      }
      cdgFilePrefix = trackOptions.cdgFilePrefix ? trackOptions.cdgFilePrefix : trackOptions.audioFilePrefix;
      if (trackOptions.mediaPath) {
        mediaPath = trackOptions.mediaPath;
      }
      if (trackOptions.audioFormat) {
        if (!audioTypes[trackOptions.audioFormat]) {
          throw new Error('Unsupported audio format specified');
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
      cdgFileExtension: cdgFileExtension
    };
  }

  async function loadTrack(trackOptions) {
    const trackInfo = parseTrackOptions(trackOptions);
    clearCDGInterval();
    cdgDecoder.reset_cdg_state();
    cdgDecoder.redraw_canvas();
    cdgData = null;
    if (audioSourceElement == null) {
      audioSourceElement = document.createElement("source");
    }
    audioSourceElement.type = audioTypes[trackInfo.audioFormat];
    audioSourceElement.src = trackInfo.mediaPath + trackInfo.audioFilePrefix + "." + trackInfo.audioFormat;
    audioPlayer.appendChild(audioSourceElement);
    audioPlayer.load();
    try {
      const cdgUrl = trackInfo.mediaPath + trackInfo.cdgFilePrefix + "." + trackInfo.cdgFileExtension;
      const response = await fetch(cdgUrl);
      if (!response.ok) {
        throw new Error(`CDG file failed to load: ${response.status}`);
      }
      cdgData = await response.text();
    } catch (error) {
      emit('error', error);
    }
    return this;
  }

  function init(containerId, initOptions) {
    if (!containerId) {
      throw new Error("Required initialisation parameter missing.")
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
    audioPlayer.addEventListener("ended", clearCDGInterval, true);
    audioPlayer.addEventListener("abort", clearCDGInterval, true);
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
