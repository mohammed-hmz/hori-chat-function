const { Groq } = require("groq-sdk");
const fs = require("fs");
const path = require("path");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Load bot knowledge once at startup — lean version only
let BOT_KNOWLEDGE = "You are a helpful Horizon Club assistant.";
try {
  const configPath = path.join(__dirname, "horizon_chatbot_config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  // Only send SYSTEM_PROMPT + BOT_KNOWLEDGE (structured facts).
  // QA_PAIRS are intentionally excluded — they bloat the context.
  // The model infers answers from BOT_KNOWLEDGE instead.
  BOT_KNOWLEDGE = [
    config.SYSTEM_PROMPT,
    "",
    "## RESPONSE RULES",
    "- Keep replies short: 1–3 sentences for simple questions, 5 bullet points max for lists.",
    "- No filler openers (Sure!, Great question!, Of course!) and no closing remarks.",
    "- Answer directly. No preamble.",
    "- LINKS: Always write full URLs starting with https:// (e.g. https://horizonclub.dev/join). Never write bare domains without https://.",
    "- INTERNAL LINKS: URLs on horizonclub.dev are internal (e.g. https://horizonclub.dev/join, https://horizonclub.dev/contact). Always use the full https:// format so the frontend can render them correctly.",
    "- Never invent or guess any URLs, social media handles, or contact details not listed in your knowledge base.",
    "",
    config.BOT_KNOWLEDGE,
  ].join("\n");
} catch (e) {
  console.error("Failed to load horizon_chatbot_config.json:", e.message);
}

function validateToken(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return { ok: false, error: "Missing Authorization header" };
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return { ok: false, error: "Invalid Authorization format" };
  if (parts[1] !== process.env.CHATBOT_TOKEN) return { ok: false, error: "Unauthorized" };
  return { ok: true };
}

module.exports = async function (context) {
  const { req, res, error } = context;
  try {
    // 1. Validate
    const validation = validateToken(req);
    if (!validation.ok) return res.json({ error: validation.error }, 401);

    // 2. Extract
    const { message, history = [] } = req.body;
    if (!message) return res.json({ error: "Message is required" }, 400);

    // 3. Build messages — cap history to last 6 turns to avoid context bloat
    const trimmedHistory = history.slice(-6);

    const messages = [
      { role: "system", content: BOT_KNOWLEDGE },
      ...trimmedHistory.map((msg) => ({
        role: msg.type === "user" ? "user" : "assistant",
        content: msg.text,
      })),
      { role: "user", content: message },
    ];

    // 4. Call Groq with strict limits
    const completion = await groq.chat.completions.create({
      model: process.env.MODEL_NAME || "llama3-8b-8192",
      messages,
      max_tokens: 300,
      temperature: 0.5, // lower = faster + more factual, less creative rambling
    });

    const reply = completion.choices[0]?.message?.content || "";
    return res.json({ reply }, 200);

  } catch (err) {
    error("Detailed Error: " + err.stack);
    return res.json({ error: "Internal server error", message: err.message }, 500);
  }
};
