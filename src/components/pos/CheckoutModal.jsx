import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CreditCard, Banknote, User, CheckCircle, Calculator, Wallet } from 'lucide-react';

const CheckoutModal = ({ isOpen, onClose, cartTotal, customer, previousBalance = 0, advanceBalance = 0, onComplete }) => {
    const [amountReceived, setAmountReceived] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash'); // Cash, UPI, Card
    const [useAdvance, setUseAdvance] = useState(false); // Toggle to use advance balance
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Calculate amounts
    const numericReceived = parseFloat(amountReceived) || 0;
    const advanceUsed = useAdvance ? Math.min(advanceBalance, cartTotal + previousBalance) : 0;
    const totalPayable = cartTotal + previousBalance - advanceUsed;
    const dueAmount = Math.max(0, totalPayable - numericReceived);
    const excessPayment = Math.max(0, numericReceived - totalPayable); // This becomes new advance

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setAmountReceived('');
            setUseAdvance(false);
        }
    }, [isOpen]);

    const handleQuickPay = () => {
        setAmountReceived(Math.max(0, totalPayable).toString());
    };

    const handleSubmit = async () => {
        if (!amountReceived && amountReceived !== 0) return;

        setIsSubmitting(true);

        // STEP 1: Calculate what's available for payment (cash + advance)
        const totalAvailable = numericReceived + advanceUsed;

        // STEP 2: Pay current bill first
        const paidTowardsCurrentBill = Math.min(totalAvailable, cartTotal);
        const currentBillDue = Math.max(0, cartTotal - paidTowardsCurrentBill);
        const remainingAfterCurrentBill = totalAvailable - paidTowardsCurrentBill;

        // STEP 3: Pay old dues with remaining
        const paidTowardsOldDues = Math.min(remainingAfterCurrentBill, previousBalance);
        const remainingAfterOldDues = remainingAfterCurrentBill - paidTowardsOldDues;

        // STEP 4: Any remaining becomes new advance
        const newAdvanceCredit = remainingAfterOldDues;

        const paymentData = {
            totalAmount: cartTotal,
            paidAmount: paidTowardsCurrentBill, // Total paid towards THIS bill (cash + advance)
            dueAmount: currentBillDue, // Due for THIS invoice only
            paymentMethod,
            paymentStatus: currentBillDue <= 0.01 ? 'paid' : 'partial',
            cashReceived: numericReceived, // Total cash received
            paidTowardsOldDues: paidTowardsOldDues, // For clearing old invoices
            advanceUsed: advanceUsed, // Advance balance used
            newAdvance: newAdvanceCredit, // Overpayment becomes new advance
        };

        await onComplete(paymentData);
        setIsSubmitting(false);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-dark-900 w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <Banknote className="text-brand-400" /> Checkout
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">Complete the transaction</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-6 space-y-5 overflow-y-auto">

                        {/* Summary Card */}
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10 relative overflow-hidden">
                            <div className="flex justify-between items-center">
                                <div className="relative z-10">
                                    <p className="text-slate-400 text-sm font-medium mb-1">Bill Amount</p>
                                    <p className="text-3xl font-bold text-white tracking-tight">₹{cartTotal.toLocaleString()}</p>
                                </div>
                                {customer && (
                                    <div className="text-right relative z-10">
                                        <div className="flex items-center justify-end gap-1.5 text-brand-300 mb-1">
                                            <User className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Customer</span>
                                        </div>
                                        <p className="text-white font-medium">{customer.name}</p>
                                        <p className="text-xs text-slate-500">{customer.phone}</p>
                                    </div>
                                )}
                            </div>
                            {/* Bg Decoration */}
                            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-brand-500/10 to-transparent pointer-events-none" />
                        </div>

                        {/* Previous Balance & Advance Balance Info */}
                        {customer && (previousBalance > 0 || advanceBalance > 0) && (
                            <div className="grid grid-cols-2 gap-3">
                                {previousBalance > 0 && (
                                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                        <p className="text-xs text-red-400 font-medium mb-1">Previous Due</p>
                                        <p className="text-lg font-bold text-red-200">₹{previousBalance.toLocaleString()}</p>
                                    </div>
                                )}
                                {advanceBalance > 0 && (
                                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                        <p className="text-xs text-emerald-400 font-medium mb-1">Advance Balance</p>
                                        <p className="text-lg font-bold text-emerald-200">₹{advanceBalance.toLocaleString()}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Use Advance Toggle */}
                        {customer && advanceBalance > 0 && (
                            <div
                                onClick={() => setUseAdvance(!useAdvance)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${useAdvance
                                    ? 'bg-emerald-500/20 border-emerald-500/40'
                                    : 'bg-white/5 border-white/10 hover:border-white/20'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${useAdvance ? 'bg-emerald-500' : 'bg-white/10'}`}>
                                        <Wallet className={`w-5 h-5 ${useAdvance ? 'text-white' : 'text-slate-400'}`} />
                                    </div>
                                    <div>
                                        <p className={`font-semibold ${useAdvance ? 'text-emerald-300' : 'text-white'}`}>Use Advance Balance</p>
                                        <p className="text-xs text-slate-400">
                                            {useAdvance
                                                ? `₹${advanceUsed.toLocaleString()} will be deducted`
                                                : `₹${advanceBalance.toLocaleString()} available`
                                            }
                                        </p>
                                    </div>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${useAdvance ? 'bg-emerald-500 border-emerald-400' : 'border-slate-500'
                                    }`}>
                                    {useAdvance && <CheckCircle className="w-4 h-4 text-white" />}
                                </div>
                            </div>
                        )}

                        {/* Total Payable after adjustments */}
                        <div className="bg-gradient-to-r from-brand-500/10 to-purple-500/10 rounded-xl p-4 border border-brand-500/20">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-brand-300 text-sm font-medium">Total Payable</p>
                                    <p className="text-xs text-slate-500">
                                        Bill: ₹{cartTotal} {previousBalance > 0 ? `+ Due: ₹${previousBalance}` : ''} {advanceUsed > 0 ? `- Advance: ₹${advanceUsed}` : ''}
                                    </p>
                                </div>
                                <p className="text-3xl font-black text-white">₹{Math.max(0, totalPayable).toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Payment Methods */}
                        <div>
                            <label className="text-sm font-medium text-slate-300 mb-3 block">Payment Method</label>
                            <div className="grid grid-cols-3 gap-3">
                                {['Cash', 'UPI', 'Card'].map(method => (
                                    <button
                                        key={method}
                                        onClick={() => setPaymentMethod(method)}
                                        className={`py-3 px-4 rounded-xl text-sm font-semibold border transition-all flex flex-col items-center gap-2 ${paymentMethod === method
                                            ? 'bg-brand-500 text-white border-brand-400 shadow-lg shadow-brand-500/20'
                                            : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        {method === 'Cash' && <Banknote className="w-5 h-5" />}
                                        {method === 'UPI' && <div className="w-5 h-5 font-black text-xs flex items-center justify-center border-2 border-current rounded">UPI</div>}
                                        {method === 'Card' && <CreditCard className="w-5 h-5" />}
                                        {method}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Amount Input */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-end">
                                <label className="text-sm font-medium text-slate-300">Amount Received</label>
                                <button
                                    onClick={handleQuickPay}
                                    className="px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 text-xs font-semibold rounded-lg border border-brand-500/20 hover:border-brand-500/40 transition-all flex items-center gap-1.5"
                                >
                                    <Calculator className="w-3.5 h-3.5" />
                                    Full Amount
                                </button>
                            </div>

                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-500 group-focus-within:text-brand-500 transition-colors">₹</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={amountReceived}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || parseFloat(val) >= 0) {
                                            setAmountReceived(val);
                                        }
                                    }}
                                    placeholder="0"
                                    onKeyDown={(e) => {
                                        if (e.key === '-' || e.key === 'e') {
                                            e.preventDefault();
                                        }
                                    }}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-10 pr-4 text-3xl font-bold text-white placeholder-slate-700 outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 transition-all font-mono"
                                    autoFocus
                                />
                            </div>

                            {/* Result Cards */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className={`p-3 rounded-xl border ${dueAmount > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                                    <p className={`text-xs font-medium mb-1 ${dueAmount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {dueAmount > 0 ? 'Remaining Due' : 'Fully Paid'}
                                    </p>
                                    <p className={`text-xl font-bold ${dueAmount > 0 ? 'text-red-200' : 'text-green-200'}`}>₹{dueAmount.toLocaleString()}</p>
                                </div>
                                <div className={`p-3 rounded-xl border ${excessPayment > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/5'}`}>
                                    <p className={`text-xs font-medium mb-1 ${excessPayment > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                        {excessPayment > 0 ? 'New Advance Credit' : 'Change / Advance'}
                                    </p>
                                    <p className={`text-xl font-bold ${excessPayment > 0 ? 'text-emerald-200' : 'text-white'}`}>₹{excessPayment.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-white/10 bg-black/20">
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !amountReceived}
                            className={`w-full py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 shadow-xl transition-all ${!amountReceived
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                : 'bg-brand-500 text-white hover:bg-brand-400 shadow-brand-500/20 active:scale-[0.98]'
                                }`}
                        >
                            {isSubmitting ? (
                                <span className="animate-pulse">Processing...</span>
                            ) : (
                                <>
                                    <CheckCircle className="w-6 h-6" />
                                    Complete Payment
                                </>
                            )}
                        </button>
                    </div>

                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default CheckoutModal;

