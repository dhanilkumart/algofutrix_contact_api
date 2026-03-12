// --- ABSOLUTE START WORKAROUND FOR HOSTINGER/PASSENGER EEXIST ERROR ---
// This MUST be the first thing in the file. Some environments (Hostinger/Passenger) 
// crash when process.stdin is accessed. We replace the getter with a dummy stream.
try {
  const { Readable } = require('stream');
  const dummyStdin = new Readable();
  dummyStdin._read = () => {};
  dummyStdin.isTTY = false;
  Object.defineProperty(process, 'stdin', {
    value: dummyStdin,
    configurable: true,
    writable: true
  });
} catch (e) {
  // If we can't even require 'stream' or defineProperty, we try a simpler stub
  try {
    Object.defineProperty(process, 'stdin', {
      value: { on: () => {}, resume: () => {}, pause: () => {}, isTTY: false },
      configurable: true,
      writable: true
    });
  } catch (e2) {
    console.warn("[Workaround] Failed to stub process.stdin:", e2.message);
  }
}
// --- END WORKAROUND ---

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const admin = require("firebase-admin");
const fs = require('fs');
const path = require('path');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const COLLECTION = process.env.FIRESTORE_COLLECTION || "contact_submissions";
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

async function verifyTurnstile(token, remoteIp) {
  if (!TURNSTILE_SECRET_KEY) {
    throw new Error("TURNSTILE_SECRET_KEY is missing.");
  }
  const payload = new URLSearchParams({
    secret: TURNSTILE_SECRET_KEY,
    response: token,
    remoteip: remoteIp || ""
  });
  const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: payload.toString()
  });
  if (!verifyResponse.ok) {
    return { success: false };
  }
  return verifyResponse.json();
}

function initFirebase() {
  if (admin.apps.length) return admin.app();

  let credentials = null;
  const keyParts = [
    process.env.FIREBASE_KEY_PART_1,
    process.env.FIREBASE_KEY_PART_2,
    process.env.FIREBASE_KEY_PART_3,
    process.env.FIREBASE_KEY_PART_4
  ].filter(Boolean);

  function parseServiceAccount(value) {
    const input = String(value || "").trim();
    if (!input) return null;
    if (input.startsWith("{")) {
      return JSON.parse(input);
    }
    const decoded = Buffer.from(input, "base64").toString("utf8");
    return JSON.parse(decoded);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    credentials = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else if (keyParts.length >= 2) {
    const merged = keyParts.join("");
    credentials = parseServiceAccount(merged);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    credentials = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64);
  } else {
    // Try to load from root service-account.json if it exists
    try {
      const saPath = path.join(process.cwd(), 'service-account.json');
      if (fs.existsSync(saPath)) {
        credentials = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      }
    } catch (e) {
      console.warn("Could not load service-account.json from disk:", e.message);
    }
  }

  if (credentials) {
    return admin.initializeApp({
      credential: admin.credential.cert(credentials)
    });
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

initFirebase();
const db = admin.firestore();

app.use(helmet());
app.use(express.json({ limit: "32kb" }));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (CORS_ORIGINS.length === 0) return callback(null, true);
      if (CORS_ORIGINS.includes("*")) return callback(null, true);
      if (CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    }
  })
);

app.get("/health", (_, res) => {
  res.status(200).json({ ok: true });
});

app.post("/api/contact", async (req, res) => {
  try {
    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const email = String(req.body.email || "").trim();
    const service = String(req.body.service || "").trim();
    const details = String(req.body.details || "").trim();
    const captchaToken = String(req.body.captchaToken || "").trim();

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }
    if (!captchaToken) {
      return res.status(400).json({ error: "Captcha is required." });
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    const captchaResult = await verifyTurnstile(captchaToken, req.ip);
    if (!captchaResult.success) {
      return res.status(400).json({ error: "Captcha verification failed." });
    }

    await db.collection(COLLECTION).add({
      email,
      firstName: firstName.slice(0, 120),
      lastName: lastName.slice(0, 120),
      service: service.slice(0, 240),
      details: details.slice(0, 5000),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "website"
    });

    console.log(`Successfully saved contact from ${email}`);
    return res.status(201).json({ ok: true, message: "Submitted successfully." });
  } catch (error) {
    console.error("Contact submission failed:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.use((err, req, res, _next) => {
  console.error("Global error handler caught:", err);
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS blocked this origin." });
  }
  return res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Contact API listening on port ${PORT}`);
});
