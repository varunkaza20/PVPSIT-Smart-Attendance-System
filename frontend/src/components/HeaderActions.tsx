import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export const HEADER_ACTIONS_ID = 'header-actions';

/** Renders its children inside the top bar (next to the clock) instead of in the page body. */
export const HeaderActions: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setTarget(document.getElementById(HEADER_ACTIONS_ID)); }, []);
  return target ? createPortal(children, target) : null;
};
