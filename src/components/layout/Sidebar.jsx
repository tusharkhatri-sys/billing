import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Users, FileText, Settings, X, Menu, Store } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

const MENU_ITEMS = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Package, label: 'Inventory', path: '/inventory' },
    { icon: ShoppingCart, label: 'Billing / POS', path: '/pos' },
    { icon: Users, label: 'Customers', path: '/customers' },
    { icon: FileText, label: 'Reports', path: '/reports' },
    { icon: Settings, label: 'Settings', path: '/settings' },
];

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const location = useLocation();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Resize handler
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const sidebarContent = (
        <div className="h-full flex flex-col bg-dark-900 border-r border-white/10 text-white w-64">
            {/* Brand Logo */}
            <div className="p-6 flex items-center gap-3 border-b border-white/5">
                <div className="bg-brand-600 p-2 rounded-lg">
                    <Store className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="font-bold text-xl tracking-wide">Retail Karr</h1>
                    <p className="text-xs text-brand-300">Modern Retail System</p>
                </div>
                {isMobile && (
                    <button onClick={toggleSidebar} className="ml-auto p-1 rounded-md hover:bg-white/10">
                        <X className="w-6 h-6" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {MENU_ITEMS.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={isMobile ? toggleSidebar : undefined}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                    ? 'bg-brand-600 shadow-lg shadow-brand-900/50 text-white'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                            <span className="font-medium text-sm">{item.label}</span>
                            {isActive && (
                                <motion.div
                                    layoutId="active-indicator"
                                    className="absolute left-0 w-1 h-8 bg-white rounded-r-full"
                                />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* User / Footer area could go here */}
            <div className="p-4 border-t border-white/5 text-xs text-center text-slate-500">
                © 2024 Retail Karr
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden md:block h-screen sticky top-0 z-20">
                {sidebarContent}
            </div>

            {/* Mobile Sidebar (Drawer) */}
            <AnimatePresence>
                {isMobile && isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={toggleSidebar}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                        />
                        <motion.div
                            initial={{ x: -300 }}
                            animate={{ x: 0 }}
                            exit={{ x: -300 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 left-0 z-50 md:hidden"
                        >
                            {sidebarContent}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default Sidebar;
