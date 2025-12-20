
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { type User, type Language } from '../../types';
import { updateUserProfile, saveUserPersonalAuthToken } from '../../services/userService';
import {
    CheckCircleIcon, XIcon, EyeIcon, EyeOffIcon, ImageIcon, DatabaseIcon, TrashIcon, RefreshCwIcon, InformationCircleIcon, SparklesIcon, KeyIcon, ShieldCheckIcon, UploadIcon, CloudSunIcon
} from '../Icons';
import Spinner from '../common/Spinner';
import Tabs, { type Tab } from '../common/Tabs';
import { getFormattedCacheStats, clearVideoCache } from '../../services/videoCacheService';
import { runComprehensiveTokenTest } from '../../services/imagenV3Service';
import { parseCookieFile } from '../../services/cookieUtils';

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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const extracted = await parseCookieFile(file);
            if (extracted) {
                setToken(extracted);
                const res = await saveUserPersonalAuthToken(currentUser.id, extracted);
                if (res.success) onUserUpdate(res.user);
                alert("Token ya29 berjaya diekstrak!");
            } else {
                alert("Token ya29 tidak ditemui dalam fail tersebut.");
            }
        } catch (err) { alert("Format fail tidak sah."); }
    };

    const handleTest = async () => {
        setIsTesting(true);
        const res = await runComprehensiveTokenTest(token);
        setIsTesting(false);
        const allOk = res.every(r => r.success);
        alert(allOk ? "Token Aktif ✅" : "Token Gagal/Expired ❌");
    };

    return (
        <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                            <KeyIcon className="w-6 h-6 text-brand-start" /> 
                            VEO3 Access Token
                        </h3>
                        <p className="text-sm text-neutral-400 mt-1">Gunakan token <strong>ya29</strong> untuk akses penjanaan video.</p>
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-brand-start/20 border border-brand-start/30 text-brand-start px-4 py-2 rounded-xl text-xs font-bold hover:bg-brand-start/30 transition-all">
                        <UploadIcon className="w-4 h-4" /> Import ya29
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Access Token (ya29.xxx)</label>
                        <input 
                            type={showToken ? "text" : "password"} 
                            value={token} 
                            onChange={(e) => setToken(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 pr-12 text-white font-mono text-sm"
                            placeholder="ya29.A0AX..."
                        />
                        <button onClick={() => setShowToken(!showToken)} className="absolute right-4 top-9 text-neutral-500 hover:text-white">
                            {showToken ? <EyeOffIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                        </button>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={handleTest} disabled={isTesting} className="flex-1 bg-white/10 border border-white/10 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition-all">
                            {isTesting ? <Spinner /> : <SparklesIcon className="w-4 h-4" />} Semak Token
                        </button>
                        <button onClick={async () => {
                            const res = await saveUserPersonalAuthToken(currentUser.id, token);
                            if (res.success) {
                                onUserUpdate(res.user);
                                alert("Token disimpan!");
                            }
                        }} className="flex-1 bg-brand-start py-3 rounded-xl font-bold shadow-lg hover:shadow-brand-start/40 transition-all">
                            Simpan Token
                        </button>
                    </div>
                </div>

                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <h4 className="text-xs font-bold text-blue-400 uppercase flex items-center gap-2 mb-2">
                        <InformationCircleIcon className="w-4 h-4" /> Cara Mendapatkan Token
                    </h4>
                    <p className="text-xs text-neutral-400">Muat naik fail <strong>session.json</strong> atau <strong>cookies.json</strong> yang dijana oleh extractor anda. Sistem akan mencari string yang bermula dengan 'ya29' secara automatik.</p>
                </div>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                    <ShieldCheckIcon className="w-5 h-5 text-green-500" /> reCAPTCHA Enterprise
                </h3>
                <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                    <span className="text-sm text-neutral-300">Google Security Actions</span>
                    <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded">PINHOLE_GENERATE ACTIVE</span>
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
            <h1 className="text-3xl font-black text-white mb-6">Settings</h1>
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
