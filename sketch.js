let img = null;
let imgX = 0, imgY = 0;
let zoom = 1.0;
let viewAngle = 0;
const ZOOM_STEP = 0.1;
const PAN_STEP = 20;

let lines = [];
let currentLineColor = '#ff0000';
let dragging = false;
let dragStartX = 0, dragStartY = 0;
let selectedLine = null;
let mmbPanning = false;
let mmbLastX = 0, mmbLastY = 0;

const EP_RADIUS = 8;
let epDragLine = null;
let epDragIndex = 0;

let inputText = '';
let inputFocused = false;
let justSelected = false;

let _inX=0,_inY=0,_inW=0,_inH=0;
let _ckX=0,_ckY=0,_ckS=0;

let calibrationLine = null;
let pixelsPerUnit = 0;

let fileInput, openBtn, colorPicker, zoomDisplay, resetView, resetLines, resetImage, undoBtn, redoBtn, rotateLeftBtn, rotateRightBtn, saveBtn;
let redoStack = [];

function setup() {
  const holder = document.getElementById('canvas-holder');
  createCanvas(holder.clientWidth, holder.clientHeight).parent('canvas-holder');

  fileInput = select('#fileInput');
  openBtn = select('#openBtn');
  colorPicker = select('#colorPicker');
  zoomDisplay = select('#zoomDisplay');
  resetView = select('#resetView');

  openBtn.mousePressed(()=> fileInput.elt.click());
  fileInput.elt.addEventListener('change', handleFileSelect);
  colorPicker.input(()=> currentLineColor = colorPicker.value);

  resetView.mousePressed(()=> {
    zoom = 1.0;
    viewAngle = 0;
    centerImage();
  });

  resetLines = select('#resetLines');
  resetImage = select('#resetImage');
  resetLines.mousePressed(()=> {
    lines = []; redoStack = [];
    calibrationLine = null; pixelsPerUnit = 0;
    selectedLine = null; inputFocused = false;
  });
  resetImage.mousePressed(()=> {
    img = null;
    lines = []; redoStack = [];
    calibrationLine = null; pixelsPerUnit = 0;
    selectedLine = null; inputFocused = false;
    zoom = 1.0; viewAngle = 0; imgX = 0; imgY = 0;
  });

  rotateLeftBtn = select('#rotateLeft');
  rotateRightBtn = select('#rotateRight');
  rotateLeftBtn.mousePressed(()=> { viewAngle -= PI/4; });
  rotateRightBtn.mousePressed(()=> { viewAngle += PI/4; });

  undoBtn = select('#undoBtn');
  redoBtn = select('#redoBtn');
  undoBtn.mousePressed(doUndo);
  redoBtn.mousePressed(doRedo);

  saveBtn = select('#saveBtn');
  saveBtn.mousePressed(saveOutput);

  textFont('Arial');
}

function handleFileSelect(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  loadImage(url, (loaded) => {
    img = loaded;
    zoom = 1.0;
    centerImage();
    dragging = false;
    selectedLine = null;
    inputFocused = false;
  });
}

function centerImage() {
  if (!img) return;
  imgX = (width - img.width * zoom) / 2;
  imgY = (height - img.height * zoom) / 2;
}

function windowResized() {
  const holder = document.getElementById('canvas-holder');
  resizeCanvas(holder.clientWidth, holder.clientHeight);
  centerImage();
}

function toImgCoords(sx, sy) {
  let cx = width/2, cy = height/2;
  let c = cos(viewAngle), s = sin(viewAngle);
  let dx = sx - cx, dy = sy - cy;
  let u = dx * c + dy * s;
  let v = -dx * s + dy * c;
  return { x: (u + cx - imgX) / zoom, y: (v + cy - imgY) / zoom };
}

function toScreenCoords(ix, iy) {
  let cx = width/2, cy = height/2;
  let c = cos(viewAngle), s = sin(viewAngle);
  let u = ix * zoom + imgX - cx;
  let v = iy * zoom + imgY - cy;
  return { x: u * c - v * s + cx, y: u * s + v * c + cy };
}

function draw() {
  background(40);

  push();
  translate(width/2, height/2);
  rotate(viewAngle);
  translate(-width/2 + imgX, -height/2 + imgY);
  scale(zoom);
  if (img) image(img, 0, 0);
  strokeWeight(1.5 / zoom);
  noFill();
  let flashOn = floor(millis() / 300) % 2 === 0;
  for (let ln of lines) {
    let drawCol = ln.col;
    if (ln === selectedLine && !flashOn) drawCol = invertColor(drawCol);
    stroke(drawCol);
    line(ln.x1, ln.y1, ln.x2, ln.y2);
  }
  if (dragging) {
    let ic1 = toImgCoords(dragStartX, dragStartY);
    let ic2raw = toImgCoords(mouseX, mouseY);
    let ic2 = snapEndpoint(ic1.x, ic1.y, ic2raw.x, ic2raw.y);
    stroke(currentLineColor);
    line(ic1.x, ic1.y, ic2.x, ic2.y);
  }
  pop();

  if (selectedLine) {
    let sp1 = toScreenCoords(selectedLine.x1, selectedLine.y1);
    let sp2 = toScreenCoords(selectedLine.x2, selectedLine.y2);
    // Black outline ring
    strokeWeight(3);
    stroke(0);
    noFill();
    ellipse(sp1.x, sp1.y, EP_RADIUS*2, EP_RADIUS*2);
    ellipse(sp2.x, sp2.y, EP_RADIUS*2, EP_RADIUS*2);
    // White inner ring
    strokeWeight(1.5);
    stroke(255);
    ellipse(sp1.x, sp1.y, EP_RADIUS*2, EP_RADIUS*2);
    ellipse(sp2.x, sp2.y, EP_RADIUS*2, EP_RADIUS*2);
  }

  // CTRL held: show snap target circles on all line endpoints
  if (keyIsDown(CONTROL)) {
    for (let ln of lines) {
      for (let pt of [{x: ln.x1, y: ln.y1}, {x: ln.x2, y: ln.y2}]) {
        let sp = toScreenCoords(pt.x, pt.y);
        let hovering = dist(mouseX, mouseY, sp.x, sp.y) <= EP_RADIUS;
        strokeWeight(3);
        stroke(0);
        noFill();
        ellipse(sp.x, sp.y, EP_RADIUS*2, EP_RADIUS*2);
        strokeWeight(1.5);
        stroke(hovering ? color(0, 220, 255) : 255);
        if (hovering) fill(0, 220, 255, 60);
        else noFill();
        ellipse(sp.x, sp.y, EP_RADIUS*2, EP_RADIUS*2);
        noFill();
      }
    }
  }

  for (let ln of lines) {
    let sp1 = toScreenCoords(ln.x1, ln.y1);
    let sp2 = toScreenCoords(ln.x2, ln.y2);
    drawLengthLabel(sp1.x, sp1.y, sp2.x, sp2.y, ln.imgLen, ln.col, ln === selectedLine, ln.customValue, ln === calibrationLine);
  }

  if (dragging) {
    let ic1 = toImgCoords(dragStartX, dragStartY);
    let ic2raw = toImgCoords(mouseX, mouseY);
    let ic2 = snapEndpoint(ic1.x, ic1.y, ic2raw.x, ic2raw.y);
    let sp2 = toScreenCoords(ic2.x, ic2.y);
    let previewLen = dist(ic1.x, ic1.y, ic2.x, ic2.y);
    let sp1s = toScreenCoords(ic1.x, ic1.y);
    drawLengthLabel(sp1s.x, sp1s.y, sp2.x, sp2.y, previewLen, currentLineColor, false, "", false);
  }

  zoomDisplay.html(nf(zoom,1,2) + 'x');
}

function drawLengthLabel(x1, y1, x2, y2, len, lineCol, selected, customValue, isCalib) {
  let pxLabel = nf(len, 1, 1) + ' px';
  let cx = (x1 + x2) / 2;
  let cy = (y1 + y2) / 2;

  textSize(12);
  textAlign(CENTER, CENTER);
  let tw = textWidth(pxLabel);
  let th = 14;
  let pad = 4;
  let boxH = th + pad*2;

  let hasValue = customValue && customValue.length > 0;
  let showUnits = !isCalib && pixelsPerUnit > 0;
  let hasSecondBox = selected || hasValue || showUnits;

  let labelOffsetY = hasSecondBox ? -(boxH + 4)/2 : 0;

  noStroke();
  fill(0, 180);
  rect(cx - tw/2 - pad, cy + labelOffsetY - boxH/2, tw + pad*2, boxH, 3);
  fill(lineCol);
  text(pxLabel, cx, cy + labelOffsetY);

  let inW = max(80, tw + pad*2);
  let inH = boxH;
  let inX = cx - inW/2;
  let inY = cy + boxH/2 + 4;

  if (selected) {
    let ckS = boxH;
    _inX = inX; _inY = inY; _inW = inW; _inH = inH;
    _ckX = inX + inW + 4; _ckY = inY; _ckS = ckS;

    noStroke();
    fill(inputFocused ? color(60) : color(45));
    rect(inX, inY, inW, inH, 3);
    stroke(inputFocused ? color(180) : color(100));
    strokeWeight(1);
    noFill();
    rect(inX, inY, inW, inH, 3);
    noStroke();
    fill(220);
    textAlign(LEFT, CENTER);
    let display = inputText + (inputFocused && floor(millis()/500)%2==0 ? '|' : '');
    text(display, inX + pad, inY + inH/2);

    noStroke();
    fill(color(40,160,60));
    rect(_ckX, _ckY, ckS, ckS, 3);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(14);
    text('\u2713', _ckX + ckS/2, _ckY + ckS/2);
    textSize(12);

  } else if (isCalib && hasValue) {
    noStroke();
    fill(0,180);
    rect(inX, inY, inW, inH, 3);
    stroke(color(255,180,0));
    strokeWeight(2);
    noFill();
    rect(inX-1, inY-1, inW+2, inH+2, 3);
    noStroke();
    fill(lineCol);
    textAlign(CENTER, CENTER);
    text(customValue + ' units', inX + inW/2, inY + inH/2);

  } else if (showUnits) {
    let unitLen = len / pixelsPerUnit;
    let unitLabel = nf(unitLen, 1, 2) + ' units';
    let uw = max(inW, textWidth(unitLabel) + pad*2);
    let ux = cx - uw/2;
    noStroke();
    fill(0,180);
    rect(ux, inY, uw, inH, 3);
    fill(lineCol);
    textAlign(CENTER, CENTER);
    text(unitLabel, ux + uw/2, inY + inH/2);
  }
}

function invertColor(hex) {
  let c = color(hex);
  return color(255 - red(c), 255 - green(c), 255 - blue(c));
}

function pointToSegDist(px, py, ax, ay, bx, by) {
  let dx = bx - ax, dy = by - ay;
  let lenSq = dx*dx + dy*dy;
  if (lenSq === 0) return dist(px, py, ax, ay);
  let t = constrain(((px-ax)*dx + (py-ay)*dy) / lenSq, 0, 1);
  return dist(px, py, ax + t*dx, ay + t*dy);
}

function mousePressed() {
  if (mouseButton === CENTER) {
    mmbPanning = true;
    mmbLastX = mouseX;
    mmbLastY = mouseY;
    return;
  }
  if (selectedLine) {
    if (mouseX >= _ckX && mouseX <= _ckX + _ckS &&
        mouseY >= _ckY && mouseY <= _ckY + _ckS) {
      confirmInput();
      return;
    }
    if (mouseX >= _inX && mouseX <= _inX + _inW &&
        mouseY >= _inY && mouseY <= _inY + _inH) {
      inputFocused = true;
      return;
    }
    let sp1 = toScreenCoords(selectedLine.x1, selectedLine.y1);
    let sp2 = toScreenCoords(selectedLine.x2, selectedLine.y2);
    if (dist(mouseX, mouseY, sp1.x, sp1.y) <= EP_RADIUS) {
      epDragLine = selectedLine; epDragIndex = 1; return;
    }
    if (dist(mouseX, mouseY, sp2.x, sp2.y) <= EP_RADIUS) {
      epDragLine = selectedLine; epDragIndex = 2; return;
    }
  }

  let nearEndpoint = false;
  for (let ln of lines) {
    let sp1 = toScreenCoords(ln.x1, ln.y1);
    let sp2 = toScreenCoords(ln.x2, ln.y2);
    if (dist(mouseX, mouseY, sp1.x, sp1.y) <= EP_RADIUS ||
        dist(mouseX, mouseY, sp2.x, sp2.y) <= EP_RADIUS) {
      nearEndpoint = true; break;
    }
  }

  if (!nearEndpoint) {
    let hit = null;
    let hitThresh = 8;
    for (let ln of lines) {
      let sp1 = toScreenCoords(ln.x1, ln.y1);
      let sp2 = toScreenCoords(ln.x2, ln.y2);
      if (pointToSegDist(mouseX, mouseY, sp1.x, sp1.y, sp2.x, sp2.y) < hitThresh) {
        hit = ln; break;
      }
    }
    if (hit) {
      if (hit === selectedLine) {
        selectedLine = null; inputFocused = false;
      } else {
        selectedLine = hit;
        inputText = hit.customValue || '';
        inputFocused = true;
        justSelected = true;
      }
      dragging = false;
      return;
    }
  }

  selectedLine = null;
  inputFocused = false;
  dragging = true;
  dragStartX = mouseX;
  dragStartY = mouseY;
  // CTRL held: snap start to a nearby endpoint
  if (keyIsDown(CONTROL)) {
    for (let ln of lines) {
      let sp1 = toScreenCoords(ln.x1, ln.y1);
      let sp2 = toScreenCoords(ln.x2, ln.y2);
      if (dist(mouseX, mouseY, sp1.x, sp1.y) <= EP_RADIUS) {
        dragStartX = sp1.x; dragStartY = sp1.y; break;
      }
      if (dist(mouseX, mouseY, sp2.x, sp2.y) <= EP_RADIUS) {
        dragStartX = sp2.x; dragStartY = sp2.y; break;
      }
    }
  }
}

function mouseDragged() {
  if (mmbPanning) {
    imgX += mouseX - mmbLastX;
    imgY += mouseY - mmbLastY;
    mmbLastX = mouseX;
    mmbLastY = mouseY;
    return;
  }
  if (epDragLine) {
    let ic = toImgCoords(mouseX, mouseY);
    let ix = ic.x, iy = ic.y;
    if (keyIsDown(CONTROL)) {
      for (let ln of lines) {
        for (let pt of [{x: ln.x1, y: ln.y1}, {x: ln.x2, y: ln.y2}]) {
          let sp = toScreenCoords(pt.x, pt.y);
          if (dist(mouseX, mouseY, sp.x, sp.y) <= EP_RADIUS) {
            ix = pt.x; iy = pt.y; break;
          }
        }
      }
    }
    if (epDragIndex === 1) { epDragLine.x1 = ix; epDragLine.y1 = iy; }
    else { epDragLine.x2 = ix; epDragLine.y2 = iy; }
    epDragLine.imgLen = dist(epDragLine.x1, epDragLine.y1, epDragLine.x2, epDragLine.y2);
    if (epDragLine === calibrationLine && epDragLine.customValue.length > 0) {
      let unitVal = parseFloat(epDragLine.customValue);
      if (unitVal > 0) pixelsPerUnit = epDragLine.imgLen / unitVal;
    }
  }
}

function mouseReleased() {
  if (mmbPanning) { mmbPanning = false; return; }
  if (epDragLine) { epDragLine = null; return; }
  if (dragging) {
    let ic1 = toImgCoords(dragStartX, dragStartY);
    let ic2raw = toImgCoords(mouseX, mouseY);
    let ic2 = snapEndpoint(ic1.x, ic1.y, ic2raw.x, ic2raw.y);
    let ix1 = ic1.x, iy1 = ic1.y;
    let ix2 = ic2.x, iy2 = ic2.y;
    if (keyIsDown(CONTROL)) {
      for (let ln of lines) {
        let sp1 = toScreenCoords(ln.x1, ln.y1);
        let sp2 = toScreenCoords(ln.x2, ln.y2);
        if (dist(mouseX, mouseY, sp1.x, sp1.y) <= EP_RADIUS) {
          ix2 = ln.x1; iy2 = ln.y1; break;
        }
        if (dist(mouseX, mouseY, sp2.x, sp2.y) <= EP_RADIUS) {
          ix2 = ln.x2; iy2 = ln.y2; break;
        }
      }
    }
    let dx = ix2 - ix1, dy = iy2 - iy1;
    if (dx*dx + dy*dy > 9) {
      lines.push(new DrawnLine(ix1, iy1, ix2, iy2, currentLineColor));
      redoStack = [];
    }
    dragging = false;
  }
}

function mouseWheel(event) {
  let delta = event.deltaY > 0 ? 1 : -1;
  let mx = mouseX, my = mouseY;
  let prevZoom = zoom;
  zoom = max(0.05, zoom - delta * ZOOM_STEP);
  let scale = zoom / prevZoom;
  imgX = mx + (imgX - mx) * scale;
  imgY = my + (imgY - my) * scale;
  return false;
}

function keyPressed() {
  if (inputFocused) {
    if (keyCode === ENTER) { confirmInput(); return; }
    else if (keyCode === BACKSPACE) {
      if (inputText.length > 0) inputText = inputText.substring(0, inputText.length - 1);
      return;
    } else if (key === ESCAPE) { inputFocused = false; return; }
  }

  if (keyCode === DELETE && selectedLine) {
    if (selectedLine === calibrationLine) {
      calibrationLine = null; pixelsPerUnit = 0;
    }
    lines = lines.filter(l => l !== selectedLine);
    selectedLine = null; inputFocused = false;
    return;
  }

  if (keyCode === 90 && (keyIsDown(CONTROL) || keyIsDown(91))) {
    doUndo();
    return false;
  }

  if (keyCode === 89 && (keyIsDown(CONTROL) || keyIsDown(91))) {
    doRedo();
    return false;
  }

  if (key === '-' || key === '_') {
    zoomAboutCenter(max(0.05, zoom - ZOOM_STEP));
  } else if (key === '=' || key === '+') {
    zoomAboutCenter(zoom + ZOOM_STEP);
  } else if (keyCode === LEFT_ARROW) { imgX -= PAN_STEP; return false; }
  else if (keyCode === RIGHT_ARROW) { imgX += PAN_STEP; return false; }
  else if (keyCode === UP_ARROW) { imgY -= PAN_STEP; return false; }
  else if (keyCode === DOWN_ARROW) { imgY += PAN_STEP; return false; }
}

// Returns (possibly snapped) endpoint {x, y} in image coords.
// If shift held and angle is within SNAP_THRESH of a 45° multiple, snaps to it.
const SNAP_THRESH = 10 * Math.PI / 180; // 10 degrees in radians
function snapEndpoint(ix1, iy1, ix2, iy2) {
  if (!keyIsDown(SHIFT)) return { x: ix2, y: iy2 };
  let dx = ix2 - ix1, dy = iy2 - iy1;
  let len = sqrt(dx*dx + dy*dy);
  if (len === 0) return { x: ix2, y: iy2 };
  let angle = atan2(dy, dx);
  let snapUnit = PI / 4;
  let nearest = round(angle / snapUnit) * snapUnit;
  if (abs(angle - nearest) <= SNAP_THRESH) {
    return { x: ix1 + cos(nearest) * len, y: iy1 + sin(nearest) * len };
  }
  return { x: ix2, y: iy2 };
}

function drawLabelsOnGraphics(g) {
  g.textFont('Arial');
  g.textSize(12);
  let pad = 4;
  let th = 14;
  let boxH = th + pad * 2;
  for (let ln of lines) {
    let cx = (ln.x1 + ln.x2) / 2;
    let cy = (ln.y1 + ln.y2) / 2;
    let pxLabel = nf(ln.imgLen, 1, 1) + ' px';
    let hasUnits = pixelsPerUnit > 0 && ln !== calibrationLine;
    let unitLabel = hasUnits ? nf(ln.imgLen / pixelsPerUnit, 1, 2) + ' units' : null;
    let isCalib = ln === calibrationLine && ln.customValue.length > 0;
    let calibLabel = isCalib ? (ln.customValue + ' units') : null;
    let hasSecond = hasUnits || isCalib;
    let offsetY = hasSecond ? -(boxH + 4) / 2 : 0;

    // px label
    g.textAlign(CENTER, CENTER);
    let tw = g.textWidth(pxLabel);
    g.noStroke();
    g.fill(0, 180);
    g.rect(cx - tw / 2 - pad, cy + offsetY - boxH / 2, tw + pad * 2, boxH, 3);
    g.fill(ln.col);
    g.text(pxLabel, cx, cy + offsetY);

    // second label
    if (unitLabel) {
      let uw = max(tw + pad * 2, g.textWidth(unitLabel) + pad * 2);
      g.noStroke();
      g.fill(0, 180);
      g.rect(cx - uw / 2, cy + boxH / 2 + 4, uw, boxH, 3);
      g.fill(ln.col);
      g.text(unitLabel, cx, cy + boxH / 2 + 4 + boxH / 2);
    } else if (calibLabel) {
      let cw = max(tw + pad * 2, g.textWidth(calibLabel) + pad * 2);
      g.noStroke();
      g.fill(0, 180);
      g.rect(cx - cw / 2, cy + boxH / 2 + 4, cw, boxH, 3);
      g.stroke(color(255, 180, 0));
      g.strokeWeight(2);
      g.noFill();
      g.rect(cx - cw / 2 - 1, cy + boxH / 2 + 3, cw + 2, boxH + 2, 3);
      g.noStroke();
      g.fill(ln.col);
      g.text(calibLabel, cx, cy + boxH / 2 + 4 + boxH / 2);
    }
  }
}

function saveOutput() {
  let W = img ? img.width  : width;
  let H = img ? img.height : height;

  // 1. Image + lines + labels
  let g1 = createGraphics(W, H);
  if (img) g1.image(img, 0, 0);
  else g1.background(40);
  g1.strokeWeight(1.5);
  g1.noFill();
  for (let ln of lines) {
    g1.stroke(ln.col);
    g1.line(ln.x1, ln.y1, ln.x2, ln.y2);
  }
  drawLabelsOnGraphics(g1);
  g1.canvas.toBlob(blob => {
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'image_with_lines.png';
    a.click();
  });
  g1.remove();

  // 2. Lines only + labels
  let g2 = createGraphics(W, H);
  g2.background(40);
  g2.strokeWeight(1.5);
  g2.noFill();
  for (let ln of lines) {
    g2.stroke(ln.col);
    g2.line(ln.x1, ln.y1, ln.x2, ln.y2);
  }
  drawLabelsOnGraphics(g2);
  g2.canvas.toBlob(blob => {
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lines_only.png';
    a.click();
  });
  g2.remove();

  // 3. CSV
  let hasUnits = pixelsPerUnit > 0;
  let header = 'index,x1,y1,x2,y2,length_px' + (hasUnits ? ',length_units' : '');
  let rows = [header];
  for (let i = 0; i < lines.length; i++) {
    let ln = lines[i];
    let row = `${i+1},${ln.x1.toFixed(2)},${ln.y1.toFixed(2)},${ln.x2.toFixed(2)},${ln.y2.toFixed(2)},${ln.imgLen.toFixed(2)}`;
    if (hasUnits) row += `,${(ln.imgLen / pixelsPerUnit).toFixed(4)}`;
    rows.push(row);
  }
  let blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'lines.csv';
  a.click();
}

function doUndo() {
  if (lines.length > 0) {
    let removed = lines.pop();
    redoStack.push(removed);
    if (removed === calibrationLine) { calibrationLine = null; pixelsPerUnit = 0; }
    if (removed === selectedLine) { selectedLine = null; inputFocused = false; }
  }
}

function doRedo() {
  if (redoStack.length > 0) {
    lines.push(redoStack.pop());
  }
}

function zoomAboutCenter(newZoom) {
  let cx = width/2;
  let cy = height/2;
  let scale = newZoom / zoom;
  imgX = cx + (imgX - cx) * scale;
  imgY = cy + (imgY - cy) * scale;
  zoom = newZoom;
}

function confirmInput() {
  if (selectedLine && inputText.length > 0) {
    let unitVal = parseFloat(inputText);
    if (unitVal > 0) {
      if (calibrationLine && calibrationLine !== selectedLine)
        calibrationLine.customValue = "";
      selectedLine.customValue = inputText;
      calibrationLine = selectedLine;
      pixelsPerUnit = selectedLine.imgLen / unitVal;
    }
  }
  inputFocused = false;
  selectedLine = null;
}

class DrawnLine {
  constructor(x1, y1, x2, y2, col) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.imgLen = dist(x1, y1, x2, y2);
    this.col = col;
    this.customValue = "";
  }
}

function mouseClicked() {
  if (justSelected) { justSelected = false; return; }
  if (inputFocused) {
    if (!(mouseX >= _inX && mouseX <= _inX + _inW &&
          mouseY >= _inY && mouseY <= _inY + _inH)) {
      inputFocused = false;
    }
  }
}

function keyTyped() {
  if (inputFocused) {
    if ((key >= '0' && key <= '9') || key === '.') {
      inputText += key;
      return false;
    }
    return false;
  }
}

window.addEventListener('resize', () => {
  windowResized();
});
