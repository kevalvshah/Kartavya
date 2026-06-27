import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface MobileSidebarProps {
  children: React.ReactNode;
}

export function MobileSidebar({ children }: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // Close sidebar when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [router.pathname]);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isOpen && !target.closest('.mobile-sidebar') && !target.closest('.mobile-sidebar-toggle')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <>
      {/* Mobile Header with Hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-30 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="mobile-sidebar-toggle p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <div className="text-xl font-bold text-indigo-600">Kartavaya</div>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`mobile-sidebar fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile: Header inside sidebar */}
        <div className="lg:hidden p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold text-indigo-600">Kartavaya</div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="overflow-y-auto h-full pb-20">
          {children}
        </div>
      </div>

      {/* Mobile: Add top padding to main content */}
      <style jsx global>{`
        @media (max-width: 1024px) {
          .main-content {
            padding-top: 4rem;
          }
        }
      `}</style>
    </>
  );
}

// Navigation Link Component
interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

export function NavLink({ href, icon, label, active }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? 'bg-indigo-50 text-indigo-600 border-r-2 border-indigo-600'
          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <span className={`w-5 h-5 ${active ? 'text-indigo-600' : 'text-gray-500'}`}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

// Section Header Component
export function NavSection({ title }: { title: string }) {
  return (
    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {title}
    </div>
  );
}
