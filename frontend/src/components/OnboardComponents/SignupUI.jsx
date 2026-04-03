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

    const allGood = !showPasswordConstraints;

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
                    <p style={styles.tagline}>ESTABLISH QUANTUM LINK</p>
                </div>

                <div style={styles.divider} />

                <div style={styles.field}>
                    <label style={styles.label}>IDENTITY NAME</label>
                    <div style={styles.inputWrap}>
                        <svg style={styles.inputIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Choose a username"
                            style={styles.input}
                            spellCheck={false}
                        />
                    </div>
                </div>

                <div style={styles.field}>
                    <label style={styles.label}>ENCRYPTION KEY</label>
                    <div style={styles.inputWrap}>
                        <svg style={styles.inputIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <input
                            type="password"
                            value={password}
                            onChange={e => { setPassword(e.target.value); checkPasswordLength(); }}
                            placeholder="••••••••••••"
                            style={styles.input}
                        />
                    </div>
                </div>

                {showPasswordConstraints && (
                    <div style={styles.constraintBox}>
                        <div style={styles.constraintTitle}>MISSING REQUIREMENTS</div>
                        {showLengthConstraint && (
                            <div style={styles.constraintItem}>
                                <span style={styles.dot} />
                                At least 6 characters
                            </div>
                        )}
                        {showAlpNumConstraint && (
                            <div style={styles.constraintItem}>
                                <span style={styles.dot} />
                                Must contain letters and numbers
                            </div>
                        )}
                        {showSpCharConstraint && (
                            <div style={styles.constraintItem}>
                                <span style={styles.dot} />
                                Must contain special characters
                            </div>
                        )}
                    </div>
                )}

                <div style={styles.securityBadge}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D87900" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span style={styles.securityText}>Your data will be shielded by end-to-end lattice-based encryption protocols immediately upon registration.</span>
                </div>

                <button
                    onClick={signup}
                    disabled={!allGood || windowLoading}
                    style={{
                        ...styles.primaryBtn,
                        opacity: (!allGood || windowLoading) ? 0.5 : 1,
                        cursor: (!allGood || windowLoading) ? "not-allowed" : "pointer",
                    }}
                    onMouseEnter={e => { if (allGood && !windowLoading) e.target.style.background = "linear-gradient(135deg, #1976D2, #D87900)"; }}
                    onMouseLeave={e => { e.target.style.background = "linear-gradient(135deg, #2196F3, #1565C0)"; }}
                >
                    {windowLoading ? "ESTABLISHING LINK..." : "Sign Up ⚡"}
                </button>

                <div style={styles.loginRow}>
                    <span style={styles.loginText}>Already have an account?</span>
                    <button
                        onClick={() => setIsLogin(true)}
                        disabled={windowLoading}
                        style={styles.loginLink}
                        onMouseEnter={e => e.target.style.color = "#D87900"}
                        onMouseLeave={e => e.target.style.color = "#2196F3"}
                    >
                        Login
                    </button>
                </div>

                <div style={styles.footer}>
                    <span style={styles.footerLink}>Terms of Service</span>
                    <span style={styles.footerDot}>·</span>
                    <span style={styles.footerLink}>Privacy Shield</span>
                </div>

                <div style={styles.statusRow}>
                    <div style={styles.statusBadge}>
                        <span style={styles.statusDot} />
                        QUANTUM READY
                    </div>
                    <div style={styles.statusBadge}>
                        <span style={{ ...styles.statusDot, background: "#D87900" }} />
                        ENCRYPTED NODE
                    </div>
                </div>
            </div>

            {windowLoading && <WindowLoading message="Establishing quantum link..." />}
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
        maxWidth: 420,
        margin: "24px 16px",
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
    logoQu: { color: "#2196F3" },
    logoChat: { color: "#ffffff" },
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
    field: { marginBottom: 16 },
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
    constraintBox: {
        background: "rgba(216,121,0,0.06)",
        border: "1px solid rgba(216,121,0,0.2)",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 12,
    },
    constraintTitle: {
        fontSize: 9,
        letterSpacing: 2,
        color: "rgba(216,121,0,0.6)",
        marginBottom: 8,
    },
    constraintItem: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        color: "rgba(255,100,100,0.9)",
        marginBottom: 4,
        fontFamily: "'Courier New', Courier, monospace",
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: "50%",
        background: "rgba(255,100,100,0.8)",
        display: "inline-block",
        flexShrink: 0,
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
        transition: "background 0.3s, opacity 0.2s",
        marginBottom: 16,
        fontFamily: "'Courier New', Courier, monospace",
    },
    loginRow: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
        marginBottom: 20,
    },
    loginText: {
        fontSize: 12,
        color: "rgba(255,255,255,0.4)",
    },
    loginLink: {
        background: "none",
        border: "none",
        color: "#2196F3",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "'Courier New', Courier, monospace",
        transition: "color 0.2s",
        padding: 0,
    },
    footer: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        marginBottom: 16,
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
    statusRow: {
        display: "flex",
        justifyContent: "center",
        gap: 12,
    },
    statusBadge: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 9,
        letterSpacing: 1.5,
        color: "rgba(255,255,255,0.25)",
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "#2196F3",
        display: "inline-block",
    },
};
