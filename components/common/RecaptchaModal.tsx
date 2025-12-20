
import React, { useEffect, useRef, useState } from 'react';
import { RECAPTCHA_ACTION } from '../../services/recaptchaService';

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

    const loadAndExecute = async () => {
      try {
        console.log('[reCAPTCHA] Initializing security handshake...');
        
        // Remove existing scripts to avoid conflicts
        document.querySelectorAll('script[src*="recaptcha"]').forEach(s => s.remove());

        await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://www.google.com/recaptcha/enterprise.js?render=${siteKey}`;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Google Security Engine'));
            document.head.appendChild(script);
        });

        window.grecaptcha.enterprise.ready(async () => {
          try {
            console.log(`[reCAPTCHA] Executing action: ${RECAPTCHA_ACTION}`);
            
            // Execute exact same action as provided in recaptcha-extractor.js
            const token = await window.grecaptcha.enterprise.execute(siteKey, { 
                action: RECAPTCHA_ACTION 
            });
            
            setIsLoading(false);
            setTimeout(() => {
                onVerify(token);
                processingRef.current = false;
            }, 500);

          } catch (execError: any) {
            setError('Verification engine error. Please try again.');
            setIsLoading(false);
            processingRef.current = false;
          }
        });

      } catch (err) {
        setError('Connection to security services failed.');
        setIsLoading(false);
        processingRef.current = false;
      }
    };

    loadAndExecute();
    return () => { processingRef.current = false; };
  }, [isOpen, siteKey, onVerify]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-zoomIn">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-[0_0_50px_rgba(74,108,247,0.3)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-start to-transparent"></div>
        
        <div className="flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 bg-brand-start/10 rounded-2xl flex items-center justify-center border border-brand-start/20">
             <span className="text-2xl">🔒</span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">Security Handshake</h3>
          <p className="text-sm text-neutral-400">Verifying session with Google Enterprise...</p>
          
          {isLoading && (
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-brand-start/30 border-t-brand-start rounded-full animate-spin"></div>
                <p className="text-brand-start text-xs font-bold animate-pulse uppercase tracking-widest">Generating Token</p>
            </div>
          )}
          
          {error && (
            <div className="animate-zoomIn">
              <p className="text-red-400 text-sm font-medium mb-4">{error}</p>
              <button 
                onClick={onClose} 
                className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm transition-all"
              >
                Retry
              </button>
            </div>
          )}
          
          {!isLoading && !error && (
            <div className="animate-zoomIn flex flex-col items-center">
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-2 border border-green-500/20">
                <span className="text-xl">✅</span>
              </div>
              <p className="text-green-400 text-sm font-bold uppercase tracking-widest">Verified</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecaptchaModal;
