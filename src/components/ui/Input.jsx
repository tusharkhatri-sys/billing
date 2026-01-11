import React from 'react';

const Input = ({ label, error, className = '', ...props }) => {
    return (
        <div className="w-full">
            {label && <label className="block text-brand-100 text-xs font-medium mb-1 pl-1">{label}</label>}
            <input
                className={`w-full bg-dark-950/50 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 outline-none transition-all ${error ? 'border-red-500' : ''} ${className}`}
                {...props}
            />
            {error && <p className="text-red-400 text-xs mt-1 pl-1">{error}</p>}
        </div>
    );
};

export default Input;
