let img = null;
let imgX = 0, imgY = 0;
let zoom = 1.0;
let viewAngle = 0;
const ZOOM_STEP = 0.1;
const PAN_STEP = 20;

let lines = [];
let currentLineColor = '#efb110';
let currentLineWeight = 2;
let dragging = false;
let dragStartX = 0, dragStartY = 0;
let selectedLine = null;
let selectedLines = [];
let mmbPanning = false;
let mmbLastX = 0, mmbLastY = 0;

const EP_RADIUS = 8;
let epDragLine = null;
let epDragIndex = 0;
let epDragStartX = 0, epDragStartY = 0;

let lineDragLine = null;
let lineDragMouseStartX = 0, lineDragMouseStartY = 0;
let lineDragOrigX1 = 0, lineDragOrigY1 = 0, lineDragOrigX2 = 0, lineDragOrigY2 = 0;
let lineDragGroup = []; // [{line, ox1, oy1, ox2, oy2}] for multi-line drag
let lineDragGroupArcs = []; // [{arc, olx, oly}] for arcs in group drag
let snapActivePts = []; // screen-space coords of endpoints currently snapped (shown green)

let arcDragOrigLx = 0, arcDragOrigLy = 0;
let arcDragMouseStartX = 0, arcDragMouseStartY = 0;
let arcDragLines = []; // [{line, ox1, oy1, ox2, oy2}] selected lines dragged with arc

let inputText = '';
let inputFocused = false;
let justSelected = false;

let _inX=0,_inY=0,_inW=0,_inH=0;
let _ckX=0,_ckY=0,_ckS=0;

let calibrationLine = null;
let pixelsPerUnit = 0;

let measureAngleMode = false;
let angleLines = [];
let drawGridMode = false;
let gridLines = [];
let gridDivisionsX = 2; // cross lines (parallel to A/B)
let gridDivisionsY = 2; // along lines (parallel to connectors)
let gridVpMode = false;
let showPxLabels = true;
let showCalibratedLabels = true;
let showAngleLabels = true;
let angleLabels = [];
let reverseLineActive = false;
let selectedAngleLabels = [];
let _angleCkX = 0, _angleCkY = 0, _angleCkS = 0;
let selectedAngleLabel = null;
let angleLabelDragging = false;
let statusFadeTimer = null;

function showStatus(msg, isError) {
  if (statusFadeTimer) { clearTimeout(statusFadeTimer); statusFadeTimer = null; }
  const s = document.getElementById('statusBar');
  s.textContent = msg;
  s.style.display = 'block';
  s.style.opacity = '1';
  s.style.transition = '';
  s.style.color = isError ? '#ff4444' : '#eee';
  s.style.border = isError ? '1px solid #ff4444' : '1px solid #555';
  if (isError) {
    statusFadeTimer = setTimeout(() => {
      s.style.transition = 'opacity 0.6s';
      s.style.opacity = '0';
      statusFadeTimer = setTimeout(() => {
        s.style.display = 'none';
        s.style.opacity = '1';
        s.style.transition = '';
        s.style.color = '#eee';
        s.style.border = '1px solid #555';
      }, 650);
    }, 5000);
  }
}

function hideStatus() {
  if (statusFadeTimer) { clearTimeout(statusFadeTimer); statusFadeTimer = null; }
  const s = document.getElementById('statusBar');
  s.style.display = 'none';
  s.style.opacity = '1';
  s.style.transition = '';
  s.style.color = '#eee';
  s.style.border = '1px solid #555';
}

function getSnapPoints() {
  let pts = [];
  for (let ln of lines) pts.push({x: ln.x1, y: ln.y1}, {x: ln.x2, y: ln.y2});
  for (let al of angleLabels) for (let pt of getArcSnapPoints(al)) pts.push(pt);
  return pts;
}

function updateLineLen(ln) {
  ln.imgLen = dist(ln.x1, ln.y1, ln.x2, ln.y2);
  if (ln === calibrationLine && ln.customValue.length > 0) {
    let v = parseFloat(ln.customValue);
    if (v > 0) pixelsPerUnit = ln.imgLen / v;
  }
}

function downloadBlob(content, filename, type) {
  let a = document.createElement('a');
  a.href = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  a.download = filename;
  a.click();
}

let fileInput, openBtn, colorPicker, zoomDisplay, posDisplay, resetView, resetLines, resetImage, undoBtn, redoBtn, rotateLeftBtn, rotateRightBtn, saveBtn, measureAngleBtn, drawGridBtn;
let redoStack = []; // history of actions (tagged {type,item})
let undoStack = []; // undone actions available to redo

function setup() {
  const holder = document.getElementById('canvas-holder');
  createCanvas(holder.clientWidth, holder.clientHeight).parent('canvas-holder');

  fileInput = select('#fileInput');
  openBtn = select('#openBtn');
  colorPicker = select('#colorPicker');
  zoomDisplay = select('#zoomInput');
  posDisplay = select('#posDisplay');
  resetView = select('#resetView');

  openBtn.mousePressed(()=> fileInput.elt.click());
  fileInput.elt.addEventListener('change', handleFileSelect);
  colorPicker.elt.addEventListener('input', function() {
    currentLineColor = String(this.value);
    if (selectedLines.length > 0) {
      for (let ln of selectedLines) ln.col = currentLineColor;
    } else if (selectedLine) {
      selectedLine.col = currentLineColor;
    }
  });

  document.getElementById('zoomInput').addEventListener('input', function() {
    let v = parseFloat(this.value);
    if (v > 0) { zoomAboutCenter(v); }
    // if empty/invalid, do nothing — wait for Enter or blur
  });
  document.getElementById('zoomInput').addEventListener('change', function() {
    let v = parseFloat(this.value);
    if (!(v > 0)) this.value = nf(zoom,1,2); // restore on blur/Enter if still invalid
  });

  document.getElementById('thicknessPicker').addEventListener('input', function() {
    let v = parseFloat(this.value);
    if (v > 0) {
      currentLineWeight = v;
      if (selectedLines.length > 0) {
        for (let ln of selectedLines) ln.weight = currentLineWeight;
      } else if (selectedLine) {
        selectedLine.weight = currentLineWeight;
      }
    }
  });

  resetView.mousePressed(()=> {
    zoom = 1.0;
    viewAngle = 0;
    centerImage();
  });

  // Ensure 'A' select-all works even when canvas doesn't have focus
  document.addEventListener('keydown', function(e) {
    if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey) {
      let active = document.activeElement;
      let isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
      if (!isTyping && !inputFocused && !measureAngleMode && !drawGridMode) {
        selectedLines = [...lines];
        selectedAngleLabels = [...angleLabels];
        selectedLine = selectedLines.length > 0 ? selectedLines[0] : null;
        selectedAngleLabel = null;
        inputFocused = false;
        e.preventDefault();
      }
    }
  });

  resetLines = select('#resetLines');
  resetImage = select('#resetImage');
  resetLines.mousePressed(()=> {
    drawGridMode = false; gridLines = [];
    measureAngleMode = false; angleLines = [];
    hideStatus();
    document.getElementById('resetLinesDialog').style.display = 'block';
  });
  document.getElementById('resetLinesYes').addEventListener('click', ()=> {
    document.getElementById('resetLinesDialog').style.display = 'none';
    lines = []; redoStack = []; undoStack = [];
    calibrationLine = null; pixelsPerUnit = 0;
    selectedLine = null; selectedLines = []; inputFocused = false;
    angleLabels = []; selectedAngleLabel = null; selectedAngleLabels = []; angleLabelDragging = false;
  });
  document.getElementById('resetLinesNo').addEventListener('click', ()=> {
    document.getElementById('resetLinesDialog').style.display = 'none';
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

  let gridDivCross = document.getElementById('gridDivCross');
  gridDivCross.addEventListener('change', () => {
    let v = parseInt(gridDivCross.value);
    if (v >= 1 && v <= 512) gridDivisionsX = v; else gridDivCross.value = gridDivisionsX;
  });
  let gridDivAlong = document.getElementById('gridDivAlong');
  gridDivAlong.addEventListener('change', () => {
    let v = parseInt(gridDivAlong.value);
    if (v >= 1 && v <= 512) gridDivisionsY = v; else gridDivAlong.value = gridDivisionsY;
  });

  document.getElementById('showPxLabels').addEventListener('change', function() { showPxLabels = this.checked; });
  document.getElementById('showCalibratedLabels').addEventListener('change', function() { showCalibratedLabels = this.checked; });
  document.getElementById('showAngleLabels').addEventListener('change', function() { showAngleLabels = this.checked; });

  const gridSpacingToggle = document.getElementById('gridSpacingToggle');
  gridSpacingToggle.addEventListener('click', () => {
    gridVpMode = !gridVpMode;
    gridSpacingToggle.textContent = gridVpMode ? '2VP Spacing' : 'Affine Spacing';
    gridSpacingToggle.style.background = '#466';
    gridSpacingToggle.style.color = '#aff';
  });

  drawGridBtn = select('#drawGridBtn');
  drawGridBtn.mousePressed(() => {
    if (drawGridMode || gridLines.length > 0) {
      drawGridMode = false;
      gridLines = [];
      hideStatus();
      return;
    }
    if (lines.length < 2) {
      showStatus('Not enough lines', true);
      return;
    }
    drawGridMode = true;
    gridLines = [];
    if (lines.length === 2) {
      gridLines = [lines[0], lines[1]];
      selectedLine = null; selectedLines = []; inputFocused = false;
      showStatus('Press Enter to confirm, Escape to cancel');
    } else if (selectedLines.length > 2) {
      drawGridMode = false;
      showStatus('Too many lines selected. Select two lines.', true);
    } else if (selectedLines.length === 2) {
      gridLines = [selectedLines[0], selectedLines[1]];
      selectedLine = null; selectedLines = []; inputFocused = false;
      showStatus('Press Enter to confirm, Escape to cancel');
    } else if (selectedLine) {
      gridLines.push(selectedLine);
      selectedLine = null; selectedLines = []; inputFocused = false;
      showStatus('Select second line');
    } else {
      showStatus('Select first line');
    }
  });

  measureAngleBtn = select('#measureAngleBtn');
  measureAngleBtn.mousePressed(() => {
    if (measureAngleMode || angleLines.length > 0) {
      measureAngleMode = false;
      angleLines = [];
      hideStatus();
      return;
    }
    if (lines.length < 2) {
      showStatus('Not enough lines', true);
    } else {
      measureAngleMode = true;
      angleLines = [];
      if (lines.length === 2) {
        angleLines = [lines[0], lines[1]];
        selectedLine = null; inputFocused = false;
        showStatus('Click to place angle label');
      } else if (selectedLine) {
        angleLines.push(selectedLine);
        selectedLine = null;
        inputFocused = false;
        showStatus('Select second line');
      } else {
        selectedLine = null;
        inputFocused = false;
        showStatus('Select first line');
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
    selectedLine = null; selectedLines = [];
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
  if (img) {
    image(img, 0, 0);
    noFill();
    stroke(0);
    strokeWeight(1.5 / zoom);
    rect(0, 0, img.width, img.height);
  }
  noFill();
  let flashOn = floor(millis() / 300) % 2 === 0;
  for (let ln of lines) {
    let drawCol = ln.col;
    if (selectedLines.includes(ln) && !flashOn) drawCol = invertColor(drawCol);
    if (angleLines.includes(ln) && !flashOn) drawCol = invertColor(drawCol);
    if (gridLines.includes(ln) && !flashOn) drawCol = invertColor(drawCol);
    strokeWeight((ln.weight || 1.5) / zoom);
    stroke(drawCol);
    line(ln.x1, ln.y1, ln.x2, ln.y2);
  }
  // Draw Grid preview lines
  if (gridLines.length === 2) {
    let segs = buildGridLines(gridLines[0], gridLines[1], gridDivisionsX, gridDivisionsY, gridVpMode);
    // Update spacing toggle button color: red if 2VP+concave, teal otherwise
    let gst = document.getElementById('gridSpacingToggle');
    if (gst) {
      let concave = gridVpMode && !isGridQuadConvex(gridLines[0], gridLines[1]);
      gst.style.background = concave ? '#633' : '#466';
      gst.style.color = concave ? '#faa' : '#aff';
    }
    stroke(currentLineColor);
    drawingContext.setLineDash([8 / zoom, 6 / zoom]);
    for (let s of segs) {
      if (!s.dashed) drawingContext.setLineDash([]);
      else drawingContext.setLineDash([8 / zoom, 6 / zoom]);
      line(s.x1, s.y1, s.x2, s.y2);
    }
    drawingContext.setLineDash([]);
  } else {
    // Not in grid drawing mode — ensure toggle button stays teal
    let gst = document.getElementById('gridSpacingToggle');
    if (gst) { gst.style.background = '#466'; gst.style.color = '#aff'; }
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

  // Grid mode endpoint circles (drawn in screen space after pop)
  if (gridLines.length === 2) {
    for (let gl of gridLines) {
      for (let pt of [{x: gl.x1, y: gl.y1}, {x: gl.x2, y: gl.y2}]) {
        let sp = toScreenCoords(pt.x, pt.y);
        strokeWeight(2);
        stroke(0);
        noFill();
        ellipse(sp.x, sp.y, EP_RADIUS * 2, EP_RADIUS * 2);
        strokeWeight(1.5);
        stroke(255);
        ellipse(sp.x, sp.y, EP_RADIUS * 2, EP_RADIUS * 2);
      }
    }
    // 2VP mode: compute and draw vanishing points
    if (gridVpMode) {
      let a = gridLines[0], b = gridLines[1];
      // Orient b to match a (same as buildGridLines)
      let d1 = dist(a.x1, a.y1, b.x1, b.y1) + dist(a.x2, a.y2, b.x2, b.y2);
      let d2 = dist(a.x1, a.y1, b.x2, b.y2) + dist(a.x2, a.y2, b.x1, b.y1);
      let b1x, b1y, b2x, b2y;
      if (d1 <= d2) { b1x = b.x1; b1y = b.y1; b2x = b.x2; b2y = b.y2; }
      else          { b1x = b.x2; b1y = b.y2; b2x = b.x1; b2y = b.y1; }
      // VP1: intersection of the two rails
      let vp1 = lineIntersection(a, b);
      // VP2: intersection of the two end-connectors
      let conn1 = { x1: a.x1, y1: a.y1, x2: b1x, y2: b1y };
      let conn2 = { x1: a.x2, y1: a.y2, x2: b2x, y2: b2y };
      let vp2 = lineIntersection(conn1, conn2);
      for (let vp of [vp1, vp2]) {
        if (!vp) continue;
        let sp = toScreenCoords(vp.x, vp.y);
        strokeWeight(2); stroke(0); noFill();
        ellipse(sp.x, sp.y, 14, 14);
        strokeWeight(1.5); stroke(255); fill(255, 255, 255, 120);
        ellipse(sp.x, sp.y, 14, 14);
      }
    }
  }

  if (selectedLines.length > 0 && !measureAngleMode) {
    for (let sl of selectedLines) {
      let sp1 = toScreenCoords(sl.x1, sl.y1);
      let sp2 = toScreenCoords(sl.x2, sl.y2);
      for (let sp of [sp1, sp2]) {
        let snapping = snapActivePts.some(p => dist(p.x, p.y, sp.x, sp.y) < 1);
        strokeWeight(3); stroke(0); noFill();
        ellipse(sp.x, sp.y, EP_RADIUS*2, EP_RADIUS*2);
        strokeWeight(1.5);
        stroke(snapping ? color(0, 220, 80) : 255);
        if (snapping) fill(0, 220, 80, 60); else noFill();
        ellipse(sp.x, sp.y, EP_RADIUS*2, EP_RADIUS*2);
        noFill();
      }
    }
  }

  // CTRL/ALT held: show snap target circles on all line and arc endpoints
  if ((keyIsDown(CONTROL) || keyIsDown(ALT)) && !measureAngleMode) {
    for (let pt of getSnapPoints()) {
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

  if (document.activeElement !== zoomDisplay.elt) zoomDisplay.elt.value = nf(zoom,1,2);
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
    let isSelected = al === selectedAngleLabel || selectedAngleLabels.includes(al);
    let c = color(al.col || '#ffffff');
    let arcCol = (isSelected && !flashOn) ? color(255 - red(c), 255 - green(c), 255 - blue(c), 160) : color(red(c), green(c), blue(c), 160);
    noFill();
    strokeWeight(isSelected ? al.weight * 1.5 : al.weight);
    stroke(arcCol);
    arc(sp.x, sp.y, r * 2, r * 2, arcA.start, arcA.stop, OPEN);
    if (showAngleLabels) drawAngleLabel(slabel.x, slabel.y, angleDeg, false);
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
  if (!showPxLabels && !showCalibratedLabels && !selected) return;
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
  let hasSecondBox = selected || (showCalibratedLabels && (hasValue || showUnits));

  let labelOffsetY = hasSecondBox ? -(boxH + 4)/2 : 0;

  if (showPxLabels || selected) {
    noStroke();
    fill(0, 180);
    rect(cx - tw/2 - pad, cy + labelOffsetY - boxH/2, tw + pad*2, boxH, 3);
    fill(255);
    text(pxLabel, cx, cy + labelOffsetY);
  }

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
    if (!showCalibratedLabels) return;
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
    if (!showCalibratedLabels) return;
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

// Returns harmonic parameter t such that 1/dist(P(t), vp) is linearly spaced
function harmonicT(k, N, pNear, pFar, vp) {
  let d_near = dist(pNear.x, pNear.y, vp.x, vp.y);
  let d_far  = dist(pFar.x,  pFar.y,  vp.x, vp.y);
  if (d_near < 1e-6 || d_far < 1e-6 || abs(d_far - d_near) < 1e-6) return k / N;
  let inv_near = 1 / d_near;
  let inv_far  = 1 / d_far;
  let inv_k = inv_near + (k / N) * (inv_far - inv_near);
  if (abs(inv_k) < 1e-12) return k / N;
  let d_k = 1 / inv_k;
  return (d_k - d_near) / (d_far - d_near);
}

// Returns true if the oriented quad formed by lines a and b is convex
function isGridQuadConvex(a, b) {
  let d1 = dist(a.x1, a.y1, b.x1, b.y1) + dist(a.x2, a.y2, b.x2, b.y2);
  let d2 = dist(a.x1, a.y1, b.x2, b.y2) + dist(a.x2, a.y2, b.x1, b.y1);
  let b1x, b1y, b2x, b2y;
  if (d1 <= d2) { b1x = b.x1; b1y = b.y1; b2x = b.x2; b2y = b.y2; }
  else          { b1x = b.x2; b1y = b.y2; b2x = b.x1; b2y = b.y1; }
  let dx1 = b2x - a.x1, dy1 = b2y - a.y1;
  let dx2 = b1x - a.x2, dy2 = b1y - a.y2;
  let denom = dx1 * dy2 - dy1 * dx2;
  if (abs(denom) < 1e-10) return false;
  let t = ((a.x2 - a.x1) * dy2 - (a.y2 - a.y1) * dx2) / denom;
  let u = ((a.x2 - a.x1) * dy1 - (a.y2 - a.y1) * dx1) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// Returns all new lines for the grid as [{x1,y1,x2,y2},...]:
// 2 outer connectors + interior cross and along lines
function buildGridLines(a, b, Nx, Ny, vpMode) {
  let d1 = dist(a.x1, a.y1, b.x1, b.y1) + dist(a.x2, a.y2, b.x2, b.y2);
  let d2 = dist(a.x1, a.y1, b.x2, b.y2) + dist(a.x2, a.y2, b.x1, b.y1);
  let b1x, b1y, b2x, b2y;
  if (d1 <= d2) { b1x = b.x1; b1y = b.y1; b2x = b.x2; b2y = b.y2; }
  else          { b1x = b.x2; b1y = b.y2; b2x = b.x1; b2y = b.y1; }

  // Convexity check: diagonals of the quad must intersect inside (t in [0,1] for both)
  function quadIsConvex() {
    let diag1 = { x1: a.x1, y1: a.y1, x2: b2x, y2: b2y };
    let diag2 = { x1: a.x2, y1: a.y2, x2: b1x, y2: b1y };
    let dx1 = diag1.x2 - diag1.x1, dy1 = diag1.y2 - diag1.y1;
    let dx2 = diag2.x2 - diag2.x1, dy2 = diag2.y2 - diag2.y1;
    let denom = dx1 * dy2 - dy1 * dx2;
    if (abs(denom) < 1e-10) return false;
    let t = ((diag2.x1 - diag1.x1) * dy2 - (diag2.y1 - diag1.y1) * dx2) / denom;
    let u = ((diag2.x1 - diag1.x1) * dy1 - (diag2.y1 - diag1.y1) * dx1) / denom;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  let result = [];
  // Outer connectors: solid
  result.push({ x1: a.x1, y1: a.y1, x2: b1x, y2: b1y, dashed: false });
  result.push({ x1: a.x2, y1: a.y2, x2: b2x, y2: b2y, dashed: false });

  if (vpMode) {
    if (quadIsConvex()) {
      let vp1 = lineIntersection(a, b);
      let conn1 = { x1: a.x1, y1: a.y1, x2: b1x, y2: b1y };
      let conn2 = { x1: a.x2, y1: a.y2, x2: b2x, y2: b2y };
      let vp2 = lineIntersection(conn1, conn2);
      // Cross lines: harmonic positions on rails (VP1), direction toward VP2
      for (let k = 1; k < Nx; k++) {
        let tA = vp1 ? harmonicT(k, Nx, {x: a.x1, y: a.y1}, {x: a.x2, y: a.y2}, vp1) : k / Nx;
        let pA = { x: a.x1 + tA * (a.x2 - a.x1), y: a.y1 + tA * (a.y2 - a.y1) };
        let pB;
        if (vp2) {
          let crossLine = { x1: pA.x, y1: pA.y, x2: vp2.x, y2: vp2.y };
          let inter = lineIntersection(crossLine, { x1: b1x, y1: b1y, x2: b2x, y2: b2y });
          pB = inter || { x: b1x + tA * (b2x - b1x), y: b1y + tA * (b2y - b1y) };
        } else {
          pB = { x: b1x + tA * (b2x - b1x), y: b1y + tA * (b2y - b1y) };
        }
        result.push({ x1: pA.x, y1: pA.y, x2: pB.x, y2: pB.y, dashed: true });
      }
      // Along lines: harmonic positions on connectors (VP2), direction toward VP1
      for (let k = 1; k < Ny; k++) {
        let sA = vp2 ? harmonicT(k, Ny, {x: a.x1, y: a.y1}, {x: b1x, y: b1y}, vp2) : k / Ny;
        let pC = { x: a.x1 + sA * (b1x - a.x1), y: a.y1 + sA * (b1y - a.y1) };
        let pD;
        if (vp1) {
          let alongLine = { x1: pC.x, y1: pC.y, x2: vp1.x, y2: vp1.y };
          let inter = lineIntersection(alongLine, conn2);
          pD = inter || { x: a.x2 + sA * (b2x - a.x2), y: a.y2 + sA * (b2y - a.y2) };
        } else {
          pD = { x: a.x2 + sA * (b2x - a.x2), y: a.y2 + sA * (b2y - a.y2) };
        }
        result.push({ x1: pC.x, y1: pC.y, x2: pD.x, y2: pD.y, dashed: true });
      }
    }
    // else: concave quad in VP mode — draw only outer connectors, no interior lines
  } else {
    // Interior cross lines (parallel to A/B): dashed
    for (let k = 1; k < Nx; k++) {
      let t = k / Nx;
      result.push({
        x1: a.x1 + t * (a.x2 - a.x1), y1: a.y1 + t * (a.y2 - a.y1),
        x2: b1x  + t * (b2x  - b1x),  y2: b1y  + t * (b2y  - b1y),
        dashed: true
      });
    }
    // Interior along lines (parallel to connectors): dashed
    for (let k = 1; k < Ny; k++) {
      let s = k / Ny;
      result.push({
        x1: a.x1 + s * (b1x - a.x1), y1: a.y1 + s * (b1y - a.y1),
        x2: a.x2 + s * (b2x - a.x2), y2: a.y2 + s * (b2y - a.y2),
        dashed: true
      });
    }
  }
  return result;
}

function confirmGrid() {
  if (gridLines.length < 2) return;
  let segs = buildGridLines(gridLines[0], gridLines[1], gridDivisionsX, gridDivisionsY, gridVpMode);
  for (let s of segs) {
    let ln = new DrawnLine(s.x1, s.y1, s.x2, s.y2, currentLineColor, currentLineWeight);
    lines.push(ln);
    redoStack.push({ type: 'line', item: ln });
  }
  undoStack = [];
  drawGridMode = false;
  gridLines = [];
  hideStatus();
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
  angleLabels.push({ ix: inter.x, iy: inter.y, angleDeg: angleDeg, lx: lpos.x, ly: lpos.y, r: r, line1: angleLines[0], line2: angleLines[1], col: currentLineColor, weight: currentLineWeight });
  redoStack.push({ type: 'arc', item: angleLabels[angleLabels.length - 1] });
  undoStack = [];
  angleLines = [];
  measureAngleMode = false;
  hideStatus();
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

function getArcSnapPoints(al) {
  let inter = lineIntersection(al.line1, al.line2);
  if (!inter) return [];
  let r = dist(inter.x, inter.y, al.lx, al.ly);
  let arcA = getSectorArcAnglesImg(inter, al.line1, al.line2, al.lx, al.ly);
  return [
    { x: inter.x + r * Math.cos(arcA.start), y: inter.y + r * Math.sin(arcA.start) },
    { x: inter.x + r * Math.cos(arcA.stop),  y: inter.y + r * Math.sin(arcA.stop)  }
  ];
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

function drawAngleLabelsOnGraphics(g, ox, oy) {
  ox = ox || 0; oy = oy || 0;
  g.textFont('Arial');
  g.textSize(12);
  g.textAlign(CENTER, CENTER);
  let pad = 4, th = 14, boxH = th + pad * 2;
  for (let al of angleLabels) {
    let inter = lineIntersection(al.line1, al.line2);
    if (!inter) continue;
    let ix = inter.x - ox, iy = inter.y - oy;
    let lx = al.lx - ox, ly = al.ly - oy;
    let r = dist(ix, iy, lx, ly);
    let arcA = getSectorArcAnglesImg(inter, al.line1, al.line2, al.lx, al.ly);
    let angleDeg = degrees(arcA.stop - arcA.start);
    let c = color(al.col || '#ffffff');
    g.noFill();
    g.stroke(red(c), green(c), blue(c), 160);
    g.strokeWeight(al.weight || 1.5);
    g.arc(ix, iy, r * 2, r * 2, arcA.start, arcA.stop, OPEN);
    if (showAngleLabels) {
      // label box
      let label = nf(angleDeg, 1, 1) + '\u00b0';
      let tw = g.textWidth(label);
      let boxW = tw + pad * 2;
      g.noStroke();
      g.fill(0, 180);
      g.rect(lx - boxW / 2, ly - boxH / 2, boxW, boxH, 3);
      g.fill(255);
      g.text(label, lx, ly);
    }
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
  let ctrlAlt = keyIsDown(CONTROL) || keyIsDown(ALT);
  if (mouseButton === CENTER) {
    mmbPanning = true;
    mmbLastX = mouseX;
    mmbLastY = mouseY;
    return;
  }

  if (drawGridMode) {
    // When both lines selected, check for endpoint drag first
    if (gridLines.length === 2) {
      for (let gl of gridLines) {
        let sp1 = toScreenCoords(gl.x1, gl.y1);
        let sp2 = toScreenCoords(gl.x2, gl.y2);
        if (dist(mouseX, mouseY, sp1.x, sp1.y) <= EP_RADIUS) {
          epDragLine = gl; epDragIndex = 1;
          epDragStartX = gl.x1; epDragStartY = gl.y1; return;
        }
        if (dist(mouseX, mouseY, sp2.x, sp2.y) <= EP_RADIUS) {
          epDragLine = gl; epDragIndex = 2;
          epDragStartX = gl.x2; epDragStartY = gl.y2; return;
        }
      }
    }
    let hitThresh = 8;
    for (let ln of lines) {
      let sp1 = toScreenCoords(ln.x1, ln.y1);
      let sp2 = toScreenCoords(ln.x2, ln.y2);
      if (pointToSegDist(mouseX, mouseY, sp1.x, sp1.y, sp2.x, sp2.y) < hitThresh) {
        if (gridLines.includes(ln)) {
          gridLines = gridLines.filter(l => l !== ln);
        } else if (gridLines.length < 2) {
          gridLines.push(ln);
        }
        if (gridLines.length === 0) showStatus('Select first line');
        else if (gridLines.length === 1) showStatus('Select second line');
        else showStatus('Press Enter to confirm, Escape to cancel');
        break;
      }
    }
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
        if (angleLines.length === 0) {
          showStatus('Select first line');
        } else if (angleLines.length === 1) {
          showStatus('Select second line');
        } else if (angleLines.length >= 2) {
          showStatus('Lines selected');
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
        // Don't select if click is on one of the arc's endpoints
        let arcEndpts = getArcSnapPoints(al);
        let onEndpoint = arcEndpts.some(pt => {
          let ep = toScreenCoords(pt.x, pt.y);
          return dist(mouseX, mouseY, ep.x, ep.y) <= EP_RADIUS;
        });
        if (onEndpoint) continue;
        if (ctrlAlt) {
          // Ctrl/Alt + click arc = toggle it in multi-selection
          let idx = selectedAngleLabels.indexOf(al);
          if (idx >= 0) selectedAngleLabels.splice(idx, 1);
          else selectedAngleLabels.push(al);
          selectedAngleLabel = null;
          return;
        }
        // If this arc is already in the multi-selection, start drag without clearing the group
        let inArcMultiSelection = selectedAngleLabels.includes(al);
        if (inArcMultiSelection) {
          angleLabelDragging = true;
          arcDragOrigLx = al.lx; arcDragOrigLy = al.ly;
          let _aic0 = toImgCoords(mouseX, mouseY);
          arcDragMouseStartX = _aic0.x; arcDragMouseStartY = _aic0.y;
          arcDragLines = selectedLines.map(ln => ({ line: ln, ox1: ln.x1, oy1: ln.y1, ox2: ln.x2, oy2: ln.y2 }));
          selectedAngleLabel = al;
          return;
        }
        // Plain click on arc — store lines BEFORE clearing, then switch to arc-only selection
        let _prevLines = [...selectedLines];
        selectedAngleLabel = al;
        selectedAngleLabels = [];
        selectedLine = null;
        selectedLines = [];
        angleLabelDragging = true;
        arcDragOrigLx = al.lx; arcDragOrigLy = al.ly;
        let _aic = toImgCoords(mouseX, mouseY);
        arcDragMouseStartX = _aic.x; arcDragMouseStartY = _aic.y;
        arcDragLines = [];
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
  }
  // Endpoint drag — check all selected lines so multi-select stays intact
  // (skip if Ctrl/Alt held — that means draw a new line snapped from this endpoint)
  if (!ctrlAlt) {
  for (let sl of selectedLines) {
    let sp1 = toScreenCoords(sl.x1, sl.y1);
    let sp2 = toScreenCoords(sl.x2, sl.y2);
    if (dist(mouseX, mouseY, sp1.x, sp1.y) <= EP_RADIUS) {
      epDragLine = sl; epDragIndex = 1;
      epDragStartX = sl.x1; epDragStartY = sl.y1; return;
    }
    if (dist(mouseX, mouseY, sp2.x, sp2.y) <= EP_RADIUS) {
      epDragLine = sl; epDragIndex = 2;
      epDragStartX = sl.x2; epDragStartY = sl.y2; return;
    }
  }
  } // end !ctrlAlt

  let epCheckPts = [];
  for (let ln of lines) epCheckPts.push({x: ln.x1, y: ln.y1}, {x: ln.x2, y: ln.y2});
  if (ctrlAlt) for (let al of angleLabels) for (let pt of getArcSnapPoints(al)) epCheckPts.push(pt);
  let nearEndpoint = epCheckPts.some(pt => {
    let sp = toScreenCoords(pt.x, pt.y);
    return dist(mouseX, mouseY, sp.x, sp.y) <= EP_RADIUS;
  });

  // Enter line-body hit detection if not near an endpoint.
  // When ctrlAlt is held and we ARE near an endpoint, skip (fall through to draw new line).
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
      if (ctrlAlt) {
        // Ctrl/Alt + click = toggle this line in the multi-selection
        let idx = selectedLines.indexOf(hit);
        if (idx >= 0) selectedLines.splice(idx, 1);
        else selectedLines.push(hit);
        selectedLine = null;
        inputFocused = false;
        return;
      }
      let inMultiSelection = selectedLines.includes(hit) && (selectedLines.length > 1 || selectedAngleLabels.length > 0 || selectedAngleLabel !== null);
      if (!inMultiSelection) {
        // Normal single-select — clear any arc selection first
        selectedAngleLabel = null;
        selectedAngleLabels = [];
        if (hit !== selectedLine) {
          selectedLine = hit;
          inputText = hit.customValue || '';
          inputFocused = true;
          justSelected = true;
          if (reverseLineActive) {
            let tmp;
            tmp = hit.x1; hit.x1 = hit.x2; hit.x2 = tmp;
            tmp = hit.y1; hit.y1 = hit.y2; hit.y2 = tmp;
            reverseLineActive = false;
          }
        }
        selectedLines = [hit];
      }
      // Start whole-line drag (single or grouped)
      let ic = toImgCoords(mouseX, mouseY);
      lineDragLine = hit;
      lineDragMouseStartX = ic.x; lineDragMouseStartY = ic.y;
      lineDragOrigX1 = hit.x1; lineDragOrigY1 = hit.y1;
      lineDragOrigX2 = hit.x2; lineDragOrigY2 = hit.y2;
      lineDragGroup = selectedLines.length > 1
        ? selectedLines.map(ln => ({ line: ln, ox1: ln.x1, oy1: ln.y1, ox2: ln.x2, oy2: ln.y2 }))
        : [];
      // Include arc labels in the group drag: only explicitly selected arcs move
      // (covers both single-select via selectedAngleLabel and multi-select via selectedAngleLabels)
      const allSelectedArcs = selectedAngleLabel
        ? [selectedAngleLabel, ...selectedAngleLabels.filter(al => al !== selectedAngleLabel)]
        : selectedAngleLabels;
      lineDragGroupArcs = allSelectedArcs.map(al => ({ arc: al, olx: al.lx, oly: al.ly }));
      dragging = false;
      return;
    }
  }

  selectedLine = null;
  selectedAngleLabel = null; selectedAngleLabels = [];
  selectedLines = [];
  inputFocused = false;
  dragging = true;
  dragStartX = mouseX;
  dragStartY = mouseY;
  // CTRL/ALT held: snap start to a nearby line or arc endpoint
  if (ctrlAlt) {
    for (let pt of getSnapPoints()) {
      let sp = toScreenCoords(pt.x, pt.y);
      if (dist(mouseX, mouseY, sp.x, sp.y) <= EP_RADIUS) {
        dragStartX = sp.x; dragStartY = sp.y; break;
      }
    }
  }
}

function mouseDragged() {
  if (lineDragLine) {
    let ic = toImgCoords(mouseX, mouseY);
    let dx = ic.x - lineDragMouseStartX;
    let dy = ic.y - lineDragMouseStartY;

    // Ctrl/Alt held: snap nearest endpoint of any dragged line to a non-dragged endpoint
    snapActivePts = [];
    if (keyIsDown(CONTROL) || keyIsDown(ALT)) {
      const draggedSet = new Set(lineDragGroup.length > 0 ? lineDragGroup.map(g => g.line) : [lineDragLine]);
      const candidates = lineDragGroup.length > 0
        ? lineDragGroup.flatMap(g => [
            { ox: g.ox1, oy: g.oy1 }, { ox: g.ox2, oy: g.oy2 }
          ])
        : [{ ox: lineDragOrigX1, oy: lineDragOrigY1 }, { ox: lineDragOrigX2, oy: lineDragOrigY2 }];
      let bestDist = EP_RADIUS;
      let bestDx = null, bestDy = null;
      let bestCandSP = null, bestTargetSP = null;
      for (let ln of lines) {
        if (draggedSet.has(ln)) continue;
        for (let pt of [{x: ln.x1, y: ln.y1}, {x: ln.x2, y: ln.y2}]) {
          let sp = toScreenCoords(pt.x, pt.y);
          for (let cand of candidates) {
            let candSP = toScreenCoords(cand.ox + dx, cand.oy + dy);
            let d = dist(candSP.x, candSP.y, sp.x, sp.y);
            if (d < bestDist) {
              bestDist = d;
              let candImg = toImgCoords(candSP.x, candSP.y);
              bestDx = dx + (pt.x - candImg.x);
              bestDy = dy + (pt.y - candImg.y);
              bestCandSP = candSP;
              bestTargetSP = sp;
            }
          }
        }
      }
      if (bestDx !== null) {
        dx = bestDx; dy = bestDy;
        snapActivePts = [bestCandSP, bestTargetSP];
      }
    }

    if (lineDragGroup.length > 0) {
      for (let g of lineDragGroup) {
        g.line.x1 = g.ox1 + dx; g.line.y1 = g.oy1 + dy;
        g.line.x2 = g.ox2 + dx; g.line.y2 = g.oy2 + dy;
      }
    } else {
      lineDragLine.x1 = lineDragOrigX1 + dx;
      lineDragLine.y1 = lineDragOrigY1 + dy;
      lineDragLine.x2 = lineDragOrigX2 + dx;
      lineDragLine.y2 = lineDragOrigY2 + dy;
    }
    for (let g of lineDragGroupArcs) {
      g.arc.lx = g.olx + dx; g.arc.ly = g.oly + dy;
    }
    return;
  }
  if (angleLabelDragging && selectedAngleLabel) {
    let ic = toImgCoords(mouseX, mouseY);
    let dx = ic.x - arcDragMouseStartX;
    let dy = ic.y - arcDragMouseStartY;
    selectedAngleLabel.lx = arcDragOrigLx + dx;
    selectedAngleLabel.ly = arcDragOrigLy + dy;
    for (let g of arcDragLines) {
      g.line.x1 = g.ox1 + dx; g.line.y1 = g.oy1 + dy;
      g.line.x2 = g.ox2 + dx; g.line.y2 = g.oy2 + dy;
    }
    return;
  }
  if (mmbPanning) {
    let dx = mouseX - mmbLastX;
    let dy = mouseY - mmbLastY;
    let c = Math.cos(-viewAngle), s = Math.sin(-viewAngle);
    imgX += dx * c - dy * s;
    imgY += dx * s + dy * c;
    mmbLastX = mouseX;
    mmbLastY = mouseY;
    return;
  }
  if (epDragLine) {
    let ic = toImgCoords(mouseX, mouseY);
    let ix = ic.x, iy = ic.y;
    if (keyIsDown(CONTROL) || keyIsDown(ALT)) {
      for (let pt of getSnapPoints()) {
        let sp = toScreenCoords(pt.x, pt.y);
        if (dist(mouseX, mouseY, sp.x, sp.y) <= EP_RADIUS) {
          ix = pt.x; iy = pt.y; break;
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
    updateLineLen(epDragLine);
  }
}

function mouseReleased() {
  if (angleLabelDragging && selectedAngleLabel) {
    let moved = Math.abs(selectedAngleLabel.lx - arcDragOrigLx) > 0.001 || Math.abs(selectedAngleLabel.ly - arcDragOrigLy) > 0.001;
    if (moved) {
      let lineMoves = arcDragLines
        .filter(g => Math.abs(g.line.x1 - g.ox1) > 0.001 || Math.abs(g.line.y1 - g.oy1) > 0.001)
        .map(g => ({ line: g.line, ox1: g.ox1, oy1: g.oy1, ox2: g.ox2, oy2: g.oy2,
                     nx1: g.line.x1, ny1: g.line.y1, nx2: g.line.x2, ny2: g.line.y2 }));
      if (lineMoves.length > 0) {
        redoStack.push({ type: 'groupmove', items: lineMoves,
          arcItems: [{ arc: selectedAngleLabel, olx: arcDragOrigLx, oly: arcDragOrigLy,
                       nlx: selectedAngleLabel.lx, nly: selectedAngleLabel.ly }] });
      } else {
        redoStack.push({ type: 'arcmove', item: selectedAngleLabel,
                         olx: arcDragOrigLx, oly: arcDragOrigLy,
                         nlx: selectedAngleLabel.lx, nly: selectedAngleLabel.ly });
      }
      undoStack = [];
    }
  }
  angleLabelDragging = false; arcDragLines = [];
  if (mmbPanning) { mmbPanning = false; return; }
  if (lineDragLine) {
    if (lineDragGroup.length > 0) {
      let moves = lineDragGroup
        .filter(g => Math.abs(g.line.x1 - g.ox1) > 0.001 || Math.abs(g.line.y1 - g.oy1) > 0.001)
        .map(g => ({ line: g.line, ox1: g.ox1, oy1: g.oy1, ox2: g.ox2, oy2: g.oy2,
                     nx1: g.line.x1, ny1: g.line.y1, nx2: g.line.x2, ny2: g.line.y2 }));
      let arcMoves = lineDragGroupArcs
        .filter(g => Math.abs(g.arc.lx - g.olx) > 0.001 || Math.abs(g.arc.ly - g.oly) > 0.001)
        .map(g => ({ arc: g.arc, olx: g.olx, oly: g.oly, nlx: g.arc.lx, nly: g.arc.ly }));
      if (moves.length > 0 || arcMoves.length > 0) {
        redoStack.push({ type: 'groupmove', items: moves, arcItems: arcMoves });
        undoStack = [];
      }
      lineDragGroup = []; lineDragGroupArcs = [];
    } else {
      let moved = Math.abs(lineDragLine.x1 - lineDragOrigX1) > 0.001 || Math.abs(lineDragLine.y1 - lineDragOrigY1) > 0.001;
      if (moved) {
        let arcMoves = lineDragGroupArcs
          .filter(g => Math.abs(g.arc.lx - g.olx) > 0.001 || Math.abs(g.arc.ly - g.oly) > 0.001)
          .map(g => ({ arc: g.arc, olx: g.olx, oly: g.oly, nlx: g.arc.lx, nly: g.arc.ly }));
        if (arcMoves.length > 0) {
          // Use groupmove so arc positions are also undoable
          redoStack.push({ type: 'groupmove',
            items: [{ line: lineDragLine, ox1: lineDragOrigX1, oy1: lineDragOrigY1,
                      ox2: lineDragOrigX2, oy2: lineDragOrigY2,
                      nx1: lineDragLine.x1, ny1: lineDragLine.y1,
                      nx2: lineDragLine.x2, ny2: lineDragLine.y2 }],
            arcItems: arcMoves });
        } else {
          redoStack.push({ type: 'linemove', item: lineDragLine,
                           ox1: lineDragOrigX1, oy1: lineDragOrigY1,
                           ox2: lineDragOrigX2, oy2: lineDragOrigY2,
                           nx1: lineDragLine.x1, ny1: lineDragLine.y1,
                           nx2: lineDragLine.x2, ny2: lineDragLine.y2 });
        }
        undoStack = [];
      }
    }
    lineDragLine = null; lineDragGroupArcs = []; snapActivePts = []; return;
  }
  if (epDragLine) {
    let nx = epDragIndex === 1 ? epDragLine.x1 : epDragLine.x2;
    let ny = epDragIndex === 1 ? epDragLine.y1 : epDragLine.y2;
    if (Math.abs(nx - epDragStartX) > 0.001 || Math.abs(ny - epDragStartY) > 0.001) {
      redoStack.push({ type: 'move', item: epDragLine, index: epDragIndex,
                       ox: epDragStartX, oy: epDragStartY, nx, ny });
      undoStack = [];
    }
    epDragLine = null; return;
  }
  if (dragging) {
    let ic1 = toImgCoords(dragStartX, dragStartY);
    let ic2raw = toImgCoords(mouseX, mouseY);
    let ic2 = snapEndpoint(ic1.x, ic1.y, ic2raw.x, ic2raw.y);
    let ix1 = ic1.x, iy1 = ic1.y;
    let ix2 = ic2.x, iy2 = ic2.y;
    if (keyIsDown(CONTROL) || keyIsDown(ALT)) {
      for (let pt of getSnapPoints()) {
        let sp = toScreenCoords(pt.x, pt.y);
        if (dist(mouseX, mouseY, sp.x, sp.y) <= EP_RADIUS) {
          ix2 = pt.x; iy2 = pt.y; break;
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
  if ((key === 'a' || key === 'A') && !inputFocused && !measureAngleMode && !drawGridMode) {
    selectedLines = [...lines];
    selectedAngleLabels = [...angleLabels];
    selectedLine = selectedLines.length > 0 ? selectedLines[0] : null;
    selectedAngleLabel = null;
    inputFocused = false;
    return false;
  }

  if (angleLines.length >= 2 && keyCode === ENTER) {
    confirmAngle(mouseX, mouseY);
    return;
  }

  if (gridLines.length >= 2 && keyCode === ENTER) {
    confirmGrid();
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
    if (drawGridMode || gridLines.length > 0) {
      drawGridMode = false;
      gridLines = [];
      hideStatus();
      return;
    }
    if (measureAngleMode || angleLines.length > 0) {
      measureAngleMode = false;
      angleLines = [];
      hideStatus();
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

  if (keyCode === DELETE && selectedLines.length > 0) {
    const deletedSet = new Set(selectedLines);
    for (let deleted of selectedLines) {
      if (deleted === calibrationLine) { calibrationLine = null; pixelsPerUnit = 0; }
      lines = lines.filter(l => l !== deleted);
      angleLabels = angleLabels.filter(al => al.line1 !== deleted && al.line2 !== deleted);
    }
    redoStack = redoStack.filter(e => {
      if (e.item && deletedSet.has(e.item)) return false;
      if (e.item && (deletedSet.has(e.item.line1) || deletedSet.has(e.item.line2))) return false;
      if (e.items && e.items.some(i => deletedSet.has(i.line))) return false;
      return true;
    });
    undoStack = undoStack.filter(e => {
      if (e.item && deletedSet.has(e.item)) return false;
      if (e.item && (deletedSet.has(e.item.line1) || deletedSet.has(e.item.line2))) return false;
      if (e.items && e.items.some(i => deletedSet.has(i.line))) return false;
      return true;
    });
    selectedLine = null; selectedLines = []; inputFocused = false;
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
  } else if (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW || keyCode === UP_ARROW || keyCode === DOWN_ARROW) {
    let focused = document.activeElement;
    if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) return;
    let c=Math.cos(-viewAngle), s=Math.sin(-viewAngle);
    if      (keyCode === LEFT_ARROW)  { imgX+=(-PAN_STEP)*c; imgY+=(-PAN_STEP)*s; }
    else if (keyCode === RIGHT_ARROW) { imgX+=PAN_STEP*c;    imgY+=PAN_STEP*s; }
    else if (keyCode === UP_ARROW)    { imgX-=(-PAN_STEP)*s; imgY+=(-PAN_STEP)*c; }
    else if (keyCode === DOWN_ARROW)  { imgX-=PAN_STEP*s;    imgY+=PAN_STEP*c; }
    return false;
  }
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

function drawLabelsOnGraphics(g, ox, oy) {
  if (!showPxLabels && !showCalibratedLabels) return;
  ox = ox || 0; oy = oy || 0;
  g.textFont('Arial');
  g.textSize(12);
  let pad = 4;
  let th = 14;
  let boxH = th + pad * 2;
  for (let ln of lines) {
    let cx = (ln.x1 + ln.x2) / 2 - ox;
    let cy = (ln.y1 + ln.y2) / 2 - oy;
    let pxLabel = nf(ln.imgLen, 1, 1) + ' px';
    let hasUnits = pixelsPerUnit > 0 && ln !== calibrationLine;
    let unitLabel = (showCalibratedLabels && hasUnits) ? nf(ln.imgLen / pixelsPerUnit, 1, 2) + ' units' : null;
    let isCalib = ln === calibrationLine && ln.customValue.length > 0;
    let calibLabel = (showCalibratedLabels && isCalib) ? (ln.customValue + ' units') : null;
    let hasSecond = unitLabel || calibLabel;
    let offsetY = hasSecond ? -(boxH + 4) / 2 : 0;

    if (showPxLabels) {
      // px label
      g.textAlign(CENTER, CENTER);
      let tw = g.textWidth(pxLabel);
      g.noStroke();
      g.fill(0, 180);
      g.rect(cx - tw / 2 - pad, cy + offsetY - boxH / 2, tw + pad * 2, boxH, 3);
      g.fill(255);
      g.text(pxLabel, cx, cy + offsetY);
    }

    // second label
    if (unitLabel) {
      let tw = g.textWidth(pxLabel);
      let uw = max(tw + pad * 2, g.textWidth(unitLabel) + pad * 2);
      g.noStroke();
      g.fill(0, 180);
      g.rect(cx - uw / 2, cy + boxH / 2 + 4, uw, boxH, 3);
      g.fill(255);
      g.text(unitLabel, cx, cy + boxH / 2 + 4 + boxH / 2);
    } else if (calibLabel) {
      let tw = g.textWidth(pxLabel);
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
    const doSvgImage    = document.getElementById('ckSvgImage').checked;
    const doSvgLines    = document.getElementById('ckSvgLines').checked;
    const doCsv         = document.getElementById('ckCsv').checked;

    const PAD = 40;

    // Compute bounding box covering image + all line endpoints
    let bx1 = img ? 0 : Infinity,  by1 = img ? 0 : Infinity;
    let bx2 = img ? img.width : -Infinity, by2 = img ? img.height : -Infinity;
    for (let ln of lines) {
      bx1 = min(bx1, ln.x1, ln.x2); by1 = min(by1, ln.y1, ln.y2);
      bx2 = max(bx2, ln.x1, ln.x2); by2 = max(by2, ln.y1, ln.y2);
    }
    for (let al of angleLabels) {
      bx1 = min(bx1, al.lx); by1 = min(by1, al.ly);
      bx2 = max(bx2, al.lx); by2 = max(by2, al.ly);
    }
    if (lines.length === 0 && !img) { bx1 = 0; by1 = 0; bx2 = width; by2 = height; }

    let ox = bx1 - PAD, oy = by1 - PAD;
    let W = (bx2 - bx1) + PAD * 2;
    let H = (by2 - by1) + PAD * 2;

    // helper: draw lines + labels onto a graphics with offset
    function drawIntoG(g, drawImg) {
      if (drawImg && img) g.image(img, -ox, -oy);
      else g.background(40);
      g.noFill();
      for (let ln of lines) {
        g.strokeWeight(ln.weight || 1.5);
        g.stroke(ln.col);
        g.line(ln.x1 - ox, ln.y1 - oy, ln.x2 - ox, ln.y2 - oy);
      }
    }

    // 1. PNG: image + lines + labels
    if (doPngComposite) {
      let g1 = createGraphics(W, H);
      drawIntoG(g1, true);
      drawLabelsOnGraphics(g1, ox, oy);
      drawAngleLabelsOnGraphics(g1, ox, oy);
      g1.canvas.toBlob(blob => downloadBlob(blob, 'image_with_lines_and_labels.png'));
      g1.remove();
    }

    // 2. PNG: lines + labels only
    if (doPngLines) {
      let g2 = createGraphics(W, H);
      drawIntoG(g2, false);
      drawLabelsOnGraphics(g2, ox, oy);
      drawAngleLabelsOnGraphics(g2, ox, oy);
      g2.canvas.toBlob(blob => downloadBlob(blob, 'lines_and_labels.png'));
      g2.remove();
    }

    // 3 & 4. SVG exports (shared builder)
    if (doSvgImage || doSvgLines) {
      // Build the vector content (lines + arcs + labels based on toggles)
      let svgContent = [];
      for (let ln of lines) {
        svgContent.push(`  <line x1="${(ln.x1-ox).toFixed(2)}" y1="${(ln.y1-oy).toFixed(2)}" x2="${(ln.x2-ox).toFixed(2)}" y2="${(ln.y2-oy).toFixed(2)}" stroke="${ln.col}" stroke-width="${ln.weight || 1.5}" />`);
      }
      let svgPad = 4, svgTh = 14, svgBoxH = svgTh + svgPad * 2;
      if (showPxLabels || showCalibratedLabels) {
        for (let ln of lines) {
          let cx2 = (ln.x1 + ln.x2) / 2 - ox;
          let cy2 = (ln.y1 + ln.y2) / 2 - oy;
          let pxL = nf(ln.imgLen, 1, 1) + ' px';
          let hasU = pixelsPerUnit > 0 && ln !== calibrationLine;
          let unitL = (showCalibratedLabels && hasU) ? nf(ln.imgLen / pixelsPerUnit, 1, 2) + ' units' : null;
          let isC = ln === calibrationLine && ln.customValue.length > 0;
          let calibL = (showCalibratedLabels && isC) ? (ln.customValue + ' units') : null;
          let hasSec = unitL || calibL;
          let oY = hasSec ? -(svgBoxH + 4) / 2 : 0;
          let tw2 = pxL.length * 7;
          if (showPxLabels) {
            svgContent.push(`  <rect x="${(cx2 - tw2/2 - svgPad).toFixed(2)}" y="${(cy2 + oY - svgBoxH/2).toFixed(2)}" width="${(tw2 + svgPad*2).toFixed(2)}" height="${svgBoxH}" rx="3" fill="rgba(0,0,0,0.7)" />`);
            svgContent.push(`  <text x="${cx2.toFixed(2)}" y="${(cy2 + oY).toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Arial" font-size="12">${pxL}</text>`);
          }
          if (unitL) {
            let uw2 = max(tw2 + svgPad*2, unitL.length * 7 + svgPad*2);
            svgContent.push(`  <rect x="${(cx2 - uw2/2).toFixed(2)}" y="${(cy2 + svgBoxH/2 + 4).toFixed(2)}" width="${uw2.toFixed(2)}" height="${svgBoxH}" rx="3" fill="rgba(0,0,0,0.7)" />`);
            svgContent.push(`  <text x="${cx2.toFixed(2)}" y="${(cy2 + svgBoxH/2 + 4 + svgBoxH/2).toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Arial" font-size="12">${unitL}</text>`);
          } else if (calibL) {
            let cw2 = max(tw2 + svgPad*2, calibL.length * 7 + svgPad*2);
            svgContent.push(`  <rect x="${(cx2 - cw2/2).toFixed(2)}" y="${(cy2 + svgBoxH/2 + 4).toFixed(2)}" width="${cw2.toFixed(2)}" height="${svgBoxH}" rx="3" fill="rgba(0,0,0,0.7)" />`);
            svgContent.push(`  <rect x="${(cx2 - cw2/2 - 1).toFixed(2)}" y="${(cy2 + svgBoxH/2 + 3).toFixed(2)}" width="${(cw2 + 2).toFixed(2)}" height="${(svgBoxH + 2)}" rx="3" fill="none" stroke="rgb(255,180,0)" stroke-width="2" />`);
            svgContent.push(`  <text x="${cx2.toFixed(2)}" y="${(cy2 + svgBoxH/2 + 4 + svgBoxH/2).toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Arial" font-size="12">${calibL}</text>`);
          }
        }
      }
      for (let al of angleLabels) {
        let inter = lineIntersection(al.line1, al.line2);
        if (!inter) continue;
        let r2 = dist(inter.x, inter.y, al.lx, al.ly);
        let arcA2 = getSectorArcAnglesImg(inter, al.line1, al.line2, al.lx, al.ly);
        let span = arcA2.stop - arcA2.start;
        let angleDeg2 = degrees(span);
        let sx = inter.x - ox + r2 * Math.cos(arcA2.start);
        let sy = inter.y - oy + r2 * Math.sin(arcA2.start);
        let ex = inter.x - ox + r2 * Math.cos(arcA2.stop);
        let ey = inter.y - oy + r2 * Math.sin(arcA2.stop);
        let largeArc = span > Math.PI ? 1 : 0;
        let c2 = color(al.col || '#ffffff');
        let colStr = `rgb(${floor(red(c2))},${floor(green(c2))},${floor(blue(c2))})`;
        svgContent.push(`  <path d="M ${sx.toFixed(2)},${sy.toFixed(2)} A ${r2.toFixed(2)},${r2.toFixed(2)} 0 ${largeArc},1 ${ex.toFixed(2)},${ey.toFixed(2)}" fill="none" stroke="${colStr}" stroke-opacity="0.63" stroke-width="${al.weight || 1.5}" />`);
        if (showAngleLabels) {
          let alabel = nf(angleDeg2, 1, 1) + '\u00b0';
          let ltw = alabel.length * 7;
          let lboxW = ltw + svgPad * 2;
          svgContent.push(`  <rect x="${(al.lx - ox - lboxW/2).toFixed(2)}" y="${(al.ly - oy - svgBoxH/2).toFixed(2)}" width="${lboxW.toFixed(2)}" height="${svgBoxH}" rx="3" fill="rgba(0,0,0,0.7)" />`);
          svgContent.push(`  <text x="${(al.lx - ox).toFixed(2)}" y="${(al.ly - oy).toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Arial" font-size="12">${alabel}</text>`);
        }
      }
      let svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
      // SVG - image + lines
      if (doSvgImage) {
        let imgParts = [svgHeader];
        if (img) {
          let imgDataUrl = img.canvas.toDataURL('image/png');
          imgParts.push(`  <image x="${(-ox).toFixed(2)}" y="${(-oy).toFixed(2)}" width="${img.width}" height="${img.height}" href="${imgDataUrl}" />`);
        }
        imgParts.push(...svgContent);
        imgParts.push('</svg>');
        downloadBlob(imgParts.join('\n'), 'lines_with_image.svg', 'image/svg+xml');
      }
      // SVG - lines only
      if (doSvgLines) {
        let plainParts = [svgHeader, ...svgContent, '</svg>'];
        downloadBlob(plainParts.join('\n'), 'lines_only.svg', 'image/svg+xml');
      }
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
      downloadBlob(rows.join('\n'), 'lines.csv', 'text/csv');
    }
  };
}

function doUndo() {
  drawGridMode = false; gridLines = []; hideStatus();
  // Walk back through redoStack (which is our history) from the end
  for (let i = redoStack.length - 1; i >= 0; i--) {
    let entry = redoStack[i];
    if (entry.type === 'arc' && angleLabels.includes(entry.item)) {
      angleLabels = angleLabels.filter(al => al !== entry.item);
      if (selectedAngleLabel === entry.item) { selectedAngleLabel = null; angleLabelDragging = false; }
      selectedAngleLabels = selectedAngleLabels.filter(al => al !== entry.item);
      redoStack.splice(i, 1);
      undoStack.push(entry);
      return;
    }
    if (entry.type === 'line' && lines.includes(entry.item)) {
      let removed = entry.item;
      lines = lines.filter(l => l !== removed);
      if (removed === calibrationLine) { calibrationLine = null; pixelsPerUnit = 0; }
      if (removed === selectedLine) { selectedLine = null; inputFocused = false; }
      selectedLines = selectedLines.filter(l => l !== removed);
      angleLabels = angleLabels.filter(al => al.line1 !== removed && al.line2 !== removed);
      redoStack.splice(i, 1);
      undoStack.push(entry);
      return;
    }
    if (entry.type === 'move' && lines.includes(entry.item)) {
      let ln = entry.item;
      if (entry.index === 1) { ln.x1 = entry.ox; ln.y1 = entry.oy; }
      else { ln.x2 = entry.ox; ln.y2 = entry.oy; }
      updateLineLen(ln);
      redoStack.splice(i, 1);
      undoStack.push(entry);
      return;
    }
    if (entry.type === 'linemove' && lines.includes(entry.item)) {
      let ln = entry.item;
      ln.x1 = entry.ox1; ln.y1 = entry.oy1;
      ln.x2 = entry.ox2; ln.y2 = entry.oy2;
      updateLineLen(ln);
      redoStack.splice(i, 1);
      undoStack.push(entry);
      return;
    }
    if (entry.type === 'groupmove') {
      for (let m of entry.items) {
        m.line.x1 = m.ox1; m.line.y1 = m.oy1;
        m.line.x2 = m.ox2; m.line.y2 = m.oy2;
        updateLineLen(m.line);
      }
      for (let m of (entry.arcItems || [])) { m.arc.lx = m.olx; m.arc.ly = m.oly; }
      redoStack.splice(i, 1);
      undoStack.push(entry);
      return;
    }
    if (entry.type === 'arcmove' && angleLabels.includes(entry.item)) {
      entry.item.lx = entry.olx; entry.item.ly = entry.oly;
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
    } else if (entry.type === 'move') {
      let ln = entry.item;
      if (entry.index === 1) { ln.x1 = entry.nx; ln.y1 = entry.ny; }
      else { ln.x2 = entry.nx; ln.y2 = entry.ny; }
      updateLineLen(ln);
      redoStack.push(entry);
    } else if (entry.type === 'linemove') {
      let ln = entry.item;
      ln.x1 = entry.nx1; ln.y1 = entry.ny1;
      ln.x2 = entry.nx2; ln.y2 = entry.ny2;
      updateLineLen(ln);
      redoStack.push(entry);
    } else if (entry.type === 'groupmove') {
      for (let m of entry.items) {
        m.line.x1 = m.nx1; m.line.y1 = m.ny1;
        m.line.x2 = m.nx2; m.line.y2 = m.ny2;
        updateLineLen(m.line);
      }
      for (let m of (entry.arcItems || [])) { m.arc.lx = m.nlx; m.arc.ly = m.nly; }
      redoStack.push(entry);
    } else if (entry.type === 'arcmove') {
      entry.item.lx = entry.nlx; entry.item.ly = entry.nly;
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
  selectedLine = null; selectedLines = [];
  selectedAngleLabel = null; selectedAngleLabels = [];
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
