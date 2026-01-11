import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../supabaseClient';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line
} from 'recharts';
import {
    FileText, TrendingUp, Package, Users, Calendar,
    Download, Printer, AlertCircle, DollarSign
} from 'lucide-react';

import { useToast } from '../context/ToastContext';

const Reports = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('sales');
    const [loading, setLoading] = useState(false);
    const [dateFilter, setDateFilter] = useState('last7days');
    const [restockModal, setRestockModal] = useState({ open: false, product: null, qty: '' });

    // Data States
    const [salesData, setSalesData] = useState({ totalSales: 0, totalOrders: 0, topProducts: [] });
    const [inventoryData, setInventoryData] = useState({ totalValue: 0, totalStock: 0, lowStockItems: [] });
    const [ledgerData, setLedgerData] = useState({ totalDue: 0, customers: [] });

    useEffect(() => {
        if (activeTab === 'sales') fetchSalesData();
        if (activeTab === 'inventory') fetchInventoryData();
        if (activeTab === 'ledger') fetchLedgerData();
    }, [activeTab, dateFilter]);

    const handlePrintExport = () => {
        if (inventoryData.lowStockItems.length === 0) {
            showToast('No items to export', 'error');
            return;
        }

        const printWindow = window.open('', '', 'width=800,height=600');
        const itemsHtml = inventoryData.lowStockItems.map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${item.stock}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; color: red;">Low Stock</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <html>
            <head>
                <title>Low Stock Report</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    h2 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { text-align: left; background: #f5f5f5; padding: 10px; border-bottom: 2px solid #ddd; }
                    td { font-size: 14px; }
                </style>
            </head>
            <body>
                <h2>Low Stock Report</h2>
                <p>Date: ${new Date().toLocaleDateString()}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Product Name</th>
                            <th style="text-align: right;">Current Stock</th>
                            <th style="text-align: right;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const openRestockModal = (product) => {
        setRestockModal({ open: true, product, qty: '' });
    };

    const handleRestockConfirm = async () => {
        const { product, qty } = restockModal;
        const quantity = parseInt(qty);

        if (!product || isNaN(quantity) || quantity <= 0) {
            showToast('Please enter a valid quantity', 'error');
            return;
        }

        try {
            const newStock = (product.stock || 0) + quantity;
            const { error } = await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('id', product.id);

            if (error) throw error;

            showToast(`${product.name} restocked! New Stock: ${newStock}`, 'success');
            setRestockModal({ open: false, product: null, qty: '' });
            fetchInventoryData(); // Refresh list
        } catch (error) {
            console.error("Restock Error:", error);
            showToast('Failed to update stock', 'error');
        }
    };

    const fetchSalesData = async () => {
        setLoading(true);
        try {
            let query = supabase.from('invoices').select('*');

            // Date Logic
            const now = new Date();
            let startDate = new Date();

            if (dateFilter === 'last7days') startDate.setDate(now.getDate() - 7);
            else if (dateFilter === 'last30days') startDate.setDate(now.getDate() - 30);
            else if (dateFilter === 'today') startDate.setHours(0, 0, 0, 0);

            if (dateFilter !== 'all') {
                query = query.gte('created_at', startDate.toISOString());
            }

            const { data: invoices, error } = await query;
            if (error) throw error;

            const totalSales = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
            const totalOrders = invoices.length;

            // Fetch Top Selling Products
            let topProducts = [];
            const invoiceIds = invoices.map(inv => inv.id);

            if (invoiceIds.length > 0) {
                const { data: items, error: itemsError } = await supabase
                    .from('invoice_items')
                    .select('product_name, quantity, total')
                    .in('invoice_id', invoiceIds);

                if (!itemsError && items) {
                    const productStats = {};
                    items.forEach(item => {
                        const name = item.product_name;
                        if (!productStats[name]) productStats[name] = { name, quantity: 0, total: 0 };
                        productStats[name].quantity += item.quantity;
                        productStats[name].total += item.total;
                    });

                    topProducts = Object.values(productStats)
                        .sort((a, b) => b.quantity - a.quantity)
                        .slice(0, 5);
                }
            }

            setSalesData({ totalSales, totalOrders, topProducts });

        } catch (err) {
            console.error("Sales Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchInventoryData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('products').select('*');
            if (error) throw error;

            const totalValue = data.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);
            const totalStock = data.reduce((sum, p) => sum + (p.stock || 0), 0);
            const lowStockItems = data.filter(p => p.stock <= 10);

            setInventoryData({ totalValue, totalStock, lowStockItems });
        } catch (err) {
            console.error("Inventory Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchLedgerData = async () => {
        setLoading(true);
        try {
            // Updated logic: Fetch Customers AND valid Invoices to simulate 'due_amount' if needed
            // But relying on customer table approach or aggregate invoices if customer table lacks due_amount column
            // Assuming we fetch invoices to calc dues or if we have due_amount on customer?
            // Actually, we don't have a 'due_amount' on customers table in the schema viewed earlier.
            // We only have it on invoices. So we must aggregate invoices grouped by customer.

            // 1. Fetch Customers
            const { data: customers, error: custError } = await supabase.from('customers').select('*');
            if (custError) throw custError;

            // 2. Fetch ALL Invoices (Positive Due & Negative Advance)
            const { data: invoices, error: invError } = await supabase.from('invoices').select('customer_id, due_amount');
            if (invError) throw invError;

            // Aggregate Dues (Net Balance)
            const customerDues = {};
            let totalMarketDue = 0;

            invoices.forEach(inv => {
                if (inv.customer_id) {
                    if (!customerDues[inv.customer_id]) customerDues[inv.customer_id] = 0;
                    customerDues[inv.customer_id] += parseFloat(inv.due_amount || 0);
                }
            });

            // Calculate Total Market Outstanding (Only count positive net balances)
            Object.values(customerDues).forEach(amount => {
                if (amount > 0) totalMarketDue += amount;
            });

            // Merge with Customer Names & Filter
            const ledgerList = customers
                .map(c => ({ ...c, total_due: customerDues[c.id] || 0 }))
                .filter(c => c.total_due > 1) // Filter out 0 or negative balances (advances)
                .sort((a, b) => b.total_due - a.total_due);

            setLedgerData({ totalDue: totalMarketDue, customers: ledgerList });

        } catch (err) {
            console.error("Ledger Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2 ${activeTab === id
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );

    return (
        <AppLayout title="Reports">
            <div className="flex flex-col h-full space-y-6">

                {/* Tabs Header */}
                <div className="flex border-b border-white/10">
                    <TabButton id="sales" label="Sales Summary" icon={TrendingUp} />
                    <TabButton id="inventory" label="Inventory Logic" icon={Package} />
                    <TabButton id="ledger" label="Customer Ledger" icon={Users} />
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto pr-2">

                    {/* --- SALES TAB --- */}
                    {activeTab === 'sales' && (
                        <div className="space-y-6 fade-in">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-white">Sales Performance</h2>
                                <select
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="bg-dark-800 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                >
                                    <option value="today">Today</option>
                                    <option value="last7days">Last 7 Days</option>
                                    <option value="last30days">Last 30 Days</option>
                                    <option value="all">All Time</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="glass p-6 rounded-xl border border-white/5 bg-gradient-to-br from-indigo-500/10 to-transparent">
                                    <p className="text-slate-400 text-sm mb-1">Total Sales</p>
                                    <h3 className="text-3xl font-bold text-white">₹{salesData.totalSales.toLocaleString()}</h3>
                                </div>
                                <div className="glass p-6 rounded-xl border border-white/5 bg-gradient-to-br from-emerald-500/10 to-transparent">
                                    <p className="text-slate-400 text-sm mb-1">Total Orders</p>
                                    <h3 className="text-3xl font-bold text-white">{salesData.totalOrders}</h3>
                                </div>
                                <div className="glass p-6 rounded-xl border border-white/5 bg-gradient-to-br from-amber-500/10 to-transparent">
                                    <p className="text-slate-400 text-sm mb-1">Avg. Order Value</p>
                                    <h3 className="text-3xl font-bold text-white">
                                        ₹{salesData.totalOrders > 0 ? (salesData.totalSales / salesData.totalOrders).toFixed(0) : 0}
                                    </h3>
                                </div>
                            </div>

                            <div className="glass rounded-xl border border-white/5 overflow-hidden">
                                <div className="p-4 border-b border-white/5 bg-gradient-to-r from-blue-500/10 to-transparent">
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-blue-400" />
                                        Top Selling Products
                                    </h3>
                                </div>
                                <table className="w-full text-left text-sm text-slate-300">
                                    <thead className="bg-white/5 text-xs uppercase font-medium text-slate-400">
                                        <tr>
                                            <th className="px-6 py-3">Product Name</th>
                                            <th className="px-6 py-3 text-right">Qty Sold</th>
                                            <th className="px-6 py-3 text-right">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {salesData.topProducts.length === 0 ? (
                                            <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-500">No sales in this period.</td></tr>
                                        ) : (
                                            salesData.topProducts.map((item, i) => (
                                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-3 font-medium text-white flex items-center gap-2">
                                                        <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-slate-400'}`}>
                                                            {i + 1}
                                                        </span>
                                                        {item.name}
                                                    </td>
                                                    <td className="px-6 py-3 text-right font-mono text-slate-200">{item.quantity}</td>
                                                    <td className="px-6 py-3 text-right font-mono text-green-400">₹{item.total.toLocaleString()}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* --- INVENTORY TAB --- */}
                    {activeTab === 'inventory' && (
                        <div className="space-y-6 fade-in">
                            <h2 className="text-xl font-bold text-white">Inventory Status</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="glass p-6 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
                                            <DollarSign className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-slate-400 text-sm">Total Stock Value</p>
                                            <h3 className="text-2xl font-bold text-white">₹{inventoryData.totalValue.toLocaleString()}</h3>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500">Calculated based on selling price * qty</p>
                                </div>
                                <div className="glass p-6 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400">
                                            <Package className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-slate-400 text-sm">Total Items in Stock</p>
                                            <h3 className="text-2xl font-bold text-white">{inventoryData.totalStock}</h3>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="glass rounded-xl border border-white/5 overflow-hidden">
                                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-red-500/5">
                                    <div className="flex items-center gap-2 text-red-400">
                                        <AlertCircle className="w-5 h-5" />
                                        <h3 className="font-bold">Low Stock Alerts ({inventoryData.lowStockItems.length})</h3>
                                    </div>
                                    <button
                                        onClick={handlePrintExport}
                                        disabled={inventoryData.lowStockItems.length === 0}
                                        className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded transition-colors text-white flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <Printer className="w-3 h-3" />
                                        Print List
                                    </button>
                                </div>
                                <div className="p-0">
                                    <table className="w-full text-left text-sm text-slate-300">
                                        <thead className="bg-white/5 text-xs uppercase font-medium text-slate-400">
                                            <tr>
                                                <th className="px-6 py-3">Product Name</th>
                                                <th className="px-6 py-3 text-right">Current Stock</th>
                                                <th className="px-6 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {inventoryData.lowStockItems.length === 0 ? (
                                                <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-500">All items are well stocked.</td></tr>
                                            ) : (
                                                inventoryData.lowStockItems.map(item => (
                                                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-white">{item.name}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className="text-red-400 font-bold">{item.stock}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button
                                                                onClick={() => openRestockModal(item)}
                                                                className="text-brand-400 text-xs cursor-pointer hover:underline font-medium hover:text-brand-300"
                                                            >
                                                                Restock
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- LEDGER TAB --- */}
                    {activeTab === 'ledger' && (
                        <div className="space-y-6 fade-in">
                            <h2 className="text-xl font-bold text-white">Customer Ledger (Udhaar)</h2>

                            <div className="glass p-6 rounded-xl border border-white/5 bg-gradient-to-r from-red-500/10 via-transparent to-transparent">
                                <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                                    <div>
                                        <p className="text-red-300 font-medium mb-1">Total Market Outstanding</p>
                                        <h3 className="text-4xl font-bold text-white">₹{ledgerData.totalDue.toLocaleString()}</h3>
                                        <p className="text-slate-400 text-xs mt-2">Total amount to be collected from {ledgerData.customers.length} customers.</p>
                                    </div>
                                    <div className="p-3 bg-red-400/20 rounded-full text-red-400">
                                        <Users className="w-8 h-8" />
                                    </div>
                                </div>
                            </div>

                            <div className="glass rounded-xl border border-white/5 overflow-hidden">
                                <div className="p-4 border-b border-white/5">
                                    <h3 className="font-bold text-white">Top Outstanding Dues</h3>
                                </div>
                                <table className="w-full text-left text-sm text-slate-300">
                                    <thead className="bg-white/5 text-xs uppercase font-medium text-slate-400">
                                        <tr>
                                            <th className="px-6 py-3">Customer Name</th>
                                            <th className="px-6 py-3">Phone</th>
                                            <th className="px-6 py-3 text-right">Total Due</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {ledgerData.customers.length === 0 ? (
                                            <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-500">No outstanding dues. Great job!</td></tr>
                                        ) : (
                                            ledgerData.customers.map((cust, i) => (
                                                <tr key={cust.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                                                        <span className="w-6 h-6 rounded bg-slate-700 text-xs flex items-center justify-center text-slate-300">{i + 1}</span>
                                                        {cust.name}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-400">{cust.phone}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-red-400">₹{cust.total_due.toLocaleString()}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* RESTOCK MODAL */}
            {restockModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-up">
                        <h3 className="text-lg font-bold text-white mb-2">Restock Product</h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Adding stock to <span className="text-brand-400 font-medium">{restockModal.product?.name}</span>
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">Quantity to Add</label>
                                <input
                                    type="number"
                                    className="w-full bg-dark-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all font-mono text-lg"
                                    placeholder="e.g. 50"
                                    value={restockModal.qty}
                                    onChange={(e) => setRestockModal({ ...restockModal, qty: e.target.value })}
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleRestockConfirm()}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setRestockModal({ open: false, product: null, qty: '' })}
                                    className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition-colors font-medium border border-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRestockConfirm}
                                    className="flex-1 py-3 rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors font-bold shadow-lg shadow-brand-500/20"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
};

export default Reports;
