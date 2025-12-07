import React, { useState } from 'react';
import './App.css';
import MovieList from './components/MovieList';
import MovieModal from './components/MovieModal';
import SeriesModal from './components/SeriesModal';
import AskAIModal from './components/AskAIModal';
import BackToTop from './components/BackToTop';

function App() {
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [showAskAI, setShowAskAI] = useState(false);

  const handleOpenMovie = (movie) => {
    setSelectedSeries(null);
    setSelectedMovie(movie);
  };

  const handleOpenSeries = (seriesData) => {
    setSelectedMovie(null);
    setSelectedSeries(seriesData);
  };

  const handleCloseMovie = () => {
    setSelectedMovie(null);
  };

  const handleCloseSeries = () => {
    setSelectedSeries(null);
  };

  const handleSelectFromSeries = (movie) => {
    setSelectedSeries(null);
    setSelectedMovie(movie);
  };

  return (
    <div className="app">
      <header className="app-header">
        <button 
          className="ask-ai-btn"
          onClick={() => setShowAskAI(true)}
          aria-label="Запитати AI"
        >
          <span className="ask-ai-btn-text">Ask</span>
          <img src="/chat-gpt.png" alt="GPT" className="ask-ai-btn-img" />
        </button>
        <div className="header-decoration">✨</div>
        <h1 className="app-title">
          Привіт, <span className="name-highlight">Соня</span>!
        </h1>
        <p className="app-subtitle">
          Поки що є тільки мультфільми від Disney і короткий список фільмів, які мені подобаються, але далі буде більше!
        </p>
      </header>
      
      <main className="app-main">
        <MovieList 
          onOpenMovie={handleOpenMovie}
          onOpenSeries={handleOpenSeries}
        />
      </main>

      {selectedMovie && (
        <MovieModal 
          movie={selectedMovie} 
          onClose={handleCloseMovie} 
        />
      )}

      {selectedSeries && (
        <SeriesModal 
          series={selectedSeries}
          onClose={handleCloseSeries}
          onSelectMovie={handleSelectFromSeries}
        />
      )}

      {showAskAI && (
        <AskAIModal onClose={() => setShowAskAI(false)} />
      )}

      <BackToTop />
    </div>
  );
}

export default App;
