
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { type User, type Language } from '../../types';
import { updateUserProfile, saveUserPersonalAuthToken, getUserProfile } from '../../services/userService';
import {
    CheckCircleIcon, XIcon, EyeIcon, EyeOffIcon, ImageIcon, DatabaseIcon, TrashIcon, RefreshCwIcon, InformationCircleIcon, SparklesIcon, KeyIcon, ShieldCheckIcon, UploadIcon, CloudSunIcon, ClipboardIcon, SendIcon
} from '../Icons';
import Spinner from '../common/Spinner';
import Tabs, { type Tab } from '../common/Tabs';
import { getFormattedCacheStats, clearVideoCache } from '../../services/videoCacheService';
import { runComprehensiveTokenTest } from '../../services/imagenV3Service';
import { parseCookieFile } from '../../services/cookieUtils';
import { supabase } from '../../services/supabaseClient';

type SettingsTabId = 'profile' | 'cloud-login';

const getTabs = (): Tab<SettingsTabId>[] => {
    return [
        { id: 'profile', label: 'Profil & Cache' },
        { id: 'cloud-login', label: 'Google Access (ya29)' },
    ];
}

interface SettingsViewProps {
  currentUser: User;
  onUserUpdate: (user: User) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  assignTokenProcess: () => Promise<{ success: boolean; error: string | null; }>;
}

const CacheManagerPanel: React.FC = () => {
    const [stats, setStats] = useState<{ size: string; count: number } | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    const loadStats = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const s = await getFormattedCacheStats();
            setStats(s);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const handleClear = async () => {
        if (window.confirm("Kosongkan cache video?")) {
            setIsClearing(true);
            try {
                await clearVideoCache();
                await loadStats();
            } finally {
                setIsClearing(false);
            }
        }
    };

    return (
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl mt-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                    <DatabaseIcon className="w-5 h-5 text-brand-start"/> 
                    Video Cache Manager
                </h3>
                <button onClick={loadStats} disabled={isRefreshing} className="p-2 rounded-full hover:bg-white/10 text-neutral-400">
                    <RefreshCwIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
                    <p className="text-[10px] font-bold text-neutral-500 uppercase mb-1">Storage</p>
                    <p className="text-xl font-bold text-white">{stats?.size || '0 MB'}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
                    <p className="text-[10px] font-bold text-neutral-500 uppercase mb-1">Files</p>
                    <p className="text-xl font-bold text-white">{stats?.count || 0}</p>
                </div>
            </div>
            <button onClick={handleClear} disabled={isClearing} className="w-full bg-red-500/10 border border-red-500/30 text-red-500 py-3 rounded-xl font-bold hover:bg-red-500/20 transition-all">
                {isClearing ? <Spinner /> : "Kosongkan Cache"}
            </button>
        </div>
    );
};

const CloudLoginPanel: React.FC<{currentUser: User, onUserUpdate: (u: User) => void}> = ({ currentUser, onUserUpdate }) => {
    const [token, setToken] = useState(currentUser.personalAuthToken || '');
    const [showToken, setShowToken] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isBridgeActive, setIsBridgeActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // REAL-TIME LISTENER
    useEffect(() => {
        const channel = supabase
            .channel('token-sync')
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'users',
                filter: `id=eq.${currentUser.id}`
            }, (payload) => {
                const newToken = payload.new.personal_auth_token;
                if (newToken && newToken !== token) {
                    setToken(newToken);
                    onUserUpdate(payload.new as User);
                    setIsBridgeActive(true);
                    setTimeout(() => setIsBridgeActive(false), 5000);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentUser.id, token, onUserUpdate]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const extracted = await parseCookieFile(file);
            if (extracted) {
                setToken(extracted);
                const res = await saveUserPersonalAuthToken(currentUser.id, extracted);
                if (res.success) onUserUpdate(res.user);
            } else {
                alert("Token ya29 tidak ditemui.");
            }
        } catch (err) { alert("Format fail tidak sah."); }
    };

    const copyBridgeSnippet = () => {
        const snippet = `
(async () => {
  console.log("%c MONOklix Quantum Bridge V4 (Ultimate Sync) ", "background: #4A6CF7; color: white; font-weight: bold; padding: 4px; border-radius: 4px;");
  
  const userId = "${currentUser.id}";
  const siteKey = "6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV";
  let ya29 = "";

  try {
    // 1. Capture ya29
    const sessionRes = await fetch("https://labs.google/fx/api/auth/session");
    if(sessionRes.ok) {
        const data = await sessionRes.json();
        ya29 = data.accessToken || data.access_token || data.token;
    }

    if(!ya29) throw new Error("Gagal mengambil ya29. Pastikan tab Flow aktif.");

    // 2. Generate reCAPTCHA Token
    console.log("🔐 Generating reCAPTCHA verification...");
    const recaptchaToken = await grecaptcha.enterprise.execute(siteKey, {action: 'PINHOLE_GENERATE'});
    
    // 3. Combine into Hybrid Payload
    const hybridPayload = ya29 + "[REC]" + recaptchaToken;

    // 4. Sync ke MONOklix
    console.log("🚀 Syncing Ultimate Payload to MONOklix...");
    const res = await fetch("https://xbbhllhgbachkzvpxvam.supabase.co/rest/v1/users?id=eq." + userId, {
      method: "PATCH",
      headers: {
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiYmhsbGhnYmFjaGt6dnB4dmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4Njk1NjksImV4cCI6MjA3MzQ0NTU2OX0.l--gaQSJ5hPnJyZOC9-QsRRQjr-hnsX_WeGSglbNP8E",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiYmhsbGhnYmFjaGt6dnB4dmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4Njk1NjksImV4cCI6MjA3MzQ0NTU2OX0.l--gaQSJ5hPnJyZOC9-QsRRQjr-hnsX_WeGSglbNP8E",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ personal_auth_token: hybridPayload })
    });

    if(res.ok) {
       console.log("%c ✅ ULTIMATE SYNC SUCCESS! ", "background: #10b981; color: white; font-weight: bold; padding: 4px; border-radius: 4px;");
       alert("SINKRONISASI ULTIMATE BERJAYA! Veo & Imagen kini sedia digunakan.");
    }
  } catch (e) {
    console.error("❌ Bridge Error:", e.message);
    alert("Ralat: " + e.message);
  }
})();`.trim();
        
        navigator.clipboard.writeText(snippet);
        alert("Quantum Bridge V4 (Ultimate Sync) disalin!\n\n1. Pergi ke tab Google Labs\n2. Tekan F12 -> Console\n3. Paste & Enter.");
    };

    return (
        <div className="space-y-6">
            {/* Quantum Bridge Card */}
            <div className="bg-gradient-to-br from-brand-start/20 to-brand-end/10 border border-brand-start/30 p-6 rounded-3xl shadow-glow animate-zoomIn relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <RefreshCwIcon className={`w-24 h-24 ${isBridgeActive ? 'animate-spin' : ''}`} />
                </div>
                
                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                            <SparklesIcon className="w-6 h-6 text-yellow-400" />
                            Quantum Bridge Sync
                        </h3>
                        <p className="text-sm text-neutral-400 mt-1 max-w-md">Cara paling pantas & automatik untuk mendapatkan token <strong>ya29</strong> dan <strong>reCAPTCHA</strong> terus dari sumber Google.</p>
                    </div>
                    {isBridgeActive && (
                        <div className="bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-full animate-bounce">
                            SYNCED!
                        </div>
                    )}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <button 
                        onClick={copyBridgeSnippet}
                        className="flex-1 bg-white text-black py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                    >
                        <ClipboardIcon className="w-5 h-5" /> Salin Skrip Quantum Bridge (V4)
                    </button>
                    <a 
                        href="https://labs.google/fx/tools/flow" 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-shrink-0 bg-white/10 border border-white/10 text-white px-6 py-4 rounded-2xl font-bold text-sm hover:bg-white/20 transition-all flex items-center gap-2"
                    >
                        Buka Google Labs <SendIcon className="w-4 h-4" />
                    </a>
                </div>
                
                <div className="mt-4 flex items-center gap-2 text-[10px] text-neutral-500 font-mono">
                    <ShieldCheckIcon className="w-3 h-3 text-green-500" />
                    STATUS: ULTIMATE HANDSHAKE (V4) READY
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                            <KeyIcon className="w-5 h-5 text-brand-start" /> 
                            Manual Control
                        </h3>
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold text-neutral-400 hover:text-white transition-colors">
                        Import session.json
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-2 tracking-widest">Active Token (ya29)</label>
                        <input 
                            type={showToken ? "text" : "password"} 
                            value={token} 
                            onChange={(e) => setToken(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 pr-12 text-white font-mono text-xs"
                            placeholder="ya29.A0AX..."
                        />
                        <button onClick={() => setShowToken(!showToken)} className="absolute right-4 top-8 text-neutral-500 hover:text-white">
                            {showToken ? <EyeOffIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                        </button>
                    </div>

                    <button onClick={async () => {
                        const res = await saveUserPersonalAuthToken(currentUser.id, token);
                        if (res.success) {
                            onUserUpdate(res.user);
                            alert("Token disimpan!");
                        }
                    }} className="w-full bg-brand-start py-3 rounded-xl font-bold shadow-lg hover:shadow-brand-start/40 transition-all">
                        Simpan Perubahan Manual
                    </button>
                </div>
            </div>
        </div>
    );
};

const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, onUserUpdate, language, setLanguage, assignTokenProcess }) => {
    const [activeTab, setActiveTab] = useState<SettingsTabId>('cloud-login');
    const [fullName, setFullName] = useState(currentUser.fullName || currentUser.username);

    const handleSaveProfile = async () => {
        const result = await updateUserProfile(currentUser.id, { fullName });
        if (result.success) {
            onUserUpdate(result.user);
            alert("Profil dikemaskini!");
        }
    };

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto">
            <h1 className="text-3xl font-black text-white mb-6 tracking-tight">Settings</h1>
            <div className="mb-8 flex justify-center">
                <Tabs tabs={getTabs()} activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                {activeTab === 'profile' ? (
                    <div className="space-y-6">
                        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                            <h3 className="text-lg font-bold mb-4 text-white">Informasi Profil</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Nama Penuh</label>
                                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:ring-2 focus:ring-brand-start outline-none" />
                                </div>
                                <button onClick={handleSaveProfile} className="bg-brand-start text-white px-6 py-2 rounded-xl font-bold hover:scale-105 transition-all">Simpan Profil</button>
                            </div>
                        </div>
                        <CacheManagerPanel />
                    </div>
                ) : (
                    <CloudLoginPanel currentUser={currentUser} onUserUpdate={onUserUpdate}/>
                )}
            </div>
        </div>
    );
};

export default SettingsView;
