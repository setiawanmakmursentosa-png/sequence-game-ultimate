// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // Mengimpor komponen utama game Anda

// Gaya CSS (Asumsi tidak ada, tetapi ini adalah path standar)
// Jika nanti Anda menambahkan file src/index.css, path ini akan bekerja.
// import './index.css'; 

// Membuat root dan me-render aplikasi React
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
