// ======================================================
// ArNet Transceiver
// Audio and Morse Encoding
// ======================================================

const ARNET_SAMPLE_RATE = 22050;

/**
 * Enables the Save button after audio has been created.
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
 * Converts an AudioBuffer channel into signed 16-bit PCM.
 *
 * This produces a clean audio copy suitable for storage
 * inside an AMMEF container.
 *
 * @param {Float32Array} channelData
 * @returns {Int16Array}
 */
function floatChannelToPcm16(channelData) {
    const pcmSamples = new Int16Array(channelData.length);

    for (let i = 0; i < channelData.length; i++) {
        const sample = Math.max(
            -1,
            Math.min(1, channelData[i])
        );

        pcmSamples[i] =
            sample < 0
                ? Math.round(sample * 0x8000)
                : Math.round(sample * 0x7FFF);
    }

    return pcmSamples;
}

/**
 * Creates the modulated ArNet monitoring waveform from
 * clean microphone audio.
 *
 * This is the version heard locally when PTT finishes.
 * It is not the version stored inside AMMEF.
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
        comboBandwidth.value === "wide";

    const carrierLevel =
        parseFloat(sliderCarrier.value);

    const deviationMultiplier =
        isWide ? 1.0 : 0.25;

    /*
     * The original code advances by two samples.
     * This keeps the existing ArNet FM sound.
     */
    for (let i = 0; i < rawChannel.length; i += 2) {
        const normalizedVoice = rawChannel[i];
        const voiceAmplitude = Math.abs(normalizedVoice);

        const modulatorFrequency =
            (
                50 +
                (120 * voiceAmplitude)
            ) * deviationMultiplier;

        const carrierFrequency =
            (
                600 +
                (3000 * voiceAmplitude)
            ) * deviationMultiplier;

        const modulationIndex =
            (
                8 +
                (15 * voiceAmplitude)
            ) * deviationMultiplier;

        phaseModulator +=
            (
                2 *
                Math.PI *
                modulatorFrequency
            ) / ARNET_SAMPLE_RATE;

        const modulationSignal =
            modulationIndex *
            Math.sin(phaseModulator);

        phaseCarrier +=
            (
                2 *
                Math.PI *
                carrierFrequency
            ) / ARNET_SAMPLE_RATE;

        const fmSignal =
            Math.sin(
                phaseCarrier +
                modulationSignal
            );

        const outputGain =
            0.7 +
            (0.3 * voiceAmplitude);

        phasePilot +=
            (
                2 *
                Math.PI *
                1000
            ) / ARNET_SAMPLE_RATE;

        const pilotSignal =
            Math.sin(phasePilot) *
            carrierLevel;

        const outputSample =
            13000 *
            (
                (fmSignal * outputGain) +
                pilotSignal
            );

        pcmSamples.push(
            Math.round(outputSample)
        );
    }

    return Int16Array.from(pcmSamples);
}

/**
 * Starts or stops microphone PTT recording.
 *
 * Press once:
 *   Begin microphone recording.
 *
 * Press again:
 *   Stop recording, create clean audio for AMMEF,
 *   create FM audio for local monitoring, and play it.
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
 * Starts microphone capture.
 */
async function startPttRecording() {
    try {
        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        mediaRecorder =
            new MediaRecorder(stream);

        recordedChunks = [];

        mediaRecorder.ondataavailable = event => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop =
            processPttRecording;

        mediaRecorder.start();

        isRecording = true;

        btnPtt.textContent =
            "🔴 RECORDING";

        btnPtt.style.background =
            "darkred";

        btnIdent.disabled = true;

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
    }
}

/**
 * Stops microphone capture and begins processing.
 */
function stopPttRecording() {
    if (!mediaRecorder) {
        return;
    }

    mediaRecorder.stop();

    /*
     * Stop microphone tracks so the browser no longer
     * shows the microphone as continuously active.
     */
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

    btnIdent.disabled = false;

    txtStatus.textContent =
        "STATUS: Processing FM Modulation...";

    txtStatus.style.color =
        "yellow";
}

/**
 * Processes the finished microphone recording.
 *
 * Creates:
 * 1. Clean WAV for AMMEF storage.
 * 2. FM-modulated WAV for local monitoring.
 */
async function processPttRecording() {
    try {
        if (!recordedChunks.length) {
            throw new Error(
                "No microphone audio was recorded."
            );
        }

        const recordedBlob =
            new Blob(
                recordedChunks,
                {
                    type:
                        mediaRecorder.mimeType ||
                        "audio/webm"
                }
            );

        const arrayBuffer =
            await recordedBlob.arrayBuffer();

        const decodedAudio =
            await audioCtx.decodeAudioData(
                arrayBuffer
            );

        const rawChannel =
            decodedAudio.getChannelData(0);

        // ------------------------------------------------
        // Clean storage path
        // ------------------------------------------------

        const cleanPcmSamples =
            floatChannelToPcm16(rawChannel);

        /*
         * createWavBuffer updates lastAudioPcmArray.
         * This call creates the clean AMMEF payload first.
         */
        lastCleanAudioBlob =
            createWavBuffer(
                cleanPcmSamples,
                decodedAudio.sampleRate
            );

        // ------------------------------------------------
        // FM local-monitor path
        // ------------------------------------------------

        const modulatedPcmSamples =
            encodeVoiceToFmMonitor(
                rawChannel
            );

        /*
         * Calling createWavBuffer again here makes the
         * visualizer use the modulated samples.
         */
        lastModulatedAudioBlob =
            createWavBuffer(
                modulatedPcmSamples,
                ARNET_SAMPLE_RATE
            );

        // Hear the FM-modulated version.
        await playAudioBlob(
            lastModulatedAudioBlob
        );

        /*
         * AMMEF saving uses lastProcessedAudioBlob.
         * Point it at the clean recording after playback
         * has been prepared.
         */
        lastProcessedAudioBlob =
            lastCleanAudioBlob;

        enableSaveButton();

        txtStatus.textContent =
            "STATUS: Transmission completed. Clean audio ready for AMMEF.";

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
            "ERROR: Failed to process microphone audio.";

        txtStatus.style.color =
            "#FF3333";

        returnToReceiveMode();
    }
}

/**
 * Builds the IDENT Morse waveform.
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
        textToMorse(callsign);

    const dotDuration = 0.09;
    const toneState = [];

    for (const symbol of morse) {
        const duration =
            symbol === "."
                ? dotDuration
                : symbol === "-"
                    ? dotDuration * 3
                    : dotDuration * 3.5;

        const sampleCount =
            Math.floor(
                duration *
                ARNET_SAMPLE_RATE
            );

        for (
            let i = 0;
            i < sampleCount;
            i++
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
            let i = 0;
            i < gapCount;
            i++
        ) {
            toneState.push(false);
        }
    }

    const pcmSamples = [];

    let phaseCarrier = 0;
    let phaseTone = 0;

    const bandwidthFactor =
        isWide ? 1.0 : 0.35;

    for (
        let i = 0;
        i < toneState.length;
        i++
    ) {
        const isKeyed =
            toneState[i];

        let mixedOutput = 0;

        if (unencoded) {
            if (isKeyed) {
                const toneFrequency =
                    isWide ? 800 : 500;

                phaseTone +=
                    (
                        2 *
                        Math.PI *
                        toneFrequency
                    ) / ARNET_SAMPLE_RATE;

                mixedOutput =
                    Math.sin(phaseTone) *
                    0.95;
            }
        }
        else {
            const carrierFrequency =
                isKeyed
                    ? 1200 * bandwidthFactor
                    : 600 * bandwidthFactor;

            const modulationIndex =
                (
                    isKeyed ? 14 : 0
                ) * bandwidthFactor;

            const toneFrequency =
                isKeyed ? 180 : 0;

            phaseTone +=
                (
                    2 *
                    Math.PI *
                    toneFrequency
                ) / ARNET_SAMPLE_RATE;

            const modulationSignal =
                modulationIndex *
                Math.sin(phaseTone);

            phaseCarrier +=
                (
                    2 *
                    Math.PI *
                    carrierFrequency
                ) / ARNET_SAMPLE_RATE;

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
            Math.round(
                18000 *
                mixedOutput
            )
        );
    }

    return Int16Array.from(pcmSamples);
}

/**
 * Generates and plays the station IDENT.
 */
async function handleIdent() {
    const callsign =
        txtCallsign.value
            .trim()
            .toUpperCase();

    if (
        callsign.length < 6 ||
        callsign.length > 7
    ) {
        txtStatus.textContent =
            "ERROR: Callsign must be 6 or 7 characters long! (e.g. W1AW/1)";

        txtStatus.style.color =
            "#FF3333";

        return;
    }

    txtTxState.textContent =
        "IDENT";

    boxTxState.style.background =
        "#FF4500";

    const unencoded =
        chkUnencoded.checked;

    const isWide =
        comboBandwidth.value === "wide";

    const carrierLevel =
        parseFloat(sliderCarrier.value);

    const identPcmSamples =
        encodeMorseIdent(
            callsign,
            unencoded,
            isWide,
            carrierLevel
        );

    lastProcessedAudioBlob =
        createWavBuffer(
            identPcmSamples,
            ARNET_SAMPLE_RATE
        );

    await playAudioBlob(
        lastProcessedAudioBlob
    );

    enableSaveButton();

    txtStatus.textContent =
        "STATUS: CW IDENT transmitted successfully.";

    txtStatus.style.color =
        "#00FF7F";

    setTimeout(
        returnToReceiveMode,
        1000
    );
}

// ======================================================
// Encoder Event Listeners
// ======================================================

btnPtt.addEventListener(
    "click",
    handlePtt
);

btnIdent.addEventListener(
    "click",
    handleIdent
);
