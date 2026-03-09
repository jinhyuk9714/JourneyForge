export const injectedRecorderSource = `(() => {
  if (window.__journeyforgeRecorderInstalled) return;
  window.__journeyforgeRecorderInstalled = true;

  const createId = () => (globalThis.crypto?.randomUUID?.() ?? \`evt-\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`);

  const cssPath = (element) => {
    if (!(element instanceof Element)) return 'body';
    const segments = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      const tag = current.tagName.toLowerCase();
      const id = current.getAttribute('id');
      if (id) {
        segments.unshift(\`#\${id}\`);
        break;
      }
      const className = [...current.classList].slice(0, 2).join('.');
      const siblingIndex = current.parentElement
        ? [...current.parentElement.children].filter((child) => child.tagName === current.tagName).indexOf(current) + 1
        : 1;
      segments.unshift(className ? \`\${tag}.\${className}:nth-of-type(\${siblingIndex})\` : \`\${tag}:nth-of-type(\${siblingIndex})\`);
      current = current.parentElement;
    }
    return segments.join(' > ');
  };

  const nearestLabel = (element) => {
    if (!(element instanceof HTMLElement)) return null;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      const explicitLabel = element.labels?.[0]?.textContent?.trim();
      if (explicitLabel) return explicitLabel;
    }
    const ariaLabel = element.getAttribute('aria-label')?.trim();
    if (ariaLabel) return ariaLabel;
    return null;
  };

  const buildLocator = (element) => {
    if (!(element instanceof HTMLElement)) {
      return { strategy: 'css', value: 'body' };
    }

    const label = nearestLabel(element);
    if (label) {
      return { strategy: 'label', value: label };
    }

    const placeholder = element.getAttribute('placeholder')?.trim();
    if (placeholder) {
      return { strategy: 'placeholder', value: placeholder };
    }

    const role = element.getAttribute('role')
      || (element.tagName === 'BUTTON' ? 'button' : null)
      || (element.tagName === 'A' ? 'link' : null)
      || ((element instanceof HTMLInputElement && ['button', 'submit'].includes(element.type)) ? 'button' : null);
    const text = (element.innerText || element.textContent || element.getAttribute('value') || '').trim().replace(/\\s+/g, ' ');

    if (role && text) {
      return { strategy: 'role', value: \`\${role}:\${text}\` };
    }

    if (text) {
      return { strategy: 'text', value: text };
    }

    return { strategy: 'css', value: cssPath(element) };
  };

  const emit = (event) => {
    window.__journeyforgeRecord?.({
      ...event,
      id: createId(),
      timestamp: Date.now(),
      pageUrl: location.href,
    });
  };

  document.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest('button, a, [role], input, textarea, select, *') : null;
    if (!target) return;
    emit({
      type: 'click',
      locator: buildLocator(target),
      text: (target.innerText || target.textContent || target.getAttribute('value') || '').trim() || undefined,
    });
  }, true);

  const inputHandler = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    const fieldName = target.name || target.id || target.getAttribute('aria-label') || target.getAttribute('placeholder') || target.type;
    emit({
      type: 'input',
      locator: buildLocator(target),
      value: target.value,
      masked: false,
      fieldName,
      inputType: target instanceof HTMLInputElement ? target.type : undefined,
    });
  };

  document.addEventListener('input', inputHandler, true);
  document.addEventListener('change', inputHandler, true);

  document.addEventListener('submit', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement)) return;
    emit({
      type: 'submit',
      locator: buildLocator(target),
    });
  }, true);

  const emitNavigation = (trigger) => {
    emit({
      type: 'navigation',
      targetUrl: location.href,
      trigger,
    });
  };

  const originalPushState = history.pushState;
  history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args);
    emitNavigation('history');
    return result;
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    emitNavigation('history');
    return result;
  };

  window.addEventListener('popstate', () => emitNavigation('history'));
  window.addEventListener('hashchange', () => emitNavigation('history'));
})();`;
