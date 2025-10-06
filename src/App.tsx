import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PokemonProvider } from './contexts/PokemonContext';
import MainView from './components/MainView';
import GalleryView from './components/GalleryView';
import DetailView from './components/DetailView';
import './App.css';

function App() {
  return (
    <PokemonProvider>
      <Router basename="/mp2">
        <div className="App">
          <Routes>
            <Route path="/" element={<MainView />} />
            <Route path="/list" element={<MainView />} />
            <Route path="/gallery" element={<GalleryView />} />
            <Route path="/card/:id" element={<DetailView />} />
          </Routes>
        </div>
      </Router>
    </PokemonProvider>
  );
}

export default App;