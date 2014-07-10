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

function hexGridToCube(grid) {
	//even-q layout -> cube layout
	var z = grid.y - (grid.x + (grid.x & 1)) / 2
	var y = -grid.x - z
	return {x: grid.x, y: y, z: z}
}

function hexDistance(a, b) {
	// we convert our hex coordinates into cube coordinates and then
	// we only have to see which of the 3 axes is the longest

    var cubeA = hexGridToCube(a)
    var cubeB = hexGridToCube(b)
	return Math.max(Math.abs(cubeA.x - cubeB.x),
	                Math.abs(cubeA.y - cubeB.y),
	                Math.abs(cubeA.z - cubeB.z))
}

function hexOppositeDirection(direction) {
	return (direction + 3) % 6
}

// The adjacent hex around a nearest to b
function hexNearestNeighbor(a, b) {
	var neighbors = hexNeighbors(a)
	var min = Infinity, minIdx = -1
	for(var i = 0; i < neighbors.length; i++) {
		var dist = hexDistance(neighbors[i], b)
		if(dist < min) {
			min = dist
			minIdx = i
		}
	}
	if(minIdx === -1)
		return null
	return {hex: neighbors[minIdx], distance: min, direction: minIdx}
}

// Draws a line between a and b, returning the list of coordinates (including b)
function hexLine(a, b) {
	var path = []
	var position = {x: a.x, y: a.y}
	while(true) {
		path.push(position)
		if(position.x === b.x && position.y === b.y)
			return path
		var nearest = hexNearestNeighbor(position, b)
		if(nearest === null)
			return null
		position = nearest.hex
	}
	throw "unreachable"
}

function pointInBoundingBox(point, bbox) {
	return (bbox.x <= point.x && point.x <= bbox.x+bbox.w &&
		    bbox.y <= point.y && point.y <= bbox.y+bbox.h)
}