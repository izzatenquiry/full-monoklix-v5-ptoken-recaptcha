
import { type User, type LoginResult, UserRole, UserStatus } from '../types';
import { supabase, type Database } from './supabaseClient';
import { loadData } from './indexedDBService';
import { MODELS } from './aiConfig';
import { APP_VERSION } from './appConfig';
import { v4 as uuidv4 } from 'uuid';
import { getProxyServers } from './contentService';
import { PROXY_SERVER_URLS } from './serverConfig';

type UserProfileData = Database['public']['Tables']['users']['Row'];

export interface AvailableApiKey {
    id: number;
    apiKey: string;
    createdAt: string;
}

const getErrorMessage = (error: unknown): string => {
    let message = 'An unknown error occurred.';
    if (error instanceof Error) {
        message = error.message;
    } else if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
        message = (error as any).message;
    } else if (typeof error === 'string') {
        message = error;
    } else {
        try { message = JSON.stringify(error); } catch { message = 'Unserializable error object.'; }
    }
    return message;
};

const mapProfileToUser = (profile: UserProfileData): User => {
  return {
    id: profile.id,
    email: profile.email,
    createdAt: profile.created_at,
    username: (profile.email || '').split('@')[0],
    fullName: profile.full_name || undefined,
    phone: profile.phone,
    role: profile.role as UserRole,
    status: profile.status as UserStatus,
    apiKey: profile.api_key,
    avatarUrl: profile.avatar_url || undefined,
    subscriptionExpiry: profile.subscription_expiry ? new Date(profile.subscription_expiry).getTime() : undefined,
    totalImage: profile.total_image ?? undefined,
    totalVideo: profile.total_video ?? undefined,
    lastSeenAt: profile.last_seen_at || undefined,
    forceLogoutAt: profile.force_logout_at || undefined,
    appVersion: profile.app_version || undefined,
    personalAuthToken: profile.personal_auth_token || undefined,
    proxyServer: profile.proxy_server || undefined,
    batch_02: profile.batch_02 || undefined,
    lastDevice: profile.last_device || undefined,
  };
};

export const initializeAdminAccount = async (): Promise<void> => {
    console.log("Admin account initialization check...");
    return Promise.resolve();
};

export const loginUser = async (email: string): Promise<LoginResult> => {
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail) return { success: false, message: 'emailRequired' };
    const { data: userData, error: userError } = await supabase.from('users').select('*').eq('email', cleanedEmail).single();
    if (userData && !userError) {
        const user = mapProfileToUser(userData as UserProfileData);
        return { success: true, user };
    }
    return { success: false, message: 'emailNotRegistered' };
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error || !data) return null;
    return mapProfileToUser(data as UserProfileData);
};

export const signOutUser = async (): Promise<void> => Promise.resolve();

export const getAllUsers = async (): Promise<User[] | null> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) return null;
    return (data as UserProfileData[]).map(profile => mapProfileToUser(profile));
};

export const replaceUsers = async (importedUsers: any[]): Promise<{ success: boolean; message: string }> => {
    try {
        console.log("Replacing users with imported data...", importedUsers);
        return { success: true, message: 'User database successfully replaced.' };
    } catch (e) {
        return { success: false, message: getErrorMessage(e) };
    }
};

export const exportAllUserData = async (): Promise<any[] | null> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) return null;
    return data;
};

export const updateUserStatus = async (userId: string, status: UserStatus): Promise<boolean> => {
    const updatePayload: any = { status };
    if (status !== 'subscription') updatePayload.subscription_expiry = null;
    const { error } = await supabase.from('users').update(updatePayload).eq('id', userId);
    return !error;
};

export const updateUserSubscription = async (userId: string, expiryMonths: 6 | 12): Promise<boolean> => {
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);
    const { error } = await supabase.from('users').update({ status: 'subscription', subscription_expiry: expiryDate.toISOString() }).eq('id', userId);
    return !error;
};

export const forceUserLogout = async (userId: string): Promise<boolean> => {
    const { error } = await supabase.from('users').update({ force_logout_at: new Date().toISOString() }).eq('id', userId);
    return !error;
};

export const updateUserProfile = async (userId: string, updates: { fullName?: string; email?: string; avatarUrl?: string }): Promise<{ success: true; user: User } | { success: false; message: string }> => {
    const profileUpdates: any = {};
    if (updates.fullName) profileUpdates.full_name = updates.fullName;
    if (updates.avatarUrl) profileUpdates.avatar_url = updates.avatarUrl;
    const { data: updatedData, error } = await supabase.from('users').update(profileUpdates).eq('id', userId).select().single();
    if (error || !updatedData) return { success: false, message: getErrorMessage(error) };
    return { success: true, user: mapProfileToUser(updatedData as UserProfileData) };
};

export const saveUserPersonalAuthToken = async (userId: string, token: string | null): Promise<{ success: true; user: User } | { success: false; message: string }> => {
    const { data, error } = await supabase.from('users').update({ personal_auth_token: token }).eq('id', userId).select().single();
    if (error || !data) return { success: false, message: getErrorMessage(error) };
    return { success: true, user: mapProfileToUser(data as UserProfileData) };
};

/**
 * Menyimpan token reCAPTCHA ke database untuk handshake Proxy.
 */
export const saveUserRecaptchaToken = async (userId: string, token: string | null): Promise<{ success: true; user: User } | { success: false; message: string }> => {
    const { data, error } = await supabase.from('users').update({ recaptcha_token: token }).eq('id', userId).select().single();
    if (error || !data) return { success: false, message: getErrorMessage(error) };
    return { success: true, user: mapProfileToUser(data as UserProfileData) };
};

export const saveUserApiKey = async (userId: string, apiKey: string | null): Promise<{ success: true; user: User } | { success: false; message: string }> => {
    const { data, error } = await supabase.from('users').update({ api_key: apiKey }).eq('id', userId).select().single();
    if (error || !data) return { success: false, message: getErrorMessage(error) };
    return { success: true, user: mapProfileToUser(data as UserProfileData) };
};

export const assignPersonalTokenAndIncrementUsage = async (userId: string, token: string): Promise<{ success: true; user: User } | { success: false; message: string }> => {
    try {
        const { data: rpcSuccess, error: rpcError } = await supabase.rpc('increment_token_if_available', { token_to_check: token });
        if (rpcError || rpcSuccess !== true) return { success: false, message: 'Token slot taken or error.' };
        const { data: updatedUserData, error: userUpdateError } = await supabase.from('users').update({ personal_auth_token: token }).eq('id', userId).select().single();
        if (userUpdateError || !updatedUserData) throw userUpdateError;
        return { success: true, user: mapProfileToUser(updatedUserData as UserProfileData) };
    } catch (error) {
        return { success: false, message: getErrorMessage(error) };
    }
};

export const logActivity = async (activity_type: 'login' | 'ai_generation', details?: any): Promise<void> => {
    const userJson = localStorage.getItem('currentUser');
    if (!userJson) return;
    const user = JSON.parse(userJson);
    try {
        const logData = { user_id: user.id, username: user.username, email: user.email, activity_type, ...details };
        await supabase.from('activity_log').insert(logData);
    } catch (e) {}
};

export const getVeoAuthTokens = async (): Promise<{ token: string; createdAt: string; totalUser: number }[] | null> => {
    const { data, error } = await supabase.from('token_new_active').select('token, created_at, total_user').order('created_at', { ascending: false }).limit(25);
    if (error || !data) return null;
    return data.map(item => ({ token: item.token, createdAt: item.created_at, totalUser: item.total_user || 0 }));
};

export const getSharedMasterApiKey = async (): Promise<string | null> => {
    const { data, error } = await supabase.from('master_api_key').select('api_key').order('created_at', { ascending: false }).limit(1).single();
    return data?.api_key || null;
};

export const getAvailableApiKeys = async (): Promise<AvailableApiKey[]> => {
    const { data, error } = await supabase
        .from('generated_api_keys')
        .select('*')
        .is('claimed_by_user_id', null);
    
    if (error) throw error;
    
    return data.map(item => ({
        id: item.id,
        apiKey: item.api_key,
        createdAt: item.created_at
    }));
};

export const claimApiKey = async (id: number, userId: string, username: string): Promise<{ success: boolean; message?: string }> => {
    const { error } = await supabase
        .from('generated_api_keys')
        .update({ 
            claimed_by_user_id: userId, 
            claimed_by_username: username, 
            claimed_at: new Date().toISOString() 
        })
        .eq('id', id);
    
    return { success: !error, message: error ? getErrorMessage(error) : undefined };
};

export const getAvailableServersForUser = async (user: User): Promise<string[]> => {
    let availableServers = PROXY_SERVER_URLS;
    if (user.role === 'admin') {
        const dynamicList = await getProxyServers();
        if (dynamicList.length > 0) availableServers = dynamicList;
    }
    const canAccessVip = user.role === 'admin' || user.role === 'special_user' || (user.role as string) === 'special user';
    if (!canAccessVip) availableServers = availableServers.filter(url => url !== 'https://s12.monoklix.com');
    return availableServers;
};

export const incrementImageUsage = async (user: User): Promise<{ success: true; user: User } | { success: false; message: string }> => {
    const { data, error } = await supabase.from('users').update({ total_image: Number(user.totalImage || 0) + 1 }).eq('id', user.id).select().single();
    if (error) return { success: false, message: getErrorMessage(error) };
    return { success: true, user: mapProfileToUser(data as UserProfileData) };
};

export const incrementVideoUsage = async (user: User): Promise<{ success: true; user: User } | { success: false; message: string }> => {
    const { data, error } = await supabase.from('users').update({ total_video: Number(user.totalVideo || 0) + 1 }).eq('id', user.id).select().single();
    if (error) return { success: false, message: getErrorMessage(error) };
    return { success: true, user: mapProfileToUser(data as UserProfileData) };
};

export const getDeviceOS = (): string => {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return 'iOS';
    if (/mac/i.test(ua)) return 'Mac';
    if (/android/i.test(ua)) return 'Android';
    return 'Other';
};

export const updateUserLastSeen = async (userId: string): Promise<void> => {
    try {
        await supabase.from('users').update({ last_seen_at: new Date().toISOString(), app_version: APP_VERSION, last_device: getDeviceOS() }).eq(userId, userId);
    } catch (e) {}
};

export const getServerUsageCounts = async (): Promise<Record<string, number>> => {
    const fortyFiveMinutesAgo = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from('users').select('proxy_server').not('proxy_server', 'is', null).gte('last_seen_at', fortyFiveMinutesAgo);
    if (error || !data) return {};
    return data.reduce((acc, { proxy_server }) => {
      if (proxy_server) acc[proxy_server] = (acc[proxy_server] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
};

export const updateUserProxyServer = async (userId: string, serverUrl: string | null): Promise<boolean> => {
    const { error } = await supabase.from('users').update({ proxy_server: serverUrl }).eq('id', userId);
    return !error;
};

export const addNewUser = async (userData: any): Promise<{ success: boolean; message?: string, user?: User }> => {
    const { email, phone, status, fullName, role, batch_02 } = userData;
    const cleanedEmail = email.trim().toLowerCase();
    const newUserProfile: any = { id: uuidv4(), email: cleanedEmail, phone, status, role, full_name: fullName, total_image: 0, total_video: 0, batch_02 };
    const { data, error } = await supabase.from('users').insert(newUserProfile).select().single();
    if (error || !data) return { success: false, message: getErrorMessage(error) };
    return { success: true, user: mapProfileToUser(userData as UserProfileData) };
};

export const removeUser = async (userId: string): Promise<{ success: boolean; message?: string }> => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    return { success: !error, message: error ? getErrorMessage(error) : undefined };
};

export const updateUserBatch02 = async (userId: string, batch_02: string | null): Promise<boolean> => {
    const { error } = await supabase.from('users').update({ batch_02 }).eq('id', userId);
    return !error;
};

export const addTokenToPool = async (token: string, pool: 'veo' | 'imagen'): Promise<{ success: boolean; message?: string }> => {
    const tableName = pool === 'veo' ? 'token_new_active' : 'token_imagen_only_active';
    const { error } = await supabase.from(tableName).insert({ token, status: 'active', total_user: 0 });
    return { success: !error, message: error ? getErrorMessage(error) : undefined };
};

export const deleteTokenFromPool = async (token: string): Promise<{ success: boolean; message?: string }> => {
    const { error } = await supabase.from('token_new_active').delete().eq('token', token);
    return { success: !error, message: error ? getErrorMessage(error) : undefined };
};

export const getTotalPlatformUsage = async (): Promise<{ totalImages: number; totalVideos: number }> => {
    return { totalImages: 0, totalVideos: 0 };
};
