import HomeContext from "../../../contexts/HomeContext";
import { useContext, useState } from "react";
import { toast } from "react-toastify";

function RequestsToMe() {
    const {
        requestsToMe, resetChatWindow, socketRef,
        initChatSession, setShowChatSession,
        setRequestsToMe
    } = useContext(HomeContext);

    const [searchTermForRTM, setSearchTermForRTM] = useState("");
    const [subsetRequestsToMe, setSubsetRequestsToMe] = useState([...requestsToMe]);

    function searcher(value) {
        setSearchTermForRTM(value);
        if (value === "") {
            setSubsetRequestsToMe([...requestsToMe]);
        } else {
            const regex = new RegExp(value, "i");
            setSubsetRequestsToMe(requestsToMe.filter(r => regex.test(r.sender)));
        }
    }

    async function respondToRequest(request, response) {
        const socket = socketRef.current;

        if (request.createdAt + request.timeLimitInMs > Date.now()) {
            toast.info("This request has timed out! Auto-rejecting...");
            response = false;
        }

        if (response) {
            socket.emit("accept", request.sender, request.typeOfEncryption);
            resetChatWindow();
            initChatSession(request.sender, request.typeOfEncryption, request.chatSessionTimeInMin, "receiver", request.isSimulator);
            setShowChatSession(true);
        } else {
            socket.emit("reject", request.sender);
            setRequestsToMe(requests => requests.filter(r => r.sender !== request.sender));
            setSubsetRequestsToMe(requests => requests.filter(r => r.sender !== request.sender));
        }
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden"
            style={{
                background: "#09151a",
                backgroundImage: "radial-gradient(circle at 1px 1px, rgba(33,150,243,0.04) 1px, transparent 0)",
                backgroundSize: "24px 24px",
                fontFamily: "'Courier New', Courier, monospace"
            }}>

            {/* Panel */}
            <div className="flex-1 flex flex-col m-4 rounded-2xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(33,150,243,0.12)" }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5"
                    style={{ borderBottom: "1px solid rgba(33,150,243,0.08)" }}>
                    <div>
                        <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#2196F3" }}>
                            MyRequests
                        </h2>
                        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Manage pending quantum signal authorizations</p>
                    </div>
                    <button
                        onClick={resetChatWindow}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                        style={{ color: "rgba(255,255,255,0.4)" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,60,60,0.1)"; e.currentTarget.style.color = "#ff6b6b"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Search */}
                <div className="px-6 py-4">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            value={searchTermForRTM}
                            onChange={e => searcher(e.target.value)}
                            placeholder="Search myrequests..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-white text-sm outline-none transition-all"
                            style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(33,150,243,0.15)",
                                fontFamily: "'Courier New', Courier, monospace"
                            }}
                            onFocus={e => e.target.style.borderColor = "rgba(33,150,243,0.4)"}
                            onBlur={e => e.target.style.borderColor = "rgba(33,150,243,0.15)"}
                        />
                    </div>
                </div>

                {/* Request list */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3"
                    style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(33,150,243,0.2) transparent" }}>

                    {subsetRequestsToMe.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>No pending requests</span>
                        </div>
                    )}

                    {subsetRequestsToMe.map(request => {
                        const isExpired = request.createdAt + request.timeLimitInMs <= Date.now();
                        return (
                            <div key={request.sender}
                                className="flex items-center gap-4 p-4 rounded-2xl transition-all"
                                style={{
                                    background: isExpired ? "rgba(255,60,60,0.04)" : "rgba(255,255,255,0.03)",
                                    border: isExpired ? "1px solid rgba(255,60,60,0.15)" : "1px solid rgba(33,150,243,0.1)",
                                    borderLeft: isExpired ? "3px solid rgba(255,60,60,0.4)" : "3px solid rgba(33,150,243,0.3)"
                                }}>

                                {/* Avatar */}
                                <img
                                    src={`https://cdn.auth0.com/avatars/${request.sender?.[0]?.toLowerCase()}${request.sender?.[1]?.toLowerCase()}.png`}
                                    alt={request.sender}
                                    className="w-12 h-12 rounded-full object-cover shrink-0"
                                    style={{ border: "2px solid rgba(33,150,243,0.25)" }}
                                />

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-white text-sm mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                                        {request.sender}
                                    </h3>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                        <span className="flex items-center gap-1" style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                            </svg>
                                            {Math.ceil(request.timeLimitInMs / 1000)}s to accept
                                        </span>
                                        <span className="flex items-center gap-1" style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                            </svg>
                                            {request.typeOfEncryption?.toUpperCase()}
                                        </span>
                                        <span className="flex items-center gap-1" style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                                            </svg>
                                            {request.chatSessionTimeInMin}m session
                                        </span>
                                    </div>
                                </div>

                                {/* Buttons */}
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => respondToRequest(request, false)}
                                        className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                                        style={{
                                            background: "rgba(255,255,255,0.05)",
                                            border: "1px solid rgba(255,255,255,0.12)",
                                            color: "rgba(255,255,255,0.6)"
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,60,60,0.1)"; e.currentTarget.style.borderColor = "rgba(255,60,60,0.3)"; e.currentTarget.style.color = "#ff6b6b"; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
                                    >
                                        Deny
                                    </button>
                                    <button
                                        onClick={() => respondToRequest(request, true)}
                                        disabled={isExpired}
                                        className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={{
                                            background: "linear-gradient(135deg, #2196F3, #1565C0)",
                                            boxShadow: "0 0 12px rgba(33,150,243,0.3)"
                                        }}
                                        onMouseEnter={e => { if (!isExpired) e.currentTarget.style.boxShadow = "0 0 20px rgba(33,150,243,0.5)"; }}
                                        onMouseLeave={e => e.currentTarget.style.boxShadow = "0 0 12px rgba(33,150,243,0.3)"}
                                    >
                                        Accept
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default RequestsToMe;
