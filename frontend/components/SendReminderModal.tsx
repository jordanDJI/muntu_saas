"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  reminderId: string;
  onClose: () => void;
  onSent: (reminderId: string, sentAt: string) => void;
}

export default function SendReminderModal({ reminderId, onClose, onSent }: Props) {
  const { t } = useLanguage();

  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName]   = useState("");
  const [subject, setSubject]   = useState("");
  const [body, setBody]         = useState("");

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.getReminderPreview(reminderId)
      .then((data) => {
        if (cancelled) return;
        setContactEmail(data.contact_email);
        setContactName(data.contact_name);
        setSubject(data.subject);
        setBody(data.body);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Impossible de charger l'aperçu.");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [reminderId]);

  const handleSend = async () => {
    setSending(true);
    setError("");
    try {
      const res = await api.sendReminder(reminderId, {
        subject_override: subject,
        message_override: body,
      });
      onSent(reminderId, res.sent_at);
      onClose();
    } catch {
      setError("L'envoi a échoué. Vérifiez votre configuration email.");
      setSending(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{t.reminder_modal_title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">{t.reminder_modal_loading}</p>
          ) : (
            <>
              {/* Explication */}
              <div className="flex gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p className="text-xs text-blue-700 leading-relaxed">{t.reminder_modal_explain}</p>
              </div>

              {/* To */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t.reminder_modal_to}
                </label>
                <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  <span className="font-medium">{contactName}</span>
                  {contactEmail && (
                    <span className="text-gray-400 truncate">&lt;{contactEmail}&gt;</span>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t.reminder_modal_subject}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full text-base sm:text-sm border border-gray-200 rounded-lg px-3 py-2.5 sm:py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t.reminder_modal_body}
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  className="w-full text-base sm:text-sm border border-gray-200 rounded-lg px-3 py-2.5 sm:py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Hint */}
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t.reminder_modal_hint}
              </p>

              {!contactEmail && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {t.reminder_no_email}
                </p>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
            <button
              onClick={onClose}
              disabled={sending}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50 py-2 px-1"
            >
              {t.reminder_modal_cancel}
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !contactEmail}
              className="text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-5 py-2.5 transition-colors active:scale-95"
            >
              {sending ? t.reminder_modal_sending : t.reminder_modal_send}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
