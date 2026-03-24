import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const fetchFullGraph = async () => {
  const res = await axios.get(`${API_BASE}/api/graph`);
  return res.data.data;
};

export const fetchNodeNeighbors = async (nodeId) => {
  const res = await axios.get(
    `${API_BASE}/api/graph/node/${encodeURIComponent(nodeId)}`
  );
  return res.data.data;
};

export const sendChatMessage = async (message, history = []) => {
  const res = await axios.post(`${API_BASE}/api/chat`, { message, history });
  return res.data.data.reply;
};
