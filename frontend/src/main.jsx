import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/big-shoulders'
import '@fontsource-variable/big-shoulders-stencil'
import '@fontsource-variable/hanken-grotesk'
import '@fontsource-variable/azeret-mono'
import './styles.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)
