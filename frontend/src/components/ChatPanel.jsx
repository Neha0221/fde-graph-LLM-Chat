import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendChatMessage } from '../api/graphApi';

const INITIAL_MESSAGES = [
  {
    id: 1,
    sender: 'ai',
    text: 'Hi! I can help you analyze the Order to Cash process.',
  },
];

const DodgeIcon = () => (
  <div className="chat-ai-avatar">
    <span>D</span>
  </div>
);

const TypingIndicator = () => (
  <div className="chat-msg-row ai">
    <DodgeIcon />
    <div className="chat-bubble ai">
      <p className="chat-bubble-meta">
        Dodge AI <span className="chat-bubble-role">Graph Agent</span>
      </p>
      <div className="chat-typing">
        <span /><span /><span />
      </div>
    </div>
  </div>
);

const ChatPanel = () => {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Build history array for API (exclude initial greeting)
  const buildHistory = (msgs) =>
    msgs
      .filter((m) => m.id !== 1)
      .map((m) => ({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: m.text,
      }));

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg = { id: Date.now(), sender: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = buildHistory([...messages, userMsg]);
      const reply = await sendChatMessage(text, history);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: 'ai', text: reply },
      ]);
    } catch (err) {
      const errText =
        err?.response?.data?.error ||
        err?.message ||
        'Something went wrong. Please try again.';
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: 'ai', text: `⚠ ${errText}`, isError: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <DodgeIcon />
        <div className="chat-header-text">
          <p className="chat-header-title">Chat with Graph</p>
          <p className="chat-header-sub">Order to Cash</p>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg-row ${msg.sender}`}>
            {msg.sender === 'ai' && <DodgeIcon />}
            <div className={`chat-bubble ${msg.sender}${msg.isError ? ' error' : ''}`}>
              {msg.sender === 'ai' && (
                <p className="chat-bubble-meta">
                  Dodge AI <span className="chat-bubble-role">Graph Agent</span>
                </p>
              )}
              {msg.sender === 'ai' ? (
                <div className="chat-bubble-text chat-markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.text}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="chat-bubble-text">{msg.text}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        <div className="chat-status-bar">
          <span className={`chat-status-dot ${isLoading ? 'thinking' : ''}`} />
          <span className="chat-status-text">
            {isLoading ? 'Dodge AI is thinking…' : 'Dodge AI is awaiting instructions'}
          </span>
        </div>
        <div className="chat-input-row">
          <input
            className="chat-input"
            placeholder="Analyze anything"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
