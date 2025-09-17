
const canvas = document.getElementById('fish');
const ctx = canvas.getContext('2d');
let drawing = false;
let lastX = 0, lastY = 0;
let lastMidX = 0, lastMidY = 0;

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

// Mouse events
canvas.addEventListener('mousedown', function(e) {
  drawing = true;
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
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

