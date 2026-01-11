import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    TrendingUp, TrendingDown, DollarSign, ShoppingBag,
    Package, AlertTriangle, Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

const StatCard = ({ title, value, subtext, icon: Icon, trend, trendValue, color }) => (
    <div className="glass p-6 rounded-2xl border border-white/5 bg-dark-800/50 hover:bg-dark-800/70 transition-all group">
        <div className="flex justify-between items-start mb-4">
            <div>
                <p className="text-brand-200 text-sm font-medium mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
            </div>
            <div className={`p-3 rounded-xl ${color} bg-opacity-20 text-white group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
            {trend === 'up' ? (
                <span className="text-green-400 flex items-center gap-1 font-medium bg-green-500/10 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3 h-3" /> {trendValue}
                </span>
            ) : trend === 'down' ? (
                <span className="text-red-400 flex items-center gap-1 font-medium bg-red-500/10 px-2 py-0.5 rounded-full">
                    <TrendingDown className="w-3 h-3" /> {trendValue}
                </span>
            ) : null}
            <span className="text-slate-500">{subtext}</span>
        </div>
    </div>
);

const Dashboard = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalSales: 0,
        totalOrders: 0,
        totalProducts: 0,
        lowStock: 0
    });
    const [recentOrders, setRecentOrders] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [topProducts, setTopProducts] = useState([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Invoices and Items in parallel
            const [invRes, itemRes, prodRes] = await Promise.all([
                supabase.from('invoices').select('*'),
                supabase.from('invoice_items').select('product_id, product_name, quantity, total'),
                supabase.from('products').select('id, stock')
            ]);

            if (invRes.error) throw invRes.error;
            if (itemRes.error) throw itemRes.error;
            if (prodRes.error) throw prodRes.error;

            const invoices = invRes.data;
            const invoiceItems = itemRes.data;
            const products = prodRes.data;

            // Calculate Totals
            const totalSales = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
            const totalOrders = invoices.length;
            const totalProducts = products.length;
            const lowStock = products.filter(p => p.stock <= 10).length;

            setStats({ totalSales, totalOrders, totalProducts, lowStock });

            // 2. Process Chart Data (Last 7 Days)
            const last7Days = [...Array(7)].map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - i);
                return d.toISOString().split('T')[0];
            }).reverse();

            const chartDataRaw = last7Days.map(date => {
                const daySales = invoices
                    .filter(inv => inv.created_at.startsWith(date))
                    .reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);

                // Format date to Name (e.g. Mon, Tue)
                const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
                return { name: dayName, sales: daySales, fullDate: date };
            });

            setChartData(chartDataRaw);

            // 3. Activity (Still keep recent orders for now, removing usage below)
            const sortedOrders = [...invoices].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
            const formattedRecent = sortedOrders.map(order => ({
                id: `#${order.full_invoice_number || order.invoice_number}`,
                customer: order.customer_name || 'Walk-in Customer',
                amount: `₹${order.total_amount}`,
                status: order.payment_status === 'paid' ? 'Completed' : 'Pending',
                time: getTimeAgo(new Date(order.created_at))
            }));
            setRecentOrders(formattedRecent);


            // 4. Calculate Top Selling Products
            const productStats = {};
            invoiceItems.forEach(item => {
                if (!productStats[item.product_name]) {
                    productStats[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 };
                }
                productStats[item.product_name].qty += Number(item.quantity);
                productStats[item.product_name].revenue += Number(item.total);
            });

            const sortedProducts = Object.values(productStats)
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 5);

            setTopProducts(sortedProducts);

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getTimeAgo = (date) => {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " mins ago";
        return Math.floor(seconds) + " seconds ago";
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <AppLayout title="Dashboard">
            {/* Welcome Banner */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-brand-500 mb-1">
                    {getGreeting()}, <span className="text-white">{user?.user_metadata?.full_name || user?.user_metadata?.owner_name || 'Partner'}</span>! 👋
                </h1>
                <p className="text-slate-400 text-sm">Here's what's happening in your store today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Total Sales"
                    value={`₹${stats.totalSales.toLocaleString()}`}
                    subtext="lifetime"
                    icon={DollarSign}
                    trend="up"
                    trendValue="Live"
                    color="bg-purple-500"
                />
                <StatCard
                    title="Total Orders"
                    value={stats.totalOrders}
                    subtext="lifetime"
                    icon={ShoppingBag}
                    trend="up"
                    trendValue="Live"
                    color="bg-blue-500"
                />
                <StatCard
                    title="Total Products"
                    value={stats.totalProducts}
                    subtext="in inventory"
                    icon={Package}
                    trend="up"
                    trendValue="Stock"
                    color="bg-indigo-500"
                />
                <StatCard
                    title="Low Stock"
                    value={stats.lowStock}
                    subtext="items < 10 qty"
                    icon={AlertTriangle}
                    trend={stats.lowStock > 0 ? "down" : "up"}
                    trendValue={stats.lowStock > 0 ? "Urgent" : "Good"}
                    color="bg-amber-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Chart */}
                <div className="lg:col-span-2 glass p-6 rounded-2xl border border-white/5 bg-dark-800/50">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-white">Sales Overview (Last 7 Days)</h3>
                    </div>
                    <div className="h-[300px] w-full" style={{ width: '100%', height: 300, minWidth: 0 }}>
                        {loading ? (
                            <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm animate-pulse">
                                Loading chart data...
                            </div>
                        ) : (
                            <ResponsiveContainer width="99%" height="100%" debounce={50}>
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                                        tickFormatter={(value) => `₹${value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="sales"
                                        stroke="#0ea5e9"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorSales)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Top Selling Products */}
                <div className="glass p-6 rounded-2xl border border-white/5 bg-dark-800/50">
                    <h3 className="text-lg font-semibold text-white mb-4">Top Selling Products</h3>
                    <div className="space-y-4">
                        {loading ? (
                            <p className="text-slate-500 text-sm">Loading stats...</p>
                        ) : topProducts.length === 0 ? (
                            <div className="text-center py-6 text-slate-500">
                                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No sales data yet.</p>
                            </div>
                        ) : (
                            topProducts.map((prod, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 font-bold text-xs">
                                            #{idx + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">{prod.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {prod.qty} units sold
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-white">₹{prod.revenue.toLocaleString()}</p>
                                        <p className="text-[10px] text-green-400 font-medium">Revenue</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

export default Dashboard;
