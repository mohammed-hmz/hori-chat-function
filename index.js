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

module.exports = async function(req, res) {
  try {
    const validation = validateToken(req);
    if (!validation.ok) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: validation.error }));
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Method not allowed" }));
    }

    const body = JSON.parse(req.body || "{}");
    const { message, history = [] } = body;

    if (!message) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Message is required" }));
    }

    const messages = [
      { role: "system", content: process.env.BOT_KNOWLEDGE },
      ...history.slice(-6),
      { role: "user", content: message }
    ];

    const completion = await groq.chat.completions.create({
      model: process.env.MODEL_NAME,
      messages
    });

    const reply = completion.choices[0]?.message?.content || "";

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ reply }));

  } catch (err) {
    console.error("Function error:", err);  // logs appear in Appwrite console
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
};
