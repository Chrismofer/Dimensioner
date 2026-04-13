let img = null;
let imgX = 0, imgY = 0;
let zoom = 1.0;
let viewAngle = 0;
const ZOOM_STEP = 0.1;
const PAN_STEP = 20;

let lines = [];
let currentLineColor = '#ff0000';
let currentLineWeight = 1.5;
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

let measureAngleMode = false;
let angleLines = [];
let angleLabels = [];
let _angleCkX = 0, _angleCkY = 0, _angleCkS = 0;
let selectedAngleLabel = null;
let angleLabelDragging = false;

let fileInput, openBtn, colorPicker, zoomDisplay, posDisplay, resetView, resetLines, resetImage, undoBtn, redoBtn, rotateLeftBtn, rotateRightBtn, saveBtn, measureAngleBtn;
let redoStack = []; // history of actions (tagged {type,item})
let undoStack = []; // undone actions available to redo

function setup() {
  const holder = document.getElementById('canvas-holder');
  createCanvas(holder.clientWidth, holder.clientHeight).parent('canvas-holder');

  fileInput = select('#fileInput');
  openBtn = select('#openBtn');
  colorPicker = select('#colorPicker');
  zoomDisplay = select('#zoomDisplay');
  posDisplay = select('#posDisplay');
  resetView = select('#resetView');

  openBtn.mousePressed(()=> fileInput.elt.click());
  fileInput.elt.addEventListener('change', handleFileSelect);
  colorPicker.elt.addEventListener('input', function() {
    currentLineColor = String(this.value);
    if (selectedLine) selectedLine.col = currentLineColor;
  });

  document.getElementById('thicknessPicker').addEventListener('input', function() {
    let v = parseFloat(this.value);
    if (v > 0) {
      currentLineWeight = v;
      if (selectedLine) selectedLine.weight = currentLineWeight;
    }
  });

  resetView.mousePressed(()=> {
    zoom = 1.0;
    viewAngle = 0;
    centerImage();
  });

  resetLines = select('#resetLines');
  resetImage = select('#resetImage');
  resetLines.mousePressed(()=> {
    lines = []; redoStack = []; undoStack = [];
    calibrationLine = null; pixelsPerUnit = 0;
    selectedLine = null; inputFocused = false;
    angleLabels = []; selectedAngleLabel = null; angleLabelDragging = false;
  });
  resetImage.mousePressed(()=> {
    img = null;
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

  measureAngleBtn = select('#measureAngleBtn');
  measureAngleBtn.mousePressed(() => {
    const status = document.getElementById('measureStatus');
    if (measureAngleMode || angleLines.length > 0) {
      // Toggle off / cancel
      measureAngleMode = false;
      angleLines = [];
      status.style.display = 'none';
      return;
    }
    status.style.display = 'block';
    if (lines.length < 2) {
      status.textContent = 'Not enough lines';
    } else {
      measureAngleMode = true;
      angleLines = [];
      if (selectedLine) {
        angleLines.push(selectedLine);
        selectedLine = null;
        inputFocused = false;
        status.textContent = 'Select second line';
      } else {
        selectedLine = null;
        inputFocused = false;
        status.textContent = 'Select first line';
      }
    }
  });

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
  if (!img) {
    imgX = 0;
    imgY = 0;
    return;
  }
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
  noFill();
  let flashOn = floor(millis() / 300) % 2 === 0;
  for (let ln of lines) {
    let drawCol = ln.col;
    if (ln === selectedLine && !flashOn) drawCol = invertColor(drawCol);
    if (angleLines.includes(ln) && !flashOn) drawCol = invertColor(drawCol);
    strokeWeight((ln.weight || 1.5) / zoom);
    stroke(drawCol);
    line(ln.x1, ln.y1, ln.x2, ln.y2);
  }
  if (dragging) {
    let ic1 = toImgCoords(dragStartX, dragStartY);
    let ic2raw = toImgCoords(mouseX, mouseY);
    let ic2 = snapEndpoint(ic1.x, ic1.y, ic2raw.x, ic2raw.y);
    strokeWeight(currentLineWeight / zoom);
    stroke(currentLineColor);
    line(ic1.x, ic1.y, ic2.x, ic2.y);
  }
  pop();

  if (selectedLine && !measureAngleMode) {
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
  if (keyIsDown(CONTROL) && !measureAngleMode) {
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
  posDisplay.html('X:&nbsp;' + floor(imgX) + '<br>Y:&nbsp;' + floor(imgY));

  // Draw confirmed angle labels
  for (let al of angleLabels) {
    let inter = lineIntersection(al.line1, al.line2);
    if (!inter) continue;
    let sp = toScreenCoords(inter.x, inter.y);
    let slabel = toScreenCoords(al.lx, al.ly);
    let r = dist(sp.x, sp.y, slabel.x, slabel.y);
    let arcA = getSectorArcAngles(sp, al.line1, al.line2, slabel.x, slabel.y);
    let angleDeg = degrees(arcA.stop - arcA.start);
    let isSelected = al === selectedAngleLabel;
    let c = color(al.col || '#ffffff');
    let arcCol = (isSelected && !flashOn) ? color(255 - red(c), 255 - green(c), 255 - blue(c), 160) : color(red(c), green(c), blue(c), 160);
    noFill();
    strokeWeight(isSelected ? al.weight * 1.5 : al.weight);
    stroke(arcCol);
    arc(sp.x, sp.y, r * 2, r * 2, arcA.start, arcA.stop, OPEN);
    drawAngleLabel(slabel.x, slabel.y, angleDeg, false);
  }

  // Draw live angle preview when two lines are selected
  if (angleLines.length === 2) {
    let inter = lineIntersection(angleLines[0], angleLines[1]);
    if (inter) {
      let sp = toScreenCoords(inter.x, inter.y);
      let r = dist(mouseX, mouseY, sp.x, sp.y);
      let arcA = getSectorArcAngles(sp, angleLines[0], angleLines[1], mouseX, mouseY);
      let angleDeg = degrees(arcA.stop - arcA.start);
      noFill();
      strokeWeight(currentLineWeight);
      let lc = color(currentLineColor);
      stroke(red(lc), green(lc), blue(lc), 160);
      arc(sp.x, sp.y, r * 2, r * 2, arcA.start, arcA.stop, OPEN);
      drawAngleLabel(mouseX, mouseY, angleDeg, false);
    }
  }
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
  fill(255);
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
    fill(255);
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
    fill(255);
    textAlign(CENTER, CENTER);
    text(unitLabel, ux + uw/2, inY + inH/2);
  }
}

function lineIntersection(ln1, ln2) {
  let dx1 = ln1.x2 - ln1.x1, dy1 = ln1.y2 - ln1.y1;
  let dx2 = ln2.x2 - ln2.x1, dy2 = ln2.y2 - ln2.y1;
  let denom = dx1 * dy2 - dy1 * dx2;
  if (abs(denom) < 1e-10) return null; // parallel
  let t = ((ln2.x1 - ln1.x1) * dy2 - (ln2.y1 - ln1.y1) * dx2) / denom;
  return { x: ln1.x1 + t * dx1, y: ln1.y1 + t * dy1 };
}

function angleBetweenLines(ln1, ln2) {
  let dx1 = ln1.x2 - ln1.x1, dy1 = ln1.y2 - ln1.y1;
  let dx2 = ln2.x2 - ln2.x1, dy2 = ln2.y2 - ln2.y1;
  let dot = dx1 * dx2 + dy1 * dy2;
  let mag1 = sqrt(dx1*dx1 + dy1*dy1);
  let mag2 = sqrt(dx2*dx2 + dy2*dy2);
  if (mag1 === 0 || mag2 === 0) return 0;
  let cosA = constrain(abs(dot) / (mag1 * mag2), 0, 1);
  return degrees(acos(cosA));
}

function drawAngleLabel(sx, sy, angleDeg, inverted) {
  let label = nf(angleDeg, 1, 1) + '\u00b0';
  textSize(12);
  textAlign(CENTER, CENTER);
  let tw = textWidth(label);
  let pad = 4;
  let th = 14;
  let boxH = th + pad * 2;
  let boxW = tw + pad * 2;

  noStroke();
  fill(inverted ? color(255, 255, 255, 180) : color(0, 0, 0, 180));
  rect(sx - boxW / 2, sy - boxH / 2, boxW, boxH, 3);
  fill(inverted ? 0 : 255);
  text(label, sx, sy);
}

function confirmAngle(mx, my) {
  if (angleLines.length < 2) return;
  let inter = lineIntersection(angleLines[0], angleLines[1]);
  if (!inter) return;
  let sp = toScreenCoords(inter.x, inter.y);
  let arcA = getSectorArcAngles(sp, angleLines[0], angleLines[1], mx, my);
  let angleDeg = degrees(arcA.stop - arcA.start);
  let lpos = toImgCoords(mx, my);
  let r = dist(inter.x, inter.y, lpos.x, lpos.y);
  angleLabels.push({ ix: inter.x, iy: inter.y, angleDeg: angleDeg, lx: lpos.x, ly: lpos.y, r: r, line1: angleLines[0], line2: angleLines[1], col: angleLines[0].col, weight: currentLineWeight });
  redoStack.push({ type: 'arc', item: angleLabels[angleLabels.length - 1] });
  undoStack = [];
  angleLines = [];
  measureAngleMode = false;
  document.getElementById('measureStatus').style.display = 'none';
}

function getSectorArcAngles(inter_sp, ln1, ln2, mx, my) {
  let sp1a = toScreenCoords(ln1.x1, ln1.y1);
  let sp1b = toScreenCoords(ln1.x2, ln1.y2);
  let sp2a = toScreenCoords(ln2.x1, ln2.y1);
  let sp2b = toScreenCoords(ln2.x2, ln2.y2);
  let ang1 = atan2(sp1b.y - sp1a.y, sp1b.x - sp1a.x);
  let ang2 = atan2(sp2b.y - sp2a.y, sp2b.x - sp2a.x);
  function norm(a) { return ((a % TWO_PI) + TWO_PI) % TWO_PI; }
  let rays = [norm(ang1), norm(ang1 + PI), norm(ang2), norm(ang2 + PI)];
  rays.sort((a, b) => a - b);
  let mouseA = norm(atan2(my - inter_sp.y, mx - inter_sp.x));
  let idx = 3;
  for (let i = 0; i < 3; i++) {
    if (mouseA >= rays[i] && mouseA < rays[i + 1]) { idx = i; break; }
  }
  let start = rays[idx];
  let stop = idx === 3 ? rays[0] + TWO_PI : rays[idx + 1];
  return { start, stop };
}

function getSectorArcAnglesImg(inter_img, ln1, ln2, mx, my) {
  let ang1 = atan2(ln1.y2 - ln1.y1, ln1.x2 - ln1.x1);
  let ang2 = atan2(ln2.y2 - ln2.y1, ln2.x2 - ln2.x1);
  function norm(a) { return ((a % TWO_PI) + TWO_PI) % TWO_PI; }
  let rays = [norm(ang1), norm(ang1 + PI), norm(ang2), norm(ang2 + PI)];
  rays.sort((a, b) => a - b);
  let mouseA = norm(atan2(my - inter_img.y, mx - inter_img.x));
  let idx = 3;
  for (let i = 0; i < 3; i++) {
    if (mouseA >= rays[i] && mouseA < rays[i + 1]) { idx = i; break; }
  }
  let start = rays[idx];
  let stop = idx === 3 ? rays[0] + TWO_PI : rays[idx + 1];
  return { start, stop };
}

function drawAngleLabelsOnGraphics(g) {
  g.textFont('Arial');
  g.textSize(12);
  g.textAlign(CENTER, CENTER);
  let pad = 4, th = 14, boxH = th + pad * 2;
  for (let al of angleLabels) {
    let inter = lineIntersection(al.line1, al.line2);
    if (!inter) continue;
    let r = dist(inter.x, inter.y, al.lx, al.ly);
    let arcA = getSectorArcAnglesImg(inter, al.line1, al.line2, al.lx, al.ly);
    let angleDeg = degrees(arcA.stop - arcA.start);
    let c = color(al.col || '#ffffff');
    g.noFill();
    g.stroke(red(c), green(c), blue(c), 160);
    g.strokeWeight(al.weight || 1.5);
    g.arc(inter.x, inter.y, r * 2, r * 2, arcA.start, arcA.stop, OPEN);
    // label box
    let label = nf(angleDeg, 1, 1) + '\u00b0';
    let tw = g.textWidth(label);
    let boxW = tw + pad * 2;
    g.noStroke();
    g.fill(0, 180);
    g.rect(al.lx - boxW / 2, al.ly - boxH / 2, boxW, boxH, 3);
    g.fill(255);
    g.text(label, al.lx, al.ly);
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

function mousePressed(event) {
  if (!event || event.target.tagName !== 'CANVAS') return;
  if (mouseButton === CENTER) {
    mmbPanning = true;
    mmbLastX = mouseX;
    mmbLastY = mouseY;
    return;
  }

  if (measureAngleMode) {
    // Check if checkbox clicked
    if (angleLines.length >= 2 &&
        mouseX >= _angleCkX && mouseX <= _angleCkX + _angleCkS &&
        mouseY >= _angleCkY && mouseY <= _angleCkY + _angleCkS) {
      confirmAngle(mouseX, mouseY);
      return;
    }
    let hitThresh = 8;
    let hitLine = false;
    for (let ln of lines) {
      let sp1 = toScreenCoords(ln.x1, ln.y1);
      let sp2 = toScreenCoords(ln.x2, ln.y2);
      if (pointToSegDist(mouseX, mouseY, sp1.x, sp1.y, sp2.x, sp2.y) < hitThresh) {
        if (angleLines.includes(ln)) {
          angleLines = angleLines.filter(l => l !== ln);
        } else if (angleLines.length < 2) {
          angleLines.push(ln);
        }
        const status = document.getElementById('measureStatus');
        if (angleLines.length === 0) {
          status.textContent = 'Select first line';
        } else if (angleLines.length === 1) {
          status.textContent = 'Select second line';
        } else if (angleLines.length >= 2) {
          status.textContent = 'Lines selected';
        }
        hitLine = true;
        break;
      }
    }
    // No line hit and two lines already selected: place the label
    if (!hitLine && angleLines.length >= 2) {
      confirmAngle(mouseX, mouseY);
    }
    return;
  }

  // Check for angle label / arc hit in normal mode
  if (!measureAngleMode) {
    let arcHitThresh = 6;
    for (let al of angleLabels) {
      let inter = lineIntersection(al.line1, al.line2);
      if (!inter) continue;
      let sp = toScreenCoords(inter.x, inter.y);
      let slabel = toScreenCoords(al.lx, al.ly);
      let r = dist(sp.x, sp.y, slabel.x, slabel.y);
      // Hit label box
      textSize(12);
      let label = nf(0, 1, 1) + '\u00b0';
      let pad = 4, th = 14, boxH = th + pad * 2;
      let boxW = textWidth(nf(90,1,1)+'\u00b0') + pad * 2 + 20; // generous width
      let hitBox = mouseX >= slabel.x - boxW/2 && mouseX <= slabel.x + boxW/2 &&
                   mouseY >= slabel.y - boxH/2 && mouseY <= slabel.y + boxH/2;
      // Hit arc stroke
      let arcA = getSectorArcAngles(sp, al.line1, al.line2, slabel.x, slabel.y);
      let mouseR = dist(mouseX, mouseY, sp.x, sp.y);
      let mouseAng = ((atan2(mouseY - sp.y, mouseX - sp.x) % TWO_PI) + TWO_PI) % TWO_PI;
      let inArcAngle = arcA.stop > TWO_PI
        ? mouseAng >= arcA.start || mouseAng <= arcA.stop - TWO_PI
        : mouseAng >= arcA.start && mouseAng <= arcA.stop;
      let hitArc = abs(mouseR - r) < arcHitThresh && inArcAngle;
      if (hitBox || hitArc) {
        selectedAngleLabel = al;
        angleLabelDragging = true;
        return;
      }
    }
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
  selectedAngleLabel = null;
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
  if (angleLabelDragging && selectedAngleLabel) {
    let ic = toImgCoords(mouseX, mouseY);
    selectedAngleLabel.lx = ic.x;
    selectedAngleLabel.ly = ic.y;
    return;
  }
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
    // Shift held: snap the moving endpoint to the nearest 45° angle from the fixed end
    if (keyIsDown(SHIFT)) {
      let anchor = epDragIndex === 1
        ? { x: epDragLine.x2, y: epDragLine.y2 }
        : { x: epDragLine.x1, y: epDragLine.y1 };
      let snapped = snapEndpoint(anchor.x, anchor.y, ix, iy);
      ix = snapped.x; iy = snapped.y;
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
  angleLabelDragging = false;
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
      let newLine = new DrawnLine(ix1, iy1, ix2, iy2, currentLineColor, currentLineWeight);
      lines.push(newLine);
      redoStack.push({ type: 'line', item: newLine });
      undoStack = [];
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
  if (angleLines.length >= 2 && keyCode === ENTER) {
    confirmAngle(mouseX, mouseY);
    return;
  }

  if (inputFocused) {
    if (keyCode === ENTER) { confirmInput(); return; }
    else if (keyCode === BACKSPACE) {
      if (inputText.length > 0) inputText = inputText.substring(0, inputText.length - 1);
      return;
    } else if (key === ESCAPE) { inputFocused = false; return; }
  }

  if (key === 'Escape' || keyCode === ESCAPE) {
    if (measureAngleMode || angleLines.length > 0) {
      measureAngleMode = false;
      angleLines = [];
      document.getElementById('measureStatus').style.display = 'none';
      return;
    }
  }

  if (keyCode === DELETE && selectedAngleLabel) {
    let deleted = selectedAngleLabel;
    angleLabels = angleLabels.filter(al => al !== deleted);
    redoStack = redoStack.filter(e => e.item !== deleted);
    undoStack = undoStack.filter(e => e.item !== deleted);
    selectedAngleLabel = null; angleLabelDragging = false;
    return;
  }

  if (keyCode === DELETE && selectedLine) {
    if (selectedLine === calibrationLine) {
      calibrationLine = null; pixelsPerUnit = 0;
    }
    let deleted = selectedLine;
    lines = lines.filter(l => l !== deleted);
    angleLabels = angleLabels.filter(al => al.line1 !== deleted && al.line2 !== deleted);
    redoStack = redoStack.filter(e => e.item !== deleted && e.item.line1 !== deleted && e.item.line2 !== deleted);
    undoStack = undoStack.filter(e => e.item !== deleted && e.item.line1 !== deleted && e.item.line2 !== deleted);
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
    g.fill(255);
    g.text(pxLabel, cx, cy + offsetY);

    // second label
    if (unitLabel) {
      let uw = max(tw + pad * 2, g.textWidth(unitLabel) + pad * 2);
      g.noStroke();
      g.fill(0, 180);
      g.rect(cx - uw / 2, cy + boxH / 2 + 4, uw, boxH, 3);
      g.fill(255);
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
      g.fill(255);
      g.text(calibLabel, cx, cy + boxH / 2 + 4 + boxH / 2);
    }
  }
}

function saveOutput() {
  const modal = document.getElementById('saveModal');
  modal.classList.add('open');

  document.getElementById('saveModalCancel').onclick = () => modal.classList.remove('open');
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };

  document.getElementById('saveModalConfirm').onclick = () => {
    modal.classList.remove('open');
    const doPngComposite = document.getElementById('ckPngComposite').checked;
    const doPngLines    = document.getElementById('ckPngLines').checked;
    const doSvgLabels   = document.getElementById('ckSvgLabels').checked;
    const doSvgOnly     = document.getElementById('ckSvgOnly').checked;
    const doCsv         = document.getElementById('ckCsv').checked;

    let W = img ? img.width  : width;
    let H = img ? img.height : height;

    // 1. PNG: image + lines + labels
    if (doPngComposite) {
      let g1 = createGraphics(W, H);
      if (img) g1.image(img, 0, 0);
      else g1.background(40);
      g1.strokeWeight(1.5);
      g1.noFill();
      for (let ln of lines) { g1.strokeWeight(ln.weight || 1.5); g1.stroke(ln.col); g1.line(ln.x1, ln.y1, ln.x2, ln.y2); }
      drawLabelsOnGraphics(g1);
      drawAngleLabelsOnGraphics(g1);
      g1.canvas.toBlob(blob => {
        let a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'image_with_lines_and_labels.png';
        a.click();
      });
      g1.remove();
    }

    // 2. PNG: lines + labels only
    if (doPngLines) {
      let g2 = createGraphics(W, H);
      g2.background(40);
      g2.strokeWeight(1.5);
      g2.noFill();
      for (let ln of lines) { g2.strokeWeight(ln.weight || 1.5); g2.stroke(ln.col); g2.line(ln.x1, ln.y1, ln.x2, ln.y2); }
      drawLabelsOnGraphics(g2);
      drawAngleLabelsOnGraphics(g2);
      g2.canvas.toBlob(blob => {
        let a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'lines_and_labels.png';
        a.click();
      });
      g2.remove();
    }

    // 3. SVG: lines with labels
    if (doSvgLabels) {
      let svgParts = [];
      svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
      for (let ln of lines) {
        svgParts.push(`  <line x1="${ln.x1.toFixed(2)}" y1="${ln.y1.toFixed(2)}" x2="${ln.x2.toFixed(2)}" y2="${ln.y2.toFixed(2)}" stroke="${ln.col}" stroke-width="${ln.weight || 1.5}" />`);
      }
      let svgPad = 4, svgTh = 14, svgBoxH = svgTh + svgPad * 2;
      for (let ln of lines) {
        let cx2 = (ln.x1 + ln.x2) / 2;
        let cy2 = (ln.y1 + ln.y2) / 2;
        let pxL = nf(ln.imgLen, 1, 1) + ' px';
        let hasU = pixelsPerUnit > 0 && ln !== calibrationLine;
        let unitL = hasU ? nf(ln.imgLen / pixelsPerUnit, 1, 2) + ' units' : null;
        let isC = ln === calibrationLine && ln.customValue.length > 0;
        let calibL = isC ? (ln.customValue + ' units') : null;
        let hasSec = hasU || isC;
        let oY = hasSec ? -(svgBoxH + 4) / 2 : 0;
        let tw2 = pxL.length * 7;
        svgParts.push(`  <rect x="${(cx2 - tw2/2 - svgPad).toFixed(2)}" y="${(cy2 + oY - svgBoxH/2).toFixed(2)}" width="${(tw2 + svgPad*2).toFixed(2)}" height="${svgBoxH}" rx="3" fill="rgba(0,0,0,0.7)" />`);
        svgParts.push(`  <text x="${cx2.toFixed(2)}" y="${(cy2 + oY).toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Arial" font-size="12">${pxL}</text>`);
        if (unitL) {
          let uw2 = max(tw2 + svgPad*2, unitL.length * 7 + svgPad*2);
          svgParts.push(`  <rect x="${(cx2 - uw2/2).toFixed(2)}" y="${(cy2 + svgBoxH/2 + 4).toFixed(2)}" width="${uw2.toFixed(2)}" height="${svgBoxH}" rx="3" fill="rgba(0,0,0,0.7)" />`);
          svgParts.push(`  <text x="${cx2.toFixed(2)}" y="${(cy2 + svgBoxH/2 + 4 + svgBoxH/2).toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Arial" font-size="12">${unitL}</text>`);
        } else if (calibL) {
          let cw2 = max(tw2 + svgPad*2, calibL.length * 7 + svgPad*2);
          svgParts.push(`  <rect x="${(cx2 - cw2/2).toFixed(2)}" y="${(cy2 + svgBoxH/2 + 4).toFixed(2)}" width="${cw2.toFixed(2)}" height="${svgBoxH}" rx="3" fill="rgba(0,0,0,0.7)" />`);
          svgParts.push(`  <rect x="${(cx2 - cw2/2 - 1).toFixed(2)}" y="${(cy2 + svgBoxH/2 + 3).toFixed(2)}" width="${(cw2 + 2).toFixed(2)}" height="${(svgBoxH + 2)}" rx="3" fill="none" stroke="rgb(255,180,0)" stroke-width="2" />`);
          svgParts.push(`  <text x="${cx2.toFixed(2)}" y="${(cy2 + svgBoxH/2 + 4 + svgBoxH/2).toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Arial" font-size="12">${calibL}</text>`);
        }
      }
      svgParts.push('</svg>');
      // --- angle arcs and labels ---
      // re-open by inserting before the closing tag
      svgParts.pop(); // remove </svg>
      let svgPad2 = 4, svgTh2 = 14, svgBoxH2 = svgTh2 + svgPad2 * 2;
      for (let al of angleLabels) {
        let inter = lineIntersection(al.line1, al.line2);
        if (!inter) continue;
        let r2 = dist(inter.x, inter.y, al.lx, al.ly);
        let arcA2 = getSectorArcAnglesImg(inter, al.line1, al.line2, al.lx, al.ly);
        let span = arcA2.stop - arcA2.start;
        let angleDeg2 = degrees(span);
        let sx = inter.x + r2 * Math.cos(arcA2.start);
        let sy = inter.y + r2 * Math.sin(arcA2.start);
        let ex = inter.x + r2 * Math.cos(arcA2.stop);
        let ey = inter.y + r2 * Math.sin(arcA2.stop);
        let largeArc = span > Math.PI ? 1 : 0;
        let c2 = color(al.col || '#ffffff');
        let colStr = `rgb(${floor(red(c2))},${floor(green(c2))},${floor(blue(c2))})`;
        svgParts.push(`  <path d="M ${sx.toFixed(2)},${sy.toFixed(2)} A ${r2.toFixed(2)},${r2.toFixed(2)} 0 ${largeArc},1 ${ex.toFixed(2)},${ey.toFixed(2)}" fill="none" stroke="${colStr}" stroke-opacity="0.63" stroke-width="${al.weight || 1.5}" />`);
        // label box
        let alabel = nf(angleDeg2, 1, 1) + '\u00b0';
        let ltw = alabel.length * 7;
        let lboxW = ltw + svgPad2 * 2;
        svgParts.push(`  <rect x="${(al.lx - lboxW/2).toFixed(2)}" y="${(al.ly - svgBoxH2/2).toFixed(2)}" width="${lboxW.toFixed(2)}" height="${svgBoxH2}" rx="3" fill="rgba(0,0,0,0.7)" />`);
        svgParts.push(`  <text x="${al.lx.toFixed(2)}" y="${al.ly.toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Arial" font-size="12">${alabel}</text>`);
      }
      svgParts.push('</svg>');
      let svgBlob = new Blob([svgParts.join('\n')], { type: 'image/svg+xml' });
      let svgA = document.createElement('a');
      svgA.href = URL.createObjectURL(svgBlob);
      svgA.download = 'lines_with_labels.svg';
      svgA.click();
    }

    // 4. SVG: lines only
    if (doSvgOnly) {
      let svgPlain = [];
      svgPlain.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
      for (let ln of lines) {
        svgPlain.push(`  <line x1="${ln.x1.toFixed(2)}" y1="${ln.y1.toFixed(2)}" x2="${ln.x2.toFixed(2)}" y2="${ln.y2.toFixed(2)}" stroke="${ln.col}" stroke-width="${ln.weight || 1.5}" />`);
      }
      for (let al of angleLabels) {
        let inter = lineIntersection(al.line1, al.line2);
        if (!inter) continue;
        let r2 = dist(inter.x, inter.y, al.lx, al.ly);
        let arcA2 = getSectorArcAnglesImg(inter, al.line1, al.line2, al.lx, al.ly);
        let span = arcA2.stop - arcA2.start;
        let sx = inter.x + r2 * Math.cos(arcA2.start);
        let sy = inter.y + r2 * Math.sin(arcA2.start);
        let ex = inter.x + r2 * Math.cos(arcA2.stop);
        let ey = inter.y + r2 * Math.sin(arcA2.stop);
        let largeArc = span > Math.PI ? 1 : 0;
        let c2 = color(al.col || '#ffffff');
        let colStr = `rgb(${floor(red(c2))},${floor(green(c2))},${floor(blue(c2))})`;
        svgPlain.push(`  <path d="M ${sx.toFixed(2)},${sy.toFixed(2)} A ${r2.toFixed(2)},${r2.toFixed(2)} 0 ${largeArc},1 ${ex.toFixed(2)},${ey.toFixed(2)}" fill="none" stroke="${colStr}" stroke-opacity="0.63" stroke-width="${al.weight || 1.5}" />`);
      }
      svgPlain.push('</svg>');
      let svgPlainBlob = new Blob([svgPlain.join('\n')], { type: 'image/svg+xml' });
      let svgPlainA = document.createElement('a');
      svgPlainA.href = URL.createObjectURL(svgPlainBlob);
      svgPlainA.download = 'lines_only.svg';
      svgPlainA.click();
    }

    // 5. CSV
    if (doCsv) {
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
  };
}

function doUndo() {
  // Walk back through redoStack (which is our history) from the end
  for (let i = redoStack.length - 1; i >= 0; i--) {
    let entry = redoStack[i];
    if (entry.type === 'arc' && angleLabels.includes(entry.item)) {
      angleLabels = angleLabels.filter(al => al !== entry.item);
      if (selectedAngleLabel === entry.item) { selectedAngleLabel = null; angleLabelDragging = false; }
      redoStack.splice(i, 1);
      undoStack.push(entry);
      return;
    }
    if (entry.type === 'line' && lines.includes(entry.item)) {
      let removed = entry.item;
      lines = lines.filter(l => l !== removed);
      if (removed === calibrationLine) { calibrationLine = null; pixelsPerUnit = 0; }
      if (removed === selectedLine) { selectedLine = null; inputFocused = false; }
      angleLabels = angleLabels.filter(al => al.line1 !== removed && al.line2 !== removed);
      redoStack.splice(i, 1);
      undoStack.push(entry);
      return;
    }
  }
}

function doRedo() {
  if (undoStack.length > 0) {
    let entry = undoStack.pop();
    if (entry.type === 'line') {
      lines.push(entry.item);
      redoStack.push(entry);
    } else if (entry.type === 'arc') {
      angleLabels.push(entry.item);
      redoStack.push(entry);
    }
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
  constructor(x1, y1, x2, y2, col, weight) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.imgLen = dist(x1, y1, x2, y2);
    this.col = col;
    this.weight = weight || 1.5;
    this.customValue = "";
  }
}

function mouseClicked(event) {
  if (!event || event.target.tagName !== 'CANVAS') return;
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
