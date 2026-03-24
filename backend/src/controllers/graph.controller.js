const { getFullGraph, getNodeWithNeighbors } = require("../services/graph.service");

const getGraph = (req, res, next) => {
  try {
    const data = getFullGraph();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const getNode = (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const data = getNodeWithNeighbors(decodeURIComponent(nodeId));
    if (!data) {
      return res.status(404).json({ success: false, error: "Node not found" });
    }
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = { getGraph, getNode };
