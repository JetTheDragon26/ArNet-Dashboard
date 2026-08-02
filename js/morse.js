// ======================================================
// ArNet Transceiver
// Morse Code Utilities
// ======================================================

const morseDict = {
    A: ".-",
    B: "-...",
    C: "-.-.",
    D: "-..",
    E: ".",
    F: "..-.",
    G: "--.",
    H: "....",
    I: "..",
    J: ".---",
    K: "-.-",
    L: ".-..",
    M: "--",
    N: "-.",
    O: "---",
    P: ".--.",
    Q: "--.-",
    R: ".-.",
    S: "...",
    T: "-",
    U: "..-",
    V: "...-",
    W: ".--",
    X: "-..-",
    Y: "-.--",
    Z: "--..",

    0: "-----",
    1: ".----",
    2: "..---",
    3: "...--",
    4: "....-",
    5: ".....",
    6: "-....",
    7: "--...",
    8: "---..",
    9: "----.",

    "/": "-..-.",
    " ": " "
};

/**
 * Converts normal text into a Morse-code string.
 *
 * @param {string} text
 * @returns {string}
 */
function textToMorse(text) {
    return text
        .toUpperCase()
        .split("")
        .map(character => morseDict[character] || "")
        .join(" ");
}

// ======================================================
// Morse decoding and display
// ======================================================

const reverseMorseDict =
    Object.fromEntries(
        Object.entries(
            morseDict
        )
            .filter(
                ([character]) =>
                    character !== " "
            )
            .map(
                ([character, code]) => [
                    code,
                    character
                ]
            )
    );

/**
 * Converts dots and dashes into readable text.
 *
 * Letters should be separated by spaces.
 * Words should be separated by "/" or three spaces.
 *
 * @param {string} morse
 * @returns {string}
 */
function morseToText(morse) {
    if (
        typeof morse !== "string"
    ) {
        return "";
    }

    return morse
        .trim()
        .split(
            /\s{3,}|\s*\/\s*/
        )
        .map(
            word =>
                word
                    .trim()
                    .split(/\s+/)
                    .map(
                        code =>
                            reverseMorseDict[
                                code
                            ] || "?"
                    )
                    .join("")
        )
        .join(" ");
}

/**
 * Displays a decoded Morse transmission.
 *
 * @param {string} text
 * @param {object} information
 */
function displayDecodedMorse(
    text,
    information = {}
) {
    if (
        !txtMorseDecode ||
        !txtMorseDecodeInfo
    ) {
        return;
    }

    const decodedText =
        String(
            text ||
            ""
        )
            .trim()
            .toUpperCase();

    if (!decodedText) {
        return;
    }

    lastDecodedMorseText =
        decodedText;

    const sender =
        information.sender ||
        "UNKNOWN";

    const frequency =
        information.frequency ??
        txtFrequency.value;

    const kind =
        information.kind ||
        "MORSE";

    const time =
        new Date()
            .toLocaleTimeString();

    if (
        txtMorseDecode.textContent
            .trim() ===
        "Waiting for Morse transmission..."
    ) {
        txtMorseDecode.textContent =
            "";
    }

    const line =
        `[${time}] ${sender}: ${decodedText}`;

    txtMorseDecode.textContent +=
        (
            txtMorseDecode.textContent
                ? "\n"
                : ""
        ) +
        line;

    txtMorseDecode.scrollTop =
        txtMorseDecode.scrollHeight;

    txtMorseDecodeInfo.textContent =
        `${kind} decoded from ${sender} ` +
        `on ${frequency} Vt.`;
}

/**
 * Clears the Morse decoder display.
 */
function clearMorseDecoderDisplay() {
    lastDecodedMorseText =
        "";

    if (txtMorseDecode) {
        txtMorseDecode.textContent =
            "Waiting for Morse transmission...";
    }

    if (txtMorseDecodeInfo) {
        txtMorseDecodeInfo.textContent =
            "No Morse signal received.";
    }
}

if (btnClearMorseDecode) {
    btnClearMorseDecode.addEventListener(
        "click",
        clearMorseDecoderDisplay
    );
}