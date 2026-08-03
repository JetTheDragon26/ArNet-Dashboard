// ======================================================
// ArNet Transceiver
// Audio, Voice, and Morse Encoding
// ======================================================

const ARNET_SAMPLE_RATE = 22050;

// ======================================================
// Shared encoder helpers
// ======================================================

/**
 * Enables the AMMEF Save button.
 */
function enableSaveButton() {
    btnSave.disabled = false;
    btnSave.style.opacity = "1";
    btnSave.style.cursor = "pointer";
}

/**
 * Restores the transceiver display to receive mode.
 */
function returnToReceiveMode() {
    txtTxState.textContent = "RX";
    boxTxState.style.background = "#330000";
}

/**
 * Removes old photo/video payloads when a new audio-only
 * transmission is prepared.
 *
 * Without this cleanup, a voice or Morse transmission
 * could accidentally contain a previously loaded image
 * or video.
 */
function clearVisualPayloadsForAudioTransmission() {
    lastOriginalVideoBlob = null;
    lastOriginalVideoType = null;
    lastOriginalVideoName = null;

    lastVideoMonitorAudioBlob = null;
    lastVideoMetadata = null;

    lastOriginalPhotoBlob = null;
    lastOriginalPhotoType = null;
    lastOriginalPhotoName = null;

    lastPhotoMonitorAudioBlob = null;
    lastPhotoMetadata = null;
}

/**
 * Converts floating-point Web Audio samples into signed
 * 16-bit PCM.
 *
 * @param {Float32Array} channelData
 * @returns {Int16Array}
 */
function floatChannelToPcm16(channelData) {
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
// Voice monitor encoder
// ======================================================

/**
 * Converts clean voice audio into the ArNet FM-style
 * monitor waveform.
 *
 * The monitor waveform is what the transmitting station
 * hears. The clean waveform remains inside AMMEF so the
 * receiving station can recover clear audio.
 *
 * @param {Float32Array} rawChannel
 * @returns {Int16Array}
 */
function encodeVoiceToFmMonitor(rawChannel) {
    const pcmSamples = [];

    let phaseCarrier = 0;
    let phaseModulator = 0;
    let phasePilot = 0;

    const isWide =
        comboBandwidth.value ===
        "wide";

    const carrierLevel =
        Number.parseFloat(
            sliderCarrier.value
        ) || 0;

    const deviationMultiplier =
        isWide
            ? 1
            : 0.25;

    /*
     * Advancing by two samples preserves the sound of
     * the original ArNet voice encoder.
     */
    for (
        let index = 0;
        index < rawChannel.length;
        index += 2
    ) {
        const normalizedVoice =
            rawChannel[index];

        const voiceAmplitude =
            Math.abs(
                normalizedVoice
            );

        const modulatorFrequency =
            (
                50 +
                (
                    120 *
                    voiceAmplitude
                )
            ) *
            deviationMultiplier;

        const carrierFrequency =
            (
                600 +
                (
                    3000 *
                    voiceAmplitude
                )
            ) *
            deviationMultiplier;

        const modulationIndex =
            (
                8 +
                (
                    15 *
                    voiceAmplitude
                )
            ) *
            deviationMultiplier;

        phaseModulator +=
            (
                2 *
                Math.PI *
                modulatorFrequency
            ) /
            ARNET_SAMPLE_RATE;

        const modulationSignal =
            modulationIndex *
            Math.sin(
                phaseModulator
            );

        phaseCarrier +=
            (
                2 *
                Math.PI *
                carrierFrequency
            ) /
            ARNET_SAMPLE_RATE;

        const fmSignal =
            Math.sin(
                phaseCarrier +
                modulationSignal
            );

        const outputGain =
            0.7 +
            (
                0.3 *
                voiceAmplitude
            );

        phasePilot +=
            (
                2 *
                Math.PI *
                1000
            ) /
            ARNET_SAMPLE_RATE;

        const pilotSignal =
            Math.sin(
                phasePilot
            ) *
            carrierLevel;

        const outputSample =
            13000 *
            (
                (
                    fmSignal *
                    outputGain
                ) +
                pilotSignal
            );

        pcmSamples.push(
            Math.max(
                -32768,
                Math.min(
                    32767,
                    Math.round(
                        outputSample
                    )
                )
            )
        );
    }

    return Int16Array.from(
        pcmSamples
    );
}

// ======================================================
// PTT recording
// ======================================================

/**
 * Handles the PTT button.
 *
 * First press begins recording.
 * Second press stops and processes the recording.
 */
async function handlePtt() {
    initAudioContext();

    if (!isRecording) {
        await startPttRecording();
        return;
    }

    stopPttRecording();
}

/**
 * Begins microphone capture.
 */
async function startPttRecording() {
    try {
        const stream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true
                });

        mediaRecorder =
            new MediaRecorder(
                stream
            );

        recordedChunks = [];

        mediaRecorder.addEventListener(
            "dataavailable",
            event => {
                if (
                    event.data &&
                    event.data.size > 0
                ) {
                    recordedChunks.push(
                        event.data
                    );
                }
            }
        );

        mediaRecorder.addEventListener(
            "stop",
            processPttRecording,
            {
                once: true
            }
        );

        mediaRecorder.start();

        isRecording = true;

        btnPtt.textContent =
            "🔴 RECORDING";

        btnPtt.style.background =
            "darkred";

        btnIdent.disabled =
            true;

        txtTxState.textContent =
            "REC";

        boxTxState.style.background =
            "red";

        txtStatus.textContent =
            "STATUS: Recording live voice signal...";

        txtStatus.style.color =
            "red";
    }
    catch (error) {
        console.error(
            "Microphone error:",
            error
        );

        txtStatus.textContent =
            "ERROR: Microphone access denied or unavailable.";

        txtStatus.style.color =
            "#FF3333";

        isRecording = false;
    }
}

/**
 * Stops microphone capture.
 */
function stopPttRecording() {
    if (
        !mediaRecorder ||
        mediaRecorder.state ===
            "inactive"
    ) {
        return;
    }

    mediaRecorder.stop();

    if (mediaRecorder.stream) {
        for (
            const track of
            mediaRecorder.stream.getTracks()
        ) {
            track.stop();
        }
    }

    isRecording = false;

    btnPtt.textContent =
        "🎙️ PTT MIC";

    btnPtt.style.background =
        "#880000";

    btnIdent.disabled =
        false;

    txtStatus.textContent =
        "STATUS: Processing ArNet FM modulation...";

    txtStatus.style.color =
        "yellow";
}

/**
 * Processes a completed PTT recording.
 *
 * Creates:
 *
 * 1. A clean WAV track for receiver decoding.
 * 2. An FM-style monitor track for local listening.
 * 3. An AMMEF network packet when connected.
 */
async function processPttRecording() {
    try {
        if (
            !recordedChunks.length
        ) {
            throw new Error(
                "No microphone audio was recorded."
            );
        }

        clearVisualPayloadsForAudioTransmission();

        const recordedBlob =
            new Blob(
                recordedChunks,
                {
                    type:
                        mediaRecorder
                            ?.mimeType ||
                        "audio/webm"
                }
            );

        const arrayBuffer =
            await recordedBlob
                .arrayBuffer();

        const decodedAudio =
            await audioCtx
                .decodeAudioData(
                    arrayBuffer.slice(0)
                );

        if (
            decodedAudio.numberOfChannels <
            1
        ) {
            throw new Error(
                "The microphone recording contains no audio channel."
            );
        }

        const rawChannel =
            decodedAudio
                .getChannelData(0);

        // ----------------------------------------------
        // Clean receiver track
        // ----------------------------------------------

        const cleanPcmSamples =
            floatChannelToPcm16(
                rawChannel
            );

        lastCleanAudioBlob =
            createWavBuffer(
                cleanPcmSamples,
                decodedAudio.sampleRate
            );

        // ----------------------------------------------
        // Encoded FM monitor track
        // ----------------------------------------------

        const modulatedPcmSamples =
            encodeVoiceToFmMonitor(
                rawChannel
            );

        lastModulatedAudioBlob =
            createWavBuffer(
                modulatedPcmSamples,
                ARNET_SAMPLE_RATE
            );

        /*
         * The local station hears the encoded waveform.
         */
        lastAudioPcmArray =
            modulatedPcmSamples;

        await playAudioBlob(
            lastModulatedAudioBlob
        );

        /*
         * AMMEF uses the clean audio as its recoverable
         * primary payload and the FM waveform as the
         * monitor track.
         */
        lastProcessedAudioBlob =
            lastCleanAudioBlob;

        enableSaveButton();

        if (
            networkConnected &&
            typeof sendCurrentAMMEFToNetwork ===
                "function"
        ) {
            txtTxState.textContent =
                "TX";

            boxTxState.style.background =
                "#880000";

            txtStatus.textContent =
                "STATUS: Sending encoded voice AMMEF packet...";

            txtStatus.style.color =
                "#FFD700";

            try {
                await sendCurrentAMMEFToNetwork(
                    "voice"
                );
            }
            catch (networkError) {
                console.error(
                    "Network voice transmission failed:",
                    networkError
                );

                txtStatus.textContent =
                    `ERROR: ${networkError.message}`;

                txtStatus.style.color =
                    "#FF3333";

                returnToReceiveMode();
                return;
            }
        }

        txtStatus.textContent =
            networkConnected
                ? (
                    "STATUS: Voice transmission encoded, " +
                    "sent, and ready for AMMEF saving."
                )
                : (
                    "STATUS: Voice transmission encoded " +
                    "and ready for AMMEF saving."
                );

        txtStatus.style.color =
            "#00FF7F";

        returnToReceiveMode();
    }
    catch (error) {
        console.error(
            "PTT processing error:",
            error
        );

        txtStatus.textContent =
            `ERROR: ${
                error.message ||
                "Failed to process microphone audio."
            }`;

        txtStatus.style.color =
            "#FF3333";

        returnToReceiveMode();
    }
    finally {
        recordedChunks = [];
    }
}
//--------Morse-Code

async function handleMorseMessage() {
    const message =
        txtMorseMessage.value
            .trim()
            .toUpperCase();

    if (!message) {
        txtStatus.textContent =
            "ERROR: Type a Morse message first.";

        txtStatus.style.color =
            "#FF3333";

        return;
    }

    clearVisualPayloadsForAudioTransmission();

    txtTxState.textContent =
        "MORSE";

    boxTxState.style.background =
        "#806000";

    try {
        const morsePcm =
            encodeMorseIdent(
                message,
                chkUnencoded.checked,
                comboBandwidth.value === "wide",
                Number.parseFloat(
                    sliderCarrier.value
                ) || 0
            );

        const morseBlob =
            createWavBuffer(
                morsePcm,
                ARNET_SAMPLE_RATE
            );

        lastCleanAudioBlob =
            null;

        lastModulatedAudioBlob =
            morseBlob;

        lastProcessedAudioBlob =
            morseBlob;

        lastAudioPcmArray =
            morsePcm;

        playAudioBlob(
            morseBlob
        ).catch(console.error);

        enableSaveButton();

        if (
            networkConnected &&
            typeof sendCurrentAMMEFToNetwork ===
                "function"
        ) {
            await sendCurrentAMMEFToNetwork(
    "morse",
    {
        morseText:
            message
    }
);
        

        txtStatus.textContent =
            networkConnected
                ? "STATUS: Morse message transmitted."
                : "STATUS: Morse message encoded.";

        txtStatus.style.color =
            "#00FF7F";
    }
    catch (error) {
        console.error(
            "Morse message error:",
            error
        );

        txtStatus.textContent =
            `ERROR: ${error.message}`;

        txtStatus.style.color =
            "#FF3333";
    }

    setTimeout(
        returnToReceiveMode,
        1000
    );
}

// ======================================================
// Morse IDENT encoder
// ======================================================

/**
 * Generates a Morse identifier waveform.
 *
 * @param {string} callsign
 * @param {boolean} unencoded
 * @param {boolean} isWide
 * @param {number} carrierLevel
 * @returns {Int16Array}
 */
function encodeMorseIdent(
    callsign,
    unencoded,
    isWide,
    carrierLevel
) {
    const morse =
        textToMorse(
            callsign
        );

    const dotDuration =
        0.09;

    const toneState = [];

    for (const symbol of morse) {
        let duration;

        if (symbol === ".") {
            duration =
                dotDuration;
        }
        else if (symbol === "-") {
            duration =
                dotDuration * 3;
        }
        else {
            duration =
                dotDuration * 3.5;
        }

        const sampleCount =
            Math.floor(
                duration *
                ARNET_SAMPLE_RATE
            );

        for (
            let index = 0;
            index < sampleCount;
            index++
        ) {
            toneState.push(
                symbol !== " "
            );
        }

        const gapCount =
            Math.floor(
                dotDuration *
                0.8 *
                ARNET_SAMPLE_RATE
            );

        for (
            let index = 0;
            index < gapCount;
            index++
        ) {
            toneState.push(
                false
            );
        }
    }

    const pcmSamples = [];

    let phaseCarrier = 0;
    let phaseTone = 0;

    const bandwidthFactor =
        isWide
            ? 1
            : 0.35;

    for (
        let index = 0;
        index < toneState.length;
        index++
    ) {
        const isKeyed =
            toneState[index];

        let mixedOutput =
            0;

        if (unencoded) {
            if (isKeyed) {
                const toneFrequency =
                    isWide
                        ? 800
                        : 500;

                phaseTone +=
                    (
                        2 *
                        Math.PI *
                        toneFrequency
                    ) /
                    ARNET_SAMPLE_RATE;

                mixedOutput =
                    Math.sin(
                        phaseTone
                    ) *
                    0.95;
            }
        }
        else {
            const carrierFrequency =
                isKeyed
                    ? (
                        1200 *
                        bandwidthFactor
                    )
                    : (
                        600 *
                        bandwidthFactor
                    );

            const modulationIndex =
                (
                    isKeyed
                        ? 14
                        : 0
                ) *
                bandwidthFactor;

            const toneFrequency =
                isKeyed
                    ? 180
                    : 0;

            phaseTone +=
                (
                    2 *
                    Math.PI *
                    toneFrequency
                ) /
                ARNET_SAMPLE_RATE;

            const modulationSignal =
                modulationIndex *
                Math.sin(
                    phaseTone
                );

            phaseCarrier +=
                (
                    2 *
                    Math.PI *
                    carrierFrequency
                ) /
                ARNET_SAMPLE_RATE;

            const fmSignal =
                Math.sin(
                    phaseCarrier +
                    modulationSignal
                );

            const idleCarrier =
                carrierLevel > 0
                    ? carrierLevel
                    : 0.05;

            mixedOutput =
                fmSignal *
                (
                    isKeyed
                        ? 0.95
                        : idleCarrier
                );
        }

        pcmSamples.push(
            Math.max(
                -32768,
                Math.min(
                    32767,
                    Math.round(
                        18000 *
                        mixedOutput
                    )
                )
            )
        );
    }

    return Int16Array.from(
        pcmSamples
    );
}

/**
 * Generates, monitors, packages, and transmits the
 * station Morse IDENT.
 */
async function handleIdent() {
    const callsign =
        txtCallsign.value
            .trim()
            .toUpperCase();

    if (
        callsign.length < 3 ||
        callsign.length > 20
    ) {
        txtStatus.textContent =
            "ERROR: Enter a callsign between 3 and 20 characters.";

        txtStatus.style.color =
            "#FF3333";

        return;
    }

    clearVisualPayloadsForAudioTransmission();

    txtTxState.textContent =
        "IDENT";

    boxTxState.style.background =
        "#FF4500";

    txtStatus.textContent =
        `STATUS: Encoding Morse IDENT for ${callsign}...`;

    txtStatus.style.color =
        "#FFD700";

    try {
        const unencoded =
            chkUnencoded.checked;

        const isWide =
            comboBandwidth.value ===
            "wide";

        const carrierLevel =
            Number.parseFloat(
                sliderCarrier.value
            ) || 0;

        const identPcmSamples =
            encodeMorseIdent(
                callsign,
                unencoded,
                isWide,
                carrierLevel
            );

        const identBlob =
            createWavBuffer(
                identPcmSamples,
                ARNET_SAMPLE_RATE
            );

        /*
         * The IDENT is an encoded monitor waveform rather
         * than clean spoken audio.
         */
        lastCleanAudioBlob =
            null;

        lastModulatedAudioBlob =
            identBlob;

        lastProcessedAudioBlob =
            identBlob;

        lastAudioPcmArray =
            identPcmSamples;

        await playAudioBlob(
            identBlob
        );

        enableSaveButton();

        if (
            networkConnected &&
            typeof sendCurrentAMMEFToNetwork ===
                "function"
        ) {
            txtTxState.textContent =
                "TX-ID";

            boxTxState.style.background =
                "#AA4400";

            txtStatus.textContent =
                "STATUS: Sending Morse IDENT AMMEF packet...";

            txtStatus.style.color =
                "#FFD700";

            await sendCurrentAMMEFToNetwork(
                "ident"
            );
        }

        txtStatus.textContent =
            networkConnected
                ? (
                    `STATUS: Morse IDENT ${callsign} ` +
                    "encoded and transmitted."
                )
                : (
                    `STATUS: Morse IDENT ${callsign} encoded.`
                );

        txtStatus.style.color =
            "#00FF7F";
    }
    catch (error) {
        console.error(
            "Morse IDENT error:",
            error
        );

        txtStatus.textContent =
            `ERROR: ${
                error.message ||
                "Could not create the Morse identifier."
            }`;

        txtStatus.style.color =
            "#FF3333";
    }

    setTimeout(
        returnToReceiveMode,
        1000
    );
}

// ======================================================
// Encoder event listeners
// ======================================================

btnPtt.addEventListener(
    "click",
    handlePtt
);

btnIdent.addEventListener(
    "click",
    handleIdent
);

btnSendMorse.addEventListener(
    "click",
    handleMorseMessage
);

txtMorseMessage.addEventListener(
    "keydown",
    event => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleMorseMessage();
        }
    }
);