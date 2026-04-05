import { useContext, useEffect, useRef, useState } from "react";
import HomeContext from "../../../contexts/HomeContext";
import { toast } from "react-toastify";
import qcCaller from "../../../lib/qc";
import { encrypt, decrypt } from "../../../lib/protector";

function ChatSession() {
    /**
     * If freeToChat is true, display ChatSession with send message bar and button (not for eavesdropper)
     * Else, display ChatSession with ChatSessionStatus
     * 
     * If typeOfEncryption is bb84, display QBER on the same bar as close button
     * 
     * after free to chat, set a timer that calls timerEnds() at the end
     */
    const {
        chatSessionTimer, chatEncryption,
        chatRoomId, chatRole, chatUsesSimulator,
        socketRef, userId, profilePic,
        statusWindow, setStatusWindow,
        resetChatWindow,
        qkeyBases, qkeyBits
    } = useContext(HomeContext);

    const [freeToChat, setFreeToChat] = useState(false);
    
    const siftedQkeyBits = useRef("");
    const [QBER, setQBER] = useState(null);

    const [chatMessages, setChatMessages] = useState([]);
    const [message, setMessage] = useState([]);

    function siftKey(receivedBases) {
        const myBases = qkeyBases.current;
        const indicesToDelete = [];

        for (let i = 0; i < myBases.length; i++) {
            if (receivedBases[i] !== myBases[i]) {
                indicesToDelete.push(i);
            }
        }

        let myKey = qkeyBits.current;
        for (let i = indicesToDelete.length - 1; i >= 0; i--) {
            myKey = myKey.slice(0, indicesToDelete[i]) + myKey.slice(indicesToDelete[i] + 1);
        }

        siftedQkeyBits.current = myKey;
    }

    function getRandBits(randIndices) {
        let randBits = "";
        let myKey = siftedQkeyBits.current;

        for (const ind of randIndices) {
            randBits += myKey[ind];
        }

        for (let i = randIndices.length - 1; i >= 0; i--) {
            myKey = myKey.slice(0, randIndices[i]) + myKey.slice(randIndices[i] + 1);
        }

        siftedQkeyBits.current = myKey;
        return randBits;
    }

    function qberCalculator(randIndices, randBits) {
        const myRandBits = getRandBits(randIndices);
        const comparedBits = randBits.length;
        let mismatchedBits = 0;
        
        for (let i = 0; i < comparedBits; i++) {
            if (myRandBits[i] !== randBits[i])
                mismatchedBits++;
        }

        return (mismatchedBits / comparedBits) * 100;
    }

    function sessionStarted() {
        setFreeToChat(true);
        toast.success("You are free to chat!");
    }

    function sendMessage() {
        const socket = socketRef.current;

        let messageToSend = message;
        setChatMessages([...chatMessages, { messageToSend, userId, profilePic }]);
        
        if (chatEncryption !== "none")
            messageToSend = encrypt(messageToSend, siftedQkeyBits.current);

        socket.emit("sendMessage", chatRoomId, messageToSend);
    }

    function closeChatSession() {
        const socket = socketRef.current;
        socket.emit("sessionDisturbed", "Participant left");
        resetChatWindow();
        toast.success("Left chat session!");
    }

    function timerEnds() {
        const socket = socketRef.current;
        socket.emit("sessionEnd");
        resetChatWindow();
        toast.success("Chat session ended successfully!");
    }

    useEffect(() => {        
        const socket = socketRef.current;

        if (chatEncryption === "none") {
            setStatusWindow("");
            if (chatRole !== "eavesdropper")
                sessionStarted();
            else
                toast.success("Eavesdropping successfully!");
        }
        else {
            setStatusWindow("Securing session...");

            if (chatRole === "sender") {
                socket.once("bases", async (bases) => {                    
                    socket.emit("shareBases", chatRoomId, qkeyBases.current);
                    siftKey(bases);
                    setStatusWindow("Sharing bases for sifting key...");
                    
                    try {
                        const response = await qcCaller.get(
                        `/getRandomIndices/${chatUsesSimulator ? "sim" : "hw"}?keyLength=${siftedQkeyBits.current.length}`
                        );
                        
                        const randIndices = response.data.randIndices;
                        const randBits = getRandBits(randIndices);

                        setStatusWindow("Key generated! Requesting for QBER...");
                        socket.emit("calculateQBER", chatRoomId, { randIndices, randBits });

                        socket.once("qberResult", (receivedQber) => {
                            if (receivedQber > 10) {
                                setStatusWindow("Session compromised. QBER too high to continue. There might be an eavesdropper!");
                                socket.emit("resetSocketStats");
                                toast.error("Session compromised!");
                                resetChatWindow();
                            }
                            else {
                                setStatusWindow(`Measured QBER is ${receivedQber}%....`);
                                socket.emit("updateOnQBERAccept", chatRoomId);
                                setQBER(receivedQber);
                                sessionStarted();
                            }
                        });
                    }
                    catch (error) {
                        socket.emit("sessionDisturbed", chatRoomId, "Could not request for QBER!");

                        toast.error("Could not request for QBER!");
                        console.error(error);
                        resetChatWindow();
                    }
                    finally {
                        setStatusWindow("");
                    }
                });
            }
            else if (chatRole === "eavesdropper") {
                socket.once("ackFromHost", async () => {
                    try {
                        const response = await qcCaller.get(`/distributeRawKey/${userId}`);
                        qkeyBases.current = response.data.bases;
                        qkeyBits.current = response.data.bits;

                        setStatusWindow("Intercepted bits and resent to receiver, waiting on receiver end...");

                        socket.once("qberResult", (receivedQber) => {
                            setStatusWindow(`Measured QBER is ${receivedQber}%....`);

                            if (receivedQber > 10) {
                                setStatusWindow("QBER is too high! You are detected!");
                                toast.error("Detected by BB84 QKD algorithm!");
                                resetChatWindow();
                            }
                            else {
                                socket.emit("updateOnQBERAccept", chatRoomId);
                                toast.success("Eavesdropping successfully!");
                            }
                        });
                    }
                    catch (error) {
                        toast.error("Unexpected error occurred!");
                        console.error(error);
                        resetChatWindow();
                    }
                    finally {
                        setStatusWindow("");
                    }
                });
            }
            else { // role would be receiver
                socket.once("ackFromHost", async () => {
                    let tryLaterCount = 0;
                    const intervalId = setInterval(async () => {
                        try {
                            const response = await qcCaller.get(`/distributeRawKey/${userId}`);
                            clearInterval(intervalId);
        
                            qkeyBases.current = response.data.bases;
                            qkeyBits.current = response.data.bits;

                            socket.emit("shareBases", chatRoomId, qkeyBases.current);
                            setStatusWindow("Key generated! Sharing bases...");

                            socket.once("bases", (bases) => {
                                socket.once("qber", ({ randIndices, randBits }) => {
                                    siftKey(bases);
                                    setStatusWindow("Key sifted successfully! Calculating QBER...");

                                    const calcQber = qberCalculator(randIndices, randBits);
                                    setStatusWindow(`Measured QBER is ${calcQber}%....`);

                                    socket.emit("shareQBERResult", chatRoomId, calcQber);

                                    if (calcQber < 10) {
                                        setQBER(calcQber);
                                        setStatusWindow("");
                                        sessionStarted();
                                    }
                                    else {
                                        setStatusWindow("Session compromised. QBER too high to continue. There might be an eavesdropper!");
                                        socket.emit("leave");
                                        toast.error("Session compromised!");
                                        resetChatWindow();
                                    }
                                    setStatusWindow("");
                                });
                            });
                        }
                        catch (error) {
                            if (error.response?.status === 425 && tryLaterCount <= 3) {
                                tryLaterCount++;
                            }
                            else {
                                toast.error("Key generation failed!");
                                console.error(error);
                                socket.emit("sessionDisturbed", chatRoomId, "Key Generation Failed!");
                                resetChatWindow();
                            }
                        }
                    }, 5000);
                });
            }

            socket.on("message", (message, sender, senderProfilePic) => {
                let receivedMessage = message;
                
                if (chatEncryption !== "none")
                    receivedMessage = decrypt(receivedMessage, siftedQkeyBits.current);

                setChatMessages((chatMessages) => 
                    [...chatMessages, { message: receivedMessage, sender, senderProfilePic }]);
            });

            socket.on("sessionEnd", () => {
                if (userId !== chatRoomId)
                    socket.emit("leave");

                toast.info("Session ended gracefully");
                resetChatWindow();
            });

            socket.on("sessionDisturbed", (message) => {
                if (userId !== chatRoomId)
                    socket.emit("leave");

                toast.error(message);
                resetChatWindow();
            })
        }

        return () => {
            socket.off("message");
            socket.off("sessionEnd");
            socket.off("sessionDisturbed");
        };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <>
        </>
    );
}

export default ChatSession;