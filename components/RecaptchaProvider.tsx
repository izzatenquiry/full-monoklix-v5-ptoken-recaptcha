import React, { useState, useEffect, useCallback } from 'react';
import RecaptchaModal from './common/RecaptchaModal';
import { RECAPTCHA_SITE_KEY } from '../services/recaptchaService';

interface RecaptchaProviderProps {
  children: React.ReactNode;
}

/**
 * RecaptchaProvider wraps the app and listens for recaptcha requests
 * When VEO3 service needs recaptcha, it dispatches 'request-recaptcha' event
 * This provider shows the modal and handles the verification flow
 */
const RecaptchaProvider: React.FC<RecaptchaProviderProps> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [onVerifyCallback, setOnVerifyCallback] = useState<((token: string) => void) | null>(null);
  const [onCancelCallback, setOnCancelCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    const handleRecaptchaRequest = (event: CustomEvent) => {
      console.log('🔐 reCAPTCHA request received');
      setOnVerifyCallback(() => event.detail.onVerify);
      setOnCancelCallback(() => event.detail.onCancel);
      setIsModalOpen(true);
    };

    window.addEventListener('request-recaptcha', handleRecaptchaRequest as EventListener);

    return () => {
      window.removeEventListener('request-recaptcha', handleRecaptchaRequest as EventListener);
    };
  }, []);

  const handleVerify = useCallback((token: string) => {
    console.log('✅ reCAPTCHA verified, calling callback');
    if (onVerifyCallback) {
      onVerifyCallback(token);
    }
    setIsModalOpen(false);
    setOnVerifyCallback(null);
    setOnCancelCallback(null);
  }, [onVerifyCallback]);

  const handleClose = useCallback(() => {
    console.log('❌ reCAPTCHA modal closed by user');
    if (onCancelCallback) {
      onCancelCallback();
    }
    setIsModalOpen(false);
    setOnVerifyCallback(null);
    setOnCancelCallback(null);
  }, [onCancelCallback]);

  return (
    <>
      {children}
      <RecaptchaModal
        isOpen={isModalOpen}
        onVerify={handleVerify}
        onClose={handleClose}
        siteKey={RECAPTCHA_SITE_KEY}
      />
    </>
  );
};

export default RecaptchaProvider;