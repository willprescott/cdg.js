// load the optimised files from /dist directory
requirejs.config({
    baseUrl: '../dist'
});
require(['cdg'], function(cdg) {
    var player = cdg.init("cdg", {autoplay: false, showControls: true});
    /*
     player.loadTrack() accepts either a string (containing just a filename prefix) or an object for
     more fine-grained control.

     player.loadTrack('demo'); // sets both audio and cdg file prefix to 'demo' with defaults for other props.

     For this example to work you need to provide your own 'demo.mp3' and 'demo.cdg' and place them in the
     same directory as this file (or reconfigure below as appropriate).

     Other options can be customised like this:

     player.loadTrack({
         audioFilePrefix: 'demo', // prefix of the audio file. Required
         cdgFilePrefix: 'demo', // prefix of the CDG file. Optional, defaults to audioFilePrefix value
         mediaPath: './', // the path to the directory containing the CDG and audio files. Default: './'
         audioFormat: 'mp3', // 'mp3' or 'ogg' are supported, default is 'mp3'
         cdgFileExtension: 'cdg' // default is 'cdg'
     });
     */
    player.loadTrack('demo');

    // The player also exposes play(), pause() and stop() methods which can be easily bound to event handlers

    document.getElementById("playbtn").addEventListener("click", function() {
        player.play();
    });
    document.getElementById("pausebtn").addEventListener("click", function() {
        player.pause();
    });
    document.getElementById("stopbtn").addEventListener("click", function() {
        player.stop();
    });
    document.getElementById("loadnewtrack").addEventListener("click", function() {
        player.loadTrack('vktrs');
    });

    // Example fullscreen support provided by screenfull.js: https://github.com/sindresorhus/screenfull.js
    var rgbaCanvas = document.getElementById("cdg-canvas");
    rgbaCanvas.addEventListener("dblclick", function(e) {
        if (screenfull.enabled) {
            screenfull.request(e.target);
        }
    });
});