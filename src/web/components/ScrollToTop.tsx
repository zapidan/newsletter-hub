import { ChevronUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ScrollToTopProps {
  /** Show the button after scrolling down this many pixels */
  showThreshold?: number;
  /** CSS class name for additional styling */
  className?: string;
  /** Position of the button */
  position?: 'bottom-right' | 'bottom-left' | 'fixed-bottom-right';
  /** CSS selector for the scroll container (defaults to app layout main) */
  targetSelector?: string;
}

const ScrollToTop = ({
  showThreshold = 200,
  className = '',
  position = 'bottom-right',
  targetSelector = 'main.overflow-y-auto'
}: ScrollToTopProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const scrollTargetsRef = useRef<Array<HTMLElement | Window>>([]);

  useEffect(() => {
    // Resolve potential scroll containers
    const explicit = (document.querySelector(targetSelector) as HTMLElement) || null;
    const mainEl = (document.querySelector('main.overflow-y-auto') as HTMLElement) || null;
    const overflowEls = Array.from(document.querySelectorAll('.overflow-auto, .overflow-y-auto')) as HTMLElement[];

    const uniqueTargets = new Set<HTMLElement | Window>();
    if (explicit) uniqueTargets.add(explicit);
    if (mainEl) uniqueTargets.add(mainEl);
    overflowEls.forEach(el => uniqueTargets.add(el));
    uniqueTargets.add(window);

    // Pick scrollable ones, otherwise fall back to window
    const scrollables = Array.from(uniqueTargets).filter(t => {
      if (t instanceof Window) return true;
      const el = t as HTMLElement;
      return el.scrollHeight > el.clientHeight;
    });

    scrollTargetsRef.current = scrollables.length ? scrollables : [window];

    const handleScroll = () => {
      const maxTop = scrollTargetsRef.current.reduce((max, t) => {
        const top = t instanceof Window ? window.scrollY : (t as HTMLElement).scrollTop;
        return Math.max(max, top);
      }, 0);
      setIsVisible(maxTop > showThreshold);
    };

    // Initial check
    handleScroll();

    // Attach listeners to all targets
    const add = (t: HTMLElement | Window) => {
      t.addEventListener('scroll', handleScroll as EventListener, { passive: true } as AddEventListenerOptions);
    };
    const remove = (t: HTMLElement | Window) => {
      t.removeEventListener('scroll', handleScroll as EventListener);
    };

    scrollTargetsRef.current.forEach(add);
    return () => {
      scrollTargetsRef.current.forEach(remove);
    };
  }, [showThreshold, targetSelector]);

  const scrollToTop = () => {
    const targets = scrollTargetsRef.current.length ? scrollTargetsRef.current : [window];
    targets.forEach(t => {
      if (t instanceof Window) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        try {
          (t as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          (t as HTMLElement).scrollTop = 0;
        }
      }
    });
    // Final window/document fallback
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  if (!isVisible) {
    return null;
  }

  const positionClasses = {
    'bottom-right': 'fixed bottom-6 right-6',
    'bottom-left': 'fixed bottom-6 left-6',
    'fixed-bottom-right': 'fixed bottom-8 right-8'
  };

  return (
    <button
      onClick={scrollToTop}
      className={`
        ${positionClasses[position]}
        z-50
        flex
        items-center
        justify-center
        w-10
        h-10
        bg-blue-600
        hover:bg-blue-700
        text-white
        rounded-full
        shadow-lg
        transition-all
        duration-200
        ease-in-out
        transform
        hover:scale-110
        focus:outline-none
        focus:ring-2
        focus:ring-blue-500
        focus:ring-offset-2
        ${className}
      `}
      aria-label="Scroll to top"
      title="Scroll to top"
    >
      <ChevronUp className="w-5 h-5" />
    </button>
  );
};

export default ScrollToTop;
