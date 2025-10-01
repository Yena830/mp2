import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainView from './components/MainView';
import DetailView from './components/DetailView';
import './App.css';

function App() {
  return (
    <Router basename="/mp2-yueyue4">
      <div className="App">
        <Routes>
          <Route path="/" element={<MainView />} />
          <Route path="/gallery" element={<MainView />} />
          <Route path="/card/:id" element={<DetailView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;