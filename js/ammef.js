// ======================================================
// ArNet Transceiver
// AMMEF 2.3 Container Reader and Writer
// ======================================================

const AMMEF_MAGIC = "AMMEF";

const AMMEF_LEGACY_VERSION = "1.0";
const AMMEF_DUAL_TRACK_VERSION = "2.0";
const AMMEF_THREE_TRACK_VERSION = "2.1";
const AMMEF_MEDIA_VERSION = "2.3";

const AMMEF_DUAL_TRACK_MARKER = 0x02;
const AMMEF_THREE_TRACK_MARKER = 0x03;
const AMMEF_MEDIA_MARKER = 0x04;

/*
 * AMMEF 2.3 layout
 *
 * Bytes 0–4:   "AMMEF"
 * Byte 5:      0x04
 *
 * Bytes 6–9:   metadata JSON length
 * Bytes 10–13: clean audio length
 * Bytes 14–17: general FM monitor length
 * Bytes 18–21: telemetry audio length
 * Bytes 22–25: video ABMTV monitor length
 * Bytes 26–29: photo ABMTV monitor length
 * Bytes 30–33: original compressed video length
 * Bytes 34–37: original compressed photo length
 *
 * Bytes 38+: metadata JSON
 *            clean WAV
 *            general monitor WAV
 *            telemetry WAV
 *            video-monitor WAV
 *            photo-monitor WAV
 *            original compressed video
 *            original compressed photo
 */

const AMMEF_MEDIA_HEADER_LENGTH = 38;

// ======================================================
// Basic helpers
// ======================================================

function hasAMMEFHeader(data) {
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

async function blobToBytes(blob) {
    if (!(blob instanceof Blob)) {
        return new Uint8Array(0);
    }

    return new Uint8Array(
        await blob.arrayBuffer()
    );
}

function createPayloadBlob(
    data,
    start,
    length,
    mimeType
) {
    if (!length) {
        return null;
    }

    const end = start + length;

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
        [data.slice(start, end)],
        {
            type:
                mimeType ||
                "application/octet-stream"
        }
    );
}

function sanitizeDownloadName(value) {
    return String(value || "")
        .trim()
        .replace(
            /[^A-Za-z0-9_.-]/g,
            "_"
        );
}

// ======================================================
// Metadata
// ======================================================

function createAMMEFMetadata(lengths) {
    return {
        format:
            AMMEF_MAGIC,

        version:
            AMMEF_MEDIA_VERSION,

        mode:
            comboMode.value,

        band:
            comboBand.value,

        bandwidth:
            comboBandwidth.value,

        virtualFrequency:
            Number(txtFrequency.value),

        frequencyUnit:
            "Vt",

        callsign:
            txtCallsign.value
                .trim()
                .toUpperCase(),

        created:
            new Date().toISOString(),

        tracks: {
            cleanAudio: {
                present:
                    lengths.clean > 0,

                byteLength:
                    lengths.clean,

                mimeType:
                    "audio/wav"
            },

            fmMonitor: {
                present:
                    lengths.monitor > 0,

                byteLength:
                    lengths.monitor,

                mimeType:
                    "audio/wav"
            },

            telemetry: {
                present:
                    lengths.telemetry > 0,

                byteLength:
                    lengths.telemetry,

                mimeType:
                    "audio/wav"
            },

            videoMonitor: {
                present:
                    lengths.videoMonitor > 0,

                byteLength:
                    lengths.videoMonitor,

                mimeType:
                    "audio/wav",

                metadata:
                    lastVideoMetadata || null
            },

            photoMonitor: {
                present:
                    lengths.photoMonitor > 0,

                byteLength:
                    lengths.photoMonitor,

                mimeType:
                    "audio/wav",

                metadata:
                    lastPhotoMetadata || null
            },

            originalVideo: {
                present:
                    lengths.video > 0,

                byteLength:
                    lengths.video,

                fileName:
                    lastOriginalVideoName || null,

                mimeType:
                    lastOriginalVideoType ||
                    lastOriginalVideoBlob?.type ||
                    "application/octet-stream"
            },

            originalPhoto: {
                present:
                    lengths.photo > 0,

                byteLength:
                    lengths.photo,

                fileName:
                    lastOriginalPhotoName || null,

                mimeType:
                    lastOriginalPhotoType ||
                    lastOriginalPhotoBlob?.type ||
                    "application/octet-stream"
            }
        }
    };
}

function applyAMMEFMetadata(metadata) {
    if (
        !metadata ||
        typeof metadata !== "object"
    ) {
        return;
    }

    if (
        ["AARM", "ABM", "ABMTV"].includes(
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

    if (metadata.band) {
        const bandOption =
            Array.from(
                comboBand.options
            ).find(
                option =>
                    option.value ===
                    metadata.band
            );

        if (bandOption) {
            comboBand.value =
                metadata.band;
        }
    }

    if (
        ["wide", "narrow"].includes(
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

    if (Number.isFinite(frequency)) {
        txtFrequency.value =
            String(frequency);
    }

    if (
        typeof metadata.callsign ===
            "string" &&
        metadata.callsign.trim()
    ) {
        txtCallsign.value =
            metadata.callsign
                .trim()
                .toUpperCase();
    }
}

// ======================================================
// AMMEF 2.3 creation
// ======================================================

async function createAMMEFBlob() {
    /*
     * Do not treat an ABMTV monitor waveform as clean
     * audio merely because it is lastProcessedAudioBlob.
     */
    const cleanBlob =
        lastCleanAudioBlob ||
        (
            comboMode.value !== "ABMTV"
                ? lastProcessedAudioBlob
                : null
        );

    let monitorBlob =
        lastModulatedAudioBlob ||
        null;

    const telemetryBlob =
        lastTelemetryAudioBlob ||
        null;

    const videoMonitorBlob =
        lastVideoMonitorAudioBlob ||
        null;

    const photoMonitorBlob =
        lastPhotoMonitorAudioBlob ||
        null;

    const videoBlob =
        lastOriginalVideoBlob ||
        null;

    const photoBlob =
        lastOriginalPhotoBlob ||
        null;

    /*
     * Avoid storing the same specialized monitor twice.
     */
    if (
        monitorBlob === videoMonitorBlob ||
        monitorBlob === photoMonitorBlob
    ) {
        monitorBlob = null;
    }

    const cleanBytes =
        await blobToBytes(cleanBlob);

    const monitorBytes =
        await blobToBytes(monitorBlob);

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
        await blobToBytes(videoBlob);

    const photoBytes =
        await blobToBytes(photoBlob);

    const totalPayloadLength =
        cleanBytes.length +
        monitorBytes.length +
        telemetryBytes.length +
        videoMonitorBytes.length +
        photoMonitorBytes.length +
        videoBytes.length +
        photoBytes.length;

    if (totalPayloadLength === 0) {
        throw new Error(
            "No media is available for AMMEF export."
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
            lengths
        );

    const metadataBytes =
        new TextEncoder().encode(
            JSON.stringify(metadata)
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

    // AMMEF magic
    combined[0] = 0x41;
    combined[1] = 0x4D;
    combined[2] = 0x4D;
    combined[3] = 0x45;
    combined[4] = 0x46;

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

    const appendBytes = bytes => {
        combined.set(
            bytes,
            offset
        );

        offset +=
            bytes.length;
    };

    appendBytes(metadataBytes);
    appendBytes(cleanBytes);
    appendBytes(monitorBytes);
    appendBytes(telemetryBytes);
    appendBytes(videoMonitorBytes);
    appendBytes(photoMonitorBytes);
    appendBytes(videoBytes);
    appendBytes(photoBytes);

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

        originalPhotoBlob:
            photoBlob
    };

    return new Blob(
        [combined],
        {
            type:
                "application/x-ammef"
        }
    );
}

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
            document.createElement("a");

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
            `ERROR: ${error.message}`;

        txtStatus.style.color =
            "#FF3333";
    }
}

// ======================================================
// AMMEF 2.3 parsing
// ======================================================

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
        new DataView(buffer);

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
        metadataLength < 2 ||
        metadataEnd > data.length
    ) {
        throw new Error(
            "AMMEF 2.3 metadata length is invalid."
        );
    }

    const metadata =
        JSON.parse(
            new TextDecoder().decode(
                data.slice(
                    metadataStart,
                    metadataEnd
                )
            )
        );

    offset =
        metadataEnd;

    const readPayload = (
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
            "audio/wav"
        );

    const monitorAudioBlob =
        readPayload(
            monitorLength,
            "audio/wav"
        );

    const telemetryAudioBlob =
        readPayload(
            telemetryLength,
            "audio/wav"
        );

    const videoMonitorAudioBlob =
        readPayload(
            videoMonitorLength,
            "audio/wav"
        );

    const photoMonitorAudioBlob =
        readPayload(
            photoMonitorLength,
            "audio/wav"
        );

    const videoMetadata =
        metadata.tracks
            ?.originalVideo ||
        {};

    const photoMetadata =
        metadata.tracks
            ?.originalPhoto ||
        {};

    const originalVideoBlob =
        readPayload(
            videoLength,
            videoMetadata.mimeType ||
            "application/octet-stream"
        );

    const originalPhotoBlob =
        readPayload(
            photoLength,
            photoMetadata.mimeType ||
            "application/octet-stream"
        );

    if (offset !== data.length) {
        console.warn(
            "AMMEF contains trailing bytes:",
            data.length - offset
        );
    }

    return {
        version:
            metadata.version ||
            AMMEF_MEDIA_VERSION,

        metadata,

        cleanAudioBlob,
        monitorAudioBlob,
        telemetryAudioBlob,

        videoMonitorAudioBlob,
        photoMonitorAudioBlob,

        originalVideoBlob,
        originalPhotoBlob,

        originalVideoName:
            videoMetadata.fileName ||
            null,

        originalVideoType:
            videoMetadata.mimeType ||
            originalVideoBlob?.type ||
            null,

        originalPhotoName:
            photoMetadata.fileName ||
            null,

        originalPhotoType:
            photoMetadata.mimeType ||
            originalPhotoBlob?.type ||
            null
    };
}

// ======================================================
// Older format parsing
// ======================================================

function parseLegacyAMMEF(
    buffer,
    data
) {
    if (data.length < 9) {
        throw new Error(
            "Legacy AMMEF header is incomplete."
        );
    }

    const view =
        new DataView(buffer);

    const metadataLength =
        view.getUint32(
            5,
            true
        );

    const metadataStart = 9;

    const metadataEnd =
        metadataStart +
        metadataLength;

    if (
        metadataLength < 2 ||
        metadataEnd > data.length
    ) {
        throw new Error(
            "Legacy AMMEF metadata is invalid."
        );
    }

    const metadata =
        JSON.parse(
            new TextDecoder().decode(
                data.slice(
                    metadataStart,
                    metadataEnd
                )
            )
        );

    const audioLength =
        data.length -
        metadataEnd;

    if (audioLength <= 0) {
        throw new Error(
            "Legacy AMMEF contains no audio."
        );
    }

    return {
        version:
            metadata.version ||
            AMMEF_LEGACY_VERSION,

        metadata,

        cleanAudioBlob:
            createPayloadBlob(
                data,
                metadataEnd,
                audioLength,
                "audio/wav"
            ),

        monitorAudioBlob: null,
        telemetryAudioBlob: null,

        videoMonitorAudioBlob: null,
        photoMonitorAudioBlob: null,

        originalVideoBlob: null,
        originalPhotoBlob: null,

        originalVideoName: null,
        originalVideoType: null,

        originalPhotoName: null,
        originalPhotoType: null
    };
}

function parseDualTrackAMMEF(
    buffer,
    data
) {
    const headerLength = 18;

    if (data.length < headerLength) {
        throw new Error(
            "AMMEF 2.0 header is incomplete."
        );
    }

    const view =
        new DataView(buffer);

    const metadataLength =
        view.getUint32(6, true);

    const cleanLength =
        view.getUint32(10, true);

    const monitorLength =
        view.getUint32(14, true);

    const metadataStart =
        headerLength;

    const metadataEnd =
        metadataStart +
        metadataLength;

    const cleanStart =
        metadataEnd;

    const monitorStart =
        cleanStart +
        cleanLength;

    const finalEnd =
        monitorStart +
        monitorLength;

    if (finalEnd > data.length) {
        throw new Error(
            "AMMEF 2.0 payload lengths are invalid."
        );
    }

    const metadata =
        JSON.parse(
            new TextDecoder().decode(
                data.slice(
                    metadataStart,
                    metadataEnd
                )
            )
        );

    return {
        version:
            metadata.version ||
            AMMEF_DUAL_TRACK_VERSION,

        metadata,

        cleanAudioBlob:
            createPayloadBlob(
                data,
                cleanStart,
                cleanLength,
                "audio/wav"
            ),

        monitorAudioBlob:
            createPayloadBlob(
                data,
                monitorStart,
                monitorLength,
                "audio/wav"
            ),

        telemetryAudioBlob: null,

        videoMonitorAudioBlob: null,
        photoMonitorAudioBlob: null,

        originalVideoBlob: null,
        originalPhotoBlob: null,

        originalVideoName: null,
        originalVideoType: null,

        originalPhotoName: null,
        originalPhotoType: null
    };
}

function parseThreeTrackAMMEF(
    buffer,
    data
) {
    const headerLength = 22;

    if (data.length < headerLength) {
        throw new Error(
            "AMMEF 2.1 header is incomplete."
        );
    }

    const view =
        new DataView(buffer);

    const metadataLength =
        view.getUint32(6, true);

    const cleanLength =
        view.getUint32(10, true);

    const monitorLength =
        view.getUint32(14, true);

    const telemetryLength =
        view.getUint32(18, true);

    let offset =
        headerLength;

    const metadataEnd =
        offset +
        metadataLength;

    if (metadataEnd > data.length) {
        throw new Error(
            "AMMEF 2.1 metadata length is invalid."
        );
    }

    const metadata =
        JSON.parse(
            new TextDecoder().decode(
                data.slice(
                    offset,
                    metadataEnd
                )
            )
        );

    offset =
        metadataEnd;

    const cleanAudioBlob =
        createPayloadBlob(
            data,
            offset,
            cleanLength,
            "audio/wav"
        );

    offset += cleanLength;

    const monitorAudioBlob =
        createPayloadBlob(
            data,
            offset,
            monitorLength,
            "audio/wav"
        );

    offset += monitorLength;

    const telemetryAudioBlob =
        createPayloadBlob(
            data,
            offset,
            telemetryLength,
            "audio/wav"
        );

    offset += telemetryLength;

    if (offset > data.length) {
        throw new Error(
            "AMMEF 2.1 payload lengths are invalid."
        );
    }

    return {
        version:
            metadata.version ||
            AMMEF_THREE_TRACK_VERSION,

        metadata,

        cleanAudioBlob,
        monitorAudioBlob,
        telemetryAudioBlob,

        videoMonitorAudioBlob: null,
        photoMonitorAudioBlob: null,

        originalVideoBlob: null,
        originalPhotoBlob: null,

        originalVideoName: null,
        originalVideoType: null,

        originalPhotoName: null,
        originalPhotoType: null
    };
}

// ======================================================
// Reading and loading
// ======================================================

async function readAMMEFFile(file) {
    if (!(file instanceof Blob)) {
        throw new TypeError(
            "readAMMEFFile requires a File or Blob."
        );
    }

    const buffer =
        await file.arrayBuffer();

    const data =
        new Uint8Array(buffer);

    if (!hasAMMEFHeader(data)) {
        throw new Error(
            "Invalid AMMEF file header."
        );
    }

    let parsed;

    if (
        data[5] ===
        AMMEF_MEDIA_MARKER
    ) {
        parsed =
            parseMediaAMMEF(
                buffer,
                data
            );
    }
    else if (
        data[5] ===
        AMMEF_THREE_TRACK_MARKER
    ) {
        try {
            parsed =
                parseThreeTrackAMMEF(
                    buffer,
                    data
                );
        }
        catch (error) {
            parsed =
                parseLegacyAMMEF(
                    buffer,
                    data
                );
        }
    }
    else if (
        data[5] ===
        AMMEF_DUAL_TRACK_MARKER
    ) {
        try {
            parsed =
                parseDualTrackAMMEF(
                    buffer,
                    data
                );
        }
        catch (error) {
            parsed =
                parseLegacyAMMEF(
                    buffer,
                    data
                );
        }
    }
    else {
        parsed =
            parseLegacyAMMEF(
                buffer,
                data
            );
    }

    lastLoadedAMMEFMetadata =
        parsed.metadata;

    lastLoadedAMMEFCleanBlob =
        parsed.cleanAudioBlob;

    lastLoadedAMMEFMonitorBlob =
        parsed.monitorAudioBlob;

    lastLoadedAMMEFTelemetryBlob =
        parsed.telemetryAudioBlob;

    lastLoadedAMMEFVideoMonitorBlob =
        parsed.videoMonitorAudioBlob;

    lastLoadedAMMEFPhotoMonitorBlob =
        parsed.photoMonitorAudioBlob;

    lastLoadedAMMEFVideoBlob =
        parsed.originalVideoBlob;

    lastLoadedAMMEFVideoName =
        parsed.originalVideoName;

    lastLoadedAMMEFVideoType =
        parsed.originalVideoType;

    lastLoadedAMMEFPhotoBlob =
        parsed.originalPhotoBlob;

    lastLoadedAMMEFPhotoName =
        parsed.originalPhotoName;

    lastLoadedAMMEFPhotoType =
        parsed.originalPhotoType;

    lastAMMEFData =
        parsed;

    applyAMMEFMetadata(
        parsed.metadata
    );

    /*
     * Restore current media variables so the normal
     * preview functions can also use loaded AMMEF media.
     */
    lastOriginalVideoBlob =
        parsed.originalVideoBlob;

    lastOriginalVideoName =
        parsed.originalVideoName;

    lastOriginalVideoType =
        parsed.originalVideoType;

    lastOriginalPhotoBlob =
        parsed.originalPhotoBlob;

    lastOriginalPhotoName =
        parsed.originalPhotoName;

    lastOriginalPhotoType =
        parsed.originalPhotoType;

    lastVideoMonitorAudioBlob =
        parsed.videoMonitorAudioBlob;

    lastPhotoMonitorAudioBlob =
        parsed.photoMonitorAudioBlob;

    return parsed;
}

async function loadAMMEF(file) {
    txtTxState.textContent =
        "DEC";

    boxTxState.style.background =
        "#004466";

    txtStatus.textContent =
        "STATUS: Reading AMMEF container...";

    txtStatus.style.color =
        "yellow";

    try {
        const parsed =
            await readAMMEFFile(file);

        const playbackTrack =
            parsed.cleanAudioBlob ||
            parsed.monitorAudioBlob ||
            parsed.photoMonitorAudioBlob ||
            parsed.videoMonitorAudioBlob ||
            parsed.telemetryAudioBlob;

        if (playbackTrack) {
            const decoded =
                await decodeAudioBlob(
                    playbackTrack
                );

            lastAudioPcmArray =
                decoded.pcmSamples;

            await playAudioBlob(
                playbackTrack
            );
        }

        lastCleanAudioBlob =
            parsed.cleanAudioBlob;

        lastModulatedAudioBlob =
            parsed.monitorAudioBlob;

        lastTelemetryAudioBlob =
            parsed.telemetryAudioBlob;

        lastProcessedAudioBlob =
            parsed.cleanAudioBlob ||
            parsed.monitorAudioBlob ||
            parsed.photoMonitorAudioBlob ||
            parsed.videoMonitorAudioBlob ||
            null;

        if (
            typeof enableSaveButton ===
            "function"
        ) {
            enableSaveButton();
        }

        txtStatus.textContent =
            `STATUS: Loaded AMMEF ${parsed.version} — ` +
            `${parsed.metadata.mode || "Unknown mode"}, ` +
            `${parsed.metadata.virtualFrequency ?? "----"} Vt.`;

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
            `ERROR: ${error.message}`;

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

// ======================================================
// Playback helpers
// ======================================================

async function playAMMEFTrack(
    blob,
    stateText,
    stateColor,
    statusText,
    statusColor
) {
    if (!(blob instanceof Blob)) {
        txtStatus.textContent =
            "ERROR: This AMMEF does not contain that track.";

        txtStatus.style.color =
            "#FF3333";

        return;
    }

    const decoded =
        await decodeAudioBlob(blob);

    lastAudioPcmArray =
        decoded.pcmSamples;

    txtTxState.textContent =
        stateText;

    boxTxState.style.background =
        stateColor;

    await playAudioBlob(blob);

    txtStatus.textContent =
        statusText;

    txtStatus.style.color =
        statusColor;
}

async function playLoadedAMMEFCleanTrack() {
    return playAMMEFTrack(
        lastLoadedAMMEFCleanBlob,
        "CLN",
        "#004422",
        "STATUS: Playing clean AMMEF audio.",
        "#00FF7F"
    );
}

async function playLoadedAMMEFRawTrack() {
    return playAMMEFTrack(
        lastLoadedAMMEFMonitorBlob,
        "RAW",
        "#665500",
        "STATUS: Playing raw FM monitor waveform.",
        "#FFD700"
    );
}

async function playLoadedAMMEFTelemetryTrack() {
    return playAMMEFTrack(
        lastLoadedAMMEFTelemetryBlob,
        "TEL",
        "#663366",
        "STATUS: Playing AMMEF telemetry signal.",
        "#FF77FF"
    );
}

async function playLoadedAMMEFVideoMonitorTrack() {
    return playAMMEFTrack(
        lastLoadedAMMEFVideoMonitorBlob,
        "VID",
        "#550055",
        "STATUS: Playing encoded ABMTV video signal.",
        "#FF55FF"
    );
}

async function playLoadedAMMEFPhotoMonitorTrack() {
    return playAMMEFTrack(
        lastLoadedAMMEFPhotoMonitorBlob,
        "PIC",
        "#550055",
        "STATUS: Playing encoded ABMTV still-frame signal.",
        "#FF55FF"
    );
}

// ======================================================
// Original-media preview helpers
// ======================================================

function previewLoadedAMMEFVideo() {
    if (
        !(lastLoadedAMMEFVideoBlob instanceof Blob)
    ) {
        txtStatus.textContent =
            "ERROR: This AMMEF contains no compressed video.";

        txtStatus.style.color =
            "#FF3333";

        return;
    }

    lastOriginalVideoBlob =
        lastLoadedAMMEFVideoBlob;

    lastOriginalVideoName =
        lastLoadedAMMEFVideoName ||
        "AMMEF_Video";

    lastOriginalVideoType =
        lastLoadedAMMEFVideoType ||
        lastLoadedAMMEFVideoBlob.type;

    previewOriginalVideo();
}

function previewLoadedAMMEFPhoto() {
    if (
        !(lastLoadedAMMEFPhotoBlob instanceof Blob)
    ) {
        txtStatus.textContent =
            "ERROR: This AMMEF contains no compressed photo.";

        txtStatus.style.color =
            "#FF3333";

        return;
    }

    lastOriginalPhotoBlob =
        lastLoadedAMMEFPhotoBlob;

    lastOriginalPhotoName =
        lastLoadedAMMEFPhotoName ||
        "AMMEF_Photo";

    lastOriginalPhotoType =
        lastLoadedAMMEFPhotoType ||
        lastLoadedAMMEFPhotoBlob.type;

    previewOriginalPhoto();
}
