const { chat } = require("../services/chat.service");

const sendMessage = async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Message is required" });
    }

    const reply = await chat(message.trim(), history);
    res.status(200).json({ success: true, data: { reply } });
  } catch (err) {
    next(err);
  }
};

module.exports = { sendMessage };
