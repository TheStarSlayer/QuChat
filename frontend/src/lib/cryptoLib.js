export const getAESKey = async (key) => {
    const encoder = new TextEncoder();
    const hashedKey = await crypto.subtle.digest("SHA-256", encoder.encode(key));

    return await crypto.subtle.importKey(
        "raw", hashedKey, "AES-GCM", false, ["encrypt", "decrypt"]
    );
}

export const hashFile = async (fileBlob) => {
    const arrayBuffer = await fileBlob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    
    return hashHex;
};

export const encrypt = async (text, cryptoKey) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        data
    );

    // combine IV + encrypted
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...result)); // base64 for storage
};

export const decrypt = async (cipherText, cryptoKey) => {
    const binary = atob(cipherText);
    const data = Uint8Array.from(binary, c => c.charCodeAt(0));

    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);

    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            cryptoKey,
            encrypted
        );

        return new TextDecoder().decode(decrypted);
    }
    catch {
        return "";
    }
};

export const encryptFile = async (fileBlob, key) => {
    const fileBuffer = await fileBlob.arrayBuffer();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key, fileBuffer
    );

    const result = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encryptedBuffer), iv.length);

    return result;
};

export const decryptFile = async (encryptedBlob, key) => {
    const buffer = await encryptedBlob.arrayBuffer();
    const data = new Uint8Array(buffer);

    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);

    try {
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key, encrypted
        );

        return new Blob([decryptedBuffer]);
    }
    catch {
        return null;
    }
};