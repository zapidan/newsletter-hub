import { FC, useEffect, useRef, useState } from 'react';

interface NewsletterIframeProps {
  htmlContent: string;
}

const NewsletterIframe: FC<NewsletterIframeProps> = ({ htmlContent }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      const doc = iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
        setIsLoading(false);
      }
    };

    iframe.addEventListener('load', handleLoad);
    iframe.src = 'about:blank'; // Trigger the load event

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [htmlContent]);

  return (
    <>
      {isLoading && <div>Loading...</div>}
      <iframe
        ref={iframeRef}
        sandbox="allow-same-origin"
        style={{ width: '100%', border: 'none', display: isLoading ? 'none' : 'block' }}
        title="Newsletter Content"
      />
    </>
  );
};

export default NewsletterIframe;