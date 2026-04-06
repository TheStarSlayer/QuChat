import { useContext, useEffect, useState } from "react";
import HomeContext from "../../contexts/HomeContext";

function OnlineUsers() {
    const {
        onlineUsers, setShowNewRequest,
        setShowRequestsToMe, setShowEavesdroppableRequests,
        showChatSession
    } = useContext(HomeContext);

    const [searchTermForUsers, setSearchTermForUsers] = useState("");
    const [subsetOnlineUsers, setSubsetOnlineUsers] = useState([...onlineUsers]);

    useEffect(() => {
        (() => {
            setSubsetOnlineUsers([...onlineUsers]);
        })();
    }, [onlineUsers]);

    function searcher(value) {
        setSearchTermForUsers(value);
        if (value === "") {
            setSubsetOnlineUsers([...onlineUsers]);
        } else {
            const regex = new RegExp(value, "i");
            setSubsetOnlineUsers(onlineUsers.filter(user => regex.test(user.username)));
        }
    }

    function newRequest(receiverUserId) {
        if (showChatSession) return;
        setShowRequestsToMe(false);
        setShowEavesdroppableRequests(false);
        setShowNewRequest(receiverUserId);
    }

    const isLocked = showChatSession;

    return (
        <aside className="flex flex-col w-72 shrink-0 h-full"
            style={{
                background: "rgba(9,21,26,0.95)",
                borderRight: "1px solid rgba(33,150,243,0.08)",
                fontFamily: "'Courier New', Courier, monospace",
                position: "relative"
            }}>

            {/* Lock overlay when chat session active */}
            {isLocked && (
                <div className="absolute inset-0 z-20 rounded-r-none"
                    style={{ background: "rgba(9,21,26,0.7)", backdropFilter: "blur(2px)", cursor: "not-allowed" }} />
            )}

            {/* Search */}
            <div className="px-4 pt-4 pb-3">
                <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        value={searchTermForUsers}
                        onChange={e => searcher(e.target.value)}
                        placeholder="Search users..."
                        disabled={isLocked}
                        className="w-full pl-9 pr-3 py-2 rounded-xl text-white outline-none text-xs transition-all"
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(33,150,243,0.15)",
                            fontFamily: "'Courier New', Courier, monospace",
                        }}
                        onFocus={e => e.target.style.borderColor = "rgba(33,150,243,0.4)"}
                        onBlur={e => e.target.style.borderColor = "rgba(33,150,243,0.15)"}
                    />
                </div>
            </div>

            {/* Section label */}
            <div className="px-4 pb-2">
                <span style={{ fontSize: "9px", letterSpacing: "2px", color: "rgba(255,255,255,0.25)" }}>
                    ONLINE NOW · {subsetOnlineUsers.length}
                </span>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5"
                style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(33,150,243,0.2) transparent" }}>

                {subsetOnlineUsers.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>No users online</span>
                    </div>
                )}

                {subsetOnlineUsers.map(user => (
                    <div key={user.username}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group"
                        style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid transparent",
                        }}
                        onMouseEnter={e => {
                            if (!isLocked) {
                                e.currentTarget.style.background = "rgba(33,150,243,0.06)";
                                e.currentTarget.style.borderColor = "rgba(33,150,243,0.15)";
                            }
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                            e.currentTarget.style.borderColor = "transparent";
                        }}>

                        {/* Avatar */}
                        <div className="relative shrink-0">
                            <img
                                src={user.profilePicture}
                                alt={user.username}
                                className="w-9 h-9 rounded-full object-cover"
                                style={{ border: "1.5px solid rgba(33,150,243,0.25)" }}
                            />
                            {/* Online dot */}
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
                                style={{ background: "#22c55e", border: "2px solid #09151a" }} />
                        </div>

                        {/* Username */}
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate text-white" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                                {user.username}
                            </p>
                            <p style={{ fontSize: "10px", color: "rgba(34,197,94,0.7)" }}>Active now</p>
                        </div>

                        {/* Request button */}
                        <button
                            onClick={() => newRequest(user.username)}
                            disabled={isLocked}
                            title="New Request"
                            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{ background: "rgba(33,150,243,0.1)", color: "#2196F3" }}
                            onMouseEnter={e => { if (!isLocked) { e.currentTarget.style.background = "#2196F3"; e.currentTarget.style.color = "#fff"; }}}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(33,150,243,0.1)"; e.currentTarget.style.color = "#2196F3"; }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                <line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        </aside>
    );
}

export default OnlineUsers;
