import { useContext } from "react";
import logout from "../../lib/logout";
import HomeContext from "../../contexts/HomeContext";

function Header({ navigate }) {
    const { userId, profilePic } = useContext(HomeContext);

    const handleLogout = async () => {
        await logout(navigate);
    };

    return (
        <header style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            height: "56px",
            flexShrink: 0,
            background: "rgba(9,21,26,0.95)",
            borderBottom: "1px solid rgba(33,150,243,0.1)",
            backdropFilter: "blur(12px)",
            fontFamily: "'Courier New', Courier, monospace",
            zIndex: 40
        }}>

            {/* Logo */}
            <div style={{
                fontSize: "20px",
                fontWeight: 900,
                letterSpacing: "-1px",
                fontFamily: "'Space Grotesk', sans-serif"
            }}>
                <span style={{ color: "#2196F3" }}>QU</span>
                <span style={{ color: "#ffffff" }}>CHAT</span>
            </div>

            {/* Right side */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>

                {/* Username */}
                <span style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.7)",
                    fontFamily: "'Courier New', Courier, monospace"
                }}>
                    {userId || "..."}
                </span>

                {/* Profile picture */}
                {profilePic && (
                    <img
                        src={profilePic}
                        alt={userId}
                        style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "2px solid rgba(33,150,243,0.4)"
                        }}
                    />
                )}

                {/* Logout button */}
                <button
                    onClick={handleLogout}
                    title="Logout"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "34px",
                        height: "34px",
                        borderRadius: "8px",
                        background: "transparent",
                        border: "none",
                        color: "rgba(255,255,255,0.4)",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        padding: 0
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(255,60,60,0.15)";
                        e.currentTarget.style.color = "#ff6b6b";
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "rgba(255,255,255,0.4)";
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                </button>
            </div>
        </header>
    );
}

export default Header;
