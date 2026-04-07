// Timer.jsx
import { useState, useEffect } from "react";

function Timer({ time }) {
    const [remaining, setRemaining] = useState(time);

    useEffect(() => {
        (() => setRemaining(time))();
        const interval = setInterval(() => {
            setRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [time]);

    const pct = Math.round((remaining / time) * 100);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(9,21,26,0.85)", backdropFilter: "blur(8px)", fontFamily: "'Courier New', Courier, monospace" }}>
            <div className="flex flex-col items-center gap-6 p-10 rounded-3xl"
                style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(33,150,243,0.2)",
                    boxShadow: "0 0 60px rgba(33,150,243,0.1)"
                }}>

                {/* Circular timer */}
                <div className="relative w-28 h-28">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(33,150,243,0.1)" strokeWidth="6" />
                        <circle cx="50" cy="50" r="44" fill="none" stroke="#2196F3" strokeWidth="6"
                            strokeDasharray={`${2 * Math.PI * 44}`}
                            strokeDashoffset={`${2 * Math.PI * 44 * (1 - pct / 100)}`}
                            strokeLinecap="round"
                            style={{ transition: "stroke-dashoffset 1s linear" }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-white">{remaining}</span>
                        <span style={{ fontSize: "9px", letterSpacing: "2px", color: "rgba(255,255,255,0.4)" }}>SEC</span>
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-white font-semibold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        Awaiting Response
                    </p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                        Waiting for receiver to accept your request...
                    </p>
                </div>

                {/* Pulse indicator */}
                <div className="flex gap-1.5 items-center">
                    {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full" style={{
                            background: "#2196F3",
                            animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`
                        }} />
                    ))}
                </div>
            </div>
            <style>{`@keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>
        </div>
    );
}

export default Timer;
