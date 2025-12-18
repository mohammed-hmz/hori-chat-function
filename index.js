const { Groq } = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

function validateToken(headers) {
  const authHeader = headers["authorization"] || headers["Authorization"];
  if (!authHeader) return { ok: false, error: "Missing Authorization header" };

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return { ok: false, error: "Invalid Authorization format" };

  if (parts[1] !== process.env.CHATBOT_TOKEN) return { ok: false, error: "Unauthorized" };

  return { ok: true };
}

module.exports = async function({ headers, body }) {
  try {
    const validation = validateToken(headers);
    if (!validation.ok) {
      return { status: 401, error: validation.error };
    }

    const { message, history = [] } = JSON.parse(body || "{}");

    if (!message) return { status: 400, error: "Message is required" };

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

    return { status: 200, reply };

  } catch (err) {
    console.error("Function error:", err);
    return { status: 500, error: "Internal server error" };
  }
};
