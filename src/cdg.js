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

/*global define document setInterval clearInterval XMLHttpRequest */

define("cdg", [], function() {
    "use strict";

    function CDGDecoder(canvasEl, borderEl) {

        var CDG_ENUM = {
            VRAM_HEIGHT: 216,    // Height of VRAM, in pixels.
            VISIBLE_WIDTH: 288,    // Width (or pitch) of visible screen, in pixels.
            VISIBLE_HEIGHT: 192,    // Height of visible screen, in pixels.
            FONT_WIDTH: 6,    // Width of  one "font" (or block).
            FONT_HEIGHT: 12,    // Height of one "font" (or block).
            NUM_X_FONTS: 50,    // Number of horizontal fonts contained in VRAM.
            NUM_Y_FONTS: 18,    // Number of vertical fonts contained in VRAM.
            PALETTE_ENTRIES: 16,    // Number of CLUT palette entries.
            TV_GRAPHICS: 0x09,    // 50x18 (48x16) 16 color TV graphics mode.
            MEMORY_PRESET: 0x01,    // Set all VRAM to palette index.
            BORDER_PRESET: 0x02,    // Set border to palette index.
            LOAD_CLUT_LO: 0x1E,    // Load Color Look Up Table index 0 through 7.
            LOAD_CLUT_HI: 0x1F,    // Load Color Look Up Table index 8 through 15.
            COPY_FONT: 0x06,    // Copy 12x6 pixel font to screen.
            XOR_FONT: 0x26,    // XOR 12x6 pixel font with existing VRAM values.
            SCROLL_PRESET: 0x14,    // Update scroll offset, copying if 0x20 or 0x10.
            SCROLL_COPY: 0x18     // Update scroll offset, setting color if 0x20 or 0x10.
        };

        var internal_border_div = borderEl; // DIV element behind graphics canvas.
        var internal_rgba_context = canvasEl.getContext("2d");  // 2D context of canvas element.
        var internal_rgba_imagedata = internal_rgba_context.createImageData(CDG_ENUM.VISIBLE_WIDTH, CDG_ENUM.VISIBLE_HEIGHT);  // 288x192 image data.
        var internal_palette = new Array(CDG_ENUM.PALETTE_ENTRIES);                     // Array containing the 16 RGB palette entries.
        var internal_vram = new Array(CDG_ENUM.NUM_X_FONTS * CDG_ENUM.VRAM_HEIGHT);  // Array used for graphics VRAM.

        var internal_border_index = 0x00;  // The current border palette index.
        var internal_current_pack = 0x00;  // The current playback position.

        var internal_border_dirty = false;            // State variable used to determine if the background DIV needs updated.
        var internal_screen_dirty = false;            // State variable used to determine if a full screen update is needed.
        var internal_dirty_blocks = new Array(900);  // Array used to determine if a given font/block has changed.

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
                var local_context = internal_rgba_context;
                var local_rgba_imagedata = internal_rgba_imagedata;
                var local_dirty = internal_dirty_blocks;
                var local_fontwidth = CDG_ENUM.FONT_WIDTH;
                var local_fontheight = CDG_ENUM.FONT_HEIGHT;
                var blk = 0x00;
                for (var y_blk = 1; y_blk <= 16; ++y_blk) {
                    blk = y_blk * CDG_ENUM.NUM_X_FONTS + 1;
                    for (var x_blk = 1; x_blk <= 48; ++x_blk) {
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
            for (var curr_pack = internal_current_pack; curr_pack < playback_position; curr_pack++) {
                var start_offset = curr_pack * 24;
                var curr_command = cdg_file_data.charCodeAt(start_offset) & 0x3F;
                if (curr_command == CDG_ENUM.TV_GRAPHICS) {
                    // Slice the file array down to a single pack array.
                    var this_pack = cdg_file_data.slice(start_offset, start_offset + 24);
                    // Pluck out the graphics instruction.
                    var curr_instruction = this_pack.charCodeAt(1) & 0x3F;
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
            var adjusted_value = requested_index;           // Pixel 0
            adjusted_value |= (requested_index << 4);  // Pixel 1
            adjusted_value |= (requested_index << 8);  // Pixel 2
            adjusted_value |= (requested_index << 12);  // Pixel 3
            adjusted_value |= (requested_index << 16);  // Pixel 4
            adjusted_value |= (requested_index << 20);  // Pixel 5
            return adjusted_value;
        }

        // Reset the state of all font/blocks to clean.
        function clear_dirty_blocks() {
            for (var blk = 0; blk < 900; blk++) {
                internal_dirty_blocks[blk] = 0x00;
            }
        }

        // Reset all the palette RGB values to black.
        function clear_palette() {
            var total_palette_entries = CDG_ENUM.PALETTE_ENTRIES;
            for (var idx = 0; idx < total_palette_entries; idx++) {
                internal_palette[idx] = 0x00;
            }
        }

        // Set all the VRAM index values to requested index.
        function clear_vram(color_index) {
            var local_vram = internal_vram;
            var total_vram_size = local_vram.length;
            var packed_line_value = fill_line_with_palette_index(color_index);
            for (var pxl = 0; pxl < total_vram_size; pxl++) {
                local_vram[pxl] = packed_line_value;
            }
            internal_screen_dirty = true;
        }

        function render_screen_to_rgb() {
            var local_rgba = internal_rgba_imagedata.data;
            var local_pal = internal_palette;
            var local_vram = internal_vram;
            var vis_width = 48;
            var vis_height = CDG_ENUM.VISIBLE_HEIGHT;

            var vram_loc = 601;   // Offset into VRAM array.
            var rgb_loc = 0x00;  // Offset into RGBA array.
            var curr_rgb = 0x00;          // RGBA value of current pixel.
            var curr_line_indices = 0x00; // Packed font row index values.

            for (var y_pxl = 0; y_pxl < vis_height; ++y_pxl) {
                for (var x_pxl = 0; x_pxl < vis_width; ++x_pxl) {
                    curr_line_indices = local_vram[vram_loc++];              // Get the current line segment indices.
                    curr_rgb = local_pal[(curr_line_indices >> 0) & 0x0F];  // Get the RGB value for pixel 0.
                    local_rgba[rgb_loc++] = (curr_rgb >> 16) & 0xFF;        // Set red value for pixel 0.
                    local_rgba[rgb_loc++] = (curr_rgb >> 8) & 0xFF;        // Set green value for pixel 0.
                    local_rgba[rgb_loc++] = (curr_rgb >> 0) & 0xFF;        // Set blue value for pixel 0.
                    local_rgba[rgb_loc++] = 0xFF;                            // Set alpha value (fully opaque) for pixel 0.
                    curr_rgb = local_pal[(curr_line_indices >> 4) & 0x0F];  // Get the RGB value for pixel 1.
                    local_rgba[rgb_loc++] = (curr_rgb >> 16) & 0xFF;        // Set red value for pixel 1.
                    local_rgba[rgb_loc++] = (curr_rgb >> 8) & 0xFF;        // Set green value for pixel 1.
                    local_rgba[rgb_loc++] = (curr_rgb >> 0) & 0xFF;        // Set blue value for pixel 1.
                    local_rgba[rgb_loc++] = 0xFF;                            // Set alpha value (fully opaque) for pixel 1.
                    curr_rgb = local_pal[(curr_line_indices >> 8) & 0x0F];  // Get the RGB value for pixel 2.
                    local_rgba[rgb_loc++] = (curr_rgb >> 16) & 0xFF;        // Set red value for pixel 2.
                    local_rgba[rgb_loc++] = (curr_rgb >> 8) & 0xFF;        // Set green value for pixel 2.
                    local_rgba[rgb_loc++] = (curr_rgb >> 0) & 0xFF;        // Set blue value for pixel 2.
                    local_rgba[rgb_loc++] = 0xFF;                            // Set alpha value (fully opaque) for pixel 2.
                    curr_rgb = local_pal[(curr_line_indices >> 12) & 0x0F];  // Get the RGB value for pixel 3.
                    local_rgba[rgb_loc++] = (curr_rgb >> 16) & 0xFF;        // Set red value for pixel 3.
                    local_rgba[rgb_loc++] = (curr_rgb >> 8) & 0xFF;        // Set green value for pixel 3.
                    local_rgba[rgb_loc++] = (curr_rgb >> 0) & 0xFF;        // Set blue value for pixel 3.
                    local_rgba[rgb_loc++] = 0xFF;                            // Set alpha value (fully opaque) for pixel 3.
                    curr_rgb = local_pal[(curr_line_indices >> 16) & 0x0F];  // Get the RGB value for pixel 4.
                    local_rgba[rgb_loc++] = (curr_rgb >> 16) & 0xFF;        // Set red value for pixel 4.
                    local_rgba[rgb_loc++] = (curr_rgb >> 8) & 0xFF;        // Set green value for pixel 4.
                    local_rgba[rgb_loc++] = (curr_rgb >> 0) & 0xFF;        // Set blue value for pixel 4.
                    local_rgba[rgb_loc++] = 0xFF;                            // Set alpha value (fully opaque) for pixel 4.
                    curr_rgb = local_pal[(curr_line_indices >> 20) & 0x0F];  // Get the RGB value for pixel 5.
                    local_rgba[rgb_loc++] = (curr_rgb >> 16) & 0xFF;        // Set red value for pixel 5.
                    local_rgba[rgb_loc++] = (curr_rgb >> 8) & 0xFF;        // Set green value for pixel 5.
                    local_rgba[rgb_loc++] = (curr_rgb >> 0) & 0xFF;        // Set blue value for pixel 5.
                    local_rgba[rgb_loc++] = 0xFF;                            // Set alpha value (fully opaque) for pixel 5.
                    // Or, instead, index 0 could be set transparent to show background image/video.
                    // Alternately, SET_TRANSPARENT instruction could be implemented to set 6bit transparency.
                    // Unfortunately, I don't think many (any?) discs bother to set it :-/...
                }
                vram_loc += 2;  // Skip the offscreen font blocks.
            }
        }

        function render_block_to_rgb(x_start, y_start) {
            var local_rgba = internal_rgba_imagedata.data;
            var local_pal = internal_palette;
            var local_vram = internal_vram;

            var vram_loc = (y_start * CDG_ENUM.NUM_X_FONTS * CDG_ENUM.FONT_HEIGHT) + x_start;  // Offset into VRAM array.
            var vram_inc = CDG_ENUM.NUM_X_FONTS;
            var vram_end = vram_loc + (CDG_ENUM.NUM_X_FONTS * CDG_ENUM.FONT_HEIGHT);       // VRAM location to end.
            var rgb_loc = (y_start - 1) * CDG_ENUM.FONT_HEIGHT * CDG_ENUM.VISIBLE_WIDTH; // Row start.
            rgb_loc += (x_start - 1) * CDG_ENUM.FONT_WIDTH;                           // Column start
            rgb_loc *= 4;                                                             // RGBA, 1 pxl = 4 bytes.
            var rgb_inc = (CDG_ENUM.VISIBLE_WIDTH - CDG_ENUM.FONT_WIDTH) * 4;
            var curr_rgb = 0x00;          // RGBA value of current pixel.
            var curr_line_indices = 0x00; // Packed font row index values.

            while (vram_loc < vram_end) {
                curr_line_indices = local_vram[vram_loc];                // Get the current line segment indices.
                curr_rgb = local_pal[(curr_line_indices >> 0) & 0x0F];  // Get the RGB value for pixel 0.
                local_rgba[rgb_loc++] = (curr_rgb >> 16) & 0xFF;        // Set red value for pixel 0.
                local_rgba[rgb_loc++] = (curr_rgb >> 8) & 0xFF;        // Set green value for pixel 0.
                local_rgba[rgb_loc++] = (curr_rgb >> 0) & 0xFF;        // Set blue value for pixel 0.
                local_rgba[rgb_loc++] = 0xFF;                            // Set alpha value (fully opaque) for pixel 0.
                curr_rgb = local_pal[(curr_line_indices >> 4) & 0x0F];  // Get the RGB value for pixel 1.
                local_rgba[rgb_loc++] = (curr_rgb >> 16) & 0xFF;        // Set red value for pixel 1.
                local_rgba[rgb_loc++] = (curr_rgb >> 8) & 0xFF;        // Set green value for pixel 1.
                local_rgba[rgb_loc++] = (curr_rgb >> 0) & 0xFF;        // Set blue value for pixel 1.
                local_rgba[rgb_loc++] = 0xFF;                            // Set alpha value (fully opaque) for pixel 1.
                curr_rgb = local_pal[(curr_line_indices >> 8) & 0x0F];  // Get the RGB value for pixel 2.
                local_rgba[rgb_loc++] = (curr_rgb >> 16) & 0xFF;        // Set red value for pixel 2.
                local_rgba[rgb_loc++] = (curr_rgb >> 8) & 0xFF;        // Set green value for pixel 2.
                local_rgba[rgb_loc++] = (curr_rgb >> 0) & 0xFF;        // Set blue value for pixel 2.
                local_rgba[rgb_loc++] = 0xFF;                            // Set alpha value (fully opaque) for pixel 2.
                curr_rgb = local_pal[(curr_line_indices >> 12) & 0x0F];  // Get the RGB value for pixel 3.
                local_rgba[rgb_loc++] = (curr_rgb >> 16) & 0xFF;        // Set red value for pixel 3.
                local_rgba[rgb_loc++] = (curr_rgb >> 8) & 0xFF;        // Set green value for pixel 3.
                local_rgba[rgb_loc++] = (curr_rgb >> 0) & 0xFF;        // Set blue value for pixel 3.
                local_rgba[rgb_loc++] = 0xFF;                            // Set alpha value (fully opaque) for pixel 3.
                curr_rgb = local_pal[(curr_line_indices >> 16) & 0x0F];  // Get the RGB value for pixel 4.
                local_rgba[rgb_loc++] = (curr_rgb >> 16) & 0xFF;        // Set red value for pixel 4.
                local_rgba[rgb_loc++] = (curr_rgb >> 8) & 0xFF;        // Set green value for pixel 4.
                local_rgba[rgb_loc++] = (curr_rgb >> 0) & 0xFF;        // Set blue value for pixel 4.
                local_rgba[rgb_loc++] = 0xFF;                            // Set alpha value (fully opaque) for pixel 4.
                curr_rgb = local_pal[(curr_line_indices >> 20) & 0x0F];  // Get the RGB value for pixel 5.
                local_rgba[rgb_loc++] = (curr_rgb >> 16) & 0xFF;        // Set red value for pixel 5.
                local_rgba[rgb_loc++] = (curr_rgb >> 8) & 0xFF;        // Set green value for pixel 5.
                local_rgba[rgb_loc++] = (curr_rgb >> 0) & 0xFF;        // Set blue value for pixel 5.
                local_rgba[rgb_loc++] = 0xFF;                            // Set alpha value (fully opaque) for pixel 5.
                // Or, instead, index 0 could be set transparent to show background image/video.
                // Alternately, SET_TRANSPARENT instruction could be implemented to set 6bit transparency.
                // Unfortunately, I don't think many (any?) discs bother to set it :-/...
                vram_loc += vram_inc; // Move to the first column of the next row of this font block in VRAM.
                rgb_loc += rgb_inc;  // Move to the first column of the next row of this font block in RGB pixels.
            }
        }

        function proc_BORDER_PRESET(cdg_pack) {
            // NOTE: The "border" is actually a DIV element, which can be very expensive to change in some browsers.
            // This somewhat bizarre check ensures that the DIV is only touched if the actual RGB color is different,
            // but the border index variable is always set... A similar check is also performed during palette update.
            var new_border_index = cdg_pack.charCodeAt(4) & 0x3F; // Get the border index from subcode.
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
            var local_palette = internal_palette;
            // If instruction is 0x1E then 8*0=0, if 0x1F then 8*1=8 for offset.
            var pal_offset = (cdg_pack.charCodeAt(1) & 0x01) * 8;
            // Step through the eight color indices, setting the RGB values.
            for (var pal_inc = 0; pal_inc < 8; pal_inc++) {
                var temp_idx = pal_inc + pal_offset;
                var temp_rgb = 0x00000000;
                var temp_entry = 0x00000000;
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
            var local_vram = internal_vram;
            var local_dirty = internal_dirty_blocks;
            // Hacky hack to play channels 0 and 1 only... Ideally, there should be a function and user option to get/set.
            var active_channels = 0x03;
            // First, get the channel...
            var subcode_channel = ((cdg_pack.charCodeAt(4) & 0x30) >> 2) | ((cdg_pack.charCodeAt(5) & 0x30) >> 4);
            var xor_var = cdg_pack.charCodeAt(1) & 0x20;
            // Then see if we should display it.
            if ((active_channels >> subcode_channel) && 0x01) {
                var x_location = cdg_pack.charCodeAt(7) & 0x3F; // Get horizontal font location.
                var y_location = cdg_pack.charCodeAt(6) & 0x1F; // Get vertical font location.

                // Verify we're not going to overrun the boundaries (i.e. bad data from a scratched disc).
                if ((x_location <= 49) && (y_location <= 17)) {
                    var start_pixel = y_location * 600 + x_location; // Location of first pixel of this font in linear VRAM.
                    // NOTE: Profiling indicates charCodeAt() uses ~80% of the CPU consumed for this function.
                    // Caching these values reduces that to a negligible amount.
                    var current_indexes = [(cdg_pack.charCodeAt(4) & 0x0F), (cdg_pack.charCodeAt(5) & 0x0F)]; // Current colors.
                    var current_row = 0x00; // Subcode byte for current pixel row.
                    var temp_pxl = 0x00; // Decoded and packed 4bit pixel index values of current row.
                    for (var y_inc = 0; y_inc < 12; y_inc++) {
                        var pix_pos = y_inc * 50 + start_pixel;      // Location of the first pixel of this row in linear VRAM.
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
                    local_dirty[y_location * 50 + x_location] = 0x01;
                } // End of location check.
            } // End of channel check.
        }

        function proc_DO_SCROLL(cdg_pack) {
            var direction,
                copy_flag = (cdg_pack.charCodeAt(1) & 0x08) >> 3,
                color = cdg_pack.charCodeAt(4) & 0x0F;             // Color index to use for preset type.

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
            var x_src,
                y_src,
                y_start,
                buf = 0,
                line_color = fill_line_with_palette_index(color),
                local_vram = internal_vram;
            if (direction == 0x02) {
                // Step through the lines one at a time...
                for (y_src = 0; y_src < (50 * 216); y_src += 50) {
                    y_start = y_src;
                    buf = local_vram[y_start];
                    for (x_src = y_start + 1; x_src < y_start + 50; x_src++) {
                        local_vram[x_src - 1] = local_vram[x_src];
                    }
                    if (copy_flag) {
                        local_vram[y_start + 49] = buf;
                    } else {
                        local_vram[y_start + 49] = line_color;
                    }
                }
            }
            else if (direction == 0x01) {
                // Step through the lines on at a time.
                for (y_src = 0; y_src < (50 * 216); y_src += 50) {
                    // Copy the last six lines to the buffer.
                    y_start = y_src;
                    buf = local_vram[y_start + 49];
                    for (x_src = y_start + 48; x_src >= y_start; x_src--) {
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
            var dst_idx,
                src_idx,
                offscreen_size = CDG_ENUM.NUM_X_FONTS * CDG_ENUM.FONT_HEIGHT,
                buf = new Array(offscreen_size),
                line_color = fill_line_with_palette_index(color),
                local_vram = internal_vram;
            if (direction == 0x02) {
                dst_idx = 0;  // Buffer destination starts at 0.
                // Copy the top 300x12 pixels into the buffer.
                for (src_idx = 0; src_idx < offscreen_size; src_idx++) {
                    buf[dst_idx++] = local_vram[src_idx];
                }
                dst_idx = 0; // Destination starts at the first line.
                for (src_idx = offscreen_size; src_idx < (50 * 216); src_idx++) {
                    local_vram[dst_idx++] = local_vram[src_idx];
                }
                dst_idx = (CDG_ENUM.NUM_X_FONTS * 204); // Destination begins at line 204.
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
                // Copy the bottom 300x12 pixels into the buffer.
                for (src_idx = (50 * 204); src_idx < (50 * 216); src_idx++) {
                    buf[dst_idx++] = local_vram[src_idx];
                }
                for (src_idx = (50 * 204) - 1; src_idx > 0; src_idx--) {
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

        var defaults = {
                mediaPath: '',
                audioFormat: 'mp3',
                cdgFileExtension: 'cdg'
            },
            audioTypes = {
                mp3: 'audio/mpeg; codecs="mp3"',
                ogg: 'audio/ogg; codecs="vorbis"'
            },
            audioPlayer = null,
            audioSourceElement = null,
            cdgIntervalID = null,
            cdgHttpRequest = null,
            cdgData = null,
            cdgDecoder = null;

        function handleCDGHttpRequest() {
            if (!cdgHttpRequest) {
                return;
            }
            if (cdgHttpRequest.readyState == 4) {
                if (cdgHttpRequest.status != 200) {
                    throw new Error('CDG file failed to load');
                }
                cdgData = cdgHttpRequest.responseText;
                cdgHttpRequest = null;
            }
        }

        function handleAudioError() {
            if (audioPlayer.error) {
                var error_result = audioPlayer.error.code ? audioPlayer.error.code : audioPlayer.error;
                throw new Error("The audio control fired an error event. Could be: " + error_result);
            }
        }

        function updatePlayPosition() {
            if (cdgData != null) {
                var play_position = Math.floor(audioPlayer.currentTime * 300),
                    current_pack = cdgDecoder.get_current_pack(),
                    position_to_play;
                play_position = (play_position < 0) ? 0 : play_position;
                // Render from the beginning of the stream if a reverse seek of more than one second occurred.
                if (play_position < (current_pack - 300)) {
                    cdgDecoder.reset_cdg_state();
                    current_pack = 0;
                }
                position_to_play = current_pack + 6;
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
            cdgIntervalID = setInterval(updatePlayPosition, 20);
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

        function parseOptions(options) {
            if (!options || Array.isArray(options) || (typeof options !== 'string' && typeof options !== 'object')) {
                throw new Error('No track information specified, nothing to load!');
            }
            var audioFilePrefix,
                cdgFilePrefix,
                mediaPath = defaults.mediaPath,
                audioFormat = defaults.audioFormat,
                cdgFileExtension = defaults.cdgFileExtension;
            if (typeof options === 'object') {
                if (!options.audioFilePrefix) {
                    throw new Error('No audioFilePrefix property defined, nothing to load!');
                } else {
                    audioFilePrefix = options.audioFilePrefix;
                }
                cdgFilePrefix = options.cdgFilePrefix ? options.cdgFilePrefix : options.audioFilePrefix;
                if (options.mediaPath) {
                    mediaPath = options.mediaPath;
                }
                if (options.audioFormat) {
                    if (!audioTypes[options.audioFormat]) {
                        throw new Error('Unsupported audio format specified');
                    }
                    audioFormat = options.audioFormat;
                }
                if (options.cdgFileExtension) {
                    cdgFileExtension = options.cdgFileExtension;
                }
            } else {
                audioFilePrefix = cdgFilePrefix = options;
            }

            return {
                audioFilePrefix: audioFilePrefix,
                cdgFilePrefix: cdgFilePrefix,
                mediaPath: mediaPath,
                audioFormat: audioFormat,
                cdgFileExtension: cdgFileExtension
            }
        }

        function loadTrack(options) {
            var trackInfo = parseOptions(options);
            clearCDGInterval();
            cdgDecoder.reset_cdg_state();
            cdgDecoder.redraw_canvas();
            cdgData = null;
            cdgHttpRequest = new XMLHttpRequest();
            cdgHttpRequest.onreadystatechange = handleCDGHttpRequest;
            cdgHttpRequest.open("GET", trackInfo.mediaPath + trackInfo.cdgFilePrefix + "." + trackInfo.cdgFileExtension, true);
            cdgHttpRequest.setRequestHeader("Content-Type", "text/html");
            cdgHttpRequest.send();
            if (audioSourceElement == null) {
                audioSourceElement = document.createElement("source");
            }
            audioSourceElement.type = audioTypes[trackInfo.audioFormat];
            audioSourceElement.src = trackInfo.mediaPath + trackInfo.audioFilePrefix + "." + trackInfo.audioFormat;
            audioPlayer.appendChild(audioSourceElement);
            audioPlayer.load();
            return this;
        }

        function init(containerId, initOptions) {
            if (!containerId) {
                throw new Error("Required initialisation parameter missing.")
            }
            var containerEl = document.getElementById(containerId),
                borderEl = document.createElement("div"),
                canvasEl = document.createElement("canvas");
            audioPlayer = document.createElement("audio");
            borderEl.id = containerId + "-border";
            borderEl.className = "cdg-border";
            canvasEl.id = containerId + "-canvas";
            canvasEl.width = "288";
            canvasEl.height = "192";
            canvasEl.className = "cdg-canvas";
            audioPlayer.id = containerId + "-audio";
            audioPlayer.className = "cdg-audio";
            borderEl.appendChild(canvasEl);
            containerEl.appendChild(borderEl);
            containerEl.appendChild(audioPlayer);
            audioPlayer.style.width = canvasEl.offsetWidth + "px";
            audioPlayer.controls = (initOptions && initOptions.showControls) != false;
            audioPlayer.autoplay = (initOptions && initOptions.autoplay) != false;
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
    }

    return {
        init: function(containerId, initOptions) {
            return new CDGPlayer(containerId, initOptions);
        }
    }
});
