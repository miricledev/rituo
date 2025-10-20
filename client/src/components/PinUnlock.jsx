import React, { useState, useEffect } from 'react';

const PinUnlock = ({ onUnlock, title = "Enter PIN" }) => {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const CORRECT_PIN = '302185';

  useEffect(() => {
    if (pin.length === 6) {
      if (pin === CORRECT_PIN) {
        onUnlock();
      } else {
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin('');
        }, 500);
      }
    }
  }, [pin, onUnlock]);

  const handleNumberClick = (num) => {
    if (pin.length < 6) {
      setPin(pin + num);
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="w-full max-w-md px-6">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-white mb-2">{title}</h1>
          <p className="text-gray-400 text-sm">Admin Access Required</p>
        </div>

        {/* PIN Display */}
        <div className={`flex justify-center gap-3 mb-12 ${shake ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                index < pin.length
                  ? 'bg-white scale-110'
                  : 'bg-gray-600 border-2 border-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num.toString())}
              className="aspect-square rounded-full bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white text-2xl font-light transition-all duration-150 flex items-center justify-center border border-gray-700 hover:border-gray-600"
            >
              {num}
            </button>
          ))}
        </div>

        {/* Bottom Row: 0 and Delete */}
        <div className="grid grid-cols-3 gap-4">
          <div /> {/* Empty space */}
          <button
            onClick={() => handleNumberClick('0')}
            className="aspect-square rounded-full bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white text-2xl font-light transition-all duration-150 flex items-center justify-center border border-gray-700 hover:border-gray-600"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            disabled={pin.length === 0}
            className="aspect-square rounded-full bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white text-lg transition-all duration-150 flex items-center justify-center border border-gray-700 hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
            </svg>
          </button>
        </div>

        {/* Error hint */}
        {shake && (
          <div className="text-center mt-6">
            <p className="text-red-400 text-sm">Incorrect PIN</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.5s;
        }
      `}</style>
    </div>
  );
};

export default PinUnlock;

