import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthLayout from '../layouts/AuthLayout';
import { Mail, Lock, User, Building2, Phone, Loader2 } from 'lucide-react';

import { registerSchema } from '../schemas/auth';

const Register = () => {
    const [formData, setFormData] = useState({
        businessName: '',
        ownerName: '',
        email: '',
        phone: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Validate Data with Zod
            const result = registerSchema.safeParse(formData);

            if (!result.success) {
                // Format Zod errors
                const firstError = result.error.errors[0].message;
                throw new Error(firstError);
            }

            // 2. Submit to Supabase
            const { error: authError } = await signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        business_name: formData.businessName,
                        full_name: formData.ownerName,
                        phone: formData.phone
                    }
                }
            });

            if (authError) throw authError;

            showToast("Registration Successful! Please check your email/login.", "success");
            navigate('/login');

        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Create Account"
            subtitle="Start your digital retail journey today"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Error Banner Removed - Using Toasts now */}

                <div className="grid grid-cols-2 gap-4">
                    {/* Business Name */}
                    <div className="col-span-2">
                        <label className="block text-brand-100 text-xs font-medium mb-1 pl-1">Business Name</label>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300 w-4 h-4" />
                            <input
                                name="businessName"
                                required
                                className="input-field bg-white/5 border-brand-500/30 text-white placeholder-brand-300/50 pl-9 focus:bg-brand-900/50 py-2"
                                placeholder="My Shop Name"
                                value={formData.businessName}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* Owner Name */}
                    <div>
                        <label className="block text-brand-100 text-xs font-medium mb-1 pl-1">Your Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300 w-4 h-4" />
                            <input
                                name="ownerName"
                                required
                                className="input-field bg-white/5 border-brand-500/30 text-white placeholder-brand-300/50 pl-9 focus:bg-brand-900/50 py-2"
                                placeholder="John Doe"
                                value={formData.ownerName}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-brand-100 text-xs font-medium mb-1 pl-1">Mobile</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300 w-4 h-4" />
                            <input
                                name="phone"
                                required
                                type="tel"
                                className="input-field bg-white/5 border-brand-500/30 text-white placeholder-brand-300/50 pl-9 focus:bg-brand-900/50 py-2"
                                placeholder="98765..."
                                value={formData.phone}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                {/* Email */}
                <div>
                    <label className="block text-brand-100 text-xs font-medium mb-1 pl-1">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300 w-4 h-4" />
                        <input
                            name="email"
                            type="email"
                            required
                            className="input-field bg-white/5 border-brand-500/30 text-white placeholder-brand-300/50 pl-9 focus:bg-brand-900/50 py-2"
                            placeholder="name@company.com"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                {/* Password */}
                <div>
                    <label className="block text-brand-100 text-xs font-medium mb-1 pl-1">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300 w-4 h-4" />
                        <input
                            name="password"
                            type="password"
                            required
                            className="input-field bg-white/5 border-brand-500/30 text-white placeholder-brand-300/50 pl-9 focus:bg-brand-900/50 py-2"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        'Create Account'
                    )}
                </button>

                <div className="text-center text-sm text-brand-200">
                    Already have an account?{' '}
                    <Link to="/login" className="text-white font-medium hover:underline">
                        Sign In
                    </Link>
                </div>
            </form>
        </AuthLayout>
    );
};

export default Register;
