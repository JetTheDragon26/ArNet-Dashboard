// ======================================================
// ArNet Transceiver
// AMMEF Stream v2 Receiver and Jitter Buffer
// ======================================================

const ARNET_STREAM_INITIAL_BUFFER_CHUNKS =
    4;

const ARNET_STREAM_SCHEDULE_AHEAD_SECONDS =
    1.2;

const incomingArNetStreams =
    new Map();

let incomingArNetStreamAmplitude =
    0;

let incomingArNetStreamVisualTimeout =
    null;

function getIncomingArNetStreamAmplitude() {
    return incomingArNetStreamAmplitude;
}

function updateIncomingArNetStreamAmplitude(
    samples,
    durationMs = 200
) {
    if (
        !samples ||
        samples.length === 0
    ) {
        return;
    }

    let sumSquared =
        0;

    for (
        let index = 0;
        index < samples.length;
        index++
    ) {
        const normalized =
            samples[index] /
            32768;

        sumSquared +=
            normalized *
            normalized;
    }

    const rms =
        Math.sqrt(
            sumSquared /
            samples.length
        );

    incomingArNetStreamAmplitude =
        Math.max(
            0,
            Math.min(
                1,
                rms *
                    4
            )
        );

    if (
        incomingArNetStreamVisualTimeout
    ) {
        clearTimeout(
            incomingArNetStreamVisualTimeout
        );
    }

    incomingArNetStreamVisualTimeout =
        setTimeout(
            () => {
                incomingArNetStreamAmplitude =
                    0;
            },
            Math.max(
                250,
                durationMs +
                    100
            )
        );
}

//====================================
//-----------------------------------
//====================================



// ======================================================
// Base64 and PCM helpers
// ======================================================

function streamBase64ToBytes(
    base64
) {
    const binary =
        atob(
            base64
        );

    const bytes =
        new Uint8Array(
            binary.length
        );

    for (
        let index = 0;
        index < binary.length;
        index++
    ) {
        bytes[index] =
            binary.charCodeAt(
                index
            );
    }

    return bytes;
}

function streamBytesToPcm16(
    bytes
) {
    const usableLength =
        bytes.byteLength -
        (
            bytes.byteLength %
            2
        );

    const sampleCount =
        usableLength /
        2;

    const samples =
        new Int16Array(
            sampleCount
        );

    const view =
        new DataView(
            bytes.buffer,
            bytes.byteOffset,
            usableLength
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

function streamPcm16ToFloat32(
    samples
) {
    const output =
        new Float32Array(
            samples.length
        );

    for (
        let index = 0;
        index < samples.length;
        index++
    ) {
        output[index] =
            samples[index] < 0
                ? samples[index] /
                    32768
                : samples[index] /
                    32767;
    }

    return output;
}

// ======================================================
// Incoming stream lifecycle
// ======================================================

async function handleIncomingArNetStreamMessage(
    message
) {
    switch (
        message.type
    ) {
        case "ammef-stream-start":
            await beginIncomingArNetStream(
                message
            );
            break;

        case "ammef-stream-chunk":
            await receiveIncomingArNetStreamChunk(
                message
            );
            break;

        case "ammef-stream-end":
            endIncomingArNetStream(
                message
            );
            break;
    }
}

async function beginIncomingArNetStream(
    message
) {
    if (
        !message.streamId
    ) {
        return;
    }

    initAudioContext();

    if (
        audioCtx.state ===
            "suspended"
    ) {
        await audioCtx.resume();
    }

    stopIncomingArNetStream(
        message.streamId
    );

    const sampleRate =
        Number(
            message.sampleRate
        ) || 22050;

    incomingArNetStreams.set(
        message.streamId,
        {
            streamId:
                message.streamId,

            sender:
                message.from ||
                "UNKNOWN",

            frequency:
                Number(
                    message.frequency
                ),

            mode:
                message.mode ||
                "",

            band:
                message.band ||
                "",

            bandwidth:
                message.bandwidth ||
                "",

            codec:
                message.codec ||
                "pcm16",

            sampleRate,

            channels:
                Number(
                    message.channels
                ) || 1,

            chunkDurationMs:
                Number(
                    message.chunkDurationMs
                ) || 200,

            totalChunks:
                Number(
                    message.totalChunks
                ) || 0,

            chunks:
                new Map(),

            nextSequence:
    Number.isInteger(
        Number(
            message.startSequence
        )
    )
        ? Number(
            message.startSequence
        )
        : 0,

            startedPlayback:
                false,

            nextPlaybackTime:
                0,

            endReceived:
                false,

            finalSequence:
                null,

            scheduledSources:
                new Set()
        }
    );

    txtTxState.textContent =
        "RX-STREAM";

    boxTxState.style.background =
        "#004466";

    setStreamPlayerStatus(
        `Receiving stream from ${
            message.from ||
            "UNKNOWN"
        }...`,
        "#00FFFF"
    );
}

async function receiveIncomingArNetStreamChunk(
    message
) {
    const stream =
        incomingArNetStreams.get(
            message.streamId
        );

    if (
        !stream ||
        typeof message.data !==
            "string"
    ) {
        return;
    }

    const sequence =
        Number(
            message.sequence
        );

    if (
        !Number.isInteger(
            sequence
        ) ||
        sequence < 0 ||
        stream.chunks.has(
            sequence
        )
    ) {
        return;
    }

    try {
        const bytes =
            streamBase64ToBytes(
                message.data
            );

        const pcm16 =
            streamBytesToPcm16(
                bytes
            );

        

        stream.chunks.set(
            sequence,
            {
                sequence,

                timestampMs:
                    Number(
                        message.timestampMs
                    ) || 0,

                durationMs:
                    Number(
                        message.durationMs
                    ) ||
                    stream.chunkDurationMs,

                pcm16
            }
        );

        await pumpIncomingArNetStream(
            stream
        );
    }
    catch (error) {
        console.error(
            "Incoming stream chunk failed:",
            error
        );
    }
}

function clearIncomingArNetStreamVisuals() {
    incomingArNetStreamAmplitude =
        0;

    serviceAudioAmplitude =
        0;

    if (
        incomingArNetStreamVisualTimeout
    ) {
        clearTimeout(
            incomingArNetStreamVisualTimeout
        );

        incomingArNetStreamVisualTimeout =
            null;
    }
}

function endIncomingArNetStream(
    message
) {
    const stream =
        incomingArNetStreams.get(
            message.streamId
        );

    if (!stream) {
        return;
    }

    stream.endReceived =
        true;

    stream.finalSequence =
        Number.isInteger(
            Number(
                message.finalSequence
            )
        )
            ? Number(
                message.finalSequence
            )
            : stream.nextSequence - 1;

    pumpIncomingArNetStream(
        stream
    ).catch(
        console.error
    );
}

// ======================================================
// Jitter buffering and playback
// ======================================================

async function pumpIncomingArNetStream(
    stream
) {
    if (
        !stream ||
        !audioCtx
    ) {
        return;
    }

    if (
        !stream.startedPlayback
    ) {
        const availableChunks =
            countConsecutiveStreamChunks(
                stream,
                stream.nextSequence
            );

        if (
            availableChunks <
                ARNET_STREAM_INITIAL_BUFFER_CHUNKS &&
            !stream.endReceived
        ) {
            setStreamPlayerStatus(
                `Buffering stream from ${stream.sender}: ` +
                `${availableChunks}/` +
                `${ARNET_STREAM_INITIAL_BUFFER_CHUNKS}`,
                "#FFD700"
            );

            return;
        }

        stream.startedPlayback =
            true;

        stream.nextPlaybackTime =
            audioCtx.currentTime +
            0.15;

        setStreamPlayerStatus(
            `Playing stream from ${stream.sender}.`,
            "#00FF7F"
        );
    }

    while (
        stream.chunks.has(
            stream.nextSequence
        ) &&
        stream.nextPlaybackTime <
            audioCtx.currentTime +
            ARNET_STREAM_SCHEDULE_AHEAD_SECONDS
    ) {
        const chunk =
            stream.chunks.get(
                stream.nextSequence
            );

        stream.chunks.delete(
            stream.nextSequence
        );

        scheduleIncomingStreamChunk(
            stream,
            chunk
        );

        stream.nextSequence++;
    }

    if (
        stream.endReceived &&
        !stream.chunks.has(
            stream.nextSequence
        ) &&
        stream.nextSequence >
            stream.finalSequence
    ) {
        const remainingMs =
            Math.max(
                0,
                (
                    stream.nextPlaybackTime -
                    audioCtx.currentTime
                ) *
                1000
            );

        setTimeout(
            () => {
                finishIncomingArNetStream(
                    stream.streamId
                );
            },
            remainingMs + 100
        );

        return;
    }

    if (
        stream.startedPlayback
    ) {
        setTimeout(
            () => {
                pumpIncomingArNetStream(
                    stream
                ).catch(
                    console.error
                );
            },
            50
        );
    }
}

function scheduleIncomingStreamChunk(
    stream,
    chunk
) {
    const floatSamples =
        streamPcm16ToFloat32(
            chunk.pcm16
        );

    const audioBuffer =
        audioCtx.createBuffer(
            1,
            floatSamples.length,
            stream.sampleRate
        );

    audioBuffer
        .getChannelData(0)
        .set(
            floatSamples
        );

    const source =
        audioCtx.createBufferSource();

    source.buffer =
        audioBuffer;

    /*
 * Main audible path.
 */
source.connect(
    audioCtx.destination
);

    const startTime =
        Math.max(
            audioCtx.currentTime +
                0.02,
            stream.nextPlaybackTime
        );

    source.start(
        startTime
    );

    stream.scheduledSources.add(
        source
    );

    source.addEventListener(
        "ended",
        () => {
            stream.scheduledSources.delete(
                source
            );
        },
        {
            once: true
        }
    );

    stream.nextPlaybackTime =
        startTime +
        audioBuffer.duration;
}

function countConsecutiveStreamChunks(
    stream,
    startingSequence
) {
    let count =
        0;

    while (
        stream.chunks.has(
            startingSequence +
            count
        )
    ) {
        count++;
    }

    return count;
}

// ======================================================
// Stream cleanup
// ======================================================

function finishIncomingArNetStream(
    streamId
) {
    const stream =
        incomingArNetStreams.get(
            streamId
        );

    if (!stream) {
        return;
    }

    incomingArNetStreams.delete(
        streamId
    );

    if (
    incomingArNetStreams.size ===
    0
) {
    clearIncomingArNetStreamVisuals();
}

    setStreamPlayerStatus(
        `Stream from ${stream.sender} completed.`,
        "#00FF7F"
    );

    if (
        typeof returnToReceiveMode ===
            "function"
    ) {
        returnToReceiveMode();
    }
}

function stopIncomingArNetStream(
    streamId
) {
    const stream =
        incomingArNetStreams.get(
            streamId
        );

    if (!stream) {
        return;
    }

    for (
        const source of
        stream.scheduledSources
    ) {
        try {
            source.stop();
        }
        catch {
            // Source may already have ended.
        }
    }

    stream.scheduledSources.clear();
    stream.chunks.clear();

    incomingArNetStreams.delete(
        streamId
    );

    if (
    incomingArNetStreams.size ===
    0
) {
    clearIncomingArNetStreamVisuals();
}


function stopAllIncomingArNetStreams() {
    for (
        const streamId of
        incomingArNetStreams.keys()
    ) {
        stopIncomingArNetStream(
            streamId
        );
    }

    if (
        typeof returnToReceiveMode ===
            "function"
    ) {
        returnToReceiveMode();
    }
}

// ======================================================
// Status helper
// ======================================================

function setStreamPlayerStatus(
    message,
    color
) {
    if (
        typeof setNetworkStatus ===
            "function"
    ) {
        setNetworkStatus(
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
