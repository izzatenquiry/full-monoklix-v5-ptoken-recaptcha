
import React, { useState, useEffect } from 'react';
import { type User, type Language } from '../../types';
import { updateUserProfile, saveUserPersonalAuthToken } from '../../services/userService';
import {
    EyeIcon, EyeOffIcon, RefreshCwIcon, SparklesIcon, KeyIcon, ShieldCheckIcon, ClipboardIcon, SendIcon
} from '../Icons';
import Tabs, { type Tab } from '../common/Tabs';
import { clearVideoCache } from '../../services/videoCacheService';
import { supabase } from '../../services/supabaseClient';

type SettingsTabId = 'profile' | 'cloud-login';

const getTabs = (): Tab<SettingsTabId>[] => [
    { id: 'profile', label: 'Profil & Cache' },
    { id: 'cloud-login', label: 'Google Access (ya29)' },
];

interface SettingsViewProps {
  currentUser: User;
  onUserUpdate: (user: User) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  assignTokenProcess: () => Promise<any>;
}

const CloudLoginPanel: React.FC<{currentUser: User, onUserUpdate: (u: User) => void}> = ({ currentUser, onUserUpdate }) => {
    const [token, setToken] = useState(currentUser.personalAuthToken || '');
    const [showToken, setShowToken] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const channel = supabase
            .channel('token-sync')
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'users',
                filter: `id=eq.${currentUser.id}`
            }, (payload) => {
                const newData = payload.new;
                setToken(newData.personal_auth_token || '');
                onUserUpdate(newData as User);
                setIsSyncing(true);
                setTimeout(() => setIsSyncing(false), 3000);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentUser.id, onUserUpdate]);

    const copyBridgeSnippet = () => {
        const snippet = `
(async () => {
  const userId = "${currentUser.id}";
  const siteKey = "6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV";
  
  console.log("%c 🚀 Quantum Bridge V8: Activation Mode ", "background: #4A6CF7; color: white; font-weight: bold; padding: 10px; border-radius: 8px;");
  
  try {
    console.log("🔑 Mengambil sesi Google...");
    const sessionRes = await fetch('https://labs.google/fx/api/auth/session');
    const sessionData = await sessionRes.json();
    const ya29 = sessionData.accessToken;

    if (!ya29) throw new Error("AccessToken tidak dijumpai. Pastikan anda telah login ke Google Labs.");

    console.log("🔐 Menjana token pengesahan reCAPTCHA...");
    const recToken = await grecaptcha.enterprise.execute(siteKey, {action: 'PINHOLE_GENERATE'});

    if (ya29 && recToken) {
        console.log("📤 Mengaktifkan sesi di MONOklix...");
        await fetch("https://xbbhllhgbachkzvpxvam.supabase.co/rest/v1/users?id=eq." + userId, {
          method: "PATCH",
          headers: {
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiYmhsbGhnYmFjaGt6dnB4dmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4Njk1NjksImV4cCI6MjA3MzQ0NTU2OX0.l--gaQSJ5hPnJyZOC9-QsRRQjr-hnsX_WeGSglbNP8E",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiYmhsbGhnYmFjaGt6dnB4dmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4Njk1NjksImV4cCI6MjA3MzQ0NTU2OX0.l--gaQSJ5hPnJyZOC9-QsRRQjr-hnsX_WeGSglbNP8E",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ 
              personal_auth_token: ya29,
              recaptcha_token: recToken
          })
        });
        alert("✅ AKTIVASI BERJAYA! Sesi anda telah disahkan. Sila kembali ke MONOklix dan mulakan penjanaan dengan segera (bawah 2 minit).");
    } else {
        alert("❌ Gagal: Data tidak lengkap.");
    }
  } catch (e) { 
      console.error(e);
      alert("❌ Ralat: Sila pastikan tab Google Labs aktif dan anda telah login."); 
  }
})();`.trim();
        
        navigator.clipboard.writeText(snippet);
        alert("Skrip Aktivasi disalin!\n\n1. Pergi ke tab Google Labs\n2. F12 -> Console\n3. Paste & Enter.\n\nLepas tu terus balik sini dan Generate!");
    };

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-brand-start/20 to-brand-end/10 border border-brand-start/30 p-6 rounded-3xl relative overflow-hidden shadow-glow">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <RefreshCwIcon className={`w-24 h-24 ${isSyncing ? 'animate-spin' : ''}`} />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                         <div className="w-10 h-10 bg-brand-start/20 rounded-full flex items-center justify-center border border-brand-start/40">
                            <SparklesIcon className="w-6 h-6 text-yellow-400" />
                         </div>
                         <h3 className="text-xl font-black text-white">Quantum Bridge V8</h3>
                    </div>
                    <p className="text-sm text-neutral-400 mt-1 max-w-md">Aktifkan pengesahan <strong>ya29</strong> dan <strong>reCAPTCHA</strong> anda menggunakan endpoint internal Google. Token reCAPTCHA hanya sah untuk 2 minit.</p>
                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <button onClick={copyBridgeSnippet} className="flex-1 bg-white text-black py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-all shadow-lg active:scale-95">
                            <ClipboardIcon className="w-5 h-5" /> Salin Skrip Aktivasi
                        </button>
                        <a href="https://labs.google/fx/tools/flow" target="_blank" rel="noreferrer" className="bg-white/10 text-white px-6 py-4 rounded-2xl font-bold text-sm hover:bg-white/20 transition-all flex items-center gap-2">
                            Buka Google Labs <SendIcon className="w-4 h-4" />
                        </a>
                    </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[10px] text-neutral-500 font-mono">
                    <ShieldCheckIcon className={`w-3 h-3 ${isSyncing ? 'text-green-500' : 'text-neutral-500'}`} />
                    STATUS: {isSyncing ? 'ACTIVATED & SYNCED' : 'WAITING FOR HANDSHAKE'}
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <KeyIcon className="w-5 h-5 text-brand-start" /> Access Token Status
                </h3>
                <div className="space-y-4">
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-2">Google Access (ya29)</label>
                        <input type={showToken ? "text" : "password"} value={token} readOnly className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white font-mono text-xs opacity-60" />
                        <button onClick={() => setShowToken(!showToken)} className="absolute right-4 top-8 text-neutral-500 hover:text-white">
                            {showToken ? <EyeOffIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                        </button>
                    </div>
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
                        <p className="text-[10px] text-blue-400 font-medium leading-relaxed uppercase tracking-widest">
                            reCAPTCHA handshake is managed via X-Recaptcha-Token header.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, onUserUpdate, language, setLanguage, assignTokenProcess }) => {
    const [activeTab, setActiveTab] = useState<SettingsTabId>('cloud-login');
    const [fullName, setFullName] = useState(currentUser.fullName || currentUser.username);

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto">
            <h1 className="text-3xl font-black text-white mb-6">Settings</h1>
            <div className="mb-8 flex justify-center">
                <Tabs tabs={getTabs()} activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                {activeTab === 'profile' ? (
                    <div className="space-y-6">
                        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                            <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Nama Penuh</label>
                            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white mb-4" />
                            <button onClick={async () => {
                                const res = await updateUserProfile(currentUser.id, { fullName });
                                if (res.success) onUserUpdate(res.user);
                                alert("Profil dikemaskini!");
                            }} className="bg-brand-start text-white px-6 py-2 rounded-xl font-bold">Simpan Profil</button>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                            <h3 className="text-lg font-bold mb-4 text-white">Video Cache</h3>
                            <p className="text-sm text-neutral-400 mb-4">Urus storan video tempatan anda.</p>
                            <button onClick={() => clearVideoCache().then(() => alert('Cache dikosongkan!'))} className="bg-red-500/20 text-red-400 border border-red-500/30 px-6 py-2 rounded-xl font-bold hover:bg-red-500/30 transition-all">Kosongkan Cache</button>
                        </div>
                    </div>
                ) : (
                    <CloudLoginPanel currentUser={currentUser} onUserUpdate={onUserUpdate}/>
                )}
            </div>
        </div>
    );
};

export default SettingsView;
