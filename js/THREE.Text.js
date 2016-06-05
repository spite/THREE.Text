(function(){

    'use strict';

    if( !('FontFace' in window ) ) {

        window.FontFace = function( name, src ) {

            var type = "woff";
            if( src.indexOf( 'woff2' ) !== -1 ) type = 'woff2';

            var src = "\
            @font-face {\
    font-family: '" + name + "';\
    src: local('" + name + "'), " + src + " format(" + type + ");\
}\
"
            console.log( src )

            var newStyle = document.createElement('style');
            newStyle.appendChild( document.createTextNode( src ));

            document.head.appendChild( newStyle );

            var fontStyle = 'normal';
            var fontSize = 140;
            var fontName = name;
            var fontString = fontStyle + ' ' + fontSize + 'px "' + fontName + '"';
            var testStr = 'lorem ipsum dolor sit amet';

            var canvas = document.createElement( 'canvas' );
            var ctx = canvas.getContext( '2d' );

            this.loaded = new Promise( function( resolve, reject ) {

                var wait = 0;

                ctx.font = fontString
                var res = ctx.measureText( testStr );
                var defaultWidth = res.width;

                function waitForFont() {

                    ctx.font = fontString;
                    var res = ctx.measureText( testStr );
                    if( res.width != defaultWidth ) {
                        resolve();
                    } else if( wait > 30 ) {
                        reject();
                    } else {
                        wait++;
                        setTimeout( waitForFont.bind( this ), 100 );
                    }

                }

                waitForFont();

            } );
        }

        window.FontFace.prototype.load = function() {
            return this.loaded;
        }

    }

    // https://github.com/filamentgroup/woff2-feature-test/blob/master/woff2.js
    //var f = new window.FontFace('t', 'url( "data:application/font-woff2;base64,d09GMgABAAAAAAIkAAoAAAAABVwAAAHcAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABlYAgloKLEoBNgIkAxgLDgAEIAWDcgc1G7IEyB6SJAFID5YA3nAHC6h4+H7s27nP1kTyOoQkGuJWtNGIJKYznRI3VEL7IaHq985ZUuKryZKcAtJsi5eULwUybm9KzajBBhywZ5ZwoJNuwDX5C/xBjvz5DbsoNsvG1NGQiqp0NMLZ7JlnW+5MaM3HwcHheUQeiVokekHkn/FRdefvJaTp2PczN+I1Sc3k9VuX51Tb0Tqqf1deVXGdJsDOhz0/EffMOPOzHNH06pYkDDjs+P8fb/z/8n9Iq8ITzWywkP6PBMMN9L/O7vY2FNoTAkp5PpD6g1nV9WmyQnM5uPpAMHR2fe06jbfvzPriekVTQxC6lpKr43oDtRZfCATl5OVAUKykqwm9o8R/kg37cxa6eZikS7cjK4aIwoyh6jOFplhFrz2b833G3Jii9AjDUiAZ9AxZtxdEYV6imvRF0+0Nej3wu6nPZrTLh81AVcV3kmMVdQj6Qbe9qetzbuDZ7vXOlRrqooFSxCv6SfrDICA6rnHZXQPVcUHJYGcoqa3jVH7ATrjWBNYYkEqF3RFpVIl0q2JvMOJd7/TyjXHw2NyAuJpNaEbz8RTEVtCbSH7JrwQQOqwGl7sTUOtdBZIY2DKqKlvOmPvUxJaURAZZcviTT0SKHCXqzwc=" ) format( "woff2" )', {});
    //f.load().then( function(){ console.log( 'woff2 support' ); } ).catch(function() { console.log( 'woff2 not supported')});

    if( document.fonts === undefined ) {
        document.fonts = {
            add: function() {}
        }
    }
    //document.fonts = {}
    //document.fonts.add = function(){}

    THREE.FontTextureCache = function() {

        this.fonts = {}

    }

    THREE.FontTextureCache.prototype.add = function( id, font ) {

        this.fonts[ id ] = font;

    }

    THREE.FontAtlasCache = function() {

        this.cache = {};

    }

    THREE.FontAtlasCache.prototype.add = function( atlas ) {

        this.cache[ atlas.fontName ] = atlas;

    }

    THREE.FontAtlasCache.prototype.get = function( fontName ) {

        return this.cache[ fontName ];

    }

    THREE.FontAtlas = function( settings, onReady ) {

        this.settings = settings;
        this.ready = false;

        this.canvas = document.createElement( 'canvas' );
        this.ctx = this.canvas.getContext( '2d' );
        this.w = this.canvas.width;
        this.h = this.canvas.height;

        this.string = ' abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890,.-;:_!"·$%&/()=?¿<>'
        this.texture = null;
        this.fontStyle = this.settings.fontStyle || '';
        this.leftPosition = 0;
        this.onReady = onReady;

        this.fontName = settings.fontName;
        this.size = this.settings.size || 90;
        this.width = 0;

        this.dimensions = []

        this.texture = new THREE.Texture( 
            document.createElement( 'img' ), 
            THREE.UVMapping, 
            THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, 
            THREE.LinearFilter, THREE.LinearMipMapLinearFilter, 
            THREE.RGBAFormat, THREE.UnsignedByteType, 
            settings.renderer.getMaxAnisotropy() 
            )
        this.texture.premultiplyAlpha = true

        this.fontString = this.fontStyle + ' ' + this.size + 'px "' + this.fontName + '"';

        this.fontface = new window.FontFace( this.fontName, this.settings.woffSrc );
        document.fonts.add(this.fontface);

        var div = document.createElement( 'div' );
        div.style.fontFamily = this.fontName;
        div.textContent = 'This is a test string';
        document.body.appendChild( div )

        this.fontface.loaded.then( function() {

            this.measureGlyphs();
            console.log( this.fontName + ' loaded' )
            this.ready = true;
            if( this.onReady ) this.onReady();
            document.body.removeChild( div )

        }.bind( this ));

    }

    THREE.FontAtlas.prototype.constructor = THREE.FontAtlas;

    THREE.FontAtlas.prototype.measureGlyphs = function() {

        console.log( 'Computing glyphs for ' + this.fontName );

        var w = 0;
        this.ctx.font = this.fontString;
        var y = this.size;
        for( var j in this.string ) {
            var res = this.ctx.measureText( this.string[ j ] );
            if( res.width > w ) w = res.width;
        }

        var h = Math.ceil( 1.5 * this.size );

        this.canvas.width = w;
        this.canvas.height = this.string.length * h;

        this.ctx.font = this.fontString;
        this.ctx.fillStyle = '#ffffff'

        var s = '';
        var y = this.size;
        for( var j in this.string ) {
            this.ctx.fillText( this.string[ j ], 0, y );
            y += h
        }

        var imageData = this.ctx.getImageData( 0, 0, this.canvas.width, this.canvas.height );
        var d = imageData.data;

        var ptr = 0;
        var left = {};
        var right = {};
        var min = 1000, max = 0;
        for( var y = 0; y < this.canvas.height; y++ ) {
            for( var x = 0; x < this.canvas.width; x++ ) {
                var a = d[ ptr ];
                if( a > 0 ){
                    if( x < min ) min = x;
                    if( x > max ) max = x;
                }
                ptr += 4;
            }
            if( y > 0 && ( y % h === 0 ) ) {
                var p = Math.floor( y / h ) - 1;
                left[ p ] = min - 2;
                right[ p ] = max + 2;
                min = 1000, max = 0;
            }
        }

        this.dimensions = []
        for( var j in this.string ) {
            var minP = left[ j ];
            var maxP = right[ j ];
            this.dimensions[ j ] = maxP - minP;
        }

        this.dimensions[ 0 ] = .25 * this.size;

        var fCanvas = document.createElement( 'canvas' );
        var side = Math.ceil( Math.sqrt( this.string.length ) );
        fCanvas.width = 1024
        fCanvas.height = 2048
        var cw = fCanvas.width / side;
        var ch = fCanvas.height / side;
        var fCtx = fCanvas.getContext( '2d' );

        //document.body.appendChild( fCanvas );
        fCanvas.style.position = 'absolute'
        fCanvas.style.left = fCanvas.style.top = 0
        fCanvas.style.border = '1px solid red'

        var x = 0;
        var y = 0;
        fCtx.strokeStyle = '#000000'
        fCtx.font = this.fontString;
        fCtx.fillStyle = '#ffffff'
        fCtx.lineWidth = 2;
        for( var j in this.string ) {
            fCtx.fillText( this.string[ j ], x * cw, ( y + .75 ) * ch );
            fCtx.strokeText( this.string[ j ], x * cw, ( y + .75 ) * ch );
        /*fCtx.beginPath();
        fCtx.rect( x * cw, y * ch, cw, ch );
        fCtx.stroke()*/
        x++;
        if( x >= side ) {
            y++;
            x =0;
        }
        }

        this.texture.image = fCanvas;
        this.texture.needsUpdate = true;

        this.leftPosition = left;
        this.size = ch;
        this.cached = null;

    }

    THREE.Text = function( atlas ) {

        this.atlas = atlas;

        this.geometry = new THREE.BufferGeometry();
        this.maxLength = 32;
        this.positions = [];
        this.ids = [];
        this.indices = [];
        this.h = 1;
        for( var x = 0; x <= this.maxLength; x++ ){

            [ 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0 ].forEach( function( v ) { this.positions.push( v ) }.bind( this ) );
            [ x, x, x, x ].forEach( function( v ) { this.ids.push( v ) }.bind( this ) ) ;

        }

        for( var x = 0; x < this.maxLength; x++ ){

            [ 0, 1, 2, 1, 2, 3 ].forEach( function( v ) { this.indices.push( 4 * x + v ) }.bind( this ) );

        }

        this.geometry.setIndex( new THREE.BufferAttribute( new Uint16Array( this.indices ), 1 ) );
        this.geometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( this.positions ), 3 ) );
        this.geometry.addAttribute( 'id', new THREE.BufferAttribute( new Float32Array( this.ids ), 1 ) );

        this.chars = [];
        this.widths = [];
        this.lefts = [];

        this.material = new THREE.RawShaderMaterial( {
            uniforms: {
                string: { type: 'iv1', value: [] },
                widths: { type: 'fv1', value: [] },
                lefts: { type: 'fv1', value: [] },
                map: { type: 't', value: this.atlas.texture },
                dimensions: { type: 'v3', value: new THREE.Vector3( this.atlas.texture.image.width, this.atlas.texture.image.height, this.atlas.size ) }
            },
            vertexShader: document.getElementById( 'text-vertex-shader' ).textContent,
            fragmentShader: document.getElementById( 'text-fragment-shader' ).textContent,
            side: THREE.DoubleSide,
            wireframe: false,
            transparent: true,
            depthWrite: false
        } );

        this.mesh = new THREE.Mesh( this.geometry, this.material );

    }

    THREE.Text.prototype.convertString = function( str ) {
        var res = [];
        str += '';
        for( var j in str ) {
            res.push( this.atlas.string.indexOf( str[ j ] ) );
        }
        for( var j = res.length; j < this.maxLength; j++ ){
            res.push( ' ' );
        }
        return res;
    }

    THREE.Text.prototype.getWidths = function( chars ) {
        var res = []
        this.width = 0;
        chars.forEach( function( c ) {
            var w = this.atlas.dimensions[ c ]
            res.push( w )
            if( w !== undefined ) this.width += w 
        }.bind( this ) )
        return res;
    }

    THREE.Text.prototype.getLefts = function( chars ) {
        var res = []
        chars.forEach( function( c ) {
            res.push( this.atlas.leftPosition[ c ] )
        }.bind( this ) )
        return res;
    }

    THREE.Text.prototype.set = function( string, force ) {

        if( force || string !== this.cached) {
            var chars = this.convertString( string );
            this.material.uniforms.string.value = chars;
            this.material.uniforms.widths.value = this.getWidths( chars );
            this.material.uniforms.lefts.value = this.getLefts( chars );
            this.cached = string;
        }

    }

})();
