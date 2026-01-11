import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Receipt, BarChart3, Calendar, FileText, Printer, Loader2, IndianRupee } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import InvoiceReceipt from '../pos/InvoiceReceipt';

const CustomerDetailsModal = ({ isOpen, onClose, customer, sellerProfile }) => {
    const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' | 'stats'
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalDue: 0,
        totalSales: 0,
        totalPaid: 0,
        lastVisit: null
    });

    const [selectedInvoice, setSelectedInvoice] = useState(null); // For printing

    // -- Fetch Data --
    useEffect(() => {
        if (isOpen && customer) {
            fetchCustomerData();
        } else {
            setInvoices([]);
        }
    }, [isOpen, customer]);

    const fetchCustomerData = async () => {
        setLoading(true);
        try {
            // Fetch Invoices
            const { data: invData, error } = await supabase
                .from('invoices')
                .select(`
                    *,
                    invoice_items (*)
                `)
                .eq('customer_id', customer.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            // Process Invoices for Ledger Balance (Running Balance)
            const fetchedInvoices = invData || [];

            // Sort Ascending to calculate running balance
            const sortedAsc = [...fetchedInvoices].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            let runningBalance = 0;
            const invoicesWithBalance = sortedAsc.map(inv => {
                runningBalance += (inv.due_amount || 0);
                return { ...inv, balance: runningBalance };
            });

            // Set state descending (Newest first)
            setInvoices(invoicesWithBalance.reverse());

            // Calculate Stats
            calculateStats(fetchedInvoices);

        } catch (error) {
            console.error("Error fetching customer details:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (invs) => {
        let totalDue = 0;
        let totalSales = 0;
        let totalPaid = 0;
        let lastVisit = null;

        if (invs.length > 0) {
            // invs is already sorted? no, the argument 'invs' passed here was 'fetchedInvoices' which was original data.
            // Actually I passed 'fetchedInvoices' which is the raw data. 
            // Better to use the processed one or just sum raw data. Sum is same.
            lastVisit = invs[0].created_at;
        }

        invs.forEach(inv => {
            totalDue += (inv.due_amount || 0);
            totalSales += (inv.total_amount || 0);
            totalPaid += (inv.paid_amount || 0);
        });

        setStats({ totalDue, totalSales, totalPaid, lastVisit });
    };

    // -- Handle Print --
    const handlePrintInvoice = (inv) => {
        setSelectedInvoice(inv);
        // Small timeout to allow rendering
        setTimeout(() => {
            window.print();
        }, 300);
    };

    if (!isOpen || !customer) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-dark-900 w-full max-w-5xl rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-12 h-12 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xl font-bold">
                                    {customer.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white leading-none">{customer.name}</h2>
                                    <p className="text-slate-400 text-sm mt-1 flex gap-3">
                                        <span>{customer.phone}</span>
                                        {customer.business_name && <span className="text-brand-300 font-medium">• {customer.business_name}</span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-white/10 bg-black/20 px-6">
                        <button
                            onClick={() => setActiveTab('invoices')}
                            className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'invoices' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            <Receipt className="w-4 h-4" /> Invoices ({invoices.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('stats')}
                            className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'stats' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            <BarChart3 className="w-4 h-4" /> Balance & Stats
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-dark-900/50">
                        {loading ? (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-500">
                                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                                Loading Details...
                            </div>
                        ) : activeTab === 'invoices' ? (
                            // Invoices Tab
                            invoices.length === 0 ? (
                                <div className="text-center py-20 text-slate-500">
                                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    No invoices found for this customer.
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm text-slate-400">
                                    <thead className="text-xs uppercase font-medium text-white/50 bg-white/5 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 rounded-l-lg">Date</th>
                                            <th className="px-4 py-3">Invoice #</th>
                                            <th className="px-4 py-3">Amount</th>
                                            <th className="px-4 py-3">Paid</th>
                                            <th className="px-4 py-3">Due</th>
                                            <th className="px-4 py-3 rounded-r-lg text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {invoices.map(inv => (
                                            <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-4 text-white">
                                                    {new Date(inv.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-4 font-mono text-brand-300">
                                                    #{inv.full_invoice_number || inv.invoice_number || inv.id.slice(0, 8)}
                                                </td>
                                                <td className="px-4 py-4 font-bold text-white">
                                                    ₹{inv.total_amount}
                                                </td>
                                                <td className="px-4 py-4 text-emerald-400">
                                                    ₹{Math.max(inv.paid_amount || 0, inv.cash_received || 0)}
                                                </td>
                                                <td className="px-4 py-4">
                                                    {inv.due_amount > 0 ? (
                                                        <span className="text-red-400 font-bold">₹{inv.due_amount}</span>
                                                    ) : (
                                                        <span className="text-slate-600 font-bold">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <button
                                                        onClick={() => handlePrintInvoice(inv)}
                                                        className="p-2 bg-white/5 hover:bg-brand-500 hover:text-white rounded-lg transition-all text-slate-400"
                                                        title="Print Invoice"
                                                    >
                                                        <Printer className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        ) : (
                            // Sales & Balance Stats Tab
                            <div className="space-y-6">
                                {/* Total Due Card */}
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-transparent border border-red-500/30 flex items-center justify-between">
                                    <div>
                                        <p className="text-red-300 font-medium mb-1">Total Due Amount</p>
                                        <h3 className="text-4xl font-bold text-red-100 tracking-tight">
                                            ₹{stats.totalDue.toLocaleString()}
                                        </h3>
                                        <p className="text-xs text-red-300/60 mt-2">Latest outstanding balance</p>
                                    </div>
                                    <div className="p-4 bg-red-500/20 rounded-xl">
                                        <IndianRupee className="w-8 h-8 text-red-500" />
                                    </div>
                                </div>

                                {/* Lifetime Stats Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <StatsCard
                                        label="Total Business"
                                        amount={stats.totalSales}
                                        icon={<BarChart3 className="w-5 h-5 text-brand-400" />}
                                        subText="Lifetime Sales"
                                    />
                                    <StatsCard
                                        label="Total Paid"
                                        amount={stats.totalPaid}
                                        icon={<FileText className="w-5 h-5 text-emerald-400" />}
                                        subText="Lifetime Received"
                                        color="emerald"
                                    />
                                    <StatsCard
                                        label="Last Visit"
                                        amount={stats.lastVisit ? new Date(stats.lastVisit).toLocaleDateString('en-IN') : 'N/A'}
                                        icon={<Calendar className="w-5 h-5 text-purple-400" />}
                                        subText="Last Invoice Date"
                                        color="purple"
                                        isText={true}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Hidden Print Component */}
            <div className="print-only">
                {selectedInvoice && (
                    <InvoiceReceipt
                        invoice={selectedInvoice}
                        sellerProfile={sellerProfile}
                        customer={{ name: customer.name, phone: customer.phone }}
                    />
                )}
            </div>
        </AnimatePresence>
    );
};

const StatsCard = ({ label, amount, icon, subText, color = 'brand', isText = false }) => {
    const colors = {
        brand: 'bg-brand-500/10 border-brand-500/20 text-brand-200',
        purple: 'bg-purple-500/10 border-purple-500/20 text-purple-200',
        emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200',
    };

    return (
        <div className={`p-5 rounded-xl border ${colors[color]} relative group overflow-hidden`}>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <p className="text-sm font-medium opacity-80">{label}</p>
                {icon}
            </div>
            <div className="relative z-10 w-full overflow-hidden">
                <h4 className="text-2xl font-bold truncate" title={amount}>
                    {isText ? amount : `₹${amount.toLocaleString()}`}
                </h4>
                <p className="text-[10px] opacity-60 mt-1 uppercase tracking-wider">{subText}</p>
            </div>
        </div>
    );
};

export default CustomerDetailsModal;
