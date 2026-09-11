(() => {
  'use strict';
  const replacements = [
    [/WhatsAfrica/g, 'WASSAFRICA'],
    [/Whats Africa/g, 'WASSAFRICA'],
    [/WHATS AFRICA/g, 'WASSAFRICA']
  ];
  const normalize = value => replacements.reduce((out, [re, to]) => String(out ?? '').replace(re, to), value);

  const normalizeTextNodes = root => {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    for (const text of nodes) {
      if (text.parentElement && !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(text.parentElement.tagName)) {
        const next = normalize(text.nodeValue);
        if (next !== text.nodeValue) text.nodeValue = next;
      }
    }
  };

  const normalizeAttributes = () => {
    const attrs = ['title', 'aria-label', 'alt', 'placeholder'];
    for (const el of document.querySelectorAll('*')) {
      for (const attr of attrs) {
        if (!el.hasAttribute(attr)) continue;
        const current = el.getAttribute(attr);
        const next = normalize(current);
        if (next !== current) el.setAttribute(attr, next);
      }
    }
  };

  const normalizeMetadata = () => {
    const nextTitle = normalize(document.title);
    if (nextTitle !== document.title) document.title = nextTitle;
    for (const el of document.querySelectorAll('meta[content]')) {
      const key = `${el.getAttribute('name') || ''} ${el.getAttribute('property') || ''}`.toLowerCase();
      if (!/description|title|site_name|image:alt/.test(key)) continue;
      const current = el.getAttribute('content');
      const next = normalize(current);
      if (next !== current) el.setAttribute('content', next);
    }
  };

  const run = () => {
    normalizeTextNodes(document.body);
    normalizeAttributes();
    normalizeMetadata();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();

  const observer = new MutationObserver(() => run());
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
