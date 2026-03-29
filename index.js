const { Groq } = require("groq-sdk");
const fs = require("fs");
const path = require("path");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Load bot knowledge from the JSON config file once at startup
let BOT_KNOWLEDGE = "You are a helpful Horizon Club assistant."; // fallback
try {
  const configPath = path.join(__dirname, "horizon_chatbot_config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  BOT_KNOWLEDGE = [
    config.SYSTEM_PROMPT,
    "",
    "## RESPONSE RULES",
    "- Keep every reply short: 1–3 sentences for simple questions, 5–6 lines max for lists.",
    "- Never repeat information already given in the conversation.",
    "- No filler phrases like 'Great question!', 'Sure!', 'Of course!', or 'Let me know if you need anything else.'",
    "- If the answer is a list, use at most 5 bullet points.",
    "- Answer directly. No preamble.",
    "- LINKS: Always write full URLs starting with https:// (e.g. https://horizonclub.dev/join). Never write bare domains without https://.",
    "",
    config.BOT_KNOWLEDGE,
    "",
    "## Q&A PAIRS",
    config.QA_PAIRS.map(
      (qa) => `Q: ${qa.question}\nA: ${qa.answer}`
    ).join("\n\n"),
  ].join("\n");
} catch (e) {
  console.error("Failed to load horizon_chatbot_config.json:", e.message);
}

function validateToken(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return { ok: false, error: "Missing Authorization header" };
  }
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return { ok: false, error: "Invalid Authorization format" };
  }
  if (parts[1] !== process.env.CHATBOT_TOKEN) {
    return { ok: false, error: "Unauthorized" };
  }
  return { ok: true };
}

module.exports = async function (context) {
  const { req, res, error } = context;
  try {
    // 1. Validation
    const validation = validateToken(req);
    if (!validation.ok) {
      return res.json({ error: validation.error }, 401);
    }

    // 2. Data Extraction
    const { message, history = [] } = req.body;
    if (!message) {
      return res.json({ error: "Message is required" }, 400);
    }

    // 3. Groq AI logic
    const messages = [
      {
        role: "system",
        content: BOT_KNOWLEDGE,
      },
      ...history.map((msg) => ({
        role: msg.type === "user" ? "user" : "assistant",
        content: msg.text,
      })),
      { role: "user", content: message },
    ];

    const completion = await groq.chat.completions.create({
      model: process.env.MODEL_NAME || "llama3-8b-8192",
      messages,
      max_tokens: 300,
    });

    const reply = completion.choices[0]?.message?.content || "";

    // 4. Send response
    return res.json({ reply }, 200);
  } catch (err) {
    error("Detailed Error: " + err.stack);
    return res.json({
      error: "Internal server error",
      message: err.message,
    }, 500);
  }
};
