// ======================================================
// ArNet Transceiver
// AMMEF Stream v2
// Audio Preparation and Chunking
// ======================================================

const ARNET_STREAM_SAMPLE_RATE =
    22050;

const ARNET_STREAM_CHANNELS =
    1;

const ARNET_STREAM_CHUNK_MS =
    200;

// ======================================================
// Stream state
// ======================================================

let selectedStreamAudioBlob =
    null;

let lastPreparedArNetStream =
    null;

let isPreparingArNetStream =
    false;
let isTransmittingArNetStream =
    false;

let stopArNetStreamRequested =
    false;

let activeOutgoingStreamId =
    null;

// ======================================================
// Dashboard controls
// ======================================================

const fileStreamAudio =
    document.getElementById(
        "fileStreamAudio"
    );

const btnPrepareStream =
    document.getElementById(
        "btnPrepareStream"
    );

const btnStartStream =
    document.getElementById(
        "btnStartStream"
    );

const btnStopStream =
    document.getElementById(
        "btnStopStream"
    );

// ======================================================
// Stream ID generation
// ======================================================

/**
 * Creates a unique ID for an ArNet audio stream.
 *
 * @returns {string}
 */
function createArNetStreamId() {
    if (
        globalThis.crypto &&
        typeof globalThis.crypto.randomUUID ===
            "function"
    ) {
        return globalThis.crypto.randomUUID();
    }

    return (
        Date.now()
            .toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .slice(2)
    );
}

// ======================================================
// Audio decoding and conversion
// ======================================================

/**
 * Decodes an audio file and converts it into mono PCM16
 * at the ArNet stream sample rate.
 *
 * @param {Blob} audioBlob
 * @returns {Promise<object>}
 */
async function decodeAudioForArNetStream(
    audioBlob
) {
    if (
        !(audioBlob instanceof Blob)
    ) {
        throw new TypeError(
            "An audio file is required."
        );
    }

    if (
        typeof initAudioContext !==
            "function"
    ) {
        throw new Error(
            "The ArNet audio engine is not available."
        );
    }

    initAudioContext();

    if (!audioCtx) {
        throw new Error(
            "The browser could not create an audio context."
        );
    }

    if (
        audioCtx.state ===
            "suspended"
    ) {
        await audioCtx.resume();
    }

    const sourceBuffer =
        await audioBlob.arrayBuffer();

    let decodedAudio;

    try {
        decodedAudio =
            await audioCtx.decodeAudioData(
                sourceBuffer.slice(0)
            );
    }
    catch (error) {
        console.error(
            "Audio decoding failed:",
            error
        );

        throw new Error(
            "The selected audio file could not be decoded."
        );
    }

    if (
        decodedAudio.numberOfChannels <
            1
    ) {
        throw new Error(
            "The audio file contains no usable channel."
        );
    }

    const monoChannel =
        mixAudioBufferToMono(
            decodedAudio
        );

    const resampledChannel =
        resampleFloat32Audio(
            monoChannel,
            decodedAudio.sampleRate,
            ARNET_STREAM_SAMPLE_RATE
        );

    const pcm16 =
        convertFloat32ToPcm16(
            resampledChannel
        );

    const durationMs =
        Math.round(
            (
                pcm16.length /
                ARNET_STREAM_SAMPLE_RATE
            ) *
            1000
        );

    return {
        pcm16,

        sampleRate:
            ARNET_STREAM_SAMPLE_RATE,

        channels:
            ARNET_STREAM_CHANNELS,

        durationMs,

        sourceSampleRate:
            decodedAudio.sampleRate,

        sourceChannels:
            decodedAudio.numberOfChannels
    };
}

/**
 * Mixes all channels in an AudioBuffer into one mono
 * Float32Array.
 *
 * @param {AudioBuffer} audioBuffer
 * @returns {Float32Array}
 */
function mixAudioBufferToMono(
    audioBuffer
) {
    const frameCount =
        audioBuffer.length;

    const channelCount =
        audioBuffer.numberOfChannels;

    const mono =
        new Float32Array(
            frameCount
        );

    for (
        let channelIndex = 0;
        channelIndex < channelCount;
        channelIndex++
    ) {
        const channel =
            audioBuffer.getChannelData(
                channelIndex
            );

        for (
            let sampleIndex = 0;
            sampleIndex < frameCount;
            sampleIndex++
        ) {
            mono[sampleIndex] +=
                channel[sampleIndex] /
                channelCount;
        }
    }

    return mono;
}

/**
 * Resamples mono Float32 audio using linear
 * interpolation.
 *
 * @param {Float32Array} input
 * @param {number} sourceRate
 * @param {number} targetRate
 * @returns {Float32Array}
 */
function resampleFloat32Audio(
    input,
    sourceRate,
    targetRate
) {
    if (
        !(input instanceof Float32Array)
    ) {
        throw new TypeError(
            "Float32 audio is required for resampling."
        );
    }

    if (
        !Number.isFinite(sourceRate) ||
        sourceRate <= 0 ||
        !Number.isFinite(targetRate) ||
        targetRate <= 0
    ) {
        throw new RangeError(
            "Valid source and target sample rates are required."
        );
    }

    if (
        sourceRate === targetRate
    ) {
        return new Float32Array(
            input
        );
    }

    const ratio =
        sourceRate /
        targetRate;

    const outputLength =
        Math.max(
            1,
            Math.round(
                input.length /
                ratio
            )
        );

    const output =
        new Float32Array(
            outputLength
        );

    for (
        let outputIndex = 0;
        outputIndex < outputLength;
        outputIndex++
    ) {
        const sourcePosition =
            outputIndex *
            ratio;

        const lowerIndex =
            Math.floor(
                sourcePosition
            );

        const upperIndex =
            Math.min(
                input.length - 1,
                lowerIndex + 1
            );

        const fraction =
            sourcePosition -
            lowerIndex;

        const lowerSample =
            input[
                Math.min(
                    lowerIndex,
                    input.length - 1
                )
            ] || 0;

        const upperSample =
            input[
                upperIndex
            ] || 0;

        output[outputIndex] =
            lowerSample *
                (
                    1 -
                    fraction
                ) +
            upperSample *
                fraction;
    }

    return output;
}

/**
 * Converts Float32 audio samples into signed PCM16.
 *
 * This function is local to stream.js so it still works
 * even if the encoder helper has not loaded yet.
 *
 * @param {Float32Array} input
 * @returns {Int16Array}
 */
function convertFloat32ToPcm16(
    input
) {
    const output =
        new Int16Array(
            input.length
        );

    for (
        let index = 0;
        index < input.length;
        index++
    ) {
        const sample =
            Math.max(
                -1,
                Math.min(
                    1,
                    input[index]
                )
            );

        output[index] =
            sample < 0
                ? Math.round(
                    sample *
                    0x8000
                )
                : Math.round(
                    sample *
                    0x7FFF
                );
    }

    return output;
}

// ======================================================
// PCM chunk creation
// ======================================================

/**
 * Divides PCM16 data into timed stream chunks.
 *
 * @param {Int16Array} pcm16
 * @param {object} options
 * @returns {object[]}
 */
function createPcmStreamChunks(
    pcm16,
    options = {}
) {
    if (
        !(pcm16 instanceof Int16Array)
    ) {
        throw new TypeError(
            "PCM16 audio is required."
        );
    }

    const sampleRate =
        Number(
            options.sampleRate
        ) ||
        ARNET_STREAM_SAMPLE_RATE;

    const chunkDurationMs =
        Number(
            options.chunkDurationMs
        ) ||
        ARNET_STREAM_CHUNK_MS;

    const samplesPerChunk =
        Math.max(
            1,
            Math.round(
                sampleRate *
                (
                    chunkDurationMs /
                    1000
                )
            )
        );

    const chunks =
        [];

    let sequence =
        0;

    for (
        let offset = 0;
        offset < pcm16.length;
        offset += samplesPerChunk
    ) {
        const end =
            Math.min(
                pcm16.length,
                offset +
                    samplesPerChunk
            );

        const samples =
            pcm16.slice(
                offset,
                end
            );

        const timestampMs =
            Math.round(
                (
                    offset /
                    sampleRate
                ) *
                1000
            );

        const actualDurationMs =
            Math.round(
                (
                    samples.length /
                    sampleRate
                ) *
                1000
            );

        chunks.push({
            sequence,

            timestampMs,

            durationMs:
                actualDurationMs,

            sampleOffset:
                offset,

            sampleCount:
                samples.length,

            samples
        });

        sequence++;
    }

    return chunks;
}

// ======================================================
// PCM byte conversion
// ======================================================

/**
 * Converts signed PCM16 samples into little-endian bytes.
 *
 * @param {Int16Array} samples
 * @returns {Uint8Array}
 */
function pcm16ToBytes(
    samples
) {
    if (
        !(samples instanceof Int16Array)
    ) {
        throw new TypeError(
            "PCM16 samples are required."
        );
    }

    const bytes =
        new Uint8Array(
            samples.length *
            2
        );

    const view =
        new DataView(
            bytes.buffer
        );

    for (
        let index = 0;
        index < samples.length;
        index++
    ) {
        view.setInt16(
            index * 2,
            samples[index],
            true
        );
    }

    return bytes;
}

function streamBytesToBase64(
    bytes
) {
    let binary =
        "";

    const chunkSize =
        0x8000;

    for (
        let offset = 0;
        offset < bytes.length;
        offset += chunkSize
    ) {
        const chunk =
            bytes.subarray(
                offset,
                offset + chunkSize
            );

        binary +=
            String.fromCharCode(
                ...chunk
            );
    }

    return btoa(
        binary
    );
}

/**
 * Converts little-endian bytes back into PCM16 samples.
 *
 * @param {Uint8Array} bytes
 * @returns {Int16Array}
 */
function bytesToPcm16(
    bytes
) {
    if (
        !(bytes instanceof Uint8Array)
    ) {
        throw new TypeError(
            "A Uint8Array is required."
        );
    }

    const usableByteLength =
        bytes.byteLength -
        (
            bytes.byteLength %
            2
        );

    const sampleCount =
        usableByteLength /
        2;

    const samples =
        new Int16Array(
            sampleCount
        );

    const view =
        new DataView(
            bytes.buffer,
            bytes.byteOffset,
            usableByteLength
        );

    for (
        let index = 0;
        index < sampleCount;
        index++
    ) {
        samples[index] =
            view.getInt16(
                index * 2,
                true
            );
    }

    return samples;
}

// ======================================================
// Stream preparation
// ======================================================

/**
 * Prepares an audio Blob for ArNet streaming.
 *
 * @param {Blob} audioBlob
 * @param {object} options
 * @returns {Promise<object>}
 */
async function prepareArNetAudioStream(
    audioBlob,
    options = {}
) {
    if (
        !(audioBlob instanceof Blob)
    ) {
        throw new TypeError(
            "prepareArNetAudioStream requires an audio Blob or File."
        );
    }

    const chunkDurationMs =
        Number(
            options.chunkDurationMs
        ) ||
        ARNET_STREAM_CHUNK_MS;

    const decoded =
        await decodeAudioForArNetStream(
            audioBlob
        );

    const chunks =
        createPcmStreamChunks(
            decoded.pcm16,
            {
                sampleRate:
                    decoded.sampleRate,

                chunkDurationMs
            }
        );

    const fileName =
        typeof audioBlob.name ===
            "string"
            ? audioBlob.name
            : "audio-stream";

    const mimeType =
        audioBlob.type ||
        "application/octet-stream";

    return {
        streamId:
            createArNetStreamId(),

        version:
            2,

        transmissionKind:
            "audio-stream",

        codec:
            "pcm16",

        sampleRate:
            decoded.sampleRate,

        channels:
            decoded.channels,

        durationMs:
            decoded.durationMs,

        chunkDurationMs,

        totalChunks:
            chunks.length,

        totalSamples:
            decoded.pcm16.length,

        fileName,

        mimeType,

        created:
            new Date()
                .toISOString(),

        chunks
    };
}

// ======================================================
// Selected file preparation
// ======================================================

/**
 * Opens the audio-file selector.
 */
function selectAudioForArNetStream() {
    if (!fileStreamAudio) {
        setArNetStreamStatus(
            "ERROR: The stream audio file selector is missing.",
            "#FF3333"
        );

        return;
    }

    if (isPreparingArNetStream) {
        return;
    }

    fileStreamAudio.value =
        "";

    fileStreamAudio.click();
}

/**
 * Handles a file selected by the operator.
 *
 * @param {Event} event
 */
async function handleArNetStreamFileSelection(
    event
) {
    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }

    selectedStreamAudioBlob =
        file;

    isPreparingArNetStream =
        true;

    updatePrepareStreamButton();

    setArNetStreamStatus(
        `Preparing ${file.name} for streaming...`,
        "#FFD700"
    );

    try {
        const prepared =
            await prepareArNetAudioStream(
                selectedStreamAudioBlob
            );

        lastPreparedArNetStream =
            prepared;
        updateStreamTransmitButtons();

        /*
         * This makes the prepared stream easy to inspect
         * from the browser console.
         */
        globalThis.lastPreparedArNetStream =
            prepared;

        globalThis.selectedStreamAudioBlob =
            selectedStreamAudioBlob;

        console.log(
            "Prepared ArNet stream:",
            prepared
        );

        const durationSeconds =
            Math.round(
                prepared.durationMs /
                1000
            );

        setArNetStreamStatus(
            `Stream prepared: ${prepared.totalChunks} chunks, ` +
            `${durationSeconds} seconds.`,
            "#00FF7F"
        );
    }
    catch (error) {
        console.error(
            "Stream preparation failed:",
            error
        );

        selectedStreamAudioBlob =
            null;

        lastPreparedArNetStream =
            null;

        globalThis.lastPreparedArNetStream =
            null;

        globalThis.selectedStreamAudioBlob =
            null;

        updateStreamTransmitButtons();
        setArNetStreamStatus(
            `ERROR: ${
                error.message ||
                "Could not prepare the audio stream."
            }`,
            "#FF3333"
        );
    }
    finally {
        isPreparingArNetStream =
            false;

        updatePrepareStreamButton();
        updateStreamTransmitButtons();
    }
}

// ======================================================
// Stream UI helpers
// ======================================================

/**
 * Updates the stream preparation button.
 */
function updatePrepareStreamButton() {
    if (!btnPrepareStream) {
        return;
    }

    btnPrepareStream.disabled =
        isPreparingArNetStream;

    btnPrepareStream.textContent =
        isPreparingArNetStream
            ? "PREPARING..."
            : "PREPARE AUDIO STREAM";

    btnPrepareStream.style.opacity =
        isPreparingArNetStream
            ? "0.6"
            : "1";

    btnPrepareStream.style.cursor =
        isPreparingArNetStream
            ? "wait"
            : "pointer";
}

/**
 * Displays a stream-related status message.
 *
 * @param {string} message
 * @param {string} color
 */
function setArNetStreamStatus(
    message,
    color
) {
    if (
        typeof setStatus ===
            "function"
    ) {
        setStatus(
            message,
            color
        );

        return;
    }

    if (
        typeof txtStatus !==
            "undefined" &&
        txtStatus
    ) {
        txtStatus.textContent =
            message.startsWith("STATUS:") ||
            message.startsWith("ERROR:")
                ? message
                : `STATUS: ${message}`;

        txtStatus.style.color =
            color;
    }
}

// ======================================================
// Public stream-state helpers
// ======================================================

/**
 * Returns the currently selected audio Blob.
 *
 * @returns {Blob|null}
 */
function getSelectedStreamAudioBlob() {
    return selectedStreamAudioBlob;
}

/**
 * Returns the most recently prepared stream.
 *
 * @returns {object|null}
 */
function getLastPreparedArNetStream() {
    return lastPreparedArNetStream;
}

/**
 * Clears the selected and prepared stream.
 */
function clearPreparedArNetStream() {
    selectedStreamAudioBlob =
        null;

    lastPreparedArNetStream =
        null;

    globalThis.selectedStreamAudioBlob =
        null;

    globalThis.lastPreparedArNetStream =
        null;

    if (fileStreamAudio) {
        fileStreamAudio.value =
            "";
    }

    setArNetStreamStatus(
        "Prepared stream cleared.",
        "#AAAAAA"
    );
}

// ======================================================
// Network stream transmission
// ======================================================

function waitForStreamInterval(
    milliseconds
) {
    return new Promise(
        resolve => {
            setTimeout(
                resolve,
                milliseconds
            );
        }
    );
}

async function transmitPreparedArNetStream() {
    if (
        isTransmittingArNetStream
    ) {
        return;
    }

    if (
        !lastPreparedArNetStream
    ) {
        setArNetStreamStatus(
            "ERROR: Prepare an audio stream first.",
            "#FF3333"
        );

        return;
    }

    if (
        typeof sendNetworkMessage !==
            "function" ||
        !networkConnected ||
        !networkSocket ||
        networkSocket.readyState !==
            WebSocket.OPEN
    ) {
        setArNetStreamStatus(
            "ERROR: Connect to the ArNet relay first.",
            "#FF3333"
        );

        return;
    }

    const stream =
        lastPreparedArNetStream;

    isTransmittingArNetStream =
        true;

    stopArNetStreamRequested =
        false;

    activeOutgoingStreamId =
        stream.streamId;

    updateStreamTransmitButtons();

    txtTxState.textContent =
        "STREAM";

    boxTxState.style.background =
        "#884400";

    const startSent =
        sendNetworkMessage({
            type:
                "ammef-stream-start",

            streamId:
                stream.streamId,

            from:
                typeof getNetworkCallsign ===
                    "function"
                    ? getNetworkCallsign()
                    : txtCallsign.value,

            frequency:
                typeof getNetworkFrequency ===
                    "function"
                    ? getNetworkFrequency()
                    : Number(
                        txtFrequency.value
                    ),

            mode:
                comboMode.value,

            band:
                comboBand.value,

            bandwidth:
                comboBandwidth.value,

            codec:
                stream.codec,

            sampleRate:
                stream.sampleRate,

            channels:
                stream.channels,

            chunkDurationMs:
                stream.chunkDurationMs,

            durationMs:
                stream.durationMs,

            totalChunks:
                stream.totalChunks,

            fileName:
                stream.fileName,

            timestamp:
                new Date()
                    .toISOString()
        });

    if (!startSent) {
        isTransmittingArNetStream =
            false;

        activeOutgoingStreamId =
            null;

        updateStreamTransmitButtons();

        setArNetStreamStatus(
            "ERROR: Could not begin the stream.",
            "#FF3333"
        );

        return;
    }

    const transmissionStartedAt =
        performance.now();

    try {
        for (
            const chunk of
            stream.chunks
        ) {
            if (
                stopArNetStreamRequested
            ) {
                break;
            }

            const targetTime =
                transmissionStartedAt +
                chunk.timestampMs;

            const delay =
                targetTime -
                performance.now();

            if (
                delay > 0
            ) {
                await waitForStreamInterval(
                    delay
                );
            }

            const bytes =
                pcm16ToBytes(
                    chunk.samples
                );

            const sent =
                sendNetworkMessage({
                    type:
                        "ammef-stream-chunk",

                    streamId:
                        stream.streamId,

                    frequency:
                        typeof getNetworkFrequency ===
                            "function"
                            ? getNetworkFrequency()
                            : Number(
                                txtFrequency.value
                            ),

                    mode:
                        comboMode.value,

                    band:
                        comboBand.value,

                    bandwidth:
                        comboBandwidth.value,

                    sequence:
                        chunk.sequence,

                    timestampMs:
                        chunk.timestampMs,

                    durationMs:
                        chunk.durationMs,

                    sampleCount:
                        chunk.sampleCount,

                    data:
                        streamBytesToBase64(
                            bytes
                        )
                });

            if (!sent) {
                throw new Error(
                    "The relay connection closed during streaming."
                );
            }

            setArNetStreamStatus(
                `Streaming chunk ${
                    chunk.sequence + 1
                } of ${stream.totalChunks}...`,
                "#FFD700"
            );
        }

        sendNetworkMessage({
            type:
                "ammef-stream-end",

            streamId:
                stream.streamId,

            frequency:
                typeof getNetworkFrequency ===
                    "function"
                    ? getNetworkFrequency()
                    : Number(
                        txtFrequency.value
                    ),

            finalSequence:
                stream.totalChunks -
                1,

            reason:
                stopArNetStreamRequested
                    ? "stopped"
                    : "complete",

            timestamp:
                new Date()
                    .toISOString()
        });

        setArNetStreamStatus(
            stopArNetStreamRequested
                ? "Audio stream stopped."
                : "Audio stream completed.",
            stopArNetStreamRequested
                ? "#FFAA00"
                : "#00FF7F"
        );
    }
    catch (error) {
        console.error(
            "ArNet stream transmission failed:",
            error
        );

        sendNetworkMessage({
            type:
                "ammef-stream-end",

            streamId:
                stream.streamId,

            frequency:
                typeof getNetworkFrequency ===
                    "function"
                    ? getNetworkFrequency()
                    : Number(
                        txtFrequency.value
                    ),

            reason:
                "error"
        });

        setArNetStreamStatus(
            `ERROR: ${
                error.message ||
                "Stream transmission failed."
            }`,
            "#FF3333"
        );
    }
    finally {
        isTransmittingArNetStream =
            false;

        stopArNetStreamRequested =
            false;

        activeOutgoingStreamId =
            null;

        updateStreamTransmitButtons();

        if (
            typeof returnToReceiveMode ===
                "function"
        ) {
            returnToReceiveMode();
        }
    }
}

function stopOutgoingArNetStream() {
    if (
        !isTransmittingArNetStream
    ) {
        return;
    }

    stopArNetStreamRequested =
        true;

    setArNetStreamStatus(
        "Stopping audio stream...",
        "#FFAA00"
    );
}

function updateStreamTransmitButtons() {
    if (btnStartStream) {
        btnStartStream.disabled =
            isTransmittingArNetStream ||
            !lastPreparedArNetStream;

        btnStartStream.textContent =
            isTransmittingArNetStream
                ? "STREAMING..."
                : "TX STREAM";
    }

    if (btnStopStream) {
        btnStopStream.disabled =
            !isTransmittingArNetStream;
    }
}

// ======================================================
// Event listeners
// ======================================================

function initializeArNetStreamControls() {
    if (
        btnPrepareStream &&
        fileStreamAudio
    ) {
        btnPrepareStream.addEventListener(
            "click",
            selectAudioForArNetStream
        );

        fileStreamAudio.addEventListener(
            "change",
            handleArNetStreamFileSelection
        );
    }
    else {
        console.warn(
            "ArNet stream controls were not found. " +
            "Add #btnPrepareStream and #fileStreamAudio to index.html."
        );
    }

    updatePrepareStreamButton();
}

initializeArNetStreamControls();
if (btnStartStream) {
    btnStartStream.addEventListener(
        "click",
        transmitPreparedArNetStream
    );
}

if (btnStopStream) {
    btnStopStream.addEventListener(
        "click",
        stopOutgoingArNetStream
    );
}

updateStreamTransmitButtons();
