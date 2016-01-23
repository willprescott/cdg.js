# cdg.js

cdg.js is a JavaScript library for playing CD+G karaoke files in a web browser.

The core of the library is derived from the awesome 
[CD+Graphics Magic HTML5 CD+G Player](http://cdgmagic.sourceforge.net/html5_cdgplayer/), to which full credit is given.

It is currently packaged as an AMD module as that was the environment of my primary use-case, but may support other
module types later. It has no other library dependencies.

## Usage

See the files in the [example](./example) directory for a working demo implementation. You will need to provide your
own CDG file and accompanying audio file for the demo to work (the example uses 2 files named `demo.cdg` and `demo.mp3`.

### Code examples

Simply provide an empty container element in your HTML source with an ID:

```html
<div id="cdg"></div>
```

And then, having required the cdg module, create a player instance, passing the ID of your element as the first argument:

```javascript
var player = cdg.init("cdg", {autoplay: false, showControls: true});
```

This initialises the player variable with an instance of a `CDGPlayer` object which can then be interacted with for
loading and playing your CDG tracks:

```javascript
player.loadTrack('demo');
player.play();
```

## API

### cdg.init(containerId[, initOptions])

Create a CDGPlayer instance and append it to the element specified by `containerId`.

#### containerID

Type: `String`

The ID of the DOM element into which you wish to append the CDG player

#### initOptions

Type: `Object`

Optional initialisation options for the main player control

```javascript
{
  autoplay: true // Boolean. Make tracks loaded into the player play automatically. Default: true
  controls: true // Boolean. Show playback controls/timeline on the player. Default: true
}
```

### CDGPlayer.loadTrack(trackOptions)

Load a new CDG track into the player. loadTrack() can be called with either a `String` or `Object` value for
`trackOptions` as follows.

#### trackOptions

Type: `String`

If `trackOptions` is a `String` it is used to denote the filename prefix of both the CDG and audio files, e.g.:

```javascript
player.loadTrack('demo');
```
This will cause the player to load a CDG file named `demo.cdg` and audio file `demo.mp3`.

Type: `Object`

If `trackOptions` is an object then additional properties of the track can be configured:

```javascript
player.loadTrack({
  audioFilePrefix: 'demo', // prefix of the audio file. Required
  cdgFilePrefix: 'demo', // prefix of the CDG file. Optional, defaults to audioFilePrefix value
  mediaPath: './', // the path to the directory containing the CDG and audio files. Default: './'
  audioFormat: 'mp3', // Format and extension of the audio file. 'mp3' or 'ogg' are curently supported. Default: 'mp3'
  cdgFileExtension: 'cdg' // Default: 'cdg'
});
```

### CDGPlayer.play()

Play the currently loaded track.

### CDGPlayer.pause()

Pause the currently playing track, preserving play position.

### CDGPlayer.stop()

Stop the currently playing track, resetting play position to start of track.