import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Search, UserPlus, Phone, Building2, MapPin, Trash2, Loader2, User } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import CustomerDetailsModal from '../components/customers/CustomerDetailsModal';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Edit } from 'lucide-react';

const Customers = () => {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sellerProfile, setSellerProfile] = useState(null);

    // Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null); // For Edit Mode
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        phone: '',
        invoice_prefix: '',
        business_name: '',
        address: '',
        gstin: ''
    });

    // Details Modal State
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Delete State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState(null);

    // -- Fetch Customers & Profile --
    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCustomers(data || []);

            // Fetch seller profile for invoice printing
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            setSellerProfile(profile);

        } catch (error) {
            console.error('Error fetching customers:', error);
            showToast('Failed to load customers', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    // -- Add / Edit Customer --
    const handleSaveCustomer = async (e) => {
        e.preventDefault();
        if (!newCustomer.name || !newCustomer.phone) {
            showToast('Name and Phone are required', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingCustomer) {
                // Update
                const { data, error } = await supabase
                    .from('customers')
                    .update({ ...newCustomer })
                    .eq('id', editingCustomer.id)
                    .select()
                    .single();

                if (error) throw error;
                showToast('Customer updated successfully', 'success');
                setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? data : c));
            } else {
                // Insert
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
                setCustomers(prev => [data, ...prev]);
            }

            closeAddModal();
        } catch (error) {
            console.error('Error saving customer:', error);
            showToast(error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openAddModal = () => {
        setEditingCustomer(null);
        setNewCustomer({ name: '', phone: '', business_name: '', address: '', gstin: '' });
        setIsAddModalOpen(true);
    };

    const handleEditClick = (e, cust) => {
        e.stopPropagation(); // Prevent row click
        setEditingCustomer(cust);
        setNewCustomer({
            name: cust.name,
            phone: cust.phone,
            invoice_prefix: cust.invoice_prefix || '',
            business_name: cust.business_name || '',
            address: cust.address || '',
            gstin: cust.gstin || ''
        });
        setIsAddModalOpen(true);
    };

    const closeAddModal = () => {
        setIsAddModalOpen(false);
        setEditingCustomer(null);
        setNewCustomer({ name: '', phone: '', business_name: '', address: '', gstin: '' });
    };

    // -- Delete Customer --
    const handleDeleteClick = (e, cust) => {
        e.stopPropagation();
        setCustomerToDelete(cust);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!customerToDelete) return;
        try {
            const { error } = await supabase
                .from('customers')
                .delete()
                .eq('id', customerToDelete.id);

            if (error) throw error;

            showToast('Customer deleted', 'success');
            setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));
            setDeleteModalOpen(false);
            setCustomerToDelete(null);
        } catch (error) {
            showToast('Failed to delete: ' + error.message, 'error');
        }
    };

    // -- View Details --
    const handleRowClick = (cust) => {
        setSelectedCustomer(cust);
        setDetailsModalOpen(true);
    };

    // -- Filter --
    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(searchTerm)) ||
        (c.business_name && c.business_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <AppLayout title="Customers">
            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search customers..."
                        className="w-full bg-dark-800 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={openAddModal}
                    className="btn-primary flex items-center gap-2 whitespace-nowrap"
                >
                    <UserPlus className="w-4 h-4" /> Add Customer
                </button>
            </div>

            {/* Content */}
            <div className="glass rounded-2xl border border-white/5 bg-dark-800/50 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                        <Loader2 className="w-6 h-6 animate-spin mb-2" />
                        Loading Directory...
                    </div>
                ) : customers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="p-4 rounded-full bg-slate-800 mb-3">
                            <User className="w-8 h-8 text-slate-500" />
                        </div>
                        <h3 className="text-white font-medium mb-1">No customers yet</h3>
                        <p className="text-slate-500 text-sm">Add your first customer to track sales.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-white/5 text-xs uppercase font-medium text-white">
                                <tr>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Contact</th>
                                    <th className="px-6 py-4">Business / GST</th>
                                    <th className="px-6 py-4">Location</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                <AnimatePresence>
                                    {filteredCustomers.map((cust) => (
                                        <motion.tr
                                            key={cust.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            onClick={() => handleRowClick(cust)}
                                            className="hover:bg-white/5 transition-colors group cursor-pointer"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center font-bold">
                                                        {cust.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-white">{cust.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                                                    {cust.phone}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {cust.business_name ? (
                                                    <div className="flex flex-col">
                                                        <span className="flex items-center gap-2 text-white/90">
                                                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                                            {cust.business_name}
                                                        </span>
                                                        {cust.gstin && <span className="text-[10px] pl-5.5 text-slate-500 font-mono">GST: {cust.gstin}</span>}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-600">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {cust.address ? (
                                                    <div className="flex items-center gap-2 max-w-[200px] truncate" title={cust.address}>
                                                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                                        {cust.address}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-600">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={(e) => handleEditClick(e, cust)}
                                                        className="p-2 hover:bg-brand-500/10 text-slate-500 hover:text-brand-400 rounded-lg transition-colors"
                                                        title="Edit Customer"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteClick(e, cust)}
                                                        className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                                                        title="Delete Customer"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                        {filteredCustomers.length === 0 && searchTerm && (
                            <div className="p-8 text-center text-slate-500">
                                No result found for "{searchTerm}"
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Add/Edit Customer Modal */}
            <Modal
                isOpen={isAddModalOpen}
                onClose={closeAddModal}
                title={editingCustomer ? "Edit Customer" : "Add New Customer"}
            >
                <form onSubmit={handleSaveCustomer} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Name *"
                            placeholder="John Doe"
                            value={newCustomer.name}
                            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                            required
                        />
                        <Input
                            label="Phone *"
                            placeholder="9876543210"
                            type="tel"
                            value={newCustomer.phone}
                            onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                            required
                        />
                    </div>
                    <Input
                        label="Business Name"
                        placeholder="Company Ltd."
                        value={newCustomer.business_name}
                        onChange={(e) => setNewCustomer({ ...newCustomer, business_name: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="GSTIN"
                            placeholder="27ABCDE1234F1Z5"
                            value={newCustomer.gstin}
                            onChange={(e) => setNewCustomer({ ...newCustomer, gstin: e.target.value })}
                            className="uppercase"
                        />
                        <Input
                            label="Invoice Prefix"
                            placeholder="e.g. TG"
                            value={newCustomer.invoice_prefix || ''}
                            onChange={(e) => setNewCustomer({ ...newCustomer, invoice_prefix: e.target.value.toUpperCase() })}
                            className="uppercase font-bold tracking-wider"
                            maxLength={5}
                        />
                    </div>
                    <div>
                        <label className="block text-brand-100 text-xs font-medium mb-1 pl-1">Address</label>
                        <textarea
                            rows="3"
                            className="w-full bg-dark-950/50 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 outline-none transition-all resize-none"
                            placeholder="Full Address"
                            value={newCustomer.address}
                            onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                        />
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={closeAddModal}
                            className="flex-1 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 btn-primary flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4" /> {editingCustomer ? 'Update' : 'Save'} Customer</>}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Delete Customer"
            >
                <div className="space-y-4">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                        <Trash2 className="w-5 h-5 text-red-500 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-medium text-red-200">Are you sure?</h4>
                            <p className="text-xs text-red-300/80 mt-1">
                                You are about to delete <strong>{customerToDelete?.name}</strong>. This action cannot be undone.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => setDeleteModalOpen(false)}
                            className="flex-1 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg transition-colors font-medium"
                        >
                            Delete Customer
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Customer Details Modal */}
            <CustomerDetailsModal
                isOpen={detailsModalOpen}
                onClose={() => setDetailsModalOpen(false)}
                customer={selectedCustomer}
                sellerProfile={sellerProfile}
            />
        </AppLayout>
    );
};

export default Customers;
