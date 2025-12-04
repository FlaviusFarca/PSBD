import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Calendar, CheckCircle } from 'lucide-react';

// Folosim 127.0.0.1 pentru stabilitate pe Windows
const API_URL = "http://127.0.0.1:5000/api";

// --- FUNCȚIE PENTRU CERERI AUTENTIFICATE ---
const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('courier_app_token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('courier_app_token');
        localStorage.removeItem('courier_app_user');
        window.location.reload();
        throw new Error('Sesiunea a expirat. Vă rugăm să vă autentificați din nou.');
    }
    
    return response;
};

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-9999 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b">
                    <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                    <button 
                        onClick={onClose}
                        className="text-gray-500 hover:text-red-500 text-2xl transition-colors"
                    >
                        ×
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

const ExportButton = ({ 
    endpoint, 
    filename, 
    filters = {}, 
    buttonText = "Export",
    buttonVariant = "green",
    disabled = false,
    onExportStart,
    onExportComplete,
    modalTitle = "Export Date",
    modalDescription = "Selectați formatul pentru exportul de date."
}) => {
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState('excel');
    const [showSuccess, setShowSuccess] = useState(false);
    
    const handleExport = async (format) => {
        if (onExportStart) onExportStart();
        setLoading(true);
        setShowSuccess(false);
        
        try {
            const params = new URLSearchParams();
            
            // Adaugă filtrele la parametri
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '' && value !== 'Toate') {
                    params.append(key, value);
                }
            });
            
            // Adaugă timestamp pentru cache busting
            params.append('_t', Date.now());
            
            // Construim URL-ul complet
            const url = `${API_URL}/export/${endpoint}/${format}?${params}`;
            
            // Folosim authFetch pentru autentificare
            const response = await authFetch(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Eroare server (${response.status}): ${errorText}`);
            }
            
            // Obținem blob-ul
            const blob = await response.blob();
            
            // Verificăm dacă blob-ul este valid
            if (!blob || blob.size === 0) {
                throw new Error('Fișierul exportat este gol.');
            }
            
            // Creăm URL pentru descărcare
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            
            // Setăm numele fișierului
            const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const extension = format === 'excel' ? 'xlsx' : 'csv';
            const defaultFilename = `${endpoint}_${timestamp}.${extension}`;
            a.download = filename || defaultFilename;
            
            // Trigger descărcare
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Cleanup
            window.URL.revokeObjectURL(downloadUrl);
            
            // Success feedback
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
            
            if (onExportComplete) onExportComplete();
            
        } catch (error) {
            console.error('Eroare export:', error);
            alert(`Eroare la export: ${error.message || 'Verificați conexiunea la server'}`);
        } finally {
            setLoading(false);
        }
    };
    
    const buttonClasses = {
        green: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
        blue: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
        gray: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500',
        red: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        purple: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
    };
    
    const formatOptions = [
        { 
            id: 'excel', 
            icon: FileSpreadsheet, 
            label: 'Excel (.xlsx)', 
            description: 'Format avansat cu formatare și formule',
            color: 'text-green-600',
            bgColor: 'hover:bg-green-50',
            borderColor: 'border-green-300'
        },
        { 
            id: 'csv', 
            icon: FileText, 
            label: 'CSV (.csv)', 
            description: 'Format simplu compatibil cu toate aplicațiile',
            color: 'text-blue-600',
            bgColor: 'hover:bg-blue-50',
            borderColor: 'border-blue-300'
        }
    ];
    
    const handleFormatSelect = (formatId) => {
        setSelectedFormat(formatId);
        setTimeout(() => {
            handleExport(formatId);
            setModalOpen(false);
        }, 300);
    };
    
    return (
        <>
            <button
                onClick={() => setModalOpen(true)}
                disabled={disabled || loading}
                className={`
                    text-white px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-md 
                    transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
                    focus:outline-none focus:ring-2 focus:ring-offset-2
                    ${buttonClasses[buttonVariant]}
                    ${(disabled || loading) ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                {loading ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span className="font-medium">Se exportă...</span>
                    </>
                ) : (
                    <>
                        <Download className="w-4 h-4" />
                        <span className="font-medium">{buttonText}</span>
                    </>
                )}
            </button>
            
            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
                <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-800">
                            {modalDescription}
                        </p>
                        {Object.keys(filters).length > 0 && (
                            <div className="mt-2 text-xs text-blue-600">
                                <span className="font-semibold">Filtre active:</span> {
                                    Object.entries(filters)
                                        .filter(([key, value]) => value && value !== 'Toate')
                                        .map(([key, value]) => `${key}: ${value}`)
                                        .join(', ') || 'Toate datele'
                                }
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                        {formatOptions.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => handleFormatSelect(option.id)}
                                disabled={loading}
                                className={`
                                    p-4 border rounded-lg flex flex-col items-center gap-2 
                                    transition-all duration-200 transform hover:scale-[1.02]
                                    ${selectedFormat === option.id 
                                        ? 'border-2 bg-gradient-to-r from-blue-50 to-white' 
                                        : 'border-gray-300 hover:border-blue-300'
                                    }
                                    ${option.bgColor}
                                    ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                            >
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white border shadow-sm">
                                    <option.icon className={`w-6 h-6 ${option.color}`} />
                                </div>
                                <div className="text-center">
                                    <span className="font-bold text-gray-800 block">{option.label}</span>
                                    <span className="text-xs text-gray-500 mt-1 block">
                                        {option.description}
                                    </span>
                                </div>
                                {selectedFormat === option.id && (
                                    <div className="flex items-center gap-1 text-sm text-green-600 font-semibold">
                                        <CheckCircle className="w-4 h-4" />
                                        Selectat
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                    
                    <div className="pt-4 border-t flex justify-between items-center">
                        <div className="text-sm text-gray-500">
                            {showSuccess && (
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="w-4 h-4" />
                                    Export realizat cu succes!
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                            >
                                Anulează
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default ExportButton;