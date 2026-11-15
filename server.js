// server.js - clean working version for Gemini REST API
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Path helper
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Serve static files (index.html)
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Gemini endpoint
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// In-memory chat storage
const sessions = {};

// Convert chat history to Gemini "contents" format
function buildContent(history) {
  return history.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.text }],
  }));
}

// Health check route
app.get("/health", (req, res) => {
  res.send("ok");
});

// Root route (serves index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  const { sessionId = "default", message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (!GEMINI_API_KEY) {
    console.error("❌ ERROR: No GEMINI_API_KEY found in .env");
    return res.status(500).json({ error: "GEMINI_API_KEY not set" });
  }

  // Store conversation
  sessions[sessionId] = sessions[sessionId] || [];
  sessions[sessionId].push({ role: "user", text: message });

  const requestBody = {
    contents: buildContent(sessions[sessionId]),
  };

  try {
    const response = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Gemini error:", data);
      return res.status(response.status).json({ error: data });
    }

    // Extract assistant text
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response from model";

    // Save reply
    sessions[sessionId].push({ role: "assistant", text: reply });

    res.json({ reply });
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: "Internal server error", details: err });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`Model: ${MODEL}`);
  console.log(`GEMINI_API_KEY loaded?`, !!GEMINI_API_KEY);
});
