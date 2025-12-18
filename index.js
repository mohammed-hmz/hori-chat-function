import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

function validateToken(req) {
  const authHeader =
    req.headers.authorization || req.headers.Authorization;

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

export default async ({ req, res }) => {
  try {
    // 🔐 Validate token
    const validation = validateToken(req);
    if (!validation.ok) {
      return res.json({ error: validation.error }, 401);
    }

    if (req.method !== "POST") {
      return res.json({ error: "Method not allowed" }, 405);
    }

    const body = JSON.parse(req.body || "{}");
    const { message, history = [] } = body;

    if (!message) {
      return res.json({ error: "Message is required" }, 400);
    }

    const messages = [
      { role: "system", content: process.env.BOT_KNOWLEDGE },
      ...history.slice(-6), // keep memory short
      { role: "user", content: message }
    ];

    const completion = await groq.chat.completions.create({
      model: process.env.MODEL_NAME,
      messages
    });

    const reply =
      completion.choices[0]?.message?.content || "";

    return res.json({ reply });

  } catch (err) {
    return res.json({ error: "Internal server error" }, 500);
  }
};
