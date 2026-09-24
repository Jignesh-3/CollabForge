/**
 * CollabForge — Loader Lifecycle Module
 * Handles dismissal timing, CSS transitions, and cleanup.
 */

function dismissLoader() {
  const loader = document.getElementById('loader-overlay');
  if (!loader) return;

  loader.classList.add('fade-out');

  // Remove element from DOM after CSS transition ends to free memory
  loader.addEventListener(
    'transitionend',
    () => {
      loader.remove();
    },
    { once: true }
  );
}

// Default fallback dismissal: trigger 900ms after DOM window loads
window.addEventListener('load', () => {
  setTimeout(dismissLoader, 900);
});