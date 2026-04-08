/**
 * Decodes a base64 string into a Uint8Array.
 */
function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Imports the AES-CTR key for use with the Web Crypto API.
 */
async function getCryptoKey() {
    const b64Key = import.meta.env.VITE_SECRET_KEY || process.env.REACT_APP_SECRET_KEY;
    if (!b64Key) {
        throw new Error("Secret key not found. Ensure VITE_SECRET_KEY or REACT_APP_SECRET_KEY is set.");
    }
    const keyBytes = base64ToUint8Array(b64Key);
    return await window.crypto.subtle.importKey(
        'raw', keyBytes, { name: 'AES-CTR' }, false, ['decrypt']
    );
}

/**
 * Decrypts the streamed response from the corrected FastAPI backend.
 * Reads the b64-nonce line, then decrypts the rest of the raw binary stream.
 *
 * @param {Response} response The raw response object from the fetch call.
 * @returns {Promise<string>} A promise that resolves to the fully decrypted CSV string.
 */
export async function decryptStreamedResponse(response) {
    // This approach is robust because it treats the response as what it is: a binary stream.
    // .arrayBuffer() efficiently reads the entire streamed download into memory.
    const fullResponseBuffer = await response.arrayBuffer();
    const fullResponseBytes = new Uint8Array(fullResponseBuffer);

    // Find the first newline byte (ASCII code 10). This is our separator.
    const newlineIndex = fullResponseBytes.indexOf(10);
    if (newlineIndex === -1) {
        throw new Error("Could not find the nonce separator in the data stream.");
    }

    // The bytes BEFORE the newline are the Base64-encoded nonce.
    const nonceB64Bytes = fullResponseBytes.subarray(0, newlineIndex);

    // The bytes AFTER the newline are the raw, encrypted ciphertext.
    const ciphertextBytes = fullResponseBytes.subarray(newlineIndex + 1);

    // Convert the nonce bytes to a string so we can Base64 decode it.
    const b64Nonce = new TextDecoder().decode(nonceB64Bytes);
    const initialNonce = base64ToUint8Array(b64Nonce);

    if (initialNonce.length !== 8) {
        throw new Error(`Received nonce has an incorrect length. Expected 8 bytes, got ${initialNonce.length}.`);
    }
    console.log("Nonce extracted successfully.");

    // The rest of the payload IS the ciphertext. No further processing is needed.
    const fullCiphertext = ciphertextBytes;
    console.log(`Raw ciphertext received. Total size: ${fullCiphertext.byteLength} bytes.`);

    // Perform a single decryption call on the entire ciphertext.
    const key = await getCryptoKey();
    const counterBlock = new Uint8Array(16);
    counterBlock.set(initialNonce); // First 8 bytes are the nonce, the rest remain 0.

    console.log("Starting final decryption of the full payload...");
    const decryptedPayload = await window.crypto.subtle.decrypt(
        {
            name: 'AES-CTR',
            counter: counterBlock,
            length: 64, // The counter part is the last 64 bits (8 bytes).
        },
        key,
        fullCiphertext
    );

    // Decode the final decrypted bytes into the original CSV string.
    return new TextDecoder().decode(decryptedPayload);
}