import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async ({ req, res }) => {
  try {
    const { message, history = [] } = JSON.parse(req.body);

    const messages = [
      { role: "system", content: process.env.BOT_KNOWLEDGE },
      ...history,
      { role: "user", content: message }
    ];

    const completion = await groq.chat.completions.create({
      model: process.env.MODEL_NAME,
      messages
    });

    return res.json({
      reply: completion.choices[0].message.content
    });

  } catch (err) {
    return res.json({ error: "Internal error" }, 500);
  }
};
