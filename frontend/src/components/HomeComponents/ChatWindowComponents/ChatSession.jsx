import { useContext, useEffect, useRef, useState } from "react";
import HomeContext from "../../../contexts/HomeContext";
import { toast } from "react-toastify";
import qcCaller from "../../../lib/qc";
import { encrypt, decrypt, encryptFile, decryptFile, getAESKey, hashFile } from "../../../lib/cryptoLib";
import ChatSessionStatus from "./ChatSessionStatus";
import apiCaller from "../../../lib/api";
import axios from "axios";

function ChatSession() {
    const {
        chatSessionTimer, chatEncryption,
        chatRoomId, chatRole, chatUsesSimulator,
        socketRef, userId, profilePic,
        resetChatWindow, setWindowLoading
    } = useContext(HomeContext);

    const [statusWindow, setStatusWindow] = useState("Starting up session..");

    const [freeToChat, setFreeToChat] = useState(false);
    const [QBER, setQBER] = useState(null);
    const [timeLeft, setTimeLeft] = useState(chatSessionTimer * 60);

    const [message, setMessage] = useState("");
    const [chatMessages, setChatMessages] = useState([]);
    const [sendingFile, setSendingFile] = useState("");
    
    const qkeyBases = useRef("");
    const qkeyBits = useRef("");
    const siftedQkeyBits = useRef("");
    const quantumKey = useRef(null);

    const sessionLoaded = useRef(false)
    const intervalId = useRef(null);
    const tryAgainLater = useRef(0);
    const isRequestInProgress = useRef(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const isSetToBusy = useRef(false);
    const filesSentByMe = useRef([]);

    const QBERThreshold = chatUsesSimulator ? 0 : 10;

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

        const qber = (mismatched / hostRandBits.length) * 100;
        return Math.trunc(qber * 1000) / 1000;
    }

    async function sessionStarted() {
        setFreeToChat(true);
        if (chatRole !== "eavesdropper")
            toast.success("You are free to chat!");
        else
            toast.success("Eavesdropped successfully! You can now secretly view the chat!");

        if (chatEncryption === "bb84")
            quantumKey.current = await getAESKey(siftedQkeyBits.current);
    }

    async function sendMessage() {
        const socket = socketRef.current;

        if (sendingFile === "" && message.trim() === "")
            return;

        let fileToSend = sendingFile;
        const fileName = fileToSend !== "" ? sendingFile.name : "";
        const fileType = fileToSend !== "" ? sendingFile.type : "";
        let messageToSend = message;

        setMessage("");
        setSendingFile("");

        let key = "";

        if (fileToSend !== "") {
            toast.info("Uploading file...");

            const sendingOn = Date.now();
            const interMessage = {
                isUploading: true,
                sendingOn: sendingOn,
                message: messageToSend,
                sender: userId,
                senderProfilePic: profilePic,
                isMe: true,
                containsFile: true,
                fileKey: key,
                fileName: fileName
            };

            setChatMessages(prev => 
                [...prev, interMessage]
            );

            try {
                key = await hashFile(fileToSend);
                
                if (chatEncryption === "bb84")
                    fileToSend = await encryptFile(sendingFile, quantumKey.current);
    
                const res = await apiCaller.get(`/getUploadLink`, {
                    params: { bucketName: "quchat", key, fileType }
                });
                const uploadLink = res.data.uploadLink;

                await axios.put(uploadLink, fileToSend, {
                    headers: { "Content-Type": fileType }
                });

                filesSentByMe.current.push(key);

                toast.success("File uploaded successfully!");
                setChatMessages(prev => 
                    prev.filter(message => message?.sendingOn !== sendingOn)
                );
            }
            catch (error) {
                console.error(error);
                toast.error("Failed to send message - cannot upload file!");
                setChatMessages(prev => 
                    prev.map(message => {
                        try {
                            if (message.sendingOn === sendingOn)
                                message.isUploading = false;
                            return message;
                        }
                        catch {
                            return message;
                        }
                    })
                );
                return;
            }
        }

        const newMessage = {
            message: messageToSend,
            sender: userId,
            senderProfilePic: profilePic,
            isMe: true,
            containsFile: fileToSend === "" ? false : true,
            fileName: fileToSend === "" ? null : fileName,
            fileKey: fileToSend === "" ? null : key,
        };

        let receivedMessage = newMessage.message;
        setChatMessages(prev => 
            [...prev, {...newMessage, message: receivedMessage}]
        );

        if (chatEncryption !== "none")
            newMessage.message = await encrypt(newMessage.message, quantumKey.current);
        
        socket.emit("sendMessage", chatRoomId, newMessage);
    }

    function checkFileSize(file) {
        const MAX_FILE_SIZE = 100 * 1024 * 1024;
        if (!file)
            return false;
        return file.size <= MAX_FILE_SIZE;
    }

    function handleFileSelect(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!checkFileSize(file)) {
            toast.error("File too large!");
            e.target.value = "";
            setSendingFile("");
            return;
        }

        setSendingFile(file);
    }

    async function downloadFile(key) {
        const res = await apiCaller.get("/getDownloadLink", {
            params: { bucketName: "quchat", key, expiresInMin: chatSessionTimer }
        });

        const url = res.data.downloadLink;

        const fileRes = await axios.get(url, {
            responseType: "blob",
        });

        return fileRes.data;
    }

    async function handleDownload(key, name, index) {
        try {
            toast.info("Downloading file...");
            
            setChatMessages(prev =>
                prev.map((msg, i) =>
                    i === index ? { ...msg, isDownloading: true } : msg
                )
            );

            let blob = await downloadFile(key);

            if (chatEncryption === "bb84") {
                blob = await decryptFile(blob, quantumKey.current);
                if (blob === null) {
                    throw new Error("Failed to decrypt file!");
                }
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success("File downloaded!");
        }
        catch (error) {
            console.error(error);
            toast.error("Cannot download file!");
        }
        finally {
            setChatMessages(prev =>
                prev.map((msg, i) =>
                    i === index ? { ...msg, isDownloading: false } : msg
                )
            );
        }
    }

    function closeChatSession() {
        const socket = socketRef.current;
        
        if (chatRole !== "eavesdropper")
            socket.emit("sessionDisturbed", chatRoomId, "Participant left");
        else
            socket.emit("leave", chatRoomId);
        
        setWindowLoading("Exiting!");
        setTimeout(() => resetChatWindow(), 1000);
        toast.success("Left chat session!");
    }

    function timerEnds() {
        const socket = socketRef.current;
        socket.emit("sessionEnd", chatRoomId);
        setTimeout(() => resetChatWindow(), 1000);
        toast.success("Chat session ended successfully!");
    }

    async function setToBusy() {
        isSetToBusy.current = true;
        await apiCaller.patch("/setToBusy");
        toast.info("You cannot receive requests for now!");
    }

    const handleKey = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

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

    // Session securing useEffect
    useEffect(() => {
        if (sessionLoaded.current)
            return;

        sessionLoaded.current = true;
        const socket = socketRef.current;

        if (chatEncryption === "none") {
            setToBusy();

            if (chatRole === "host") {
                setStatusWindow("Starting session!");
                socket.emit("joinAck", userId, true);
                sessionStarted();
            }
            else {
                setStatusWindow("Waiting for acknowledgement of session from host...");
                socket.once("ackFromHost", (ack) => {
                    if (!ack) {
                        setStatusWindow("Host did not acknowledge session!");
                        setTimeout(() => resetChatWindow(), 1000);
                        toast.info("Host did not acknowledge session!");
                    }
                    else {
                        setStatusWindow("Received acknowledgment...starting session...");
                        sessionStarted();
                    }
                });
            }
        }
        else {
            setStatusWindow("Securing session...");

            if (chatRole === "host") {
                setStatusWindow("Generating bits and bases...");

                qcCaller.post(`/distributeRawKey/${userId}`)
                .then((res) => {
                    if (!sessionLoaded.current) return;
                    qkeyBases.current = res.data.bases;
                    qkeyBits.current = res.data.bits;          
                    setStatusWindow("Bits and bases generated successfully!")
                    socket.emit("joinAck", userId, true);
                    setToBusy();

                    socket.once("bases", async (bases) => {                      
                        setStatusWindow("Sifting key based on receiver's bases...");  
                        siftKey(bases);

                        setStatusWindow("Sharing bases to receiver...");
                        socket.emit("shareBases", chatRoomId, qkeyBases.current);

                        try {
                            setStatusWindow("Selecting random indices for QBER calculations...");
                            const response = await qcCaller.post(
                                `/generateRandomIndices`, {
                                    typeOfMachine: chatUsesSimulator ? "sim" : "hw",
                                    keyLength: siftedQkeyBits.current.length
                                }
                            );

                            if (!sessionLoaded.current) return;

                            const randIndices = response.data.randIndices;
                            const randBits = getRandBits(randIndices);

                            setStatusWindow("Requesting for QBER...");
                            socket.emit("calculateQBER", chatRoomId, { randIndices, randBits });

                            socket.once("qberResult", async (receivedQber) => {
                                toast.info(`QBER value: ${receivedQber}`);
                                
                                if (receivedQber <= QBERThreshold && receivedQber !== null) {
                                    setQBER(receivedQber);
                                    setStatusWindow(`QBER is ${receivedQber}...Generating BCH ECC metadata...`);

                                    const res = await qcCaller.post("/generateECMetadata", {
                                        key: siftedQkeyBits.current
                                    });
                                    if (!sessionLoaded.current) return;

                                    const parityBits = res.data.parityBits;

                                    setStatusWindow("Waiting for receiver to correct their key...");
                                    socket.emit("sendParityBits", chatRoomId, parityBits);

                                    socket.once("keyCorrected", () => {
                                        socket.emit("updateOnQBERAccept", chatRoomId);
                                        sessionStarted();
                                    });
                                }
                                else {
                                    setStatusWindow("Session compromised! QBER too high.");
                                    socket.emit("resetSocketStats");
                                    toast.error("Session compromised!");
                                    
                                    setTimeout(() => resetChatWindow(), 1000);
                                }
                            });
                        }
                        catch {
                            socket.emit("sessionDisturbed", chatRoomId, "Could not request for QBER!");
                            toast.error("Could not request for QBER!");
                            setTimeout(() => resetChatWindow(), 1000);
                        }
                    });
                })
                .catch(() => {
                    socket.emit("joinAck", userId, false);
                    toast.error("Key generation failed!");
                    setTimeout(() => resetChatWindow(), 1000);
                });
            }
            else if (chatRole === "eavesdropper") {
                setStatusWindow("Waiting for acknowledgement of session from host...");

                socket.once("ackFromHost", async (ack) => {
                    setToBusy();
                    if (!ack) {
                        setStatusWindow("Host did not acknowledge session!");
                        setTimeout(() => resetChatWindow(), 1000);
                        toast.info("Host did not acknowledge session!");
                    }
                    else {
                        try {
                            setStatusWindow("Received acknowledgment of session...intercepting key...");

                            const response = await qcCaller.post(`/distributeRawKey/${chatRoomId}`);
                            if (!sessionLoaded.current) return;

                            qkeyBases.current = response.data.bases;
                            qkeyBits.current = response.data.bits;

                            setStatusWindow("Intercepted bits and resent to receiver...");

                            let timesBasesIntercepted = 0;
                            socket.on("bases", (bases) => {
                                if (timesBasesIntercepted === 0) {
                                    setStatusWindow(`Intercepted receiver's bases logged in console`);
                                    console.log("Receiver's bases:", bases);
                                    timesBasesIntercepted++;
                                }
                                else {
                                    setStatusWindow(`Intercepted host's bases logged in console`);
                                    console.log("Host's bases:", bases);
                                    socket.off("bases");
                                }
                            });

                            socket.once("qber", ({ randIndices }) => {
                                setStatusWindow("Intercepted random indices from host to discard...");
                                
                                const _ = getRandBits(randIndices);
                                socket.off("bases");

                                setStatusWindow("Waiting for QBER results...");

                                socket.once("qberResult", (receivedQber) => {
                                    if (receivedQber > QBERThreshold) {
                                        toast.error("Detected by BB84 QKD algorithm!");
                                        
                                        setTimeout(() => resetChatWindow(), 1000);
                                    }
                                    else {
                                        setQBER(receivedQber);
                                        setStatusWindow(`QBER is ${receivedQber}...Waiting for host to generate BCH ECC metadata...`);
                                        
                                        socket.once("parity", async (parityBits) => {
                                            setStatusWindow("Correcting key...");

                                            const keyWithParity = siftedQkeyBits.current + parityBits;
                                            const res = await qcCaller.post("/correctErrorsInKey", {
                                                key: keyWithParity
                                            });
                                            if (!sessionLoaded.current) return;

                                            siftedQkeyBits.current = (res.data.key).substring(0, (siftedQkeyBits.current).length);

                                            setStatusWindow("Waiting for receiver to correct their key...");

                                            socket.once("keyCorrected", () => {
                                                socket.emit("updateOnQBERAccept", chatRoomId);
                                                toast.success("Eavesdropping successfully!");
                                                sessionStarted();
                                            });
                                        });
                                    }
                                });
                            });
                        }
                        catch {
                            socket.emit("leave", chatRoomId);
                            toast.error("Unexpected error occurred!");
                            
                            setTimeout(() => resetChatWindow(), 1000);
                        }
                    }
                });
            }
            else {
                setStatusWindow("Waiting for acknowledgement of session from host...");

                socket.once("ackFromHost", async (ack) => {
                    setToBusy();
                    if (!ack) {
                        setStatusWindow("Host did not acknowledge session!");
                        setTimeout(() => resetChatWindow(), 1000);
                        toast.info("Host did not acknowledge session!");
                    }
                    else {
                        setStatusWindow("Received acknowledgement, generating key...This may take some time!");
                        let intervalTime = chatUsesSimulator ? 6000 : 9000;

                        tryAgainLater.current = 0;
                        isRequestInProgress.current = false;

                        intervalId.current = setInterval(async () => {
                            if (isRequestInProgress.current)
                                return;
                            isRequestInProgress.current = true;

                            try {
                                const response = await qcCaller.post(`/distributeRawKey/${chatRoomId}`);
                                if (!sessionLoaded.current) return;
                                
                                clearInterval(intervalId.current);
                                intervalId.current = null;
                                
                                qkeyBases.current = response.data.bases;
                                qkeyBits.current = response.data.bits;

                                setStatusWindow("Key generated! Sharing bases...");
                                socket.emit("shareBases", chatRoomId, qkeyBases.current);

                                socket.once("bases", (bases) => {
                                    setStatusWindow("Received bases from host...");
                                    socket.once("qber", ({ randIndices, randBits }) => {
                                        setStatusWindow("Sifting key...");
                                        siftKey(bases);

                                        setStatusWindow("Calculating QBER...");

                                        const myRandBits = getRandBits(randIndices);
                                        const calcQber = qberCalculator(randBits, myRandBits);

                                        toast.info(`QBER value: ${calcQber}`);

                                        socket.emit("shareQBERResult", chatRoomId, calcQber);
                                        if (calcQber <= QBERThreshold) {
                                            setQBER(calcQber);
                                            setStatusWindow(`QBER is ${calcQber}...Waiting for host to generate BCH ECC metadata...`);

                                            socket.once("parity", async (parityBits) => {
                                                setStatusWindow("Correcting key...");

                                                const keyWithParity = siftedQkeyBits.current + parityBits;

                                                const res = await qcCaller.post("/correctErrorsInKey", {
                                                    key: keyWithParity
                                                });
                                                if (!sessionLoaded.current) return;

                                                siftedQkeyBits.current = (res.data.key).substring(0, (siftedQkeyBits.current).length);

                                                socket.emit("keyCorrected", chatRoomId);
                                                sessionStarted();
                                            });
                                        }
                                        else {
                                            setStatusWindow("Session compromised!");
                                            socket.emit("leave", chatRoomId);
                                            toast.error("Session compromised!");
                                            
                                            setTimeout(() => resetChatWindow(), 1000);
                                        }
                                    });
                                });
                            }
                            catch (error) {
                                if (error.response?.status === 425 && tryAgainLater.current <= 3)
                                    tryAgainLater.current++;
                                else {
                                    clearInterval(intervalId.current);
                                    intervalId.current = null;
                                    toast.error("Key generation failed!");
                                    socket.emit("sessionDisturbed", chatRoomId, "Key Generation Failed!");
                                    
                                    setTimeout(() => resetChatWindow(), 1000);
                                }
                            }
                            finally {
                                isRequestInProgress.current = false;
                            }
                        }, intervalTime);
                    }
                });
            }
        }

        socket.on("message", async (message) => {
            let receivedMessage = message.message;
            
            if (chatEncryption !== "none") {
                receivedMessage = await decrypt(receivedMessage, quantumKey.current);

                if (!message.containsFile && !receivedMessage.trim()) {
                    socket.emit("sessionDisturbed", chatRoomId, "sample_error");

                    toast.error("Generated keys are not the same!");
                    toast.error("This means that sampling/error correction missed mismatched bits.");
                    
                    setTimeout(() => resetChatWindow(), 1000);
                    return;
                }
            }
            setChatMessages(prev => 
                [...prev, {
                    message: receivedMessage,
                    sender: message.sender, 
                    senderProfilePic: message.profilePic, 
                    isMe: false,
                    containsFile: message.containsFile,
                    fileName: message.fileName,
                    fileKey: message.fileKey,
                    isDownloading: false
                }]
            );
        });

        socket.on("keyGenFailed", async (msg) => {
            if (userId !== chatRoomId)
                socket.emit("leave", chatRoomId);
            else {
                try {
                    await qcCaller.delete(`/deleteMetadata/${chatRoomId}`);
                }
                catch {
                    toast.info("Could not delete metadata");
                    toast.info("Either it was not created, or already deleted!");
                }
            }

            toast.error(msg);
            setTimeout(() => resetChatWindow(), 1000);
        });

        socket.on("sessionEnd", () => {
            if (userId !== chatRoomId)
                socket.emit("leave", chatRoomId);

            toast.info("Session ended gracefully");
            setTimeout(() => resetChatWindow(), 1000);            
        });

        socket.on("sessionDisturbed", (msg) => {
            if (userId !== chatRoomId)
                socket.emit("leave", chatRoomId);

            if (msg === "sample_error") {
                toast.error("Generated keys are not the same!");
                toast.error("This means that sampling/error correction missed mismatched bits.");
            }
            else
                toast.error(msg);
            
            setTimeout(() => resetChatWindow(), 1000);
        });

        return () => {
            sessionLoaded.current = false;

            socket.off("message"); socket.off("sessionEnd");
            socket.off("sessionDisturbed"); socket.off("keyGenFailed");
            socket.off("ackFromHost"); socket.off("bases"); socket.off("qberResult");
            socket.off("keyCorrected"); socket.off("qber"); socket.off("parity");

            if (intervalId.current != null) {
                clearInterval(intervalId.current);
                intervalId.current = null;
            }

            (async () => {
                if (isSetToBusy.current) {
                    await apiCaller.patch("/setToAvailable");
                    toast.info("You are now available for requests!");
                    isSetToBusy.current = false;
                }

                // Delete files that are added by sender
                try {
                    if (filesSentByMe.current.length > 0) {
                        await apiCaller.delete("/deleteObjects", {
                            data: {
                                bucketName: "quchat",
                                // eslint-disable-next-line react-hooks/exhaustive-deps
                                keys: filesSentByMe.current
                            }
                        });
                        toast.success("All files sent by you are no longer stored online!");
                    }
                }
                catch {
                    toast.info("Could not delete all files sent by you!");
                }

                resetChatWindow();
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
                        <span style={{ fontSize: "12px", color: "#2196F3", letterSpacing: "1px" }}>
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

                                        {msg.containsFile ? (
                                            <>
                                                {msg.message && (
                                                    <p className="text-sm text-white mb-2" style={{ lineHeight: 1.5, wordBreak: "break-word" }}>
                                                        {msg.message}
                                                    </p>
                                                )}

                                                <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl"
                                                    style={{
                                                        background: isMe ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.02)",
                                                        border: "1px solid rgba(33,150,243,0.12)",
                                                        minWidth: 180
                                                    }}>
                                                    <div className="min-w-0 flex items-center gap-3">
                                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isMe ? "rgba(255,255,255,0.85)" : "#2196F3"} strokeWidth="1.5" className="shrink-0">
                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                            <path d="M14 2v6h6" />
                                                        </svg>
                                                        <div className="min-w-0">
                                                            <p className="text-sm text-white font-semibold truncate" style={{ lineHeight: 1.2 }}>
                                                                {msg.fileName || msg.fileKey || 'File'}
                                                            </p>
                                                            {msg.message && <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)", margin: 0 }}>Attachment</p>}
                                                        </div>
                                                    </div>

                                                    {!isMe ? (
                                                        msg.isDownloading ? (
                                                            <div title="Downloading..." className="flex items-center">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2">
                                                                    <g>
                                                                        <path d="M12 2a10 10 0 0 0 0 20" strokeLinecap="round" />
                                                                        <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
                                                                    </g>
                                                                </svg>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleDownload(msg.fileKey, msg.fileName, i)}
                                                                className="px-3 py-2 rounded-xl text-sm font-semibold transition-all"
                                                                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(33,150,243,0.12)", color: "#2196F3" }}
                                                            >
                                                                Download
                                                            </button>
                                                        )
                                                    ) : (
                                                        ('isUploading' in msg) ? (
                                                            msg.isUploading ? (
                                                                <div title="Uploading..." className="flex items-center">
                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2">
                                                                        <g>
                                                                            <path d="M12 2a10 10 0 0 0 0 20" strokeLinecap="round" />
                                                                            <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
                                                                        </g>
                                                                    </svg>
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-red-400 font-semibold" style={{ fontSize: "12px" }}>Failed</div>
                                                            )
                                                        ) : (
                                                            <div className="text-sm text-white opacity-80" style={{ fontSize: "12px" }}>Sent</div>
                                                        )
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-sm text-white" style={{ lineHeight: 1.5, wordBreak: "break-word" }}>
                                                {msg.message}
                                            </p>
                                        )}
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
                                <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" onChange={handleFileSelect} style={{ display: "none" }} />

                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-11 h-11 flex items-center justify-center rounded-xl transition-all shrink-0"
                                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(33,150,243,0.12)", color: "#2196F3" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="14" height="14" rx="2" />
                                        <path d="M8 14l2.5-3 3.5 4" />
                                        <circle cx="18" cy="6" r="2" />
                                        <line x1="18" y1="4" x2="18" y2="8" />
                                        <line x1="16" y1="6" x2="20" y2="6" />
                                    </svg>
                                </button>

                                {sendingFile && (
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full shrink-0"
                                        style={{ background: "rgba(33,150,243,0.12)", border: "1px solid rgba(33,150,243,0.18)" }}>
                                        <p className="text-sm truncate" style={{ color: "#2196F3", maxWidth: 180, margin: 0 }}>{sendingFile.name}</p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSendingFile("");
                                                if (fileInputRef.current) fileInputRef.current.value = "";
                                            }}
                                            className="flex items-center justify-center w-6 h-6 rounded-full transition-all"
                                            style={{ background: "transparent", color: "#2196F3", border: "none" }}
                                            aria-label="Remove file"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    </div>
                                )}

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
                                    disabled={sendingFile === "" && !message.trim()}
                                    className="w-11 h-11 flex items-center justify-center rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                    style={{
                                        background: "linear-gradient(135deg, #2196F3, #1565C0)",
                                        boxShadow: "0 0 16px rgba(33,150,243,0.3)"
                                    }}
                                    onMouseEnter={e => { if (message.trim() || sendingFile) e.currentTarget.style.boxShadow = "0 0 24px rgba(33,150,243,0.5)"; }}
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
