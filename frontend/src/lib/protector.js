import CryptoJS from "crypto-js";

export const encrypt = (text, key) => {
    return CryptoJS.AES.encrypt(text, key).toString();
};

export const decrypt = (cipher, key) => {
    return CryptoJS.AES.decrypt(cipher, key).toString(CryptoJS.enc.Utf8);
};

export const privacyAmplification = (key) => {
    return CryptoJS.SHA256(key).toString();
}