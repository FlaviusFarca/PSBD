import React, { useState, useEffect } from 'react';
import { 
  Package, Truck, MapPin, Users, DollarSign, 
  Calendar, BarChart3, Home, Menu, X, 
  AlertTriangle, CheckCircle, Trash2
} from 'lucide-react';

const API_URL = "http://localhost:5000/api";

// --- COMPONENTA MODAL (Stiluri Inline pentru siguranță maximă) ---
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fundal întunecat transparent
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999 // Să fie peste tot
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        position: 'relative'
      }}>
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button 
            onClick={onClose}
            style={{ cursor: 'pointer', padding: '5px', fontWeight: 'bold' }}
            className="hover:bg-gray-100 rounded"
          >
            ✕
          </button>
        </div>
        <div>
          {children}
        </div>
      </div>
    </div>
  );
};

// --- APLICAȚIA PRINCIPALĂ ---
const CourierInterface = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Meniul Sidebar
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'rute', label: 'Rute', icon: MapPin },
    { id: 'colete', label: 'Colete', icon: Package },
    { id: 'livrari', label: 'Livrări & Ramburs', icon: Truck },
    { id: 'subcontractori', label: 'Subcontractori', icon: Users },
    { id: 'tarife', label: 'Plan Tarifar', icon: DollarSign },
    { id: 'retururi', label: 'Retururi', icon: AlertTriangle },
    { id: 'rapoarte', label: 'Rapoarte', icon: BarChart3 },
  ];

  // --- 1. DASHBOARD ---
  const DashboardView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Panou de Control</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg">
          <p className="text-blue-100 text-sm">Colete Astăzi</p>
          <p className="text-3xl font-bold">247</p>
        </div>
        <div className="bg-green-600 text-white p-6 rounded-xl shadow-lg">
          <p className="text-green-100 text-sm">Livrări Reușite</p>
          <p className="text-3xl font-bold">189</p>
        </div>
      </div>
    </div>
  );

  // --- 2. RUTE (Conectat la SQL) ---
  const RuteView = () => {
    const [rute, setRute] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newRoute, setNewRoute] = useState({ nume: '', dist: 0 });

    const fetchRute = async () => {
        try {
            const response = await fetch(`${API_URL}/rute`);
            const data = await response.json();
            setRute(data);
        } catch (error) {
            console.error("Eroare fetch rute:", error);
        }
    };

    useEffect(() => { fetchRute(); }, []);

    const handleAddRoute = async () => {
      console.log("Se trimite ruta:", newRoute); // Debug
      try {
          const res = await fetch(`${API_URL}/rute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newRoute)
          });
          
          if(res.ok) {
            setIsModalOpen(false);
            setNewRoute({ nume: '', dist: 0 });
            fetchRute();
          } else {
            alert("Eroare la server!");
          }
      } catch (error) {
          alert("Eroare conexiune: " + error.message);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Gestiune Rute</h2>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md"
          >
            + Adaugă Rută
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left">ID</th>
                <th className="px-6 py-4 text-left">Nume Rută</th>
                <th className="px-6 py-4 text-left">Distanță (km)</th>
              </tr>
            </thead>
            <tbody>
              {rute.map((ruta, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4">#{ruta.id_ruta}</td>
                  <td className="px-6 py-4 font-bold">{ruta.nume_ruta}</td>
                  <td className="px-6 py-4">{ruta.distanta_maxima_km} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Adaugă Rută Nouă">
          <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Nume Rută</label>
                <input 
                    className="w-full border p-3 rounded-lg mt-1" 
                    placeholder="Ex: BUCURESTI - PLOIESTI"
                    value={newRoute.nume} 
                    onChange={e => setNewRoute({...newRoute, nume: e.target.value})} 
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Distanță (km)</label>
                <input 
                    type="number"
                    className="w-full border p-3 rounded-lg mt-1" 
                    placeholder="Ex: 60"
                    value={newRoute.dist} 
                    onChange={e => setNewRoute({...newRoute, dist: e.target.value})} 
                />
            </div>
            <button 
                onClick={handleAddRoute} 
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold"
            >
              Salvează în SQL
            </button>
          </div>
        </Modal>
      </div>
    );
  };

  // --- 3. COLETE ---
  const ColeteView = () => {
      const [colete, setColete] = useState([]);
      const [isModalOpen, setIsModalOpen] = useState(false);
      const [newPkg, setNewPkg] = useState({ cod: '', gr: '', cost: '' });

      const fetchColete = async () => {
          try {
              const res = await fetch(`${API_URL}/colete`);
              setColete(await res.json());
          } catch(e) { console.error(e); }
      };
      useEffect(() => { fetchColete(); }, []);

      const handleAddPkg = async () => {
          await fetch(`${API_URL}/colete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newPkg)
          });
          setIsModalOpen(false);
          fetchColete();
      };

      return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Colete</h2>
                <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">+ Colet</button>
            </div>
            <div className="bg-white rounded-xl shadow border">
                <table className="w-full">
                    <thead className="bg-gray-50"><tr><th className="p-4 text-left">Cod</th><th className="p-4">Greutate</th><th className="p-4">Cost</th></tr></thead>
                    <tbody>
                        {colete.map((c, i) => (
                            <tr key={i} className="border-t"><td className="p-4 text-blue-600 font-bold">{c.cod_colet}</td><td className="p-4">{c.greutate_fizica_kg}</td><td className="p-4">{c.cost_transport}</td></tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Adaugă Colet">
                <div className="space-y-4">
                    <input className="w-full border p-2 rounded" placeholder="Cod Colet" value={newPkg.cod} onChange={e => setNewPkg({...newPkg, cod: e.target.value})} />
                    <input className="w-full border p-2 rounded" placeholder="Greutate" value={newPkg.gr} onChange={e => setNewPkg({...newPkg, gr: e.target.value})} />
                    <input className="w-full border p-2 rounded" placeholder="Cost" value={newPkg.cost} onChange={e => setNewPkg({...newPkg, cost: e.target.value})} />
                    <button onClick={handleAddPkg} className="w-full bg-blue-600 text-white p-2 rounded">Salvează</button>
                </div>
            </Modal>
        </div>
      );
  };

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <DashboardView />;
      case 'rute': return <RuteView />;
      case 'colete': return <ColeteView />;
      default: return <div className="p-6">Secțiune în lucru...</div>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white flex flex-col transition-all duration-300`}>
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          {sidebarOpen && <h1 className="font-bold text-blue-400">FAST<span className="text-white">COURIER</span></h1>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)}><Menu className="w-6 h-6"/></button>
        </div>
        <nav className="flex-1 p-2">
            {menuItems.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center p-3 mb-1 rounded-lg ${activeTab === item.id ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                    <item.icon className="w-5 h-5"/>
                    {sidebarOpen && <span className="ml-3 text-sm">{item.label}</span>}
                </button>
            ))}
        </nav>
      </div>
      <div className="flex-1 overflow-auto p-8">
        {renderContent()}
      </div>
    </div>
  );
};

export default CourierInterface;