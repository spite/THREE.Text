import {
	BufferAttribute,
	BufferGeometry,
	CanvasTexture,
	Color,
	DoubleSide,
	DynamicDrawUsage,
	LinearMipmapLinearFilter,
	Mesh,
	ShaderMaterial,
	SRGBColorSpace
} from 'three';

// world units per pixel of the font size
const SCALE = .001;

const vertexShader = /* glsl */`

	varying vec2 vUv;

	void main() {

		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

	}

`;

const fragmentShader = /* glsl */`

	uniform sampler2D map;
	uniform vec3 color;

	varying vec2 vUv;

	void main() {

		vec4 c = texture2D( map, vUv );
		gl_FragColor = vec4( c.rgb * color, c.a );

		#include <colorspace_fragment>

	}

`;

class FontAtlas {

	constructor( settings, onReady ) {

		this.settings = settings;
		this.ready = false;

		this.string = settings.string || ' abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,.-;:_!"·$%&/()=?¿<>';
		this.fontName = settings.fontName;
		this.fontStyle = settings.fontStyle || '';
		this.size = settings.size || 90;
		this.outline = settings.outline !== undefined ? settings.outline : 2;
		this.fontString = this.fontStyle + ' ' + this.size + 'px "' + this.fontName + '"';

		this.canvas = document.createElement( 'canvas' );
		this.glyphs = {};
		this.lineHeight = 0;

		this.texture = new CanvasTexture( this.canvas );
		this.texture.minFilter = LinearMipmapLinearFilter;
		this.texture.colorSpace = SRGBColorSpace;
		this.texture.premultiplyAlpha = true;
		if ( settings.renderer ) this.texture.anisotropy = settings.renderer.capabilities.getMaxAnisotropy();

		// shared by every Text of this atlas that keeps the default color
		this.material = new ShaderMaterial( {
			uniforms: {
				map: { value: this.texture },
				color: { value: new Color( 0xffffff ) }
			},
			vertexShader,
			fragmentShader,
			side: DoubleSide,
			transparent: true,
			premultipliedAlpha: true,
			depthWrite: false
		} );

		let font;

		if ( settings.woffSrc ) {

			const fontface = new FontFace( this.fontName, settings.woffSrc );
			document.fonts.add( fontface );
			font = fontface.load();

		} else {

			font = document.fonts.load( this.fontString, this.string );

		}

		this.onReady = font.then( () => {

			this.build();
			this.ready = true;
			if ( onReady ) onReady( this );
			return this;

		} );

	}

	build() {

		const measure = document.createElement( 'canvas' ).getContext( '2d' );
		measure.font = this.fontString;

		// room for the outline, and so that neighbours don't bleed into the mipmaps
		const padding = Math.ceil( this.outline ) + 4;
		const chars = Array.from( new Set( this.string ) );
		let ascent = 0, descent = 0, cellWidth = 0;

		for ( const char of chars ) {

			const m = measure.measureText( char );
			const left = Math.max( 0, m.actualBoundingBoxLeft );
			const right = Math.max( m.width, m.actualBoundingBoxRight );

			this.glyphs[ char ] = { advance: m.width, left, width: left + right };

			ascent = Math.max( ascent, m.actualBoundingBoxAscent );
			descent = Math.max( descent, m.actualBoundingBoxDescent );
			cellWidth = Math.max( cellWidth, left + right );

		}

		cellWidth = Math.ceil( cellWidth ) + 2 * padding;
		const cellHeight = Math.ceil( ascent ) + Math.ceil( descent ) + 2 * padding;
		const columns = Math.ceil( Math.sqrt( chars.length * cellHeight / cellWidth ) );
		const rows = Math.ceil( chars.length / columns );

		const canvas = this.canvas;
		canvas.width = columns * cellWidth;
		canvas.height = rows * cellHeight;

		const ctx = canvas.getContext( '2d' );
		ctx.font = this.fontString;
		ctx.fillStyle = '#ffffff';
		ctx.strokeStyle = '#000000';
		ctx.lineWidth = this.outline;

		chars.forEach( ( char, i ) => {

			const glyph = this.glyphs[ char ];
			const x = ( i % columns ) * cellWidth;
			const y = Math.floor( i / columns ) * cellHeight;
			const originX = x + padding + glyph.left;
			const baseline = y + padding + Math.ceil( ascent );

			ctx.fillText( char, originX, baseline );
			if ( this.outline > 0 ) ctx.strokeText( char, originX, baseline );

			// the quad of a glyph, relative to its origin on the baseline, and where it is in the atlas
			glyph.x0 = - glyph.left - padding;
			glyph.x1 = glyph.width - glyph.left + padding;
			glyph.y0 = - Math.ceil( descent ) - padding;
			glyph.y1 = Math.ceil( ascent ) + padding;
			glyph.u0 = x / canvas.width;
			glyph.u1 = ( x + glyph.width + 2 * padding ) / canvas.width;
			glyph.v0 = 1 - ( y + cellHeight ) / canvas.height;
			glyph.v1 = 1 - y / canvas.height;

		} );

		this.lineHeight = cellHeight - 2 * padding;
		this.texture.needsUpdate = true;

	}

	dispose() {

		this.texture.dispose();
		this.material.dispose();

	}

}

class Text {

	constructor( atlas, settings = {} ) {

		this.atlas = atlas;
		this.width = 0;
		this.cached = null;

		this.geometry = new BufferGeometry();
		this.material = atlas.material;

		if ( settings.color !== undefined ) {

			this.material = atlas.material.clone();
			this.material.uniforms.map.value = atlas.texture;
			this.material.uniforms.color.value = new Color( settings.color );

		}

		this.mesh = new Mesh( this.geometry, this.material );
		this.allocate( 32 );

	}

	allocate( length ) {

		const index = new Uint16Array( length * 6 );

		for ( let i = 0; i < length; i ++ ) {

			index.set( [ 0, 1, 2, 2, 1, 3 ].map( v => i * 4 + v ), i * 6 );

		}

		this.geometry.dispose();
		this.geometry.setIndex( new BufferAttribute( index, 1 ) );
		this.geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( length * 12 ), 3 ).setUsage( DynamicDrawUsage ) );
		this.geometry.setAttribute( 'uv', new BufferAttribute( new Float32Array( length * 8 ), 2 ).setUsage( DynamicDrawUsage ) );

		this.maxLength = length;

	}

	set( string, force ) {

		string += '';

		if ( ! force && string === this.cached ) return;

		if ( ! this.atlas.ready ) throw new Error( 'THREE.Text: the font atlas is not ready yet, wait for atlas.onReady' );

		const chars = Array.from( string );

		if ( chars.length > Math.min( this.maxLength, 16383 ) ) this.allocate( Math.min( chars.length, 16383 ) );

		const position = this.geometry.attributes.position;
		const uv = this.geometry.attributes.uv;
		const glyphs = this.atlas.glyphs;
		const count = Math.min( chars.length, this.maxLength );

		let x = 0;

		for ( let i = 0; i < count; i ++ ) {

			// characters that are not in the atlas leave a space
			const glyph = glyphs[ chars[ i ] ] || glyphs[ ' ' ];

			const x0 = ( x + glyph.x0 ) * SCALE, x1 = ( x + glyph.x1 ) * SCALE;
			const y0 = glyph.y0 * SCALE, y1 = glyph.y1 * SCALE;

			position.setXYZ( i * 4, x0, y0, 0 );
			position.setXYZ( i * 4 + 1, x1, y0, 0 );
			position.setXYZ( i * 4 + 2, x0, y1, 0 );
			position.setXYZ( i * 4 + 3, x1, y1, 0 );

			uv.setXY( i * 4, glyph.u0, glyph.v0 );
			uv.setXY( i * 4 + 1, glyph.u1, glyph.v0 );
			uv.setXY( i * 4 + 2, glyph.u0, glyph.v1 );
			uv.setXY( i * 4 + 3, glyph.u1, glyph.v1 );

			x += glyph.advance;

		}

		position.needsUpdate = true;
		uv.needsUpdate = true;

		this.geometry.setDrawRange( 0, count * 6 );
		this.geometry.computeBoundingSphere();

		this.width = x;
		this.cached = string;

	}

	dispose() {

		this.geometry.dispose();
		if ( this.material !== this.atlas.material ) this.material.dispose();

	}

}

export { FontAtlas, Text, SCALE };
