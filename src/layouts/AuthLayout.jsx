import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Loader2, Code2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

const AuthLayout = ({ children, title, subtitle }) => {
    const [isContactOpen, setIsContactOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ email: '', message: '' });
    const [sent, setSent] = useState(false);

    const handleSend = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase
                .from('contact_messages')
                .insert([{
                    sender_email: formData.email,
                    message: formData.message,
                    subject: 'New Inquiry from Login Page'
                }]);

            if (error) throw error;
            setSent(true);
            setTimeout(() => {
                setSent(false);
                setIsContactOpen(false);
                setFormData({ email: '', message: '' });
            }, 2000);
        } catch (error) {
            console.error(error);
            alert('Failed to send message. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full auth-bg flex items-center justify-center p-4 relative overflow-hidden">
            {/* Decorative Circles */}
            <div className="fixed top-0 left-0 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="fixed bottom-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="glass w-full max-w-md p-8 rounded-2xl relative z-10"
            >
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
                    <p className="text-brand-200">{subtitle}</p>
                </div>
                {children}
            </motion.div>

            {/* Developer Footer */}
            <div className="fixed bottom-4 left-0 w-full text-center z-20 pointer-events-auto">
                <div className="inline-flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/5 shadow-xl transition-transform hover:scale-105">
                    <Code2 className="w-4 h-4 text-brand-400" />
                    <span className="text-xs text-slate-400">Created by <span className="text-white font-semibold hover:text-brand-300 transition-colors cursor-default">Tushar Khatri</span></span>
                    <span className="w-px h-3 bg-white/20 mx-1"></span>
                    <button
                        onClick={() => setIsContactOpen(true)}
                        className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1 uppercase tracking-wide"
                    >
                        Contact <MessageSquare className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Contact Modal */}
            <AnimatePresence>
                {isContactOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setIsContactOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-dark-900 border border-white/10 p-6 rounded-2xl shadow-2xl z-50"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-brand-500" />
                                    Contact Developer
                                </h3>
                                <button onClick={() => setIsContactOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {sent ? (
                                <div className="py-8 text-center text-green-400">
                                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Send className="w-6 h-6" />
                                    </div>
                                    <p className="font-bold">Message Sent!</p>
                                    <p className="text-xs text-slate-400 mt-1">We'll get back to you shortly.</p>
                                </div>
                            ) : (
                                <form onSubmit={handleSend} className="space-y-4">
                                    <div>
                                        <label className="text-xs font-medium text-slate-400 uppercase pl-1 mb-1 block">Your Email</label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500 placeholder-slate-600"
                                            placeholder="e.g. user@example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-400 uppercase pl-1 mb-1 block">Message</label>
                                        <textarea
                                            required
                                            rows="4"
                                            value={formData.message}
                                            onChange={e => setFormData({ ...formData, message: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500 placeholder-slate-600 resize-none"
                                            placeholder="Write your query here..."
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send Message <Send className="w-4 h-4" /></>}
                                    </button>
                                </form>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AuthLayout;
