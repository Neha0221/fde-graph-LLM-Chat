const { getHealthStatus } = require("../services/health.service");

const healthCheck = (req, res) => {
  const data = getHealthStatus();
  res.status(200).json({ success: true, data });
};

module.exports = { healthCheck };
