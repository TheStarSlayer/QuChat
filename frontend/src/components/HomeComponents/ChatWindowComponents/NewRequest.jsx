import HomeContext from "../../../contexts/HomeContext";
import { useContext, useState } from "react";
import apiCaller from "../../../lib/api";
import { toast } from "react-toastify";
import qcCaller from "../../../lib/qc";
import Timer from "../../GeneralComponents/Timer";

function NewRequest() {
    const {
        showNewRequest, setWindowLoading,
        socketRef, setShowTimer, showTimer,
        setShowChatSession,
        userId, resetChatWindow,
        initChatSession,
        qkeyBits, qkeyBases
    } = useContext(HomeContext);

    const [timeLimitInSec, setTimeLimitInSec] = useState(30);
    const [chatSessionTimeInMin, setChatSessionTimeInMin] = useState(5);
    const [typeOfEncryption, setTypeOfEncryption] = useState("bb84");
    const [isSimulator, setIsSimulator] = useState(true);

    const timeSteps = [30, 45, 60, 75, 90];
    const timeIndex = timeSteps.indexOf(timeLimitInSec);

    async function createRequest() {
        setWindowLoading("Sending request...");
        try {
            const response = await apiCaller.post("/persistRequest", {
                receiverId: showNewRequest,
                timeLimitInMs: timeLimitInSec * 1000,
                typeOfEncryption,
                chatSessionTimeInMin,
                isSimulator
            });

            const request = response.data.newRequestPublic;
            const socket = socketRef.current;

            socket.emit("sendJoinRequest", showNewRequest, request);
            setShowTimer(timeLimitInSec);

            const timeoutId = setTimeout(async () => {
                setShowTimer(-1);
                socket.off("response");
                resetChatWindow();
                toast.info("Request timed out!");
                try {
                    await apiCaller.patch("/finishRequest", { finishStatus: "timeout" });
                } catch (error) {
                    toast.error("Could not close request successfully!");
                }
            }, timeLimitInSec * 1000);

            socket.once("response", async (response) => {
                clearTimeout(timeoutId);
                setShowTimer(-1);
                setWindowLoading("Handling response...");
                try {
                    if (response === "accepted") {
                        await apiCaller.patch("/finishRequest", { finishStatus: "accepted" });
                        if (typeOfEncryption === "bb84") {
                            socket.emit("updateOnResponseAcceptQC", userId);
                            const res = await qcCaller.get(`/distributeRawKey/${userId}`);
                            qkeyBases.current = res.data.bases;
                            qkeyBits.current = res.data.bits;
                        } else {
                            socket.emit("updateOnResponseAccepted", userId);
                        }
                        socket.emit("joinAck", userId, true);
                        resetChatWindow();
                        initChatSession(userId, request.typeOfEncryption, request.chatSessionTimeInMin, "host", request.isSimulator);
                        setShowChatSession(true);
                    } else {
                        await apiCaller.patch("/finishRequest", { finishStatus: "rejected" });
                        resetChatWindow();
                    }
                } catch (error) {
                    toast.error("Could not handle request successfully!");
                    resetChatWindow();
                    try { await apiCaller.patch("/finishRequest", { finishStatus: "timeout" }); } catch {}
                }
            });
        } catch (error) {
            toast.error("Something unexpected happened!");
        } finally {
            setWindowLoading("");
        }
    }

    return (
        <div className="flex-1 flex flex-col items-center overflow-y-auto relative"
            style={{
                background: "#09151a",
                backgroundImage: "radial-gradient(circle at 1px 1px, rgba(33,150,243,0.04) 1px, transparent 0)",
                backgroundSize: "24px 24px",
                fontFamily: "'Courier New', Courier, monospace"
            }}>

            {/* Header bar */}
            <div className="w-full flex items-center justify-between px-6 py-3 shrink-0"
                style={{ borderBottom: "1px solid rgba(33,150,243,0.1)" }}>
                <span style={{ fontSize: "11px", letterSpacing: "2px", color: "rgba(255,255,255,0.4)" }}>NEW SESSION REQUEST</span>
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

            {/* Content */}
            <div className="w-full max-w-lg px-6 py-8 flex flex-col gap-6">

                {/* Receiver info */}
                <div className="flex flex-col items-center gap-3 mb-2">
                    <div className="relative">
                        <img
                            src={`https://cdn.auth0.com/avatars/${showNewRequest?.[0]?.toLowerCase()}${showNewRequest?.[1]?.toLowerCase()}.png`}
                            alt={showNewRequest}
                            className="w-20 h-20 rounded-full object-cover"
                            style={{ border: "3px solid rgba(33,150,243,0.3)", boxShadow: "0 0 24px rgba(33,150,243,0.2)" }}
                        />
                        <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full" style={{ background: "#22c55e", border: "2px solid #09151a" }} />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            {showNewRequest}
                        </h2>
                        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Sending request to {showNewRequest}</p>
                    </div>
                </div>

                {/* Time to respond slider */}
                <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(33,150,243,0.1)" }}>
                    <div className="flex justify-between items-center mb-4">
                        <span style={{ fontSize: "10px", letterSpacing: "2px", color: "rgba(33,150,243,0.8)" }}>TIME TO RESPOND</span>
                        <span className="font-bold" style={{ color: "#2196F3", fontSize: "14px" }}>{timeLimitInSec} Seconds</span>
                    </div>
                    <input
                        type="range"
                        min="0" max="4"
                        value={timeIndex === -1 ? 0 : timeIndex}
                        onChange={e => setTimeLimitInSec(timeSteps[parseInt(e.target.value)])}
                        className="w-full accent-blue-500"
                        style={{ cursor: "pointer" }}
                    />
                    <div className="flex justify-between mt-2">
                        {timeSteps.map(t => (
                            <span key={t} style={{ fontSize: "10px", color: timeLimitInSec === t ? "#2196F3" : "rgba(255,255,255,0.25)" }}>
                                {t}s
                            </span>
                        ))}
                    </div>
                </div>

                {/* Encryption protocol */}
                <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(33,150,243,0.1)" }}>
                    <span className="block mb-3" style={{ fontSize: "10px", letterSpacing: "2px", color: "rgba(33,150,243,0.8)" }}>
                        ENCRYPTION PROTOCOL
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                        {/* None */}
                        <button
                            onClick={() => setTypeOfEncryption("none")}
                            className="flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                            style={{
                                background: typeOfEncryption === "none" ? "rgba(33,150,243,0.15)" : "rgba(255,255,255,0.03)",
                                border: typeOfEncryption === "none" ? "1px solid rgba(33,150,243,0.5)" : "1px solid rgba(255,255,255,0.08)",
                            }}>
                            <span className="text-white text-sm font-semibold">None</span>
                            <span className="w-4 h-4 rounded-full flex items-center justify-center"
                                style={{ border: "2px solid", borderColor: typeOfEncryption === "none" ? "#2196F3" : "rgba(255,255,255,0.3)" }}>
                                {typeOfEncryption === "none" && <span className="w-2 h-2 rounded-full" style={{ background: "#2196F3" }} />}
                            </span>
                        </button>

                        {/* BB84 */}
                        <button
                            onClick={() => setTypeOfEncryption("bb84")}
                            className="flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                            style={{
                                background: typeOfEncryption === "bb84" ? "rgba(33,150,243,0.15)" : "rgba(255,255,255,0.03)",
                                border: typeOfEncryption === "bb84" ? "1px solid rgba(33,150,243,0.5)" : "1px solid rgba(255,255,255,0.08)",
                            }}>
                            <div>
                                <span className="text-white text-sm font-semibold block">BB84</span>
                                <span style={{ fontSize: "9px", letterSpacing: "1px", color: "#D87900" }}>QUANTUM READY</span>
                            </div>
                            <span className="w-4 h-4 rounded-full flex items-center justify-center"
                                style={{ border: "2px solid", borderColor: typeOfEncryption === "bb84" ? "#2196F3" : "rgba(255,255,255,0.3)" }}>
                                {typeOfEncryption === "bb84" && <span className="w-2 h-2 rounded-full" style={{ background: "#2196F3" }} />}
                            </span>
                        </button>
                    </div>

                    {/* Simulator option — only when BB84 */}
                    {typeOfEncryption === "bb84" && (
                        <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(33,150,243,0.05)", border: "1px solid rgba(33,150,243,0.1)" }}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2">
                                        <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                                    </svg>
                                    <div>
                                        <span className="text-white text-xs font-semibold block">Quantum Simulator</span>
                                        <span style={{ fontSize: "9px", letterSpacing: "1px", color: "rgba(255,255,255,0.3)" }}>PROTOCOL VALIDATION</span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setIsSimulator(true)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                        style={{
                                            background: isSimulator ? "rgba(33,150,243,0.2)" : "transparent",
                                            border: "1px solid",
                                            borderColor: isSimulator ? "#2196F3" : "rgba(255,255,255,0.15)",
                                            color: isSimulator ? "#2196F3" : "rgba(255,255,255,0.4)"
                                        }}>
                                        Yes
                                    </button>
                                    <button
                                        onClick={() => setIsSimulator(false)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                        style={{
                                            background: !isSimulator ? "rgba(33,150,243,0.2)" : "transparent",
                                            border: "1px solid",
                                            borderColor: !isSimulator ? "#2196F3" : "rgba(255,255,255,0.15)",
                                            color: !isSimulator ? "#2196F3" : "rgba(255,255,255,0.4)"
                                        }}>
                                        No
                                    </button>
                                </div>
                            </div>

                            {!isSimulator && (
                                <div className="flex items-start gap-2 rounded-lg px-3 py-2"
                                    style={{ background: "rgba(216,121,0,0.08)", border: "1px solid rgba(216,121,0,0.2)" }}>
                                    <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D87900" strokeWidth="2">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                    <span style={{ fontSize: "11px", color: "rgba(216,121,0,0.9)", lineHeight: 1.4 }}>
                                        A real quantum machine will take an indefinite time to get request in queue.
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Session duration slider */}
                <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(33,150,243,0.1)" }}>
                    <div className="flex justify-between items-center mb-4">
                        <span style={{ fontSize: "10px", letterSpacing: "2px", color: "rgba(33,150,243,0.8)" }}>SESSION DURATION</span>
                        <span className="font-bold" style={{ color: "#2196F3", fontSize: "14px" }}>{chatSessionTimeInMin} Minutes</span>
                    </div>
                    <input
                        type="range"
                        min="3" max="10"
                        value={chatSessionTimeInMin}
                        onChange={e => setChatSessionTimeInMin(parseInt(e.target.value))}
                        className="w-full accent-blue-500"
                        style={{ cursor: "pointer" }}
                    />
                    <div className="flex justify-between mt-2">
                        {[3, 4, 5, 6, 7, 8, 9, 10].map(m => (
                            <span key={m} style={{ fontSize: "10px", color: chatSessionTimeInMin === m ? "#2196F3" : "rgba(255,255,255,0.25)" }}>
                                {m}m
                            </span>
                        ))}
                    </div>
                </div>

                {/* Submit */}
                <button
                    onClick={createRequest}
                    className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                        background: "linear-gradient(135deg, #2196F3, #1565C0)",
                        boxShadow: "0 0 24px rgba(33,150,243,0.3)",
                        fontFamily: "'Space Grotesk', sans-serif",
                        letterSpacing: "0.5px"
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 36px rgba(33,150,243,0.5)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "0 0 24px rgba(33,150,243,0.3)"}
                >
                    Submit Request
                </button>

                {/* Footer note */}
                <div className="flex justify-center items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span style={{ fontSize: "10px", letterSpacing: "2px", color: "rgba(255,255,255,0.2)" }}>
                        END-TO-END QUANTUM SECURED
                    </span>
                </div>
            </div>

            {/* Timer overlay */}
            {showTimer !== -1 && <Timer time={showTimer} />}
        </div>
    );
}

export default NewRequest;
