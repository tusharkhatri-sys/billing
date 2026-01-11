import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { productSchema } from '../schemas/product';
import { Plus, Search, Filter, Loader2, PackageOpen, Barcode as BarcodeIcon, Printer, ChevronDown, Trash2 } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { useToast } from '../context/ToastContext';
import Barcode from 'react-barcode';

const Inventory = () => {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
    const [selectedProductForBarcode, setSelectedProductForBarcode] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        stock: '',
        category: '',
        sku: '',
        cost_price: '',
        unit: 'Pcs'
    });
    const [errors, setErrors] = useState({});
    const [printQuantity, setPrintQuantity] = useState(12);

    // UNIT OPTIONS
    const UNIT_OPTIONS = [
        { value: 'Pcs', label: 'Pcs' },
        { value: 'Pkt', label: 'Pkt' },
        { value: 'Box', label: 'Box' },
        { value: 'Doz', label: 'Doz' },
        { value: 'Kg', label: 'Kg' },
        { value: 'Gm', label: 'Gm' },
        { value: 'Ltr', label: 'Ltr' },
        { value: 'Ml', label: 'Ml' },
        { value: 'Mtr', label: 'Mtr' },
        { value: 'Ft', label: 'Ft' },
        { value: 'In', label: 'In' },
    ];

    // Fetch Products
    const fetchProducts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error fetching products:', error);
            showToast('Failed to load products', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    // Handle Form Change
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        // Clear error for this field
        if (errors[e.target.name]) {
            setErrors({ ...errors, [e.target.name]: null });
        }
    };

    // Generate Random SKU
    const generateSKU = () => {
        // Generate a random 8-12 digit number
        const randomSKU = Math.floor(10000000 + Math.random() * 90000000).toString();
        setFormData(prev => ({ ...prev, sku: randomSKU }));
    };

    // Handle Edit Click
    const handleEdit = (product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            price: product.price,
            stock: product.stock,
            category: product.category,
            sku: product.sku || '',
            cost_price: product.cost_price || '',
            unit: product.unit || 'Pcs'
        });
        setErrors({});
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
        setFormData({ name: '', price: '', stock: '', category: '', sku: '', cost_price: '', unit: 'Pcs' });
        setErrors({});
    };

    // Save Product (Add or Update)
    const handleSaveProduct = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrors({});

        try {
            // 1. Validate
            const validatedData = productSchema.parse(formData);

            let error;

            if (editingProduct) {
                // UPDATE
                const { error: updateError } = await supabase
                    .from('products')
                    .update(validatedData)
                    .eq('id', editingProduct.id)
                    .eq('user_id', user.id);
                error = updateError;
            } else {
                // INSERT
                const { error: insertError } = await supabase
                    .from('products')
                    .insert([
                        {
                            user_id: user.id,
                            ...validatedData
                        }
                    ]);
                error = insertError;
            }

            if (error) throw error;

            showToast(editingProduct ? 'Product updated!' : 'Product added!', 'success');
            closeModal();
            fetchProducts();

        } catch (err) {
            if (err.code === '23505') {
                setErrors({ sku: 'This Barcode/SKU already exists.' });
                showToast('Barcode must be unique', 'error');
            } else if (err.errors) {
                // Zod Errors
                const fieldErrors = {};
                err.errors.forEach((error) => {
                    fieldErrors[error.path[0]] = error.message;
                });
                setErrors(fieldErrors);
            } else {
                showToast(err.message, 'error');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Delete Click (Open Modal)
    const handleDelete = (product) => {
        setProductToDelete(product);
        setIsDeleteModalOpen(true);
    };

    // Confirm Delete Logic
    const confirmDelete = async () => {
        if (!productToDelete) return;

        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', productToDelete.id)
                .eq('user_id', user.id);

            if (error) throw error;

            showToast('Product deleted successfully', 'success');
            fetchProducts();
            setIsDeleteModalOpen(false);
            setProductToDelete(null);
        } catch (error) {
            console.error('Error deleting product:', error);
            showToast('Failed to delete product', 'error');
        }
    };

    // Handle View Barcode
    const handleViewBarcode = (product) => {
        setSelectedProductForBarcode(product);
        setIsBarcodeModalOpen(true);
        setPrintQuantity(12);
    };

    // Filtered Products
    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AppLayout title="Inventory">
            {/* Top Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 no-print">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        className="w-full bg-dark-800 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="btn-primary flex items-center gap-2 whitespace-nowrap"
                >
                    <Plus className="w-4 h-4" /> Add Product
                </button>
            </div>

            {/* Product List */}
            <div className="glass rounded-2xl border border-white/5 bg-dark-800/50 overflow-hidden no-print">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Loading inventory...</div>
                ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="p-4 rounded-full bg-slate-800 mb-3">
                            <PackageOpen className="w-8 h-8 text-slate-500" />
                        </div>
                        <h3 className="text-white font-medium mb-1">No products found</h3>
                        <p className="text-slate-500 text-sm">Get started by adding your first product.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-white/5 text-xs uppercase font-medium text-white">
                                <tr>
                                    <th className="px-6 py-4">Product Name</th>
                                    <th className="px-6 py-4">Category</th>
                                    <th className="px-6 py-4">Price</th>
                                    <th className="px-6 py-4">Stock</th>
                                    <th className="px-6 py-4">SKU</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium text-white">{product.name}</td>
                                        <td className="px-6 py-4">
                                            <span className="bg-brand-500/10 text-brand-300 px-2 py-0.5 rounded text-xs">
                                                {product.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-white">₹{product.price}</td>
                                        <td className="px-6 py-4">
                                            <span className={`${product.stock < 10 ? 'text-red-400' : 'text-green-400'}`}>
                                                {product.stock} {product.unit || 'Pcs'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 tracking-wider font-mono text-xs">
                                            {product.sku || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                                            {product.sku && (
                                                <button
                                                    onClick={() => handleViewBarcode(product)}
                                                    className="text-slate-400 hover:text-brand-400 transition-colors"
                                                    title="View Barcode"
                                                >
                                                    <BarcodeIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleEdit(product)}
                                                className="text-brand-400 hover:text-white transition-colors text-xs"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(product)}
                                                className="text-red-400 hover:text-red-300 transition-colors text-xs ml-2"
                                                title="Delete Product"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add/Edit Product Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingProduct ? "Edit Product" : "Add New Product"}
            >
                <form onSubmit={handleSaveProduct} className="space-y-4">
                    <Input
                        label="Product Name"
                        name="name"
                        placeholder="e.g. Maggi Noodles"
                        value={formData.name}
                        onChange={handleChange}
                        error={errors.name}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Category"
                            name="category"
                            placeholder="e.g. Snacks"
                            value={formData.category}
                            onChange={handleChange}
                            error={errors.category}
                        />
                        {/* Unit & Stock Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <label className="block text-brand-100 text-xs font-medium mb-1 pl-1">Unit</label>
                                <div className="relative">
                                    <select
                                        name="unit"
                                        value={formData.unit}
                                        onChange={handleChange}
                                        className="appearance-none w-full bg-white/5 border border-brand-500/30 text-white text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 block pl-3 pr-10 py-2 h-[42px]"
                                    >
                                        {UNIT_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value} className="bg-dark-900 text-white py-2">
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-300 pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <Input
                                    label="Stock Quantity"
                                    name="stock"
                                    type="number"
                                    placeholder="0"
                                    value={formData.stock}
                                    onChange={handleChange}
                                    error={errors.stock}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Selling Price (₹)"
                            name="price"
                            type="number"
                            placeholder="0.00"
                            value={formData.price}
                            onChange={handleChange}
                            error={errors.price}
                        />
                        <Input
                            label="Cost Price (₹) (Optional)"
                            name="cost_price"
                            type="number"
                            placeholder="0.00"
                            value={formData.cost_price}
                            onChange={handleChange}
                            error={errors.cost_price}
                        />
                    </div>

                    <div className="relative">
                        <div className="flex items-end gap-2">
                            <Input
                                label="Barcode / SKU"
                                name="sku"
                                placeholder="Scan or type code"
                                value={formData.sku}
                                onChange={handleChange}
                                error={errors.sku}
                            />
                            <button
                                type="button"
                                onClick={generateSKU}
                                className="bg-brand-500/20 text-brand-300 hover:bg-brand-500/30 p-2.5 rounded-lg mb-[2px] transition-colors"
                                title="Generate Random SKU"
                            >
                                <BarcodeIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Click icon to auto-generate barcode</p>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={closeModal}
                            className="flex-1 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 btn-primary flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingProduct ? 'Update Product' : 'Save Product')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* View Barcode Modal */}
            <Modal
                isOpen={isBarcodeModalOpen}
                onClose={() => setIsBarcodeModalOpen(false)}
                title="Print Barcodes"
            >
                <div className="flex flex-col items-center justify-center py-4">

                    {/* Quantity Selector */}
                    <div className="w-full mb-6">
                        <label className="block text-brand-100 text-xs font-medium mb-1 pl-1">Labels Quantity</label>
                        <input
                            type="number"
                            min="1"
                            max="50"
                            value={printQuantity}
                            onChange={(e) => setPrintQuantity(Number(e.target.value))}
                            className="input-field bg-white/5 border-brand-500/30 text-white focus:bg-brand-900/50 py-2 w-full"
                        />
                        <p className="text-xs text-slate-500 mt-1">Recommended: 12-24 per page</p>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-lg mb-6 transform scale-75 origin-top">
                        {selectedProductForBarcode?.sku && (
                            <Barcode
                                value={selectedProductForBarcode.sku}
                                width={2}
                                height={60}
                                fontSize={14}
                            />
                        )}
                    </div>

                    <button
                        onClick={() => window.print()}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        <Printer className="w-4 h-4" /> Print {printQuantity} Labels
                    </button>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Delete Product"
            >
                <div className="space-y-4">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                        <Trash2 className="w-5 h-5 text-red-500 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-medium text-red-200">Are you sure?</h4>
                            <p className="text-xs text-red-300/80 mt-1">
                                You are about to delete <strong>{productToDelete?.name}</strong>. This action cannot be undone.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="flex-1 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg transition-colors font-medium"
                        >
                            Delete Product
                        </button>
                    </div>
                </div>
            </Modal>
        </AppLayout>
    );
};

export default Inventory;
