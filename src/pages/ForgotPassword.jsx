import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';
import AuthLayout from '../layouts/AuthLayout';
import { Mail, KeyRound, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { otpSchema, resetPasswordSchema } from '../schemas/auth';

const ForgotPassword = () => {
    const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Resend Logic States
    const [timer, setTimer] = useState(0);
    const [resendAttempts, setResendAttempts] = useState(0);

    const { showToast } = useToast();
    const navigate = useNavigate();

    // Timer Countdown Effect
    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    // Helper to start timer based on attempts
    const startResendTimer = (attempt) => {
        if (attempt === 0) setTimer(30); // First wait: 30s
        if (attempt === 1) setTimer(60); // Second wait: 60s
        // attempt 2 means we are done (max reached)
    };

    // Step 1: Send OTP
    const handleSendOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Validate Email
            const emailSchema = z.string().email({ message: "Invalid email address" });
            const result = emailSchema.safeParse(email);
            if (!result.success) throw new Error(result.error.errors[0].message);

            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: false
                }
            });
            if (error) throw error;

            showToast("OTP sent to your email!", "success");
            setStep(2);
            startResendTimer(0);
            setResendAttempts(1);
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendAttempts >= 3) return;

        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: { shouldCreateUser: false }
            });
            if (error) throw error;

            showToast("OTP resent successfully!", "success");
            startResendTimer(resendAttempts);
            setResendAttempts(prev => prev + 1);

        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify OTP
    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Validate OTP
            const otpResult = otpSchema.safeParse({ email, otp });
            if (!otpResult.success) throw new Error(otpResult.error.errors[0].message);

            // Verify OTP (Log the user in)
            const { error: verifyError } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: 'email'
            });
            if (verifyError) throw verifyError;

            showToast("OTP Verified! Please set new password.", "success");
            setStep(3); // Move to Password Reset Step

        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Update Password
    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Validate Password
            const passResult = resetPasswordSchema.safeParse({ password, confirmPassword });
            if (!passResult.success) throw new Error(passResult.error.errors[0].message);

            // Update Password
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) throw updateError;

            showToast("Password updated successfully! Please login.", "success");
            navigate('/login');

        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const getSubtitle = () => {
        if (step === 1) return "Enter your email to receive an OTP";
        if (step === 2) return "Enter the 8-digit code sent to your email";
        return "Create a strong new password";
    };

    return (
        <AuthLayout
            title={step === 3 ? "Set New Password" : "Reset Password"}
            subtitle={getSubtitle()}
        >
            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.form
                        key="step1"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        onSubmit={handleSendOtp}
                        className="space-y-6"
                    >
                        <div>
                            <label className="block text-brand-100 text-sm font-medium mb-1 pl-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300 w-5 h-5" />
                                <input
                                    type="email"
                                    required
                                    className="input-field bg-white/5 border-brand-500/30 text-white placeholder-brand-300/50 pl-10 focus:bg-brand-900/50"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <>Send OTP <ArrowRight className="w-4 h-4" /></>}
                        </button>
                    </motion.form>
                )}

                {step === 2 && (
                    <motion.form
                        key="step2"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        onSubmit={handleVerifyOtp}
                        className="space-y-4"
                    >
                        {/* OTP Input */}
                        <div>
                            <label className="block text-brand-100 text-sm font-medium mb-1 pl-1">Enter OTP</label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300 w-5 h-5" />
                                <input
                                    type="text"
                                    required
                                    maxLength={8}
                                    className="input-field bg-white/5 border-brand-500/30 text-white placeholder-brand-300/50 pl-10 focus:bg-brand-900/50 tracking-widest text-center text-lg letter-spacing-2"
                                    placeholder="12345678"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Verify Code'}
                        </button>

                        {/* Resend OTP Logic */}
                        <div className="text-center mt-4">
                            {resendAttempts >= 3 ? (
                                <p className="text-sm text-red-400 font-medium">
                                    Maximum attempts reached. Please try again later.
                                </p>
                            ) : timer > 0 ? (
                                <p className="text-sm text-brand-300">
                                    Resend OTP in <span className="font-mono font-bold text-white">{timer}s</span>
                                </p>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleResendOtp}
                                    disabled={loading}
                                    className="text-sm text-brand-300 hover:text-white transition-colors underline"
                                >
                                    Resend OTP
                                </button>
                            )}
                        </div>
                    </motion.form>
                )}

                {step === 3 && (
                    <motion.form
                        key="step3"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        onSubmit={handleUpdatePassword}
                        className="space-y-4"
                    >
                        {/* New Password */}
                        <div>
                            <label className="block text-brand-100 text-sm font-medium mb-1 pl-1">New Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300 w-5 h-5" />
                                <input
                                    type="password"
                                    required
                                    className="input-field bg-white/5 border-brand-500/30 text-white placeholder-brand-300/50 pl-10 focus:bg-brand-900/50"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-brand-100 text-sm font-medium mb-1 pl-1">Confirm New Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300 w-5 h-5" />
                                <input
                                    type="password"
                                    required
                                    className="input-field bg-white/5 border-brand-500/30 text-white placeholder-brand-300/50 pl-10 focus:bg-brand-900/50"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Set New Password'}
                        </button>
                    </motion.form>
                )}
            </AnimatePresence>

            <div className="text-center text-sm text-brand-200 mt-6">
                <Link to="/login" className="text-white font-medium hover:underline">
                    Back to Login
                </Link>
            </div>
        </AuthLayout>
    );
};

export default ForgotPassword;
