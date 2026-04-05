// ExitPageWarning.jsx
function ExitPageWarning() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(9,21,26,0.95)", backdropFilter: "blur(12px)", fontFamily: "'Courier New', Courier, monospace" }}>
            <div className="w-full max-w-md mx-4 rounded-2xl p-8 text-center"
                style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,60,60,0.2)",
                    boxShadow: "0 0 60px rgba(255,60,60,0.08)"
                }}>

                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.3)" }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                </div>

                <h2 className="text-xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#ff6b6b" }}>
                    Session Already Active
                </h2>
                <p className="mb-2" style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                    You are already logged in on another device or tab.
                </p>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
                    Please logout from the original session or close the other tab before continuing.
                </p>

                <div className="mt-6 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#ff6b6b", animation: "pulse 1.5s ease-in-out infinite" }} />
                    <span style={{ fontSize: "10px", letterSpacing: "2px", color: "rgba(255,107,107,0.6)" }}>ACCESS BLOCKED</span>
                </div>
            </div>
            <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }`}</style>
        </div>
    );
}

export default ExitPageWarning;
