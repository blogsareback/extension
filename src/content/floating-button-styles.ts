/**
 * Floating Subscribe Button Styles
 *
 * CSS styles for the floating subscribe button, isolated via Shadow DOM.
 * Uses CSS custom properties for theming and respects prefers-color-scheme.
 */

export const FLOATING_BUTTON_STYLES = `
  :host {
    /* Light mode defaults */
    --bab-bg: #ffffff;
    --bab-bg-hover: #f9fafb;
    --bab-border: #e5e7eb;
    --bab-text: #111827;
    --bab-text-muted: #6b7280;
    --bab-primary: #3b82f6;
    --bab-primary-hover: #2563eb;
    --bab-success: #22c55e;
    --bab-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    --bab-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --bab-bg: #1f2937;
      --bab-bg-hover: #374151;
      --bab-border: #4b5563;
      --bab-text: #f9fafb;
      --bab-text-muted: #9ca3af;
      --bab-primary: #60a5fa;
      --bab-primary-hover: #3b82f6;
      --bab-success: #a6d189;
      --bab-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3);
      --bab-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3);
    }
  }

  * {
    box-sizing: border-box;
  }

  .bab-floating-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }

  .bab-floating-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--bab-bg);
    border: 1px solid var(--bab-border);
    border-radius: 9999px;
    color: var(--bab-text);
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;
    box-shadow: var(--bab-shadow);
    transition: all 150ms ease;
    outline: none;
    white-space: nowrap;
  }

  .bab-floating-button:hover {
    background: var(--bab-bg-hover);
    box-shadow: var(--bab-shadow-lg);
  }

  .bab-floating-button:focus-visible {
    outline: 2px solid var(--bab-primary);
    outline-offset: 2px;
  }

  .bab-floating-button:active {
    transform: scale(0.95);
  }

  .bab-floating-button.bab-success {
    background: var(--bab-success);
    border-color: rgba(255, 255, 255, 0.4);
    color: #ffffff;
    font-weight: 500;
    text-shadow: 0px 0px 2px rgba(0, 0, 0, 0.2);
  }

  .bab-floating-button.bab-loading {
    pointer-events: none;
    opacity: 0.8;
  }

  .bab-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    fill: currentColor;
    filter: grayscale(100%);
    transition: filter 300ms ease;
  }

  .bab-floating-button:hover .bab-icon {
    filter: grayscale(0%);
  }

  .bab-icon-rss {
    color: var(--bab-primary);
  }

  .bab-success .bab-icon {
    color: #ffffff;
    filter: grayscale(0%);
  }

  .bab-loading .bab-icon {
    filter: grayscale(0%);
  }

  .bab-dismiss-button {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 20px;
    height: 20px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bab-bg);
    border: 1px solid var(--bab-border);
    border-radius: 50%;
    color: var(--bab-text-muted);
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    box-shadow: var(--bab-shadow);
    transition: all 150ms ease;
    outline: none;
  }

  .bab-dismiss-button:hover {
    background: var(--bab-bg-hover);
    color: var(--bab-text);
  }

  .bab-dismiss-button:focus-visible {
    outline: 2px solid var(--bab-primary);
    outline-offset: 1px;
  }

  .bab-dismiss-tooltip {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 8px;
    padding: 8px 12px;
    background: var(--bab-bg);
    border: 1px solid var(--bab-border);
    border-radius: 8px;
    color: var(--bab-text);
    font-size: 12px;
    white-space: nowrap;
    box-shadow: var(--bab-shadow-lg);
    opacity: 0;
    visibility: hidden;
    transition: all 150ms ease;
  }

  .bab-dismiss-tooltip.bab-visible {
    opacity: 1;
    visibility: visible;
  }

  .bab-dismiss-tooltip-buttons {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .bab-dismiss-tooltip-button {
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
    outline: none;
  }

  .bab-dismiss-tooltip-button:focus-visible {
    outline: 2px solid var(--bab-primary);
    outline-offset: 1px;
  }

  .bab-dismiss-confirm {
    background: var(--bab-primary);
    color: #ffffff;
  }

  .bab-dismiss-confirm:hover {
    background: var(--bab-primary-hover);
  }

  .bab-dismiss-cancel {
    background: var(--bab-bg-hover);
    color: var(--bab-text);
  }

  .bab-dismiss-cancel:hover {
    background: var(--bab-border);
  }

  /* Animations */
  @keyframes bab-slide-up {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes bab-slide-down {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(16px);
    }
  }

  @keyframes bab-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .bab-floating-container.bab-entering {
    animation: bab-slide-up 300ms ease-out forwards;
  }

  .bab-floating-container.bab-exiting {
    animation: bab-slide-down 200ms ease-in forwards;
  }

  .bab-spinner {
    animation: bab-spin 1s linear infinite;
  }

  @keyframes draw-check {
    from {
      stroke-dashoffset: 30; /* Hidden */
    }
    to {
      stroke-dashoffset: 0;  /* Fully drawn */
    }
  }

  .checkmark-path {
    stroke-dasharray: 30;
    stroke-dashoffset: 30;
    animation: draw-check 0.6s ease-out forwards;
  }

  .checkmark-svg {
    color: #ffffff;
    filter: drop-shadow(0px 0px 2px rgba(0, 0, 0, 0.2))
  }
`;
