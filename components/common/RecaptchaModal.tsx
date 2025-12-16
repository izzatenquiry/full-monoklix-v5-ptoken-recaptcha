import React, { useEffect, useRef, useState } from 'react';

interface RecaptchaModalProps {
  isOpen: boolean;
  onVerify: (token: string) => void;
  onClose: () => void;
  siteKey: string;
}

declare global {
  interface Window {
    grecaptcha: any;
  }
}

const RecaptchaModal: React.FC<RecaptchaModalProps> = ({ 
  isOpen, 
  onVerify, 
  onClose,
  siteKey 
}) => {
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load reCAPTCHA script
    const loadRecaptcha = () => {
      if (window.grecaptcha) {
        renderRecaptcha();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        renderRecaptcha();
      };
      document.head.appendChild(script);
    };

    const renderRecaptcha = () => {
      if (!recaptchaRef.current || !window.grecaptcha) return;

      try {
        // Reset if already rendered
        if (widgetIdRef.current !== null) {
          window.grecaptcha.reset(widgetIdRef.current);
        } else {
          widgetIdRef.current = window.grecaptcha.render(recaptchaRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              console.log('✅ reCAPTCHA verified:', token.substring(0, 20) + '...');
              onVerify(token);
            },
            'expired-callback': () => {
              console.warn('⚠️ reCAPTCHA expired');
              alert('reCAPTCHA expired, please verify again');
            },
            'error-callback': () => {
              console.error('❌ reCAPTCHA error');
              alert('reCAPTCHA verification failed');
            }
          });
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error rendering reCAPTCHA:', error);
        setIsLoading(false);
      }
    };

    loadRecaptcha();

    return () => {
      if (widgetIdRef.current !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(widgetIdRef.current);
        } catch (e) {
          console.error('Error resetting reCAPTCHA:', e);
        }
      }
    };
  }, [isOpen, siteKey, onVerify]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">
            🔒 Security Verification Required
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        
        <p className="text-gray-300 text-sm mb-4">
          Google requires verification for VEO 3 video generation. Please complete the reCAPTCHA challenge below:
        </p>

        <div className="flex justify-center items-center min-h-[78px] mb-4">
          {isLoading && (
            <div className="text-gray-400 text-sm">
              Loading verification...
            </div>
          )}
          <div ref={recaptchaRef} className={isLoading ? 'hidden' : ''}></div>
        </div>

        <div className="text-xs text-gray-500 text-center">
          This verification is required by Google's security policies.
          <br />
          Your verification token will be used only for this video generation request.
        </div>
      </div>
    </div>
  );
};

export default RecaptchaModal;