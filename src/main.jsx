import React from 'react'
import ReactDOM from 'react-dom/client'
import Root from './Root.jsx'

// Global error boundary for iOS debugging
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error: error.message || String(error) }
  }
  componentDidCatch(error, info) {
    console.error("App crashed:", error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding:24, fontFamily:"sans-serif", color:"#ef4444",
          background:"#fff", minHeight:"100vh" }}>
          <div style={{ fontSize:20, fontWeight:700, marginBottom:12 }}>⚠️ เกิดข้อผิดพลาด</div>
          <div style={{ background:"#fee2e2", borderRadius:8, padding:16,
            fontSize:13, wordBreak:"break-all", lineHeight:1.6 }}>
            {this.state.error}
          </div>
          <button onClick={()=>window.location.reload()}
            style={{ marginTop:16, background:"#2563eb", border:"none", color:"#fff",
              borderRadius:8, padding:"10px 20px", fontSize:14, cursor:"pointer" }}>
            ลองใหม่
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
)
