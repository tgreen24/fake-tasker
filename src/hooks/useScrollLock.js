import { useEffect } from 'react';

// Holds the page still behind a dialog or sheet. Without it, scrolling past
// the end of the dialog's own list carries on into the page underneath.
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    const { body, documentElement: html } = document;
    const before = { body: body.style.overflow, html: html.style.overflow };
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    return () => {
      body.style.overflow = before.body;
      html.style.overflow = before.html;
    };
  }, [active]);
}
