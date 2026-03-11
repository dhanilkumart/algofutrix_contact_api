require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const admin = require("firebase-admin");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const COLLECTION = process.env.FIRESTORE_COLLECTION || "contact_submissions";
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

function initFirebase() {
  if (admin.apps.length) return admin.app();

  let credentials = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else if (process.env.FIREBASE_KEY_PART_1 && process.env.FIREBASE_KEY_PART_2) {
    const merged = `${process.env.FIREBASE_KEY_PART_1}${process.env.FIREBASE_KEY_PART_2}`;
    credentials = JSON.parse(merged);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
    credentials = JSON.parse(decoded);
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

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return res.status(400).json({ error: "Invalid email format." });
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

    return res.status(201).json({ ok: true, message: "Submitted successfully." });
  } catch (error) {
    console.error("Contact submission failed:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.use((err, _req, res, _next) => {
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS blocked this origin." });
  }
  return res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Contact API listening on port ${PORT}`);
});
