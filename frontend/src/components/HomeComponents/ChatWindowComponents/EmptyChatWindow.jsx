import { useContext } from "react";
import HomeContext from "../../../contexts/HomeContext";

function EmptyChatWindow() {
    const { setShowRequestsToMe, setShowEavesdroppableRequests, setShowNewRequest } = useContext(HomeContext);

    function cbRequestsToMe() {
        setShowEavesdroppableRequests(false);
        setShowNewRequest("");
        setShowRequestsToMe(true);
    }

    function cbEavesdroppableRequests() {
        setShowRequestsToMe(false);
        setShowNewRequest("");
        setShowEavesdroppableRequests(true);
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden"
            style={{ background: "#09151a", fontFamily: "'Courier New', Courier, monospace" }}>

            {/* Ambient glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-96 h-96 rounded-full" style={{ background: "rgba(33,150,243,0.04)", filter: "blur(80px)" }} />
            </div>

            {/* Dot grid background */}
            <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, rgba(33,150,243,0.06) 1px, transparent 0)",
                backgroundSize: "24px 24px"
            }} />

            <div className="relative z-10 flex flex-col items-center text-center px-8">

                {/* Logo mark */}
                <div className="mb-8 relative">
                    <div className="w-32 h-32 rounded-3xl flex items-center justify-center transition-all duration-700 hover:rotate-0"
                        style={{
                            background: "rgba(9,21,26,0.9)",
                            border: "2px solid rgba(33,150,243,0.25)",
                            boxShadow: "0 0 40px rgba(33,150,243,0.15)",
                            transform: "rotate(45deg)"
                        }}>
                        <div style={{ transform: "rotate(-45deg)" }}>
                            <svg width="52" height="52" viewBox="0 0 28 28" fill="none">
                                <circle cx="14" cy="14" r="13" stroke="#2196F3" strokeWidth="1" opacity="0.6" />
                                <circle cx="14" cy="14" r="8" stroke="#D87900" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" />
                                <circle cx="14" cy="14" r="3" fill="#2196F3" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-5xl font-black tracking-tighter mb-2 leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <span className="text-white">QU</span>
                    <span style={{ color: "#2196F3" }}>CHAT</span>
                </h1>
                <p className="mb-10" style={{ fontSize: "10px", letterSpacing: "3px", color: "rgba(255,255,255,0.25)" }}>
                    QUANTUM-SECURED COMMUNICATION
                </p>

                {/* Action buttons */}
                <div className="flex gap-4 w-full max-w-sm">

                    {/* MyRequests */}
                    <button
                        onClick={cbRequestsToMe}
                        className="flex-1 flex items-center justify-center gap-2 py-5 rounded-2xl font-bold text-white transition-all hover:scale-105 active:scale-95"
                        style={{
                            background: "linear-gradient(135deg, #2196F3, #1565C0)",
                            boxShadow: "0 0 24px rgba(33,150,243,0.3)",
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontSize: "15px"
                        }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 36px rgba(33,150,243,0.5)"}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = "0 0 24px rgba(33,150,243,0.3)"}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        MyRequests
                    </button>

                    {/* Eavesdrop */}
                    <button
                        onClick={cbEavesdroppableRequests}
                        className="flex-1 flex items-center justify-center gap-2 py-5 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95"
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(33,150,243,0.25)",
                            color: "#2196F3",
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontSize: "15px"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(33,150,243,0.08)"; e.currentTarget.style.borderColor = "rgba(33,150,243,0.5)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(33,150,243,0.25)"; }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                        Eavesdrop
                    </button>
                </div>
            </div>
        </div>
    );
}

export default EmptyChatWindow;
