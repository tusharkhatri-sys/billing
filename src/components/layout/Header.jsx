import { Menu, User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Header = ({ toggleSidebar, title }) => {
    const { user, signOut } = useAuth();
    const { showToast } = useToast();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const handleSignOut = async () => {
        try {
            const { error } = await signOut();
            if (error) throw error;
            showToast("Logged output successfully", "success");
        } catch (error) {
            showToast(error.message, "error");
        }
    };

    return (
        <header className="h-16 bg-white/5 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 sticky top-0 z-10">
            <div className="flex items-center gap-4">
                {/* Mobile Toggle */}
                <button
                    onClick={toggleSidebar}
                    className="md:hidden p-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                    <Menu className="w-6 h-6" />
                </button>

                {/* Page Title (Hidden on small mobile) */}
                <h2 className="text-lg font-semibold text-white hidden sm:block">{title || 'Dashboard'}</h2>
            </div>

            <div className="flex items-center gap-4">


                {/* User Profile */}
                <div className="relative">
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-3 p-1.5 pr-3 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
                    >
                        <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
                            {user?.user_metadata?.business_name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-medium text-white leading-none">
                                {user?.user_metadata?.full_name || user?.user_metadata?.owner_name || 'Owner'}
                            </p>
                            <p className="text-xs text-brand-300">
                                {user?.user_metadata?.business_name || 'Retail Karr'}
                            </p>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                        {isProfileOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-30"
                                    onClick={() => setIsProfileOpen(false)}
                                />
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 mt-2 w-48 bg-dark-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-40"
                                >
                                    <div className="p-3 border-b border-white/5">
                                        <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                                    </div>
                                    <div className="p-1">
                                        <button
                                            onClick={handleSignOut}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Sign Out
                                        </button>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
};

export default Header;
