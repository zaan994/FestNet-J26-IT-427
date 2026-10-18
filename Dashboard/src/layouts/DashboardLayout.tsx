import React from 'react';
import {
  LayoutDashboard,
  HeartPulse,
  Users,
  AlertTriangle,
  Sun,
  ShieldCheck,
  BarChart3,
  Radio,
  Bell
} from 'lucide-react';

interface LayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingAlertsCount: number;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<LayoutProps> = ({
  activeTab,
  setActiveTab,
  pendingAlertsCount,
  children
}) => {
  const navItems = [
    { id: 'overview', label: 'Command Overview', icon: LayoutDashboard },
    { id: 'health', label: 'Live Health Vitals', icon: HeartPulse },
    { id: 'crowd', label: 'Crowd Monitoring', icon: Users },
    { id: 'emergency', label: 'Emergency Command', icon: AlertTriangle, badge: pendingAlertsCount },
    { id: 'heat', label: 'Heat & Wellness', icon: Sun },
    { id: 'responders', label: 'Responder Fleet', icon: ShieldCheck },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* Sidebar */}
      <aside style={{
        width: '280px',
        backgroundColor: '#0d1322',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem 1rem',
        position: 'sticky',
        top: 0,
        height: '100vh'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem', paddingLeft: '0.5rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            padding: '0.65rem',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
          }}>
            <Radio size={22} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #ffffff, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              FestNet
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Safety & Health Command v1.0
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: isActive ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                  color: isActive ? '#60a5fa' : 'var(--text-muted)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  outline: isActive ? '1px solid rgba(59, 130, 246, 0.3)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Icon size={18} color={isActive ? '#60a5fa' : '#6b7280'} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span style={{
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    borderRadius: '9999px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    minWidth: '1.25rem',
                    textAlign: 'center'
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Network & Gateway Status */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '1rem',
          fontSize: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>LoRa / Mesh Gateway:</span>
            <span style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="live-pulse-green"></span> ONLINE
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Connected Wristbands:</span>
            <span style={{ color: '#fff', fontWeight: 700 }}>19,510</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Cloud Sync (Firebase):</span>
            <span style={{ color: '#60a5fa', fontWeight: 600 }}>Active (0.2s)</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Header */}
        <header style={{
          height: '70px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: '#0d1322',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2rem',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#34d399',
              padding: '0.35rem 0.75rem',
              borderRadius: '20px',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              <span className="live-pulse-green"></span>
              Live Event: SunFest 2026 Arena
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
              Server Time: {new Date().toLocaleTimeString()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <button
              onClick={() => setActiveTab('emergency')}
              style={{
                position: 'relative',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: pendingAlertsCount > 0 ? '#f43f5e' : 'var(--text-muted)'
              }}
            >
              <Bell size={18} />
              {pendingAlertsCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444'
                }} />
              )}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}>
                CC
              </div>
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Command Center Admin</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Emergency Dispatch Unit</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ padding: '2rem', flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
};
