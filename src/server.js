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

const app = express();

const PORT = Number(process.env.PORT || 3000);
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || "";
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || "";
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || "";
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || "";
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

async function sendEmailViaEmailJS(payload) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_PRIVATE_KEY) {
    throw new Error("EmailJS environment variables are missing.");
  }

  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: payload
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`EmailJS request failed with status ${response.status}. ${errorText}`);
  }
}

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

    await sendEmailViaEmailJS({
      first_name: firstName.slice(0, 120),
      last_name: lastName.slice(0, 120),
      email,
      service: service.slice(0, 240),
      details: details.slice(0, 5000),
      submitted_at: new Date().toISOString(),
      source: "algofutrix.com"
    });

    console.log(`Successfully sent contact email for ${email}`);
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
