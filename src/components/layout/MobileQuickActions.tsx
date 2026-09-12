"use client";

import { useState } from "react";
import { Link } from "react-router-dom";
import { Car, Map, Plus, Scale, X } from "lucide-react";

/**
 * Mobile floating action button — a speed-dial with the three highest-frequency
 * yard actions so operators don't dig through the drawer while walking the lot.
 * Hidden on xl+ where the full desktop nav is visible.
 */
export function MobileQuickActions() {
  const [open, setOpen] = useState(false);

  const actions = [
    {
      label: "New Intake",
      description: "Weigh in a seller",
      to: "/intake",
      icon: Scale,
      classes: "bg-emerald-600 text-white hover:bg-emerald-500",
    },
    {
      label: "Vehicle Inventory",
      description: "Browse the lot",
      to: "/inventory",
      icon: Car,
      classes: "bg-amber-600 text-white hover:bg-amber-500",
    },
    {
      label: "Yard Map",
      description: "Storage grid map",
      to: "/yard-map",
      icon: Map,
      classes: "bg-sky-600 text-white hover:bg-sky-500",
    },
  ];

  return (
    <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-3 xl:hidden">
      {/* Expanded action cards */}
      <div
        className={`flex flex-col items-end gap-2.5 transition-all duration-200 ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.to}
              to={action.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/95 py-2 pl-4 pr-2 shadow-xl backdrop-blur active:scale-[0.97] transition-transform"
            >
              <div>
                <p className="text-xs font-bold text-white">{action.label}</p>
                <p className="text-[10px] text-slate-400">{action.description}</p>
              </div>
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${action.classes}`}>
                <Icon className="h-5 w-5" />
              </span>
            </Link>
          );
        })}
      </div>

      {/* Backdrop to close on tap-outside */}
      {open && (
        <button
          aria-label="Close quick actions"
          className="fixed inset-0 z-[-1] bg-slate-950/40 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* FAB toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        aria-expanded={open}
        className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-2xl shadow-emerald-950/60 transition-all active:scale-90 ${
          open ? "bg-slate-700 hover:bg-slate-600 rotate-90" : "bg-emerald-600 hover:bg-emerald-500"
        }`}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" />}
      </button>
    </div>
  );
}
