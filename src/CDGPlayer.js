import { CDGDecoder } from "./CDGDecoder.js";

/**
 * @typedef {Object} TrackOptions
 * @property {string} audioFilePrefix - Prefix of the audio file (required)
 * @property {string} [cdgFilePrefix] - Prefix of the CDG file; defaults to audioFilePrefix
 * @property {string} [mediaPath=''] - Path to the directory containing media files
 * @property {'mp3'|'ogg'} [audioFormat='mp3'] - Audio format
 * @property {string} [cdgFileExtension='cdg'] - CDG file extension
 */

/**
 * @typedef {Object} InitOptions
 * @property {boolean} [autoplay=true] - Start playing automatically when a track is loaded
 * @property {boolean} [showControls=true] - Show native audio controls
 * @property {boolean} [allowFullscreen=true] - Allow player to be toggled into fullscreen on double-click
 * @property {boolean} [allowClickToPlay=true] - Allow play/pause toggle on click
 */

class CDGPlayer {
  static #UPDATE_INTERVAL_MS = 20; // Canvas refresh rate.

  static #defaults = {
    mediaPath: "",
    audioFormat: "mp3",
    cdgFileExtension: "cdg",
  };

  static #audioTypes = {
    mp3: 'audio/mpeg; codecs="mp3"',
    ogg: 'audio/ogg; codecs="vorbis"',
  };

  #audioPlayer = null;
  #audioSourceElement = null;
  #cdgIntervalID = null;
  #cdgDecoder = null;
  #listeners = {};

  constructor(containerId, initOptions) {
    this.#init(containerId, initOptions);
  }

  /**
   * Loads a CDG track into the player.
   * @param {string|TrackOptions} trackOptions - Track filename prefix or full options object
   * @returns {Promise<CDGPlayer>}
   */
  async loadTrack(trackOptions) {
    const trackInfo = this.#parseTrackOptions(trackOptions);
    let cdgData = null;
    this.#clearCDGInterval();
    if (this.#audioSourceElement == null) {
      this.#audioSourceElement = document.createElement("source");
    }
    this.#audioSourceElement.type = CDGPlayer.#audioTypes[trackInfo.audioFormat];
    this.#audioSourceElement.src =
      trackInfo.mediaPath +
      trackInfo.audioFilePrefix +
      "." +
      trackInfo.audioFormat;
    this.#audioPlayer.appendChild(this.#audioSourceElement);
    this.#audioPlayer.load();
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
      this.#cdgDecoder.setCdgData(cdgData);
    } catch (error) {
      this.#emit("error", error);
    }
    return this;
  }

  /**
   * Registers an event handler on the player.
   * @param {string} event - Event name ('error')
   * @param {Function} handler - Handler function
   * @returns {CDGPlayer}
   */
  on(event, handler) {
    if (!this.#listeners[event]) {
      this.#listeners[event] = [];
    }
    this.#listeners[event].push(handler);
    return this;
  }

  /** @returns {void} */
  pause() {
    this.#audioPlayer.pause();
  }

  /** @returns {void} */
  play() {
    this.#audioPlayer.play();
  }

  /** @returns {void} */
  stop() {
    this.#audioPlayer.pause();
    this.#audioPlayer.currentTime = 0;
  }

  #emit(event, ...args) {
    if (this.#listeners[event] && this.#listeners[event].length > 0) {
      for (const handler of this.#listeners[event]) {
        handler(...args);
      }
    } else if (event === "error") {
      console.error(...args);
    }
  }

  #handleAudioError() {
    if (this.#audioPlayer.error) {
      const errorResult = this.#audioPlayer.error.code
        ? this.#audioPlayer.error.code
        : this.#audioPlayer.error;
      this.#emit(
        "error",
        new Error(
          "The audio control fired an error event. Could be: " + errorResult,
        ),
      );
    }
  }

  #setCDGInterval() {
    this.#cdgIntervalID = setInterval(() => {
      this.#cdgDecoder.updateFrame(this.#audioPlayer.currentTime);
    }, CDGPlayer.#UPDATE_INTERVAL_MS);
  }

  #clearCDGInterval() {
    clearInterval(this.#cdgIntervalID);
  }

  #parseTrackOptions(trackOptions) {
    if (
      !trackOptions ||
      Array.isArray(trackOptions) ||
      (typeof trackOptions !== "string" && typeof trackOptions !== "object")
    ) {
      throw new Error("No track information specified, nothing to load!");
    }
    let audioFilePrefix;
    let cdgFilePrefix;
    let mediaPath = CDGPlayer.#defaults.mediaPath;
    let audioFormat = CDGPlayer.#defaults.audioFormat;
    let cdgFileExtension = CDGPlayer.#defaults.cdgFileExtension;
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
        if (!CDGPlayer.#audioTypes[trackOptions.audioFormat]) {
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
      audioFilePrefix,
      cdgFilePrefix,
      mediaPath,
      audioFormat,
      cdgFileExtension,
    };
  }

  #toggleFullscreen(e) {
    if (!document.fullscreenElement) {
      e.target.requestFullscreen();
    } else {
      document.exitFullscreen?.();
    }
  }

  #togglePlay() {
    if (this.#audioPlayer.paused) {
      this.#audioPlayer.play();
    } else {
      this.#audioPlayer.pause();
    }
  }

  #init(containerId, initOptions) {
    if (!containerId) {
      throw new Error("Required initialisation parameter missing.");
    }
    const containerEl = document.getElementById(containerId);
    const borderEl = document.createElement("div");
    const canvasEl = document.createElement("canvas");
    this.#audioPlayer = document.createElement("audio");
    borderEl.id = containerId + "-border";
    borderEl.className = "cdg-border";
    canvasEl.id = containerId + "-canvas";
    canvasEl.className = "cdg-canvas";
    if (initOptions && initOptions.allowClickToPlay !== false) {
      canvasEl.addEventListener("click", () => this.#togglePlay(), true);
    }
    if (initOptions && initOptions.allowFullscreen !== false) {
      canvasEl.addEventListener(
        "dblclick",
        (e) => this.#toggleFullscreen(e),
        true,
      );
    }
    this.#audioPlayer.id = containerId + "-audio";
    this.#audioPlayer.className = "cdg-audio";
    borderEl.appendChild(canvasEl);
    containerEl.appendChild(borderEl);
    containerEl.appendChild(this.#audioPlayer);
    this.#audioPlayer.style.width = canvasEl.offsetWidth + "px";
    this.#audioPlayer.controls = !(
      initOptions && initOptions.showControls == false
    );
    this.#audioPlayer.autoplay = !(
      initOptions && initOptions.autoplay == false
    );
    this.#audioPlayer.addEventListener(
      "error",
      () => this.#handleAudioError(),
      true,
    );
    this.#audioPlayer.addEventListener(
      "play",
      () => this.#setCDGInterval(),
      true,
    );
    this.#audioPlayer.addEventListener(
      "pause",
      () => this.#clearCDGInterval(),
      true,
    );
    this.#audioPlayer.addEventListener(
      "abort",
      () => this.#clearCDGInterval(),
      true,
    );
    this.#audioPlayer.addEventListener(
      "ended",
      () => {
        this.#clearCDGInterval();
        this.#emit("ended");
      },
      true,
    );
    this.#cdgDecoder = new CDGDecoder(canvasEl, borderEl);
  }
}

export { CDGPlayer };
