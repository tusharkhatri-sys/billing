import React from 'react';

const InvoiceReceipt = React.forwardRef(({ invoice, sellerProfile, customer }, ref) => {
    if (!invoice) return null;

    return (
        <div ref={ref} className="hidden print:block p-8 bg-white text-black font-sans max-w-[80mm] mx-auto print:max-w-none">
            {/* Header */}
            <div className="text-center mb-6 pt-4">
                <h1 className="text-2xl font-black uppercase tracking-tight mb-1">{sellerProfile?.business_name || 'Retail Karr'}</h1>
                {sellerProfile?.address && <p className="text-xs text-slate-800">{sellerProfile.address}</p>}
                <div className="flex justify-center gap-3 text-xs mt-1 font-medium text-slate-600">
                    {sellerProfile?.phone && <span>Ph: {sellerProfile.phone}</span>}
                    {sellerProfile?.gstin && <span>GST: {sellerProfile.gstin}</span>}
                </div>
                <div className="border-b-2 border-dashed border-slate-300 w-full my-4" />
            </div>

            {/* Invoice Info */}
            <div className="flex justify-between items-start mb-4 text-xs font-medium">
                <div>
                    <p>Bill No: <span className="font-bold">#{invoice.full_invoice_number || invoice.invoice_number}</span></p>
                    <p>Date: {new Date(invoice.created_at).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                </div>
                {customer && (
                    <div className="text-right">
                        <p className="font-bold">{customer.name}</p>
                        <p>{customer.phone}</p>
                    </div>
                )}
            </div>

            {/* Table Header */}
            <div className="border-y border-slate-800 py-1.5 mb-2 grid grid-cols-12 text-xs font-bold uppercase">
                <div className="col-span-6">Item</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Rate</div>
                <div className="col-span-2 text-right">Amt</div>
            </div>

            {/* Items */}
            <div className="space-y-1 mb-4 min-h-[50px]">
                {invoice.items && invoice.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 text-xs">
                        <div className="col-span-6 font-medium truncate pr-1">{item.product_name}</div>
                        <div className="col-span-2 text-right text-slate-600">{item.quantity} {item.unit}</div>
                        <div className="col-span-2 text-right text-slate-600">{item.price}</div>
                        <div className="col-span-2 text-right font-bold">{item.total}</div>
                    </div>
                ))}
            </div>

            {/* Totals */}
            {/* Totals */}
            <div className="border-t border-slate-800 pt-2 space-y-1 text-xs font-bold">
                <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{invoice.total_amount}</span>
                </div>

                {/* Previous & Grand Total Logic */}
                {parseFloat(invoice.previous_balance) > 0 && (
                    <>
                        <div className="flex justify-between font-bold text-black border-t border-dotted border-slate-400 pt-2 mt-2">
                            <span>Previous Outstanding</span>
                            <span>₹{Number(invoice.previous_balance).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-black text-lg pt-1">
                            <span>Net Payable</span>
                            <span>₹{(parseFloat(invoice.total_amount) + parseFloat(invoice.previous_balance)).toFixed(2)}</span>
                        </div>
                    </>
                )}

                <div className="flex justify-between text-sm mt-2 pt-2 border-t border-dashed border-slate-300">
                    <span>TOTAL BILL</span>
                    <span>₹{invoice.total_amount}</span>
                </div>

                {/* Grand Total Paid Display */}
                <div className="flex justify-between font-medium text-slate-600">
                    <span>Paid [{invoice.payment_method}]</span>
                    <span>₹{invoice.cash_received ? Number(invoice.cash_received).toFixed(2) : invoice.paid_amount}</span>
                </div>

                <div className="flex justify-between text-black uppercase mt-1 text-sm bg-slate-100 p-1 rounded">
                    <span>Total Outstanding</span>
                    <span>
                        ₹{Math.max(0, (
                            (parseFloat(invoice.total_amount) + parseFloat(invoice.previous_balance || 0)) -
                            (parseFloat(invoice.cash_received || invoice.paid_amount))
                        )).toFixed(2)}
                    </span>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center space-y-2">
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Thank you for visiting!</p>
                <div className="text-[9px] text-slate-400">Powered by RetailKarr</div>
            </div>
        </div>
    );
});

export default InvoiceReceipt;
