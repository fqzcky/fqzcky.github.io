/* Standalone Arc Cursor.
   Does not modify or replace the existing Target Cursor logic in script.js. */
(() => {
  const finePointer = window.matchMedia &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!finePointer) return;

  const cursor = document.querySelector('.arc-cursor');
  if (!cursor) return;

  const targetSelector = 'a, button, .project__row, [data-cursor-target]';
  let activeTarget = null;

  const getTarget = node => {
    if (!(node instanceof Element)) return null;
    const target = node.closest(targetSelector);
    if (!target || target.closest('#lanyard, .lanyard, canvas')) return null;
    return target;
  };

  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    cursor.style.left = event.clientX + 'px';
    cursor.style.top = event.clientY + 'px';
    cursor.classList.add('is-visible');
  }, { passive: true });

  document.addEventListener('pointerover', event => {
    const target = getTarget(event.target);
    if (!target || target === activeTarget) return;
    activeTarget = target;
    cursor.classList.add('is-over-target');
  }, { passive: true });

  document.addEventListener('pointerout', event => {
    if (!activeTarget) return;
    const nextTarget = getTarget(event.relatedTarget);
    if (nextTarget === activeTarget) return;
    activeTarget = nextTarget;
    cursor.classList.toggle('is-over-target', Boolean(activeTarget));
  }, { passive: true });

  document.addEventListener('focusin', event => {
    const target = getTarget(event.target);
    if (!target) return;
    activeTarget = target;
    cursor.classList.add('is-over-target');
  });

  document.addEventListener('focusout', event => {
    if (!activeTarget) return;
    const nextTarget = getTarget(event.relatedTarget);
    activeTarget = nextTarget;
    cursor.classList.toggle('is-over-target', Boolean(activeTarget));
  });

  window.addEventListener('blur', () => {
    cursor.classList.remove('is-visible');
  });
  window.addEventListener('focus', () => {
    if (activeTarget) cursor.classList.add('is-over-target');
  });
})();
