import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { OverviewPage } from '../features/event_overview/pages/OverviewPage';
import { LiveHealthPage } from '../features/live_health/pages/LiveHealthPage';
import { CrowdMonitoringPage } from '../features/crowd_monitoring/pages/CrowdMonitoringPage';
import { EmergencyCommandPage } from '../features/emergency_command/pages/EmergencyCommandPage';
import { HeatWellnessPage } from '../features/heat_wellness/pages/HeatWellnessPage';
import { ResponderPage } from '../features/responder_management/pages/ResponderPage';
import { ReportsPage } from '../features/reports_analytics/pages/ReportsPage';
import { INITIAL_ZONES, INITIAL_VITALS, INITIAL_ALERTS, INITIAL_RESPONDERS } from '../constants/mockData';
import { ZoneData, VitalReading, EmergencyAlert, Responder } from '../types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [zones, setZones] = useState<ZoneData[]>(INITIAL_ZONES);
  const [vitals, setVitals] = useState<VitalReading[]>(INITIAL_VITALS);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>(INITIAL_ALERTS);
  const [responders, setResponders] = useState<Responder[]>(INITIAL_RESPONDERS);

  // Dynamic Telemetry Simulation: Vitals fluctuations and crowd movements every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setVitals(prev =>
        prev.map(v => {
          // slight fluctuation in heart rate
          const deltaHR = Math.floor(Math.random() * 5) - 2;
          const newHR = Math.max(60, Math.min(180, v.heartRate + deltaHR));
          return {
            ...v,
            heartRate: newHR,
            lastUpdated: 'Just now'
          };
        })
      );

      setZones(prev =>
        prev.map(z => {
          const deltaCount = Math.floor(Math.random() * 11) - 5;
          const newCount = Math.max(100, Math.min(z.capacity, z.currentCount + deltaCount));
          return {
            ...z,
            currentCount: newCount
          };
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleDispatch = (alertId: string, responderName: string) => {
    setAlerts(prev =>
      prev.map(a =>
        a.id === alertId
          ? { ...a, status: 'dispatched', assignedResponder: responderName }
          : a
      )
    );

    setResponders(prev =>
      prev.map(r =>
        r.name === responderName
          ? { ...r, status: 'dispatched', assignedIncidentId: alertId }
          : r
      )
    );
  };

  const handleResolve = (alertId: string) => {
    setAlerts(prev =>
      prev.map(a =>
        a.id === alertId ? { ...a, status: 'resolved' } : a
      )
    );

    setResponders(prev =>
      prev.map(r =>
        r.assignedIncidentId === alertId
          ? { ...r, status: 'available', assignedIncidentId: undefined }
          : r
      )
    );
  };

  const handleSimulateSOS = () => {
    const newAlertId = `EMG-${Math.floor(100 + Math.random() * 900)}`;
    const randomZones = zones.map(z => z.name);
    const selectedZone = randomZones[Math.floor(Math.random() * randomZones.length)];

    const newAlert: EmergencyAlert = {
      id: newAlertId,
      timestamp: new Date().toLocaleTimeString(),
      type: 'SOS_BUTTON',
      attendeeName: 'Wristband User #4910',
      zone: selectedZone,
      priority: 'critical',
      status: 'pending',
      details: `Hardware emergency button pressed in ${selectedZone}. Telemetry indicates elevated heart rate (156 bpm).`
    };

    setAlerts(prev => [newAlert, ...prev]);
  };

  const pendingAlertsCount = alerts.filter(a => a.status === 'pending').length;

  return (
    <DashboardLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      pendingAlertsCount={pendingAlertsCount}
    >
      {activeTab === 'overview' && (
        <OverviewPage
          zones={zones}
          vitals={vitals}
          alerts={alerts}
          responders={responders}
          onNavigateTab={setActiveTab}
        />
      )}
      {activeTab === 'health' && <LiveHealthPage vitals={vitals} />}
      {activeTab === 'crowd' && <CrowdMonitoringPage zones={zones} />}
      {activeTab === 'emergency' && (
        <EmergencyCommandPage
          alerts={alerts}
          responders={responders}
          onDispatch={handleDispatch}
          onResolve={handleResolve}
          onSimulateSOS={handleSimulateSOS}
        />
      )}
      {activeTab === 'heat' && <HeatWellnessPage zones={zones} />}
      {activeTab === 'responders' && <ResponderPage responders={responders} />}
      {activeTab === 'reports' && <ReportsPage />}
    </DashboardLayout>
  );
};
export default App;
