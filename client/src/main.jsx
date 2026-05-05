import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.jsx'

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
