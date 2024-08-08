var alertCount = 0;
function dbg(msg) {
    if(++alertCount < 10) {
        alert(msg);
    }
}
var width = 500;
var height = 500;
var particles = [];
var numParticles = 100000;
var diffScale = 0.1;
for(var i = 0; i < numParticles; ++i) {
    var hue = 6.0 * i / numParticles;
    var ih = Math.floor(hue);
    var f = hue - ih;
    if(ih % 2 == 0) f = 1 - f;
    var n = 1 - f;
    var ns = Math.floor(n * 0xFF);
    var red, green, blue;
    switch(ih) {
    case 0:
      red = 0xFF; green = ns; blue = 0; break;
    case 1:
      red = ns; green = 0xFF; blue = 0; break;
    case 2:
      red = 0; green = 0xFF; blue = ns; break;
    case 3:
      red = 0; green = ns; blue = 0xFF; break;
    case 4:
      red = ns; green = 0; blue = 0xFF; break;
    case 5:
      red = 0xFF; green = 0; blue = ns; break;
    }
    particles.push({
        x: width/2 + diffScale * i / numParticles,
        y: height/2,
        vx: 0, vy: 0,
        red: red, green: green, blue: blue,
        //friction: .99 + .005 * i / numParticles
    });
}

var mouseMass = 100;
var mouseX = 0, mouseY = 0;
var mouseDown = false;
var wrap = false;
function updateMousePos(e) {
    if (!e) {
        mouseX = width;
        mouseY = height;
    } else {
        mouseX = e.clientX;
        mouseY = e.clientY;
    }
}

var ctx = document.getElementById("playarea").getContext("2d");


ctx.fillStyle = "rgb(0, 0, 0)";
ctx.fillRect(0, 0, width, height);
var imgData = ctx.getImageData(0, 0, width, height);
var pxs = imgData.data;

function updateImage() {
    ctx.putImageData(imgData, 0, 0);
}

function blackenScreen() {
    for(var i = 0; i < pxs.length; i += 4) {
        pxs[i] = pxs[i+1] = pxs[i+2] = 0;
    }
}

blackenScreen();
updateImage();


function centerAll() {
    for(var i = 0; i < numParticles; ++i) {
        var p = particles[i];
        p.x = width/2 + diffScale * i / numParticles;
        p.y = height/2;
    }
}
function stopAll() {
    for(var i = 0; i < numParticles; ++i) {
        var p = particles[i];
        p.vx = p.vy = 0;
    }
}
var leaveTrails = true;

function handleKey(e) {
    var code = e.keyCode;
    switch(code) {
        case 66: //B for blacken
            blackenScreen();
            break;
        case 67: //C for center
            centerAll();
            blackenScreen();
            break;
        case 83: //S for stop
            stopAll();
            break;
        case 82: //R for reset
            stopAll();
            centerAll();
            blackenScreen();
            break;
        case 84: //T for toggle trail
            leaveTrails = !leaveTrails;
            break;
        case 87: //W for wrap
            wrap = !wrap;
            break;
    }
}
document.onkeyup = handleKey;



function setPx(p, x, y) {
    if (x < 0) x = 0;
    if (x >= width) x = width - 1;
    if (y < 0) y = 0;
    if (y >= height) y = height - 1;
    var i = 4 * (y * width + x);
    pxs[i] = p.red;
    pxs[i+1] = p.green;
    pxs[i+2] = p.blue;
}
function normx(x) {
    return (x % width + width) % width;
}
function normy(y) {
    return (y % width + width) % width;
}
function line(p, prevX, prevY) {
    /*var x1 = normx(prevX);
    var y1 = normy(prevY);
    var x2 = normx(p.x);
    var y2 = normy(p.y);
    if(Math.round(prevX - x1) != Math.round(p.x - x2) || Math.round(prevY - y1) != Math.round(p.y - y2)) return;*/
    var x1 = prevX, y1 = prevY, x2 = p.x, y2 = p.y;
    var dx = x2 - x1, dy = y2 - y1;
    if(dx == 0 && dy == 0) return;
    if(Math.abs(dx) > Math.abs(dy)) {
        var slope = dy / dx;
        var minX, maxX;
        if(dx >= 0) { minX = 0; maxX = dx; }
        else { minX = dx; maxX = 0; }
        for(var x = minX; x <= maxX; ++x) {
            setPx(p, Math.round(x + x1), Math.round(slope * x + y1));
        }
    } else {
        var slope = dx / dy;
        var minY, maxY;
        if(dy >= 0) { minY = 0; maxY = dy; }
        else { minY = dy; maxY = 0; }
        for(var y = minY; y <= maxY; ++y) {
            setPx(p, Math.round(slope * y + x1), Math.round(y + y1));
        }
    }
    /*ctx.lineWidth = 2;
    ctx.strokeStyle = "rgb(" + p.red + ", " + p.green + ", " + p.blue + ")";
    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();*/
}

function boundForce(x) {
    var scaled = 1.0 * (2 * x - 1);
    return -0.1 * scaled * Math.sqrt(-1 / (scaled * scaled - 1));
}

var minRadius = 20;
var minRadius2 = minRadius * minRadius;

var msPerFrame = 50;

function draw() { 
    if(!leaveTrails) blackenScreen();
    for(var i = 0; i < numParticles; ++i) {
        var p = particles[i];
        var prevX = p.x, prevY = p.y;
        if(mouseDown) {
            var dx = mouseX - p.x, dy = mouseY - p.y;
            var dist2 = dx*dx + dy*dy;
	        if(dist2 < minRadius2) dist2 = minRadius2;
            var dist = Math.sqrt(dist2);
            var dist3 = dist2 * dist;
            p.vx += mouseMass * dx / dist3;
            p.vy += mouseMass * dy / dist3;
        }
        //p.vx *= p.friction;
        //p.vy *= p.friction;
        p.x += p.vx;
        p.y += p.vy;
        
        /*var addVx = boundForce(p.x / width);
        var addVy = boundForce(p.y / height);
        if(!isNaN(addVx)) p.vx += addVx;
        if(!isNaN(addVy)) p.vy += addVy; */
        /*var wrapped = false;
        if(p.x >= width) { p.x -= width; wrapped = true; }
        if(p.x < 0) { p.x += width; wrapped = true; }
        if(p.y >= height) { p.y -= height; wrapped = true; }
        if(p.y < 0) { p.y += height; wrapped = true; }
        if(!wrapped) {
            line(p, prevX, prevY);
        }*/
        var doLine = true;
        if (wrap) {
          if (p.x < 0) { p.x += width; doLine = false; }
          else if (p.x >= width) { p.x -= width; doLine = false; }

          if (p.y < 0) { p.y += height; doLine = false; }
          else if (p.y >= height) { p.y -= height; doLine = false; }
        } else {
          if(p.x < 0 && p.vx < 0) {
              p.vx *= -1;
              p.x = 0 - p.x;
          } else if(p.x >= width && p.vx > 0) {
              p.vx *= -1;
              p.x = 2 * width - p.x;
          }
          if(p.y < 0 && p.vy < 0) {
              p.vy *= -1;
              p.y = 0 - p.y;
          } else if(p.y >= height && p.vy > 0) {
              p.vy *= -1;
              p.y = 2 * height - p.y;
          }
        }
        //if(p.x >= width && p.vx > 0 || p.x < 0 && p.vx < 0) p.vx = 0; //*= -1;
        //if(p.y >= height && p.vy > 0 || p.y < 0 && p.vy < 0) p.vy = 0; //*= -1;
        if (doLine) line(p, prevX, prevY);
    }
    updateImage();
}

function drawLoop() {
  var startTime = new Date().getTime();
  draw();
  var timeTaken = new Date().getTime() - startTime;
  setTimeout(drawLoop, Math.max(0, msPerFrame - timeTaken));
}
setInterval("draw()", 10);
