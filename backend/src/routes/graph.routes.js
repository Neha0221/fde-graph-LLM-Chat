const express = require("express");
const router = express.Router();
const { getGraph, getNode } = require("../controllers/graph.controller");

router.get("/", getGraph);
router.get("/node/:nodeId", getNode);

module.exports = router;
