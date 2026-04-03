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
        <div style={styles.root}>
            <canvas ref={canvasRef} style={styles.canvas} />

            <div style={styles.card}>
                <div style={styles.logoWrap}>
                    <div style={styles.logoIcon}>
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <circle cx="14" cy="14" r="13" stroke="#2196F3" strokeWidth="1.5" />
                            <circle cx="14" cy="14" r="7" stroke="#D87900" strokeWidth="1" strokeDasharray="2 2" />
                            <circle cx="14" cy="14" r="2.5" fill="#2196F3" />
                        </svg>
                    </div>
                    <div style={styles.logoText}>
                        <span style={styles.logoQu}>Qu</span>
                        <span style={styles.logoChat}>Chat</span>
                    </div>
                    <p style={styles.tagline}>QUANTUM-ENCRYPTED ACCESS</p>
                </div>

                <div style={styles.divider} />

                <div style={styles.field}>
                    <label style={styles.label}>IDENTITY HANDLE</label>
                    <div style={styles.inputWrap}>
                        <svg style={styles.inputIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            onKeyDown={handleKey}
                            placeholder="quantum_user_01"
                            style={styles.input}
                            spellCheck={false}
                        />
                    </div>
                </div>

                <div style={styles.field}>
                    <label style={styles.label}>ACCESS KEY</label>
                    <div style={styles.inputWrap}>
                        <svg style={styles.inputIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={handleKey}
                            placeholder="••••••••••••"
                            style={styles.input}
                        />
                    </div>
                </div>

                <div style={styles.securityBadge}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D87900" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span style={styles.securityText}>Quantum-resistant end-to-end encryption active for this session.</span>
                </div>

                <button
                    onClick={login}
                    disabled={windowLoading}
                    style={styles.primaryBtn}
                    onMouseEnter={e => e.target.style.background = "linear-gradient(135deg, #1976D2, #D87900)"}
                    onMouseLeave={e => e.target.style.background = "linear-gradient(135deg, #2196F3, #1565C0)"}
                >
                    {windowLoading ? "INITIALIZING..." : "Initialize Session"}
                </button>

                <div style={styles.separatorRow}>
                    <div style={styles.separatorLine} />
                    <span style={styles.separatorText}>NEW TO THE SANCTUARY?</span>
                    <div style={styles.separatorLine} />
                </div>

                <button
                    onClick={() => setIsLogin(false)}
                    disabled={windowLoading}
                    style={styles.secondaryBtn}
                    onMouseEnter={e => { e.target.style.borderColor = "#2196F3"; e.target.style.color = "#2196F3"; }}
                    onMouseLeave={e => { e.target.style.borderColor = "rgba(255,255,255,0.15)"; e.target.style.color = "rgba(255,255,255,0.6)"; }}
                >
                    Create New Identity
                </button>

                <div style={styles.footer}>
                    <span style={styles.footerLink}>Terms of Void</span>
                    <span style={styles.footerDot}>·</span>
                    <span style={styles.footerLink}>Privacy Protocol</span>
                    <span style={styles.footerDot}>·</span>
                    <span style={styles.footerLink}>Nodes</span>
                </div>
            </div>

            {windowLoading && <WindowLoading message="Initializing quantum session..." />}
        </div>
    );
}

const styles = {
    root: {
        minHeight: "100vh",
        width: "100%",
        background: "#0d0f1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Courier New', Courier, monospace",
    },
    canvas: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
    },
    card: {
        position: "relative",
        zIndex: 10,
        width: "100%",
        maxWidth: 380,
        margin: "0 16px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(33,150,243,0.2)",
        borderRadius: 16,
        padding: "36px 32px 28px",
        backdropFilter: "blur(12px)",
        boxShadow: "0 0 40px rgba(33,150,243,0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
    },
    logoWrap: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        marginBottom: 24,
    },
    logoIcon: {
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "rgba(33,150,243,0.1)",
        border: "1px solid rgba(33,150,243,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    logoText: {
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: "-0.5px",
        lineHeight: 1,
    },
    logoQu: {
        color: "#2196F3",
    },
    logoChat: {
        color: "#ffffff",
    },
    tagline: {
        fontSize: 9,
        letterSpacing: 3,
        color: "rgba(255,255,255,0.3)",
        margin: 0,
    },
    divider: {
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(33,150,243,0.3), transparent)",
        marginBottom: 24,
    },
    field: {
        marginBottom: 16,
    },
    label: {
        display: "block",
        fontSize: 9,
        letterSpacing: 2,
        color: "rgba(255,255,255,0.4)",
        marginBottom: 6,
    },
    inputWrap: {
        position: "relative",
        display: "flex",
        alignItems: "center",
    },
    inputIcon: {
        position: "absolute",
        left: 12,
        pointerEvents: "none",
    },
    input: {
        width: "100%",
        padding: "10px 12px 10px 34px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(33,150,243,0.2)",
        borderRadius: 8,
        color: "#ffffff",
        fontSize: 13,
        fontFamily: "'Courier New', Courier, monospace",
        outline: "none",
        boxSizing: "border-box",
        transition: "border-color 0.2s",
    },
    securityBadge: {
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        background: "rgba(216,121,0,0.08)",
        border: "1px solid rgba(216,121,0,0.2)",
        borderRadius: 8,
        padding: "8px 12px",
        marginBottom: 20,
        marginTop: 4,
    },
    securityText: {
        fontSize: 11,
        color: "rgba(216,121,0,0.9)",
        lineHeight: 1.4,
        fontFamily: "'Courier New', Courier, monospace",
    },
    primaryBtn: {
        width: "100%",
        padding: "12px",
        background: "linear-gradient(135deg, #2196F3, #1565C0)",
        border: "none",
        borderRadius: 8,
        color: "#ffffff",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 1,
        cursor: "pointer",
        transition: "background 0.3s",
        marginBottom: 20,
        fontFamily: "'Courier New', Courier, monospace",
    },
    separatorRow: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        background: "rgba(255,255,255,0.08)",
    },
    separatorText: {
        fontSize: 9,
        letterSpacing: 1.5,
        color: "rgba(255,255,255,0.25)",
        whiteSpace: "nowrap",
    },
    secondaryBtn: {
        width: "100%",
        padding: "11px",
        background: "transparent",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 8,
        color: "rgba(255,255,255,0.6)",
        fontSize: 13,
        cursor: "pointer",
        transition: "border-color 0.2s, color 0.2s",
        marginBottom: 24,
        fontFamily: "'Courier New', Courier, monospace",
    },
    footer: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
    },
    footerLink: {
        fontSize: 10,
        letterSpacing: 1,
        color: "rgba(255,255,255,0.2)",
        cursor: "pointer",
    },
    footerDot: {
        color: "rgba(255,255,255,0.15)",
        fontSize: 10,
    },
};
