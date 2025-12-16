
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
        console.log('🔄 Initializing reCAPTCHA Enterprise...');
        
        if (!window.grecaptcha) {
             cleanupRecaptcha();
        }

        const existingScript = document.querySelector(`script[src*="${siteKey}"]`);
        
        if (!existingScript || !window.grecaptcha) {
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement('script');
                // Use enterprise.js which is often required for GCP backend APIs
                script.src = `https://www.google.com/recaptcha/enterprise.js?render=${siteKey}`;
                script.async = true;
                script.defer = true;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Failed to load reCAPTCHA script'));
                document.head.appendChild(script);
            });
        }

        const execute = async () => {
             try {
                console.log('🤖 Executing reCAPTCHA...');
                let token;
                
                // Try Enterprise method first, fallback to standard V3
                if (window.grecaptcha.enterprise) {
                    await new Promise<void>(resolve => window.grecaptcha.enterprise.ready(resolve));
                    token = await window.grecaptcha.enterprise.execute(siteKey, { action: 'VIDEO_GENERATION' });
                } else if (window.grecaptcha.ready) {
                    await new Promise<void>(resolve => window.grecaptcha.ready(resolve));
                    token = await window.grecaptcha.execute(siteKey, { action: 'VIDEO_GENERATION' });
                } else {
                    throw new Error('grecaptcha not initialized');
                }
                
                console.log('✅ Token received');
                setIsLoading(false);
                
                setTimeout(() => {
                    onVerify(token);
                    processingRef.current = false;
                }, 500);

              } catch (execError: any) {
                console.error('❌ Execution Error:', execError);
                if (execError?.message?.includes('Invalid site key') || !siteKey) {
                     setError('Invalid Site Key.');
                } else {
                     setError('Verification failed. Check console for details.');
                }
                setIsLoading(false);
                processingRef.current = false;
              }
        };

        // Ensure grecaptcha global is available before executing
        let checkCount = 0;
        const checkInterval = setInterval(() => {
            if (window.grecaptcha) {
                clearInterval(checkInterval);
                execute();
            } else if (checkCount > 20) { // Timeout after 2 seconds
                clearInterval(checkInterval);
                setError('Timeout loading reCAPTCHA.');
                setIsLoading(false);
            }
            checkCount++;
        }, 100);

      } catch (err) {
        console.error('❌ Setup Error:', err);
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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-70"></div>

        <div className="flex flex-col items-center justify-center text-center space-y-6">
          <h3 className="text-xl font-bold text-white tracking-tight">
            Security Check
          </h3>

          {isLoading && (
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-mono text-blue-400">AI</span>
                    </div>
                </div>
                <p className="text-neutral-400 text-sm animate-pulse">Verifying...</p>
            </div>
          )}

          {error && (
            <div className="animate-zoomIn">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <span className="text-2xl">⚠️</span>
              </div>
              <p className="text-red-400 text-sm font-medium mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm transition-all"
              >
                Close & Retry
              </button>
            </div>
          )}

          {!isLoading && !error && (
            <div className="animate-zoomIn">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                <span className="text-2xl">✅</span>
              </div>
              <p className="text-green-400 text-sm font-bold">Verified</p>
            </div>
          )}
        </div>
        
        <div className="mt-6 text-[10px] text-neutral-600 text-center">
            Protected by reCAPTCHA Enterprise
        </div>
      </div>
    </div>
  );
};

export default RecaptchaModal;
