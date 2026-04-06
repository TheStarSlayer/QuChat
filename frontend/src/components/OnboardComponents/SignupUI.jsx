import { useContext, useEffect, useRef } from "react";
import OnboardContext from "../../contexts/OnboardContext";
import WindowLoading from "../GeneralComponents/WindowLoading";

export default function SignupUI() {
    const {
        signup, username, setUsername,
        password, setPassword, checkPasswordLength,
        windowLoading, setIsLogin, showPasswordConstraints,
        showLengthConstraint, showSpCharConstraint, showAlpNumConstraint
    } = useContext(OnboardContext);

    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        let animFrame;

        const resize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        resize();
        window.addEventListener("resize", resize);

        const dots = Array.from({ length: 80 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.5 + 0.5,
            dx: (Math.random() - 0.5) * 0.3,
            dy: (Math.random() - 0.5) * 0.3,
            color: Math.random() > 0.6 ? "#2196F3" : "#D87900"
        }));

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            dots.forEach(d => {
                d.x += d.dx; d.y += d.dy;
                if (d.x < 0 || d.x > canvas.width) d.dx *= -1;
                if (d.y < 0 || d.y > canvas.height) d.dy *= -1;
                ctx.beginPath();
                ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
                ctx.fillStyle = d.color;
                ctx.globalAlpha = 0.5;
                ctx.fill();
                ctx.globalAlpha = 1;
            });
            dots.forEach((a, i) => {
                dots.slice(i + 1).forEach(b => {
                    const dist = Math.hypot(a.x - b.x, a.y - b.y);
                    if (dist < 100) {
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle = "#2196F3";
                        ctx.globalAlpha = (1 - dist / 100) * 0.15;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }
                });
            });
            animFrame = requestAnimationFrame(draw);
        };
        draw();

        return () => {
            cancelAnimationFrame(animFrame);
            window.removeEventListener("resize", resize);
        };
    }, []);

    const allGood = !showPasswordConstraints;

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden py-6"
            style={{ background: "#0d0f1a", fontFamily: "'Courier New', Courier, monospace" }}>

            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-sm mx-4 rounded-2xl px-8 py-9"
                style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(33,150,243,0.2)",
                    backdropFilter: "blur(12px)",
                    boxShadow: "0 0 40px rgba(33,150,243,0.08), inset 0 1px 0 rgba(255,255,255,0.06)"
                }}>

                {/* Logo */}
                <div className="flex flex-col items-center gap-2 mb-6">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(33,150,243,0.1)", border: "1px solid rgba(33,150,243,0.3)" }}>
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <circle cx="14" cy="14" r="13" stroke="#2196F3" strokeWidth="1.5" />
                            <circle cx="14" cy="14" r="7" stroke="#D87900" strokeWidth="1" strokeDasharray="2 2" />
                            <circle cx="14" cy="14" r="2.5" fill="#2196F3" />
                        </svg>
                    </div>
                    <div className="text-3xl font-bold tracking-tight leading-none">
                        <span style={{ color: "#2196F3" }}>Qu</span>
                        <span className="text-white">Chat</span>
                    </div>
                    <p style={{ fontSize: "9px", letterSpacing: "3px", color: "rgba(255,255,255,0.3)" }}>
                        ESTABLISH QUANTUM LINK
                    </p>
                </div>

                {/* Divider */}
                <div className="mb-6" style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(33,150,243,0.3), transparent)" }} />

                {/* Username */}
                <div className="mb-4">
                    <label className="block mb-1.5" style={{ fontSize: "9px", letterSpacing: "2px", color: "rgba(255,255,255,0.4)" }}>
                        IDENTITY NAME
                    </label>
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Choose a username"
                            spellCheck={false}
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-white outline-none transition-all"
                            style={{
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(33,150,243,0.2)",
                                fontFamily: "'Courier New', Courier, monospace",
                                fontSize: "13px"
                            }}
                            onFocus={e => e.target.style.borderColor = "rgba(33,150,243,0.6)"}
                            onBlur={e => e.target.style.borderColor = "rgba(33,150,243,0.2)"}
                        />
                    </div>
                </div>

                {/* Password */}
                <div className="mb-3">
                    <label className="block mb-1.5" style={{ fontSize: "9px", letterSpacing: "2px", color: "rgba(255,255,255,0.4)" }}>
                        ENCRYPTION KEY
                    </label>
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <input
                            type="password"
                            value={password}
                            onChange={e => { setPassword(e.target.value); checkPasswordLength(e.target.value); }}
                            placeholder="••••••••••••"
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-white outline-none transition-all"
                            style={{
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(33,150,243,0.2)",
                                fontFamily: "'Courier New', Courier, monospace",
                                fontSize: "13px"
                            }}
                            onFocus={e => e.target.style.borderColor = "rgba(33,150,243,0.6)"}
                            onBlur={e => e.target.style.borderColor = "rgba(33,150,243,0.2)"}
                        />
                    </div>
                </div>

                {/* Password constraints */}
                {showPasswordConstraints && (
                    <div className="rounded-lg px-3 py-2.5 mb-3"
                        style={{ background: "rgba(216,121,0,0.06)", border: "1px solid rgba(216,121,0,0.2)" }}>
                        <div className="mb-2" style={{ fontSize: "9px", letterSpacing: "2px", color: "rgba(216,121,0,0.6)" }}>
                            MISSING REQUIREMENTS
                        </div>
                        {showLengthConstraint && (
                            <div className="flex items-center gap-2 mb-1" style={{ fontSize: "11px", color: "rgba(255,100,100,0.9)" }}>
                                <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "rgba(255,100,100,0.8)" }} />
                                At least 6 characters
                            </div>
                        )}
                        {showAlpNumConstraint && (
                            <div className="flex items-center gap-2 mb-1" style={{ fontSize: "11px", color: "rgba(255,100,100,0.9)" }}>
                                <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "rgba(255,100,100,0.8)" }} />
                                Must contain letters and numbers
                            </div>
                        )}
                        {showSpCharConstraint && (
                            <div className="flex items-center gap-2" style={{ fontSize: "11px", color: "rgba(255,100,100,0.9)" }}>
                                <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "rgba(255,100,100,0.8)" }} />
                                Must contain special characters
                            </div>
                        )}
                    </div>
                )}

                {/* Sign up button */}
                <button
                    onClick={signup}
                    disabled={!allGood || windowLoading}
                    className="w-full py-3 rounded-lg font-bold text-white tracking-wide transition-all mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                        background: "linear-gradient(135deg, #2196F3, #1565C0)",
                        fontFamily: "'Courier New', Courier, monospace",
                        fontSize: "13px",
                        letterSpacing: "1px"
                    }}
                    onMouseEnter={e => { if (allGood && !windowLoading) e.currentTarget.style.background = "linear-gradient(135deg, #1976D2, #D87900)"; }}
                    onMouseLeave={e => e.currentTarget.style.background = "linear-gradient(135deg, #2196F3, #1565C0)"}
                >
                    {windowLoading ? "ESTABLISHING LINK..." : "Sign Up ⚡"}
                </button>

                {/* Login link */}
                <div className="flex justify-center items-center gap-1.5 mb-5">
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Already have an account?</span>
                    <button
                        onClick={() => setIsLogin(true)}
                        disabled={windowLoading}
                        className="font-bold transition-colors disabled:opacity-50"
                        style={{
                            background: "none", border: "none",
                            color: "#2196F3", fontSize: "12px",
                            fontFamily: "'Courier New', Courier, monospace",
                            cursor: "pointer", padding: 0
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = "#D87900"}
                        onMouseLeave={e => e.currentTarget.style.color = "#2196F3"}
                    >
                        Login
                    </button>
                </div>
            </div>

            {windowLoading && <WindowLoading message="Establishing quantum link..." />}
        </div>
    );
}
