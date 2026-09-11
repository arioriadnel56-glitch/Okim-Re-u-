import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { HomeIcon, ReceiptIcon, CalendarIcon, BuildingIcon, UsersIcon, PackageIcon } from './icons.jsx';

const NAV_BY_ROLE = {
  super_admin: [
    { to: '/', label: 'Vue d\u2019ensemble', shortLabel: 'Accueil', end: true, Icon: HomeIcon },
    { to: '/receipts', label: 'Reçus', shortLabel: 'Reçus', Icon: ReceiptIcon },
    { to: '/sessions', label: 'Séances', shortLabel: 'Séances', Icon: CalendarIcon },
    { to: '/sites', label: 'Succursales', shortLabel: 'Studios', Icon: BuildingIcon },
    { to: '/staff', label: 'Personnel', shortLabel: 'Personnel', Icon: UsersIcon },
  ],
  staff: [
    { to: '/', label: 'Tableau de bord', shortLabel: 'Accueil', end: true, Icon: HomeIcon },
    { to: '/receipts', label: 'Reçus', shortLabel: 'Reçus', Icon: ReceiptIcon },
    { to: '/sessions', label: 'Séances', shortLabel: 'Séances', Icon: CalendarIcon },
  ],
  client: [
    { to: '/', label: 'Mes livraisons', shortLabel: 'Livraisons', end: true, Icon: PackageIcon },
  ],
};

function initials(name) {
  return (name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV_BY_ROLE[user?.role] || [];
  const [accountOpen, setAccountOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/connexion');
  }

  const roleLabel =
    user?.role === 'super_admin' ? 'Administrateur général' : user?.role === 'staff' ? 'Personnel du studio' : 'Client';

  return (
    <div className="min-h-screen md:flex">
      {/* Mobile top bar: branding + account access */}
      <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-navy-dark text-white px-4 py-3">
        <img src="/icons/icon-192.png" alt="OKIM'ART" className="w-8 h-8 rounded-full object-cover" />
        <p className="font-display text-base text-gold">OKIM'ART</p>
        <div className="ml-auto relative">
          <button
            onClick={() => setAccountOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-white/10 text-gold text-xs font-semibold flex items-center justify-center"
            aria-label="Compte"
          >
            {initials(user?.nom)}
          </button>
          {accountOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setAccountOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 top-11 z-40 w-56 rounded-lg bg-white text-navy-dark shadow-lg border border-stone-200 py-3 px-4">
                <p className="text-sm font-medium truncate">{user?.nom}</p>
                <p className="text-xs text-stone-400 mb-3">{roleLabel}</p>
                <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">
                  Se déconnecter
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Desktop lateral sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-navy-dark text-white flex-col">
        <div className="px-6 py-6 border-b border-white/10 flex items-center gap-3">
          <img src="/icons/icon-192.png" alt="OKIM'ART" className="w-10 h-10 rounded-full object-cover shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight text-gold truncate">OKIM'ART</p>
            <p className="text-[11px] uppercase tracking-wide text-white/50">Gestion & livraison</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-4 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-white/10 text-gold border-l-2 border-gold' : 'text-white/75 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.Icon />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-sm font-medium truncate">{user?.nom}</p>
          <p className="text-xs text-white/50 mb-3">{roleLabel}</p>
          <button onClick={handleLogout} className="text-xs text-white/60 hover:text-gold transition-colors">
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-8 sm:py-8 pb-24 md:pb-8">{children}</div>
      </main>

      {/* Mobile bottom tab bar, TikTok-style */}
      {items.length > 1 && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-navy-dark border-t border-white/10 flex items-stretch safe-bottom">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] ${
                  isActive ? 'text-gold' : 'text-white/60'
                }`
              }
            >
              <item.Icon />
              <span>{item.shortLabel}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
