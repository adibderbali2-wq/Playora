/* PLAYORA - contact form. There is no server: after checking the fields, the form opens
   the visitor's email app with the message filled in, addressed to the site's contact email. */
(() => {
  'use strict';
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;
  const to = form.dataset.email;
  const status = form.querySelector('[data-form-status]');
  const counter = form.querySelector('[data-count]');
  const fields = {
    name: { el: form.elements.name, check: (v) => (v.length < 2 ? 'Please enter your name (at least 2 characters).' : '') },
    email: { el: form.elements.email, check: (v) => (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? 'Please enter a valid email, like name@example.com.' : '') },
    message: { el: form.elements.message, check: (v) => (v.length < 10 ? 'Please write a little more (at least 10 characters).' : '') },
  };
  const clean = (s, max) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

  const validate = (key, touchedOnly) => {
    const f = fields[key];
    const msg = f.check(clean(f.el.value, 2000));
    const err = form.querySelector('#' + f.el.id + '-err');
    if (touchedOnly && !f.el.dataset.touched) return !msg;
    f.el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) f.el.setAttribute('aria-describedby', err.id); else f.el.removeAttribute('aria-describedby');
    err.textContent = msg;
    err.hidden = !msg;
    return !msg;
  };

  Object.keys(fields).forEach((k) => {
    const el = fields[k].el;
    el.addEventListener('blur', () => { if (el.value) el.dataset.touched = '1'; validate(k, true); });
    el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') validate(k); });
  });
  fields.message.el.addEventListener('input', () => { counter.textContent = fields.message.el.value.length; });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    Object.values(fields).forEach((f) => (f.el.dataset.touched = '1'));
    const ok = Object.keys(fields).map((k) => validate(k)).every(Boolean);
    if (!ok) {
      status.textContent = '';
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    const name = clean(fields.name.el.value, 80);
    const email = clean(fields.email.el.value, 120);
    const topic = clean(form.elements.topic.value, 60);
    const message = clean(fields.message.el.value, 2000);
    const subject = `[PLAYORA] ${topic} - ${name}`;
    const body = `${message}\n\n---\nFrom: ${name} <${email}>\nTopic: ${topic}`;
    window.location.href = `mailto:${encodeURIComponent(to).replace('%40', '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Your email app should open now with your message ready. If nothing happens, email us directly at ' + to + '.';
  });
})();
