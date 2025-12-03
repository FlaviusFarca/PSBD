import React from 'react'
import ReactDOM from 'react-dom/client'
import CourierInterface from './components/CourierInterface.jsx'
import './index.css' // Daca ai un fisier CSS, daca nu, sterge linia asta

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CourierInterface />
  </React.StrictMode>,
)