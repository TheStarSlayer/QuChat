// ChatSessionStatus.jsx — displays key generation / session security status
function ChatSessionStatus({ message, chatEncryption }) {

    return (
        <div className="flex-1 flex flex-col items-center justify-center"
            style={{ fontFamily: "'Courier New', Courier, monospace" }}>

            {/* Animated quantum spinner */}
            <div className="relative w-24 h-24 mb-6">
                <svg className="w-full h-full animate-spin" style={{ animationDuration: "3s" }} viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(33,150,243,0.1)" strokeWidth="4" />
                    <circle cx="50" cy="50" r="44" fill="none" stroke="#2196F3" strokeWidth="4"
                        strokeDasharray="60 220" strokeLinecap="round" />
                </svg>
                <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: "2s", animationDirection: "reverse" }} viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(216,121,0,0.15)" strokeWidth="3" />
                    <circle cx="50" cy="50" r="32" fill="none" stroke="#D87900" strokeWidth="3"
                        strokeDasharray="40 161" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                        <circle cx="14" cy="14" r="13" stroke="#2196F3" strokeWidth="1.5" opacity="0.5" />
                        <circle cx="14" cy="14" r="3" fill="#2196F3" />
                    </svg>
                </div>
            </div>
            {chatEncryption === "none" ? (
            <>
                <h3 className="text-white font-semibold mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Starting session
                </h3>
                <p className="text-center max-w-xs" style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                    {message}
                </p>
            </>
            ) : (
            <>
                <h3 className="text-white font-semibold mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Securing Quantum Channel
                </h3>
                <p className="text-center max-w-xs" style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                    {message || "Initializing BB84 quantum key distribution protocol..."}
                </p>
            </>
            )}
            

            {/* Animated dots */}
            <div className="flex gap-1.5 mt-6">
                {[0, 1, 2, 3].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full" style={{
                        background: i % 2 === 0 ? "#2196F3" : "#D87900",
                        opacity: 0.6,
                        animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                    }} />
                ))}
            </div>
            <style>{`@keyframes bounce { 0%,100%{transform:translateY(0);opacity:0.3} 50%{transform:translateY(-6px);opacity:1} }`}</style>
        </div>
    );
}

export default ChatSessionStatus;
