import React, { useState, useRef, useEffect } from 'react';
import ImportModal from './ImportModal';

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

  const renderFormulaParts = (formulaText) => {
    const parts = [];
    const regex = /(_[a-zA-Z0-9]+|\^[a-zA-Z0-9]+)/g;
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(formulaText)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(formulaText.substring(lastIndex, matchIndex));
      }
      const token = match[0];
      if (token.startsWith('_')) {
        parts.push(<sub key={matchIndex}>{token.substring(1)}</sub>);
      } else if (token.startsWith('^')) {
        parts.push(<sup key={matchIndex}>{token.substring(1)}</sup>);
      }
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < formulaText.length) {
      parts.push(formulaText.substring(lastIndex));
    }
    return parts;
  };

  const parseInlineMarkdown = (inputText) => {
    const parts = [];
    let currentIndex = 0;
    const regex = /(\*\*.*?\*\*|`.*?`|\$.*?\$)/g;
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
      } else if (token.startsWith('$') && token.endsWith('$')) {
        const formulaContent = token.slice(1, -1);
        parts.push(
          <span key={matchIndex} className="formula-inline" style={{ fontFamily: 'Outfit, Math, serif', fontStyle: 'italic' }}>
            {renderFormulaParts(formulaContent)}
          </span>
        );
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
  chatCompile,
  chatStudy,
  chatMode,
  setChatMode,
  onClearChat,
  onSendMessage,
  isLoading,
  notebookName,
  notebookId,
  llmConfig,
  onImportSuccess,
  onAcceptNotes
}) {
  const [input, setInput] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const chatHistory = chatMode === 'study' ? chatStudy : chatCompile;

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

  const compilePrompts = [
    {
      title: "Cell division basics",
      description: "Analyze mitosis and meiosis differences, listing stages.",
      text: "Mitosis results in two identical diploid cells for growth/repair. Meiosis results in four non-identical haploid gametes for reproduction. Mitosis has one division (prophase, metaphase, anaphase, telophase), while meiosis has two divisions (Meiosis I and Meiosis II) which introduce genetic diversity via crossing over in Prophase I."
    },
    {
      title: "Newton's laws of motion",
      description: "Summarize the 3 laws of motion with formulas.",
      text: "Newton's 1st Law (Inertia): object stays at rest/motion unless acted on by force. 2nd Law: Force equals mass times acceleration ($F = ma$). 3rd Law: For every action there is an equal and opposite reaction ($F_{action} = -F_{reaction}$)."
    },
    {
      title: "SQL vs NoSQL databases",
      description: "Compare SQL and NoSQL architectural differences.",
      text: "SQL databases are relational, table-based, structured schema, vertically scalable, use SQL queries, support ACID (e.g., PostgreSQL). NoSQL databases are non-relational, document/key-value/graph-based, dynamic schema, horizontally scalable, support BASE properties (e.g., MongoDB)."
    }
  ];

  const studyPrompts = [
    {
      title: "Start concept quiz",
      description: "Generate an interactive quiz based on my notes.",
      text: "Please quiz me on the concepts in my study notes. Give me a practice quiz."
    },
    {
      title: "Explain a concept",
      description: "Get detailed explanations about a specific note point.",
      text: "Can you explain the main stages of light-dependent reactions in photosynthesis from my notes?"
    },
    {
      title: "Study session checkup",
      description: "Check if there are gaps in my notes.",
      text: "Based on my current notes, what topics do you think I am missing or should study next?"
    }
  ];

  const activePrompts = chatMode === 'study' ? studyPrompts : compilePrompts;

  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <div className="mode-toggle-group">
          <button
            type="button"
            className={`mode-toggle-item ${chatMode === 'compile' ? 'active' : ''}`}
            onClick={() => setChatMode('compile')}
            title="Compile Notes Mode: Paste text materials to build revision notes drafts."
          >
            <span className="mode-icon">📝</span>
            <span className="mode-label">Compile Notes</span>
          </button>
          <button
            type="button"
            className={`mode-toggle-item ${chatMode === 'study' ? 'active' : ''}`}
            onClick={() => setChatMode('study')}
            title="Study & Quiz Mode: Ask questions or attempt generated practice tests based on your notes."
          >
            <span className="mode-icon">🎓</span>
            <span className="mode-label">Study & Quiz</span>
          </button>
        </div>
        
        {chatHistory.length > 0 && (
          <button
            type="button"
            className="clear-chat-btn"
            onClick={onClearChat}
            title="Clear current mode conversation history"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            </svg>
            Clear Chat
          </button>
        )}
      </div>

      {chatHistory.length === 0 ? (
        <div className="welcome-container">
          <div className="welcome-gradient-text">Hello Student</div>
          <div className="welcome-subtext">
            {chatMode === 'study'
              ? "Welcome to Study Mode! Review concepts, ask clarification questions, or ask me for a practice quiz."
              : `Give me study materials. I will automatically extract and format study notes for **${notebookName}**!`}
          </div>
          <div className="cards-grid">
            {activePrompts.map((card, idx) => (
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
          {chatHistory.map((msg) => {
            const quizRegex = /```quiz\s*([\s\S]*?)\s*```/;
            const quizMatch = msg.content && msg.content.match(quizRegex);
            let textBeforeQuiz = msg.content;
            let quizData = null;

            if (quizMatch) {
              textBeforeQuiz = msg.content.replace(quizRegex, '').trim();
              try {
                quizData = JSON.parse(quizMatch[1]);
              } catch (e) {
                console.error("Failed to parse quiz JSON", e);
              }
            }

            return (
              <div key={msg.id} className={`message-wrapper ${msg.role}`}>
                <div className={`message-avatar ${msg.role}`}>
                  {msg.role === 'user' ? 'U' : 'AI'}
                </div>
                <div className="message-bubble">
                  <span className="message-sender">
                    {msg.role === 'user' ? 'You' : 'Gemini Assistant'}
                  </span>
                  <div className="message-content">
                    {textBeforeQuiz && <MarkdownRenderer text={textBeforeQuiz} />}
                    {quizData && <InteractiveQuiz quizData={quizData} />}
                    
                    {msg.notesDraft && msg.notesDraft.trim() !== '' && chatMode === 'compile' && (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>📝</span> Proposed Study Notes
                          </span>
                          {msg.notesAdded ? (
                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                              ✓ Added to Notes
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAcceptNotes(msg.id, msg.notesDraft)}
                              className="btn btn-primary"
                              style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px' }}
                            >
                              ✓ Add to Notes
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <MarkdownRenderer text={msg.notesDraft} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="message-wrapper assistant">
              <div className="message-avatar assistant">AI</div>
              <div className="message-bubble">
                <span className="message-sender">Gemini Assistant</span>
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
              placeholder={chatMode === 'study' ? "Ask a question about your notes or request a quiz..." : "Paste study materials or ask to tweak/modify notes..."}
              className="chat-textarea"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="send-msg-btn"
              disabled={input.trim() === '' || isLoading}
              title="Send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div className="chat-actions-row">
            <div className="chat-action-left-btns" style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Active: <strong>{llmConfig.model}</strong></span>
              {chatMode === 'compile' && (
                <>
                  <span style={{ color: 'var(--border-color)' }}>|</span>
                  <button
                    type="button"
                    onClick={() => setIsImportOpen(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-color)',
                      cursor: 'pointer',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      transition: 'background-color 0.2s'
                    }}
                    title="Import chat history from ChatGPT or Gemini"
                  >
                    📥 Import ChatGPT/Gemini Chat
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        notebookId={notebookId}
        onImportSuccess={onImportSuccess}
        llmConfig={llmConfig}
      />
    </div>
  );
}

// Interactive Quiz Component
function InteractiveQuiz({ quizData }) {
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { questionIndex: optionIndex }
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  if (!quizData || !quizData.questions || quizData.questions.length === 0) return null;

  const handleSelectOption = (qIdx, optIdx) => {
    if (isSubmitted) return;
    setSelectedAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleSubmit = () => {
    if (Object.keys(selectedAnswers).length < quizData.questions.length) {
      alert("Please answer all questions before submitting!");
      return;
    }
    setIsSubmitted(true);
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
    setShowAnalysis(false);
  };

  // Concept performance calculation
  const conceptStats = {};
  let totalCorrect = 0;
  quizData.questions.forEach((q, idx) => {
    const isCorrect = selectedAnswers[idx] === q.answerIndex;
    if (isCorrect) totalCorrect++;
    
    const concept = q.concept || "General Knowledge";
    if (!conceptStats[concept]) {
      conceptStats[concept] = { correct: 0, total: 0 };
    }
    conceptStats[concept].total++;
    if (isCorrect) conceptStats[concept].correct++;
  });

  const scorePercentage = Math.round((totalCorrect / quizData.questions.length) * 100);

  return (
    <div className="interactive-quiz-container">
      <div className="quiz-header">
        <span className="quiz-title">📝 Practice Quiz</span>
        {isSubmitted && (
          <span className={`quiz-score-badge ${scorePercentage >= 80 ? 'good' : scorePercentage >= 50 ? 'average' : 'poor'}`}>
            Score: {totalCorrect}/{quizData.questions.length} ({scorePercentage}%)
          </span>
        )}
      </div>

      <div className="quiz-questions-list">
        {quizData.questions.map((q, qIdx) => {
          const selectedOpt = selectedAnswers[qIdx];
          const isCorrect = selectedOpt === q.answerIndex;

          return (
            <div key={qIdx} className={`quiz-question-card ${isSubmitted ? (isCorrect ? 'correct' : 'incorrect') : ''}`}>
              <div className="question-text">
                <span className="question-number">{qIdx + 1}.</span> {q.question}
                {isSubmitted && (
                  <span className={`question-status-badge ${isCorrect ? 'correct' : 'incorrect'}`}>
                    {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                  </span>
                )}
              </div>

              <div className="options-grid">
                {q.options.map((opt, optIdx) => {
                  const isSelected = selectedOpt === optIdx;
                  const isThisCorrectOption = optIdx === q.answerIndex;
                  
                  let optionClass = 'option-button';
                  if (isSelected) optionClass += ' selected';
                  if (isSubmitted) {
                    if (isThisCorrectOption) optionClass += ' correct';
                    else if (isSelected) optionClass += ' incorrect';
                    else optionClass += ' disabled';
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      className={optionClass}
                      onClick={() => handleSelectOption(qIdx, optIdx)}
                      disabled={isSubmitted}
                    >
                      <span className="option-marker">{String.fromCharCode(65 + optIdx)}</span>
                      <span className="option-label">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {isSubmitted && (
                <div className="question-explanation-panel">
                  <div className="explanation-title">💡 Answer & Solution:</div>
                  <div className="explanation-text">
                    <p style={{ fontWeight: 600 }}>Correct Answer: {String.fromCharCode(65 + q.answerIndex)}. {q.options[q.answerIndex]}</p>
                    <p style={{ marginTop: '6px', color: 'var(--text-secondary)' }}>{q.solution}</p>
                  </div>
                  {q.concept && (
                    <span className="question-concept-tag">Concept: {q.concept}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="quiz-actions">
        {!isSubmitted ? (
          <button type="button" className="btn btn-primary quiz-submit-btn" onClick={handleSubmit}>
            Submit Answers
          </button>
        ) : (
          <div className="quiz-submitted-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowAnalysis(!showAnalysis)}>
              {showAnalysis ? "Hide Concept Analysis" : "Show Weakness Analysis"}
            </button>
            <button type="button" className="btn btn-primary" onClick={handleReset}>
              Retake Quiz
            </button>
          </div>
        )}
      </div>

      {isSubmitted && showAnalysis && (
        <div className="quiz-analysis-panel">
          <div className="analysis-title">📊 Concept Weakness Analysis</div>
          <p className="analysis-sub">We analyzed your answers to find concepts that need focus:</p>
          <div className="analysis-metrics-list">
            {Object.entries(conceptStats).map(([concept, stats]) => {
              const pct = Math.round((stats.correct / stats.total) * 100);
              let statusLabel = 'Mastered';
              let statusClass = 'mastered';
              if (pct < 50) {
                statusLabel = 'Needs Work (Review recommended!)';
                statusClass = 'needs-work';
              } else if (pct < 80) {
                statusLabel = 'Developing';
                statusClass = 'developing';
              }

              return (
                <div key={concept} className="analysis-metric-row">
                  <div className="metric-info">
                    <span className="metric-name">{concept}</span>
                    <span className={`metric-badge ${statusClass}`}>{statusLabel}</span>
                  </div>
                  <div className="metric-progress-bar-container">
                    <div className="metric-progress-bar-bg">
                      <div className={`metric-progress-bar-fill ${statusClass}`} style={{ width: `${pct}%` }}></div>
                    </div>
                    <span className="metric-percentage">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
