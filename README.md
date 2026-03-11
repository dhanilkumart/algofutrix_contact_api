# AlgoFutrix Contact API Module

This module receives contact form submissions from your website and stores them in Firestore using Firebase Admin SDK.

## 1) Install

```bash
cd api-module
npm install
```

## 2) Configure environment

Copy `.env.example` to `.env` and fill values:

- `PORT=3000`
- `CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com`
- `FIRESTORE_COLLECTION=contact_submissions`
- Firebase credentials using one of:
  - `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string), or
  - `FIREBASE_KEY_PART_1` ... `FIREBASE_KEY_PART_4` (split JSON string, use 2-4 parts), or
  - `FIREBASE_SERVICE_ACCOUNT_BASE64` (base64 JSON), or
  - `GOOGLE_APPLICATION_CREDENTIALS` path

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
  "details": "Need a quotation"
}
```

## 4) Frontend connection

In `index.html`, set:

```js
const CONTACT_API_URL = 'https://api.yourdomain.com/api/contact';
```

Replace `api.yourdomain.com` with your deployed API URL.

## Hostinger notes

- Keep website files in `public_html`.
- Deploy only `api-module` as the Node app.
- Set environment variables in Hostinger panel for the Node app.
- Make sure your domain/subdomain points to the Node app and uses HTTPS.
