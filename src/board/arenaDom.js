// CSS3D temporarily reparents the live SVG. React can remove its former next
// sibling before effect cleanup, so restoration must tolerate that removal.
export function preserveTacticalLayer(element) {
  const parent = element.parentNode;
  const next = element.nextSibling;
  const style = element.getAttribute('style');
  return () => {
    parent.insertBefore(element, next?.parentNode === parent ? next : null);
    if (style == null) element.removeAttribute('style');
    else element.setAttribute('style', style);
  };
}

// OrbitControls captures even an unassigned LEFT pointer. Intercept pointerdown
// before that happens; the subsequent click still bubbles to React normally.
export function keepGameplayClicks(element) {
  const handler = event => {
    if (event.pointerType !== 'mouse' || event.button === 0) event.stopImmediatePropagation();
  };
  element.addEventListener('pointerdown', handler, true);
  return () => element.removeEventListener('pointerdown', handler, true);
}
