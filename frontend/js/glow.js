/**
 * CollabForge — Ambient Cursor Glow Module
 * Tracks viewport mouse coordinates and applies linear interpolation (lerp)
 * to smoothly project crimson lighting onto background geometry and cards.
 */

(function initAmbientGlow() {
  const glow = document.getElementById('ambient-glow');
  if (!glow) return;

  // Initialize coordinates to viewport center
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;

  // Lerp smoothing weight (0.08 = fluid drag feel)
  const EASE_FACTOR = 0.08;

  window.addEventListener('mousemove', (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
  });

  function renderFrame() {
    // Linear interpolation step
    currentX += (targetX - currentX) * EASE_FACTOR;
    currentY += (targetY - currentY) * EASE_FACTOR;

    glow.style.left = `${currentX}px`;
    glow.style.top = `${currentY}px`;

    requestAnimationFrame(renderFrame);
  }

  requestAnimationFrame(renderFrame);
})();