// ======================================================
// ArNet Transceiver
// AMMEF 2.3 Container Reader and Writer
// ======================================================

const AMMEF_MAGIC =
    "AMMEF";

const AMMEF_MEDIA_VERSION =
    "2.3";

const AMMEF_MEDIA_MARKER =
    0x04;

/*
 * AMMEF 2.3 binary layout
 *
 * Bytes 0–4:
 *     ASCII "AMMEF"
 *
 * Byte 5:
 *     Version marker 0x04
 *
 * Bytes 6–9:
 *     Metadata JSON length
 *
 * Bytes 10–13:
 *     Clean audio length
 *
 * Bytes 14–17:
 *     FM monitor audio length
 *
 * Bytes 18–21:
 *     Telemetry audio length
 *
 * Bytes 22–25:
 *     Video-monitor audio length
 *
 * Bytes 26–29:
 *     Photo-monitor audio length
 *
 * Bytes 30–33:
 *     Original video length
 *
 * Bytes 34–37:
 *     Original photo length
 *
 * Bytes 38+:
 *     Metadata JSON
 *     Clean WAV
 *     FM monitor WAV
 *     Telemetry WAV
 *     Video-monitor WAV
 *     Photo-monitor WAV
 *     Original video
 *     Original photo
 */

const AMMEF_MEDIA_HEADER_LENGTH =
    38;

// ======================================================
// Basic helpers
// ======================================================

/**
 * Checks whether a byte array begins with "AMMEF".
 *
 * @param {Uint8Array} data
 * @returns {boolean}
 */
function hasAMMEFHeader(
    data
) {
    return (
        data instanceof Uint8Array &&
        data.length >= 5 &&
        data[0] === 0x41 &&
        data[1] === 0x4D &&
        data[2] === 0x4D &&
        data[3] === 0x45 &&
        data[4] === 0x46
    );
}

/**
 * Converts a Blob into bytes.
 *
 * Null or missing blobs become an empty byte array.
 *
 * @param {Blob|null} blob
 * @returns {Promise<Uint8Array>}
 */
async function blobToBytes(
    blob
) {
    if (
        !(blob instanceof Blob)
    ) {
        return new Uint8Array(
            0
        );
    }

    return new Uint8Array(
        await blob.arrayBuffer()
    );
}

/**
 * Creates a Blob from a range inside an AMMEF byte array.
 *
 * @param {Uint8Array} data
 * @param {number} start
 * @param {number} length
 * @param {string} mimeType
 * @returns {Blob|null}
 */
function createPayloadBlob(
    data,
    start,
    length,
    mimeType
) {
    if (
        !Number.isFinite(length) ||
        length <= 0
    ) {
        return null;
    }

    const end =
        start +
        length;

    if (
        start < 0 ||
        end > data.length ||
        end < start
    ) {
        throw new Error(
            "AMMEF payload boundaries are invalid."
        );
    }

    return new Blob(
        [
            data.slice(
                start,
                end
            )
        ],
        {
            type:
                mimeType ||
                "application/octet-stream"
        }
    );
}

/**
 * Makes a safe filename component.
 *
 * @param {string} value
 * @returns {string}
 */
function sanitizeDownloadName(
    value
) {
    return String(
        value ||
        ""
    )
        .trim()
        .replace(
            /[^A-Za-z0-9_.-]/g,
            "_"
        );
}

/**
 * Returns the first valid Blob in the supplied list.
 *
 * @param  {...any} values
 * @returns {Blob|null}
 */
function firstValidBlob(
    ...values
) {
    for (
        const value of
        values
    ) {
        if (
            value instanceof Blob
        ) {
            return value;
        }
    }

    return null;
}

/**
 * Reads a MIME type from AMMEF metadata.
 *
 * @param {object} metadata
 * @param {string} trackName
 * @param {string} fallback
 * @returns {string}
 */
function getTrackMimeType(
    metadata,
    trackName,
    fallback
) {
    return (
        metadata?.tracks?.[
            trackName
        ]?.mimeType ||
        fallback
    );
}

/**
 * Reads a filename from AMMEF metadata.
 *
 * @param {object} metadata
 * @param {string} trackName
 * @param {string|null} fallback
 * @returns {string|null}
 */
function getTrackFileName(
    metadata,
    trackName,
    fallback = null
) {
    return (
        metadata?.tracks?.[
            trackName
        ]?.fileName ||
        fallback
    );
}

// ======================================================
// Transmission-type detection
// ======================================================

/**
 * Determines what kind of payload is currently prepared.
 *
 * @returns {"video"|"photo"|"voice"|"audio"}
 */
function determineCurrentAMMEFKind() {
    if (
        lastOriginalVideoBlob instanceof Blob
    ) {
        return "video";
    }

    if (
        lastOriginalPhotoBlob instanceof Blob
    ) {
        return "photo";
    }

    if (
        lastCleanAudioBlob instanceof Blob
    ) {
        return "voice";
    }

    return "audio";
}

// ======================================================
// Metadata creation
// ======================================================

/**
 * Builds AMMEF metadata.
 *
 * @param {object} lengths
 * @param {string} transmissionKind
 * @returns {object}
 */
function createAMMEFMetadata(
    lengths,
    transmissionKind =
        determineCurrentAMMEFKind()
) {
    return {
        format:
            AMMEF_MAGIC,

        version:
            AMMEF_MEDIA_VERSION,

        transmissionKind,

        mode:
            comboMode.value,

        band:
            comboBand.value,

        bandwidth:
            comboBandwidth.value,

        virtualFrequency:
            Number(
                txtFrequency.value
            ),

        frequencyUnit:
            "Vt",

        callsign:
            txtCallsign.value
                .trim()
                .toUpperCase(),

        created:
            new Date()
                .toISOString(),

        tracks: {
            cleanAudio: {
                present:
                    lengths.clean >
                    0,

                byteLength:
                    lengths.clean,

                mimeType:
                    "audio/wav"
            },

            fmMonitor: {
                present:
                    lengths.monitor >
                    0,

                byteLength:
                    lengths.monitor,

                mimeType:
                    "audio/wav"
            },

            telemetry: {
                present:
                    lengths.telemetry >
                    0,

                byteLength:
                    lengths.telemetry,

                mimeType:
                    "audio/wav"
            },

            videoMonitor: {
                present:
                    lengths.videoMonitor >
                    0,

                byteLength:
                    lengths.videoMonitor,

                mimeType:
                    "audio/wav",

                metadata:
                    lastVideoMetadata ||
                    null
            },

            photoMonitor: {
                present:
                    lengths.photoMonitor >
                    0,

                byteLength:
                    lengths.photoMonitor,

                mimeType:
                    "audio/wav",

                metadata:
                    lastPhotoMetadata ||
                    null
            },

            originalVideo: {
                present:
                    lengths.video >
                    0,

                byteLength:
                    lengths.video,

                fileName:
                    lastOriginalVideoName ||
                    null,

                mimeType:
                    lastOriginalVideoType ||
                    lastOriginalVideoBlob
                        ?.type ||
                    "application/octet-stream"
            },

            originalPhoto: {
                present:
                    lengths.photo >
                    0,

                byteLength:
                    lengths.photo,

                fileName:
                    lastOriginalPhotoName ||
                    null,

                mimeType:
                    lastOriginalPhotoType ||
                    lastOriginalPhotoBlob
                        ?.type ||
                    "application/octet-stream"
            }
        }
    };
}

/**
 * Applies AMMEF metadata to the dashboard controls.
 *
 * @param {object} metadata
 */
function applyAMMEFMetadata(
    metadata
) {
    if (
        !metadata ||
        typeof metadata !==
            "object"
    ) {
        return;
    }

    if (
        [
            "AARM",
            "ABM",
            "ABMTV"
        ].includes(
            metadata.mode
        )
    ) {
        comboMode.value =
            metadata.mode;

        if (
            typeof updateBandList ===
            "function"
        ) {
            updateBandList();
        }
    }

    if (
        typeof metadata.band ===
            "string"
    ) {
        const optionExists =
            Array.from(
                comboBand.options
            ).some(
                option =>
                    option.value ===
                    metadata.band
            );

        if (optionExists) {
            comboBand.value =
                metadata.band;
        }
    }

    if (
        [
            "wide",
            "narrow"
        ].includes(
            metadata.bandwidth
        )
    ) {
        comboBandwidth.value =
            metadata.bandwidth;
    }

    const frequency =
        Number(
            metadata.virtualFrequency
        );

    if (
        Number.isFinite(
            frequency
        )
    ) {
        txtFrequency.value =
            String(
                frequency
            );
    }

    /*
     * Do not automatically overwrite the local operator's
     * callsign when receiving another station's packet.
     *
     * The sending callsign remains available inside
     * metadata.callsign.
     */
}

// ======================================================
// AMMEF creation
// ======================================================

/**
 * Creates an AMMEF Blob from the currently prepared
 * audio, photo, or video payloads.
 *
 * @param {object} options
 * @param {string} options.transmissionKind
 * @returns {Promise<Blob>}
 */
async function createAMMEFBlob(
    options = {}
) {
    const requestedKind =
        options.transmissionKind ||
        determineCurrentAMMEFKind();

    /*
     * A general audio transmission normally contains:
     *
     * clean audio:
     *     Recoverable receiver audio.
     *
     * monitor audio:
     *     The encoded waveform heard by the sender.
     */
    let cleanBlob =
        firstValidBlob(
            lastCleanAudioBlob
        );

    let monitorBlob =
        firstValidBlob(
            lastModulatedAudioBlob
        );

    const telemetryBlob =
        firstValidBlob(
            lastTelemetryAudioBlob
        );

    const videoMonitorBlob =
        firstValidBlob(
            lastVideoMonitorAudioBlob
        );

    const photoMonitorBlob =
        firstValidBlob(
            lastPhotoMonitorAudioBlob
        );

    const videoBlob =
        firstValidBlob(
            lastOriginalVideoBlob
        );

    const photoBlob =
        firstValidBlob(
            lastOriginalPhotoBlob
        );

    /*
 * Morse and IDENT have no separate clean track.
 * Their encoded waveform may be stored in
 * lastProcessedAudioBlob.
 */
if (
    (
        requestedKind ===
            "ident" ||
        requestedKind ===
            "morse"
    ) &&
    !monitorBlob
) {
    monitorBlob =
        firstValidBlob(
            lastProcessedAudioBlob
        );
}

    /*
     * Avoid treating a visual monitor waveform as clean
     * voice/audio.
     */
    if (
        requestedKind ===
            "photo" ||
        requestedKind ===
            "video" ||
        comboMode.value ===
            "ABMTV"
    ) {
        cleanBlob =
            null;
    }

    /*
     * Avoid storing a specialized visual monitor twice.
     */
    if (
        monitorBlob ===
            videoMonitorBlob ||
        monitorBlob ===
            photoMonitorBlob
    ) {
        monitorBlob =
            null;
    }

    const cleanBytes =
        await blobToBytes(
            cleanBlob
        );

    const monitorBytes =
        await blobToBytes(
            monitorBlob
        );

    const telemetryBytes =
        await blobToBytes(
            telemetryBlob
        );

    const videoMonitorBytes =
        await blobToBytes(
            videoMonitorBlob
        );

    const photoMonitorBytes =
        await blobToBytes(
            photoMonitorBlob
        );

    const videoBytes =
        await blobToBytes(
            videoBlob
        );

    const photoBytes =
        await blobToBytes(
            photoBlob
        );

    const totalPayloadLength =
        cleanBytes.length +
        monitorBytes.length +
        telemetryBytes.length +
        videoMonitorBytes.length +
        photoMonitorBytes.length +
        videoBytes.length +
        photoBytes.length;

    if (
        totalPayloadLength ===
        0
    ) {
        throw new Error(
            "No audio or visual payload is available for AMMEF creation."
        );
    }

    const lengths = {
        clean:
            cleanBytes.length,

        monitor:
            monitorBytes.length,

        telemetry:
            telemetryBytes.length,

        videoMonitor:
            videoMonitorBytes.length,

        photoMonitor:
            photoMonitorBytes.length,

        video:
            videoBytes.length,

        photo:
            photoBytes.length
    };

    const metadata =
        createAMMEFMetadata(
            lengths,
            requestedKind
        );

    const metadataBytes =
        new TextEncoder()
            .encode(
                JSON.stringify(
                    metadata
                )
            );

    const combined =
        new Uint8Array(
            AMMEF_MEDIA_HEADER_LENGTH +
            metadataBytes.length +
            totalPayloadLength
        );

    const view =
        new DataView(
            combined.buffer
        );

    // AMMEF magic: "AMMEF"
    combined[0] =
        0x41;

    combined[1] =
        0x4D;

    combined[2] =
        0x4D;

    combined[3] =
        0x45;

    combined[4] =
        0x46;

    // AMMEF 2.3 marker
    combined[5] =
        AMMEF_MEDIA_MARKER;

    view.setUint32(
        6,
        metadataBytes.length,
        true
    );

    view.setUint32(
        10,
        cleanBytes.length,
        true
    );

    view.setUint32(
        14,
        monitorBytes.length,
        true
    );

    view.setUint32(
        18,
        telemetryBytes.length,
        true
    );

    view.setUint32(
        22,
        videoMonitorBytes.length,
        true
    );

    view.setUint32(
        26,
        photoMonitorBytes.length,
        true
    );

    view.setUint32(
        30,
        videoBytes.length,
        true
    );

    view.setUint32(
        34,
        photoBytes.length,
        true
    );

    let offset =
        AMMEF_MEDIA_HEADER_LENGTH;

    const appendBytes =
        bytes => {
            combined.set(
                bytes,
                offset
            );

            offset +=
                bytes.length;
        };

    appendBytes(
        metadataBytes
    );

    appendBytes(
        cleanBytes
    );

    appendBytes(
        monitorBytes
    );

    appendBytes(
        telemetryBytes
    );

    appendBytes(
        videoMonitorBytes
    );

    appendBytes(
        photoMonitorBytes
    );

    appendBytes(
        videoBytes
    );

    appendBytes(
        photoBytes
    );

    lastAMMEFData = {
        metadata,

        cleanAudioBlob:
            cleanBlob,

        monitorAudioBlob:
            monitorBlob,

        telemetryAudioBlob:
            telemetryBlob,

        videoMonitorAudioBlob:
            videoMonitorBlob,

        photoMonitorAudioBlob:
            photoMonitorBlob,

        originalVideoBlob:
            videoBlob,

        originalVideoName:
            lastOriginalVideoName ||
            null,

        originalVideoType:
            lastOriginalVideoType ||
            videoBlob?.type ||
            null,

        originalPhotoBlob:
            photoBlob,

        originalPhotoName:
            lastOriginalPhotoName ||
            null,

        originalPhotoType:
            lastOriginalPhotoType ||
            photoBlob?.type ||
            null
    };

    return new Blob(
        [
            combined
        ],
        {
            type:
                "application/x-ammef"
        }
    );
}

// ======================================================
// AMMEF saving
// ======================================================

/**
 * Saves the currently prepared media as an AMMEF file.
 */
async function saveAMMEFFile() {
    try {
        txtStatus.textContent =
            "STATUS: Building AMMEF 2.3 container...";

        txtStatus.style.color =
            "yellow";

        const ammefBlob =
            await createAMMEFBlob();

        const url =
            URL.createObjectURL(
                ammefBlob
            );

        const anchor =
            document.createElement(
                "a"
            );

        const callsign =
            sanitizeDownloadName(
                txtCallsign.value ||
                "Station"
            );

        const mode =
            sanitizeDownloadName(
                comboMode.value ||
                "ArNet"
            );

        const frequency =
            sanitizeDownloadName(
                txtFrequency.value ||
                "0000"
            );

        anchor.href =
            url;

        anchor.download =
            `ArNet_${callsign}_${mode}_${frequency}Vt.AMMEF`;

        document.body.appendChild(
            anchor
        );

        anchor.click();
        anchor.remove();

        setTimeout(
            () => {
                URL.revokeObjectURL(
                    url
                );
            },
            1000
        );

        txtStatus.textContent =
            "STATUS: AMMEF 2.3 saved successfully.";

        txtStatus.style.color =
            "#90EE90";
    }
    catch (error) {
        console.error(
            "AMMEF save error:",
            error
        );

        txtStatus.textContent =
            `ERROR: ${
                error.message ||
                "Could not create the AMMEF file."
            }`;

        txtStatus.style.color =
            "#FF3333";
    }
}

// ======================================================
// AMMEF 2.3 parsing
// ======================================================

/**
 * Parses an AMMEF 2.3 byte array.
 *
 * @param {ArrayBuffer} buffer
 * @param {Uint8Array} data
 * @returns {object}
 */
function parseMediaAMMEF(
    buffer,
    data
) {
    if (
        data.length <
        AMMEF_MEDIA_HEADER_LENGTH
    ) {
        throw new Error(
            "AMMEF 2.3 header is incomplete."
        );
    }

    const view =
        new DataView(
            buffer
        );

    const metadataLength =
        view.getUint32(
            6,
            true
        );

    const cleanLength =
        view.getUint32(
            10,
            true
        );

    const monitorLength =
        view.getUint32(
            14,
            true
        );

    const telemetryLength =
        view.getUint32(
            18,
            true
        );

    const videoMonitorLength =
        view.getUint32(
            22,
            true
        );

    const photoMonitorLength =
        view.getUint32(
            26,
            true
        );

    const videoLength =
        view.getUint32(
            30,
            true
        );

    const photoLength =
        view.getUint32(
            34,
            true
        );

    let offset =
        AMMEF_MEDIA_HEADER_LENGTH;

    const metadataStart =
        offset;

    const metadataEnd =
        metadataStart +
        metadataLength;

    if (
        metadataLength <
            2 ||
        metadataEnd >
            data.length
    ) {
        throw new Error(
            "AMMEF metadata length is invalid."
        );
    }

    let metadata;

    try {
        metadata =
            JSON.parse(
                new TextDecoder()
                    .decode(
                        data.slice(
                            metadataStart,
                            metadataEnd
                        )
                    )
            );
    }
    catch (error) {
        throw new Error(
            `AMMEF metadata JSON is invalid: ${error.message}`
        );
    }

    offset =
        metadataEnd;

    const readPayload =
        (
            length,
            mimeType
        ) => {
            const blob =
                createPayloadBlob(
                    data,
                    offset,
                    length,
                    mimeType
                );

            offset +=
                length;

            return blob;
        };

    const cleanAudioBlob =
        readPayload(
            cleanLength,
            getTrackMimeType(
                metadata,
                "cleanAudio",
                "audio/wav"
            )
        );

    const monitorAudioBlob =
        readPayload(
            monitorLength,
            getTrackMimeType(
                metadata,
                "fmMonitor",
                "audio/wav"
            )
        );

    const telemetryAudioBlob =
        readPayload(
            telemetryLength,
            getTrackMimeType(
                metadata,
                "telemetry",
                "audio/wav"
            )
        );

    const videoMonitorAudioBlob =
        readPayload(
            videoMonitorLength,
            getTrackMimeType(
                metadata,
                "videoMonitor",
                "audio/wav"
            )
        );

    const photoMonitorAudioBlob =
        readPayload(
            photoMonitorLength,
            getTrackMimeType(
                metadata,
                "photoMonitor",
                "audio/wav"
            )
        );

    const originalVideoType =
        getTrackMimeType(
            metadata,
            "originalVideo",
            "application/octet-stream"
        );

    const originalVideoName =
        getTrackFileName(
            metadata,
            "originalVideo",
            "ArNet_Video.bin"
        );

    const originalVideoBlob =
        readPayload(
            videoLength,
            originalVideoType
        );

    const originalPhotoType =
        getTrackMimeType(
            metadata,
            "originalPhoto",
            "application/octet-stream"
        );

    const originalPhotoName =
        getTrackFileName(
            metadata,
            "originalPhoto",
            "ArNet_Photo.bin"
        );

    const originalPhotoBlob =
        readPayload(
            photoLength,
            originalPhotoType
        );

    if (
        offset !==
        data.length
    ) {
        console.warn(
            "AMMEF contains trailing or unaccounted bytes:",
            data.length -
            offset
        );
    }

    return {
        metadata,

        cleanAudioBlob,
        monitorAudioBlob,
        telemetryAudioBlob,

        videoMonitorAudioBlob,
        photoMonitorAudioBlob,

        originalVideoBlob,
        originalVideoName,
        originalVideoType,

        originalPhotoBlob,
        originalPhotoName,
        originalPhotoType
    };
}

// ======================================================
// Legacy AMMEF parser
// ======================================================

/**
 * Reads the original AMMEF format:
 *
 * Bytes 0–4:
 *     "AMMEF"
 *
 * Bytes 5–8:
 *     Metadata length
 *
 * Bytes 9+:
 *     Metadata JSON
 *     WAV payload
 *
 * @param {ArrayBuffer} buffer
 * @param {Uint8Array} data
 * @returns {object}
 */
function parseLegacyAMMEF(
    buffer,
    data
) {
    if (
        data.length < 9
    ) {
        throw new Error(
            "Legacy AMMEF header is incomplete."
        );
    }

    const view =
        new DataView(
            buffer
        );

    const metadataLength =
        view.getUint32(
            5,
            true
        );

    const metadataStart =
        9;

    const metadataEnd =
        metadataStart +
        metadataLength;

    if (
        metadataLength <
            2 ||
        metadataEnd >
            data.length
    ) {
        throw new Error(
            "Legacy AMMEF metadata length is invalid."
        );
    }

    let metadata;

    try {
        metadata =
            JSON.parse(
                new TextDecoder()
                    .decode(
                        data.slice(
                            metadataStart,
                            metadataEnd
                        )
                    )
            );
    }
    catch (error) {
        throw new Error(
            `Legacy AMMEF metadata JSON is invalid: ${error.message}`
        );
    }

    const wavBytes =
        data.slice(
            metadataEnd
        );

    const cleanAudioBlob =
        wavBytes.length >
            0
            ? new Blob(
                [
                    wavBytes
                ],
                {
                    type:
                        "audio/wav"
                }
            )
            : null;

    return {
        metadata: {
            ...metadata,

            version:
                metadata.version ||
                "1.0",

            transmissionKind:
                metadata.transmissionKind ||
                "audio"
        },

        cleanAudioBlob,

        monitorAudioBlob:
            null,

        telemetryAudioBlob:
            null,

        videoMonitorAudioBlob:
            null,

        photoMonitorAudioBlob:
            null,

        originalVideoBlob:
            null,

        originalVideoName:
            null,

        originalVideoType:
            null,

        originalPhotoBlob:
            null,

        originalPhotoName:
            null,

        originalPhotoType:
            null
    };
}

// ======================================================
// General AMMEF reader
// ======================================================

/**
 * Reads an AMMEF File or Blob.
 *
 * This is used for:
 *
 * - Local file loading
 * - Network AMMEF reception
 *
 * @param {Blob} fileOrBlob
 * @returns {Promise<object>}
 */
async function readAMMEFFile(
    fileOrBlob
) {
    if (
        !(fileOrBlob instanceof Blob)
    ) {
        throw new TypeError(
            "readAMMEFFile requires a File or Blob."
        );
    }

    const buffer =
        await fileOrBlob
            .arrayBuffer();

    const data =
        new Uint8Array(
            buffer
        );

    if (
        !hasAMMEFHeader(
            data
        )
    ) {
        throw new Error(
            "Invalid AMMEF header."
        );
    }

    let parsed;

    /*
     * AMMEF 2.3 uses the marker byte at offset 5.
     *
     * Legacy AMMEF places the first metadata-length byte
     * at offset 5, so any marker other than 0x04 is
     * treated as legacy.
     */
    if (
        data.length >=
            AMMEF_MEDIA_HEADER_LENGTH &&
        data[5] ===
            AMMEF_MEDIA_MARKER
    ) {
        parsed =
            parseMediaAMMEF(
                buffer,
                data
            );
    }
    else {
        parsed =
            parseLegacyAMMEF(
                buffer,
                data
            );
    }

    lastAMMEFData =
        parsed;

    return parsed;
}

// ======================================================
// Restoring loaded AMMEF state
// ======================================================

/**
 * Copies parsed AMMEF data into the dashboard's global
 * media variables.
 *
 * @param {object} parsed
 */
function restoreAMMEFGlobals(
    parsed
) {
    if (
        !parsed ||
        typeof parsed !==
            "object"
    ) {
        return;
    }

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
     * Copy into the ordinary variables used by the
     * photo/video preview functions.
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

    lastCleanAudioBlob =
        parsed.cleanAudioBlob ||
        null;

    lastModulatedAudioBlob =
        parsed.monitorAudioBlob ||
        parsed.videoMonitorAudioBlob ||
        parsed.photoMonitorAudioBlob ||
        null;

    lastTelemetryAudioBlob =
        parsed.telemetryAudioBlob ||
        null;

    lastProcessedAudioBlob =
        parsed.cleanAudioBlob ||
        parsed.monitorAudioBlob ||
        parsed.videoMonitorAudioBlob ||
        parsed.photoMonitorAudioBlob ||
        parsed.telemetryAudioBlob ||
        null;

    lastAMMEFData =
        parsed;

    if (
        parsed.metadata
    ) {
        lastVideoMetadata =
            parsed.metadata
                ?.tracks
                ?.videoMonitor
                ?.metadata ||
            null;

        lastPhotoMetadata =
            parsed.metadata
                ?.tracks
                ?.photoMonitor
                ?.metadata ||
            null;
    }
}

// ======================================================
// Local AMMEF loading
// ======================================================

/**
 * Loads and decodes a local AMMEF file.
 *
 * @param {Blob} file
 * @returns {Promise<object>}
 */
async function loadAMMEF(
    file
) {
    if (
        !(file instanceof Blob)
    ) {
        throw new TypeError(
            "loadAMMEF requires a File or Blob."
        );
    }

    txtTxState.textContent =
        "LOAD";

    boxTxState.style.background =
        "#004466";

    txtStatus.textContent =
        "STATUS: Reading AMMEF container...";

    txtStatus.style.color =
        "#FFD700";

    try {
        const parsed =
            await readAMMEFFile(
                file
            );

        restoreAMMEFGlobals(
            parsed
        );

        applyAMMEFMetadata(
            parsed.metadata
        );

        if (
            typeof refreshMediaActionButtons ===
            "function"
        ) {
            refreshMediaActionButtons();
        }

        /*
         * Use the same central decoder that handles
         * Internet AMMEF packets.
         */
        if (
            typeof decodeIncomingAMMEFPacket ===
            "function"
        ) {
            await decodeIncomingAMMEFPacket(
                parsed,
                {
                    transmissionKind:
                        parsed.metadata
                            ?.transmissionKind ||
                        "audio",

                    from:
                        parsed.metadata
                            ?.callsign ||
                        "FILE",

                    frequency:
                        parsed.metadata
                            ?.virtualFrequency
                }
            );
        }
        else {
            /*
             * Basic fallback if decoder.js has not loaded.
             */
            const playableBlob =
                parsed.cleanAudioBlob ||
                parsed.monitorAudioBlob ||
                parsed.photoMonitorAudioBlob ||
                parsed.videoMonitorAudioBlob ||
                parsed.telemetryAudioBlob;

            if (
                playableBlob &&
                typeof playAudioBlob ===
                    "function"
            ) {
                await playAudioBlob(
                    playableBlob
                );
            }
        }

        txtStatus.textContent =
            `STATUS: AMMEF ${
                parsed.metadata
                    ?.version ||
                ""
            } loaded successfully.`;

        txtStatus.style.color =
            "#00FF7F";

        return parsed;
    }
    catch (error) {
        console.error(
            "AMMEF load error:",
            error
        );

        txtStatus.textContent =
            `ERROR: ${
                error.message ||
                "Invalid AMMEF file."
            }`;

        txtStatus.style.color =
            "#FF3333";

        if (
            typeof returnToReceiveMode ===
            "function"
        ) {
            returnToReceiveMode();
        }

        throw error;
    }
}

/**
 * Alias retained for compatibility with older code.
 *
 * @param {Blob} file
 * @returns {Promise<object>}
 */
async function loadAMMEFFile(
    file
) {
    return loadAMMEF(
        file
    );
}

// ======================================================
// AMMEF file picker
// ======================================================

/**
 * Opens a file picker for AMMEF files.
 */
function openAMMEFPicker() {
    const fileInput =
        document.createElement(
            "input"
        );

    fileInput.type =
        "file";

    fileInput.accept =
        ".ammef,.AMMEF,application/x-ammef";

    fileInput.onchange =
        async event => {
            const file =
                event.target
                    .files?.[0];

            if (!file) {
                return;
            }

            try {
                await loadAMMEF(
                    file
                );
            }
            catch {
                /*
                 * loadAMMEF already handles the displayed
                 * error message.
                 */
            }
        };

    fileInput.click();
}

// ======================================================
// Loaded-track playback
// ======================================================

/**
 * Plays the clean audio from the most recently loaded
 * AMMEF file.
 */
async function playLoadedAMMEFCleanAudio() {
    if (
        !(
            lastLoadedAMMEFCleanBlob
            instanceof Blob
        )
    ) {
        throw new Error(
            "This AMMEF contains no clean audio track."
        );
    }

    await playAudioBlob(
        lastLoadedAMMEFCleanBlob
    );
}

/**
 * Plays the raw FM monitor waveform.
 */
async function playLoadedAMMEFMonitorAudio() {
    if (
        !(
            lastLoadedAMMEFMonitorBlob
            instanceof Blob
        )
    ) {
        throw new Error(
            "This AMMEF contains no FM monitor track."
        );
    }

    if (
        typeof monitorRawAudio ===
        "function"
    ) {
        await monitorRawAudio(
            lastLoadedAMMEFMonitorBlob
        );
    }
    else {
        await playAudioBlob(
            lastLoadedAMMEFMonitorBlob
        );
    }
}

/**
 * Plays the telemetry waveform.
 */
async function playLoadedAMMEFTelemetry() {
    if (
        !(
            lastLoadedAMMEFTelemetryBlob
            instanceof Blob
        )
    ) {
        throw new Error(
            "This AMMEF contains no telemetry track."
        );
    }

    await playAudioBlob(
        lastLoadedAMMEFTelemetryBlob
    );
}

/**
 * Plays the photo monitor tones.
 */
async function playLoadedAMMEFPhotoMonitor() {
    if (
        !(
            lastLoadedAMMEFPhotoMonitorBlob
            instanceof Blob
        )
    ) {
        throw new Error(
            "This AMMEF contains no photo-monitor track."
        );
    }

    await playAudioBlob(
        lastLoadedAMMEFPhotoMonitorBlob
    );
}

/**
 * Plays the video monitor tones.
 */
async function playLoadedAMMEFVideoMonitor() {
    if (
        !(
            lastLoadedAMMEFVideoMonitorBlob
            instanceof Blob
        )
    ) {
        throw new Error(
            "This AMMEF contains no video-monitor track."
        );
    }

    await playAudioBlob(
        lastLoadedAMMEFVideoMonitorBlob
    );
}

// ======================================================
// Loaded media preview
// ======================================================

/**
 * Previews the original photo restored from AMMEF.
 */
function previewLoadedAMMEFPhoto() {
    if (
        !(
            lastLoadedAMMEFPhotoBlob
            instanceof Blob
        )
    ) {
        txtStatus.textContent =
            "ERROR: The loaded AMMEF contains no original photo.";

        txtStatus.style.color =
            "#FF3333";

        return;
    }

    lastOriginalPhotoBlob =
        lastLoadedAMMEFPhotoBlob;

    lastOriginalPhotoName =
        lastLoadedAMMEFPhotoName ||
        "ArNet_Photo";

    lastOriginalPhotoType =
        lastLoadedAMMEFPhotoType ||
        lastLoadedAMMEFPhotoBlob
            .type;

    if (
        typeof previewOriginalPhoto ===
        "function"
    ) {
        previewOriginalPhoto();
    }
}

/**
 * Previews the original video restored from AMMEF.
 */
function previewLoadedAMMEFVideo() {
    if (
        !(
            lastLoadedAMMEFVideoBlob
            instanceof Blob
        )
    ) {
        txtStatus.textContent =
            "ERROR: The loaded AMMEF contains no original video.";

        txtStatus.style.color =
            "#FF3333";

        return;
    }

    lastOriginalVideoBlob =
        lastLoadedAMMEFVideoBlob;

    lastOriginalVideoName =
        lastLoadedAMMEFVideoName ||
        "ArNet_Video";

    lastOriginalVideoType =
        lastLoadedAMMEFVideoType ||
        lastLoadedAMMEFVideoBlob
            .type;

    if (
        typeof previewOriginalVideo ===
        "function"
    ) {
        previewOriginalVideo();
    }
}

// ======================================================
// Original media download helpers
// ======================================================

/**
 * Downloads a Blob using a temporary anchor.
 *
 * @param {Blob} blob
 * @param {string} fileName
 */
function downloadAMMEFPayload(
    blob,
    fileName
) {
    if (
        !(blob instanceof Blob)
    ) {
        throw new TypeError(
            "A Blob is required for downloading."
        );
    }

    const url =
        URL.createObjectURL(
            blob
        );

    const anchor =
        document.createElement(
            "a"
        );

    anchor.href =
        url;

    anchor.download =
        sanitizeDownloadName(
            fileName ||
            "ArNet_Payload.bin"
        );

    document.body.appendChild(
        anchor
    );

    anchor.click();
    anchor.remove();

    setTimeout(
        () => {
            URL.revokeObjectURL(
                url
            );
        },
        1000
    );
}

/**
 * Downloads the original photo from the loaded AMMEF.
 */
function downloadLoadedAMMEFPhoto() {
    if (
        !(
            lastLoadedAMMEFPhotoBlob
            instanceof Blob
        )
    ) {
        throw new Error(
            "The loaded AMMEF contains no original photo."
        );
    }

    downloadAMMEFPayload(
        lastLoadedAMMEFPhotoBlob,
        lastLoadedAMMEFPhotoName ||
        "ArNet_Photo.bin"
    );
}

/**
 * Downloads the original video from the loaded AMMEF.
 */
function downloadLoadedAMMEFVideo() {
    if (
        !(
            lastLoadedAMMEFVideoBlob
            instanceof Blob
        )
    ) {
        throw new Error(
            "The loaded AMMEF contains no original video."
        );
    }

    downloadAMMEFPayload(
        lastLoadedAMMEFVideoBlob,
        lastLoadedAMMEFVideoName ||
        "ArNet_Video.bin"
    );
}

// ======================================================
// Media-button refresh
// ======================================================

/**
 * Updates optional media buttons if they exist in the
 * dashboard.
 *
 * The function safely ignores buttons that have not yet
 * been added to index.html.
 */
function refreshMediaActionButtons() {
    const buttonStates = [
        {
            id:
                "btnPlayClean",

            enabled:
                lastLoadedAMMEFCleanBlob
                instanceof Blob
        },

        {
            id:
                "btnPlayRaw",

            enabled:
                lastLoadedAMMEFMonitorBlob
                instanceof Blob
        },

        {
            id:
                "btnPlayTelemetry",

            enabled:
                lastLoadedAMMEFTelemetryBlob
                instanceof Blob
        },

        {
            id:
                "btnPreviewPhoto",

            enabled:
                lastLoadedAMMEFPhotoBlob
                instanceof Blob
        },

        {
            id:
                "btnPreviewVideo",

            enabled:
                lastLoadedAMMEFVideoBlob
                instanceof Blob
        }
    ];

    for (
        const state of
        buttonStates
    ) {
        const button =
            document.getElementById(
                state.id
            );

        if (!button) {
            continue;
        }

        button.disabled =
            !state.enabled;

        button.style.opacity =
            state.enabled
                ? "1"
                : "0.5";

        button.style.cursor =
            state.enabled
                ? "pointer"
                : "not-allowed";
    }
}
