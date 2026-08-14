'use client';

import React from 'react';
import { Bell, X, AlertTriangle, UserCheck, Clock, History } from 'lucide-react';
import { ActivityLogItem, StaffNotification } from '../types';
import { formatClockTime, relativeTime } from '../formatTime';
import { useModalDismiss } from '../useModalDismiss';

export type NotificationItem = StaffNotification;

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  activityLog: ActivityLogItem[];
  onClearAll: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  activityLog,
  onClearAll,
}) => {
  const dialogRef = useModalDismiss(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-end p-4 md:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-title"
        className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-[#c2c6d4] mt-12 animate-in fade-in slide-in-from-top-4 duration-200"
      >
        <div className="flex justify-between items-center border-b border-[#c2c6d4] pb-3 mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#00478d]" />
            <h3 id="notifications-title" className="font-bold text-base text-[#191c1e]">
              Notifications ({notifications.length})
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs text-[#00478d] hover:underline cursor-pointer font-medium"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close notifications"
              className="text-[#727783] hover:text-[#191c1e] p-1 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 rounded-xl border text-xs flex gap-3 items-start ${
                n.type === 'alert'
                  ? 'bg-[#ffdad6]/40 border-[#ba1a1a]/30 text-[#93000a]'
                  : n.type === 'success'
                  ? 'bg-[#d1fae5]/40 border-[#10b981]/30 text-[#00714d]'
                  : 'bg-[#f7f9fb] border-[#c2c6d4] text-[#191c1e]'
              }`}
            >
              {n.type === 'alert' && <AlertTriangle className="w-4 h-4 text-[#ba1a1a] shrink-0 mt-0.5" />}
              {n.type === 'success' && <UserCheck className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" />}
              {n.type === 'info' && <Clock className="w-4 h-4 text-[#00478d] shrink-0 mt-0.5" />}

              <div className="flex-1">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-bold">{n.title}</span>
                  {/* Derived at render from the stored instant, so a reload
                      tomorrow does not still claim "just now". */}
                  <time dateTime={new Date(n.createdAt).toISOString()} className="text-[10px] text-[#727783] font-mono">
                    {relativeTime(n.createdAt)}
                  </time>
                </div>
                <p className="text-[#424752]">{n.message}</p>
              </div>
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="text-center py-8 text-[#727783] text-xs">
              No unread notifications at this time.
            </div>
          )}
        </div>

        <div className="border-t border-[#c2c6d4] mt-4 pt-4">
          <div className="flex items-center gap-2 mb-2 text-[#424752]">
            <History className="w-4 h-4" />
            <h4 className="text-xs font-bold">Recent activity</h4>
          </div>
          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {activityLog.slice(0, 8).map((item) => (
              <div key={item.id} className="text-xs bg-[#f7f9fb] border border-[#c2c6d4] rounded-lg p-2.5">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold text-[#191c1e]">{item.action}</span>
                  <time
                    dateTime={new Date(item.occurredAt).toISOString()}
                    title={relativeTime(item.occurredAt)}
                    className="text-[10px] text-[#727783] font-mono shrink-0"
                  >
                    {formatClockTime(item.occurredAt)}
                  </time>
                </div>
                <p className="text-[#424752] mt-0.5">{item.message}</p>
              </div>
            ))}
            {activityLog.length === 0 && <p className="text-xs text-[#727783] py-2">No staff activity recorded yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
