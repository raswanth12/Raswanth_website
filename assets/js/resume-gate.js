/* ============================================================
   RESUME GATE
   Collects name / company / email before releasing the PDF,
   validates the address without a round-trip, and posts the
   lead to a configurable endpoint.

   HONEST SCOPE: this is a static site. The gate raises the bar
   (no direct link in the DOM, unguessable filename, crawlers
   blocked) but a determined visitor with devtools can still
   reach the file. See backend/README.md for the serverless
   setup that makes the gate actually enforced.
   ============================================================ */
(() => {
  'use strict';

  /* ─────────── CONFIG ─────────── */
  const CONFIG = {
    // Where leads are sent. Leave blank and the gate still works —
    // it just won't record anything (a warning is logged).
    // See backend/README.md for setup.
    provider: 'apps-script',      // 'apps-script' | 'web3forms' | 'formspree' | 'formbricks'
    endpoint: '',                 // Apps Script /exec URL, Formspree URL, or Formbricks URL
    accessKey: '',                // Web3Forms only

    file:     'assets/doc/rcb-cdd12ae043f6b910.pdf',
    fileName: 'Raswanth-CB-Resume.pdf',

    rememberDays: 30,             // don't re-prompt a visitor who already registered
    minFillSeconds: 2.5           // faster than this = bot
  };

  const STORE_KEY = 'rcb.resume.access';

  /* ─────────── VALIDATION ─────────── */

  // Subset of the open-source disposable-email-domains list, trimmed to the
  // throwaway services that actually show up in form spam.
  const DISPOSABLE = new Set([
    'mailinator.com','guerrillamail.com','10minutemail.com','tempmail.com','temp-mail.org',
    'throwawaymail.com','yopmail.com','getnada.com','trashmail.com','sharklasers.com',
    'maildrop.cc','dispostable.com','fakeinbox.com','mailnesia.com','mytemp.email',
    'moakt.com','emailondeck.com','tempinbox.com','spamgourmet.com','mailcatch.com',
    'inboxbear.com','tempr.email','discard.email','mailde.de','1secmail.com',
    'burnermail.io','anonaddy.me','mozmail.com','simplelogin.io','duck.com'
  ]);

  const ROLE_ACCOUNTS = new Set([
    'info','admin','support','contact','sales','hello','noreply','no-reply',
    'postmaster','webmaster','office','team','help','service'
  ]);

  const EMAIL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

  function validateName(v) {
    const s = v.trim();
    if (!s) return 'Please enter your name.';
    if (s.length < 2) return 'That name looks too short.';
    if (!/[a-z]/i.test(s)) return 'Please enter your name in letters.';
    if (/^(.)\1+$/.test(s.replace(/\s/g, ''))) return 'Please enter your real name.';
    if (!/^[\p{L}\p{M}'.\- ]+$/u.test(s)) return 'Letters, spaces, hyphens and apostrophes only.';
    return '';
  }

  function validateCompany(v) {
    const s = v.trim();
    if (!s) return 'Please enter your company or organisation.';
    if (s.length < 2) return 'That company name looks too short.';
    if (/^(.)\1+$/.test(s.replace(/\s/g, ''))) return 'Please enter a real company name.';
    return '';
  }

  function validateEmail(v) {
    const s = v.trim().toLowerCase();
    if (!s) return 'Please enter your work or personal email.';
    if (!EMAIL_RE.test(s)) return 'That doesn’t look like a valid email address.';

    const [rawLocal, domain] = s.split('@');
    if (DISPOSABLE.has(domain)) return 'Please use a permanent address, not a temporary inbox.';

    // Gmail publishes concrete username rules — check them rather than
    // waving through anything ending in @gmail.com.
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      const local = rawLocal.split('+')[0];          // +tags are legal, ignore them
      if (!/^[a-z0-9.]+$/.test(local))
        return 'Gmail addresses only use letters, numbers and dots.';
      if (local.replace(/\./g, '').length < 6)
        return 'That isn’t a valid Gmail address — usernames are at least 6 characters.';
      if (local.length > 30)
        return 'That Gmail username is too long to be valid.';
      if (local.startsWith('.') || local.endsWith('.'))
        return 'Gmail usernames can’t start or end with a dot.';
      if (local.includes('..'))
        return 'Gmail usernames can’t contain two dots in a row.';
    }

    if (ROLE_ACCOUNTS.has(rawLocal.split('+')[0]))
      return 'Please use your own address rather than a shared inbox.';

    return '';
  }

  // Optional. Validated only when something was typed.
  function validatePhone(v) {
    const s = v.trim();
    if (!s) return '';
    const digits = s.replace(/[^\d]/g, '');
    if (!/^[+\d][\d\s().\-]*$/.test(s)) return 'Digits, spaces, +, - and brackets only.';
    if (digits.length < 7)  return 'That number looks too short.';
    if (digits.length > 15) return 'That number looks too long.';
    return '';
  }

  const VALIDATORS = {
    name: validateName,
    company: validateCompany,
    email: validateEmail,
    phone: validatePhone
  };

  /* ─────────── LEAD DELIVERY ─────────── */
  async function sendLead(data) {
    if (!CONFIG.endpoint && !CONFIG.accessKey) {
      console.warn('[resume-gate] No endpoint configured — lead not recorded. See backend/README.md');
      return { ok: true, recorded: false };
    }

    const payload = {
      ...data,
      page: location.href,
      referrer: document.referrer || 'direct',
      submittedAt: new Date().toISOString()
    };

    try {
      if (CONFIG.provider === 'apps-script') {
        // text/plain keeps this a "simple" request, so the browser skips the
        // preflight that Apps Script can't answer. The response is opaque,
        // so treat a completed POST as delivered.
        await fetch(CONFIG.endpoint, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        return { ok: true, recorded: true };
      }

      if (CONFIG.provider === 'web3forms') {
        const r = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ access_key: CONFIG.accessKey, subject: 'Resume download', ...payload })
        });
        return { ok: r.ok, recorded: r.ok };
      }

      // formspree / formbricks / any JSON endpoint
      const r = await fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      return { ok: r.ok, recorded: r.ok };

    } catch (err) {
      console.error('[resume-gate] lead delivery failed', err);
      return { ok: false, recorded: false };
    }
  }

  /* ─────────── FILE DELIVERY ─────────── */
  // Fetched as a blob so the real path never sits in the DOM as an href.
  async function deliverFile() {
    const res = await fetch(CONFIG.file, { cache: 'no-store' });
    if (!res.ok) throw new Error('Resume file not reachable (' + res.status + ')');

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = CONFIG.fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /* ─────────── ACCESS MEMORY ─────────── */
  function hasAccess() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const rec = JSON.parse(raw);
      const age = (Date.now() - rec.ts) / 86400000;
      return age < CONFIG.rememberDays;
    } catch { return false; }
  }

  function rememberAccess(email) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ ts: Date.now(), email })); }
    catch { /* private mode — just re-prompt next time */ }
  }

  /* ─────────── DIALOG ─────────── */
  const dialog   = document.getElementById('gate');
  const form     = document.getElementById('gateForm');
  if (!dialog || !form) return;

  const statusEl = document.getElementById('gateStatus');
  const submitBtn = document.getElementById('gateSubmit');
  const closeBtn = dialog.querySelector('.gate__close');
  const panel    = dialog.querySelector('.gate__panel');
  const fields   = ['name', 'company', 'email', 'phone']
    .map((n) => ({ name: n, input: form.elements[n], error: document.getElementById('err-' + n) }))
    .filter((f) => f.input);

  let lastTrigger = null;
  let openedAt = 0;
  let busy = false;

  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'gate__status' + (kind ? ' is-' + kind : '');
  }

  function showError(f, msg) {
    f.error.textContent = msg;
    f.input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    f.input.closest('.field').classList.toggle('has-error', !!msg);
  }

  function validateField(f) {
    const msg = VALIDATORS[f.name](f.input.value);
    showError(f, msg);
    return !msg;
  }

  function openGate(trigger) {
    lastTrigger = trigger || null;
    openedAt = Date.now();
    dialog.hidden = false;
    requestAnimationFrame(() => dialog.classList.add('is-open'));
    document.body.classList.add('is-locked');
    setStatus('');
    setTimeout(() => form.elements.name.focus(), 220);
  }

  function closeGate() {
    if (busy) return;
    dialog.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    setTimeout(() => { dialog.hidden = true; }, 350);
    if (lastTrigger) lastTrigger.focus();
  }

  // Any control that should hand over the resume
  function wireTriggers() {
    document.querySelectorAll('[data-resume]').forEach((el) => {
      el.addEventListener('click', async (e) => {
        e.preventDefault();
        if (hasAccess()) {
          try {
            setStatus('');
            await deliverFile();
          } catch (err) {
            console.error(err);
            openGate(el);              // fall back to the form if the file 404s
          }
          return;
        }
        openGate(el);
      });
    });
  }

  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeGate(); });
  closeBtn.addEventListener('click', closeGate);

  document.addEventListener('keydown', (e) => {
    if (dialog.hidden) return;
    if (e.key === 'Escape') { closeGate(); return; }
    if (e.key !== 'Tab') return;

    const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  fields.forEach((f) => {
    f.input.addEventListener('blur', () => { if (f.input.value.trim()) validateField(f); });
    f.input.addEventListener('input', () => {
      if (f.input.closest('.field').classList.contains('has-error')) validateField(f);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;

    // Honeypot — real people never see this field.
    if (form.elements.website && form.elements.website.value) return;

    // Nobody reads and fills four fields this fast.
    if ((Date.now() - openedAt) / 1000 < CONFIG.minFillSeconds) {
      setStatus('Please take a moment to complete the form.', 'error');
      return;
    }

    const allValid = fields.map(validateField).every(Boolean);
    if (!allValid) {
      setStatus('Please correct the highlighted fields.', 'error');
      const bad = fields.find((f) => f.input.closest('.field').classList.contains('has-error'));
      if (bad) bad.input.focus();
      return;
    }

    busy = true;
    submitBtn.disabled = true;
    submitBtn.dataset.label = submitBtn.textContent;
    submitBtn.textContent = 'Verifying…';
    setStatus('Checking your details…');

    const data = {
      name:    form.elements.name.value.trim(),
      company: form.elements.company.value.trim(),
      email:   form.elements.email.value.trim().toLowerCase(),
      phone:   form.elements.phone.value.trim()
    };

    const result = await sendLead(data);

    // A backend outage is my problem, not the visitor's — still hand over
    // the file, and log so the miss is visible.
    if (!result.ok) console.warn('[resume-gate] lead not recorded, delivering anyway');

    try {
      submitBtn.textContent = 'Downloading…';
      await deliverFile();
      rememberAccess(data.email);
      setStatus('Thanks, ' + data.name.split(' ')[0] + ' — your download has started.', 'ok');
      submitBtn.textContent = 'Downloaded ✓';
      setTimeout(closeGate, 1800);
    } catch (err) {
      console.error(err);
      setStatus('Something went wrong fetching the file. Email raswanthcb@gmail.com and I’ll send it directly.', 'error');
      submitBtn.textContent = submitBtn.dataset.label;
      submitBtn.disabled = false;
    } finally {
      busy = false;
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.label || 'Get the resume';
      }, 2000);
    }
  });

  wireTriggers();
})();
