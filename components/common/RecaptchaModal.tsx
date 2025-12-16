import React, { useEffect, useRef, useState } from 'react';

interface RecaptchaModalProps {
  isOpen: boolean;
  onVerify: (token: string) => void;
  onClose: () => void;
  siteKey: string;
}

declare global {
  interface Window {
    grecaptcha: {
      enterprise: {
        ready: (callback: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
  }
}

/**
 * RecaptchaModal for Enterprise/Score-based keys (invisible verification)
 * This doesn't show a checkbox - it runs in background and shows loading state
 */
const RecaptchaModal: React.FC<RecaptchaModalProps> = ({ 
  isOpen, 
  onVerify, 
  onClose,
  siteKey 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasExecutedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || hasExecutedRef.current) return;

    const executeRecaptcha = async () => {
      try {
        // Check if script already loaded
        if (window.grecaptcha?.enterprise) {
          await runVerification();
          return;
        }

        // Load reCAPTCHA Enterprise script
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/enterprise.js?render=${siteKey}`;
        script.async = true;
        script.defer = true;
        
        script.onload = async () => {
          await runVerification();
        };
        
        script.onerror = () => {
          setError('Failed to load reCAPTCHA. Please check your internet connection.');
          setIsLoading(false);
        };

        document.head.appendChild(script);
      } catch (error) {
        console.error('Error setting up reCAPTCHA:', error);
        setError('Failed to initialize reCAPTCHA.');
        setIsLoading(false);
      }
    };

    const runVerification = async () => {
      if (!window.grecaptcha?.enterprise) {
        setError('reCAPTCHA not loaded properly.');
        setIsLoading(false);
        return;
      }

      try {
        // Wait for grecaptcha to be ready
        window.grecaptcha.enterprise.ready(async () => {
          try {
            hasExecutedRef.current = true;
            
            // Execute enterprise verification with 'veo_generate' action
            const token = await window.grecaptcha.enterprise.execute(siteKey, {
              action: 'veo_generate'
            });

            console.log('✅ reCAPTCHA Enterprise token generated:', token.substring(0, 20) + '...');
            setIsLoading(false);
            
            // Auto-verify after a brief delay (to show the modal briefly)
            setTimeout(() => {
              onVerify(token);
            }, 500);

          } catch (execError) {
            console.error('Error executing reCAPTCHA:', execError);
            setError('Verification failed. Please try again.');
            setIsLoading(false);
          }
        });
      } catch (error) {
        console.error('Error in reCAPTCHA ready:', error);
        setError('Verification initialization failed.');
        setIsLoading(false);
      }
    };

    executeRecaptcha();

    // Cleanup
    return () => {
      hasExecutedRef.current = false;
    };
  }, [isOpen, siteKey, onVerify]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">
            🔒 Security Verification
          </h3>
          {!isLoading && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
        
        <div className="flex flex-col items-center justify-center min-h-[120px]">
          {isLoading && (
            <>
              <div className="mb-3">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
              <p className="text-gray-300 text-sm text-center">
                Verifying your request...
              </p>
              <p className="text-gray-500 text-xs text-center mt-2">
                This is an automated security check by Google
              </p>
            </>
          )}

          {error && (
            <div className="text-center">
              <div className="text-red-400 text-sm mb-3">❌ {error}</div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {!isLoading && !error && (
            <div className="text-center">
              <div className="text-green-400 text-sm mb-2">✅ Verification successful!</div>
              <p className="text-gray-400 text-xs">Proceeding with your request...</p>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 text-center mt-4">
          This verification is required by Google's security policies.
          <br />
          Your verification will be used only for this video generation request.
        </div>
      </div>
    </div>
  );
};

export default RecaptchaModal;