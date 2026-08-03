// ======================================================
// ArNet Transceiver
// AMMEF Stream v2
// ======================================================

const ARNET_STREAM_SAMPLE_RATE =
    22050;

const ARNET_STREAM_CHANNELS =
    1;

const ARNET_STREAM_CHUNK_MS =
    200;

/**
 * Creates a simple unique stream ID.
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
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .slice(2)
    );
}

/**
 * Decodes an audio file and converts it to mono PCM16
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

    initAudioContext();

    if (
        audioCtx &&
        audioCtx.state ===
            "suspended"
    ) {
        await audioCtx.resume();
    }

    const sourceBuffer =
        await audioBlob.arrayBuffer();

    const decodedAudio =
        await audioCtx.decodeAudioData(
            sourceBuffer.slice(0)
        );

    if (
        decodedAudio.numberOfChannels <
            1
    ) {
        throw new Error(
            "The audio file contains no usable channel."
        );
    }

    const sourceChannel =
        decodedAudio.getChannelData(
            0
        );

    const resampledChannel =
        resampleFloat32Audio(
            sourceChannel,
            decodedAudio.sampleRate,
            ARNET_STREAM_SAMPLE_RATE
        );

    const pcm16 =
        floatChannelToPcm16(
            resampledChannel
        );

    return {
        pcm16,

        sampleRate:
            ARNET_STREAM_SAMPLE_RATE,

        channels:
            ARNET_STREAM_CHANNELS,

        durationMs:
            Math.round(
                (
                    pcm16.length /
                    ARNET_STREAM_SAMPLE_RATE
                ) *
                1000
            )
    };
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

        output[outputIndex] =
            input[lowerIndex] *
                (
                    1 -
                    fraction
                ) +
            input[upperIndex] *
                fraction;
    }

    return output;
}

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

        chunks.push({
            sequence,

            timestampMs:
                Math.round(
                    (
                        offset /
                        sampleRate
                    ) *
                    1000
                ),

            durationMs:
                Math.round(
                    (
                        samples.length /
                        sampleRate
                    ) *
                    1000
                ),

            samples
        });

        sequence++;
    }

    return chunks;
}

/**
 * Converts PCM16 samples into byte data.
 *
 * @param {Int16Array} samples
 * @returns {Uint8Array}
 */
function pcm16ToBytes(
    samples
) {
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

/**
 * Converts byte data back into PCM16 samples.
 *
 * @param {Uint8Array} bytes
 * @returns {Int16Array}
 */
function bytesToPcm16(
    bytes
) {
    const sampleCount =
        Math.floor(
            bytes.byteLength /
            2
        );

    const samples =
        new Int16Array(
            sampleCount
        );

    const view =
        new DataView(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength
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

/**
 * Prepares an audio Blob for streaming.
 *
 * @param {Blob} audioBlob
 * @returns {Promise<object>}
 */
async function prepareArNetAudioStream(
    audioBlob
) {
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

                chunkDurationMs:
                    ARNET_STREAM_CHUNK_MS
            }
        );

    return {
        streamId:
            createArNetStreamId(),

        codec:
            "pcm16",

        sampleRate:
            decoded.sampleRate,

        channels:
            decoded.channels,

        durationMs:
            decoded.durationMs,

        chunkDurationMs:
            ARNET_STREAM_CHUNK_MS,

        totalChunks:
            chunks.length,

        chunks
    };
}
