import HomeContext from "../../../contexts/HomeContext";
import { useContext, useEffect, useRef, useState } from "react";
import apiCaller from "../../../lib/api";
import { toast } from "react-toastify";

function EavesdroppableRequests() {
    const {
        eavesdroppableRequests, resetChatWindow,
        setWindowLoading, socketRef,
        userId, initChatSession, setShowChatSession
    } = useContext(HomeContext);

    const [searchTermForEDR, setSearchTermForEDR] = useState("");
    const [subsetEDRequests, setSubsetEDRequests] = useState([...eavesdroppableRequests]);
    const timeoutId = useRef("");

    function searcher(value) {
        if (value === "") {
            setSubsetEDRequests([...eavesdroppableRequests]);
        } else {
            const regex = new RegExp(value, "i");
            setSubsetEDRequests(eavesdroppableRequests.filter(r => regex.test(r.sender)));
        }
    }

    useEffect(() => {
        (() => searcher(searchTermForEDR))();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eavesdroppableRequests]);

    async function eavesdropRequest(request) {
        setWindowLoading("Sneaking...");
        try {
            await apiCaller.patch(`/eavesdrop/${request.sender}`);
            
            const socket = socketRef.current;
            socket.emit("eavesdropRequest", request.sender);

            setWindowLoading("Sneaked in, now waiting for response from receiver...");

            timeoutId.current = setTimeout(() => {
                toast.error("Did not catch any response!");
                setWindowLoading("");
            }, request.timeLimitInMs);

            socket.once("response", (response) => {
                clearTimeout(timeoutId.current);

                if (response === "rejected") {
                    toast.info("This request is rejected!");
                    setWindowLoading("");
                    socket.emit("leave");
                }
                else {
                    if (request.typeOfEncryption === "bb84")
                        socket.emit("updateOnResponseAcceptQC", userId);
                    else
                        socket.emit("updateOnResponseAccept", userId);

                    setWindowLoading("");
                    resetChatWindow();

                    initChatSession(request.sender, request.typeOfEncryption, request.chatSessionTimeInMin, "eavesdropper", request.isSimulator);

                    setShowChatSession(true);
                }
                
            });
        }
        catch (error) {
            if (error.response?.status === 404)
                toast.error("This request cannot be eavesdropped now!");
            else {
                toast.error(error.message);
                console.error(error);
            }
            setWindowLoading("");
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

            <div className="flex-1 flex flex-col m-4 rounded-2xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(33,150,243,0.12)" }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5"
                    style={{ borderBottom: "1px solid rgba(33,150,243,0.08)" }}>
                    <div>
                        <h2 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#2196F3" }}>
                            Eavesdrop Request
                        </h2>
                        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Select an active request to monitor.</p>
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
                            value={searchTermForEDR}
                            onChange={e => {setSearchTermForEDR(e.target.value); searcher(e.target.value);}}
                            placeholder="Filter by user..."
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

                {/* Session list */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3"
                    style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(33,150,243,0.2) transparent" }}>

                    {subsetEDRequests.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                            </svg>
                            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>No sessions available to monitor</span>
                        </div>
                    )}

                    {subsetEDRequests.map(request => (
                        <div key={request.sender}
                            className="flex items-center gap-4 p-4 rounded-2xl transition-all"
                            style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(33,150,243,0.1)"
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(33,150,243,0.04)"; e.currentTarget.style.borderColor = "rgba(33,150,243,0.2)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(33,150,243,0.1)"; }}
                        >
                            {/* Avatar */}
                            <div className="relative shrink-0">
                                <img
                                    src={`https://cdn.auth0.com/avatars/${request.sender?.[0]?.toLowerCase()}${request.sender?.[1]?.toLowerCase()}.png`}
                                    alt={request.sender}
                                    className="w-12 h-12 rounded-full object-cover"
                                    style={{ border: "2px solid rgba(33,150,243,0.25)" }}
                                />
                                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full" style={{ background: "#22c55e", border: "2px solid #09151a" }} />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-white text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                                        {request.sender}
                                    </h3>
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                        style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", fontSize: "9px", letterSpacing: "1px" }}>
                                        ACTIVE
                                    </span>
                                </div>
                                <div className="flex gap-4">
                                    <span className="flex items-center gap-1" style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        </svg>
                                        {request.typeOfEncryption?.toUpperCase()}
                                    </span>
                                    <span className="flex items-center gap-1" style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                        </svg>
                                        {Math.ceil(request.timeLimitInMs / 1000)}s left
                                    </span>
                                    <span className="flex items-center gap-1" style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                                        </svg>
                                        {request.isSimulator ? "Sim" : "HW"} mode
                                    </span>
                                </div>
                            </div>

                            {/* Eavesdrop button */}
                            <button
                                onClick={() => eavesdropRequest(request)}
                                className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                                style={{
                                    background: "linear-gradient(135deg, #2196F3, #1565C0)",
                                    boxShadow: "0 0 12px rgba(33,150,243,0.3)"
                                }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 20px rgba(33,150,243,0.5)"}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = "0 0 12px rgba(33,150,243,0.3)"}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                </svg>
                                Eavesdrop
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default EavesdroppableRequests;
