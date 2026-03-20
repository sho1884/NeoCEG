import { useEffect, useState } from 'react';
import GraphCanvas from './components/GraphCanvas';
import MainToolbar from './components/MainToolbar';
import DecisionTablePanel from './components/DecisionTablePanel';
import { useGraphStore } from './stores/graphStore';
import { parseLogicalDSL } from './services/logicalDslParser';
import { applyLogicalModelToStore } from './services/modelConverter';
import './App.css';

function App() {
  const canUndo = useGraphStore((s) => s.canUndo);
  const [fileError, setFileError] = useState<string | null>(null);

  // Load ?file= URL parameter on startup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fileUrl = params.get('file');
    if (!fileUrl) return;

    // Security: HTTPS only
    if (!fileUrl.startsWith('https://')) {
      setFileError('File URL must use HTTPS.');
      return;
    }

    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.text();
      })
      .then((content) => {
        const result = parseLogicalDSL(content);
        if (!result.success) {
          const msgs = result.errors.map((e) => `Line ${e.line}: ${e.message}`);
          setFileError(`Parse error:\n${msgs.join('\n')}`);
          return;
        }
        applyLogicalModelToStore(result.model);
      })
      .catch((err) => {
        setFileError(`Failed to load file: ${err.message}`);
      });
  }, []);

  useEffect(() => {
    if (!canUndo) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [canUndo]);

  return (
    <div className="app">
      <MainToolbar />
      {fileError && (
        <div style={{
          padding: '8px 16px',
          background: '#ffebee',
          color: '#c62828',
          fontSize: '13px',
          borderBottom: '1px solid #ef9a9a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ whiteSpace: 'pre-wrap' }}>{fileError}</span>
          <button
            onClick={() => setFileError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#c62828' }}
          >✕</button>
        </div>
      )}
      <main className="app-main">
        <div className="graph-area">
          <GraphCanvas />
        </div>
        <DecisionTablePanel />
      </main>
    </div>
  );
}

export default App;
