// ======================================================
// ArNet Transceiver
// Audio, WAV, and Incoming AMMEF Decoder
// ======================================================

// ======================================================
// PCM conversion
// ======================================================

/**
 * Converts Web Audio floating-point samples into signed
 * 16-bit PCM samples.
 *
 * @param {Float32Array} channelData
 * @returns {Int16Array}
 */
function convertFloatToPcm16(channelData) {
    const pcmSamples =
        new Int16Array(
            channelData.length
        );

    for (
        let index = 0;
        index < channelData.length;
        index++
    ) {
        const sample =
            Math.max(
                -1,
                Math.min(
                    1,
                    channelData[index]
                )
            );

        pcmSamples[index] =
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

// ======================================================
// Decode status text
// ======================================================

/**
 * Creates a description for a decoded audio stream.
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
        Number.isFinite(duration)
            ? duration.toFixed(2)
            : "0.00";

    if (mode === "ABMTV") {
        return (
            "ABMTV media stream decoded " +
            `(${formattedDuration}s).`
        );
    }

    if (mode === "ABM") {
        return (
            "ABM audio stream decoded " +
            `(${formattedDuration}s).`
        );
    }

    return (
        "AARM audio stream decoded " +
        `(${formattedDuration}s).`
    );
}

// ======================================================
// General browser audio decoder
// ======================================================

/**
 * Decodes any browser-supported audio Blob or File.
 *
 * This function does not automatically play the audio.
 *
 * @param {Blob} audioBlob
 * @returns {Promise<{
 *     audioBlob: Blob,
 *     decodedAudio: AudioBuffer,
 *     channelData: Float32Array,
 *     pcmSamples: Int16Array,
 *     duration: number,
 *     sampleRate: number
 * }>}
 */
async function decodeAudioBlob(audioBlob) {
    if (
        !(audioBlob instanceof Blob)
    ) {
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
     * Some browsers detach an ArrayBuffer while
     * decodeAudioData is using it, so decode a copy.
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
        channelData,
        pcmSamples,

        duration:
            decodedAudio.duration,

        sampleRate:
            decodedAudio.sampleRate
    };
}

// ======================================================
// Imported WAV/audio encoding
// ======================================================

/**
 * Converts an imported audio file into:
 *
 * 1. A normalized clean WAV for receiver recovery.
 * 2. An ArNet FM-style monitor WAV.
 *
 * @param {Blob} inputBlob
 * @returns {Promise<{
 *     cleanBlob: Blob,
 *     monitorBlob: Blob,
 *     cleanPcm: Int16Array,
 *     monitorPcm: Int16Array,
 *     duration: number,
 *     sampleRate: number
 * }>}
 */
async function encodeImportedAudio(
    inputBlob
) {
    const decoded =
        await decodeAudioBlob(
            inputBlob
        );

    /*
     * Prevent an imported WAV transmission from carrying
     * a previously loaded photo or video.
     */
    if (
        typeof clearVisualPayloadsForAudioTransmission ===
        "function"
    ) {
        clearVisualPayloadsForAudioTransmission();
    }

    const cleanPcm =
        floatChannelToPcm16(
            decoded.channelData
        );

    const monitorPcm =
        encodeVoiceToFmMonitor(
            decoded.channelData
        );

    const cleanBlob =
        createWavBuffer(
            cleanPcm,
            decoded.sampleRate
        );

    const monitorBlob =
        createWavBuffer(
            monitorPcm,
            ARNET_SAMPLE_RATE
        );

    lastCleanAudioBlob =
        cleanBlob;

    lastModulatedAudioBlob =
        monitorBlob;

    lastProcessedAudioBlob =
        cleanBlob;

    /*
     * The scope and meter should follow the encoded
     * waveform heard by the sender.
     */
    lastAudioPcmArray =
        monitorPcm;

    return {
        cleanBlob,
        monitorBlob,
        cleanPcm,
        monitorPcm,

        duration:
            decoded.duration,

        sampleRate:
            decoded.sampleRate
    };
}

// ======================================================
// Imported WAV loading and transmission
// ======================================================

/**
 * Loads, encodes, monitors, and optionally transmits an
 * imported WAV or browser-supported audio file.
 *
 * The sender hears the FM monitor signal.
 * The receiver recovers the clean WAV inside AMMEF.
 *
 * @param {File|Blob} wavFile
 * @returns {Promise<object>}
 */
async function decodeWavFile(wavFile) {
    if (
        !(wavFile instanceof Blob)
    ) {
        throw new TypeError(
            "decodeWavFile requires a File or Blob."
        );
    }

    const fileName =
        wavFile instanceof File
            ? wavFile.name
            : "incoming audio";

    txtStatus.textContent =
        `STATUS: Loading [${fileName}] into the ArNet encoder...`;

    txtStatus.style.color =
        "yellow";

    txtTxState.textContent =
        "ENC";

    boxTxState.style.background =
        "#665500";

    try {
        const encoded =
            await encodeImportedAudio(
                wavFile
            );

        /*
         * Locally play the encoded FM monitor waveform.
         */
        await playAudioBlob(
            encoded.monitorBlob
        );

        enableSaveButton();

        const summary =
            createDecodeSummary(
                comboMode.value,
                encoded.duration
            );

        if (
            networkConnected &&
            typeof sendCurrentAMMEFToNetwork ===
                "function"
        ) {
            txtTxState.textContent =
                "TX-WAV";

            boxTxState.style.background =
                "#884400";

            txtStatus.textContent =
                "STATUS: Sending encoded WAV AMMEF packet...";

            txtStatus.style.color =
                "#FFD700";

            await sendCurrentAMMEFToNetwork(
                "wav"
            );

            txtStatus.textContent =
                `STATUS: ${summary} ` +
                "Encoded WAV transmitted successfully.";
        }
        else {
            txtStatus.textContent =
                `STATUS: ${summary} ` +
                "Encoded WAV ready for AMMEF saving.";
        }

        txtStatus.style.color =
            "#00FF7F";

        setTimeout(
            returnToReceiveMode,
            1500
        );

        return {
            ...encoded,

            sourceFile:
                wavFile,

            transmissionKind:
                "wav"
        };
    }
    catch (error) {
        console.error(
            "WAV processing error:",
            error
        );

        txtStatus.textContent =
            `ERROR: ${
                error.message ||
                "Failed to process the audio file."
            }`;

        txtStatus.style.color =
            "#FF3333";

        returnToReceiveMode();

        throw error;
    }
}

// ======================================================
// Incoming Internet AMMEF decoding
// ======================================================

/**
 * Copies parsed AMMEF contents into the shared dashboard
 * state so playback and preview buttons work normally.
 *
 * @param {object} parsed
 */
function restoreParsedAMMEFState(parsed) {
    lastLoadedAMMEFMetadata =
        parsed.metadata ||
        null;

    lastLoadedAMMEFCleanBlob =
        parsed.cleanAudioBlob ||
        null;

    lastLoadedAMMEFMonitorBlob =
        parsed.monitorAudioBlob ||
        null;

    lastLoadedAMMEFTelemetryBlob =
        parsed.telemetryAudioBlob ||
        null;

    lastLoadedAMMEFVideoMonitorBlob =
        parsed.videoMonitorAudioBlob ||
        null;

    lastLoadedAMMEFPhotoMonitorBlob =
        parsed.photoMonitorAudioBlob ||
        null;

    lastLoadedAMMEFVideoBlob =
        parsed.originalVideoBlob ||
        null;

    lastLoadedAMMEFVideoName =
        parsed.originalVideoName ||
        null;

    lastLoadedAMMEFVideoType =
        parsed.originalVideoType ||
        null;

    lastLoadedAMMEFPhotoBlob =
        parsed.originalPhotoBlob ||
        null;

    lastLoadedAMMEFPhotoName =
        parsed.originalPhotoName ||
        null;

    lastLoadedAMMEFPhotoType =
        parsed.originalPhotoType ||
        null;

    /*
     * Restore the ordinary media variables as well.
     */
    lastOriginalVideoBlob =
        parsed.originalVideoBlob ||
        null;

    lastOriginalVideoName =
        parsed.originalVideoName ||
        null;

    lastOriginalVideoType =
        parsed.originalVideoType ||
        null;

    lastVideoMonitorAudioBlob =
        parsed.videoMonitorAudioBlob ||
        null;

    lastOriginalPhotoBlob =
        parsed.originalPhotoBlob ||
        null;

    lastOriginalPhotoName =
        parsed.originalPhotoName ||
        null;

    lastOriginalPhotoType =
        parsed.originalPhotoType ||
        null;

    lastPhotoMonitorAudioBlob =
        parsed.photoMonitorAudioBlob ||
        null;

    lastAMMEFData =
        parsed;
}

/**
 * Decodes an AMMEF packet received over the Internet.
 *
 * Voice and WAV:
 *   Extract and play the clean recovered WAV.
 *
 * Morse IDENT:
 *   Play the encoded Morse monitor WAV.
 *
 * Photo:
 *   Restore the original photo and optionally play its
 *   ABMTV monitor tones.
 *
 * Video:
 *   Restore the original video and optionally play its
 *   ABMTV monitor tones.
 *
 * @param {object} parsed
 * @param {object} message
 * @returns {Promise<object>}
 */
async function decodeIncomingAMMEFPacket(
    parsed,
    message = {}
) {
    if (
        !parsed ||
        typeof parsed !== "object"
    ) {
        throw new TypeError(
            "A parsed AMMEF packet is required."
        );
    }

    const transmissionKind =
        message.transmissionKind ||
        parsed.metadata?.transmissionKind ||
        "audio";

    const sender =
        message.from ||
        parsed.metadata?.callsign ||
        "UNKNOWN";

    txtTxState.textContent =
        "DEC";

    boxTxState.style.background =
        "#004466";

    txtStatus.textContent =
        `STATUS: Decoding ${transmissionKind} packet from ${sender}...`;

    txtStatus.style.color =
        "#00FFFF";

    restoreParsedAMMEFState(
        parsed
    );

    // --------------------------------------------------
    // Photo decoding
    // --------------------------------------------------

    if (
        transmissionKind === "photo" &&
        parsed.originalPhotoBlob
    ) {
        if (
            parsed.photoMonitorAudioBlob
        ) {
            const monitorResult =
                await decodeAudioBlob(
                    parsed.photoMonitorAudioBlob
                );

            lastAudioPcmArray =
                monitorResult.pcmSamples;

            await playAudioBlob(
                parsed.photoMonitorAudioBlob
            );
        }

        txtStatus.textContent =
            `STATUS: Photo from ${sender} decoded. ` +
            "Use ORIGINAL PHOTO to view it.";

        txtStatus.style.color =
            "#00FF7F";

        if (
            typeof refreshMediaActionButtons ===
            "function"
        ) {
            refreshMediaActionButtons();
        }

        setTimeout(
            returnToReceiveMode,
            1500
        );

        return {
            type:
                "photo",

            sender,

            originalBlob:
                parsed.originalPhotoBlob,

            monitorBlob:
                parsed.photoMonitorAudioBlob ||
                null
        };
    }

    // --------------------------------------------------
    // Video decoding
    // --------------------------------------------------

    if (
        transmissionKind === "video" &&
        parsed.originalVideoBlob
    ) {
        if (
            parsed.videoMonitorAudioBlob
        ) {
            const monitorResult =
                await decodeAudioBlob(
                    parsed.videoMonitorAudioBlob
                );

            lastAudioPcmArray =
                monitorResult.pcmSamples;

            await playAudioBlob(
                parsed.videoMonitorAudioBlob
            );
        }

        txtStatus.textContent =
            `STATUS: Video from ${sender} decoded. ` +
            "Use ORIGINAL VIDEO to view it.";

        txtStatus.style.color =
            "#00FF7F";

        if (
            typeof refreshMediaActionButtons ===
            "function"
        ) {
            refreshMediaActionButtons();
        }

        setTimeout(
            returnToReceiveMode,
            1500
        );

        return {
            type:
                "video",

            sender,

            originalBlob:
                parsed.originalVideoBlob,

            monitorBlob:
                parsed.videoMonitorAudioBlob ||
                null
        };
    }

    // --------------------------------------------------
    // Voice, WAV, IDENT, and general audio decoding
    // --------------------------------------------------

    let decodedAudioTrack =
        null;

    let selectedTrackName =
        null;

    /*
     * Voice and imported WAV packets normally contain a
     * clean WAV, so that is always preferred.
     */
    if (
        parsed.cleanAudioBlob
    ) {
        decodedAudioTrack =
            parsed.cleanAudioBlob;

        selectedTrackName =
            "clean";
    }
    /*
     * Morse IDENT normally contains only its encoded
     * monitor waveform.
     */
    else if (
        parsed.monitorAudioBlob
    ) {
        decodedAudioTrack =
            parsed.monitorAudioBlob;

        selectedTrackName =
            "monitor";
    }
    else if (
        parsed.telemetryAudioBlob
    ) {
        decodedAudioTrack =
            parsed.telemetryAudioBlob;

        selectedTrackName =
            "telemetry";
    }
    else if (
        parsed.photoMonitorAudioBlob
    ) {
        decodedAudioTrack =
            parsed.photoMonitorAudioBlob;

        selectedTrackName =
            "photo-monitor";
    }
    else if (
        parsed.videoMonitorAudioBlob
    ) {
        decodedAudioTrack =
            parsed.videoMonitorAudioBlob;

        selectedTrackName =
            "video-monitor";
    }

    if (!decodedAudioTrack) {
        throw new Error(
            "The AMMEF packet contains no decodable signal."
        );
    }

    const decoded =
        await decodeAudioBlob(
            decodedAudioTrack
        );

    lastAudioPcmArray =
        decoded.pcmSamples;

    lastProcessedAudioBlob =
        decodedAudioTrack;

    await playAudioBlob(
        decodedAudioTrack
    );

    txtStatus.textContent =
        `STATUS: ${transmissionKind} from ${sender} decoded ` +
        `using the ${selectedTrackName} signal.`;

    txtStatus.style.color =
        "#00FF7F";

    if (
        typeof refreshMediaActionButtons ===
        "function"
    ) {
        refreshMediaActionButtons();
    }

    setTimeout(
        returnToReceiveMode,
        1500
    );

    return {
        type:
            transmissionKind,

        sender,

        selectedTrack:
            selectedTrackName,

        decodedAudioBlob:
            decodedAudioTrack,

        duration:
            decoded.duration,

        sampleRate:
            decoded.sampleRate,

        pcmSamples:
            decoded.pcmSamples
    };
}

// ======================================================
// Manual inspection and raw monitoring
// ======================================================

/**
 * Decodes an audio Blob without playing it.
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
 * Plays an encoded waveform without extracting a clean
 * AMMEF track.
 *
 * @param {Blob} rawAudioBlob
 * @returns {Promise<object>}
 */
async function monitorRawAudio(
    rawAudioBlob
) {
    if (
        !(rawAudioBlob instanceof Blob)
    ) {
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
