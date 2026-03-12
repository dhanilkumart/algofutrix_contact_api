# AlgoFutrix Contact API Module

This module receives contact form submissions from your website, verifies Cloudflare Turnstile, and sends email through EmailJS.

## 1) Install

```bash
cd algofutrix_contact_api
npm install
```

## 2) Configure environment

Copy `.env.example` to `.env` and fill values:

- `PORT=3000`
- `CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com`
- `TURNSTILE_SECRET_KEY=<your_cloudflare_turnstile_secret>`
- `EMAILJS_SERVICE_ID=<your_emailjs_service_id>`
- `EMAILJS_TEMPLATE_ID=<your_emailjs_template_id>`
- `EMAILJS_PUBLIC_KEY=<your_emailjs_public_key>`
- `EMAILJS_PRIVATE_KEY=<your_emailjs_private_key>`

## 3) Run

```bash
npm start
```

Health check:

```bash
GET /health
```

Contact endpoint:

```bash
POST /api/contact
Content-Type: application/json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "service": "Web Application Development",
  "details": "Need a quotation",
  "captchaToken": "turnstile_token_here"
}
```

## 4) Frontend connection

In `index.html`, set:

```js
const CONTACT_API_URL = 'https://api.yourdomain.com/api/contact';
```

Replace `api.yourdomain.com` with your deployed API URL.

Also set a site key in frontend before `main.js` loads:

```html
<script>
  window.CAPTCHA_SITE_KEY = 'your_cloudflare_turnstile_site_key';
</script>
```

## Hostinger notes

- Keep website files in `public_html`.
- Deploy only `algofutrix_contact_api` as the Node app.
- Set environment variables in Hostinger panel for the Node app.
- Make sure your domain/subdomain points to the Node app and uses HTTPS.
