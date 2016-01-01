/*
 *  This file is part of CD+Graphics Magic.
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
 *
 */

"use strict";

// HTML5 audio player element to play the Ogg/Vorbis or MP3 audio file.
var audio_player = null;
var vorbis_source_element = null;
var layer3_source_element = null;
var cdg_timer_id = null;

// XML object and variable to get/contain the CDG file data.
// NOTE: XMLHttpRequest is absolutely NOT designed to be used this way.
// It does, however, seem to work for every browser tested, PROVIDED the PQ subcode bits are zero...
// That is to say all "character codes" are <=127.
var xml_file_request = null;
var cdg_file_data = null;
var status_div = null;

var my_cdgdecoder = null;

// Text used for the XML object status display.
var XML_STATUS_TEXT = ["No operations pending.",
    "Setting up file request...",
    "Headers received...",
    "Downloading graphics data...",
    "Graphics download complete."];

function CDG_Player_init(audio_id, canvas_id, border_id, status_id) {
    // Status text display... This should probably be done differently, but works for now.
    status_div = document.getElementById(status_id);

    // HTML5 audio player element to play the Ogg/Vorbis or MP3 audio file.
    audio_player = document.getElementById(audio_id);
    audio_player.addEventListener("error", audio_error_dialog, true);
    audio_player.addEventListener("play", start_cdg_timer, true);
    audio_player.addEventListener("pause", stop_cdg_timer, true);
    audio_player.addEventListener("ended", stop_cdg_timer, true);
    audio_player.addEventListener("abort", stop_cdg_timer, true);

    // HTML5 canvas elements for accessing RGBA pixels.
    var border_div = document.getElementById(border_id);
    var rgba_canvas = document.getElementById(canvas_id);

    my_cdgdecoder = new CDGDecoder(rgba_canvas, border_div);
}

function set_file_prefix(file_url_prefixes) {
    // Ignore this call if we weren't given a file name.
    if (file_url_prefixes == "") {
        return;
    }
    // Construct the file paths.
    var audio_file_prefix = file_url_prefixes.split(":", 2)[0];
    var cdg_file_prefix = file_url_prefixes.split(":", 2)[1];
    // Prepend the media files source directoy.
    // file_url_prefix = "media/" + file_url_prefix;
    // Stop, reset, and blank all the CD+G related stuff.
    stop_cdg_timer();
    my_cdgdecoder.reset_cdg_state();
    my_cdgdecoder.redraw_canvas();
    cdg_file_data = null;
    // Destroy any old XML object... Seems to fix some memory issues... Find a better way to do this, perhaps?
    // Moved this to before the audio, so there's a good chance we'll get the CDG before the audio starts.
    // Probably should make smarter autoplay function that checks periodically and 
    // invokes audio_player.play() only when there's sufficient data for BOTH audio and graphics.
    if (xml_file_request) {
        xml_file_request = null;
    }
    xml_file_request = new XMLHttpRequest();
    xml_file_request.onreadystatechange = xml_status_handler;
    xml_file_request.open("GET", cdg_file_prefix + ".cdg_gz", true); // Remove _gz for normal files.
    xml_file_request.setRequestHeader("Content-Type", "text/html");
    xml_file_request.send();
    // Create new source elements if needed;
    if (vorbis_source_element == null) {
        vorbis_source_element = document.createElement("source");
        vorbis_source_element.type = "audio/ogg; codecs=\"vorbis\"";
        layer3_source_element = document.createElement("source");
        layer3_source_element.type = "audio/mpeg; codecs=\"mp3\"";
    }
    // Set the new source elements
    vorbis_source_element.src = audio_file_prefix + ".ogg";
    layer3_source_element.src = audio_file_prefix + ".mp3";
    // Readd them (this should just update the new values, not duplicate) to the audio player element.
    audio_player.appendChild(vorbis_source_element);
    audio_player.appendChild(layer3_source_element);
    // Reload the sources, and make sure controls are available.
    audio_player.load();
    audio_player.controls = 1;
    audio_player.autoplay = 1;
}

// This handles the various events fired by the XMLHTTPObject used to download the CDG data.
function xml_status_handler() {
    // Just return if there's not a valid XML object... (I don't understand why/how this happens, but it does?!...)
    if (xml_file_request == null) {
        return;
    }
    // Initial status text string.
    var status_text = "Status: " + XML_STATUS_TEXT[xml_file_request.readyState];
    // Try out a progressive download here...
    if (xml_file_request.readyState == 3) {
        cdg_file_data = xml_file_request.responseText;
        status_text += " (" + cdg_file_data.length + " bytes)";
    }
    // The data is ready, so copy it one last time and destroy the XML object.
    if (xml_file_request.readyState == 4) {
        // Replace the status with an error message if we didn't get HTTP 200.
        if (xml_file_request.status != 200) {
            status_text = "Error: HTTP " + xml_file_request.status + "/" + xml_file_request.statusText + " (No graphics!)";
        }
        cdg_file_data = xml_file_request.responseText;
        xml_file_request = null;
    }
    // Actually set the status text...
    status_div.innerHTML = status_text;
}

function audio_error_dialog() {
    if (audio_player.error)  // I don't know how/why this handler is called when the error is null, but it
    {                        // happens far more often than never... Maybe related to multiple source fallback?
        // I'm not exactly how sure how this is supposed to work, but certain browsers put
        // the error in object.error, and some one level deeper in object.error.code...
        // (And still others might actually have it in the <source> object... ???)
        var error_result = audio_player.error;
        if (audio_player.error.code) {
            error_result = audio_player.error.code;
        }
        alert("The audio control fired an error event.\nCould be: " + error_result);
    }
}

// A little note about the timer silliness...
// Most browsers only seem to update the stream position
// at around 500ms intervals... Far too slowly to be useful...
// The timer smooths out the framerate, and occasionally readjusts
// if the deviation from the reported stream time is wide enough.
function start_cdg_timer() {
    cdg_timer_id = setInterval(update_play_position, 20);
    /*cdg_timer_id = setTimeout(update_play_position, 20);*/
}

function stop_cdg_timer() {
    clearInterval(cdg_timer_id);
    /*clearTimeout(cdg_timer_id);*/
    //my_cdgdecoder.reset_cdg_state();
    //my_cdgdecoder.redraw_canvas();
}

function update_play_position() {
    // Ignore if we don't have anything to play.
    if (cdg_file_data != null) {
        // Get the current media playback position, and convert it to an integer packet position.
        // Different browsers seem to have widely differing offsets compared to what's actually playing.
        // Maybe add a user control for sync?... And/or find some common default values to start with?...
        var play_position = Math.floor(audio_player.currentTime * 300);
        var current_pack = my_cdgdecoder.get_current_pack();
        // Constrain the play position to positive values only.
        play_position = (play_position < 0) ? 0 : play_position;
        // Render from the beginning of the stream if a reverse seek of more than one second occurred.
        if (play_position < (current_pack - 300)) {
            my_cdgdecoder.reset_cdg_state();
            current_pack = 0;
        }
        // Calculate the next probable play position, in packs... See "timer" note above.
        var position_to_play = current_pack + 6;
        // Jump to the actual play position if it's ahead of our calculated smoothed position.
        position_to_play = (play_position > position_to_play) ? play_position : position_to_play;
        // Check if we should render any packs, and do so if needed.
        if (position_to_play > current_pack) {
            my_cdgdecoder.decode_packs(cdg_file_data, position_to_play);
            my_cdgdecoder.redraw_canvas();
        }
    }
    // Time to go around again, if not using setInterval...
    /*cdg_timer_id = setTimeout(update_play_position, 20);*/
}
