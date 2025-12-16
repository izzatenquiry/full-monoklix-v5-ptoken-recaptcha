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
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const RecaptchaModal: React.FC<RecaptchaModalProps> = ({ 
  isOpen, 
  onVerify, 
  onClose,
  siteKey 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!isOpen || processingRef.current) return;
    processingRef.current = true;

    const cleanupRecaptcha = () => {
        const badges = document.querySelectorAll('.grecaptcha-badge');
        badges.forEach(b => b.remove());
        const scripts = document.querySelectorAll('script[src*="recaptcha"]');
        scripts.forEach(s => s.remove());
        // @ts-ignore
        window.grecaptcha = undefined;
    };

    const loadAndExecute = async () => {
      try {
        console.log('🔐 Initializing reCAPTCHA Enterprise...');
        
        // Force cleanup to prevent conflicts
        if (window.grecaptcha) {
             cleanupRecaptcha();
        }

        await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            // ✅ FIXED: Using Enterprise API (not standard v3)
            script.src = `https://www.google.com/recaptcha/enterprise.js?render=${siteKey}`;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load reCAPTCHA Enterprise script'));
            document.head.appendChild(script);
        });

        window.grecaptcha.ready(async () => {
          try {
            console.log('🔒 Executing reCAPTCHA Enterprise...');
            // Execute with 'submit' action (Google validates this)
            const token = await window.grecaptcha.execute(siteKey, { action: 'submit' });
            
            console.log('✅ reCAPTCHA Enterprise token generated:', token.substring(0, 20) + '...');
            setIsLoading(false);
            
            setTimeout(() => {
                console.log('✅ reCAPTCHA verified, calling callback');
                onVerify(token);
                processingRef.current = false;
            }, 500);

          } catch (execError: any) {
            console.error('❌ reCAPTCHA Execution Error:', execError);
            setError('Verification failed. Please try again.');
            setIsLoading(false);
            processingRef.current = false;
          }
        });

      } catch (err) {
        console.error('❌ reCAPTCHA Setup Error:', err);
        setError('Failed to initialize security check.');
        setIsLoading(false);
        processingRef.current = false;
      }
    };

    loadAndExecute();

    return () => {
        processingRef.current = false;
    };
  }, [isOpen, siteKey, onVerify]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-zoomIn">
      <div className="bg-[#111] border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col items-center justify-center text-center space-y-6">
          <h3 className="text-xl font-bold text-white tracking-tight">Security Check</h3>
          {isLoading && (
            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-neutral-400 text-sm animate-pulse">Verifying with reCAPTCHA Enterprise...</p>
            </div>
          )}
          {error && (
            <div className="animate-zoomIn">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20"><span className="text-2xl">⚠️</span></div>
              <p className="text-red-400 text-sm font-medium mb-4">{error}</p>
              <button onClick={onClose} className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm transition-all">Close & Retry</button>
            </div>
          )}
          {!isLoading && !error && (
            <div className="animate-zoomIn">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20"><span className="text-2xl">✅</span></div>
              <p className="text-green-400 text-sm font-bold">Verified!</p>
            </div>
          )}
        </div>
        <div className="mt-6 text-[10px] text-neutral-600 text-center">Protected by reCAPTCHA Enterprise</div>
      </div>
    </div>
  );
};

export default RecaptchaModal;