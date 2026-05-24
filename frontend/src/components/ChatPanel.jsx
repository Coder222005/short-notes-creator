import React, { useState, useRef, useEffect } from 'react';

// Lightweight custom Markdown parser
export function MarkdownRenderer({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  let elements = [];
  let listItems = [];
  let inList = false;
  let inCodeBlock = false;
  let codeContent = [];
  let codeLang = '';

  const parseInlineMarkdown = (inputText) => {
    const parts = [];
    let currentIndex = 0;
    const regex = /(\*\*.*?\*\*|`.*?`)/g;
    let match;
    
    while ((match = regex.exec(inputText)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > currentIndex) {
        parts.push(inputText.substring(currentIndex, matchIndex));
      }
      
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(<strong key={matchIndex}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(<code key={matchIndex}>{token.slice(1, -1)}</code>);
      }
      
      currentIndex = regex.lastIndex;
    }
    
    if (currentIndex < inputText.length) {
      parts.push(inputText.substring(currentIndex));
    }
    
    return parts.length > 0 ? parts : inputText;
  };

  lines.forEach((line, index) => {
    // Handle code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`pre-${index}`}>
            <code className={codeLang}>{codeContent.join('\n')}</code>
          </pre>
        );
        codeContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.trim().replace('```', '').trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      return;
    }

    // Handle lists (support * and -)
    const listMatch = line.match(/^(\s*)[\*\-]\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        inList = true;
      }
      listItems.push(<li key={`li-${index}`}>{parseInlineMarkdown(listMatch[2])}</li>);
      return;
    } else {
      if (inList) {
        elements.push(<ul key={`ul-${index}`}>{listItems}</ul>);
        listItems = [];
        inList = false;
      }
    }

    // Handle headers
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = parseInlineMarkdown(headerMatch[2]);
      const Tag = `h${level}`;
      elements.push(<Tag key={`h-${index}`}>{content}</Tag>);
      return;
    }

    // Blank line
    if (line.trim() === '') {
      return;
    }

    // Regular paragraph
    elements.push(<p key={`p-${index}`}>{parseInlineMarkdown(line)}</p>);
  });

  // Flush remaining elements
  if (inList) {
    elements.push(<ul key="ul-final">{listItems}</ul>);
  }
  if (inCodeBlock) {
    elements.push(
      <pre key="pre-final">
        <code>{codeContent.join('\n')}</code>
      </pre>
    );
  }

  return <div className="notes-markdown-view">{elements}</div>;
}

export default function ChatPanel({
  chatHistory,
  onSendMessage,
  isLoading,
  notebookName,
  llmConfig
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading]);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (input.trim() === '' || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePromptCardClick = (promptText) => {
    setInput(promptText);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const studyPrompts = [
    {
      title: "Cell division basics",
      description: "Analyze mitosis and meiosis differences, listing stages.",
      text: "Explain the differences between mitosis and meiosis cell division. Create a structured outline of their stages and main features."
    },
    {
      title: "Newton's laws of motion",
      description: "Summarize the 3 laws of motion with formulas.",
      text: "Summarize Newton's three laws of motion. Provide the core formulas and a short real-world example of each."
    },
    {
      title: "SQL vs NoSQL databases",
      description: "Compare SQL and NoSQL architectural differences.",
      text: "Compare SQL relational databases and NoSQL document databases. Summarize when to use each, query syntax difference, and horizontal vs vertical scaling."
    }
  ];

  return (
    <div className="chat-panel">
      {chatHistory.length === 0 ? (
        <div className="welcome-container">
          <div className="welcome-gradient-text">Hello Student</div>
          <div className="welcome-subtext">
            Give me the topics you're studying. I will explain them and automatically compile your important notes for **{notebookName}**!
          </div>
          <div className="cards-grid">
            {studyPrompts.map((card, idx) => (
              <div
                key={idx}
                className="welcome-card"
                onClick={() => handlePromptCardClick(card.text)}
              >
                <span className="welcome-card-text">
                  <strong>{card.title}</strong>
                  <br />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{card.description}</span>
                </span>
                <div className="welcome-card-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="chat-messages-container">
          {chatHistory.map((msg) => (
            <div key={msg.id} className="message-wrapper">
              <div className={`message-avatar ${msg.role}`}>
                {msg.role === 'user' ? 'U' : 'AI'}
              </div>
              <div className="message-bubble">
                <span className="message-sender">
                  {msg.role === 'user' ? 'You' : `${llmConfig.provider.toUpperCase()} Assistant`}
                </span>
                <div className="message-content">
                  <MarkdownRenderer text={msg.content} />
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message-wrapper">
              <div className="message-avatar assistant">AI</div>
              <div className="message-bubble">
                <span className="message-sender">Processing study material...</span>
                <div className="loading-shimmer-container" style={{ marginTop: '8px' }}>
                  <div className="loading-shimmer-line long"></div>
                  <div className="loading-shimmer-line medium"></div>
                  <div className="loading-shimmer-line short"></div>
                </div>
                <div className="ai-pulse-bar"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="chat-input-wrapper">
        <form onSubmit={handleSubmit} className="chat-input-container">
          <div className="chat-input-row">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste study material or ask a question..."
              className="chat-textarea"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="send-msg-btn"
              disabled={input.trim() === '' || isLoading}
              title="Send study material"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div className="chat-actions-row">
            <div className="chat-action-left-btns" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Shift + Enter for new line. Active: <strong>{llmConfig.model}</strong>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
