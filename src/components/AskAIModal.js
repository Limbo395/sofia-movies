import React, { useState, useRef, useEffect } from 'react';
import './AskAIModal.css';

function AskAIModal({ onClose }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
      const response = await fetch('/api/ask-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: question.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Помилка запиту');
      }

      // Перевірка, чи відповідь не порожня і не містить текст про помилку
      if (!data.answer || data.answer.trim().length === 0) {
        throw new Error('Модель повернула порожню відповідь');
      }

      if (data.answer.toLowerCase().includes('не вдалося') || 
          data.answer.toLowerCase().includes('помилка')) {
        throw new Error(data.answer);
      }

      setAnswer(data.answer);
    } catch (err) {
      setError(err.message || 'Щось пішло не так');
    } finally {
      setIsLoading(false);
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
          <span className="ask-ai-icon">🤖</span>
          <h2>Запитай AI</h2>
        </div>
        
        <p className="ask-ai-hint">
          Запитай про фільми чи мультфільми на сайті
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
          <div className="ask-ai-answer">
            <div className="ask-ai-answer-label">Відповідь:</div>
            <div className="ask-ai-answer-text">{answer}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AskAIModal;

