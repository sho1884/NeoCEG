/**
 * Context Menu Component
 * Provides right-click menu for nodes and edges
 */

import { memo, useCallback, useEffect, useRef } from 'react';

export interface MenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

const ContextMenu = memo(({ x, y, items, onClose }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleItemClick = useCallback((item: MenuItem) => {
    if (!item.disabled && !item.separator) {
      item.onClick();
      onClose();
    }
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        minWidth: '120px',
        zIndex: 1000,
        padding: '4px 0',
      }}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return (
            <div
              key={index}
              style={{ height: '1px', backgroundColor: '#e0e0e0', margin: '4px 0' }}
            />
          );
        }
        return (
          <div
            key={index}
            onClick={() => handleItemClick(item)}
            style={{
              padding: '8px 16px',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              color: item.disabled ? '#999' : item.danger ? '#d32f2f' : '#333',
              backgroundColor: 'transparent',
              fontSize: '13px',
              transition: 'background-color 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {item.checked && <span style={{ marginRight: '6px' }}>&#x2713;</span>}
            {item.label}
          </div>
        );
      })}
    </div>
  );
});

ContextMenu.displayName = 'ContextMenu';

export default ContextMenu;
