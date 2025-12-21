
import React, { useState, useEffect } from 'react';
import { type User, type Language } from '../../types';
import { updateUserProfile, saveUserPersonalAuthToken, saveUserRecaptchaToken } from '../../services/userService';
import {
    EyeIcon, EyeOffIcon, RefreshCwIcon, SparklesIcon, KeyIcon, ClipboardIcon, SendIcon, CheckCircleIcon, AlertTriangleIcon, DatabaseIcon
} from '../Icons';
import Tabs, { type Tab } from '../common/Tabs';
import { clearVideoCache } from '../../services/videoCacheService';
import Spinner from '../common/Spinner';

type SettingsTabId = 'profile';

const getTabs = (): Tab<SettingsTabId>[] => [
    { id: 'profile', label: 'Profil & Quantum Activation' },
];

interface SettingsViewProps {
  currentUser: User;
  onUserUpdate: (user: User) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  assignTokenProcess: () => Promise<any>;
}

const ActivationPanel: React.FC<{currentUser: User, onUserUpdate: (u: User) => void}> = ({ currentUser, onUserUpdate }) => {
    const [ya29Input, setYa29Input] = useState(currentUser.personalAuthToken || '');
    const [recaptchaInput, setRecaptchaInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [showYa29, setShowYa29] = useState(false);

    const handleSync = async () => {
        if (!ya29Input.trim() || !recaptchaInput.trim()) return;
        
        setIsSaving(true);
        setSaveStatus('idle');
        
        try {
            console.log("💾 Handshaking Quantum Data to Supabase...");
            const resYa29 = await saveUserPersonalAuthToken(currentUser.id, ya29Input.trim());
            const resRec = await saveUserRecaptchaToken(currentUser.id, recaptchaInput.trim());
            
            if (resYa29.success && resRec.success) {
                onUserUpdate(resRec.user); 
                setSaveStatus('success');
                setRecaptchaInput(''); // Clear for security since reCAPTCHA is 1-time use
            } else {
                setSaveStatus('error');
            }
        } catch (e) {
            console.error("Sync failed:", e);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveStatus('idle'), 4000);
        }
    };

    const copyBridgeScript = () => {
        const siteKey = "6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV";
        const snippet = `
(async () => {
  console.log("%c 🚀 MONOklix Quantum Bridge V7 (Robust Edition) ", "background: #4A6CF7; color: white; padding: 10px; border-radius: 8px; font-weight: bold;");
  
  try {
    // 1. Verifikasi Status Login (Ikut logic Electron extractor)
    const isLoggedIn = document.querySelector('[aria-label*="Google Account"]') !== null || 
                       document.querySelector('img[alt*="Google Account"]') !== null;
    
    if (!isLoggedIn) {
        alert("❌ Ralat: Sesi Google tidak dikesan. Sila pastikan anda sudah login akaun Google AI anda.");
        return;
    }

    console.log("🔑 Mencari Access Token (ya29) melalui Deep Recursive Scan...");
    const sessionRes = await fetch('https://labs.google/fx/api/auth/session');
    const sessionData = await sessionRes.json();
    
    // Logic Deep Scan: Menggeledah seluruh JSON untuk cari string bermula 'ya29.'
    const findYa29 = (obj) => {
        if (typeof obj === 'string' && obj.startsWith('ya29.')) return obj;
        if (typeof obj !== 'object' || obj === null) return null;
        for (let key in obj) {
            const found = findYa29(obj[key]);
            if (found) return found;
        }
        return null;
    };

    const ya29 = findYa29(sessionData);

    console.log("🔐 Menjana reCAPTCHA Handshake (Action: PINHOLE_GENERATE)...");
    // CRITICAL: Guna grecaptcha.enterprise ikut kod flow-automator
    const recToken = await grecaptcha.enterprise.execute('${siteKey}', {action: 'PINHOLE_GENERATE'});

    console.log("%c ✅ QUANTUM DATA EXTRACTED ", "color: #A05BFF; font-weight: bold; font-size: 14px;");
    console.log("--- SILA SALIN DATA DI BAWAH ---");
    console.log("YA29_TOKEN:", ya29);
    console.log("RECAPTCHA_TOKEN:", recToken);
    console.log("--- END ---");
    
    if(!ya29) {
        alert("⚠️ Ralat: YA29_TOKEN tidak dijumpai. STRATEGI FALLBACK: Muat semula tab Flow dan cuba lagi.");
    } else {
        alert("✅ Berjaya! Sila salin YA29_TOKEN dan RECAPTCHA_TOKEN dari Console (F12) ke MONOklix.");
    }
  } catch (e) {
    alert("❌ Gagal: Pastikan anda berada di tab FLOW Google Labs.");
    console.error(e);
  }
})();`.trim();
        
        navigator.clipboard.writeText(snippet);
        alert("Skrip V7 disalin! Paste dlm Console Google Labs tab FLOW.");
    };

    return (
        <div className="space-y-6">
            {/* Guide Card */}
            <div className="bg-gradient-to-br from-brand-start/20 to-brand-end/10 border border-brand-start/30 p-6 rounded-3xl relative overflow-hidden shadow-glow">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                         <div className="w-10 h-10 bg-brand-start/20 rounded-full flex items-center justify-center border border-brand-start/40">
                            <SparklesIcon className="w-6 h-6 text-yellow-400" />
                         </div>
                         <h3 className="text-xl font-black text-white">Quantum Activation</h3>
                    </div>
                    <p className="text-sm text-neutral-400 mt-1">Gunakan sesi personal Google anda untuk bypass limit Proxy MONOklix secara selamat.</p>
                    
                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <button onClick={copyBridgeScript} className="flex-1 bg-white text-black py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-all shadow-lg active:scale-95">
                            <ClipboardIcon className="w-5 h-5" /> Salin Skrip V7 (Deep Scan)
                        </button>
                        <a href="https://labs.google/fx/tools/flow" target="_blank" rel="noreferrer" className="bg-white/10 text-white px-6 py-4 rounded-2xl font-bold text-sm hover:bg-white/20 transition-all flex items-center gap-2 justify-center">
                            Buka Google Labs <SendIcon className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Sync Form - Screenshot Aligned */}
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-5">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <KeyIcon className="w-5 h-5 text-brand-start" /> Activation Data Sync
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Personal Access Token (ya29)</label>
                            <button onClick={() => setShowYa29(!showYa29)} className="text-neutral-500 hover:text-white transition-colors">
                                {showYa29 ? <EyeOffIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                            </button>
                        </div>
                        <input 
                            type={showYa29 ? "text" : "password"} 
                            value={ya29Input} 
                            onChange={(e) => setYa29Input(e.target.value)}
                            placeholder="ya29.xxxx..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-mono text-xs focus:ring-1 focus:ring-brand-start outline-none transition-all" 
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">reCAPTCHA Handshake Token</label>
                        <input 
                            type="password" 
                            value={recaptchaInput} 
                            onChange={(e) => setRecaptchaInput(e.target.value)}
                            placeholder="Tampal token 03AFcY... dari Console"
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-mono text-xs focus:ring-1 focus:ring-brand-start outline-none transition-all" 
                        />
                        <div className="flex items-center gap-2 mt-1.5">
                            <AlertTriangleIcon className="w-3 h-3 text-yellow-500" />
                            <p className="text-[9px] text-yellow-500 font-bold uppercase tracking-tighter">AMARAN: Token reCAPTCHA tamat tempoh dlm 2 MINIT!</p>
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    <button 
                        onClick={handleSync}
                        disabled={isSaving || !ya29Input || !recaptchaInput}
                        className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-lg
                            ${saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-brand-start text-white hover:bg-brand-start/80'}
                            ${(isSaving || !ya29Input || !recaptchaInput) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01]'}
                        `}
                    >
                        {isSaving ? <Spinner /> : saveStatus === 'success' ? <CheckCircleIcon className="w-5 h-5 animate-zoomIn"/> : <RefreshCwIcon className="w-5 h-5"/>}
                        {saveStatus === 'success' ? 'SYNC SUCCESSFUL!' : 'ACTIVATE & SYNC TO DATABASE'}
                    </button>
                    {saveStatus === 'success' && <p className="text-center text-[10px] text-green-500 mt-2 font-bold animate-pulse uppercase tracking-tighter">Handshake Berjaya! Sesi personal anda sedia digunakan.</p>}
                </div>
            </div>
        </div>
    );
};

const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, onUserUpdate, language, setLanguage, assignTokenProcess }) => {
    const [activeTab, setActiveTab] = useState<SettingsTabId>('profile');
    const [fullName, setFullName] = useState(currentUser.fullName || currentUser.username);

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto px-4">
            <div className="mb-8">
                <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Settings</h1>
                <p className="text-neutral-500 mt-1">Urus konfigurasi profil dan verifikasi Quantum Bridge anda.</p>
            </div>
            
            <div className="mb-8 flex justify-start">
                <Tabs tabs={getTabs()} activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                <div className="space-y-8 animate-zoomIn">
                    {/* Activation Panel di Atas Sekali */}
                    <ActivationPanel currentUser={currentUser} onUserUpdate={onUserUpdate}/>

                    {/* Profile & Media Cache */}
                    <div className="space-y-6">
                        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-3">Display Name</label>
                            <input 
                                type="text" 
                                value={fullName} 
                                onChange={(e) => setFullName(e.target.value)} 
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white mb-6 focus:ring-1 focus:ring-brand-start outline-none" 
                            />
                            <button onClick={async () => {
                                const res = await updateUserProfile(currentUser.id, { fullName });
                                if (res.success) onUserUpdate(res.user);
                                alert("Profile updated!");
                            }} className="bg-white text-black px-8 py-3 rounded-xl font-bold text-sm hover:scale-105 transition-all">Save Changes</button>
                        </div>
                        
                        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
                            <div className="flex items-center gap-3 mb-4">
                                <DatabaseIcon className="w-6 h-6 text-red-500" />
                                <h3 className="text-xl font-bold text-white tracking-tight uppercase">Media Cache Engine</h3>
                            </div>
                            <p className="text-sm text-neutral-500 mb-6">Padam cache video jika galeri tempatan mengalami ralat memuatkan fail.</p>
                            <button 
                                onClick={() => {
                                    if(confirm('Padam semua cache video?')) {
                                        clearVideoCache().then(() => alert('Cache cleared.'));
                                    }
                                }} 
                                className="bg-red-500/10 text-red-500 border border-red-500/20 px-8 py-3 rounded-xl font-bold text-sm hover:bg-red-500/20 transition-all active:scale-95"
                            >
                                Purge All Local Cache
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
