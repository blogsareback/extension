import type { FeedLink, ButtonStyle, ButtonPosition } from '../../utils/types'
import { useFloatingButton } from './useFloatingButton'
import { LogoIcon, SpinnerIcon, CloseIcon, CheckmarkIcon } from './icons'

interface FloatingButtonProps {
  feeds: FeedLink[]
  hiding: boolean
  onDismiss: () => void
  onAutoHide: () => void
  style?: ButtonStyle
  position?: ButtonPosition
  isFaded?: boolean
}

// Position classes for each corner
const positionClasses: Record<ButtonPosition, string> = {
  'bottom-right': 'bottom-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'top-right': 'top-6 right-6',
  'top-left': 'top-6 left-6',
}

// Animation classes based on position and hiding state
function getAnimationClass(position: ButtonPosition, hiding: boolean): string {
  const isTop = position.startsWith('top')
  if (hiding) {
    return isTop ? 'animate-slide-out-top' : 'animate-slide-down'
  }
  return isTop ? 'animate-slide-in-top' : 'animate-slide-up'
}

// Dismiss button position based on main button position
function getDismissButtonPosition(position: ButtonPosition): string {
  const isTop = position.startsWith('top')
  const isLeft = position.endsWith('left')

  // Position dismiss button on the opposite corner from the button's anchor
  // if (isTop && isLeft) return '-bottom-2 -right-2'
  // if (isTop && !isLeft) return '-bottom-2 -left-2'
  if (isTop && isLeft) return '-top-2 -left-2'
  if (isTop && !isLeft) return '-top-2 -right-2'
  if (!isTop && isLeft) return '-top-2 -left-2'
  return '-top-2 -right-2' // bottom-right (default)
}

// Tooltip position based on main button position
function getTooltipPosition(position: ButtonPosition): string {
  const isTop = position.startsWith('top')
  const isLeft = position.endsWith('left')

  let classes = ''

  // Vertical positioning
  if (isTop) {
    classes += 'top-full mt-2' // Below the button
  } else {
    classes += 'bottom-full mb-2' // Above the button
  }

  // Horizontal alignment
  if (isLeft) {
    classes += ' left-0'
  } else {
    classes += ' right-0'
  }

  return classes
}

// Get style class name for the button
function getStyleClass(style: ButtonStyle, position: ButtonPosition): string {
  switch (style) {
    case 'ghost':
      return 'bab-style-ghost'
    case 'glass':
      return 'bab-style-glass'
    case 'minimal':
      return 'bab-style-minimal'
    case 'peek': {
      const isLeft = position.endsWith('left')
      return `bab-style-peek ${isLeft ? 'bab-peek-left' : 'bab-peek-right'}`
    }
    default:
      return '' // solid is default, no extra class
  }
}

// Get wrapper class for styles that need parent hover handling (to prevent stutter)
function getWrapperClass(style: ButtonStyle, position: ButtonPosition): string {
  if (style === 'peek') {
    const isLeft = position.endsWith('left')
    return isLeft ? 'bab-peek-wrapper-left' : 'bab-peek-wrapper-right'
  }
  if (style === 'minimal') {
    return 'bab-minimal-wrapper'
  }
  return ''
}

export function FloatingButton({
  feeds,
  hiding,
  onDismiss,
  onAutoHide,
  style = 'solid',
  position = 'bottom-right',
  isFaded = false,
}: FloatingButtonProps) {
  const {
    isLoading,
    isSuccess,
    showDismissTooltip,
    handleFollowClick,
    handleDismissClick,
    handleConfirmDismiss,
    handleCancelDismiss,
  } = useFloatingButton({ feeds, onDismiss, onAutoHide })

  const primaryFeed = feeds[0]
  const feedTitle = primaryFeed?.title || 'this blog'

  const positionClass = positionClasses[position]
  const animationClass = getAnimationClass(position, hiding)
  const dismissPosition = getDismissButtonPosition(position)
  const tooltipPosition = getTooltipPosition(position)
  const styleClass = getStyleClass(style, position)
  const wrapperClass = getWrapperClass(style, position)
  const fadedClass = isFaded ? 'bab-faded' : ''

  return (
    <div
      className={`fixed ${positionClass} z-[2147483647] box-border font-sans text-sm leading-normal ${animationClass} ${fadedClass}`}
    >
      <div className="bab-button-container relative">
        {isSuccess ? (
          /* Success state */
          <button
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/40 bg-bab-success px-4 py-2.5 text-sm font-medium text-white whitespace-nowrap shadow-[var(--bab-shadow)] [text-shadow:0_0_2px_rgba(0,0,0,0.2)] outline-none"
          >
            <CheckmarkIcon />
            <span className="bab-button-text">Following!</span>
          </button>
        ) : (
          /* Normal / Loading state */
          <>
            {/* Inner wrapper for hover extension (minimal/peek styles) */}
            <div className={wrapperClass}>
              <button
                className={`group inline-flex cursor-pointer items-center gap-2 rounded-full border border-bab-border bg-bab-bg px-4 py-2.5 text-sm font-medium text-bab-text whitespace-nowrap shadow-[var(--bab-shadow)] transition-all duration-150 ease-in-out outline-none hover:bg-bab-bg-hover hover:shadow-[var(--bab-shadow-lg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bab-primary active:scale-95 ${styleClass} ${isLoading ? 'pointer-events-none opacity-80' : ''}`}
                title={`Follow ${feedTitle}`}
                aria-label={`Subscribe to ${feedTitle} RSS feed`}
                onClick={handleFollowClick}
              >
                {isLoading ? (
                  <>
                    <SpinnerIcon />
                    <span className="bab-button-text">Following...</span>
                  </>
                ) : (
                  <>
                    <LogoIcon />
                    <span className="bab-button-text">Follow</span>
                  </>
                )}
              </button>
            </div>

            {/* Dismiss button */}
            <button
              className={`bab-dismiss-button absolute ${dismissPosition} flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-bab-border bg-bab-bg p-0 text-xs leading-none text-bab-text-muted shadow-[var(--bab-shadow)] outline-none hover:bg-bab-bg-hover hover:text-bab-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bab-primary`}
              title="Don't show on this site"
              aria-label="Dismiss floating button for this site"
              onClick={handleDismissClick}
            >
              <CloseIcon />
            </button>

            {/* Dismiss tooltip */}
            <div
              className={`absolute ${tooltipPosition} rounded-lg border border-bab-border bg-bab-bg px-3 py-2 text-xs text-bab-text whitespace-nowrap shadow-[var(--bab-shadow-lg)] transition-all duration-150 ease-in-out ${showDismissTooltip ? 'visible opacity-100' : 'invisible opacity-0'}`}
            >
              <div>Don&apos;t show on this site?</div>
              <div className="mt-2 flex gap-2">
                <button
                  className="cursor-pointer rounded bg-bab-primary px-3 py-1 text-xs font-medium text-white border-none outline-none transition-all duration-150 ease-in-out hover:bg-bab-primary-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bab-primary"
                  onClick={handleConfirmDismiss}
                >
                  Yes, hide
                </button>
                <button
                  className="cursor-pointer rounded bg-bab-bg-hover px-3 py-1 text-xs font-medium text-bab-text border-none outline-none transition-all duration-150 ease-in-out hover:bg-bab-border focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bab-primary"
                  onClick={handleCancelDismiss}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
