import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthLayout from '../layouts/AuthLayout';
import { Mail, Lock, Loader2 } from 'lucide-react';

import { loginSchema } from '../schemas/auth';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Validate inputs
            const result = loginSchema.safeParse({ email, password });
            if (!result.success) {
                throw new Error(result.error.errors[0].message);
            }

            const { error } = await signIn({ email, password });
            if (error) throw error;

            showToast("Welcome back!", "success");
            navigate('/');
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Welcome Back"
            subtitle="Sign in to manage your retail business"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Toast handles errors now */}

                <div className="space-y-4">
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

                    <div>
                        <label className="block text-brand-100 text-sm font-medium mb-1 pl-1">Password</label>
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
                        <div className="flex justify-end mt-1">
                            <Link to="/forgot-password" className="text-xs text-brand-300 hover:text-white transition-colors">
                                Forgot password?
                            </Link>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        'Sign In'
                    )}
                </button>

                <div className="text-center text-sm text-brand-200">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-white font-medium hover:underline">
                        Register now
                    </Link>
                </div>
            </form>
        </AuthLayout>
    );
};

export default Login;
