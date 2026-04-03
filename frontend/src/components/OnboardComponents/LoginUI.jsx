import { useContext, useEffect, useRef } from "react";
import OnboardContext from "../../contexts/OnboardContext";
import WindowLoading from "../GeneralComponents/WindowLoading";

export default function LoginUI() {
    const {
        login, username, setUsername,
        password, setPassword,
        setIsLogin, windowLoading
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
                d.x += d.dx;
                d.y += d.dy;
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

    const handleKey = (e) => {
        if (e.key === "Enter") login();
    };

    return (
        <>
            <style>{`
                .qc-root { background: #0d0f1a; font-family: 'Courier New', Courier, monospace; }
                .qc-canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
                .qc-card {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(33,150,243,0.2) !important;
                    border-radius: 16px !important;
                    backdrop-filter: blur(12px);
                    box-shadow: 0 0 40px rgba(33,150,243,0.08), inset 0 1px 0 rgba(255,255,255,0.06);
                    max-width: 380px;
                }
                .qc-logo-icon {
                    width: 56px; height: 56px; border-radius: 50%;
                    background: rgba(33,150,243,0.1);
                    border: 1px solid rgba(33,150,243,0.3);
                }
                .qc-logo-qu { color: #2196F3; font-size: 28px; font-weight: 700; }
                .qc-logo-chat { color: #fff; font-size: 28px; font-weight: 700; }
                .qc-tagline { font-size: 9px; letter-spacing: 3px; color: rgba(255,255,255,0.3); }
                .qc-divider {
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(33,150,243,0.3), transparent);
                }
                .qc-label { font-size: 9px; letter-spacing: 2px; color: rgba(255,255,255,0.4); }
                .qc-input-wrap { position: relative; }
                .qc-input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; }
                .qc-input {
                    width: 100%; padding: 10px 12px 10px 34px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(33,150,243,0.2);
                    border-radius: 8px; color: #fff;
                    font-size: 13px; font-family: 'Courier New', Courier, monospace;
                    outline: none; box-sizing: border-box; transition: border-color 0.2s;
                }
                .qc-input:focus { border-color: rgba(33,150,243,0.6); background: rgba(255,255,255,0.07); }
                .qc-input::placeholder { color: rgba(255,255,255,0.25); }
                .qc-security {
                    background: rgba(216,121,0,0.08);
                    border: 1px solid rgba(216,121,0,0.2);
                    border-radius: 8px;
                    font-size: 11px; color: rgba(216,121,0,0.9);
                    line-height: 1.4;
                }
                .qc-btn-primary {
                    background: linear-gradient(135deg, #2196F3, #1565C0);
                    border: none; border-radius: 8px;
                    color: #fff; font-size: 13px; font-weight: 700;
                    letter-spacing: 1px; font-family: 'Courier New', Courier, monospace;
                    transition: background 0.3s; cursor: pointer;
                }
                .qc-btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #1976D2, #D87900); }
                .qc-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
                .qc-separator-line { flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
                .qc-separator-text { font-size: 9px; letter-spacing: 1.5px; color: rgba(255,255,255,0.25); white-space: nowrap; }
                .qc-btn-secondary {
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.15);
                    border-radius: 8px; color: rgba(255,255,255,0.6);
                    font-size: 13px; font-family: 'Courier New', Courier, monospace;
                    transition: border-color 0.2s, color 0.2s; cursor: pointer;
                }
                .qc-btn-secondary:hover:not(:disabled) { border-color: #2196F3; color: #2196F3; }
                .qc-btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
                .qc-footer-link { font-size: 10px; letter-spacing: 1px; color: rgba(255,255,255,0.2); cursor: pointer; }
                .qc-footer-dot { color: rgba(255,255,255,0.15); font-size: 10px; }
            `}</style>

            <div className="qc-root min-vh-100 w-100 d-flex align-items-center justify-content-center position-relative overflow-hidden">
                <canvas ref={canvasRef} className="qc-canvas" />

                <div className="qc-card w-100 p-4 p-md-5 mx-3 position-relative" style={{ zIndex: 10 }}>

                    {/* Logo */}
                    <div className="d-flex flex-column align-items-center gap-2 mb-4">
                        <div className="qc-logo-icon d-flex align-items-center justify-content-center">
                            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                <circle cx="14" cy="14" r="13" stroke="#2196F3" strokeWidth="1.5" />
                                <circle cx="14" cy="14" r="7" stroke="#D87900" strokeWidth="1" strokeDasharray="2 2" />
                                <circle cx="14" cy="14" r="2.5" fill="#2196F3" />
                            </svg>
                        </div>
                        <div>
                            <span className="qc-logo-qu">Qu</span>
                            <span className="qc-logo-chat">Chat</span>
                        </div>
                        <p className="qc-tagline mb-0">QUANTUM-ENCRYPTED ACCESS</p>
                    </div>

                    <div className="qc-divider mb-4" />

                    {/* Username */}
                    <div className="mb-3">
                        <label className="qc-label d-block mb-1">IDENTITY HANDLE</label>
                        <div className="qc-input-wrap">
                            <svg className="qc-input-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            <input
                                type="text"
                                className="qc-input"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                onKeyDown={handleKey}
                                placeholder="quantum_user_01"
                                spellCheck={false}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="mb-3">
                        <label className="qc-label d-block mb-1">ACCESS KEY</label>
                        <div className="qc-input-wrap">
                            <svg className="qc-input-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <input
                                type="password"
                                className="qc-input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={handleKey}
                                placeholder="••••••••••••"
                            />
                        </div>
                    </div>

                    {/* Security badge */}
                    <div className="qc-security d-flex align-items-start gap-2 p-2 mb-4">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D87900" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span>Quantum-resistant end-to-end encryption active for this session.</span>
                    </div>

                    {/* Primary button */}
                    <button
                        className="qc-btn-primary w-100 py-2 mb-4"
                        onClick={login}
                        disabled={windowLoading}
                    >
                        {windowLoading ? "INITIALIZING..." : "Initialize Session"}
                    </button>

                    {/* Separator */}
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <div className="qc-separator-line" />
                        <span className="qc-separator-text">NEW TO THE SANCTUARY?</span>
                        <div className="qc-separator-line" />
                    </div>

                    {/* Secondary button */}
                    <button
                        className="qc-btn-secondary w-100 py-2 mb-4"
                        onClick={() => setIsLogin(false)}
                        disabled={windowLoading}
                    >
                        Create New Identity
                    </button>

                    {/* Footer */}
                    <div className="d-flex justify-content-center align-items-center gap-2">
                        <span className="qc-footer-link">Terms of Void</span>
                        <span className="qc-footer-dot">·</span>
                        <span className="qc-footer-link">Privacy Protocol</span>
                        <span className="qc-footer-dot">·</span>
                        <span className="qc-footer-link">Nodes</span>
                    </div>

                </div>
            </div>

            {windowLoading && <WindowLoading message="Initializing quantum session..." />}
        </>
    );
}
