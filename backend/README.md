# Resume gate — setup

The download form works right now. It validates, blocks bots, and hands over
the PDF. It just doesn't **record** anything until you connect one of the
options below (a warning is logged to the console until then).

All config lives at the top of [`assets/js/resume-gate.js`](../assets/js/resume-gate.js).

---

## What the gate actually does

**Enforced client-side:**

| Check | Behaviour |
|---|---|
| Name | ≥2 chars, letters only, rejects `aaaa` style filler |
| Company | ≥2 chars, rejects repeated-character filler |
| Email | RFC-shaped, **real Gmail username rules** (6–30 chars, letters/digits/dots, no leading/trailing/double dots, `+tags` allowed) |
| Disposable domains | ~30 throwaway providers blocked (mailinator, 10minutemail, yopmail, …) |
| Role accounts | `info@`, `admin@`, `sales@` etc. rejected — I want a person |
| Phone | Optional; if filled, must be 7–15 digits |
| Honeypot | Hidden `website` field; if filled, submission is dropped |
| Time trap | Submitting in under 2.5s is treated as a bot |

**Deliberately not done:** no confirmation email, no OTP, no CAPTCHA. You asked
for a filter, not a checkpoint — a real recruiter gets the PDF in one click.

### The honest limitation — read this

This is a static site on GitHub Pages, so the gate is **enforced by the page,
not by the server**. Mitigations in place:

- No direct link to the PDF anywhere in the HTML
- Filename is randomised — not guessable by crawling or URL guessing
- `robots.txt` blocks `/assets/doc/` and `/backend/` from indexing
- The file is fetched as a blob, so the path never appears as an `href`

**These stop crawlers, scrapers and casual snooping. They do not stop a
determined person.** Two ways around them:

1. Open the Network tab during a download and read the real URL.
2. **This repository is public** — anyone can browse it on GitHub and see the
   PDF sitting in `assets/doc/`, whatever it's named.

So today the gate is a *filter*, not a *lock*. That is genuinely fine for the
job it's doing: it captures the recruiters who would have downloaded anyway,
and it stops bulk scraping. But don't believe the file is protected.

**If you want it actually protected, do both of these:**

- Make the repo private and publish only the built site, **or** delete the PDF
  from the repo entirely; and
- Move delivery behind **Option D** below.

Until then, treat anything in this repo as public.

---

## Option A — Google Sheet (recommended)

Free, no third-party service, no signup, and the data sits in your own Drive.

1. Create a new Google Sheet ("Resume leads").
2. **Extensions → Apps Script**.
3. Delete the placeholder and paste all of [`google-apps-script.gs`](./google-apps-script.gs).
4. **Deploy → New deployment → Web app**
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
5. Authorise when prompted. Copy the `/exec` URL.
6. In `assets/js/resume-gate.js`:

```js
provider: 'apps-script',
endpoint: 'https://script.google.com/macros/s/AKfy..../exec',
```

Each download appends a row and emails you. To stop the emails, set
`NOTIFY_EMAIL = ''` in the script.

> The browser posts as `text/plain` to avoid a CORS preflight Apps Script can't
> answer, so the response is opaque — a completed POST is treated as delivered.
> Confirm it's working by opening the `/exec` URL directly (returns JSON) and
> watching the sheet.

---

## Option B — Formbricks (open source, self-hostable)

<https://github.com/formbricks/formbricks> — AGPL-3.0. Self-host with Docker, or
use their cloud.

Create a survey with `name` / `company` / `email` / `phone` fields, then:

```js
provider: 'formbricks',
endpoint: 'https://your-formbricks-host/api/v1/client/<envId>/responses',
```

Best pick if you want to own the whole stack and get dashboards for free.

---

## Option C — Web3Forms / Formspree

Fastest to wire up. Free tiers are fine at portfolio volume.

```js
// Web3Forms — https://web3forms.com (paste the key from your email)
provider: 'web3forms',
accessKey: 'your-access-key-here',
```

```js
// Formspree — https://formspree.io
provider: 'formspree',
endpoint: 'https://formspree.io/f/xxxxxxxx',
```

---

## Option D — Cloudflare Worker (actually enforced)

The only option where the PDF cannot be reached without submitting the form.
Free tier covers this comfortably.

Move the PDF **out** of the repo into R2 (or embed it as base64 in the Worker),
then have the Worker validate the payload and stream the file back:

```js
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const { name, company, email } = await request.json();
    if (!name || !company || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email))
      return new Response('Invalid', { status: 400 });

    await env.LEADS.put(`${Date.now()}-${email}`, JSON.stringify({ name, company, email }));

    const file = await env.RESUME_BUCKET.get('resume.pdf');
    return new Response(file.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Raswanth-CB-Resume.pdf"',
        'Access-Control-Allow-Origin': 'https://raswanth12.github.io'
      }
    });
  }
};
```

Then point the gate at the Worker and delete the PDF from this repo — the file
only ever leaves Cloudflare after a valid submission.

---

## Testing locally

The gate remembers a visitor for 30 days. To re-trigger the form:

```js
localStorage.removeItem('rcb.resume.access')
```
