
// ======================================================
// ArNet Transceiver
// Audio Decoder
// ======================================================

/**
 * Converts floating-point Web Audio samples into
 * signed 16-bit PCM samples.
 *
 * @param {Float32Array} channelData
 * @returns {Int16Array}
 */
function convertFloatToPcm16(channelData) {
    const pcmSamples =
        new Int16Array(channelData.length);

    for (
        let i = 0;
        i < channelData.length;
        i++
    ) {
        const sample =
            Math.max(
                -1,
                Math.min(
                    1,
                    channelData[i]
                )
            );

        pcmSamples[i] =
            sample < 0
                ? Math.round(
                    sample * 0x8000
                )
                : Math.round(
                    sample * 0x7FFF
                );
    }

    return pcmSamples;
}

/**
 * Creates the status description shown after an
 * audio stream has been decoded.
 *
 * @param {string} mode
 * @param {number} duration
 * @returns {string}
 */
function createDecodeSummary(
    mode,
    duration
) {
    const formattedDuration =
        duration.toFixed(2);

    if (mode === "ABMTV") {
        return (
            "ABMTV Video Stream Frames Extracted " +
            `(${formattedDuration}s). ` +
            "Image subcarrier locked."
        );
    }

    if (mode === "ABM") {
        return (
            "ABM Audio Demodulated " +
            `(${formattedDuration}s). ` +
            "Data tones translated."
        );
    }

    return (
        "AARM Stream Decoded " +
        `(${formattedDuration}s).`
    );
}

/**
 * Decodes any browser-supported audio Blob or File.
 *
 * This is the central incoming-audio decoder.
 *
 * It can be used with:
 * - imported WAV files
 * - WAV data extracted from AMMEF
 * - future Internet audio packets
 *
 * @param {Blob} audioBlob
 * @returns {Promise<{
 *     audioBlob: Blob,
 *     decodedAudio: AudioBuffer,
 *     pcmSamples: Int16Array,
 *     duration: number,
 *     sampleRate: number
 * }>}
 */
async function decodeAudioBlob(audioBlob) {
    if (!(audioBlob instanceof Blob)) {
        throw new TypeError(
            "decodeAudioBlob requires a Blob or File."
        );
    }

    initAudioContext();

    if (
        audioCtx &&
        audioCtx.state === "suspended"
    ) {
        await audioCtx.resume();
    }

    const arrayBuffer =
        await audioBlob.arrayBuffer();

    /*
     * Slice the buffer before passing it into
     * decodeAudioData. Some browsers may detach the
     * supplied ArrayBuffer while decoding.
     */
    const decodingBuffer =
        arrayBuffer.slice(0);

    const decodedAudio =
        await audioCtx.decodeAudioData(
            decodingBuffer
        );

    if (
        !decodedAudio ||
        decodedAudio.numberOfChannels < 1
    ) {
        throw new Error(
            "The audio file contains no usable channels."
        );
    }

    const channelData =
        decodedAudio.getChannelData(0);

    const pcmSamples =
        convertFloatToPcm16(
            channelData
        );

    lastAudioPcmArray =
        pcmSamples;

    return {
        audioBlob,
        decodedAudio,
        pcmSamples,
        duration:
            decodedAudio.duration,
        sampleRate:
            decodedAudio.sampleRate
    };
}

/**
 * Decodes and plays an imported WAV file.
 *
 * This function handles the actual decoding and UI
 * updates. The file-picker listener will live in ui.js.
 *
 * @param {File|Blob} wavFile
 * @returns {Promise<object>}
 */
async function decodeWavFile(wavFile) {
    txtStatus.textContent =
        wavFile instanceof File
            ? `STATUS: Parsing file [${wavFile.name}] into DSP decoder...`
            : "STATUS: Parsing incoming WAV audio into DSP decoder...";

    txtStatus.style.color =
        "yellow";

    txtTxState.textContent =
        "DEC";

    boxTxState.style.background =
        "#004466";

    try {
        const result =
            await decodeAudioBlob(
                wavFile
            );

        /*
         * Keep a normalized WAV copy rather than relying
         * on the original upload's codec or bit depth.
         */
        const normalizedWavBlob =
            createWavBuffer(
                result.pcmSamples,
                result.sampleRate
            );

        lastProcessedAudioBlob =
            normalizedWavBlob;

        const detectedMode =
            comboMode.value;

        const summary =
            createDecodeSummary(
                detectedMode,
                result.duration
            );

        txtStatus.textContent =
            `STATUS: ${summary}`;

        txtStatus.style.color =
            "#00FF7F";

        await playAudioBlob(
            normalizedWavBlob
        );

        enableSaveButton();

        setTimeout(
            returnToReceiveMode,
            3000
        );

        return {
            ...result,
            audioBlob:
                normalizedWavBlob
        };
    }
    catch (error) {
        console.error(
            "WAV decode error:",
            error
        );

        txtStatus.textContent =
            "ERROR: Failed to parse or decode WAV file format.";

        txtStatus.style.color =
            "#FF3333";

        returnToReceiveMode();

        throw error;
    }
}

/**
 * Decodes an audio Blob without automatically playing it.
 *
 * This will be useful later when Internet packets need
 * to be inspected or queued before playback.
 *
 * @param {Blob} audioBlob
 * @returns {Promise<object>}
 */
async function inspectAudioBlob(audioBlob) {
    try {
        return await decodeAudioBlob(
            audioBlob
        );
    }
    catch (error) {
        console.error(
            "Audio inspection error:",
            error
        );

        throw error;
    }
}

/**
 * Plays raw encoded audio without performing any
 * additional ArNet decoding.
 *
 * This will be used by the future "RAW AMMEF MONITOR"
 * button so the user can hear the stored tones directly.
 *
 * @param {Blob} rawAudioBlob
 */
async function monitorRawAudio(
    rawAudioBlob
) {
    if (!(rawAudioBlob instanceof Blob)) {
        throw new TypeError(
            "monitorRawAudio requires a Blob."
        );
    }

    txtTxState.textContent =
        "RAW";

    boxTxState.style.background =
        "#665500";

    txtStatus.textContent =
        "STATUS: Monitoring raw encoded waveform...";

    txtStatus.style.color =
        "#FFD700";

    try {
        const result =
            await decodeAudioBlob(
                rawAudioBlob
            );

        lastAudioPcmArray =
            result.pcmSamples;

        await playAudioBlob(
            rawAudioBlob
        );

        txtStatus.textContent =
            "STATUS: Raw waveform monitor active.";

        txtStatus.style.color =
            "#FFD700";

        return result;
    }
    catch (error) {
        console.error(
            "Raw monitor error:",
            error
        );

        txtStatus.textContent =
            "ERROR: Could not play the raw encoded waveform.";

        txtStatus.style.color =
            "#FF3333";

        returnToReceiveMode();

        throw error;
    }
}

