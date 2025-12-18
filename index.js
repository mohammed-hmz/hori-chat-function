const { Groq } = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

function validateToken(req) {
  // Appwrite headers are normalized to lowercase
  const authHeader = req.headers['authorization'];

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

module.exports = async function(context) {
  const { req, res, error } = context;

  try {
    // 1. Validation
    const validation = validateToken(req);
    if (!validation.ok) {
      return res.json({ error: validation.error }, 401);
    }

    // 2. Data Extraction
    // Note: Appwrite handles JSON parsing automatically for req.body
    const { message,
      //  userId,
       history = [] } = req.body;

    if (!message) {
      return res.json({ error: "Message is required" }, 400);
    }

    // 3. Groq AI logic
    const messages = [
      { type: "bot", text: process.env.BOT_KNOWLEDGE || "You are a helpful horizon club assistant." },
      ...history,
      { type: "user", text: message }
    ];

    const completion = await groq.chat.completions.create({
      model: process.env.MODEL_NAME || "llama3-8b-8192",
      messages
    });

    const reply = completion.choices[0]?.message?.content || "";

    // 4. Send response back to Next.js
    return res.json({ reply }, 200);

  } catch (err) {
    error("Detailed Error: " + err.stack);
    return res.json({ 
      error: "Internal server error", 
      message: err.message 
    }, 500);
  }
};