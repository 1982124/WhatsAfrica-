(() => {
  'use strict';
  const replacements = [
    [/WhatsAfrica/g, 'WASSAFRICA'],
    [/Whats Africa/g, 'WASSAFRICA'],
    [/WHATS AFRICA/g, 'WASSAFRICA']
  ];
  const normalize = value => replacements.reduce((out, [re, to]) => String(out ?? '').replace(re, to), value);

  const normalizeTextNodes = root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    for (const text of nodes) {
      if (text.parentElement && !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(text.parentElement.tagName)) {
        text.nodeValue = normalize(text.nodeValue);
      }
    }
  };

  const normalizeAttributes = () => {
    const attrs = ['title', 'aria-label', 'alt', 'placeholder'];
    for (const el of document.querySelectorAll('*')) {
      for (const attr of attrs) {
        if (el.hasAttribute(attr)) el.setAttribute(attr, normalize(el.getAttribute(attr)));
      }
    }
  };

  const normalizeMetadata = () => {
    document.title = normalize(document.title);
    for (const el of document.querySelectorAll('meta[content]')) {
      const key = `${el.getAttribute('name') || ''} ${el.getAttribute('property') || ''}`.toLowerCase();
      if (/description|title|site_name|image:alt/.test(key)) el.setAttribute('content', normalize(el.getAttribute('content')));
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
