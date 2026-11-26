import React, { Component, StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useJsApiLoader } from '@react-google-maps/api';
import './index.css';
import './App.css';
import App from './App.jsx';
import { installClinicalApiInterceptors } from './utils/clinicalApiAuth';

installClinicalApiInterceptors();

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", background: "#fee", color: "#900", fontFamily: "sans-serif" }}>
          <h1>Something went wrong.</h1>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px", border: "1px solid red", padding: "10px" }}>
            {this.state.error && this.state.error.stack}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

console.log("%c 🚀 TILO CORE: V8.6 - INTEGRITY PATCH LOADED ", "background: #222; color: #bada55; font-size: 14px; padding: 4px; border-radius: 4px;");

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

if (!GOOGLE_MAPS_KEY) {
  console.info("ℹ️ MODO NUBE STANDALONE ACTIVO: Cartografía operando en modo seguro sin exposición de llaves API en repositorio público.");
}

const libraries = ['places'];

function GoogleMapsBackgroundLoader() {
  useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries
  });
  return null;
}

export const RootComponent = () => {
  const hasKey = Boolean(GOOGLE_MAPS_KEY && GOOGLE_MAPS_KEY.trim().length > 5);
  const [isMapsAuthReady, setIsMapsAuthReady] = useState(false);

  useEffect(() => {
    const handleAuthChanged = (evt) => {
      if (evt?.detail?.isLoggedIn) {
        setIsMapsAuthReady(true);
      }
    };
    window.addEventListener('tilo-auth-changed', handleAuthChanged);
    return () => window.removeEventListener('tilo-auth-changed', handleAuthChanged);
  }, []);

  return (
    <StrictMode>
      <ErrorBoundary>
        {hasKey && isMapsAuthReady ? <GoogleMapsBackgroundLoader /> : null}
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
};

createRoot(document.getElementById('root')).render(<RootComponent />);
