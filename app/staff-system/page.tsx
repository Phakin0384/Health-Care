'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from '@/src/components/Header';
import { Sidebar } from '@/src/components/Sidebar';
import { BottomNav } from '@/src/components/BottomNav';
import { PatientMonitor } from '@/src/components/PatientMonitor';
import { PatientRecords } from '@/src/components/PatientRecords';
import { AnalyticsView } from '@/src/components/AnalyticsView';
import { NotificationsModal } from '@/src/components/NotificationsModal';
import { EmergencyAlertModal } from '@/src/components/EmergencyAlertModal';
import { AboutModal } from '@/src/components/AboutModal';
import { ConfirmationModal } from '@/src/components/ConfirmationModal';
import type { ActionResponse, AppAction, AppState } from '@/src/actions';
import type { ActiveTab } from '@/src/types';
import type { EmergencyCode, EmergencyLocation } from '@/src/emergencyCodes';
import { Siren, Wifi, WifiOff, X } from 'lucide-react';

const EMPTY_STATE: AppState = {
  sessions: [],
  patientRecords: [],
  notifications: [],
  activityLog: [],
  activeEmergencyBanner: null,
  isSimulating: true,
};

export default function StaffSystemPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('monitor');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Real-time server state. Starts empty rather than seeded with sample data so
  // staff never see rows the server does not actually have; the connection
  // badge below covers the brief gap before the first payload arrives.
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');

  // Connection & modals
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [isHttpSynced, setIsHttpSynced] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<
    | { title: string; message: string; confirmLabel: string; destructive: boolean; onConfirm: () => void }
    | null
  >(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isFetchingStateRef = useRef(false);

  const fetchStateHttp = useCallback(async () => {
    if (isFetchingStateRef.current) return;
    isFetchingStateRef.current = true;

    try {
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error(`Server responded ${res.status}`);

      const data = (await res.json()) as ActionResponse;
      if (data.payload) {
        setState(data.payload);
        setIsHttpSynced(true);
      }
    } catch (err) {
      console.error('HTTP state fetch error:', err);
      setIsHttpSynced(false);
    } finally {
      isFetchingStateRef.current = false;
    }
  }, []);

  // Setup WebSocket connection & HTTP polling fallback
  useEffect(() => {
    let isDisposed = false;

    const scheduleReconnect = () => {
      if (isDisposed || reconnectTimerRef.current) return;

      // Exponential backoff avoids a reconnection storm while the service is
      // unavailable, while the HTTP fallback keeps staff data current.
      const attempt = reconnectAttemptsRef.current++;
      const delay = Math.min(30_000, 1_000 * 2 ** attempt);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connectWebSocket();
      }, delay);
    };

    const connectWebSocket = () => {
      if (isDisposed) return;

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
        socketRef.current = ws;

        ws.onopen = () => {
          if (socketRef.current !== ws) return;
          setIsWsConnected(true);
          reconnectAttemptsRef.current = 0;
          fetchStateHttp();
        };

        ws.onmessage = (event) => {
          if (socketRef.current !== ws) return;
          try {
            const data = JSON.parse(event.data) as ActionResponse;
            if (data.type === 'INIT_STATE' && data.payload) setState(data.payload);
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        ws.onclose = () => {
          if (socketRef.current !== ws) return;
          socketRef.current = null;
          setIsWsConnected(false);
          fetchStateHttp();
          scheduleReconnect();
        };

        ws.onerror = () => {
          if (socketRef.current !== ws) return;
          setIsWsConnected(false);
          try { ws.close(); } catch { /* already closing */ }
        };
      } catch (e) {
        console.error('WebSocket creation error:', e);
        setIsWsConnected(false);
        fetchStateHttp();
        scheduleReconnect();
      }
    };

    // Subscribing to an external system on mount, which is what effects are
    // for. Both calls are async; state lands in a later callback rather than
    // synchronously during this effect, so no render cascades.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStateHttp();
    connectWebSocket();

    // Poll only while the socket is unavailable. This avoids duplicate state
    // traffic while still allowing staff to work during a WebSocket outage.
    const pollInterval = setInterval(() => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) fetchStateHttp();
    }, 5_000);

    return () => {
      isDisposed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      clearInterval(pollInterval);
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [fetchStateHttp]);

  // Commands go over HTTP even when the socket is open. A send on a WebSocket
  // is fire-and-forget — it can report OPEN and still not deliver through a
  // flaky mobile connection or an intermediate proxy, with no way to tell. A
  // POST either succeeds or returns an error this code can surface, and it
  // carries server-assigned identifiers straight back to the caller that needs
  // them. The socket stays responsible for live state broadcasts.
  const dispatch = useCallback(async (action: AppAction) => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      const data = (await res.json()) as ActionResponse;
      if (data.payload) setState(data.payload);
      if (!res.ok) throw new Error(data.result?.error ?? `Server responded ${res.status}`);
    } catch (err) {
      console.error('Action failed:', err);
    }
  }, []);

  const handleTerminateSession = (sessionId: string) => {
    setPendingConfirmation({
      title: 'Terminate intake session?',
      message: `Session ${sessionId} will be removed from the live monitor. This action is recorded in activity history.`,
      confirmLabel: 'Terminate session',
      destructive: true,
      onConfirm: () => dispatch({ type: 'TERMINATE_SESSION', payload: { sessionId } }),
    });
  };

  const handleClearNotifications = () => {
    setPendingConfirmation({
      title: 'Clear current notifications?',
      message: 'This removes the current notification list. The separate activity history will remain available.',
      confirmLabel: 'Clear notifications',
      destructive: true,
      onConfirm: () => dispatch({ type: 'CLEAR_NOTIFICATIONS' }),
    });
  };

  const handleTriggerEmergency = (codeType: EmergencyCode, location: EmergencyLocation) => {
    dispatch({ type: 'EMERGENCY_ALERT', payload: { codeType, location } });
  };

  // Sessions carry the exact record id the server linked them to, so this is
  // an exact lookup — no name matching, which could open the wrong patient.
  const handleSelectPatientRecord = (recordId: string) => {
    setSelectedPatientId(recordId);
    setActiveTab('records');
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] flex flex-col font-sans">
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        unreadNotifications={state.notifications.length}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenEmergency={() => setIsEmergencyOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
      />

      {/* Real-Time Sync Indicator Badge */}
      <div className="fixed top-18 right-6 z-40 hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-white/80 backdrop-blur-xs shadow-2xs">
        {isWsConnected ? (
          <>
            <Wifi className="w-3.5 h-3.5 text-[#10b981]" />
            <span className="text-[#00714d]">Live WebSocket Active</span>
          </>
        ) : isHttpSynced ? (
          <>
            <Wifi className="w-3.5 h-3.5 text-[#005eb8]" />
            <span className="text-[#005eb8]">Live Sync Active</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5 text-[#ba1a1a] animate-pulse" />
            <span className="text-[#ba1a1a]">Connecting...</span>
          </>
        )}
      </div>

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onOpenAbout={() => setIsAboutOpen(true)} />

      <main className="pt-20 pb-24 lg:pl-68 px-4 md:px-8 w-full transition-all">
        {/* An active broadcast is announced on every connected screen until a
            staff member dismisses it, which clears it for everyone. */}
        {state.activeEmergencyBanner && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between gap-4 rounded-2xl border-2 border-[#ba1a1a] bg-[#ffdad6] px-5 py-4 shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Siren className="w-6 h-6 text-[#ba1a1a] shrink-0 animate-pulse" />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-[#93000a]">Emergency broadcast</p>
                <p className="text-sm font-bold text-[#191c1e] truncate">{state.activeEmergencyBanner}</p>
              </div>
            </div>
            <button
              onClick={() => dispatch({ type: 'DISMISS_EMERGENCY' })}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#ba1a1a] px-4 py-2 text-xs font-bold text-white hover:bg-[#93000a] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Dismiss for all</span>
            </button>
          </div>
        )}

        {activeTab === 'monitor' && (
          <PatientMonitor
            sessions={state.sessions}
            onSelectPatient={handleSelectPatientRecord}
            onTerminateSession={handleTerminateSession}
            onAddNewLiveSession={() => dispatch({ type: 'SIMULATE_LIVE_SESSION' })}
            isSimulating={state.isSimulating}
            onToggleSimulation={() => dispatch({ type: 'TOGGLE_SIMULATION' })}
            searchQuery={searchQuery}
          />
        )}

        {activeTab === 'records' && (
          <PatientRecords
            records={state.patientRecords}
            selectedPatientId={selectedPatientId}
            onSelectPatientId={setSelectedPatientId}
            onSaveTriageNote={(patientId, note) => dispatch({ type: 'SAVE_TRIAGE_NOTE', payload: { patientId, note } })}
            onSaveTriagePriority={(patientId, priority) =>
              dispatch({ type: 'SAVE_TRIAGE_PRIORITY', payload: { patientId, priority } })
            }
            onSendMessage={(patientId, message) =>
              dispatch({ type: 'SEND_PATIENT_MESSAGE', payload: { patientId, message } })
            }
            onBackToMonitor={() => setActiveTab('monitor')}
            searchQuery={searchQuery}
          />
        )}

        {activeTab === 'analytics' && <AnalyticsView sessions={state.sessions} records={state.patientRecords} />}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={state.notifications}
        activityLog={state.activityLog}
        onClearAll={handleClearNotifications}
      />

      <EmergencyAlertModal
        isOpen={isEmergencyOpen}
        onClose={() => setIsEmergencyOpen(false)}
        onTriggerAlert={handleTriggerEmergency}
      />

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />

      {pendingConfirmation && (
        <ConfirmationModal
          {...pendingConfirmation}
          onCancel={() => setPendingConfirmation(null)}
          onConfirm={() => {
            pendingConfirmation.onConfirm();
            setPendingConfirmation(null);
          }}
        />
      )}
    </div>
  );
}
