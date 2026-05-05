import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

const App = () => {
  const [view, setView] = useState('active');
  const [incidents, setIncidents] = useState([]);
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [rawLogs, setRawLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  
  // Font scaling state
  const [fontSize, setFontSize] = useState(16);

  const [rcaForm, setRcaForm] = useState({
    category: 'Software Bug',
    rca_details: '',
    startTime: '',
    endTime: ''
  });

  const COLORS = { P0: '#ef4444', P1: '#f59e0b', P2: '#06b6d4' };

  const adjustFont = (amount) => {
    setFontSize(prev => Math.min(Math.max(prev + amount, 12), 24));
  };

  const fetchData = async () => {
    try {
      if (view === 'active') {
        const res = await axios.get('http://localhost:3000/incidents');
        setIncidents(res.data);
        setHistory([]);
      } else {
        const res = await axios.get('http://localhost:3000/incidents/history');
        setHistory(res.data);
        setIncidents([]);
      }
      const analyticsRes = await axios.get('http://localhost:3000/analytics/throughput');
      setAnalytics(Array.isArray(analyticsRes.data) ? analyticsRes.data : []);
    } catch (err) {
      console.error("Data fetch failed");
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [view]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#0f172a] border border-slate-700 p-3 rounded-lg shadow-2xl">
          <p className="text-white font-bold text-sm mb-1">{data.severity}</p>
          <p className="text-slate-400 text-xs">
            count : <span className="text-cyan-400 font-mono">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const handleTransition = async (id, newStatus) => {
    try {
      const payload = { newStatus };
      if (newStatus === 'CLOSED') {
        if (!rcaForm.rca_details.trim()) return alert("RCA details required.");
        payload.rcaData = { ...rcaForm, fix_applied: rcaForm.rca_details };
      }
      await axios.post(`http://localhost:3000/incidents/${id}/transition`, payload);
      setSelectedIncident(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Transition failed");
    }
  };

  const openLogs = (id) => {
    axios.get(`http://localhost:3000/incidents/${id}/logs`)
      .then(res => { setRawLogs(res.data); setShowLogs(true); });
  };

  return (
    <div 
      className="min-h-screen bg-[#020617] text-slate-200 p-8 font-sans transition-all duration-200"
      style={{ fontSize: `${fontSize}px` }}
    >
      <div className="max-w-6xl mx-auto space-y-8">

        <header className="flex justify-between items-center border-b border-slate-800 pb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Incident Management System</h1>
            <div className="flex gap-2 mt-4">
              <button onClick={() => adjustFont(-2)} className="px-3 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-bold hover:bg-slate-800 transition-colors">A-</button>
              <button onClick={() => adjustFont(2)} className="px-3 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-bold hover:bg-slate-800 transition-colors">A+</button>
              <span className="text-[10px] text-slate-600 self-center uppercase font-black ml-2">Font Scale: {fontSize}px</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-widest">10K SIG/SEC CAP</span>
          </div>
        </header>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
          <h2 className="text-xs font-black text-slate-500 mb-8 uppercase tracking-[0.2em]">Severity Distribution (24H)</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics} barGap={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="severity" stroke="#475569" tick={{fontSize: 12, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                <YAxis stroke="#475569" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(30, 41, 59, 0.4)'}} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={60}>
                  {analytics.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.severity] || '#334155'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={() => setView('active')} className={`px-8 py-3 rounded-xl font-bold text-sm transition-all border ${view === 'active' ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'}`}>ACTIVE</button>
          <button onClick={() => setView('history')} className={`px-8 py-3 rounded-xl font-bold text-sm transition-all border ${view === 'history' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'}`}>HISTORY</button>
        </div>

        <div className="grid gap-4">
          {view === 'active' ? incidents.map(inc => (
            <div key={inc.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border font-black text-sm ${inc.severity === 'P0' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30'}`}>{inc.severity}</div>
                <div>
                  <h3 className="text-lg font-bold text-white uppercase">{inc.component_id}</h3>
                  <p className="text-slate-500 text-xs font-mono font-bold">{inc.status} // {new Date(inc.start_time).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => openLogs(inc.id)} className="bg-slate-800 text-slate-300 px-4 py-2 rounded-lg font-bold text-xs border border-slate-700 hover:bg-slate-700">Audit Logs</button>
                <button onClick={() => { setSelectedIncident(inc); setRcaForm({...rcaForm, startTime: inc.start_time.slice(0,16)}); }} className="bg-cyan-500 text-slate-950 px-5 py-2 rounded-lg font-bold text-xs hover:bg-cyan-400">Manage</button>
              </div>
            </div>
          ) ) : history.map(item => (
            <div key={item.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-slate-400 uppercase">{item.component_id}</h3>
                  <p className="text-slate-600 text-xs font-bold uppercase mb-2">Root Cause: <span className="text-emerald-500">{item.category}</span></p>
                  
                  {/* MTTR Metric (Requirement 3.3) */}
                  <div className="inline-flex items-center gap-2 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] font-bold text-amber-500 uppercase tracking-tighter">
                    ⏱️ MTTR: {item.mttr_minutes ? Math.round(item.mttr_minutes) : 0} MINS
                  </div>
                </div>
                <button onClick={() => setExpandedHistory(expandedHistory === item.id ? null : item.id)} className="text-xs font-bold text-cyan-500 hover:text-cyan-400">
                  {expandedHistory === item.id ? "CLOSE DETAILS ▲" : "VIEW RCA ▼"}
                </button>
              </div>
              {expandedHistory === item.id && (
                <div className="bg-black/40 p-5 rounded-lg border border-slate-800">
                  <h4 className="text-[10px] text-slate-500 font-black uppercase mb-2">Analysis Findings</h4>
                  <p className="text-sm text-slate-300 leading-relaxed mb-4">{item.fix_applied || "No data recorded."}</p>
                  <div className="pt-4 border-t border-slate-800/50 flex justify-between text-[10px] font-mono text-slate-600">
                     <span>STARTED: {new Date(item.start_time).toLocaleString()}</span>
                     <span>CLOSED: {new Date(item.end_time).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedIncident && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[200]">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl p-8 space-y-6 relative">
            <button onClick={() => setSelectedIncident(null)} className="absolute top-6 right-6 text-slate-500 hover:text-white text-xl font-bold">✕</button>
            <h2 className="text-lg font-bold text-white uppercase tracking-tight">Resolution for <span className="text-cyan-500">{selectedIncident.component_id}</span></h2>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleTransition(selectedIncident.id, 'INVESTIGATING')} className="p-3 border border-slate-700 rounded-xl text-xs font-bold uppercase hover:bg-slate-800 transition-colors">Mark Investigating</button>
              <button onClick={() => handleTransition(selectedIncident.id, 'IDENTIFIED')} className="p-3 border border-slate-700 rounded-xl text-xs font-bold uppercase hover:bg-slate-800 transition-colors">Mark Identified</button>
            </div>
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <input type="datetime-local" className="bg-slate-900 border border-slate-800 p-3 text-sm rounded-lg text-slate-300" value={rcaForm.startTime} onChange={e => setRcaForm({...rcaForm, startTime: e.target.value})} />
                <input type="datetime-local" className="bg-slate-900 border border-slate-800 p-3 text-sm rounded-lg text-slate-300" value={rcaForm.endTime} onChange={e => setRcaForm({...rcaForm, endTime: e.target.value})} />
              </div>
              <select className="w-full bg-slate-900 border border-slate-800 p-3 text-sm rounded-lg text-slate-300" value={rcaForm.category} onChange={e => setRcaForm({...rcaForm, category: e.target.value})}>
                <option>Software Bug</option><option>Human Error</option><option>Hardware Failure</option><option>Network Issue</option>
              </select>
              <textarea placeholder="Write Root Cause Analysis..." className="w-full bg-slate-900 border border-slate-800 p-4 text-sm rounded-xl h-32 resize-none focus:border-cyan-500 outline-none" value={rcaForm.rca_details} onChange={e => setRcaForm({...rcaForm, rca_details: e.target.value})} />
              <div className="flex gap-3">
                <button onClick={() => setSelectedIncident(null)} className="flex-1 bg-slate-800 text-slate-400 font-bold py-4 rounded-xl text-xs uppercase hover:bg-slate-700 transition-colors">Cancel</button>
                <button onClick={() => handleTransition(selectedIncident.id, 'CLOSED')} className="flex-[2] bg-emerald-600 text-white font-bold py-4 rounded-xl text-xs uppercase tracking-widest hover:bg-emerald-500 transition-colors">Submit & Close Incident</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLogs && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-[300]">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl p-8 relative">
            <button onClick={() => setShowLogs(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white text-2xl font-bold">✕</button>
            <h2 className="text-xs font-black text-cyan-500 uppercase tracking-widest mb-6">Audit Logs // Secure Data Access</h2>
            <pre className="bg-black/50 p-6 rounded-xl text-xs font-mono text-emerald-500 h-[500px] overflow-y-auto border border-slate-800 shadow-inner">{JSON.stringify(rawLogs, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
