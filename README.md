# THREE.Text
THREE.Text for three.js: text labels drawn from a texture atlas of the font, made in the browser

#### Demo ####
- **[1000 labels and two lines that change on every frame](https://spite.github.io/THREE.Text/examples/)**: the atlas of each font is shown next to the scene

#### 2026 update ####
**Disclaimer:** this library is from 2016. three.js still has no text of this kind built in, so it's still useful, but it's a simple one: a single line, no kerning, and it blurs when it gets much bigger than the size the atlas was made at

What three.js ships is different: `TextGeometry`, in the addons, builds real geometry out of a font converted to JSON, and `CSS2DRenderer`, also in the addons, positions DOM elements over the scene. For sharp text at any size, outside of three.js, there's [troika-three-text](https://github.com/protectwise/troika/tree/main/packages/troika-three-text).

The library has been rewritten for current three.js. What changed from the 2016 version:

- it's an ES module, and it needs three.js r155 or later
- the shaders are part of the library, they used to be script tags in the page
- all the labels of an atlas share one material, there used to be one per label, each with three arrays of uniforms
- strings can have any length, the limit was 32 characters
- the glyphs are measured with the canvas text metrics and packed into an atlas of the right size. They were measured by scanning pixels and drawn in a fixed grid, where wide glyphs overlapped and the last one had no size
- the origin of a label is at the start of its baseline, it used to be below it
- the font can also be one that's already loaded in the page, ```woffSrc``` is optional
- labels can have a color, and there's a ```dispose()``` for labels and atlases

#### How to use ####
Use npm to install it, alongside three.js
```
npm i three three.text-atlas
```
and import it in your code
```js
import * as THREE from 'three';
import { FontAtlas, Text, SCALE } from 'three.text-atlas';
```
It's a plain ES module, so it also works without a bundler as long as an import map resolves `three` (see [examples/index.html](examples/index.html)).

Create an atlas for a font. It draws the glyphs into a texture once the font has loaded:
```js
const atlas = new FontAtlas( {
  renderer: renderer,
  fontName: 'Permanent Marker',
  size: 140,
  woffSrc: 'url(https://fonts.gstatic.com/s/permanentmarker/v5/9vYsg5VgPHKK8SXYbf3sMupm9E4gBdgiUiSJePew_SQ.woff)'
} );

await atlas.onReady;
```
```size``` is the size of the font in the atlas, in pixels, 90 by default. Leave ```woffSrc``` out to use a font the page already has. The other settings are ```fontStyle```, ```string``` with the characters to include, and ```outline``` with the width of the black outline, 2 by default.

A callback as second argument works too, ```atlas.ready``` tells if it's done, and ```atlas.canvas``` is the atlas itself.

Create labels with the atlas, and add their mesh to the scene:
```js
const text = new Text( atlas );
text.set( 'Hello' );
scene.add( text.mesh );

const red = new Text( atlas, { color: 0xff0000 } );
```
Call ```set()``` whenever the text changes, it does nothing if the string is the same. Characters that are not in the atlas leave a space.

A label starts at the origin of its mesh and sits on the baseline. One pixel of the font is 0.001 units, and ```text.width``` is in pixels, so to center a label:
```js
text.mesh.position.x = - .5 * text.width * SCALE;
```
To release them:
```js
text.dispose();
atlas.dispose();
```

#### License ####

MIT licensed

Copyright (C) 2016 Jaume Sanchez Elias, http://www.clicktorelease.com
