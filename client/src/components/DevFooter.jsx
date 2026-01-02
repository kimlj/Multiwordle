import React, { useState, useEffect } from 'react';

export default function DevFooter({ compact = false }) {
  const [showDonation, setShowDonation] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [copiedGcash, setCopiedGcash] = useState(false);
  const [copiedSolana, setCopiedSolana] = useState(false);

  // Lock body scroll when donation modal is open
  useEffect(() => {
    if (showDonation) {
      setIsVisible(true);
      setIsClosing(false);
      document.body.classList.add('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showDonation]);

  const handleClose = () => {
    setIsClosing(true);
    document.body.classList.remove('modal-open');
    setTimeout(() => {
      setIsVisible(false);
      setShowDonation(false);
    }, 200);
  };

  const handleCopyGcash = () => {
    navigator.clipboard.writeText('09458870251');
    setCopiedGcash(true);
    setTimeout(() => setCopiedGcash(false), 2000);
  };

  const handleCopySolana = () => {
    navigator.clipboard.writeText('NickY5aHMs6PN8Ny1jTVgrwTJAS3a7dFiU2HgzDPLBz');
    setCopiedSolana(true);
    setTimeout(() => setCopiedSolana(false), 2000);
  };

  const CopyIcon = ({ copied }) => (
    <div className="relative w-4 h-4">
      <svg
        className={`w-4 h-4 absolute inset-0 transition-all duration-200 ${copied ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <svg
        className={`w-4 h-4 absolute inset-0 transition-all duration-200 ${copied ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );

  return (
    <>
      <div className={`${compact ? 'py-1' : 'absolute bottom-6'} flex flex-col items-center ${compact ? 'gap-1' : 'gap-3'}`}>
        {/* Social Links */}
        <div className={`flex items-center ${compact ? 'gap-2.5' : 'gap-4'}`}>
          <a
            href="https://www.instagram.com/itskimlj/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/40 hover:text-pink-400 transition-colors"
            title="Instagram"
          >
            <svg className={compact ? 'w-4 h-4' : 'w-5 h-5'} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </a>
          <a
            href="https://www.facebook.com/KimJulongbayan/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/40 hover:text-blue-400 transition-colors"
            title="Facebook"
          >
            <svg className={compact ? 'w-4 h-4' : 'w-5 h-5'} fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>
          <button
            onClick={() => setShowDonation(true)}
            className="text-white/40 hover:text-yellow-400 transition-colors"
            title="Buy me a coffee"
          >
            <svg className={compact ? 'w-4 h-4' : 'w-5 h-5'} fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.5 3H6c-1.1 0-2 .9-2 2v5.71c0 3.83 2.95 7.18 6.78 7.29 3.96.12 7.22-3.06 7.22-7v-1h.5c1.93 0 3.5-1.57 3.5-3.5S20.43 3 18.5 3zM16 5v3h2.5c.83 0 1.5.67 1.5 1.5S19.33 11 18.5 11H16v-1c0-1.1-.9-2-2-2H6V5h10zM2 21h18v2H2z"/>
            </svg>
          </button>
        </div>

        {/* Credit */}
        <p className={`text-white/30 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          Made with <span className="text-red-400">♥</span> by <span className="text-white/50">king</span>
        </p>
      </div>

      {/* Donation Modal */}
      {(showDonation || isVisible) && (
        <div
          className={`fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
            isClosing ? 'opacity-0' : 'opacity-100'
          }`}
          onClick={handleClose}
        >
          <div
            className={`glass rounded-2xl p-6 w-full max-w-sm transition-all duration-200 ${
              isClosing ? 'opacity-0 translate-y-4' : 'animate-slide-up'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">☕</div>
              <h3 className="font-display text-xl font-bold">Buy Me a Coffee</h3>
              <p className="text-white/50 text-sm mt-1">Support the development!</p>
            </div>

            {/* GCash */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-400 font-bold text-sm">GCash</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-lg tracking-wider">09458870251</span>
                <button
                  onClick={handleCopyGcash}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    copiedGcash
                      ? 'text-emerald-400'
                      : 'bg-white/10 hover:bg-white/20 text-white/50'
                  }`}
                  title={copiedGcash ? 'Copied!' : 'Copy'}
                >
                  <CopyIcon copied={copiedGcash} />
                </button>
              </div>
              <p className="text-white/40 text-xs mt-2">Kim Julongbayan</p>
            </div>

            {/* Solana */}
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-400 font-bold text-sm">Solana (SOL)</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs break-all leading-relaxed">NickY5aHMs6PN8Ny1jTVgrwTJAS3a7dFiU2HgzDPLBz</span>
                <button
                  onClick={handleCopySolana}
                  className={`p-2 rounded-lg transition-all duration-200 shrink-0 ${
                    copiedSolana
                      ? 'text-emerald-400'
                      : 'bg-white/10 hover:bg-white/20 text-white/50'
                  }`}
                  title={copiedSolana ? 'Copied!' : 'Copy'}
                >
                  <CopyIcon copied={copiedSolana} />
                </button>
              </div>
            </div>

            {/* Social links in modal */}
            <div className="text-center text-white/50 text-sm mb-4">
              Or follow me on socials:
            </div>
            <div className="flex justify-center gap-6 mb-4">
              <a
                href="https://www.instagram.com/itskimlj/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-white/60 hover:text-pink-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                <span className="text-sm">Instagram</span>
              </a>
              <a
                href="https://www.facebook.com/KimJulongbayan/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-white/60 hover:text-blue-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span className="text-sm">Facebook</span>
              </a>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
