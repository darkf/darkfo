// Geometry-related functions, for the hex and isometric grids.

function toTileNum(position) {
	return position.y * 200 + position.x
}

function fromTileNum(tile) {
	return {x: tile % 200, y: Math.floor(tile / 200)}
}

function tileToScreen(x, y) {
	x = 99 - x // this algorithm expects x to be reversed
	var sx = 4752 + (32 * y) - (48 * x)
	var sy = (24 * y) + (12 * x)

   return {x: sx, y: sy}
}

function tileFromScreen(x, y) {
	var off_x = -4800 + x
	var off_y = y
	var xx = off_x - off_y * 4 / 3
	var tx = xx / 64

	if (xx >= 0) tx++
	tx = -tx
	var yy = off_y + off_x / 4
	var ty = yy / 32
	if (yy < 0) ty--

	return {x: 99 - Math.round(tx), y: Math.round(ty)}
}

function hexToScreen(x, y) {
	var sx = 4816 - ((((x + 1) >> 1) << 5) + ((x >> 1) << 4) - (y << 4))
	var sy = ((12 * (x >> 1)) + (y * 12)) + 11

	return {x: sx, y: sy}
}

function hexFromScreen(x, y) {
	var x0 = 4800
	var y0 = 0
	var nx, ny

	if (x - x0 < 0)
		nx = (x - x0 + 1) / 16 - 1
	else
		nx = (x - x0) / 16

	if (y - y0 < 0)
		ny = (y - y0 + 1) / 12 - 1
	else
		ny = (y - y0) / 12

	if (Math.abs(nx) % 2 != Math.abs(ny) % 2)
		nx--;

	var xhBase = x0 + 16 * nx
	var yhBase = y0 + 12 * ny

	var hx = (4 * (yhBase - y0) - 3 * (xhBase - x0)) / 96
	var hy = (yhBase - y0) / 12 - hx / 2

	var dx = x - xhBase
	var dy = y - yhBase

	switch(dy)
	{
	  case 0:
	     if (dx < 12)
	     {
	    hy--;
	    break;
	 }
	 if (dx > 18)
	     {
	    if (hx % 2 == 1)
	       hy--;
	        hx--;
	        break;
	     }

	  case 1:
	     if (dx < 8)
	     {
	    hx--;
	    break;
	 }
	 if (dx > 23)
	     {
	    if (hx % 2 == 1)
	       hy--;
	    hx--;
	    break;
	 }

	  case 2:
	 if (dx < 4)
	     {
	    hy--;
	    break;
	 }
	     if (dx > 28)
	     {
	    if (hx % 2 == 1)
	       hy--;
	        hx--;
	    break;
	 }
	  default:
	     break;
	}


	return {x: Math.round(hx), y: Math.round(hy)}
}

function hexNeighbors(position) {
	var neighbors = []
	var x = position.x
	var y = position.y

	function n(x, y) {
		neighbors.push({x: x, y: y})
	}

	if(x % 2 === 0) {
	  n(x-1,y)
	  n(x-1,y+1)
	  n(x,y+1)
	  n(x+1,y+1)
	  n(x+1,y)
	  n(x,y-1)
	} else{
	  n(x-1,y-1)
	  n(x-1,y)
	  n(x,y+1)
	  n(x+1,y)
	  n(x+1,y-1)
	  n(x,y-1)
	}

	return neighbors
}

function hexInDirection(position, dir) {
	return hexNeighbors(position)[dir]
}

function directionOfDelta(xa, ya, xb, yb) {
	var neighbors = hexNeighbors({x: xa, y: ya})
	for(var i = 0; i < neighbors.length; i++) {
		if(neighbors[i].x === xb && neighbors[i].y === yb)
			return i
	}

	return null
}

function hexDistance(a, b) {
	var dx = a.x - b.x
	var dy = a.y - b.y
	return Math.sqrt(dx*dx + dy*dy)
}

function hexOppositeDirection(direction) {
	return (direction + 3) % 6
}