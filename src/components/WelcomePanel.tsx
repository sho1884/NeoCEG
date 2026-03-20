/**
 * Welcome Panel Component
 * Displayed on first launch (empty canvas) to guide new users.
 * Auto-detects browser language (EN/JA) with manual toggle.
 * Dismissed by double-clicking the canvas or clicking the close button.
 */

import { useState } from 'react';

interface WelcomePanelProps {
  onClose: () => void;
}

type Lang = 'en' | 'ja';

const content = {
  en: {
    title: 'Welcome to NeoCEG',
    subtitle: 'A Cause-Effect Graph test design tool',
    nodesTitle: 'Two Types of Nodes',
    nodesDesc: [
      ['Logical node', 'A logical statement representing a cause, intermediate, or effect (e.g., "Password is incorrect" \u2192 "Deny access")'],
      ['Constraint node', 'A constraint between logical nodes (One, Excl, Incl, Req, Mask)'],
    ] as [string, string][],
    guideTitle: 'Quick Start Guide',
    tips: [
      ['Double-click canvas', 'Create a logical node'],
      ['Double-click logical node', 'Edit the logical statement'],
      ['Drag from handle', 'Connect nodes with an edge'],
      ['Click edge', 'Toggle NOT (negation)'],
      ['Click AND/OR badge', 'Toggle the logical operator'],
      ['Constraint toolbar buttons', 'Create a constraint node'],
      ['Right-click', 'Open context menu'],
      ['Delete key', 'Remove selected nodes or edges'],
      ['Ctrl+Z / Ctrl+Y', 'Undo / Redo'],
    ] as [string, string][],
    installTitle: 'Install as App',
    installDesc: 'NeoCEG is a Progressive Web App (PWA). Click the install icon in your browser\'s address bar to use it as a standalone app — no app store required.',
    cta: 'Double-click on the canvas to create your first logical node!',
    langButton: '日本語',
  },
  ja: {
    title: 'NeoCEGへようこそ',
    subtitle: '原因結果グラフによるテスト設計ツール',
    nodesTitle: '2種類のノード',
    nodesDesc: [
      ['論理ノード', '原因・中間・結果を表す論理言明（例：「パスワードが誤っている」→「アクセスを拒否する」）'],
      ['制約ノード', '論理ノード間の制約条件（One, Excl, Incl, Req, Mask）'],
    ] as [string, string][],
    guideTitle: '基本操作ガイド',
    tips: [
      ['キャンバスをダブルクリック', '論理ノードを作成'],
      ['論理ノードをダブルクリック', '論理言明を編集'],
      ['ハンドルからドラッグ', 'ノード間をエッジで接続'],
      ['エッジをクリック', 'NOT（否定）を切替'],
      ['AND/ORバッジをクリック', '論理演算子を切替'],
      ['ツールバーの制約ボタン', '制約ノードを作成'],
      ['右クリック', 'コンテキストメニューを表示'],
      ['Deleteキー', '選択したノードやエッジを削除'],
      ['Ctrl+Z / Ctrl+Y', '元に戻す／やり直し'],
    ] as [string, string][],
    installTitle: 'アプリとしてインストール',
    installDesc: 'NeoCEG はPWA（Progressive Web App）です。ブラウザのアドレスバーに表示されるインストールアイコンをクリックすると、アプリストア不要でそのままアプリとして利用できます。',
    cta: 'キャンバスをダブルクリックして、最初の論理ノードを作りましょう！',
    langButton: 'English',
  },
};

function detectDefaultLang(): Lang {
  try {
    return navigator.language.startsWith('ja') ? 'ja' : 'en';
  } catch {
    return 'en';
  }
}

export default function WelcomePanel({ onClose }: WelcomePanelProps) {
  const [lang, setLang] = useState<Lang>(detectDefaultLang);
  const t = content[lang];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 10,
          padding: '28px 32px',
          maxWidth: 480,
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          position: 'relative',
        }}
      >
        {/* Header: close button + language toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 4 }}>
          <button
            onClick={() => setLang(lang === 'en' ? 'ja' : 'en')}
            style={{
              background: 'none',
              border: '1px solid #ccc',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 12,
              cursor: 'pointer',
              color: '#555',
            }}
          >
            {t.langButton}
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: '#999',
              lineHeight: 1,
              padding: '0 4px',
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Title */}
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#333' }}>
          {t.title}
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#777' }}>
          {t.subtitle}
        </p>

        {/* Node types */}
        <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#444' }}>
          {t.nodesTitle}
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <tbody>
            {t.nodesDesc.map(([name, desc], i) => (
              <tr key={i}>
                <td style={{
                  padding: '4px 12px 4px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#333',
                  whiteSpace: 'nowrap',
                  verticalAlign: 'top',
                }}>
                  {name}
                </td>
                <td style={{
                  padding: '4px 0',
                  fontSize: 13,
                  color: '#666',
                }}>
                  {desc}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tips */}
        <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#444' }}>
          {t.guideTitle}
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <tbody>
            {t.tips.map(([action, description], i) => (
              <tr key={i}>
                <td style={{
                  padding: '5px 12px 5px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#333',
                  whiteSpace: 'nowrap',
                  verticalAlign: 'top',
                }}>
                  {action}
                </td>
                <td style={{
                  padding: '5px 0',
                  fontSize: 13,
                  color: '#666',
                }}>
                  {description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Install as App */}
        <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#444' }}>
          {t.installTitle}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#666' }}>
          {t.installDesc}
        </p>

        {/* Call to action */}
        <div style={{
          textAlign: 'center',
          padding: '12px 16px',
          backgroundColor: '#e3f2fd',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
          color: '#1565c0',
        }}>
          {t.cta}
        </div>
      </div>
    </div>
  );
}
