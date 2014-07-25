/* heart.js v0.0.1
   copyright (c) 2012 darkf
   licensed under the terms of the MIT license, see LICENSE for details

   A Canvas-based graphics library inspired by (i.e. cloned from) Love 2D (https://love2d.org/)
   It's currently in its pre-alpha development stage, so don't expect anything to work,
   and feel free to send pull requests / file issues!

   Thank you for using heart.js! :-)
*/

(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD module
		define(factory);
	} else if (typeof exports === 'object') {
		// CommonJS module (Node or Browserify)
		module.exports = factory();
	} else {
		root.heart = factory();
	}
})(this, function() {
var heart = { _lastTick: new Date().getTime(), /* time of the last tick */
			  _dt: 0, /* time since last tick in seconds */
			  _fps: 0, /* frames per second */
			  _targetFPS: 30, /* the target FPS cap */
			  _bg: {r: 127, g: 127, b: 127}, /* background color */
			  _size: {w: 800, h: 600}, /* size of viewport */
			  _imagesLoading: [], /* for synchronous image loading */
			  _keysDown: {}, /* which keys are down (char -> bool) */
			  _canvasOffset: {x: 0, y: 0} /* offset of the canvas relative to the document */
			};

heart.HeartImage = function(img) {
	this.img = img;
};

heart.HeartImage.prototype.getWidth = function() {
	return this.img.width;
};

heart.HeartImage.prototype.getHeight = function() {
	return this.img.height;
};

heart.graphics = {
	rectangle: function(mode, x, y, w, h) {
		if(mode === "fill")
			heart.ctx.fillRect(x, y, w, h);
		else
			heart.ctx.strokeRect(x, y, w, h);
	},

	circle: function(mode, x, y, radius) {
		heart.ctx.beginPath();
		heart.ctx.arc(x, y, radius, 0, Math.PI*2, false);
		if(mode === "fill")
			heart.ctx.fill();
		else
			heart.ctx.stroke();
	},

	line: function(x1, y1, x2, y2) {
		heart.ctx.beginPath();
		heart.ctx.moveTo(x1, y1);
		heart.ctx.lineTo(x2, y2);
		heart.ctx.stroke();
	},

	polygon: function(mode, vertices) {
		if(vertices.length === undefined)
			vertices = Array.prototype.slice.call(arguments, 1);

		if(vertices.length <= 2) return;

		if(vertices.length % 2 !== 0) {
			throw "heart.graphics.polygon: number of vertices isn't even," +
				  " meaning you don't have x,y pairs";
		}

		heart.ctx.beginPath();
		heart.ctx.moveTo(vertices[0], vertices[1])
		for(var i = 2; i < vertices.length; i += 2) {
			heart.ctx.lineTo(vertices[i], vertices[i+1]);
		}

		if(mode === "fill")
			heart.ctx.fill();
		else {
			heart.ctx.lineTo(vertices[0], vertices[1]); // close the polygon
			heart.ctx.stroke();
		}
	},

	print: function(text, x, y) {
		heart.ctx.fillText(text, x, y);
	},

	setColor: function(r, g, b, a) {
		if(a === undefined) {
			heart.ctx.fillStyle = heart.ctx.strokeStyle = "rgb("+r+","+g+","+b+")";
		}
		else {
			a = (a/255).toFixed(1); // input is in 0..255, output is in 0.0..1.0
			heart.ctx.fillStyle = heart.ctx.strokeStyle = "rgba("+r+","+g+","+b+","+a+")";
		}
	},

	getWidth: function() {
		return heart._size.w;
	},

	getHeight: function() {
		return heart._size.h;
	},

	getBackgroundColor: function() {
		return heart._bg;
	},

	setBackgroundColor: function(r, g, b) {
		heart._bg = {r: r, g: g, b: b};
	},

	newImage: function(src, callback) {
		/* load an image */
		/* XXX: does not handle errors */
		var img = new Image();
		heart._imagesLoading.push(img);
		img.onload = function() {
			heart._imagesLoading.splice(heart._imagesLoading.indexOf(img), 1); /* remove img from the loading sequence */
			callback(new heart.HeartImage(img));
		};
		img.src = src;
	},

	draw: function(drawable, x, y) {
		if(drawable.img !== undefined) {
			heart.ctx.drawImage(drawable.img, x, y);
		}
	},

	translate: function(x, y) {
		heart.ctx.translate(x, y);
	},

	rotate: function(angle) {
		heart.ctx.rotate(angle);
	},

	push: function() {
		heart.ctx.save();
	},

	pop: function() {
		heart.ctx.restore();
	}
};

heart.timer = {
	getFPS: function() {
		return heart._fps;
	},

	getTargetFPS: function() {
		return heart._targetFPS;
	},

	setTargetFPS: function(fps) {
		heart._targetFPS = fps;
	},

	getTime: function() {
		return new Date().getTime();
	}
};

heart.keyboard = {
	isDown: function(key) {
		return heart._keysDown[key];
	},

	isUp: function(key) {
		return !heart.keyboard.isDown(key);
	}
};

heart.mouse = {
	_pos: {x: 0, y: 0},
	_btnState: {"l": false, "r": false}, /* left and right button press state */

	getPosition: function() {
		return [heart.mouse._pos.x, heart.mouse._pos.y];
	},

	getX: function() {
		return heart.mouse._pos.x;
	},

	getY: function() {
		return heart.mouse._pos.y;
	},

	isDown: function(button) {
		return heart.mouse._btnState[button] !== undefined ? heart.mouse._btnState[button] : false;
	}
};

heart._init = function() {
	/* if we're waiting on images to load, spinlock */
	if(heart._imagesLoading.length !== 0) {
		setTimeout(heart._init, 30 /* ms */);
		return;
	}

	if(heart.load !== undefined)
		heart.load();
	if(heart.canvas === undefined || heart.ctx === undefined)
		alert("no canvas");

	var rect = heart.canvas.getBoundingClientRect()
	heart._canvasOffset.x = rect.left
	heart._canvasOffset.y = rect.top

	/* register for mouse-related events (pertaining to the canvas) */
	heart.canvas.onmousedown = function(e) {
		var btn = heart._mouseButtonName(e.which);
		heart.mouse._btnState[btn] = true;
		if(heart.mousepressed)
			heart.mousepressed(e.pageX, e.pageY, btn);
	};

	heart.canvas.onmouseup = function(e) {
		var btn = heart._mouseButtonName(e.which);
		heart.mouse._btnState[btn] = false;
		if(heart.mousereleased)
			heart.mousereleased(e.pageX, e.pageY, btn);
	};

	heart.canvas.onmousemove = function(e) {
		heart.mouse._pos = {x: e.pageX - heart._canvasOffset.x, y: e.pageY - heart._canvasOffset.y};
		if(heart.mousemoved)
			heart.mousemoved(e.pageX, e.pageY);
	};

	/* keypressed and keyreleased are aliases to
	   keydown and keyup, respectively. */
	if(heart.keydown === undefined)
		heart.keydown = heart.keypressed;
	if(heart.keyup === undefined)
		heart.keyup = heart.keyreleased;

	heart._tick(); /* first tick */
};

heart._tick = function() {
	var time = new Date().getTime();
	heart._dt = time - heart._lastTick;
	heart._lastTick = time;
	heart._fps = Math.floor(1000 / heart._dt);

	if(heart.update)
		heart.update(heart._dt / 1000);

	heart.ctx.fillStyle = "rgb("+heart._bg.r+","+heart._bg.g+","+heart._bg.b+")";
	heart.ctx.fillRect(0, 0, heart._size.w, heart._size.h);
	if(heart.draw)
		heart.draw();

	setTimeout(heart._tick, 1000 / heart._targetFPS);
};

heart.attach = function(canvas) {
	var el = document.getElementById(canvas);
	if(!el)
		return false;
	heart.canvas = el;
	heart.ctx = heart.canvas.getContext("2d");
	if(!heart.ctx)
		alert("couldn't get canvas context")
};

heart._mouseButtonName = function(n) {
	switch(n) {
		case 1: return "l";
		case 2: return "m";
		case 3: return "r";
	}

	return "unknown";
};

heart._getKeyChar = function(c) {
	/* supply a hacky keymap */
	switch(c) {
		/* arrow keys */
		case 38: return "up";
		case 37: return "left";
		case 39: return "right";
		case 40: return "down";
		case 27: return "escape";
		case 13: return "return";
	}

	return String.fromCharCode(c).toLowerCase();
};

// XXX: we need a keymap, since browsers decide on being annoying and
// not having a consistent keymap. (also, this won't work with special characters.)
window.onkeydown = function(e) {
	var c = heart._getKeyChar(e.keyCode);
	heart._keysDown[c] = true;
	if(heart.keydown !== undefined)
		heart.keydown(c);
};

window.onkeyup = function(e) {
	var c = heart._getKeyChar(e.keyCode);
	heart._keysDown[c] = false;
	if(heart.keyup !== undefined)
		heart.keyup(c);
};

window.onfocus = function(e) {
	if (heart.focus) heart.focus(true);
}
window.onblur = function(e) {
	if (heart.focus) heart.focus(false);
}

window.onbeforeunload = function(e) {
	if (heart.quit) {
		var ret = heart.quit();
		if (ret) return ret;
	}
}

window.onload = function() {
	if(heart.preload !== undefined)
		heart.preload();
	heart._init();
};

return heart;
});
