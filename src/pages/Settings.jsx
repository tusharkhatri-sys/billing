
import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Settings as SettingsIcon, Save, ShieldCheck, Lock, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Settings = () => {
    const { user, signOut } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Profile State
    const [profile, setProfile] = useState({
        business_name: '',
        owner_name: '',
        phone: '',
        email: '',
        address: '',
        gstin: '',
        invoice_prefix: 'SHOP',
        invoice_terms: ''
    });

    // Phone Verification State
    const [isPhoneEditable, setIsPhoneEditable] = useState(false);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;
                if (data) {
                    setProfile({
                        business_name: data.business_name || '',
                        owner_name: data.owner_name || '',
                        phone: data.phone || '',
                        email: data.email || '',
                        address: data.address || '',
                        gstin: data.gstin || '',
                        invoice_prefix: data.invoice_prefix || 'SHOP',
                        invoice_terms: data.invoice_terms || ''
                    });
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
                // showToast('Failed to load settings', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [user]);

    const handleChange = (e) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    // -- OTP Logic for Phone Update --
    const handleEditPhoneClick = async () => {
        if (isPhoneEditable) return; // Already verified
        setShowOtpModal(true);
        // Auto-send OTP on open? Or wait for user to click "Send OTP"?
        // Let's wait for user to confirm they want to send code.
    };

    const handleSendOtp = async () => {
        setOtpLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email: user.email,
                options: { shouldCreateUser: false }
            });
            if (error) throw error;
            showToast(`OTP sent to ${user.email} `, 'success');
            setOtpSent(true);
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setOtpLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setVerifying(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                email: user.email,
                token: otp,
                type: 'email'
            });
            if (error) throw error;

            showToast('Verified! You can now update phone number.', 'success');
            setIsPhoneEditable(true);
            setShowOtpModal(false);
            setOtp('');
            setOtpSent(false);

        } catch (error) {
            console.error(error);
            showToast('Invalid OTP. Please try again.', 'error');
        } finally {
            setVerifying(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    business_name: profile.business_name,
                    owner_name: profile.owner_name,
                    phone: profile.phone,
                    address: profile.address,
                    gstin: profile.gstin,
                    invoice_prefix: profile.invoice_prefix,
                    invoice_terms: profile.invoice_terms
                })
                .eq('id', user.id);

            if (error) throw error;
            showToast('Settings saved successfully', 'success');
            setIsPhoneEditable(false); // Lock it again after save
        } catch (error) {
            console.error('Error saving settings:', error);
            showToast('Failed to save settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppLayout title="Settings">
            <div className="max-w-4xl mx-auto space-y-6 pb-20">

                {/* Header Section */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 rounded-full bg-brand-500/10 text-brand-400">
                        <SettingsIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Store Settings</h2>
                        <p className="text-slate-400 text-sm">Manage your business profile and invoice preferences.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-slate-500">Loading settings...</div>
                ) : (
                    <form onSubmit={handleSave} className="space-y-6">

                        {/* Business Details Card */}
                        <div className="glass p-6 rounded-xl border border-white/5 space-y-6">
                            <h3 className="text-lg font-bold text-white border-b border-white/5 pb-2">Business Details</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Store Name</label>
                                    <input
                                        type="text"
                                        name="business_name"
                                        value={profile.business_name}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-brand-500 outline-none transition-colors"
                                        placeholder="My Awesome Shop"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Owner Name</label>
                                    <input
                                        type="text"
                                        name="owner_name"
                                        value={profile.owner_name}
                                        onChange={handleChange}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-brand-500 outline-none transition-colors"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="space-y-1.5 relative">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Phone Number</label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={profile.phone}
                                            onChange={handleChange}
                                            required
                                            disabled={!isPhoneEditable}
                                            className={`w-full bg-black/20 border ${isPhoneEditable ? 'border-brand-500 ring-1 ring-brand-500/20' : 'border-white/10 opacity-75 cursor-not-allowed'} rounded-lg pl-4 pr-32 py-3 text-white outline-none transition-all`}
                                            placeholder="9876543210"
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                            {isPhoneEditable ? (
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-md text-[10px] font-bold border border-green-500/20">
                                                    <ShieldCheck className="w-3 h-3" />
                                                    VERIFIED
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleEditPhoneClick}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 hover:text-brand-300 rounded-md text-[10px] font-bold border border-brand-500/20 transition-all active:scale-95 whitespace-nowrap"
                                                >
                                                    <Lock className="w-3 h-3" />
                                                    RE-AUTHENTICATE
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Email (Read Only)</label>
                                    <input
                                        type="email"
                                        value={profile.email}
                                        disabled
                                        className="w-full bg-white/5 border border-white/5 rounded-lg px-4 py-3 text-slate-400 cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-400 uppercase">Store Address</label>
                                <textarea
                                    name="address"
                                    rows="3"
                                    value={profile.address}
                                    onChange={handleChange}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-brand-500 outline-none transition-colors resize-none"
                                    placeholder="Shop No. 123, Main Market, City..."
                                />
                            </div>
                        </div>

                        {/* Invoice Settings Card */}
                        <div className="glass p-6 rounded-xl border border-white/5 space-y-6">
                            <h3 className="text-lg font-bold text-white border-b border-white/5 pb-2">Invoice Configuration</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400 uppercase">GSTIN / Tax ID</label>
                                    <input
                                        type="text"
                                        name="gstin"
                                        value={profile.gstin}
                                        onChange={handleChange}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-brand-500 outline-none transition-colors uppercase"
                                        placeholder="27ABCDE1234F1Z5"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Default Invoice Prefix</label>
                                    <input
                                        type="text"
                                        name="invoice_prefix"
                                        value={profile.invoice_prefix}
                                        onChange={handleChange}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-brand-500 outline-none transition-colors uppercase"
                                        placeholder="SHOP"
                                    />
                                    <p className="text-[10px] text-slate-500">Used for generating invoice numbers (e.g. SHOP-1001)</p>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-400 uppercase">Invoice Footer Terms</label>
                                <textarea
                                    name="invoice_terms"
                                    rows="2"
                                    value={profile.invoice_terms}
                                    onChange={handleChange}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-brand-500 outline-none transition-colors resize-none"
                                    placeholder="Thank you for your business! No refunds."
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-4 pt-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                {saving ? "Saving..." : "Save Changes"}
                            </button>

                            <button
                                type="button"
                                onClick={signOut}
                                className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-xl border border-red-500/10 transition-colors"
                            >
                                Sign Out
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* OTP Verification Modal */}
            <AnimatePresence>
                {showOtpModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-dark-900 border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl p-6 relative overflow-hidden"
                        >
                            {/* Close Button */}
                            <button
                                onClick={() => { setShowOtpModal(false); setOtpSent(false); setOtp(''); }}
                                className="absolute top-4 right-4 text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-400">
                                    <ShieldCheck className="w-8 h-8" />
                                </div>
                                <h2 className="text-xl font-bold text-white text-center">Re-authenticate</h2>
                                <p className="text-slate-400 text-sm text-center mb-6">
                                    We sent a code to <span className="text-white">{user.email}</span>. <br />
                                    Please enter it to unlock the phone field.
                                </p>
                            </div>

                            {!otpSent ? (
                                <div className="space-y-4">
                                    <p className="text-xs text-slate-500 text-center">
                                        We will send a One-Time Password (OTP) to your registered email: <br />
                                        <span className="text-white font-medium">{user?.email}</span>
                                    </p>
                                    <button
                                        onClick={handleSendOtp}
                                        disabled={otpLoading}
                                        className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                    >
                                        {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Email OTP'}
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleVerifyOtp} className="space-y-4">
                                    <div>
                                        <label className="text-xs font-medium text-slate-400 uppercase pl-1 mb-1 block">Enter Security Code</label>
                                        <input
                                            type="text"
                                            autoFocus
                                            maxLength="8"
                                            value={otp}
                                            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                            placeholder=" • • • • • • "
                                            className="w-full text-center text-2xl tracking-[0.5em] font-bold py-3 bg-white/5 border border-brand-500/50 rounded-xl text-white outline-none focus:bg-brand-500/5 transition-all"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={verifying || otp.length < 6}
                                        className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Unlock'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSendOtp}
                                        className="w-full text-xs text-brand-300 hover:text-brand-200 mt-2 hover:underline"
                                    >
                                        Resend Code
                                    </button>
                                </form>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </AppLayout>
    );
};

export default Settings;

