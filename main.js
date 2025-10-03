// Download canvas image on 'd' key press
window.addEventListener('keydown', function(event) {
  if (event.key === 'd' || event.key === 'D') {
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'drawing.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});

const canvas = document.getElementById('fish');
const ctx = canvas.getContext('2d');
// Brush / eraser configuration
let brushSize = 8;
let isEraser = false;
ctx.lineWidth = brushSize;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
ctx.strokeStyle = '#000';

function updateDrawingMode() {
  // When eraser is active we use destination-out which makes drawn pixels transparent
  ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
  ctx.lineWidth = brushSize;
  // strokeStyle is irrelevant in destination-out but keep it set for source-over
  ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : '#000';
  updateCursor();
}
updateDrawingMode();

// Create a circular cursor image that reflects the brush size and mode
function createCursorDataURL(size, isEraser) {
  // Ensure a minimum visual size and some padding so the circle isn't clipped
  const padding = 8;
  const diameter = Math.max(16, Math.round(size) + padding);
  const c = document.createElement('canvas');
  c.width = diameter;
  c.height = diameter;
  const cx = c.getContext('2d');
  cx.clearRect(0, 0, diameter, diameter);

  const center = diameter / 2;
  const radius = Math.max(1, size / 2);

  // Draw outer ring for contrast
  cx.beginPath();
  cx.arc(center, center, radius, 0, Math.PI * 2);
  cx.lineWidth = Math.max(2, Math.round(radius / 4));
  if (isEraser) {
    // Eraser: hollow circle with dark stroke
    cx.strokeStyle = 'rgba(0,0,0,0.85)';
    cx.stroke();
  } else {
    // Brush: filled circle with subtle border
    cx.fillStyle = 'rgba(0,0,0,0.85)';
    cx.fill();
    cx.strokeStyle = 'rgba(255,255,255,0.6)';
    cx.stroke();
  }

  return c.toDataURL('image/png');
}

function updateCursor() {
  try {
    const dataURL = createCursorDataURL(brushSize, isEraser);
    const diameter = (new Image()).width; // not used; we'll compute hotspot below
    // compute hotspot at canvas center
    const temp = document.createElement('canvas');
    const pad = 8;
    const d = Math.max(16, Math.round(brushSize) + pad);
    const hotspot = Math.floor(d / 2);
    canvas.style.cursor = `url(${dataURL}) ${hotspot} ${hotspot}, auto`;
  } catch (err) {
    // Fallback cursor
    canvas.style.cursor = 'crosshair';
  }
}
let drawing = false;
let lastX = 0, lastY = 0;
let lastMidX = 0, lastMidY = 0;
// Undo/Redo stacks (store ImageData)
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 50;

function pushState() {
  try {
    // Save current canvas state
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStack.push(snap);
    // cap history
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    // new action clears redo
    redoStack.length = 0;
  } catch (err) {
    // getImageData can throw if canvas size is zero or tainted; ignore
    console.warn('pushState failed', err);
  }
}

function undo() {
  if (undoStack.length === 0) return;
  try {
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const prev = undoStack.pop();
    // push current into redo
    redoStack.push(current);
    ctx.putImageData(prev, 0, 0);
  } catch (err) {
    console.warn('undo failed', err);
  }
}

function redo() {
  if (redoStack.length === 0) return;
  try {
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const next = redoStack.pop();
    undoStack.push(current);
    ctx.putImageData(next, 0, 0);
  } catch (err) {
    console.warn('redo failed', err);
  }
}

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

// Stamp a circular brush at x,y. Respects current globalCompositeOperation and brushSize.
function stampBrush(x, y) {
  ctx.beginPath();
  if (!isEraser) ctx.fillStyle = ctx.strokeStyle;
  else ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
  ctx.fill();
}

// Stamp along a quadratic Bezier curve defined by p0 (x0,y0), control (cx,cy), and p1 (x1,y1)
function stampAlongQuadratic(x0, y0, cx, cy, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const step = Math.max(1, Math.floor(brushSize * 0.35));
  const samples = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    const bx = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
    const by = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
    stampBrush(bx, by);
  }
}

// Mouse events
canvas.addEventListener('mousedown', function(e) {
  drawing = true;
  pushState();
  const { x, y } = getCanvasCoords(e);
  lastX = x;
  lastY = y;
  lastMidX = x;
  lastMidY = y;
  ctx.beginPath();
  ctx.moveTo(x, y);
});

canvas.addEventListener('mousemove', function(e) {
  if (!drawing) return;
  const { x, y } = getCanvasCoords(e);
  const midX = (lastX + x) / 2;
  const midY = (lastY + y) / 2;
  // Stamp along the quadratic curve (prevents straight-line artifacts when moving fast)
  stampAlongQuadratic(lastMidX, lastMidY, lastX, lastY, midX, midY);
  // Now stroke the smoothed curve on top
  ctx.beginPath();
  ctx.moveTo(lastMidX, lastMidY);
  ctx.quadraticCurveTo(lastX, lastY, midX, midY);
  ctx.stroke();
  lastX = x;
  lastY = y;
  lastMidX = midX;
  lastMidY = midY;
});

canvas.addEventListener('mouseup', function(e) {
  drawing = false;
});
canvas.addEventListener('mouseleave', function(e) {
  drawing = false;
});

// Touch events
canvas.addEventListener('touchstart', function(e) {
  if (e.touches.length > 0) {
    pushState();
    drawing = true;
    const touch = e.touches[0];
    const { x, y } = getCanvasCoords(touch);
    lastX = x;
    lastY = y;
    lastMidX = x;
    lastMidY = y;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
});

canvas.addEventListener('touchmove', function(e) {
  if (!drawing || e.touches.length === 0) return;
  e.preventDefault();
  const touch = e.touches[0];
  const { x, y } = getCanvasCoords(touch);
  const midX = (lastX + x) / 2;
  const midY = (lastY + y) / 2;
  // Stamp along the quadratic curve for touch as well
  stampAlongQuadratic(lastMidX, lastMidY, lastX, lastY, midX, midY);
  // Stroke the smoothed curve after stamping
  ctx.beginPath();
  ctx.moveTo(lastMidX, lastMidY);
  ctx.quadraticCurveTo(lastX, lastY, midX, midY);
  ctx.stroke();
  lastX = x;
  lastY = y;
  lastMidX = midX;
  lastMidY = midY;
});

canvas.addEventListener('touchend', function(e) {
  drawing = false;
});

function resizeCanvas() {
  // Save current content
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // Resize canvas (this clears the content)
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Restore content (only if dimensions didn't shrink; otherwise, part of the image may be lost)
  ctx.putImageData(imageData, 0, 0);
  // Clear undo/redo history because ImageData sizes changed
  undoStack.length = 0;
  redoStack.length = 0;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Keyboard controls: 'e' toggles eraser, '[' and ']' change brush size
window.addEventListener('keydown', function(event) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  if (event.key === 'e' || event.key === 'E') {
    isEraser = !isEraser;
    updateDrawingMode();
    console.log('Eraser:', isEraser);
  }
  if (event.key === '[') {
    brushSize = Math.max(1, brushSize - 1);
    updateDrawingMode();
    console.log('Brush size:', brushSize);
  }
  if (event.key === ']') {
    brushSize = Math.min(200, brushSize + 1);
    updateDrawingMode();
    console.log('Brush size:', brushSize);
  }
  // Undo / Redo: Ctrl/Cmd+Z (Shift for redo), Ctrl/Cmd+Y for redo
  if ((event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'Z')) {
    event.preventDefault();
    if (event.shiftKey) redo(); else undo();
  }
  if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || event.key === 'Y')) {
    event.preventDefault();
    redo();
  }
});
