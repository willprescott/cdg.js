import { CDGDecoder } from "./CDGDecoder.js";
import { CDGPlayer } from "./CDGPlayer.js";

/**
 * Creates and initialises a new CDG karaoke player.
 * @param {string} containerId - ID of the DOM element that will contain the player
 * @param {InitOptions} [initOptions] - Player initialisation options
 * @returns {CDGPlayer}
 */
export function init(containerId, initOptions) {
  return new CDGPlayer(containerId, initOptions);
}

export { CDGDecoder };
