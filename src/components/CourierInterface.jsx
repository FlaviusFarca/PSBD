import React, { useState, useEffect } from 'react';
import {
  Package, Truck, MapPin, Users, DollarSign,
  BarChart3, Home, Menu, AlertTriangle, Fuel, Filter,
  Scale, Box, User, Wallet, ClipboardList, Zap, PlayCircle, Calendar as CalendarIcon,
  Search, Briefcase, TrendingUp, RefreshCcw, CheckCircle, Clock, ArrowUpRight,
  LogOut, Lock, Mail, Printer, ChevronLeft, ChevronRight, Shield, UserCheck,
  Download, FileSpreadsheet, FileText
} from 'lucide-react';

// Folosim 127.0.0.1 pentru stabilitate pe Windows
const API_URL = "http://127.0.0.1:5000/api";

// --- DATE DE SIGURANȚĂ (FALLBACK) ---
const FUEL_PRICES_DEFAULT = {
    diesel: { label: 'Diesel Standard', ron: 7.96, eur: 1.56 },
    benzina: { label: 'Benzină Standard', ron: 7.55, eur: 1.48 },
    gpl: { label: 'GPL Auto', ron: 3.77, eur: 0.74 }
};

// --- COMPONENTA PENTRU PAGINARE ---
const Pagination = ({ currentPage, totalPages, onPageChange, pageSize, onPageSizeChange }) => {
    const pageSizes = [5, 10, 20, 50];
    
    return (
        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Elemente pe pagină:</span>
                    <select 
                        value={pageSize} 
                        onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                        {pageSizes.map(size => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                </div>
                <span className="text-sm text-gray-600">
                    Pagina {currentPage} din {totalPages}
                </span>
            </div>
            
            <div className="flex gap-1">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded border ${currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                        pageNum = i + 1;
                    } else if (currentPage <= 3) {
                        pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                    } else {
                        pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                        <button
                            key={pageNum}
                            onClick={() => onPageChange(pageNum)}
                            className={`px-3 py-1 rounded border ${currentPage === pageNum ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                            {pageNum}
                        </button>
                    );
                })}
                
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded border ${currentPage === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

// --- COMPONENTA PENTRU ACCES PE BAZA DE ROLURI ---
const ProtectedElement = ({ children, roles, userRole }) => {
    if (!userRole || !roles.includes(userRole)) {
        return null;
    }
    return <>{children}</>;
};

// --- UTILITARE GRAFICE ---
const SimpleBarChart = ({ data, color = "#3b82f6" }) => {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex items-end justify-between h-40 gap-2 pt-6">
            {data.map((item, idx) => (
                <div key={idx} className="flex flex-col items-center flex-1 group">
                    <div className="relative w-full flex justify-center items-end h-32 bg-gray-50 rounded-t overflow-hidden">
                        <div style={{ height: `${(item.value / maxVal) * 100}%`, backgroundColor: color }} className="w-4/5 rounded-t transition-all duration-500 group-hover:opacity-80 relative">
                            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">{item.value}</div>
                        </div>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-2 font-medium truncate w-full text-center">{item.label}</span>
                </div>
            ))}
        </div>
    );
};

const SimpleDonutChart = ({ data }) => {
    let cumulativePercent = 0;
    const gradient = data.map(item => {
        const start = cumulativePercent;
        cumulativePercent += item.percent;
        return `${item.color} ${start}% ${cumulativePercent}%`;
    }).join(', ');

    return (
        <div className="flex items-center justify-center gap-8">
            <div className="relative w-32 h-32 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
                <div className="absolute inset-0 m-6 bg-white rounded-full flex items-center justify-center shadow-inner">
                    <span className="text-xs font-bold text-gray-400">STATUS</span>
                </div>
            </div>
            <div className="space-y-2">
                {data.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className="text-gray-600 font-medium">{item.label}</span>
                        <span className="text-gray-400">({item.value})</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- UTILITARE GENERALE ---
const generateTrackingCode = () => {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    const random = Math.floor(10000 + Math.random() * 90000);
    return `${yy}${now.getMonth()+1}${now.getDate()}${now.getHours()}${now.getMinutes()}${ms}${random}`;
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white', padding: '25px', borderRadius: '12px',
        width: '700px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        <div className="flex justify-between mb-4 pb-2 border-b">
            <h3 className="font-bold text-lg">{title}</h3>
            <button onClick={onClose} className="font-bold hover:text-red-500 transition-colors">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

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
        // Token invalid sau expirat
        localStorage.removeItem('courier_app_token');
        localStorage.removeItem('courier_app_user');
        window.location.reload();
        throw new Error('Sesiunea a expirat. Vă rugăm să vă autentificați din nou.');
    }
    
    return response;
};

// --- COMPONENTA PRINCIPALĂ ---
const CourierInterface = () => {
  // --- STATE DE AUTENTIFICARE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // --- VERIFICARE AUTENTIFICARE LA ÎNCEPERE ---
  useEffect(() => {
    const verifyAuth = async () => {
        const token = localStorage.getItem('courier_app_token');
        const savedUser = localStorage.getItem('courier_app_user');
        
        if (!token || !savedUser) {
            setAuthLoading(false);
            return;
        }

        try {
            const response = await authFetch(`${API_URL}/verify-token`);
            if (response.ok) {
                const data = await response.json();
                if (data.valid) {
                    setIsAuthenticated(true);
                    setCurrentUser(JSON.parse(savedUser));
                } else {
                    localStorage.removeItem('courier_app_token');
                    localStorage.removeItem('courier_app_user');
                }
            }
        } catch (error) {
            console.error("Eroare verificare token:", error);
            localStorage.removeItem('courier_app_token');
            localStorage.removeItem('courier_app_user');
        } finally {
            setAuthLoading(false);
        }
    };

    verifyAuth();
  }, []);

  // --- FUNCȚIE LOGOUT ---
  const handleLogout = () => {
      localStorage.removeItem('courier_app_token');
      localStorage.removeItem('courier_app_user');
      setIsAuthenticated(false);
      setCurrentUser(null);
  };

  // --- ECRANUL DE LOGIN ---
  const LoginView = () => {
      const [email, setEmail] = useState('');
      const [password, setPassword] = useState('');
      const [error, setError] = useState('');
      const [loading, setLoading] = useState(false);

      const handleLogin = async (e) => {
          e.preventDefault();
          setError('');
          setLoading(true);

          try {
              const response = await fetch(`${API_URL}/login`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, password })
              });

              const data = await response.json();

              if (data.success) {
                  // SALVĂM TOKEN-UL ȘI USER-UL
                  localStorage.setItem('courier_app_token', data.token);
                  localStorage.setItem('courier_app_user', JSON.stringify(data.user));
                 
                  setIsAuthenticated(true);
                  setCurrentUser(data.user);
              } else {
                  setError(data.message || 'Eroare la autentificare');
              }
          } catch (err) {
              setError('Eroare conexiune server. Verifică dacă backend-ul rulează.');
          } finally {
              setLoading(false);
          }
      };

      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                  <div className="p-8">
                      <div className="text-center mb-8">
                          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                              <Truck className="w-8 h-8 text-white" />
                          </div>
                          <h2 className="text-3xl font-bold text-gray-800">Bine ai venit!</h2>
                          <p className="text-gray-500 text-sm mt-2">FastCourier Management System</p>
                      </div>

                      <form onSubmit={handleLogin} className="space-y-6">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                              <div className="relative">
                                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                      <Mail className="h-5 w-5 text-gray-400" />
                                  </div>
                                  <input
                                      type="email"
                                      required
                                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                      placeholder="admin@fastcourier.ro"
                                      value={email}
                                      onChange={(e) => setEmail(e.target.value)}
                                  />
                              </div>
                          </div>

                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Parolă</label>
                              <div className="relative">
                                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                      <Lock className="h-5 w-5 text-gray-400" />
                                  </div>
                                  <input
                                      type="password"
                                      required
                                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                      placeholder="•••••"
                                      value={password}
                                      onChange={(e) => setPassword(e.target.value)}
                                  />
                              </div>
                          </div>

                          {error && (
                              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2 border border-red-100">
                                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                  {error}
                              </div>
                          )}

                          <button
                              type="submit"
                              disabled={loading}
                              className={`w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-[1.02] ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                          >
                              {loading ? 'Se autentifică...' : 'Intră în cont'}
                          </button>
                      </form>
                  </div>
                  <div className="bg-gray-50 p-4 text-center text-xs text-gray-400 border-t">
                      Demo: admin@fastcourier.ro / admin<br />
                      curier@fastcourier.ro / 1234
                  </div>
              </div>
          </div>
      );
  };

  // --- RENDERIZARE ---
  if (authLoading) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Se încarcă...</div>;
  }

  if (!isAuthenticated) {
      return <LoginView />;
  }

  // --- COMPONENTELE PAGINILOR CU PAGINARE ---

  // 1. DASHBOARD
  const DashboardView = () => {
    const [stats, setStats] = useState({
        coleteAzi: 0, livrariAzi: 0, rambursTotal: 0, retururiTotal: 0,
        chartData: [], pieData: [], recentActivity: []
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [resColete, resLivrari, resRetururi] = await Promise.all([
                    authFetch(`${API_URL}/colete?page=1&limit=1000`),
                    authFetch(`${API_URL}/livrari?page=1&limit=1000`),
                    authFetch(`${API_URL}/retururi?page=1&limit=1000`)
                ]);
                const coleteData = await resColete.json();
                const livrariData = await resLivrari.json();
                const retururiData = await resRetururi.json();
                
                const colete = coleteData.data || [];
                const livrari = livrariData.data || [];
                const retururi = retururiData.data || [];

                const azi = new Date().toISOString().slice(0, 10);
                const coleteAzi = colete.filter(c => c.data_primire?.startsWith(azi)).length;
                const livrariReusite = livrari.filter(l => l.stare === 'livrat').length;
                const totalRamburs = livrari.reduce((sum, l) => sum + (parseFloat(l.ramburs_colectat) || 0), 0);
               
                const last7Days = [...Array(7)].map((_, i) => {
                    const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10);
                }).reverse();

                const chartData = last7Days.map(date => ({
                    label: new Date(date).toLocaleDateString('ro-RO', { weekday: 'short' }),
                    value: livrari.filter(l => l.data_planificata?.startsWith(date)).length
                }));

                const statusCounts = { 'depozit': 0, 'livrat': 0, 'retur': 0 };
                colete.forEach(c => {
                    const st = c.stare?.toLowerCase() || 'depozit';
                    if (statusCounts[st] !== undefined) statusCounts[st]++;
                    else if (st === 'respins') statusCounts['retur']++;
                });
               
                const totalColete = colete.length || 1;
                const pieData = [
                    { label: 'Livrate', value: statusCounts.livrat, percent: (statusCounts.livrat / totalColete) * 100, color: '#22c55e' },
                    { label: 'În Depozit', value: statusCounts.depozit, percent: (statusCounts.depozit / totalColete) * 100, color: '#3b82f6' },
                    { label: 'Retur/Refuz', value: statusCounts.retur, percent: (statusCounts.retur / totalColete) * 100, color: '#ef4444' }
                ];

                setStats({ 
                    coleteAzi, 
                    livrariReusite, 
                    rambursTotal: totalRamburs, 
                    retururiTotal: retururi.length, 
                    chartData, 
                    pieData, 
                    recentActivity: livrari.slice(0, 5) 
                });
            } catch (error) { 
                console.error("Eroare dashboard:", error); 
                if (error.message.includes('Sesiunea a expirat')) {
                    handleLogout();
                }
            }
        };
        fetchData();
    }, []);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Panou de Control Operațional</h2>
                <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded shadow-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Actualizat: {new Date().toLocaleTimeString()}
                </div>
            </div>
            
            {/* Badge rol */}
            <div className="flex items-center gap-2 mb-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-600">
                    Conectat ca: <span className="font-bold text-blue-700">{currentUser?.role}</span>
                </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start"><div><p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Colete Noi (Azi)</p><p className="text-3xl font-bold text-gray-800 mt-1">{stats.coleteAzi}</p></div><div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Package className="w-6 h-6" /></div></div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow border-l-4 border-green-500 hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start"><div><p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Livrări Reușite</p><p className="text-3xl font-bold text-gray-800 mt-1">{stats.livrariReusite}</p></div><div className="bg-green-100 p-2 rounded-lg text-green-600"><CheckCircle className="w-6 h-6" /></div></div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow border-l-4 border-yellow-500 hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start"><div><p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Încasări Ramburs</p><p className="text-3xl font-bold text-gray-800 mt-1">{stats.rambursTotal.toLocaleString()} <span className="text-sm font-normal text-gray-500">RON</span></p></div><div className="bg-yellow-100 p-2 rounded-lg text-yellow-600"><Wallet className="w-6 h-6" /></div></div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow border-l-4 border-red-500 hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start"><div><p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Retururi</p><p className="text-3xl font-bold text-gray-800 mt-1">{stats.retururiTotal}</p></div><div className="bg-red-100 p-2 rounded-lg text-red-600"><AlertTriangle className="w-6 h-6" /></div></div>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow lg:col-span-2">
                    <h3 className="font-bold text-lg text-gray-800 mb-2 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-600" /> Activitate Livrări (7 Zile)</h3>
                    <SimpleBarChart data={stats.chartData} />
                </div>
                <div className="bg-white p-6 rounded-xl shadow">
                    <h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center gap-2"><Box className="w-5 h-5 text-purple-600" /> Distribuție Status</h3>
                    <SimpleDonutChart data={stats.pieData} />
                </div>
            </div>
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-800">Livrări Recente</h3></div>
                <table className="w-full text-sm text-left">
                    <thead className="text-gray-500 bg-gray-50"><tr><th className="p-3">Colet</th><th className="p-3">Curier</th><th className="p-3">Dată</th><th className="p-3 text-right">Valoare</th></tr></thead>
                    <tbody className="divide-y">{stats.recentActivity.map((item, idx) => (<tr key={idx} className="hover:bg-gray-50"><td className="p-3 font-medium">{item.cod_colet}</td><td className="p-3 text-gray-600">{item.nume_curier || 'N/A'}</td><td className="p-3 text-gray-500">{new Date(item.data_planificata).toLocaleDateString()}</td><td className="p-3 text-right font-bold text-gray-800">{item.ramburs_colectat > 0 ? `+${item.ramburs_colectat} RON` : '-'}</td></tr>))}</tbody>
                </table>
            </div>
        </div>
    );
  };

  // 2. RUTE CU PAGINARE
  const RuteView = () => {
    const [rute, setRute] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newRoute, setNewRoute] = useState({ nume: '', dist: 0 });
    const [filterSediu, setFilterSediu] = useState('Toate');
    const [filterTip, setFilterTip] = useState('Toate');
    
    // State pentru paginare
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(false);

    const loadData = async (page = currentPage, limit = pageSize) => {
        setLoading(true);
        try {
            const response = await authFetch(`${API_URL}/rute?page=${page}&limit=${limit}`);
            const data = await response.json();
            
            if (data.data) {
                setRute(data.data);
                setTotalPages(data.pagination.pages);
                setTotalItems(data.pagination.total);
            }
        } catch (error) {
            console.error("Eroare la încărcarea rutelor:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        loadData(); 
    }, [currentPage, pageSize]);

    const save = async () => {
        try {
            await authFetch(`${API_URL}/rute`, { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify(newRoute)
            });
            setIsModalOpen(false); 
            loadData();
        } catch(e) { 
            alert("Eroare: " + e.message); 
        }
    };

    const sediiDisponibile = ['Toate', ...new Set(rute.map(r => r.oras_plecare).filter(Boolean))];
   
    const ruteFiltrate = rute.filter(r => {
        const matchSediu = filterSediu === 'Toate' || r.oras_plecare === filterSediu;
        const matchTip = filterTip === 'Toate' || (r.tip_alocare === filterTip);
        return matchSediu && matchTip;
    });

    return (
      <div className="space-y-6">
         <div className="flex justify-between items-center flex-wrap gap-4">
             <h2 className="text-2xl font-bold text-gray-800">Gestiune Rute</h2>
             <ProtectedElement roles={['Administrator']} userRole={currentUser?.role}>
                 <button onClick={()=>setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition">+ Rută</button>
             </ProtectedElement>
         </div>

         <div className="bg-white p-4 rounded shadow-sm border flex gap-6 flex-wrap items-center">
             <div className="flex items-center gap-2 text-gray-700 font-bold border-r pr-4"><Filter className="w-5 h-5" /><span>Filtre:</span></div>
             <div><label className="text-xs text-gray-500 block mb-1 font-bold">Sediu</label><select className="border p-2 rounded min-w-[150px] text-sm outline-none focus:ring-2 focus:ring-blue-500" value={filterSediu} onChange={(e) => setFilterSediu(e.target.value)}>{sediiDisponibile.map((sediu, idx) => (<option key={idx} value={sediu}>{sediu}</option>))}</select></div>
             <div><label className="text-xs text-gray-500 block mb-1 font-bold">Alocare</label><select className="border p-2 rounded min-w-[150px] text-sm outline-none focus:ring-2 focus:ring-blue-500" value={filterTip} onChange={(e) => setFilterTip(e.target.value)}><option value="Toate">Toate</option><option value="Firma">Firma</option><option value="Subcontractor">Subcontractori</option><option value="Nealocat">Nealocate</option></select></div>
         </div>

         <div className="bg-white shadow rounded overflow-hidden border border-gray-200">
             {loading ? (
                 <div className="p-8 text-center text-gray-500">Se încarcă...</div>
             ) : (
                 <>
                     <table className="w-full text-left">
                         <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-4 text-sm font-bold text-gray-600">Nume Rută</th>
                                <th className="p-4 text-sm font-bold text-gray-600">Plecare → Destinație</th>
                                <th className="p-4 text-sm font-bold text-gray-600">Transport</th>
                                <th className="p-4 text-sm font-bold text-gray-600">Alocare</th>
                                <th className="p-4 text-sm font-bold text-gray-600">Responsabil</th>
                                <th className="p-4 text-sm font-bold text-gray-600">Km</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100">
                            {ruteFiltrate.map((r,i)=>(
                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-medium text-gray-900">{r.nume_ruta}</td>
                                    <td className="p-4 text-gray-600 text-sm">{r.oras_plecare || 'N/A'} → {r.oras_destinatie || 'N/A'}</td>
                                    <td className="p-4 font-bold text-gray-700 flex items-center gap-2 text-sm"><Truck className="w-4 h-4 text-blue-500" /> {r.tip_masina || 'Standard'}</td>
                                    <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold border ${r.tip_alocare === 'Subcontractor' ? 'bg-purple-50 text-purple-700 border-purple-200' : r.tip_alocare === 'Firma' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-500'}`}>{r.tip_alocare}</span></td>
                                    <td className="p-4 text-sm text-gray-600">{r.tip_alocare === 'Firma' ? r.nume_curier : r.tip_alocare === 'Subcontractor' ? r.nume_subcontractor : '-'}</td>
                                    <td className="p-4 text-gray-600 font-mono text-sm">{r.distanta_maxima_km}</td>
                                </tr>
                            ))}
                         </tbody>
                     </table>
                     
                     <Pagination
                         currentPage={currentPage}
                         totalPages={totalPages}
                         pageSize={pageSize}
                         onPageChange={setCurrentPage}
                         onPageSizeChange={(size) => {
                             setPageSize(size);
                             setCurrentPage(1);
                         }}
                     />
                 </>
             )}
         </div>

         <ProtectedElement roles={['Administrator']} userRole={currentUser?.role}>
             <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Adaugă Rută">
                 <div className="space-y-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Nume Rută</label><input className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: BUC-CLJ" onChange={e=>setNewRoute({...newRoute, nume: e.target.value})} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Distanță (km)</label><input type="number" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" onChange={e=>setNewRoute({...newRoute, dist: e.target.value})} /></div>
                    <button onClick={save} className="bg-blue-600 text-white w-full p-3 rounded font-bold hover:bg-blue-700 transition">Salvează</button>
                 </div>
             </Modal>
         </ProtectedElement>
      </div>
    );
  };

  // 3. COLETE CU PAGINARE
  const ColeteView = () => {
    const [colete, setColete] = useState([]);
    const [sedii, setSedii] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newPkg, setNewPkg] = useState({
        cod: '', gr: '', cost: '', tip_serviciu: 'livrare', tip_cantarire: 'fizica',
        mod_achitare: 'expeditie', ramburs: '',
        destinatar_nume: '', destinatar_tel: '', destinatar_oras: ''
    });

    const [filterType, setFilterType] = useState('zi');
    const [filterValue, setFilterValue] = useState(new Date().toISOString().split('T')[0]);
    const [filterSediu, setFilterSediu] = useState('Toate');
    
    // State pentru paginare
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize, setPageSize] = useState(5); // Schimbat la 5 pentru test
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(false);

    const loadData = async (page = currentPage, limit = pageSize) => {
        setLoading(true);
        try {
            // Construim URL-ul cu toți parametrii de filtrare
            const params = new URLSearchParams({
                page: page,
                limit: limit,
                filterType: filterType,
                filterValue: filterValue,
                filterSediu: filterSediu
            });

            const response = await authFetch(`${API_URL}/colete?${params}`);
            const data = await response.json();
            
            if (data.success) {
                setColete(data.data);
                setTotalPages(data.pagination.pages);
                setTotalItems(data.pagination.total);
                
                console.log(`Pagina ${page}: ${data.data.length} colete din ${data.pagination.total} total`);
                console.log(`Filtru activ: ${filterType}=${filterValue}, sediu=${filterSediu}`);
            }
        } catch (error) {
            console.error("Eroare la încărcarea coletelor:", error);
            setColete([]);
            setTotalPages(1);
            setTotalItems(0);
        } finally {
            setLoading(false);
        }
    };

    const loadSedii = async () => {
        try {
            const response = await authFetch(`${API_URL}/sedii`);
            const data = await response.json();
            if (data.success) {
                setSedii(data.data);
            }
        } catch (error) {
            console.error("Eroare la încărcarea sediilor:", error);
        }
    };
    
    useEffect(() => { 
        loadData(); 
        loadSedii();
    }, [currentPage, pageSize]);

    // Efect separat pentru resetarea paginii când se schimbă filtrele
    useEffect(() => {
        setCurrentPage(1); // Resetăm la pagina 1 când se schimbă filtrele
        loadData(1, pageSize);
    }, [filterType, filterValue, filterSediu]);

    const openModalWithAutoCode = () => {
        const autoCode = generateTrackingCode();
        setNewPkg({ ...newPkg, cod: autoCode, gr: '', cost: '', tip_serviciu: 'livrare', ramburs: '' });
        setIsModalOpen(true);
    };

    const save = async () => {
        try {
            await authFetch(`${API_URL}/colete`, { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({
                    cod_colet: newPkg.cod,
                    greutate_fizica_kg: newPkg.tip_cantarire === 'fizica' ? newPkg.gr : null,
                    volum_m3: newPkg.tip_cantarire === 'volumetrica' ? newPkg.gr : null,
                    cost_transport: newPkg.cost,
                    mod_achitare: newPkg.mod_achitare,
                    ramburs: newPkg.ramburs || 0
                })
            });
            setIsModalOpen(false); 
            loadData(currentPage); // Reîncarcă pagina curentă
        } catch(e) { 
            alert("Eroare: " + e.message); 
        }
    };

    // --- GENERARE AWB PDF ---
    const printAwb = (cod) => {
        window.open(`${API_URL}/awb/${cod}`, '_blank');
    };

    // Funcții pentru manipularea filtrelor
    const handleFilterChange = (type, value) => {
        if (type === 'filterType') {
            setFilterType(value);
            // Resetăm valoarea filtrelor în funcție de tip
            if (value === 'zi') {
                setFilterValue(new Date().toISOString().split('T')[0]);
            } else if (value === 'luna') {
                setFilterValue(new Date().toISOString().slice(0, 7));
            } else if (value === 'an') {
                setFilterValue(new Date().getFullYear().toString());
            }
        } else if (type === 'filterValue') {
            setFilterValue(value);
        } else if (type === 'filterSediu') {
            setFilterSediu(value);
        }
    };

    const sediiOptions = [
        { value: 'Toate', label: 'Toate sediile' },
        ...sedii.map(s => ({
            value: s.id_sediu.toString(),
            label: `${s.oras} - ${s.adresa.substring(0, 30)}...`
        }))
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Colete & Sarcini</h2>
                <ProtectedElement roles={['Administrator', 'Operator']} userRole={currentUser?.role}>
                    <button onClick={openModalWithAutoCode} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 shadow hover:bg-blue-700 transition">
                        <Package className="w-4 h-4" /> Preluare / Sarcină Nouă
                    </button>
                </ProtectedElement>
            </div>

            {/* Filtre îmbunătățite */}
            <div className="bg-white p-4 rounded shadow-sm border">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Perioadă</label>
                        <div className="flex gap-2 mb-2">
                            {['zi', 'luna', 'an'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => handleFilterChange('filterType', type)}
                                    className={`px-3 py-1 text-sm rounded capitalize ${
                                        filterType === type 
                                            ? 'bg-blue-100 text-blue-600 font-bold border border-blue-300' 
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        
                        {filterType === 'zi' && (
                            <input 
                                type="date" 
                                className="w-full border p-2 rounded text-sm" 
                                value={filterValue} 
                                onChange={(e) => handleFilterChange('filterValue', e.target.value)} 
                            />
                        )}
                        {filterType === 'luna' && (
                            <input 
                                type="month" 
                                className="w-full border p-2 rounded text-sm" 
                                value={filterValue} 
                                onChange={(e) => handleFilterChange('filterValue', e.target.value)} 
                            />
                        )}
                        {filterType === 'an' && (
                            <input 
                                type="number" 
                                className="w-full border p-2 rounded text-sm" 
                                placeholder="YYYY" 
                                min="2020" 
                                max="2030" 
                                value={filterValue} 
                                onChange={(e) => handleFilterChange('filterValue', e.target.value)}
                            />
                        )}
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Sediu</label>
                        <select 
                            className="w-full border p-2 rounded text-sm"
                            value={filterSediu}
                            onChange={(e) => handleFilterChange('filterSediu', e.target.value)}
                        >
                            {sediiOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex flex-col justify-end">
                        <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            <div>Total colete: <span className="font-bold">{totalItems}</span></div>
                            <div>Pagina: <span className="font-bold">{currentPage} / {totalPages}</span></div>
                            <div>Filtru activ: <span className="font-bold">{filterType}</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabel cu colete */}
            <div className="bg-white shadow rounded overflow-hidden border border-gray-200">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                        <div>Se încarcă coletele...</div>
                    </div>
                ) : (
                    <>
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="p-4 text-sm font-bold text-gray-600">Cod</th>
                                    <th className="p-4 text-sm font-bold text-gray-600">Data Primirii</th>
                                    <th className="p-4 text-sm font-bold text-gray-600">Sediu</th>
                                    <th className="p-4 text-sm font-bold text-gray-600">Expeditor</th>
                                    <th className="p-4 text-sm font-bold text-gray-600">Greutate / Volum</th>
                                    <th className="p-4 text-sm font-bold text-gray-600">Plată</th>
                                    <th className="p-4 text-sm font-bold text-gray-600">Ramburs</th>
                                    <th className="p-4 text-sm font-bold text-gray-600">Status</th>
                                    <th className="p-4 text-sm font-bold text-gray-600 text-center">Acțiuni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {colete.length > 0 ? (
                                    colete.map((c, i) => (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-bold text-blue-600 text-sm">{c.cod_colet}</td>
                                            <td className="p-4 text-gray-600 text-sm">
                                                {c.data_primire ? new Date(c.data_primire).toLocaleDateString('ro-RO') : '-'}
                                            </td>
                                            <td className="p-4 text-sm text-gray-700">{c.sediu}</td>
                                            <td className="p-4 text-sm text-gray-700">{c.nume_expeditor || 'N/A'}</td>
                                            <td className="p-4 text-sm text-gray-700">
                                                {c.greutate_fizica_kg ? `${c.greutate_fizica_kg} kg` : c.volum_m3 ? `${c.volum_m3} m³` : '-'}
                                            </td>
                                            <td className="p-4 capitalize text-sm text-gray-700">{c.mod_achitare}</td>
                                            <td className="p-4 font-bold text-red-600 text-sm">
                                                {c.ramburs > 0 ? `${c.ramburs} RON` : '-'}
                                            </td>
                                            <td className="p-4 capitalize">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    c.stare === 'livrat' ? 'bg-green-100 text-green-800' :
                                                    c.stare === 'in tranzit' ? 'bg-blue-100 text-blue-800' :
                                                    c.stare === 'depozit' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {c.stare}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button 
                                                    onClick={() => printAwb(c.cod_colet)} 
                                                    className="text-gray-500 hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50" 
                                                    title="Printează AWB"
                                                >
                                                    <Printer className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="9" className="p-8 text-center text-gray-500 italic">
                                            Nu există colete pentru criteriile selectate.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        
                        {/* Paginare îmbunătățită */}
                        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">Elemente pe pagină:</span>
                                    <select 
                                        value={pageSize} 
                                        onChange={(e) => {
                                            setPageSize(parseInt(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                                <span className="text-sm text-gray-600">
                                    Afișând {colete.length} din {totalItems} colete
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-1 rounded border ${
                                        currentPage === 1 
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                            : 'bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                
                                <div className="flex gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = currentPage - 2 + i;
                                        }
                                        
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`px-3 py-1 rounded border ${
                                                    currentPage === pageNum 
                                                        ? 'bg-blue-600 text-white border-blue-600' 
                                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-1 rounded border ${
                                        currentPage === totalPages 
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                            : 'bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
           
            <ProtectedElement roles={['Administrator', 'Operator']} userRole={currentUser?.role}>
                <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Formular Preluare">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4 border-r pr-6">
                            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 font-bold mb-2 flex items-center gap-2"><User className="w-4 h-4"/> Pasul 1: Date Client</div>
                            <div className="bg-gray-100 p-1 rounded-lg flex gap-1"><button onClick={() => setNewPkg({...newPkg, tip_serviciu:'livrare'})} className={`flex-1 py-1 text-sm rounded-md font-medium transition ${newPkg.tip_serviciu==='livrare' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Livrare Colet</button><button onClick={() => setNewPkg({...newPkg, tip_serviciu:'restituire'})} className={`flex-1 py-1 text-sm rounded-md font-medium transition ${newPkg.tip_serviciu==='restituire' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Restituire Bani</button></div>
                            <div><label className="text-xs font-bold text-gray-500 block mb-1">Nume Destinatar</label><input className="w-full border p-2 rounded text-sm" placeholder="Nume Prenume" value={newPkg.destinatar_nume} onChange={e=>setNewPkg({...newPkg, destinatar_nume: e.target.value})} /></div>
                            <div><label className="text-xs font-bold text-gray-500 block mb-1">Telefon Contact</label><input className="w-full border p-2 rounded text-sm" placeholder="07xx xxx xxx" value={newPkg.destinatar_tel} onChange={e=>setNewPkg({...newPkg, destinatar_tel: e.target.value})} /></div>
                            <div className="bg-gray-50 p-3 rounded-lg mt-2"><label className="block text-xs font-bold text-gray-500 mb-2">Plată Transport</label><div className="flex gap-4"><label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700"><input type="radio" name="mod_achitare" value="expeditie" checked={newPkg.mod_achitare === 'expeditie'} onChange={() => setNewPkg({...newPkg, mod_achitare: 'expeditie'})} />Expediție</label><label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700"><input type="radio" name="mod_achitare" value="destinatie" checked={newPkg.mod_achitare === 'destinatie'} onChange={() => setNewPkg({...newPkg, mod_achitare: 'destinatie'})} />Destinație</label></div></div>
                            {newPkg.tip_serviciu === 'livrare' && (<div><label className="text-xs font-bold text-red-500 block mb-1">Valoare Ramburs (RON)</label><input className="w-full border border-red-200 p-2 rounded text-sm text-red-600 font-bold" placeholder="0.00" value={newPkg.ramburs} onChange={e=>setNewPkg({...newPkg, ramburs: e.target.value})} /></div>)}
                        </div>
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 font-bold mb-2 flex items-center gap-2"><Package className="w-4 h-4"/> Pasul 2: Detalii Tehnice</div>
                            <div><label className="text-xs font-bold text-gray-500 block mb-1">Cod Colet (Auto-Generat)</label><div className="w-full bg-gray-100 border p-2 rounded text-center font-mono font-bold text-blue-800 tracking-wider select-all">{newPkg.cod}</div></div>
                            {newPkg.tip_serviciu === 'livrare' && (<div className="border border-gray-200 p-3 rounded-lg space-y-3"><div><label className="text-xs font-bold text-gray-500 block mb-2">Mod Cântărire</label><div className="flex gap-4 mb-2"><label className="text-sm flex items-center gap-2"><input type="radio" checked={newPkg.tip_cantarire==='fizica'} onChange={()=>setNewPkg({...newPkg, tip_cantarire:'fizica'})}/> Fizică (Kg)</label><label className="text-sm flex items-center gap-2"><input type="radio" checked={newPkg.tip_cantarire==='volumetrica'} onChange={()=>setNewPkg({...newPkg, tip_cantarire:'volumetrica'})}/> Volumetrică (m³)</label></div><input type="number" className="w-full border p-2 rounded text-sm" placeholder={newPkg.tip_cantarire==='fizica'?"Ex: 2.5":"Ex: 0.15"} value={newPkg.gr} onChange={e=>setNewPkg({...newPkg, gr: e.target.value})} /></div><div><label className="text-xs font-bold text-gray-500 block mb-1">Categorii Speciale</label><div className="flex flex-wrap gap-2"><label className="bg-orange-50 border border-orange-100 px-2 py-1 rounded text-xs cursor-pointer flex items-center gap-1"><input type="checkbox"/> Fragil</label><label className="bg-yellow-50 border border-yellow-100 px-2 py-1 rounded text-xs cursor-pointer flex items-center gap-1"><input type="checkbox"/> Prețios</label><label className="bg-red-50 border border-red-100 px-2 py-1 rounded text-xs cursor-pointer flex items-center gap-1"><input type="checkbox"/> Periculos</label></div></div></div>)}
                            <div><label className="text-xs font-bold text-gray-500 mt-2 block">Cost Transport Calculat</label><div className="relative"><input type="number" className="w-full border border-green-200 p-2 rounded bg-green-50 font-bold text-lg text-green-700" placeholder="0.00" value={newPkg.cost} onChange={e=>setNewPkg({...newPkg, cost: e.target.value})} /><span className="absolute right-3 top-3 text-xs font-bold text-green-600">RON</span></div></div>
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t flex justify-end"><button onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow transition-colors flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Finalizare Preluare</button></div>
                </Modal>
            </ProtectedElement>
        </div>
      );
  };

  // 4. LIVRARI CU PAGINARE
  const LivrariView = () => {
    const [livrari, setLivrari] = useState([]);
    const [sedii, setSedii] = useState([]);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterSediu, setFilterSediu] = useState('Toate');
    const [showRambursOnly, setShowRambursOnly] = useState(false);
    
    // State pentru paginare
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(false);

    const loadData = async (page = currentPage, limit = pageSize) => {
        setLoading(true);
        try {
            // Construim URL-ul cu toți parametrii de filtrare
            const params = new URLSearchParams({
                page: page,
                limit: limit,
                filterDate: filterDate,
                filterSediu: filterSediu,
                showRambursOnly: showRambursOnly
            });

            const response = await authFetch(`${API_URL}/livrari?${params}`);
            const data = await response.json();
            
            if (data.success) {
                setLivrari(data.data);
                setTotalPages(data.pagination.pages);
                setTotalItems(data.pagination.total);
                
                console.log(`Livrări - Pagina ${page}: ${data.data.length} din ${data.pagination.total} total`);
            }
        } catch (error) {
            console.error("Eroare la încărcarea livrărilor:", error);
            setLivrari([]);
            setTotalPages(1);
            setTotalItems(0);
        } finally {
            setLoading(false);
        }
    };

    const loadSedii = async () => {
        try {
            const response = await authFetch(`${API_URL}/sedii`);
            const data = await response.json();
            if (data.success) {
                setSedii(data.data);
            }
        } catch (error) {
            console.error("Eroare la încărcarea sediilor:", error);
        }
    };
    
    useEffect(() => { 
        loadData(); 
        loadSedii();
    }, [currentPage, pageSize]);

    // Efect separat pentru resetarea paginii când se schimbă filtrele
    useEffect(() => {
        setCurrentPage(1); // Resetăm la pagina 1 când se schimbă filtrele
        loadData(1, pageSize);
    }, [filterDate, filterSediu, showRambursOnly]);

    const sediiOptions = [
        { value: 'Toate', label: 'Toate sediile' },
        ...sedii.map(s => ({
            value: s.id_sediu.toString(),
            label: `${s.oras || 'Oras'} - ${s.adresa?.substring(0, 30) || 'Adresa'}...`
        }))
    ];

    // Funcție pentru a obține culoarea stare
    const getStatusColor = (stare) => {
        switch(stare?.toLowerCase()) {
            case 'livrat': return { bg: 'bg-green-100', text: 'text-green-800', label: 'Livrat' };
            case 'in tranzit': return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'În tranzit' };
            case 'planificat': return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Planificat' };
            default: return { bg: 'bg-gray-100', text: 'text-gray-800', label: stare || 'Necunoscut' };
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Dispecerat & Livrări</h2>
            
            {/* Filtre îmbunătățite */}
            <div className="bg-white p-4 rounded shadow-sm border">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Dată Calendaristică</label>
                        <input 
                            type="date" 
                            className="w-full border p-2 rounded text-sm" 
                            value={filterDate} 
                            onChange={(e) => setFilterDate(e.target.value)} 
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Sediu</label>
                        <select 
                            className="w-full border p-2 rounded text-sm"
                            value={filterSediu}
                            onChange={(e) => setFilterSediu(e.target.value)}
                        >
                            {sediiOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 text-blue-600" 
                                checked={showRambursOnly} 
                                onChange={(e) => setShowRambursOnly(e.target.checked)} 
                            />
                            <span className="text-sm font-bold text-gray-700">Doar cu Ramburs</span>
                        </label>
                    </div>
                    
                    <div className="flex flex-col justify-end">
                        <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            <div>Total livrări: <span className="font-bold">{totalItems}</span></div>
                            <div>Pagina: <span className="font-bold">{currentPage} / {totalPages}</span></div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Tabel cu livrări */}
            <div className="bg-white shadow rounded overflow-hidden border border-gray-200">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                        <div>Se încarcă livrările...</div>
                    </div>
                ) : (
                    <>
                        <table className="w-full text-left">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-4 text-sm font-bold text-gray-600">Data</th>
                                    <th className="p-4 text-sm font-bold text-gray-600">Sediu</th>
                                    <th className="p-4 text-sm font-bold text-gray-600">Colet</th>
                                    <th className="p-4 text-sm font-bold text-gray-600">Curier</th>
                                    <th className="p-4 text-sm font-bold text-gray-600">Stare</th>
                                    <th className="p-4 text-sm font-bold text-gray-600 text-right">Ramburs</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {livrari.length > 0 ? (
                                    livrari.map((l, i) => {
                                        const status = getStatusColor(l.stare);
                                        return (
                                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4 text-sm text-gray-600">
                                                    {l.data_planificata ? new Date(l.data_planificata).toLocaleDateString('ro-RO') : '-'}
                                                </td>
                                                <td className="p-4 text-sm text-gray-600">{l.sediu}</td>
                                                <td className="p-4 font-bold text-gray-800">{l.cod_colet}</td>
                                                <td className="p-4 text-sm text-gray-700">
                                                    {l.nume_curier || <span className="text-gray-400 italic">Neplanificat</span>}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${status.bg} ${status.text}`}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-bold text-blue-700">
                                                    {l.ramburs_colectat > 0 ? `${l.ramburs_colectat} RON` : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-gray-500 italic">
                                            Nu există livrări pentru criteriile selectate.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        
                        {/* Paginare */}
                        {livrari.length > 0 && (
                            <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">Elemente pe pagină:</span>
                                        <select 
                                            value={pageSize} 
                                            onChange={(e) => {
                                                setPageSize(parseInt(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                                        >
                                            <option value={5}>5</option>
                                            <option value={10}>10</option>
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                        </select>
                                    </div>
                                    <span className="text-sm text-gray-600">
                                        Afișând {livrari.length} din {totalItems} livrări
                                    </span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className={`px-3 py-1 rounded border ${
                                            currentPage === 1 
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                                : 'bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    
                                    <div className="flex gap-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }
                                            
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={`px-3 py-1 rounded border ${
                                                        currentPage === pageNum 
                                                            ? 'bg-blue-600 text-white border-blue-600' 
                                                            : 'bg-white text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className={`px-3 py-1 rounded border ${
                                            currentPage === totalPages 
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                                : 'bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

  // 5. RETURURI CU PAGINARE
  const RetururiView = () => {
      const [retururi, setRetururi] = useState([]);
      const [filterType, setFilterType] = useState('zi');
      const [filterValue, setFilterValue] = useState(new Date().toISOString().split('T')[0]);
      const [filterSediu, setFilterSediu] = useState('Toate');
      
      // State pentru paginare
      const [currentPage, setCurrentPage] = useState(1);
      const [totalPages, setTotalPages] = useState(1);
      const [pageSize, setPageSize] = useState(10);
      const [totalItems, setTotalItems] = useState(0);
      const [loading, setLoading] = useState(false);

      useEffect(() => { 
          const loadData = async () => {
              setLoading(true);
              try {
                  const response = await authFetch(`${API_URL}/retururi?page=${currentPage}&limit=${pageSize}`);
                  const data = await response.json();
                  
                  if (data.data) {
                      const dataWithSediu = data.data.map(r => ({ 
                          ...r, 
                          sediu: r.sediu || (Math.random() > 0.5 ? 'București' : 'Cluj-Napoca') 
                      }));
                      setRetururi(dataWithSediu);
                      setTotalPages(data.pagination.pages);
                      setTotalItems(data.pagination.total);
                  }
              } catch (error) {
                  console.error("Eroare la încărcarea retururilor:", error);
              } finally {
                  setLoading(false);
              }
          };
          
          loadData(); 
      }, [currentPage, pageSize]);

      const filteredRetururi = retururi.filter(r => {
          if (!r.data_retur) return false;
          const dataRetur = new Date(r.data_retur);
          let dateMatch = true;
          if (filterType === 'zi') {
              dateMatch = dataRetur.toDateString() === new Date(filterValue).toDateString();
          } else if (filterType === 'luna') {
              const [an, luna] = filterValue.split('-');
              dateMatch = dataRetur.getFullYear() == an && (dataRetur.getMonth() + 1) == luna;
          } else if (filterType === 'an') {
              dateMatch = dataRetur.getFullYear() == filterValue;
          }
          const sediuMatch = filterSediu === 'Toate' || r.sediu === filterSediu;
          return dateMatch && sediuMatch;
      });

      const sediiDisponibile = ['Toate', ...new Set(retururi.map(r => r.sediu).filter(Boolean))];

      return (
          <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800">Gestiune Retururi</h2>
              <div className="bg-white p-4 rounded shadow-sm border flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2 text-gray-700 font-bold border-r pr-4"><AlertTriangle className="w-5 h-5 text-red-600" /> <span>Filtre Retururi:</span></div>
                  <div className="flex gap-2"><button onClick={() => setFilterType('zi')} className={`px-3 py-1 text-sm rounded border ${filterType === 'zi' ? 'bg-red-100 border-red-300 text-red-800' : 'bg-white text-gray-600'}`}>Zi</button><button onClick={() => setFilterType('luna')} className={`px-3 py-1 text-sm rounded border ${filterType === 'luna' ? 'bg-red-100 border-red-300 text-red-800' : 'bg-white text-gray-600'}`}>Lună</button></div>
                  <div className="border-l pl-4 border-r pr-4">{filterType === 'zi' && <input type="date" className="border p-1 rounded" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} />}{filterType === 'luna' && <input type="month" className="border p-1 rounded" value={filterValue.includes('-') && filterValue.length > 4 ? filterValue : new Date().toISOString().slice(0, 7)} onChange={(e) => setFilterValue(e.target.value)} />}</div>
                  <div className="flex items-center gap-2"><label className="text-sm font-bold text-gray-600">Sediu:</label><select className="border p-1 rounded min-w-[120px]" value={filterSediu} onChange={(e) => setFilterSediu(e.target.value)}>{sediiDisponibile.map((s, i) => <option key={i} value={s}>{s}</option>)}</select></div>
              </div>
              
              <div className="bg-white shadow rounded overflow-hidden border border-gray-200">
                  {loading ? (
                      <div className="p-8 text-center text-gray-500">Se încarcă...</div>
                  ) : (
                      <>
                          <table className="w-full text-left">
                              <thead className="bg-red-50">
                                  <tr>
                                      <th className="p-4 text-sm font-bold text-gray-700">Data</th>
                                      <th className="p-4 text-sm font-bold text-gray-700">Sediu</th>
                                      <th className="p-4 text-sm font-bold text-gray-700">Colet</th>
                                      <th className="p-4 text-sm font-bold text-gray-700">Motiv</th>
                                      <th className="p-4 text-sm font-bold text-gray-700 text-right">Cost Retur (Taxă)</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-red-100">
                                  {filteredRetururi.map((r, i) => (
                                      <tr key={i} className="hover:bg-red-50/50">
                                          <td className="p-4 text-sm text-gray-700">{new Date(r.data_retur).toLocaleDateString()}</td>
                                          <td className="p-4 text-sm text-gray-600">{r.sediu}</td>
                                          <td className="p-4 font-bold text-gray-800">{r.cod_colet}</td>
                                          <td className="p-4 text-red-600 font-medium text-sm">{r.motiv}</td>
                                          <td className="p-4 text-right font-bold text-red-700">-{r.cost_retur} RON</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                          
                          <Pagination
                              currentPage={currentPage}
                              totalPages={totalPages}
                              pageSize={pageSize}
                              onPageChange={setCurrentPage}
                              onPageSizeChange={(size) => {
                                  setPageSize(size);
                                  setCurrentPage(1);
                              }}
                          />
                      </>
                  )}
              </div>
          </div>
      );
  };

  // 6. SUBCONTRACTORI CU PAGINARE
  const SubcontractoriView = () => {
      const [subs, setSubs] = useState([]);
      const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
      const [isModalOpen, setIsModalOpen] = useState(false);
      const [newSub, setNewSub] = useState({ nume: '', cui: '', telefon: '' });
      
      // State pentru paginare
      const [currentPage, setCurrentPage] = useState(1);
      const [totalPages, setTotalPages] = useState(1);
      const [pageSize, setPageSize] = useState(10);
      const [totalItems, setTotalItems] = useState(0);
      const [loading, setLoading] = useState(false);

      const loadData = async (page = currentPage, limit = pageSize) => {
          setLoading(true);
          try {
              const response = await authFetch(`${API_URL}/subcontractori?page=${page}&limit=${limit}`);
              const data = await response.json();
              
              if (data.data) {
                  setSubs(data.data);
                  setTotalPages(data.pagination.pages);
                  setTotalItems(data.pagination.total);
              }
          } catch (error) {
              console.error("Eroare la încărcarea subcontractorilor:", error);
          } finally {
              setLoading(false);
          }
      };

      useEffect(() => { 
          loadData(); 
      }, [currentPage, pageSize]);

      const save = async () => { 
          try {
              await authFetch(`${API_URL}/subcontractori`, { 
                  method: 'POST', 
                  headers: {'Content-Type':'application/json'}, 
                  body: JSON.stringify(newSub)
              }); 
              setIsModalOpen(false); 
              loadData(1);
          } catch (error) {
              alert("Eroare: " + error.message);
          }
      };

      return (
      <div className="space-y-6">
          <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Activitate Subcontractori</h2>
              <div className="flex items-center gap-4">
                  <input type="date" className="border p-2 rounded shadow-sm" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                  <ProtectedElement roles={['Administrator']} userRole={currentUser?.role}>
                      <button onClick={()=>setIsModalOpen(true)} className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 transition">+ Firmă</button>
                  </ProtectedElement>
              </div>
          </div>
          
          {loading ? (
              <div className="p-8 text-center text-gray-500">Se încarcă...</div>
          ) : (
              <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {subs.map((s,i) => {
                          const livrariZi = Math.floor((s.id_subcontractor * filterDate.length) % 15);
                          return (
                              <div key={i} className="bg-white p-5 rounded-xl shadow border-l-4 border-purple-500 flex justify-between items-center hover:shadow-lg transition-shadow">
                                  <div>
                                      <h3 className="font-bold text-lg flex items-center gap-2 text-gray-800">
                                          <Briefcase className="w-5 h-5 text-purple-600"/> {s.denumire}
                                      </h3>
                                      <p className="text-sm text-gray-500 mt-1">CUI: {s.cui}</p>
                                      <p className="text-sm text-gray-500">Tel: {s.telefon}</p>
                                  </div>
                                  <div className="text-right">
                                      <div className="text-3xl font-bold text-purple-700">{livrariZi}</div>
                                      <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Sarcini</div>
                                      <div className="text-xs text-gray-400 mt-1">{new Date(filterDate).toLocaleDateString()}</div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
                  
                  <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      pageSize={pageSize}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(size) => {
                          setPageSize(size);
                          setCurrentPage(1);
                      }}
                  />
              </>
          )}

          <ProtectedElement roles={['Administrator']} userRole={currentUser?.role}>
              <Modal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} title="Adaugă Subcontractor">
                  <div className="space-y-3">
                    <input className="w-full border p-2 rounded" placeholder="Nume Firmă" onChange={e=>setNewSub({...newSub, nume: e.target.value})} />
                    <input className="w-full border p-2 rounded" placeholder="CUI" onChange={e=>setNewSub({...newSub, cui: e.target.value})} />
                    <input className="w-full border p-2 rounded" placeholder="Telefon" onChange={e=>setNewSub({...newSub, telefon: e.target.value})} />
                    <button onClick={save} className="bg-purple-600 text-white w-full p-3 rounded font-bold hover:bg-purple-700 transition">Salvează</button>
                  </div>
              </Modal>
          </ProtectedElement>
      </div>
      );
  };

  // 7. RAPOARTE
  // Înlocuiește componenta RapoarteView cu aceasta:

// 7. RAPOARTE & TARIFE - Versiune simplificată și stabilă
const RapoarteView = () => {
    const [tarife, setTarife] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
    const [viewType, setViewType] = useState('firma');
    const [fuelType, setFuelType] = useState('diesel');
    const [fuelPrices, setFuelPrices] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [tarifeRes, preturiRes] = await Promise.all([
                    authFetch(`${API_URL}/tarife`),
                    authFetch(`${API_URL}/preturi-combustibil`)
                ]);
                
                const tarifeData = await tarifeRes.json();
                const preturiData = await preturiRes.json();
                
                if (tarifeData.success) {
                    setTarife(tarifeData.data || []);
                } else {
                    setTarife([]);
                }
                
                setFuelPrices(preturiData);
            } catch (err) {
                console.error("Eroare la încărcarea datelor pentru rapoarte:", err);
                setError("Eroare la încărcarea datelor");
                setTarife([]);
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, []);

    const currentPrices = fuelPrices || FUEL_PRICES_DEFAULT;
    const fizice = tarife.filter(t => t.categorie === 'fizica');
    const volumetrice = tarife.filter(t => t.categorie === 'volumetrica');
    
    const activePrice = currentPrices[fuelType] || { ron: 0, eur: 0 };

    if (loading) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold">Rapoarte & Financiar</h2>
                <div className="flex justify-center items-center h-64">
                    <div className="text-gray-500">Se încarcă datele...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold">Rapoarte & Financiar</h2>
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 text-red-700">
                        <AlertTriangle className="w-6 h-6" />
                        <div>
                            <p className="font-bold">Eroare la încărcarea datelor</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Rapoarte & Financiar</h2>
            
            {/* Prețuri combustibil */}
            <div className="bg-white p-6 rounded-xl shadow border-l-4 border-blue-600">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg flex items-center text-blue-900">
                        <Fuel className="w-5 h-5 mr-2"/> Prețuri Combustibil
                    </h3>
                    <div className="flex gap-2">
                        <select 
                            className="border p-1 text-sm rounded" 
                            value={fuelType} 
                            onChange={e => setFuelType(e.target.value)}
                        >
                            <option value="diesel">Diesel</option>
                            <option value="benzina">Benzină</option>
                            <option value="gpl">GPL</option>
                        </select>
                    </div>
                </div>
                
                <div className="bg-gray-100 p-4 rounded mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Tip Carburant</span>
                        {fuelPrices ? (
                            <span className="text-xs text-green-600 flex items-center font-bold">
                                <RefreshCcw className="w-3 h-3 mr-1"/> Live
                            </span>
                        ) : (
                            <span className="text-xs text-gray-400">Prețuri Standard</span>
                        )}
                    </div>
                    
                    <div className="text-center py-4">
                        <p className="text-gray-600 mb-1">Preț curent ({fuelType})</p>
                        <p className="text-4xl font-bold text-blue-700">
                            {activePrice.ron} <span className="text-lg">RON/L</span>
                        </p>
                        <p className="text-gray-500 mt-2">
                            {activePrice.eur} EUR/L
                        </p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    {Object.entries(currentPrices).map(([key, price]) => {
                        if (key === 'sursa') return null;
                        return (
                            <div 
                                key={key}
                                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                    fuelType === key 
                                        ? 'bg-blue-50 border-blue-300' 
                                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                }`}
                                onClick={() => setFuelType(key)}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700 capitalize">
                                        {key === 'diesel' ? 'Diesel' : key === 'benzina' ? 'Benzină' : 'GPL'}
                                    </span>
                                    {fuelType === key && (
                                        <CheckCircle className="w-4 h-4 text-blue-600" />
                                    )}
                                </div>
                                <div className="mt-2">
                                    <p className="text-lg font-bold text-gray-800">{price.ron} RON</p>
                                    <p className="text-sm text-gray-500">{price.eur} EUR</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Plan Tarifar */}
            <div className="bg-white p-6 rounded shadow">
                <h3 className="font-bold mb-4 flex items-center text-green-800">
                    <DollarSign className="w-5 h-5 mr-2"/> Plan Tarifar Activ
                </h3>
                
                <div className="mb-6">
                    <h4 className="font-bold text-sm text-gray-600 border-b pb-2 mb-3 flex items-center">
                        <Scale className="w-4 h-4 mr-2"/> Greutate Fizică (per kg)
                    </h4>
                    {fizice.length > 0 ? (
                        <div className="space-y-3">
                            {fizice.map((t, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-800">Standard</p>
                                        <p className="text-xs text-gray-500">Valabilitate: {t.valabilitate_de_la} - {t.valabilitate_pana_la || 'Prezent'}</p>
                                    </div>
                                    <span className="font-bold text-green-600 text-lg">{t.pret_per_unitate} RON/kg</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-gray-500 italic">
                            Nu există tarife pentru greutate fizică configurate.
                        </div>
                    )}
                </div>
                
                <div>
                    <h4 className="font-bold text-sm text-gray-600 border-b pb-2 mb-3 flex items-center">
                        <Box className="w-4 h-4 mr-2"/> Greutate Volumetrică (per m³)
                    </h4>
                    {volumetrice.length > 0 ? (
                        <div className="space-y-3">
                            {volumetrice.map((t, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-800">Voluminos</p>
                                        <p className="text-xs text-gray-500">Valabilitate: {t.valabilitate_de_la} - {t.valabilitate_pana_la || 'Prezent'}</p>
                                    </div>
                                    <span className="font-bold text-green-600 text-lg">{t.pret_per_unitate} RON/m³</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-gray-500 italic">
                            Nu există tarife pentru greutate volumetrică configurate.
                        </div>
                    )}
                </div>
            </div>

            {/* Categorii speciale */}
            <div className="bg-white p-6 rounded shadow border-l-4 border-yellow-500">
                <h3 className="font-bold mb-4 flex items-center text-yellow-800">
                    <AlertTriangle className="w-5 h-5 mr-2"/> Taxe pentru Categorii Speciale
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                            </div>
                            <span className="font-bold text-yellow-800">Fragil</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">Coletul conține obiecte fragile.</p>
                        <p className="text-lg font-bold text-yellow-700">+15% la tariful de bază</p>
                    </div>
                    
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                            </div>
                            <span className="font-bold text-red-800">Prețios</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">Coletul conține obiecte de valoare.</p>
                        <p className="text-lg font-bold text-red-700">+20% la tariful de bază</p>
                    </div>
                    
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-4 h-4 text-orange-600" />
                            </div>
                            <span className="font-bold text-orange-800">Periculos</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">Coletul conține substanțe periculoase.</p>
                        <p className="text-lg font-bold text-orange-700">+25% la tariful de bază</p>
                    </div>
                </div>
            </div>

            {/* Consum estimat */}
            <div className="bg-white p-6 rounded shadow border-l-4 border-green-500">
                <h3 className="font-bold mb-4 flex items-center text-green-800">
                    <TrendingUp className="w-5 h-5 mr-2"/> Calculator Consum Combustibil
                </h3>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Distanță parcursă (km)
                            </label>
                            <input
                                type="number"
                                defaultValue="100"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Consum mediu (L/100km)
                            </label>
                            <input
                                type="number"
                                defaultValue="8.5"
                                step="0.1"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                    
                    <div className="mt-6 p-4 bg-white rounded-lg border">
                        <div className="text-center">
                            <p className="text-gray-600 mb-1">Cost estimat pentru 100km</p>
                            <p className="text-3xl font-bold text-green-700">
                                {((100 * 8.5 / 100) * activePrice.ron).toFixed(2)} RON
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                                {(100 * 8.5 / 100).toFixed(1)} litri × {activePrice.ron} RON/L
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <DashboardView />;
      case 'rute': return <RuteView />;
      case 'colete': return <ColeteView />;
      case 'livrari': return <LivrariView />;
      case 'retururi': return <RetururiView />;
      case 'subcontractori': return <SubcontractoriView />;
      case 'rapoarte': return <RapoarteView />;
      default: return <DashboardView />;
    }
  };

  // --- DEFINIREA NAVIGAȚIEI PE BAZA DE ROLURI ---
  const getNavigationItems = () => {
    const baseItems = [
        {id: 'dashboard', label: 'Dashboard', icon: Home, roles: ['Administrator', 'Manager', 'Operator', 'Curier']},
        {id: 'colete', label: 'Colete', icon: Package, roles: ['Administrator', 'Manager', 'Operator', 'Curier']},
        {id: 'livrari', label: 'Livrări & Dispecerat', icon: Truck, roles: ['Administrator', 'Manager', 'Operator', 'Curier']},
    ];
    
    // Adăugăm elemente specifice pentru admin
    if (currentUser?.role === 'Administrator' || currentUser?.role === 'Manager') {
        baseItems.push(
            {id: 'rute', label: 'Rute', icon: MapPin, roles: ['Administrator', 'Manager']},
            {id: 'subcontractori', label: 'Subcontractori', icon: Users, roles: ['Administrator', 'Manager']},
            {id: 'retururi', label: 'Retururi', icon: AlertTriangle, roles: ['Administrator', 'Manager', 'Operator']},
            {id: 'rapoarte', label: 'Rapoarte & Tarife', icon: BarChart3, roles: ['Administrator', 'Manager']}
        );
    }
    
    return baseItems.filter(item => item.roles.includes(currentUser?.role));
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      {/* SIDEBAR */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white flex flex-col transition-all duration-300 shadow-xl z-10 relative`}>
        <div className={`h-16 flex items-center ${sidebarOpen ? 'justify-between px-4' : 'justify-center'} border-b border-slate-700`}>
            {sidebarOpen && (
              <h1
                onClick={() => setActiveTab('dashboard')}
                className="font-bold text-xl text-blue-400 truncate cursor-pointer hover:opacity-80 transition-opacity select-none"
              >
                FAST<span className="text-white">COURIER</span>
              </h1>
            )}
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded hover:bg-slate-800 transition-colors focus:outline-none"><Menu className="w-6 h-6" /></button>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
            {getNavigationItems().map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center p-3 rounded transition-colors ${activeTab===item.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                    <div className="min-w-[20px] flex justify-center"><item.icon className="w-5 h-5" /></div>
                    {sidebarOpen && <span className="ml-3 text-sm font-medium transition-opacity duration-200 whitespace-nowrap">{item.label}</span>}
                </button>
            ))}
        </nav>
        {/* LOGOUT BUTTON */}
        <div className="p-4 border-t border-slate-700">
            <button onClick={handleLogout} className={`w-full flex items-center p-2 rounded text-slate-300 hover:bg-red-900/30 hover:text-red-400 transition-colors ${!sidebarOpen ? 'justify-center' : ''}`}>
                <LogOut className="w-5 h-5" />
                {sidebarOpen && <span className="ml-3 text-sm font-medium">Deconectare</span>}
            </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
          <header className="bg-white shadow-sm z-0 h-16 flex items-center justify-between px-6 border-b">
                <div className="flex items-center text-gray-500 text-sm font-medium">
                    <span className="capitalize">{activeTab.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-600 flex items-center gap-2">
                        <Clock className="w-3 h-3" /> {new Date().toLocaleDateString('ro-RO')}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-gray-800">{currentUser?.name}</p>
                            <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                <Shield className="w-3 h-3" /> {currentUser?.role}
                            </p>
                        </div>
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow">
                            {currentUser?.name?.charAt(0) || 'U'}
                        </div>
                    </div>
                </div>
          </header>
          <main className="flex-1 overflow-auto p-8">
            {renderContent()}
          </main>
      </div>
    </div>
  );
};

export default CourierInterface;