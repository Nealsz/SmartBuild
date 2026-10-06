"use client";

import { useEffect, useRef, useState } from "react";
import { createStoreTicket } from "@/lib/adminApi";

interface StoreTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalPrice: number;
  buildData: Record<string, any>;
}

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const LOCK_SECONDS = 10;

export default function StoreTicketModal({
  isOpen,
  onClose,
  totalPrice,
  buildData,
}: StoreTicketModalProps) {
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");

  // Privacy sub-modal state
  const [privacyOpen, setPrivacyOpen]       = useState(false);
  const [privacyRead, setPrivacyRead]       = useState(false); // unlocked after Okay
  const [privacyLock, setPrivacyLock]       = useState(0);    // countdown seconds remaining

  // Consent checkboxes
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [ticketConsent, setTicketConsent]   = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [copied, setCopied]   = useState(false);

  const ticketCardRef = useRef<HTMLDivElement>(null);
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [ticketResult, setTicketResult] = useState<{
    ticket_code: string;
    expires_at: string;
    valid_days: number;
  } | null>(null);

  if (!isOpen) return null;

  /* ── Open privacy modal + start countdown ────────────────────────────── */
  const openPrivacy = () => {
    setPrivacyOpen(true);
    if (!privacyRead) {
      // Start / restart the lock countdown
      setPrivacyLock(LOCK_SECONDS);
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setPrivacyLock((s) => {
          if (s <= 1) {
            clearInterval(countdownRef.current!);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
  };

  const closePrivacy = () => {
    setPrivacyOpen(false);
    setPrivacyRead(true);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  /* ── Submit ──────────────────────────────────────────────────────────── */
  const canConfirm = name.trim() && phone.trim() && email.trim() && privacyConsent && ticketConsent;

  const handleConfirm = async () => {
    setFormError("");
    if (!name.trim())  return setFormError("Please enter your full name.");
    if (!phone.trim()) return setFormError("Please enter a contact phone number.");
    if (!email.trim() || !email.includes("@"))
      return setFormError("Please enter a valid email address.");

    setLoading(true);
    setError("");
    try {
      const res = await createStoreTicket({
        total_price:    totalPrice,
        build_data:     buildData,
        customer_name:  name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim(),
      });
      setTicketResult({
        ticket_code: res.ticket_code,
        expires_at:  res.expires_at,
        valid_days:  res.valid_days,
      });
    } catch (err: any) {
      setError(err.message || "Failed to generate store ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Copy / PDF ──────────────────────────────────────────────────────── */
  const handleCopy = () => {
    if (!ticketResult) return;
    navigator.clipboard.writeText(ticketResult.ticket_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSavePDF = async () => {
    if (!ticketResult || !ticketCardRef.current) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF }   = await import("jspdf");
      const canvas = await html2canvas(ticketCardRef.current, {
        scale: 3, useCORS: true, backgroundColor: "#0f172a",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: "a5" });
      const pw  = pdf.internal.pageSize.getWidth();
      const ph  = pdf.internal.pageSize.getHeight();
      const m   = 24;
      const r   = Math.min((pw - m * 2) / canvas.width, (ph - m * 2) / canvas.height);
      const dw  = canvas.width  * r;
      const dh  = canvas.height * r;
      pdf.addImage(imgData, "PNG", (pw - dw) / 2, (ph - dh) / 2, dw, dh);
      pdf.save(`SmartBuild-Ticket-${ticketResult.ticket_code}.pdf`);
    } catch {
      setError("Could not save PDF. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const expiryFormatted = ticketResult
    ? new Date(ticketResult.expires_at).toLocaleDateString("en-PH", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "";

  return (
    <>
      {/* ── Main Modal ─────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 text-white shadow-2xl max-h-[90vh] flex flex-col">

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-5 top-5 z-10 rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white transition"
          >
            ✕
          </button>

          {/* ── FORM ─────────────────────────────────────────────────── */}
          {!ticketResult ? (
            <div className="flex flex-col gap-5 p-6 sm:p-8 overflow-y-auto">
              {/* Title */}
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-amber-300 font-semibold">
                  <span>In-Store Reservation Ticket</span>
                </div>
                <h2 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">
                  Get a Store Ticket
                </h2>
                <p className="mt-1.5 text-xs text-white/55 leading-relaxed">
                  We collect your contact details so our staff can reach you about your build
                  reservation, in accordance with{" "}
                  <span className="text-amber-300 font-medium">RA 10173</span>.
                </p>
              </div>

              {/* Price Preview */}
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs">
                <span className="text-white/60">Estimated Build Total:</span>
                <span className="font-heading text-lg font-bold text-amber-300">
                  {currencyFormatter.format(totalPrice)}
                </span>
              </div>

              {/* Contact fields */}
              <div className="flex flex-col gap-3">
                {[
                  { label: "Full Name",     id: "sb-name",  type: "text",  val: name,  set: setName,  ph: "Juan dela Cruz" },
                  { label: "Phone Number",  id: "sb-phone", type: "tel",   val: phone, set: setPhone, ph: "09XX-XXX-XXXX" },
                  { label: "Email Address", id: "sb-email", type: "email", val: email, set: setEmail, ph: "juandelacruz@email.com" },
                ].map(({ label, id, type, val, set, ph }) => (
                  <div key={id} className="flex flex-col gap-1">
                    <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                      {label} <span className="text-red-400">*</span>
                    </label>
                    <input
                      id={id}
                      type={type}
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      placeholder={ph}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-amber-400/60 transition"
                    />
                  </div>
                ))}
              </div>

              {/* Warning */}
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-[11px] text-amber-200">
                <div className="flex items-start gap-2.5">
                  <div className="w-full">
                    <p className="font-semibold text-amber-100 mb-1.5">Before you proceed:</p>
                    <ul className="space-y-1.5 leading-relaxed text-amber-200/85 list-disc list-inside">
                      <li>Your ticket is valid for <strong>30 days</strong> from generation.</li>
                      <li>
                        If you do not visit within 30 days, the ticket and your saved build
                        will be <strong>permanently deleted</strong>.
                      </li>
                      <li>Keep your ticket code safe — it&apos;s the only thing you need at the counter.</li>
                    </ul>
                    {/* Store address */}
                    <div className="mt-3 pt-3 border-t border-amber-400/20 flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-300 shrink-0 mt-0.5">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      <div>
                        <p className="font-semibold text-amber-100 text-[11px]">Visit us at Brandcom IT Computer Shop</p>
                        <p className="text-amber-200/75 mt-0.5">675 Rizal Avenue West, Tapinac, Olongapo, Philippines 2200</p>
                        <p className="text-amber-200/55 italic mt-0.5">Show your ticket code at the counter to reserve or have your build assembled.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Privacy link — single, clear */}
              <div className="flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-400/5 px-4 py-3 text-[11px]">
                <span className="text-white/55 flex-1">
                  Your data is handled under RA 10173 — Data Privacy Act of 2012.
                </span>
                <button
                  type="button"
                  onClick={openPrivacy}
                  className="shrink-0 text-amber-300 underline underline-offset-2 hover:text-amber-200 transition font-semibold text-[11px]"
                >
                  View Privacy Notice
                </button>
              </div>

              {/* Consent checkboxes */}
              <div className="flex flex-col gap-2.5">
                {/* Privacy checkbox — disabled until notice is read */}
                <label
                  className={`flex items-start gap-3 select-none ${privacyRead ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                >
                  <input
                    type="checkbox"
                    disabled={!privacyRead}
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border border-white/30 accent-amber-400 shrink-0"
                  />
                  <span className="text-[11px] text-white/65 leading-relaxed">
                    I have read and understood the Data Privacy Notice, and I consent to SmartBuild
                    collecting and processing my name, email address, and phone number for the purpose
                    of creating and managing my build ticket.
                    {!privacyRead && (
                      <span className="ml-1 text-amber-400/70 italic">
                        (Read the Privacy Notice first)
                      </span>
                    )}
                  </span>
                </label>

                {/* Ticket expiry checkbox — always available */}
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ticketConsent}
                    onChange={(e) => setTicketConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border border-white/30 accent-amber-400 cursor-pointer shrink-0"
                  />
                  <span className="text-[11px] text-white/60 leading-relaxed">
                    I understand that this ticket expires in{" "}
                    <strong className="text-white/80">30 days</strong> and will be permanently
                    deleted if not redeemed at the physical store.
                  </span>
                </label>
              </div>

              {(formError || error) && (
                <p className="text-xs text-red-400">
                  {formError || error}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading || !canConfirm}
                  onClick={handleConfirm}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-400/25 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  {loading ? "Generating…" : "Confirm & Get Ticket"}
                </button>
              </div>
            </div>

          ) : (
            /* ── RESULT ────────────────────────────────────────────────── */
            <div className="flex flex-col gap-6 text-center p-6 sm:p-8 overflow-y-auto">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 text-sm font-bold border border-emerald-400/30">
                  OK
                </div>
                <h2 className="mt-3 font-heading text-2xl font-bold text-white">
                  Store Ticket Generated!
                </h2>
                <p className="mt-1 text-xs text-white/60">
                  Present this code to our store counter technician.
                </p>
              </div>

              {/* Ticket Card */}
              <div
                ref={ticketCardRef}
                className="relative overflow-hidden rounded-2xl border-2 border-dashed border-amber-300/40 p-6 text-center"
                style={{ background: "linear-gradient(to bottom, rgba(251,191,36,0.12), #0f172a)" }}
              >
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200/70">
                    SmartBuild · In-Store Reservation
                  </span>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-200/60 block">
                  Official Reservation Code
                </span>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <span className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-amber-300">
                    {ticketResult.ticket_code}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="rounded-lg border border-amber-300/40 bg-amber-400/20 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/30 transition flex items-center gap-1"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="mt-4 border-t border-white/10 pt-4 text-xs text-left space-y-1.5">
                  {name && (
                    <div className="flex justify-between">
                      <span className="text-white/40">Name</span>
                      <span className="font-medium text-white">{name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-white/40">Build Total</span>
                    <span className="font-semibold text-white">{currencyFormatter.format(totalPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Valid Until</span>
                    <span className="font-semibold text-amber-200">{expiryFormatted}</span>
                  </div>
                </div>
                <p className="mt-4 text-[10px] text-white/30 leading-relaxed">
                  This ticket is valid for 30 days. Not redeemed within 30 days? It will be permanently removed.
                </p>
                {/* Store address — printed on ticket */}
                <div className="mt-4 pt-4 border-t border-white/10 flex items-start gap-2 text-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400/70 shrink-0 mt-0.5">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <div>
                    <p className="text-[10px] font-bold text-amber-200/80 tracking-wide">Brandcom IT Computer Shop</p>
                    <p className="text-[10px] text-white/45 mt-0.5">675 Rizal Avenue West, Tapinac, Olongapo, Philippines 2200</p>
                    <p className="text-[10px] text-white/35 italic mt-0.5">Present this ticket at the counter to reserve or have your build assembled within 30 days.</p>
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 text-center">
                  {error}
                </p>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSavePDF}
                  disabled={saving}
                  className="w-full sm:w-auto rounded-xl border border-amber-300/30 bg-amber-400/10 px-5 py-2.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <span className="animate-spin inline-block h-3 w-3 border-2 border-amber-300 border-t-transparent rounded-full" />
                      Saving…
                    </>
                  ) : "Save as PDF"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto rounded-xl bg-amber-300 px-6 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-200 transition"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Privacy Notice Sub-Modal ────────────────────────────────────────── */}
      {privacyOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-800 text-white shadow-2xl flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 pt-6 pb-4 shrink-0">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-blue-300 font-semibold mb-0.5">
                  <span>Data Privacy Notice</span>
                </div>
                <h3 className="font-heading text-lg font-bold">Republic Act No. 10173</h3>
                <p className="text-[11px] text-white/45 mt-0.5">Data Privacy Act of 2012</p>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 text-[12px] leading-relaxed text-white/70 space-y-5">
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">What We Collect</p>
                <ul className="list-disc list-inside space-y-1 text-white/65">
                  <li>Full name</li>
                  <li>Email address</li>
                  <li>Phone number</li>
                </ul>
              </section>

              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Why We Collect It</p>
                <p className="mb-2 text-white/65">Your information will be used solely to:</p>
                <ul className="list-disc list-inside space-y-1 text-white/65">
                  <li>Identify you and retrieve your build ticket when you visit our store</li>
                  <li>Notify you of changes to your build (e.g. a component going out of stock, availability of saved alternates)</li>
                  <li>Contact you regarding the status, readiness, or expiry of your reserved build</li>
                </ul>
                <p className="mt-3 italic text-white/45">
                  We will not use your information for marketing, promotional messages, or any purpose
                  outside of fulfilling this build ticket, unless you separately opt in.
                </p>
              </section>

              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">How Long We Keep It</p>
                <p className="text-white/65">
                  Your information will be retained only for as long as needed to fulfill your build
                  ticket, and will be deleted or anonymized within 30 days after your ticket is
                  completed, cancelled, or expires, unless a longer period is required by law.
                </p>
              </section>

              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Who Has Access</p>
                <p className="text-white/65">
                  Your information is accessible only to authorized staff of SmartBuild for the
                  purpose stated above. We do not sell or share your personal data with third parties.
                </p>
              </section>

              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Your Rights Under RA 10173</p>
                <ul className="list-disc list-inside space-y-1.5 text-white/65">
                  <li>Be informed of how your data is processed</li>
                  <li>Access your personal data that we hold</li>
                  <li>Request correction of inaccurate data</li>
                  <li>Request erasure or blocking of your data, subject to legal limits</li>
                  <li>Object to the processing of your data</li>
                  <li>Data portability</li>
                  <li>
                    File a complaint with the{" "}
                    <span className="text-amber-300 font-semibold">National Privacy Commission (NPC)</span>{" "}
                    if you believe your rights have been violated
                  </li>
                </ul>
              </section>

              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Contact Us</p>
                <p className="text-white/65">
                  For questions, access/correction requests, or to withdraw your consent, contact
                  us at the store counter or speak with our Data Privacy Officer.
                </p>
              </section>
            </div>

            {/* Footer — countdown lock */}
            <div className="border-t border-white/10 px-6 py-4 shrink-0 flex items-center justify-between gap-3">
              {privacyLock > 0 ? (
                <>
                  <p className="text-[11px] text-white/40 italic">
                    Please read the notice above…
                  </p>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-white/40 select-none">
                    <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-white/30 border-t-transparent rounded-full" />
                    <span>Okay ({privacyLock}s)</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-emerald-400/70 italic">
                    You may now accept below.
                  </p>
                  <button
                    type="button"
                    onClick={closePrivacy}
                    className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 px-8 py-2.5 text-sm font-bold text-slate-950 hover:brightness-110 transition shadow-lg shadow-amber-400/20"
                  >
                    Okay, I've read it
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
