import { useContext, useEffect, useRef, useState } from "react";
import HomeContext from "../../../contexts/HomeContext";
import { toast } from "react-toastify";
import qcCaller from "../../../lib/qc";
import { encrypt, decrypt, privacyAmplification } from "../../../lib/protector";
import ChatSessionStatus from "./ChatSessionStatus";
import apiCaller from "../../../lib/api";

function ChatSession() {
    const {
        chatSessionTimer, chatEncryption,
        chatRoomId, chatRole, chatUsesSimulator,
        socketRef, userId, profilePic,
        statusWindow, setStatusWindow,
        resetChatWindow,
    } = useContext(HomeContext);

    const [freeToChat, setFreeToChat] = useState(false);
    const siftedQkeyBits = useRef("");
    const [QBER, setQBER] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [timeLeft, setTimeLeft] = useState(chatSessionTimer * 60);

    const qkeyBases = useRef("");
    const qkeyBits = useRef("");

    const intervalId = useRef(null);
    const tryAgainLater = useRef(0);
    const isRequestInProgress = useRef(false);
    const messagesEndRef = useRef(null);

    const quantumKey = useRef(null);

    // Auto scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    // Session countdown timer
    useEffect(() => {
        if (!freeToChat)
            return;

        setTimeLeft(chatSessionTimer * 60);

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { 
                    clearInterval(interval);
                    timerEnds();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [freeToChat]);

    function formatTime(secs) {
        const m = Math.floor(secs / 60).toString().padStart(2, "0");
        const s = (secs % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    }

    function siftKey(receivedBases) {
        const myBases = qkeyBases.current;
        const myBits = qkeyBits.current;

        let newKey = "";

        for (let i = 0; i < myBases.length; i++) {
            if (receivedBases[i] === myBases[i]) {
                newKey += myBits[i];
            }
        }

        siftedQkeyBits.current = newKey;
    }

    function getRandBits(randIndices) {
        let randBits = "";
        let myKey = siftedQkeyBits.current;

        for (const ind of randIndices)
            randBits += myKey[ind];

        for (let i = randIndices.length - 1; i >= 0; i--)
            myKey = myKey.slice(0, randIndices[i]) + myKey.slice(randIndices[i] + 1);

        siftedQkeyBits.current = myKey;

        return randBits;
    }

    function qberCalculator(hostRandBits, myRandBits) {
        let mismatched = 0;

        for (let i = 0; i < hostRandBits.length; i++) {
            if (myRandBits[i] !== hostRandBits[i])
                mismatched++;
        }

        return (mismatched / hostRandBits.length) * 100;
    }

    function sessionStarted() {
        setStatusWindow("");
        setFreeToChat(true);
        if (chatRole !== "eavesdropper")
            toast.success("You are free to chat!");
        else
            toast.success("Eavesdropped successfully! You can now secretly view the chat!");

        if (chatEncryption === "bb84")
            quantumKey.current = privacyAmplification(siftedQkeyBits.current);
    }

    function sendMessage() {
        if (!message.trim())
            return;
        const socket = socketRef.current;

        setChatMessages(prev => 
            [...prev, { message: message, sender: userId, senderProfilePic: profilePic, isMe: true }]
        );
        let messageToSend = message;

        if (chatEncryption !== "none")
            messageToSend = encrypt(messageToSend, quantumKey.current);
        
        socket.emit("sendMessage", chatRoomId, messageToSend);
        setMessage("");
    }

    function closeChatSession() {
        const socket = socketRef.current;
        
        if (chatRole !== "eavesdropper")
            socket.emit("sessionDisturbed", chatRoomId, "Participant left");
        else
            socket.emit("leave", chatRoomId);
        

        resetChatWindow();
        toast.success("Left chat session!");
    }

    function timerEnds() {
        const socket = socketRef.current;
        socket.emit("sessionEnd", chatRoomId);
        resetChatWindow();
        toast.success("Chat session ended successfully!");
    }

    async function setToBusy() {
        await apiCaller.patch("/setToBusy");
        toast.info("You cannot receive requests for now!");
    }

    const handleKey = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    useEffect(() => {
        const socket = socketRef.current;

        if (chatEncryption === "none") {
            setToBusy();

            if (chatRole === "host") {
                setStatusWindow("Starting session!");
                socket.emit("joinAck", userId, true);
            }
            else {
                socket.once("ackFromHost", (ack) => {
                    setStatusWindow("Waiting for acknowledgement of session from host...");
                    if (!ack) {
                        setStatusWindow("");
                        resetChatWindow();
                        toast.info("Host did not acknowledge session!");
                    }
                    else {
                        setStatusWindow("Received acknowledgment...starting session...");
                    }
                });
            }

            sessionStarted();
        }
        else {
            setStatusWindow("Securing session...");

            if (chatRole === "host") {
                setStatusWindow("Generating bits and bases...");

                qcCaller.get(`/distributeRawKey/${userId}`)
                .then((res) => {
                    qkeyBases.current = res.data.bases;
                    qkeyBits.current = res.data.bits;          

                    socket.emit("joinAck", userId, true);
                    setToBusy();

                    socket.once("bases", async (bases) => {                        
                        siftKey(bases);
                        setStatusWindow("Sharing bases for sifting key...");
                        socket.emit("shareBases", chatRoomId, qkeyBases.current);

                        try {
                            const response = await qcCaller.get(
                                `/getRandomIndices/${chatUsesSimulator ? "sim" : "hw"}?keyLength=${siftedQkeyBits.current.length}`
                            );

                            const randIndices = response.data.randIndices;
                            const randBits = getRandBits(randIndices);
                            setStatusWindow("Key generated! Requesting for QBER...");

                            socket.emit("calculateQBER", chatRoomId, { randIndices, randBits });

                            socket.once("qberResult", (receivedQber) => {
                                toast.info(`QBER value: ${receivedQber}`);
                                
                                if (receivedQber < 10 && receivedQber !== null) {
                                    socket.emit("updateOnQBERAccept", chatRoomId);
                                    setQBER(receivedQber);
                                    sessionStarted();
                                }
                                else {
                                    setStatusWindow("Session compromised! QBER too high.");
                                    socket.emit("resetSocketStats");
                                    toast.error("Session compromised!");
                                    setStatusWindow("");
                                    resetChatWindow();
                                }
                            });
                        }
                        catch {
                            socket.emit("sessionDisturbed", chatRoomId, "Could not request for QBER!");
                            toast.error("Could not request for QBER!");
                            setStatusWindow("");
                            resetChatWindow();
                        }
                    });
                })
                .catch(() => {
                    socket.emit("joinAck", userId, false);
                    toast.error("Key generation failed!");
                    setStatusWindow("");
                    resetChatWindow();
                });
            }
            else if (chatRole === "eavesdropper") {
                setStatusWindow("Waiting for acknowledgement of session from host...");
                socket.once("ackFromHost", async (ack) => {
                    setToBusy();
                    if (!ack) {
                        setStatusWindow("");
                        resetChatWindow();
                        toast.info("Host did not acknowledge session!");
                    }
                    else {
                        try {
                            setStatusWindow("Received acknowledgment of session...intercepting key...");

                            const response = await qcCaller.get(`/distributeRawKey/${chatRoomId}`);
                            qkeyBases.current = response.data.bases;
                            qkeyBits.current = response.data.bits;

                            setStatusWindow("Intercepted bits and resent to receiver...");

                            socket.once("qberResult", (receivedQber) => {
                                if (receivedQber > 10) {
                                    toast.error("Detected by BB84 QKD algorithm!");
                                    setStatusWindow("");
                                    resetChatWindow();
                                }
                                else {
                                    socket.emit("updateOnQBERAccept", chatRoomId);
                                    toast.success("Eavesdropping successfully!");
                                    sessionStarted();
                                }
                            });
                        }
                        catch {
                            socket.emit("leave", chatRoomId);
                            toast.error("Unexpected error occurred!");
                            setStatusWindow("");
                            resetChatWindow();
                        }
                    }
                });
            }
            else {
                setStatusWindow("Waiting for acknowledgement of session from host...");

                socket.once("ackFromHost", async (ack) => {
                    setToBusy();
                    if (!ack) {
                        setStatusWindow("");
                        resetChatWindow();
                        toast.info("Host did not acknowledge session!");
                    }
                    else {
                        setStatusWindow("Received acknowledgement, generating key...This may take some time!");

                        tryAgainLater.current = 0;
                        isRequestInProgress.current = false;

                        intervalId.current = setInterval(async () => {
                            if (isRequestInProgress.current)
                                return;
                            isRequestInProgress.current = true;

                            try {
                                const response = await qcCaller.get(`/distributeRawKey/${chatRoomId}`);
                                clearInterval(intervalId.current);
                                
                                qkeyBases.current = response.data.bases;
                                qkeyBits.current = response.data.bits;

                                socket.emit("shareBases", chatRoomId, qkeyBases.current);
                                setStatusWindow("Key generated! Sharing bases...");

                                socket.once("bases", (bases) => {
                                    socket.once("qber", ({ randIndices, randBits }) => {
                                        siftKey(bases);

                                        const myRandBits = getRandBits(randIndices);
                                        const calcQber = qberCalculator(randBits, myRandBits);

                                        toast.info(`QBER value: ${calcQber}`);

                                        setStatusWindow(`Measured QBER is ${calcQber.toFixed(1)}%....`);

                                        socket.emit("shareQBERResult", chatRoomId, calcQber);

                                        if (calcQber < 10) {
                                            setQBER(calcQber);
                                            sessionStarted();
                                        }
                                        else {
                                            setStatusWindow("Session compromised!");
                                            socket.emit("leave", chatRoomId);
                                            toast.error("Session compromised!");
                                            setStatusWindow("");
                                            resetChatWindow();
                                        }
                                    });
                                });
                            }
                            catch (error) {
                                if (error.response?.status === 425 && tryAgainLater.current <= 3)
                                    tryAgainLater.current++;
                                else {
                                    clearInterval(intervalId.current);
                                    toast.error("Key generation failed!");
                                    socket.emit("sessionDisturbed", chatRoomId, "Key Generation Failed!");
                                    setStatusWindow("");
                                    resetChatWindow();
                                }
                            }
                            finally {
                                isRequestInProgress.current = false;
                            }
                        }, 7000);
                    }
                });
            }
        }

        socket.on("message", ({ message: msg, sender, profilePic: senderPic }) => {
            let receivedMessage = msg;
            if (chatEncryption !== "none") 
                receivedMessage = decrypt(msg, quantumKey.current);

            setChatMessages(prev => 
                [...prev, { message: receivedMessage, sender, senderProfilePic: senderPic, isMe: false }]
            );
        });

        socket.on("keyGenFailed", (msg) => {
            if (userId !== chatRoomId)
                socket.emit("leave", chatRoomId);

            toast.error(msg);
            resetChatWindow();
        });

        socket.on("requestFailed", (msg) => {
            if (userId !== chatRoomId)
                socket.emit("leave", chatRoomId);

            toast.error(msg);
            resetChatWindow();
        });

        socket.on("sessionEnd", () => {
            if (userId !== chatRoomId)
                socket.emit("leave", chatRoomId);

            toast.info("Session ended gracefully");
            resetChatWindow();
        });

        socket.on("sessionDisturbed", (msg) => {
            if (userId !== chatRoomId)
                socket.emit("leave", chatRoomId);

            toast.error(msg);
            resetChatWindow();
        });

        return () => {
            socket.off("message");
            socket.off("sessionEnd");
            socket.off("sessionDisturbed");
            socket.off("keyGenFailed");
            socket.off("requestFailed");
            (async () => {
                await apiCaller.patch("/setToAvailable");
                toast.info("You are now available for requests!");
            })();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Determine other party names for header
    const isEavesdropper = chatRole === "eavesdropper";
    const subText = chatEncryption === "none" ? "Session Active" : "Quantum Encryption Active";

    return (
        <div className="flex-1 flex flex-col overflow-hidden"
            style={{ background: "#09151a", fontFamily: "'Courier New', Courier, monospace" }}>

            {/* Chat header */}
            <div className="flex items-center px-5 py-3 shrink-0"
                style={{ borderBottom: "1px solid rgba(33,150,243,0.1)", background: "rgba(9,21,26,0.9)" }}>

                {/* Other party info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <img
                        src={`https://cdn.auth0.com/avatars/${chatRoomId?.[0]?.toLowerCase()}${chatRoomId?.[1]?.toLowerCase()}.png`}
                        alt={chatRoomId}
                        className="w-9 h-9 rounded-full shrink-0"
                        style={{ border: "2px solid rgba(33,150,243,0.3)" }}
                    />
                    <div className="min-w-0">
                        <p className="text-white font-bold text-sm truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            {chatRoomId}'s session
                        </p>
                        <p style={{ fontSize: "10px", color: "rgba(34,197,94,0.8)" }}>
                            {isEavesdropper ? "Monitoring session" : subText}
                        </p>
                    </div>
                </div>

                {/* QBER badge */}
                {QBER !== null && chatEncryption === "bb84" && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full mx-3"
                        style={{ background: "rgba(33,150,243,0.1)", border: "1px solid rgba(33,150,243,0.2)" }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: "#2196F3" }} />
                        <span style={{ fontSize: "10px", color: "#2196F3", letterSpacing: "1px" }}>
                            QBER {QBER.toFixed(1)}%
                        </span>
                    </div>
                )}

                {/* Timer */}
                {freeToChat && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full mx-2"
                        style={{
                            background: timeLeft < 60 ? "rgba(255,60,60,0.1)" : "rgba(33,150,243,0.1)",
                            border: `1px solid ${timeLeft < 60 ? "rgba(255,60,60,0.3)" : "rgba(33,150,243,0.2)"}`
                        }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={timeLeft < 60 ? "#ff6b6b" : "#2196F3"} strokeWidth="2">
                            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span style={{ fontSize: "12px", fontWeight: "bold", color: timeLeft < 60 ? "#ff6b6b" : "#2196F3" }}>
                            {formatTime(timeLeft)}
                        </span>
                    </div>
                )}

                {/* End session */}
                <button
                    onClick={closeChatSession}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.2)", color: "#ff6b6b" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,60,60,0.2)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255,60,60,0.1)"}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    End Session
                </button>
            </div>

            {/* Status / Key gen waiting */}
            {!freeToChat && <ChatSessionStatus message={statusWindow} chatEncryption={chatEncryption} />}

            {/* Messages area */}
            {freeToChat && (
                <>
                    {/* Eavesdrop notice */}
                    {isEavesdropper && (
                        <div className="flex justify-center py-2">
                            <span className="px-4 py-1.5 rounded-full text-xs"
                                style={{ background: "rgba(216,121,0,0.1)", border: "1px solid rgba(216,121,0,0.2)", color: "rgba(216,121,0,0.8)", letterSpacing: "1px" }}>
                                EAVESDROP ACTIVE · PASSIVE OBSERVER MODE
                            </span>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
                        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(33,150,243,0.2) transparent" }}>

                        {chatMessages.length === 0 && (
                            <div className="flex justify-center py-8">
                                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", letterSpacing: "2px" }}>
                                    QUANTUM CHANNEL OPEN · BEGIN TRANSMISSION
                                </span>
                            </div>
                        )}

                        {chatMessages.map((msg, i) => {
                            const isMe = msg.isMe;
                            return (
                                <div key={i} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                                    {/* Avatar */}
                                    <img
                                        src={isMe ? profilePic : msg.senderProfilePic}
                                        alt={msg.sender}
                                        className="w-7 h-7 rounded-full shrink-0 mb-1"
                                        style={{ border: "1.5px solid rgba(33,150,243,0.2)" }}
                                    />
                                    {/* Bubble */}
                                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${isMe ? "rounded-br-sm" : "rounded-bl-sm"}`}
                                        style={{
                                            background: isMe ? "#2196F3" : "rgba(255,255,255,0.07)",
                                            border: isMe ? "none" : "1px solid rgba(255,255,255,0.08)",
                                        }}>
                                        {!isMe && (
                                            <p className="text-xs font-semibold mb-1" style={{ color: "rgba(33,150,243,0.8)" }}>
                                                {msg.sender}
                                            </p>
                                        )}
                                        <p className="text-sm text-white" style={{ lineHeight: 1.5, wordBreak: "break-word" }}>
                                            {msg.message}
                                        </p>
                                        {chatEncryption !== "none" && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={isMe ? "rgba(255,255,255,0.5)" : "rgba(33,150,243,0.5)"} strokeWidth="2">
                                                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                </svg>
                                                <span style={{ fontSize: "9px", letterSpacing: "1px", color: isMe ? "rgba(255,255,255,0.4)" : "rgba(33,150,243,0.5)" }}>
                                                    QUANTUM ENCRYPTED
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Message input — hidden for eavesdropper */}
                    {!isEavesdropper && (
                        <div className="px-4 py-3 shrink-0"
                            style={{ borderTop: "1px solid rgba(33,150,243,0.08)", background: "rgba(9,21,26,0.9)" }}>
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    onKeyDown={handleKey}
                                    placeholder="Enter Text to Send"
                                    className="flex-1 px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                                    style={{
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(33,150,243,0.15)",
                                        fontFamily: "'Courier New', Courier, monospace"
                                    }}
                                    onFocus={e => e.target.style.borderColor = "rgba(33,150,243,0.4)"}
                                    onBlur={e => e.target.style.borderColor = "rgba(33,150,243,0.15)"}
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!message.trim()}
                                    className="w-11 h-11 flex items-center justify-center rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                    style={{
                                        background: "linear-gradient(135deg, #2196F3, #1565C0)",
                                        boxShadow: "0 0 16px rgba(33,150,243,0.3)"
                                    }}
                                    onMouseEnter={e => { if (message.trim()) e.currentTarget.style.boxShadow = "0 0 24px rgba(33,150,243,0.5)"; }}
                                    onMouseLeave={e => e.currentTarget.style.boxShadow = "0 0 16px rgba(33,150,243,0.3)"}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                        <line x1="22" y1="2" x2="11" y2="13" />
                                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Eavesdrop footer bar */}
                    {isEavesdropper && (
                        <div className="py-2 flex justify-center"
                            style={{ borderTop: "1px solid rgba(33,150,243,0.08)" }}>
                            <span style={{ fontSize: "10px", letterSpacing: "2px", color: "rgba(33,150,243,0.4)" }}>
                                MONITORING STREAM · PASSIVE OBSERVER MODE
                            </span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default ChatSession;
