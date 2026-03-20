/**
 * Main Toolbar Component
 * Unified single-row toolbar with file operations, undo/redo, and constraints
 */

import { useCallback, useRef, useState, useEffect, memo } from 'react';
import { useGraphStore } from '../stores/graphStore';
import { graphToLogical, applyLogicalModelToStore } from '../services/modelConverter';
import { serializeLogicalModel, downloadLogicalDSL, copyLogicalDSLToClipboard } from '../services/logicalDslSerializer';
import { parseLogicalDSL, readFileAsText } from '../services/logicalDslParser';
import { downloadGraphSVG, copyGraphSVGToClipboard, downloadGraphPNG, copyGraphPNGToClipboard } from '../services/svgExporter';
import {
  downloadDecisionTableCSVFromGraph,
  copyDecisionTableCSVToClipboard,
  downloadCoverageTableCSVFromGraph,
  copyCoverageTableCSVToClipboard,
} from '../services/csvExporter';
import {
  copyDecisionTableHTMLFromGraph,
  copyCoverageTableHTMLFromGraph,
} from '../services/htmlTableExporter';
import { EXPORT_MESSAGES } from '../constants/messages';
import type { LogicalModel } from '../types/logical';
import type { ConstraintType, ConstraintMember, Constraint, CEGEdge } from '../types/graph';
import { CONSTRAINT_LABELS } from '../types/graph';

// =============================================================================
// Styles
// =============================================================================

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '0 16px',
  height: '42px',
  background: '#1e1e1e',
  color: '#bbb',
  fontSize: '14px',
  userSelect: 'none',
};

const btnBase: React.CSSProperties = {
  padding: '5px 10px',
  border: 'none',
  borderRadius: '3px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
  color: '#ddd',
  backgroundColor: 'transparent',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  transition: 'background-color 0.15s',
  whiteSpace: 'nowrap',
};

const btnHoverBg = 'rgba(255,255,255,0.1)';

const btnDisabled: React.CSSProperties = {
  ...btnBase,
  color: '#999',
  cursor: 'default',
};

const dividerStyle: React.CSSProperties = {
  width: '1px',
  height: '20px',
  backgroundColor: 'rgba(255,255,255,0.15)',
  margin: '0 2px',
};

const constraintBtnBase: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: '3px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
  color: '#ddd',
  backgroundColor: 'transparent',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
};

const constraintBtnEnabled: React.CSSProperties = {
  ...constraintBtnBase,
  color: '#eee',
  borderColor: 'rgba(255,255,255,0.3)',
};

// constraintBtnDisabled removed - buttons are always enabled per GUI spec

// =============================================================================
// File Dropdown
// =============================================================================

function FileDropdown({
  onImport,
  onExport,
  onCopyDsl,
  onPasteDsl,
  onClear,
  hasData,
}: {
  onImport: () => void;
  onExport: () => void;
  onCopyDsl: () => void;
  onPasteDsl: () => void;
  onClear: () => void;
  hasData: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClick, true);
    return () => document.removeEventListener('pointerdown', handleClick, true);
  }, [open]);

  const menuItemStyle: React.CSSProperties = {
    padding: '7px 16px',
    fontSize: '13px',
    color: '#ddd',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    backgroundColor: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
  };

  const menuItemDisabledStyle: React.CSSProperties = {
    ...menuItemStyle,
    color: '#999',
    cursor: 'default',
  };

  const divider = <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }} />;

  const MenuItem = ({ label, onClick, enabled = true, color }: {
    label: string; onClick: () => void; enabled?: boolean; color?: string;
  }) => (
    <button
      onClick={() => { if (enabled) { onClick(); setOpen(false); } }}
      style={enabled ? (color ? { ...menuItemStyle, color } : menuItemStyle) : menuItemDisabledStyle}
      onMouseEnter={(e) => { if (enabled) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {label}
    </button>
  );

  const date = new Date().toISOString().split('T')[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={btnBase}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = btnHoverBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        File
        <span style={{ fontSize: '8px', marginLeft: '2px' }}>{open ? '\u25B4' : '\u25BE'}</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '2px',
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '4px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            zIndex: 100,
            minWidth: '160px',
            padding: '4px 0',
          }}
        >
          <MenuItem label={EXPORT_MESSAGES.importCegDefinition} onClick={onImport} />
          {divider}
          <MenuItem label={EXPORT_MESSAGES.saveCegDefinition} onClick={onExport} enabled={hasData} />
          <MenuItem label="Download SVG" onClick={() => downloadGraphSVG(`graph_${date}.svg`)} enabled={hasData} />
          <MenuItem label="Download PNG" onClick={() => downloadGraphPNG(`graph_${date}.png`)} enabled={hasData} />
          <MenuItem label={EXPORT_MESSAGES.downloadDecisionCsv} onClick={() => downloadDecisionTableCSVFromGraph(`decision_table_${date}.csv`)} enabled={hasData} />
          <MenuItem label={EXPORT_MESSAGES.downloadCoverageCsv} onClick={() => downloadCoverageTableCSVFromGraph(`coverage_table_${date}.csv`)} enabled={hasData} />
          {divider}
          <MenuItem label={EXPORT_MESSAGES.copyCegDefinition} onClick={onCopyDsl} enabled={hasData} />
          <MenuItem label={EXPORT_MESSAGES.pasteCegDefinition} onClick={onPasteDsl} />
          <MenuItem label="Copy SVG" onClick={() => copyGraphSVGToClipboard()} enabled={hasData} />
          <MenuItem label="Copy PNG" onClick={() => copyGraphPNGToClipboard()} enabled={hasData} />
          <MenuItem label={EXPORT_MESSAGES.copyDecisionCsv} onClick={() => copyDecisionTableCSVToClipboard()} enabled={hasData} />
          <MenuItem label={EXPORT_MESSAGES.copyCoverageCsv} onClick={() => copyCoverageTableCSVToClipboard()} enabled={hasData} />
          <MenuItem label={EXPORT_MESSAGES.copyDecisionHtml} onClick={() => copyDecisionTableHTMLFromGraph()} enabled={hasData} />
          <MenuItem label={EXPORT_MESSAGES.copyCoverageHtml} onClick={() => copyCoverageTableHTMLFromGraph()} enabled={hasData} />
          {divider}
          <MenuItem label="Clear All" onClick={onClear} enabled={hasData} color="#ef9a9a" />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Help Tooltip
// =============================================================================

function HelpTooltip() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClick, true);
    return () => document.removeEventListener('pointerdown', handleClick, true);
  }, [open]);

  const tips = [
    'Double-click canvas: Create logical node',
    'Double-click logical node: Edit statement',
    'Drag from handle: Connect nodes',
    'Click edge: Toggle NOT',
    'Click AND/OR badge: Toggle operator',
    'Constraint buttons: Create constraint node',
    'Right-click: Context menu',
    'Delete key: Remove selected',
    'Ctrl+Z / Ctrl+Y: Undo / Redo',
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          ...btnBase,
          fontSize: '13px',
          fontWeight: 700,
          width: '24px',
          height: '24px',
          padding: 0,
          justifyContent: 'center',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.2)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = btnHoverBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        title="Keyboard shortcuts and tips"
      >
        ?
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '2px',
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '4px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            zIndex: 100,
            padding: '8px 12px',
            whiteSpace: 'nowrap',
          }}
        >
          {tips.map((tip, i) => (
            <div key={i} style={{ padding: '3px 0', fontSize: '12px', color: '#bbb' }}>
              {tip}
            </div>
          ))}
          <div style={{ borderTop: '1px solid #444', marginTop: '6px', paddingTop: '6px' }}>
            <a
              href="https://sho1884.github.io/public-files/NeoCEG/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '12px', color: '#6ea8fe', textDecoration: 'none' }}
              onClick={() => setOpen(false)}
              onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
            >
              Documentation / ドキュメント
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

const CONSTRAINT_TYPES: ConstraintType[] = ['ONE', 'EXCL', 'INCL', 'REQ', 'MASK'];

// Count actual connected edges for a constraint (for export validation)
function getConstraintConnectedCount(constraint: Constraint, storeEdges: CEGEdge[]): number {
  return storeEdges.filter(
    (e) => e.id.startsWith(`cedge_${constraint.id}_`) && e.data.edgeType === 'constraint'
  ).length;
}

export default function MainToolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [pendingImport, setPendingImport] = useState<LogicalModel | null>(null);

  // Store state
  const nodes = useGraphStore((state) => state.nodes);
  const constraintNodes = useGraphStore((state) => state.constraintNodes);
  const edges = useGraphStore((state) => state.edges);
  const constraints = useGraphStore((state) => state.constraints);
  const clear = useGraphStore((state) => state.clear);
  const selectedNodeIds = useGraphStore((state) => state.selectedNodeIds);
  const selectedConstraintNodeId = useGraphStore((state) => state.selectedConstraintNodeId);
  const addConstraint = useGraphStore((state) => state.addConstraint);
  const changeConstraintType = useGraphStore((state) => state.changeConstraintType);

  const hasData = nodes.length > 0 || constraints.length > 0;

  // Export validation state
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [pendingExportAction, setPendingExportAction] = useState<(() => void) | null>(null);
  const [invalidConstraintCount, setInvalidConstraintCount] = useState(0);

  // Undo/Redo state and handlers are in the UndoRedoButtons component below

  // File operations
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Helper: perform export after optional validation cleanup
  const doExport = useCallback((mode: 'download' | 'clipboard') => {
    const state = useGraphStore.getState();
    const logicalModel = graphToLogical({
      nodes: state.nodes,
      constraintNodes: state.constraintNodes,
      edges: state.edges,
      constraints: state.constraints,
    });
    const dsl = serializeLogicalModel(logicalModel);
    if (mode === 'download') {
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadLogicalDSL(dsl, `graph_${timestamp}.nceg`);
    } else {
      copyLogicalDSLToClipboard(dsl).catch(() => {});
    }
  }, []);

  // Helper: check for under-connected constraints before export
  const validateAndExport = useCallback((mode: 'download' | 'clipboard') => {
    const invalidIds = constraints
      .filter((c) => getConstraintConnectedCount(c, edges) < 2)
      .map((c) => c.id);

    if (invalidIds.length > 0) {
      setInvalidConstraintCount(invalidIds.length);
      setPendingExportAction(() => () => {
        for (const id of invalidIds) {
          useGraphStore.getState().deleteConstraint(id);
        }
        doExport(mode);
      });
      setShowValidationDialog(true);
      return;
    }

    doExport(mode);
  }, [constraints, edges, doExport]);

  const handleExportDownload = useCallback(() => {
    validateAndExport('download');
  }, [validateAndExport]);

  const handleExportClipboard = useCallback(async () => {
    validateAndExport('clipboard');
  }, [validateAndExport]);

  const handleClearGraph = useCallback(() => {
    if (!hasData) return;
    if (confirm('Clear all nodes and constraints?')) {
      clear();
    }
  }, [hasData, clear]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      const result = parseLogicalDSL(content);

      if (!result.success) {
        setImportError(result.errors.map(err => `Line ${err.line}: ${err.message}`).join('\n'));
        return;
      }

      if (nodes.length > 0 || constraints.length > 0) {
        setPendingImport(result.model);
        setShowImportDialog(true);
      } else {
        applyImport(result.model);
      }
    } catch (err) {
      setImportError(`Failed to read file: ${err}`);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [nodes.length, constraints.length]);

  const applyImport = useCallback((model: LogicalModel) => {
    applyLogicalModelToStore(model);
    setShowImportDialog(false);
    setPendingImport(null);
    setImportError(null);
  }, []);

  const handleImportReplace = useCallback(() => {
    if (pendingImport) applyImport(pendingImport);
  }, [pendingImport, applyImport]);

  const handleImportCancel = useCallback(() => {
    setShowImportDialog(false);
    setPendingImport(null);
  }, []);

  // Paste CEG Definition from clipboard
  const handlePasteDsl = useCallback(async () => {
    let content: string;
    try {
      content = await navigator.clipboard.readText();
    } catch {
      setImportError('Failed to read clipboard. Please allow clipboard access.');
      return;
    }

    if (!content.trim()) {
      setImportError('Clipboard is empty.');
      return;
    }

    const result = parseLogicalDSL(content);
    if (!result.success) {
      setImportError(result.errors.map(err => `Line ${err.line}: ${err.message}`).join('\n'));
      return;
    }

    if (nodes.length > 0 || constraints.length > 0) {
      setPendingImport(result.model);
      setShowImportDialog(true);
    } else {
      applyImport(result.model);
    }
  }, [nodes.length, constraints.length, applyImport]);

  const getViewportTopLeft = useGraphStore((state) => state.getViewportTopLeft);

  // Constraint creation - position calculation
  const calculateConstraintPosition = useCallback(() => {
    // Always place at viewport top-left (with margin) for predictable positioning
    return getViewportTopLeft();
  }, [getViewportTopLeft]);

  // Constraint button click - 3 behavior modes
  const handleConstraintClick = useCallback((type: ConstraintType) => {
    if (selectedConstraintNodeId) {
      // Mode 2: Constraint node selected - change its type
      const cnode = constraintNodes.find((cn) => cn.id === selectedConstraintNodeId);
      if (cnode) {
        changeConstraintType(cnode.data.constraintId, type);
      }
      return;
    }

    if (selectedNodeIds.length > 0) {
      // Mode 1: CEG nodes selected - create constraint with edges
      const members: ConstraintMember[] = selectedNodeIds.map((nodeId) => ({
        nodeId,
        negated: false,
      }));
      const position = calculateConstraintPosition();
      addConstraint(type, members, position);
      return;
    }

    // Mode 3: Nothing selected - create unconnected constraint node
    const position = calculateConstraintPosition();
    addConstraint(type, [], position);
  }, [selectedNodeIds, selectedConstraintNodeId, addConstraint, changeConstraintType, calculateConstraintPosition, constraintNodes]);

  return (
    <>
      <div style={toolbarStyle}>
        {/* Logo */}
        <span
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#e0e0e0',
            letterSpacing: '0.5px',
            marginRight: '4px',
          }}
        >
          <span style={{ color: '#7ecfff' }}>Neo</span>CEG
        </span>
        <span style={{ fontSize: '9px', color: '#ccc', marginLeft: '4px' }}>
          {__BUILD_TIME__.slice(0, 16).replace('T', ' ')}
        </span>

        <div style={dividerStyle} />

        {/* File dropdown */}
        <FileDropdown
          onImport={handleImportClick}
          onExport={handleExportDownload}
          onCopyDsl={handleExportClipboard}
          onPasteDsl={handlePasteDsl}
          onClear={handleClearGraph}
          hasData={hasData}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".nceg,.txt"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <div style={dividerStyle} />

        <UndoRedoButtons />

        <div style={dividerStyle} />

        {/* Constraint buttons - always enabled */}
        {CONSTRAINT_TYPES.map((type) => {
          // Highlight current type when a constraint node is selected
          const isCurrentType = selectedConstraintNodeId
            ? constraintNodes.some((cn) =>
                cn.id === selectedConstraintNodeId && cn.data.constraintType === type
              )
            : false;

          const btnStyle: React.CSSProperties = {
            ...constraintBtnEnabled,
            ...(isCurrentType ? { borderColor: '#7ecfff', color: '#7ecfff' } : {}),
          };

          return (
            <button
              key={type}
              onClick={() => handleConstraintClick(type)}
              style={btnStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                if (!isCurrentType) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                if (!isCurrentType) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
                }
              }}
              title={
                selectedConstraintNodeId
                  ? `Change to ${CONSTRAINT_LABELS[type]}`
                  : selectedNodeIds.length > 0
                    ? `Create ${CONSTRAINT_LABELS[type]} constraint`
                    : `Create ${CONSTRAINT_LABELS[type]} constraint (unconnected)`
              }
            >
              {CONSTRAINT_LABELS[type]}
            </button>
          );
        })}

        {/* Right section */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectedNodeIds.length > 0 && (
            <span style={{ fontSize: '12px', color: '#999' }}>
              {selectedNodeIds.length} node{selectedNodeIds.length > 1 ? 's' : ''} selected
            </span>
          )}
          {selectedConstraintNodeId && selectedNodeIds.length === 0 && (
            <span style={{ fontSize: '12px', color: '#999' }}>
              Constraint selected
            </span>
          )}
          <HelpTooltip />
        </div>
      </div>

      {/* Import confirmation dialog */}
      {showImportDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '400px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', color: '#333' }}>Import Graph</h3>
            <p style={{ margin: '0 0 20px', color: '#666' }}>
              The current graph has data. How would you like to import?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleImportCancel}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleImportReplace}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#333',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export validation dialog */}
      {showValidationDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '400px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', color: '#333' }}>Remove meaningless constraints?</h3>
            <p style={{ margin: '0 0 20px', color: '#666' }}>
              {invalidConstraintCount} constraint{invalidConstraintCount > 1 ? 's have' : ' has'} fewer than 2 connected nodes and will be removed before export.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowValidationDialog(false); setPendingExportAction(null); }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (pendingExportAction) pendingExportAction();
                  setShowValidationDialog(false);
                  setPendingExportAction(null);
                }}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#333',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Remove and Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error dialog */}
      {importError && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '500px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', color: '#d32f2f' }}>Import Error</h3>
            <pre
              style={{
                margin: '0 0 20px',
                padding: '12px',
                backgroundColor: '#ffebee',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px',
                fontSize: '13px',
                whiteSpace: 'pre-wrap',
                color: '#c62828',
                border: '1px solid #ffcdd2',
              }}
            >
              {importError}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setImportError(null)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#333',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// =============================================================================
// UndoRedoButtons - uses standard zustand selectors for reactive updates
// =============================================================================

const UndoRedoButtons = memo(function UndoRedoButtons() {
  const canUndo = useGraphStore((state) => state.canUndo);
  const canRedo = useGraphStore((state) => state.canRedo);
  const undo = useGraphStore((state) => state.undo);
  const redo = useGraphStore((state) => state.redo);

  const handleUndo = useCallback(() => { undo(); }, [undo]);
  const handleRedo = useCallback(() => { redo(); }, [redo]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' && !event.shiftKey) {
          event.preventDefault();
          useGraphStore.getState().undo();
        } else if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
          event.preventDefault();
          useGraphStore.getState().redo();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <button
        onClick={handleUndo}
        style={canUndo ? btnBase : btnDisabled}
        onMouseEnter={(e) => { if (canUndo) e.currentTarget.style.backgroundColor = btnHoverBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        title="Undo (Ctrl+Z)"
      >
        <span style={{ fontSize: '15px' }}>&#x21B6;</span>
      </button>
      <button
        onClick={handleRedo}
        style={canRedo ? btnBase : btnDisabled}
        onMouseEnter={(e) => { if (canRedo) e.currentTarget.style.backgroundColor = btnHoverBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        title="Redo (Ctrl+Y)"
      >
        <span style={{ fontSize: '15px' }}>&#x21B7;</span>
      </button>
    </>
  );
});
