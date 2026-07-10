import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', background: 'red', color: 'white', borderRadius: '8px', overflow: 'auto', margin: '20px' }}>
                    <h2>⚠️ Error Crítico en la Interfaz</h2>
                    <p>La aplicación encontró un problema inesperado y no puede continuar mostrando esta sección.</p>
                    <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', background: 'white', color: 'red', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '16px', fontWeight: 'bold' }}>
                        Recargar Página
                    </button>
                    <details style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '4px' }}>
                        <summary style={{ cursor: 'pointer' }}>Ver Detalles Técnicos (Para Soporte)</summary>
                        <br />
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.error && this.state.error.stack}
                        <br />
                        Component passed: {JSON.stringify(this.props.debugInfo || "none")}
                    </details>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
