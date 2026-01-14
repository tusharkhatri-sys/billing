import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Search, ShoppingCart, User, Plus, Trash2, CreditCard, Receipt, Minus, Box, Tag, X, Save, Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import Input from '../components/ui/Input';
import { useToast } from '../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import CheckoutModal from '../components/pos/CheckoutModal';
import InvoiceReceipt from '../components/pos/InvoiceReceipt';
import { optional } from 'zod';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const POS = () => {
    const { user } = useAuth();
    const { showToast } = useToast();

    // -- State --
    // Strictly enforce mode based on user profile
    const [saleMode] = useState(user?.user_metadata?.business_type || 'retail'); // 'retail' | 'wholesale'
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedCategory, setSelectedCategory] = useState('All');
    const [mobileTab, setMobileTab] = useState('products');

    // Cart
    const [cart, setCart] = useState([]); // Array of { product, quantity, total }
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [previousBalance, setPreviousBalance] = useState(0);
    const [advanceBalance, setAdvanceBalance] = useState(0);
    const [lastInvoice, setLastInvoice] = useState(null);
    const [successModal, setSuccessModal] = useState({ open: false, invoice: null, customer: null, paymentData: null });
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    // Checkout & Invoice State
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [sellerProfile, setSellerProfile] = useState(null);

    // -- Fetch Initial Data --
    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                // Products
                const { data: prodData } = await supabase.from('products').select('*').order('name');
                setProducts(prodData || []);

                // Seller Profile
                const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setSellerProfile(profileData);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [user.id]);

    // -- Add Customer State --
    const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
    const [isSavingCustomer, setIsSavingCustomer] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', business_name: '', address: '', gstin: '', });

    // -- Handler: Save New Customer --
    const handleSaveCustomer = async (e) => {
        e.preventDefault();
        if (!newCustomer.name || !newCustomer.phone) {
            showToast('Name and Phone are required', 'error');
            return;
        }

        setIsSavingCustomer(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .insert([{
                    user_id: user.id,
                    ...newCustomer
                }])
                .select()
                .single();

            if (error) throw error;

            showToast('Customer added successfully', 'success');

            // Update local state
            setCustomers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
            setSelectedCustomer(data); // Auto-select new customer
            setIsAddCustomerOpen(false);
            setNewCustomer({ name: '', phone: '', business_name: '', address: '', gstin: '' });

        } catch (error) {
            console.error('Error adding customer:', error);
            showToast(error.message, 'error');
        } finally {
            setIsSavingCustomer(false);
        }
    };



    // -- Handle Checkout Open --
    const handleCheckoutClick = () => {
        if (cart.length === 0) {
            showToast('Cart is empty', 'error');
            return;
        }
        if (saleMode === 'wholesale' && !selectedCustomer) {
            showToast('Please select a customer for Wholesale', 'error');
            return;
        }
        setIsCheckoutOpen(true);
    };

    // -- Handle Payment Complete --
    const handlePaymentComplete = async (paymentData) => {
        try {
            // 1. Determine Invoice Prefix
            let invoicePrefix = 'SHOP'; // Default for Retail
            if (saleMode === 'wholesale' && selectedCustomer) {
                // Use customer prefix if available, otherwise generate from name (e.g. "Google" -> "GOO")
                invoicePrefix = selectedCustomer.invoice_prefix || selectedCustomer.name.substring(0, 3).toUpperCase();
            }

            // 2. Fetch Next Sequence for this Prefix
            // We lock this logic? No, simplistic optimistic locking for now (last + 1)
            const { data: lastInv, error: seqError } = await supabase
                .from('invoices')
                .select('invoice_sequence')
                .eq('user_id', user.id)
                .eq('invoice_prefix', invoicePrefix)
                .order('invoice_sequence', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (seqError) throw seqError;

            const nextSequence = (lastInv?.invoice_sequence || 0) + 1;
            const fullInvoiceNumber = `${invoicePrefix}-${nextSequence}`;

            // 3. Create Invoice
            const { data: invoice, error: invError } = await supabase
                .from('invoices')
                .insert([{
                    user_id: user.id,
                    customer_id: selectedCustomer?.id || null,
                    customer_name: selectedCustomer?.name || (saleMode === 'retail' ? 'Walk-in Customer' : 'Unknown'),
                    total_amount: paymentData.totalAmount,
                    paid_amount: paymentData.paidAmount,
                    due_amount: paymentData.dueAmount,
                    payment_status: paymentData.paymentStatus,
                    payment_method: paymentData.paymentMethod,
                    invoice_prefix: invoicePrefix,
                    invoice_sequence: nextSequence,
                    full_invoice_number: fullInvoiceNumber,
                    cash_received: paymentData.cashReceived || paymentData.paidAmount,
                    advance_used: paymentData.advanceUsed || 0,
                    advance_credited: paymentData.newAdvance || 0
                }])
                .select()
                .single();

            if (invError) throw invError;

            // 3.5 Handle Previous Dues Payment
            // Calculate how much was paid beyond the current bill (this goes to old dues + advance)
            const paidForOldDues = Math.max(0, paymentData.paidAmount - paymentData.totalAmount);

            if (paidForOldDues > 0 && selectedCustomer) {
                // Fetch unpaid invoices (oldest first)
                const { data: unpaidInvoices } = await supabase
                    .from('invoices')
                    .select('*')
                    .eq('customer_id', selectedCustomer.id)
                    .gt('due_amount', 0)
                    .neq('id', invoice.id) // Exclude current
                    .order('created_at', { ascending: true });

                if (unpaidInvoices && unpaidInvoices.length > 0) {
                    let remainingCash = paidForOldDues;
                    let clearedAmount = 0;

                    for (const oldInv of unpaidInvoices) {
                        if (remainingCash <= 0) break;

                        const payOff = Math.min(remainingCash, oldInv.due_amount);

                        await supabase
                            .from('invoices')
                            .update({
                                due_amount: oldInv.due_amount - payOff,
                                paid_amount: oldInv.paid_amount + payOff,
                                payment_status: (oldInv.due_amount - payOff) <= 0 ? 'paid' : 'partial'
                            })
                            .eq('id', oldInv.id);

                        remainingCash -= payOff;
                        clearedAmount += payOff;
                    }

                    // Remaining after clearing old dues = new advance
                    const actualNewAdvance = remainingCash;
                    paymentData.newAdvance = actualNewAdvance;

                    // Update the current invoice's advance_credited
                    await supabase
                        .from('invoices')
                        .update({ advance_credited: actualNewAdvance })
                        .eq('id', invoice.id);
                }
            }

            // 4. Create Invoice Items
            const invoiceItems = cart.map(item => ({
                invoice_id: invoice.id,
                product_id: item.product.id,
                product_name: item.product.name,
                quantity: item.quantity,
                unit: item.product.unit,
                price: item.product.price,
                total: item.total
            }));

            const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);
            if (itemsError) throw itemsError;

            // 5. Success
            showToast(`Sale Completed! Invoice #${fullInvoiceNumber}`, 'success');

            // 5.5 Update Local Product State (Decrement Stock)
            setProducts(prevProducts => prevProducts.map(p => {
                const soldItem = cart.find(c => c.product.id === p.id);
                if (soldItem) {
                    return { ...p, stock: p.stock - soldItem.quantity };
                }
                return p;
            }));

            // 6. Prepare for Print
            // Attach previousBalance to the local invoice object for printing purposes
            // Also attach 'cash_received' so receipt knows total collected
            const fullInvoice = {
                ...invoice,
                items: invoiceItems,
                previous_balance: previousBalance,
                cash_received: paymentData.cashReceived || paymentData.paidAmount,
                advance_used: paymentData.advanceUsed || 0,
                new_advance: paymentData.newAdvance || 0
            };
            setLastInvoice(fullInvoice);

            // Save customer reference before clearing
            const invoiceCustomer = selectedCustomer;

            setIsCheckoutOpen(false);
            setCart([]);
            setSelectedCustomer(null);
            setPreviousBalance(0);
            setAdvanceBalance(0);
            setCustomerSearch('');

            // 8. Update Customer's Advance Balance in DB
            if (invoiceCustomer && (paymentData.advanceUsed > 0 || paymentData.newAdvance > 0)) {
                const currentAdvance = invoiceCustomer.advance_balance || 0;
                const newAdvanceTotal = currentAdvance - (paymentData.advanceUsed || 0) + (paymentData.newAdvance || 0);

                await supabase
                    .from('customers')
                    .update({ advance_balance: Math.max(0, newAdvanceTotal) })
                    .eq('id', invoiceCustomer.id);
            }

            // 7. Handle Post-Checkout Action based on Sale Mode
            if (saleMode === 'retail') {
                // Retail: Auto Print
                setTimeout(() => {
                    window.print();
                }, 500);
            } else if (saleMode === 'wholesale' && invoiceCustomer?.phone) {
                // Wholesale: Show Success Modal with View/Share options
                setSuccessModal({
                    open: true,
                    invoice: fullInvoice,
                    customer: invoiceCustomer,
                    paymentData: paymentData,
                    waLink: null, // Will be set when user clicks Share
                });
            }

        } catch (error) {
            console.error('Checkout Error:', error);
            showToast('Checkout Failed: ' + error.message, 'error');
        }
    };

    // --- SUCCESS MODAL ACTIONS ---
    // Helper: Generate PDF using direct jsPDF (no html2canvas)
    const generateInvoicePDF = (invoice, customer, paymentData) => {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        let y = 20;
        const lineHeight = 6;
        const margin = 15;

        // Helper functions
        const centerText = (text, yPos, fontSize = 12) => {
            pdf.setFontSize(fontSize);
            const textWidth = pdf.getTextWidth(text);
            pdf.text(text, (pageWidth - textWidth) / 2, yPos);
        };
        const leftText = (text, yPos) => pdf.text(text, margin, yPos);
        const rightText = (text, yPos) => {
            const textWidth = pdf.getTextWidth(text);
            pdf.text(text, pageWidth - margin - textWidth, yPos);
        };
        const drawLine = (yPos) => {
            pdf.setDrawColor(150);
            pdf.setLineWidth(0.3);
            pdf.line(margin, yPos, pageWidth - margin, yPos);
        };

        // Header
        pdf.setFont('helvetica', 'bold');
        centerText(sellerProfile?.business_name || 'Retail Karr', y, 18);
        y += 8;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        if (sellerProfile?.address) {
            centerText(sellerProfile.address, y, 9);
            y += 5;
        }
        if (sellerProfile?.phone) {
            centerText(`Ph: ${sellerProfile.phone}`, y, 9);
            y += 5;
        }

        // Divider
        y += 3;
        drawLine(y);
        y += 8;

        // Invoice Info
        pdf.setFontSize(10);
        leftText(`Bill No: #${invoice.full_invoice_number || invoice.invoice_number}`, y);
        rightText(`Date: ${new Date(invoice.created_at).toLocaleDateString('en-IN')}`, y);
        y += lineHeight;

        if (customer) {
            leftText(`Customer: ${customer.name}`, y);
            rightText(`Phone: ${customer.phone}`, y);
            y += lineHeight;
        }

        // Table Header
        y += 5;
        drawLine(y);
        y += 5;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text('Item', margin, y);
        pdf.text('Qty', margin + 80, y);
        pdf.text('Rate', margin + 100, y);
        pdf.text('Amount', margin + 130, y);
        y += 4;
        drawLine(y);
        y += 5;

        // Items
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        if (invoice.items && invoice.items.length > 0) {
            invoice.items.forEach(item => {
                const name = item.product_name.length > 30 ? item.product_name.substring(0, 27) + '...' : item.product_name;
                pdf.text(name, margin, y);
                pdf.text(`${item.quantity}`, margin + 80, y);
                pdf.text(`${item.price}`, margin + 100, y);
                pdf.text(`${item.total}`, margin + 130, y);
                y += lineHeight;
            });
        }

        // Totals
        y += 3;
        drawLine(y);
        y += 6;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        leftText('Subtotal:', y);
        rightText(`Rs. ${invoice.total_amount}`, y);
        y += lineHeight;

        if (parseFloat(invoice.previous_balance) > 0) {
            leftText('Previous Outstanding:', y);
            rightText(`Rs. ${Number(invoice.previous_balance).toFixed(2)}`, y);
            y += lineHeight;
            pdf.setFontSize(12);
            leftText('Net Payable:', y);
            rightText(`Rs. ${(parseFloat(invoice.total_amount) + parseFloat(invoice.previous_balance)).toFixed(2)}`, y);
            y += lineHeight;
            pdf.setFontSize(10);
        }

        leftText(`Paid [${invoice.payment_method}]:`, y);
        rightText(`Rs. ${Number(invoice.cash_received || invoice.paid_amount).toFixed(2)}`, y);
        y += lineHeight;

        // Advance Used
        const advanceUsed = parseFloat(invoice.advance_used || 0);
        if (advanceUsed > 0) {
            pdf.setTextColor(5, 150, 105); // Green
            leftText('✓ Advance Used:', y);
            rightText(`- Rs. ${advanceUsed.toFixed(2)}`, y);
            y += lineHeight;
            pdf.setTextColor(0); // Reset to black
        }

        // New Advance Credited
        const newAdvance = parseFloat(invoice.new_advance || invoice.advance_credited || 0);
        if (newAdvance > 0) {
            pdf.setTextColor(5, 150, 105); // Green
            pdf.setFillColor(209, 250, 229);
            pdf.rect(margin, y - 4, pageWidth - 2 * margin, 8, 'F');
            leftText('★ Advance Credited:', y);
            rightText(`+ Rs. ${newAdvance.toFixed(2)}`, y);
            y += lineHeight;
            pdf.setTextColor(0); // Reset to black
        }

        const outstanding = Math.max(0, (parseFloat(invoice.total_amount) + parseFloat(invoice.previous_balance || 0) - advanceUsed) - parseFloat(invoice.cash_received || invoice.paid_amount));
        pdf.setFillColor(240, 240, 240);
        pdf.rect(margin, y - 4, pageWidth - 2 * margin, 8, 'F');
        leftText('Total Outstanding:', y);
        rightText(`Rs. ${outstanding.toFixed(2)}`, y);
        y += 12;

        // Footer
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        centerText('Thank you for your visit!', y, 9);
        y += 5;
        pdf.setTextColor(150);
        centerText('Powered by RetailKarr', y, 7);

        return pdf;
    };

    const handleShareWhatsApp = async () => {
        const { invoice, customer, paymentData } = successModal;
        if (!invoice || !customer) return;

        showToast('Generating PDF...', 'loading');

        try {
            // Generate PDF using direct jsPDF
            const pdf = generateInvoicePDF(invoice, customer, paymentData);
            const pdfBlob = pdf.output('blob');
            const fileName = `Invoice_${invoice.invoice_number}.pdf`;
            const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

            // Prepare Message
            const cleanPhone = customer.phone.replace(/\D/g, '').slice(-10);
            const fullPhone = `91${cleanPhone}`;

            const message = `*INVOICE: #${invoice.invoice_number}*
Date: ${new Date().toLocaleDateString()}

Dear *${customer.name}*,
Thank you for your purchase at *${sellerProfile?.business_name || 'Retail Karr'}*.

Bill Summary:
Total: Rs.${paymentData.totalAmount}
Paid: Rs.${paymentData.paidAmount}
*Balance Due: Rs.${paymentData.dueAmount}*

Thank you!`;

            // Attempt Native Share (Mobile)
            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    files: [pdfFile],
                    title: `Invoice #${invoice.invoice_number}`,
                    text: message
                });
                showToast('Shared successfully!', 'success');
            } else {
                // Desktop Fallback: Download PDF and show "Open Chat" button
                pdf.save(fileName);
                showToast('Invoice Downloaded!', 'success');

                const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message + '\n\n_(Please attach the downloaded invoice PDF)_')}`;
                setSuccessModal(prev => ({ ...prev, waLink: waUrl }));
            }

        } catch (err) {
            console.error("Share Error:", err);
            if (err.name !== 'AbortError') {
                showToast('Failed to share invoice', 'error');
            }
        }
    };

    const handleViewBill = async () => {
        const { invoice, customer, paymentData } = successModal;
        if (!invoice) {
            showToast('No invoice data', 'error');
            return;
        }
        showToast('Opening Preview...', 'loading');
        try {
            const pdf = generateInvoicePDF(invoice, customer, paymentData);
            const pdfBlob = pdf.output('blob');
            const blobUrl = URL.createObjectURL(pdfBlob);
            window.open(blobUrl, '_blank');
            showToast('Preview Opened', 'success');
        } catch (e) {
            console.error('Preview Error:', e);
            showToast('Preview Failed', 'error');
        }
    };

    // -- Fetch Customers --
    useEffect(() => {
        if (saleMode === 'wholesale') {
            const fetchCustomers = async () => {
                setLoadingCustomers(true);
                const { data } = await supabase.from('customers').select('*').order('name');
                setCustomers(data || []);
                setLoadingCustomers(false);
            };
            fetchCustomers();
        }
    }, [saleMode]);

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.phone && c.phone.includes(customerSearch))
    );

    // -- Fetch Products --
    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            const { data } = await supabase.from('products').select('*').order('name');
            setProducts(data || []);
            setLoading(false);
        };
        fetchProducts();
    }, []);

    // -- Derived State: Categories & Filtered Products --
    const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.sku && p.sku.includes(searchTerm));
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    // -- Helper: Update Quantity --
    const updateQuantity = (productId, change) => {
        const item = cart.find(i => i.product.id === productId);
        // Safety check if item not found (shouldn't happen via UI)
        if (!item) return;

        const newQty = item.quantity + change;

        // 1. Minimum Limit Check
        if (newQty < 1) return;

        // 2. Maximum Stock Limit Check
        if (newQty > item.product.stock) {
            showToast(`Stock limit reached for ${item.product.name}. Only ${item.product.stock} available.`, 'error');
            return;
        }

        setCart(prev => prev.map(i => {
            if (i.product.id === productId) {
                return { ...i, quantity: newQty, total: newQty * i.product.price };
            }
            return i;
        }));
    };

    // -- Helper: Remove from Cart --
    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    // -- Helper: Add to Cart --
    const addToCart = (product) => {
        if (product.stock <= 0) {
            showToast(`${product.name} is out of stock!`, 'error');
            return;
        }

        // Check if item exists in current cart state
        const existing = cart.find(item => item.product.id === product.id);

        if (existing) {
            if (existing.quantity + 1 > product.stock) {
                showToast(`Cannot add more. Stock limit reached for ${product.name}.`, 'error');
                return;
            }

            // Safe to update
            setCart(prev => prev.map(item =>
                item.product.id === product.id
                    ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.product.price }
                    : item
            ));
        } else {
            // New item, we already checked product.stock > 0 above
            setCart(prev => [...prev, { product, quantity: 1, total: product.price }]);
        }
    };

    // -- Handle Barcode Scan / Enter Key --
    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter' && searchTerm) {
            // 1. Try to find exact SKU match first
            const exactSkuMatch = products.find(p => p.sku === searchTerm || p.sku === searchTerm.trim());

            if (exactSkuMatch) {
                addToCart(exactSkuMatch);
                setSearchTerm(''); // Clear for next scan
                showToast(`Added: ${exactSkuMatch.name}`, 'success');
                e.preventDefault();
                return;
            }

            // 2. If no SKU match, maybe exact name match? (Optional, but good for speed)
            const exactNameMatch = products.find(p => p.name.toLowerCase() === searchTerm.toLowerCase());
            if (exactNameMatch) {
                addToCart(exactNameMatch);
                setSearchTerm('');
                showToast(`Added: ${exactNameMatch.name}`, 'success');
                e.preventDefault();
                return;
            }

            // 3. If no exact match, just keep search filter active (default behavior)
        }
    };

    // -- Render --
    return (
        <AppLayout title="Billing / Point of Sale">
            {/* Mobile Tab Toggle Only (Optional Top Bar? No, Floating Action Button is better) */}

            <div className="flex h-[calc(100vh-85px)] lg:h-[calc(100vh-100px)] gap-4 relative">

                {/* Left Side: Product Selector (65%) */}
                <div className={`${mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'} w-full lg:w-[65%] flex-col gap-4 flex-1 lg:h-full min-h-0`}>
                    {/* Header: Search & Categories */}
                    <div className="flex flex-col gap-3 lg:gap-4 shrink-0">
                        <div className="glass p-3 rounded-2xl border border-white/5 flex gap-4 items-center shadow-lg shadow-black/20">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-300 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Scan Barcode or Search Item..."
                                    className="w-full bg-dark-900/80 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 focus:outline-none transition-all"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    // Keep focus for scanner
                                    onKeyDown={handleSearchKeyDown}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Category Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${selectedCategory === cat
                                        ? 'bg-brand-500 text-white border-brand-400 shadow-lg shadow-brand-500/25'
                                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Grid */}
                    <div className="flex-1 overflow-y-auto pr-1 pb-20 lg:pb-0"> {/* Padding bottom for FAB on mobile */}
                        <motion.div layout className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 pb-20 lg:pb-0">
                            <AnimatePresence mode="popLayout">
                                {loading ? (
                                    // Skeleton Loader
                                    [...Array(12)].map((_, i) => (
                                        <div key={`skel-${i}`} className="h-[150px] lg:h-[160px] rounded-2xl bg-white/5 animate-pulse border border-white/5 p-4 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="h-5 w-16 bg-white/10 rounded-md"></div>
                                                </div>
                                                <div className="h-4 w-3/4 bg-white/10 rounded mb-1"></div>
                                                <div className="h-4 w-1/2 bg-white/10 rounded"></div>
                                            </div>
                                            <div className="flex justify-between items-end mt-2">
                                                <div className="w-16 h-8 bg-white/10 rounded"></div>
                                                <div className="w-12 h-5 bg-white/10 rounded"></div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    filteredProducts.map(product => (
                                        <motion.button
                                            layout
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            whileHover={{ scale: 1.02, y: -2 }}
                                            whileTap={{ scale: 0.98 }}
                                            key={product.id}
                                            onClick={() => addToCart(product)}
                                            className="relative group bg-gradient-to-br from-white/10 to-white/5 p-3 lg:p-4 rounded-2xl border border-white/10 hover:border-brand-500/50 hover:shadow-xl hover:shadow-brand-500/10 transition-all text-left flex flex-col justify-between h-[150px] lg:h-[160px] overflow-hidden"
                                        >
                                            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-10 transition-opacity duration-500">
                                                <Box className="w-24 h-24 rotate-12" />
                                            </div>

                                            <div className="relative z-10 w-full">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded-md bg-black/40 text-brand-200 border border-white/5 backdrop-blur-sm">
                                                        {product.category?.toUpperCase() || 'GENERAL'}
                                                    </span>
                                                </div>
                                                <h3 className="font-semibold text-white text-sm lg:text-lg leading-tight mb-1 line-clamp-2 min-h-[2.5rem] lg:min-h-[3.5rem] group-hover:text-brand-100 transition-colors">
                                                    {product.name}
                                                </h3>
                                            </div>

                                            <div className="relative z-10 flex justify-between items-end mt-2 w-full">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] lg:text-xs text-slate-400 font-medium mb-0.5">Price</span>
                                                    <span className="text-white font-bold text-lg lg:text-xl tracking-tight">₹{product.price}</span>
                                                </div>
                                                <div className={`flex flex-col items-end`}>
                                                    <span className="text-[10px] text-slate-400 font-medium mb-0.5">Stock</span>
                                                    <span className={`text-[10px] lg:text-xs font-bold px-1.5 py-0.5 rounded ${product.stock > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                                        {product.stock} {product.unit}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="absolute inset-0 bg-brand-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 backdrop-blur-[2px]">
                                                <Plus className="w-8 h-8 text-white drop-shadow-lg" />
                                            </div>
                                        </motion.button>
                                    ))
                                )}
                            </AnimatePresence>
                        </motion.div>

                        {filteredProducts.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500 opacity-60">
                                <Search className="w-12 h-12 mb-4" />
                                <p className="text-lg">No products found</p>
                            </div>
                        )}
                    </div>

                    {/* Mobile Floating View Cart Button */}
                    <div className="lg:hidden absolute bottom-4 left-0 right-0 px-4 z-30">
                        {cart.length > 0 && (
                            <button
                                onClick={() => setMobileTab('cart')}
                                className="w-full bg-brand-600 text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center animate-in slide-in-from-bottom-4 fade-in"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                                        {cart.reduce((sum, i) => sum + i.quantity, 0)}
                                    </div>
                                    <span className="font-medium">View Cart</span>
                                </div>
                                <span className="font-bold text-lg">₹{cart.reduce((sum, i) => sum + i.total, 0)}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Side: Cart & Checkout (35%) */}
                <div className={`${mobileTab === 'products' ? 'hidden lg:flex' : 'flex'} w-full lg:w-[35%] glass rounded-2xl border border-white/10 flex-col overflow-hidden bg-dark-800 h-full lg:h-full shrink-0 font-sans shadow-2xl lg:shadow-none z-10`}>

                    {/* Mobile Back Button */}
                    <div className="lg:hidden p-2 border-b border-white/5 bg-white/5">
                        <button
                            onClick={() => setMobileTab('products')}
                            className="flex items-center gap-2 text-slate-300 hover:text-white px-2 py-1"
                        >
                            ← Back to Products
                        </button>
                    </div>

                    {/* Header: Sale Mode Toggle REMOVED - Enforced by Business Type */}
                    <div className="p-3 lg:p-4 border-b border-white/5 bg-black/20 shrink-0">
                        {/* Display Active Mode Badge */}
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-white font-bold text-lg flex items-center gap-2">
                                {saleMode === 'wholesale' ? <User className="w-5 h-5 text-purple-400" /> : <ShoppingCart className="w-5 h-5 text-brand-400" />}
                                {saleMode === 'wholesale' ? 'Wholesale Billing' : 'Retail Billing'}
                            </span>
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${saleMode === 'wholesale' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-brand-500/20 text-brand-300 border-brand-500/30'}`}>
                                {saleMode.toUpperCase()} MODE
                            </span>
                        </div>

                        {/* Customer Info & Selection */}
                        <AnimatePresence>
                            {saleMode === 'wholesale' && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-visible z-20" // Overflow visible for dropdown
                                >
                                    <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl mb-1 relative">

                                        {!selectedCustomer ? (
                                            // Search Mode
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-xs text-purple-300/70 font-medium uppercase tracking-wider flex items-center gap-1">
                                                        <User className="w-3 h-3" /> Select Customer *
                                                    </label>
                                                    <button
                                                        onClick={() => setIsAddCustomerOpen(true)}
                                                        className="text-[10px] bg-purple-600 hover:bg-purple-500 text-white px-2 py-0.5 rounded shadow-lg shadow-purple-600/20 transition-colors"
                                                    >
                                                        + New
                                                    </button>
                                                </div>

                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 w-4 h-4" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search by Name or Mobile..."
                                                        className="w-full bg-dark-900/50 border border-purple-500/30 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none placeholder-purple-300/30"
                                                        value={customerSearch}
                                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                                        onFocus={() => setShowCustomerDropdown(true)}
                                                    />

                                                    {/* Dropdown Results */}
                                                    {showCustomerDropdown && (customerSearch || filteredCustomers.length > 0) && (
                                                        <div className="absolute top-full left-0 right-0 mt-2 bg-dark-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[200px] overflow-y-auto">
                                                            {loadingCustomers ? (
                                                                <div className="p-3 text-center text-xs text-slate-500">Loading...</div>
                                                            ) : filteredCustomers.length > 0 ? (
                                                                filteredCustomers.map(cust => (
                                                                    <button
                                                                        key={cust.id}
                                                                        onClick={() => {
                                                                            setSelectedCustomer(cust);
                                                                            setShowCustomerDropdown(false);
                                                                            setCustomerSearch('');
                                                                            // Fetch Balance & Advance
                                                                            const fetchBalances = async () => {
                                                                                // Get outstanding dues from invoices
                                                                                const { data: invoiceData } = await supabase
                                                                                    .from('invoices')
                                                                                    .select('due_amount')
                                                                                    .eq('customer_id', cust.id);

                                                                                if (invoiceData) {
                                                                                    const totalDue = invoiceData.reduce((sum, inv) => sum + (inv.due_amount || 0), 0);
                                                                                    setPreviousBalance(totalDue);
                                                                                }

                                                                                // Get advance balance from customer record
                                                                                setAdvanceBalance(cust.advance_balance || 0);
                                                                            };
                                                                            fetchBalances();
                                                                        }}
                                                                        className="w-full text-left p-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors flex flex-col gap-0.5"
                                                                    >
                                                                        <span className="text-sm font-medium text-white">{cust.name}</span>
                                                                        <span className="text-xs text-slate-500 flex justify-between">
                                                                            <span>{cust.phone}</span>
                                                                            {cust.business_name && <span className="text-brand-300/70">{cust.business_name}</span>}
                                                                        </span>
                                                                    </button>
                                                                ))
                                                            ) : (
                                                                <div className="p-3 text-center text-xs text-slate-500">No customers found.</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            // Selected Customer View
                                            <div className="flex items-center justify-between group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/30">
                                                        {selectedCustomer.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white leading-none">{selectedCustomer.name}</p>
                                                        <p className="text-xs text-purple-300/70 mt-1">{selectedCustomer.phone}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedCustomer(null)}
                                                    className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
                        <AnimatePresence mode="popLayout">
                            {cart.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center text-slate-500/50"
                                    key="empty-cart"
                                >
                                    <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                                        <ShoppingCart className="w-10 h-10" />
                                    </div>
                                    <p className="text-lg font-medium text-slate-400">Cart is empty</p>
                                    <p className="text-sm max-w-[200px] text-center mt-1">Scan barcode or click products to start a new sale.</p>
                                </motion.div>
                            ) : (
                                cart.map((item) => (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, x: -20, scale: 0.95 }}
                                        animate={{ opacity: 1, x: 0, scale: 1 }}
                                        exit={{ opacity: 0, x: -20, scale: 0.95 }}
                                        key={item.product.id}
                                        className="flex flex-col gap-2 bg-gradient-to-r from-white/10 to-transparent p-3.5 rounded-xl border border-white/5 hover:border-brand-500/30 transition-colors group relative overflow-hidden"
                                    >
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500/50 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity" />

                                        <div className="flex justify-between items-start z-10">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className="font-semibold text-white/90 truncate leading-snug" title={item.product.name}>{item.product.name}</div>
                                                <div className="text-xs text-brand-200/70 font-mono mt-0.5">₹{item.product.price} / {item.product.unit}</div>
                                            </div>
                                            <div className="font-bold text-white text-lg tracking-tight">₹{item.total}</div>
                                        </div>

                                        <div className="flex justify-between items-center mt-2 z-10 pt-2 border-t border-white/5">
                                            <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1 border border-white/5">
                                                <button
                                                    onClick={() => updateQuantity(item.product.id, -1)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-white transition-colors active:scale-95"
                                                >
                                                    <Minus className="w-3.5 h-3.5" />
                                                </button>
                                                <span className="text-sm font-bold text-white w-8 text-center tab-num">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.product.id, 1)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-white transition-colors active:scale-95"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <button
                                                onClick={() => removeFromCart(item.product.id)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                                                title="Remove Item"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer: Totals & Pay */}
                    <div className="p-4 bg-black/40 border-t border-white/10 space-y-3">
                        <div className="flex justify-between text-slate-400 text-sm">
                            <span>Subtotal</span>
                            <span>₹{cart.reduce((sum, i) => sum + i.total, 0)}</span>
                        </div>
                        <div className="flex justify-between text-white text-xl font-bold">
                            <span>Total</span>
                            <span>₹{cart.reduce((sum, i) => sum + i.total, 0)}</span>
                        </div>

                        <button
                            onClick={handleCheckoutClick}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-xl text-lg font-bold flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-[0.98] transition-all"
                        >
                            <Receipt className="w-5 h-5" />
                            {saleMode === 'wholesale' ? 'Create Invoice' : 'Collect Cash'}
                        </button>
                    </div>

                </div>
            </div>

            {/* Hidden Invoice Receipt for Print */}
            <div className="print-only" id="hidden-receipt">
                {lastInvoice && (
                    <InvoiceReceipt
                        invoice={lastInvoice}
                        sellerProfile={sellerProfile}
                        customer={lastInvoice.customer_id ? { name: lastInvoice.customer_name, phone: selectedCustomer?.phone || '' } : null}
                    />
                )}
            </div>

            {/* Checkout Modal */}
            <CheckoutModal
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                cartTotal={cart.reduce((sum, i) => sum + i.total, 0)}
                customer={selectedCustomer}
                previousBalance={previousBalance}
                advanceBalance={advanceBalance}
                onComplete={handlePaymentComplete}
            />

            {/* Success Modal */}
            <AnimatePresence>
                {successModal.open && successModal.invoice && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-dark-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 text-center border-b border-white/5 bg-emerald-500/5">
                                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-1">Invoice Created!</h2>
                                <p className="text-slate-400">Transaction completed successfully.</p>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-slate-400">Invoice No:</span>
                                        <span className="text-white font-mono font-bold">#{successModal.invoice.invoice_number}</span>
                                    </div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-slate-400">Customer:</span>
                                        <span className="text-white font-medium">{successModal.customer?.name}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-brand-300 font-bold border-t border-white/10 pt-2 mt-2">
                                        <span>Total Amount:</span>
                                        <span>₹{successModal.paymentData?.totalAmount}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={handleViewBill}
                                        className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors border border-white/10 flex items-center justify-center gap-2"
                                    >
                                        <Box className="w-4 h-4" />
                                        View Bill
                                    </button>

                                    {!successModal.waLink ? (
                                        <button
                                            onClick={handleShareWhatsApp}
                                            className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                                        >
                                            <Receipt className="w-4 h-4" />
                                            Share on WA
                                        </button>
                                    ) : (
                                        <a
                                            href={successModal.waLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                                        >
                                            <ArrowRight className="w-4 h-4" />
                                            Open Chat
                                        </a>
                                    )}
                                </div>

                                <button
                                    onClick={() => setSuccessModal({ open: false, invoice: null })}
                                    className="w-full py-3 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors"
                                >
                                    Close & Start New Sale
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Add Customer Modal */}
            <AnimatePresence>
                {isAddCustomerOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-dark-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="flex justify-between items-center p-4 border-b border-white/5 bg-white/5">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <User className="w-5 h-5 text-brand-400" />
                                    Add New Customer
                                </h2>
                                <button
                                    onClick={() => setIsAddCustomerOpen(false)}
                                    className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveCustomer} className="p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-400">Name *</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-500 outline-none transition-colors"
                                            placeholder="John Doe"
                                            value={newCustomer.name}
                                            onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-400">Phone *</label>
                                        <input
                                            required
                                            type="tel"
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-500 outline-none transition-colors"
                                            placeholder="9876543210"
                                            value={newCustomer.phone}
                                            onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400">Business Name</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-500 outline-none transition-colors"
                                        placeholder="Company Ltd."
                                        value={newCustomer.business_name}
                                        onChange={e => setNewCustomer({ ...newCustomer, business_name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400">GSTIN</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-500 outline-none transition-colors uppercase"
                                        placeholder="27ABCDE1234F1Z5"
                                        value={newCustomer.gstin}
                                        onChange={e => setNewCustomer({ ...newCustomer, gstin: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400">Address</label>
                                    <textarea
                                        rows="2"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-500 outline-none transition-colors resize-none"
                                        placeholder="Full Address"
                                        value={newCustomer.address}
                                        onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={isSavingCustomer}
                                        className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 text-sm"
                                    >
                                        {isSavingCustomer ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" /> Save Customer
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </AppLayout>
    );
};

export default POS;
