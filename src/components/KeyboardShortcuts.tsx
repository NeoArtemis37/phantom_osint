'use client';

import { useEffect } from 'react';
import { usePhantomStore } from '@/store/phantom-store';

export default function KeyboardShortcuts() {
  const setActiveView = usePhantomStore((s) => s.setActiveView);
  const setSidePanelContent = usePhantomStore((s) => s.setSidePanelContent);
  const setCaseManagerOpen = usePhantomStore((s) => s.setCaseManagerOpen);
  const selectedEntity = usePhantomStore((s) => s.selectedEntity);
  const setSelectedEntity = usePhantomStore((s) => s.setSelectedEntity);
  const requestGraphFit = usePhantomStore((s) => s.requestGraphFit);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+K or /: Focus search
      if ((ctrl && e.key === 'k') || (e.key === '/' && !ctrl)) {
        e.preventDefault();
        setSidePanelContent('search');
        return;
      }

      // Ctrl+N: New entity
      if (ctrl && e.key === 'n') {
        e.preventDefault();
        setSidePanelContent('add-entity');
        return;
      }

      // Escape: Deselect / close panel
      if (e.key === 'Escape') {
        setSelectedEntity(null);
        return;
      }

      // Delete/Backspace: Delete selected entity
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEntity) {
        // Don't auto-delete, just open confirmation - handled in EntityPanel
        return;
      }

      // Number keys for view switching
      if (ctrl) return; // Don't interfere with Ctrl+number
      switch (e.key) {
        case '1': setActiveView('graph'); break;
        case '2': setActiveView('timeline'); break;
        case '3': setActiveView('osint'); break;
        case '4': setActiveView('analysis'); break;
        case '5': setActiveView('evidence'); break;
        case '6': setActiveView('alerts'); break;
        case '7': setActiveView('notebook'); break;
        case '8': setActiveView('modules'); break;
        case '9': setActiveView('report'); break;
        case '0': setActiveView('watchlist'); break;
      }

      // F: Fit graph
      if (e.key === 'f' || e.key === 'F') {
        requestGraphFit();
      }

      // C: Open case manager
      if (e.key === 'c' || e.key === 'C') {
        setCaseManagerOpen(true);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveView, setSidePanelContent, setCaseManagerOpen, selectedEntity, setSelectedEntity, requestGraphFit]);

  return null; // This is a hook component, renders nothing
}
