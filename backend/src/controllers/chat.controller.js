const { chat } = require("../services/chat.service");

const sendMessage = async (req, res, next) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Message is required" });
    }

    const safeHistory = Array.isArray(history) ? history : [];

    const validatedHistory = safeHistory
      .filter(
        (h) =>
          h &&
          typeof h === "object" &&
          typeof h.content === "string" &&
          (h.role === "user" || h.role === "assistant")
      )
      .map((h) => ({ role: h.role, content: h.content }));

    const reply = await chat(message.trim(), validatedHistory);
    res.status(200).json({ success: true, data: { reply } });
  } catch (err) {
    next(err);
  }
};

module.exports = { sendMessage };
