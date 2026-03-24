const express = require("express");
const router = express.Router();
const { healthCheck } = require("../controllers/health.controller");
const graphRoutes = require("./graph.routes");
const chatRoutes = require("./chat.routes");

router.get("/health", healthCheck);
router.use("/graph", graphRoutes);
router.use("/chat", chatRoutes);

module.exports = router;
