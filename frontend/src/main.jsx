import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.jsx'
import './index.css'

// In production (Vercel), point axios at the deployed backend URL.
// In dev, Vite's proxy forwards /api → localhost:8000 so baseURL stays empty.
if (import.meta.env.VITE_API_BASE_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
