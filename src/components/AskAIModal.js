import React, { useState, useRef, useEffect } from 'react';
import './AskAIModal.css';

function AskAIModal({ onClose }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Фокус на input при відкритті
    if (inputRef.current) {
      inputRef.current.focus();
    }
    // Блокуємо скрол body
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!question.trim() || isLoading) return;

    setIsLoading(true);
    setError('');
    setAnswer('');

    try {
      setIsStreaming(true);
      const response = await fetch('/api/ask-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.details || 'Помилка запиту');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Стрімінг недоступний');
      }

      const decoder = new TextDecoder();
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        result += chunk;
        setAnswer((prev) => (prev || '') + chunk);
      }

      if (!result.trim()) {
        throw new Error('Модель повернула порожню відповідь');
      }
    } catch (err) {
      setError(err.message || 'Щось пішло не так');
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleClear = () => {
    setQuestion('');
    setAnswer('');
    setError('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="ask-ai-overlay" onClick={handleOverlayClick}>
      <div className="ask-ai-modal">
        <button className="ask-ai-close" onClick={onClose} aria-label="Закрити">
          ✕
        </button>
        
        <div className="ask-ai-header">
          <div className="ask-ai-avatar">
            <img src="/chat-gpt.png" alt="GPT icon" />
          </div>
          <div>
            <h2>Що тебе цікавить?</h2>
            <p className="ask-ai-subtitle">GPT Assistant</p>
          </div>
        </div>
        
        <p className="ask-ai-hint">
          Ти можеш запитати про фільми чи мультфільми на сайті
        </p>

        <form onSubmit={handleSubmit} className="ask-ai-form">
          <div className="ask-ai-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Який мультфільм про чорного кота?"
              maxLength={500}
              disabled={isLoading}
              className="ask-ai-input"
            />
            {question && !isLoading && (
              <button 
                type="button" 
                className="ask-ai-clear-input"
                onClick={handleClear}
                aria-label="Очистити"
              >
                ✕
              </button>
            )}
          </div>
          
          <button 
            type="submit" 
            className="ask-ai-submit"
            disabled={!question.trim() || isLoading}
          >
            {isLoading ? (
              <span className="ask-ai-spinner"></span>
            ) : (
              'Запитати'
            )}
          </button>
        </form>

        {error && (
          <div className="ask-ai-error">
            {error}
          </div>
        )}

        {answer && (
          <div className="ask-ai-chat">
            <div className="ask-ai-bubble user">
              <div className="bubble-label">Ти</div>
              <div className="bubble-text">{question}</div>
            </div>
            <div className="ask-ai-bubble ai">
              <div className="bubble-avatar">
                <img src="/chat-gpt.png" alt="GPT icon" />
              </div>
              <div>
                <div className="bubble-label">GPT</div>
                <div className="bubble-text">{answer}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AskAIModal;

