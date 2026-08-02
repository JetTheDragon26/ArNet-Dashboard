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
