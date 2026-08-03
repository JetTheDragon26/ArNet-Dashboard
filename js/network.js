// ======================================================
// ArNet Transceiver
// WebSocket Networking and AMMEF Transport
// ======================================================

// ======================================================
// Status helpers
// ======================================================

function setNetworkStatus(
    message,
    color = "#AAAAAA"
) {
    console.log(
        "[ArNet Network]",
        message
    );

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

    if (txtStatus) {
        txtStatus.textContent =
            message.startsWith("STATUS:") ||
            message.startsWith("ERROR:")
                ? message
                : `STATUS: ${message}`;

        txtStatus.style.color =
            color;
    }
}

function getNetworkCallsign() {
    const value =
        txtCallsign.value
            .trim()
            .toUpperCase();

    return value || "ANON";
}

function getNetworkFrequency() {
    const value =
        Number.parseInt(
            txtFrequency.value,
            10
        );

    return Number.isFinite(value)
        ? value
        : 4550;
}

// ======================================================
// Registration
// ======================================================

function updateNetworkRegistration() {
    if (
        !networkConnected ||
        !networkSocket ||
        networkSocket.readyState !==
            WebSocket.OPEN
    ) {
        return;
    }

    sendNetworkMessage({
        type:
            "register",

        callsign:
            getNetworkCallsign(),

        frequency:
            getNetworkFrequency(),

        mode:
            comboMode.value,

        band:
            comboBand.value,

        bandwidth:
            comboBandwidth.value
    });

    setNetworkStatus(
        `Registered as ${getNetworkCallsign()} ` +
        `on ${getNetworkFrequency()} Vt.`,
        "#00FF7F"
    );
}

// ======================================================
// Connection handling
// ======================================================

function connectArNetNetwork() {
    if (
        networkSocket &&
        (
            networkSocket.readyState ===
                WebSocket.OPEN ||
            networkSocket.readyState ===
                WebSocket.CONNECTING
        )
    ) {
        return;
    }

    setNetworkStatus(
        "Connecting to ArNet relay...",
        "#FFD700"
    );

    try {
        networkSocket =
            new WebSocket(
                networkServerUrl
            );
    }
    catch (error) {
        console.error(
            "Could not create WebSocket:",
            error
        );

        setNetworkStatus(
            "Could not open the ArNet relay connection.",
            "#FF3333"
        );

        return;
    }

    networkSocket.binaryType =
        "arraybuffer";

    networkSocket.addEventListener(
        "open",
        () => {
            networkConnected =
                true;

            networkCurrentFrequency =
                getNetworkFrequency();

            sendNetworkMessage({
                type:
                    "register",

                callsign:
                    getNetworkCallsign(),

                frequency:
                    networkCurrentFrequency,

                mode:
                    comboMode.value,

                band:
                    comboBand.value,

                bandwidth:
                    comboBandwidth.value
            });

            setNetworkStatus(
                `Connected as ${getNetworkCallsign()} ` +
                `on ${networkCurrentFrequency} Vt.`,
                "#00FF7F"
            );
        }
    );

    networkSocket.addEventListener(
        "message",
        handleNetworkMessage
    );

    networkSocket.addEventListener(
        "close",
        event => {
            networkConnected =
                false;

            networkBusy =
                false;

            networkSocket =
                null;

            setNetworkStatus(
                event.code === 1012
                    ? "ArNet relay is restarting."
                    : "Disconnected from ArNet relay.",
                "#FFAA00"
            );
        }
    );

    networkSocket.addEventListener(
        "error",
        error => {
            console.error(
                "WebSocket error:",
                error
            );

            setNetworkStatus(
                `Network connection failed: ${networkServerUrl}`,
                "#FF3333"
            );
        }
    );
}

function disconnectArNetNetwork() {
    if (networkSocket) {
        networkSocket.close(
            1000,
            "Dashboard disconnected"
        );
    }

    networkSocket =
        null;

    networkConnected =
        false;

    networkBusy =
        false;
}

function sendNetworkMessage(
    message
) {
    if (
        !networkSocket ||
        networkSocket.readyState !==
            WebSocket.OPEN
    ) {
        return false;
    }

    networkSocket.send(
        JSON.stringify(
            message
        )
    );

    return true;
}

// ======================================================
// Tuning
// ======================================================

function tuneNetworkFrequency(
    frequency
) {
    const numericFrequency =
        Number.parseInt(
            frequency,
            10
        );

    if (
        !Number.isFinite(
            numericFrequency
        )
    ) {
        return;
    }

    networkCurrentFrequency =
        numericFrequency;

    if (networkConnected) {
        sendNetworkMessage({
            type:
                "tune",

            frequency:
                numericFrequency,

            mode:
                comboMode.value,

            band:
                comboBand.value,

            bandwidth:
                comboBandwidth.value
        });
    }
}

// ======================================================
// Base64 helpers
// ======================================================

function bytesToBase64(
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

function base64ToBytes(
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

// ======================================================
// Transmission duration
// ======================================================

async function getAudioBlobDurationMs(
    blob
) {
    if (
        !(blob instanceof Blob)
    ) {
        return 0;
    }

    initAudioContext();

    if (
        audioCtx &&
        audioCtx.state ===
            "suspended"
    ) {
        await audioCtx.resume();
    }

    const buffer =
        await blob.arrayBuffer();

    const decoded =
        await audioCtx.decodeAudioData(
            buffer.slice(0)
        );

    return Math.max(
        0,
        Math.round(
            decoded.duration *
            1000
        )
    );
}

async function getCurrentTransmissionDurationMs(
    transmissionKind
) {
    let audioBlob =
        null;

    if (
        transmissionKind ===
            "video"
    ) {
        audioBlob =
            lastVideoMonitorAudioBlob;
    }
    else if (
        transmissionKind ===
            "photo"
    ) {
        audioBlob =
            lastPhotoMonitorAudioBlob;
    }
    else {
        audioBlob =
            lastCleanAudioBlob ||
            lastModulatedAudioBlob ||
            lastProcessedAudioBlob;
    }

    try {
        const duration =
            await getAudioBlobDurationMs(
                audioBlob
            );

        return duration > 0
            ? duration
            : 30000;
    }
    catch (error) {
        console.warn(
            "Could not determine transmission duration:",
            error
        );

        return 30000;
    }
}

// ======================================================
// AMMEF transmission
// ======================================================

async function sendCurrentAMMEFToNetwork(
    transmissionKind = "audio",
    extraData = {}
) {
    if (
        !networkSocket ||
        networkSocket.readyState !==
            WebSocket.OPEN
    ) {
        throw new Error(
            "ArNet is not connected."
        );
    }

    const ammefBlob =
        await createAMMEFBlob({
            transmissionKind
        });

    const bytes =
        new Uint8Array(
            await ammefBlob.arrayBuffer()
        );

    const durationMs =
        await getCurrentTransmissionDurationMs(
            transmissionKind
        );

    const direct =
        networkTargetMode ===
            "direct" &&
        Boolean(
            networkDirectTarget
        );

    const morseText =
        typeof extraData.morseText ===
            "string"
            ? extraData.morseText
                .trim()
                .slice(
                    0,
                    120
                )
            : null;

    const sent =
        sendNetworkMessage({
            type:
                direct
                    ? "direct-ammef"
                    : "channel-ammef",

            from:
                getNetworkCallsign(),

            to:
                direct
                    ? networkDirectTarget
                    : null,

            frequency:
                getNetworkFrequency(),

            mode:
                comboMode.value,

            band:
                comboBand.value,

            bandwidth:
                comboBandwidth.value,

            transmissionKind,

            morseText,

            durationMs,

            mimeType:
                "application/x-ammef",

            data:
                bytesToBase64(
                    bytes
                ),

            timestamp:
                new Date()
                    .toISOString()
        });

    if (!sent) {
        throw new Error(
            "The relay connection closed before transmission."
        );
    }

    setNetworkStatus(
        direct
            ? (
                `Sent ${transmissionKind} ` +
                `to ${networkDirectTarget}.`
            )
            : (
                `Sent ${transmissionKind} on ` +
                `${getNetworkFrequency()} Vt.`
            ),
        "#00FF7F"
    );
}

// ======================================================
// Legacy audio-only transmission
// ======================================================

async function sendAudioBlobToNetwork(
    audioBlob,
    options = {}
) {
    if (
        !(audioBlob instanceof Blob)
    ) {
        throw new TypeError(
            "sendAudioBlobToNetwork requires an audio Blob."
        );
    }

    if (
        !networkSocket ||
        networkSocket.readyState !==
            WebSocket.OPEN
    ) {
        throw new Error(
            "ArNet is not connected."
        );
    }

    const bytes =
        new Uint8Array(
            await audioBlob.arrayBuffer()
        );

    const durationMs =
        await getAudioBlobDurationMs(
            audioBlob
        ).catch(
            () => 30000
        );

    const sent =
        sendNetworkMessage({
            type:
                options.directTarget
                    ? "direct-audio"
                    : "channel-audio",

            from:
                getNetworkCallsign(),

            to:
                options.directTarget ||
                null,

            frequency:
                getNetworkFrequency(),

            mode:
                comboMode.value,

            band:
                comboBand.value,

            bandwidth:
                comboBandwidth.value,

            durationMs,

            mimeType:
                audioBlob.type ||
                "audio/wav",

            audio:
                bytesToBase64(
                    bytes
                ),

            timestamp:
                new Date()
                    .toISOString()
        });

    if (!sent) {
        throw new Error(
            "ArNet is not connected."
        );
    }
}

// ======================================================
// Incoming transmission filter
// ======================================================

function shouldReceiveNetworkTransmission(
    message
) {
    const incomingFrequency =
        Number.parseInt(
            message.frequency,
            10
        );

    const localFrequency =
        getNetworkFrequency();

    if (
        !Number.isFinite(
            incomingFrequency
        ) ||
        incomingFrequency !==
            localFrequency
    ) {
        console.log(
            `[ArNet] Ignored transmission from ` +
            `${message.from || "UNKNOWN"}: ` +
            `${message.frequency} Vt does not match ` +
            `${localFrequency} Vt.`
        );

        return false;
    }

    if (
        message.type ===
            "direct-ammef" ||
        message.type ===
            "direct-audio"
    ) {
        const destination =
            String(
                message.to ||
                ""
            )
                .trim()
                .toUpperCase();

        if (
            destination &&
            destination !==
                getNetworkCallsign()
        ) {
            console.log(
                `[ArNet] Ignored direct transmission ` +
                `addressed to ${destination}.`
            );

            return false;
        }
    }

    const incomingMode =
        String(
            message.mode ||
            ""
        )
            .trim()
            .toUpperCase();

    const localMode =
        String(
            comboMode.value ||
            ""
        )
            .trim()
            .toUpperCase();

    if (
        incomingMode &&
        incomingMode !==
            localMode
    ) {
        console.log(
            `[ArNet] Ignored ${incomingMode} transmission; ` +
            `receiver is in ${localMode}.`
        );

        return false;
    }

    const incomingBand =
        String(
            message.band ||
            ""
        ).trim();

    const localBand =
        String(
            comboBand.value ||
            ""
        ).trim();

    if (
        incomingBand &&
        incomingBand !==
            localBand
    ) {
        console.log(
            `[ArNet] Ignored transmission on ${incomingBand}; ` +
            `receiver is on ${localBand}.`
        );

        return false;
    }

    const incomingBandwidth =
        String(
            message.bandwidth ||
            ""
        )
            .trim()
            .toLowerCase();

    const localBandwidth =
        String(
            comboBandwidth.value ||
            ""
        )
            .trim()
            .toLowerCase();

    if (
        incomingBandwidth &&
        incomingBandwidth !==
            localBandwidth
    ) {
        console.log(
            `[ArNet] Ignored ${incomingBandwidth} transmission; ` +
            `receiver uses ${localBandwidth}.`
        );

        return false;
    }

    return true;
}

// ======================================================
// Incoming message handling
// ======================================================

async function handleNetworkMessage(
    event
) {
    if (
        typeof event.data !==
            "string"
    ) {
        return;
    }

    let message;

    try {
        message =
            JSON.parse(
                event.data
            );
    }
    catch (error) {
        console.warn(
            "Invalid network message:",
            event.data,
            error
        );

        return;
    }

    switch (
        message.type
    ) {
        case "welcome":
            networkStationId =
                message.stationId ||
                networkStationId;

            break;

        case "registered":
            networkStationId =
                message.stationId;

            networkCurrentFrequency =
                Number.parseInt(
                    message.frequency,
                    10
                ) ||
                getNetworkFrequency();

            setNetworkStatus(
                `Registered as ${message.callsign} ` +
                `on ${message.frequency} Vt.`,
                "#00FF7F"
            );

            break;

        case "tuned":
            networkCurrentFrequency =
                Number.parseInt(
                    message.frequency,
                    10
                ) ||
                networkCurrentFrequency;

            setNetworkStatus(
                `Tuned to ${message.frequency} Vt.`,
                "#00FFFF"
            );

            break;

        case "listener-count":
            networkListenerCount =
                message.count ||
                0;

            setNetworkStatus(
                `${networkListenerCount} station(s) ` +
                `listening on ${message.frequency} Vt.`,
                "#00FFFF"
            );

            break;

        case "busy":
            networkBusy =
                Boolean(
                    message.busy
                );

            break;

        case "channel-audio":
        case "direct-audio":
            if (
                shouldReceiveNetworkTransmission(
                    message
                )
            ) {
                await receiveNetworkAudio(
                    message
                );
            }

            break;

        case "channel-ammef":
        case "direct-ammef":
            if (
                shouldReceiveNetworkTransmission(
                    message
                )
            ) {
                await receiveNetworkAMMEF(
                    message
                );
            }

            break;

        case "transmission-result":
            setNetworkStatus(
                `Transmission delivered to ` +
                `${message.recipients || 0} station(s).`,
                "#00FF7F"
            );

            break;

        case "server-shutdown":
            setNetworkStatus(
                message.message ||
                "The ArNet relay is restarting.",
                "#FFAA00"
            );

            break;

        case "error":
            setNetworkStatus(
                `Network error: ${message.message}`,
                "#FF3333"
            );

            break;

        case "pong":
            break;

        default:
            console.warn(
                "Unknown network message:",
                message
            );
    }
}

// ======================================================
// Legacy audio reception
// ======================================================

async function receiveNetworkAudio(
    message
) {
    if (!message.audio) {
        return;
    }

    const blob =
        new Blob(
            [
                base64ToBytes(
                    message.audio
                )
            ],
            {
                type:
                    message.mimeType ||
                    "audio/wav"
            }
        );

    const playbackOptions = {
        startOffsetSeconds:
            Math.max(
                0,
                Number(
                    message.replayOffsetMs
                ) || 0
            ) /
            1000
    };

    txtTxState.textContent =
        "RX";

    boxTxState.style.background =
        "#004466";

    setNetworkStatus(
        `Receiving ${message.from || "UNKNOWN"} ` +
        `on ${message.frequency} Vt.`,
        "#00FFFF"
    );

    try {
        const decoded =
            await decodeAudioBlob(
                blob
            );

        lastAudioPcmArray =
            decoded.pcmSamples;

        await playAudioBlob(
            blob,
            playbackOptions
        );

        setNetworkStatus(
            `Finished receiving ${message.from || "UNKNOWN"}.`,
            "#00FF7F"
        );
    }
    catch (error) {
        console.error(
            "Incoming audio playback failed:",
            error
        );

        setNetworkStatus(
            "Incoming audio could not be played.",
            "#FF3333"
        );
    }
    finally {
        if (
            typeof returnToReceiveMode ===
                "function"
        ) {
            returnToReceiveMode();
        }
    }
}

// ======================================================
// AMMEF reception
// ======================================================

async function receiveNetworkAMMEF(
    message
) {
    if (!message.data) {
        return;
    }

    const ammefBlob =
        new Blob(
            [
                base64ToBytes(
                    message.data
                )
            ],
            {
                type:
                    "application/x-ammef"
            }
        );

    txtTxState.textContent =
        "NET";

    boxTxState.style.background =
        "#004466";

    setNetworkStatus(
        `Receiving ${message.transmissionKind || "AMMEF"} ` +
        `from ${message.from || "UNKNOWN"} ` +
        `on ${message.frequency} Vt.`,
        "#00FFFF"
    );

    try {
        const parsed =
            await readAMMEFFile(
                ammefBlob
            );

        /*
         * ArNet-generated Morse and IDENT packets include
         * their original text for reliable decoding.
         */
        if (
            (
                message.transmissionKind ===
                    "morse" ||
                message.transmissionKind ===
                    "ident"
            ) &&
            typeof message.morseText ===
                "string" &&
            message.morseText.trim() &&
            typeof displayDecodedMorse ===
                "function"
        ) {
            displayDecodedMorse(
                message.morseText,
                {
                    sender:
                        message.from ||
                        "UNKNOWN",

                    frequency:
                        message.frequency,

                    kind:
                        message.transmissionKind ===
                            "ident"
                            ? "IDENT"
                            : "MORSE"
                }
            );
        }

        if (
            typeof decodeIncomingAMMEFPacket ===
                "function"
        ) {
            await decodeIncomingAMMEFPacket(
                parsed,
                message
            );
        }
        else {
            const fallbackBlob =
                parsed.cleanAudioBlob ||
                parsed.monitorAudioBlob ||
                parsed.telemetryAudioBlob ||
                parsed.photoMonitorAudioBlob ||
                parsed.videoMonitorAudioBlob;

            if (fallbackBlob) {
                await playAudioBlob(
                    fallbackBlob,
                    {
                        startOffsetSeconds:
                            Math.max(
                                0,
                                Number(
                                    message.replayOffsetMs
                                ) || 0
                            ) /
                            1000
                    }
                );
            }
        }

        if (
            typeof refreshMediaActionButtons ===
                "function"
        ) {
            refreshMediaActionButtons();
        }
    }
    catch (error) {
        console.error(
            "Network AMMEF decode failed:",
            error
        );

        setNetworkStatus(
            "Received AMMEF could not be decoded.",
            "#FF3333"
        );
    }
    finally {
        if (
            typeof returnToReceiveMode ===
                "function"
        ) {
            returnToReceiveMode();
        }
    }
}

// ======================================================
// Imported audio helper
// ======================================================

async function encodeAudioBlobForTransmission(
    inputBlob
) {
    if (
        !(inputBlob instanceof Blob)
    ) {
        throw new TypeError(
            "An audio Blob is required."
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
        await inputBlob.arrayBuffer();

    const decoded =
        await audioCtx.decodeAudioData(
            sourceBuffer.slice(0)
        );

    if (
        decoded.numberOfChannels <
            1
    ) {
        throw new Error(
            "The imported audio contains no usable channel."
        );
    }

    const rawChannel =
        decoded.getChannelData(
            0
        );

    const cleanPcm =
        floatChannelToPcm16(
            rawChannel
        );

    const monitorPcm =
        encodeVoiceToFmMonitor(
            rawChannel
        );

    lastCleanAudioBlob =
        createWavBuffer(
            cleanPcm,
            decoded.sampleRate
        );

    lastModulatedAudioBlob =
        createWavBuffer(
            monitorPcm,
            ARNET_SAMPLE_RATE
        );

    lastProcessedAudioBlob =
        lastCleanAudioBlob;

    lastAudioPcmArray =
        monitorPcm;

    return {
        cleanBlob:
            lastCleanAudioBlob,

        monitorBlob:
            lastModulatedAudioBlob,

        duration:
            decoded.duration,

        sampleRate:
            decoded.sampleRate
    };
}

// ======================================================
// Existing AMMEF file transmission
// ======================================================

/**
 * Sends an existing AMMEF file without rebuilding it.
 *
 * @param {File|Blob} file
 */
async function transmitExistingAMMEFFile(
    file
) {
    if (
        !(file instanceof Blob)
    ) {
        throw new TypeError(
            "An AMMEF file is required."
        );
    }

    if (
        !networkConnected ||
        !networkSocket ||
        networkSocket.readyState !==
            WebSocket.OPEN
    ) {
        throw new Error(
            "ArNet is not connected."
        );
    }

    txtTxState.textContent =
        "TX-FILE";

    boxTxState.style.background =
        "#884400";

    setNetworkStatus(
        "Reading AMMEF transmission file...",
        "#FFD700"
    );

    /*
     * Validate the AMMEF and read its metadata.
     * This does not play or decode the audio.
     */
    const parsed =
        await readAMMEFFile(
            file
        );

    const metadata =
        parsed.metadata ||
        {};

    const bytes =
        new Uint8Array(
            await file.arrayBuffer()
        );

    if (
        bytes.length === 0
    ) {
        throw new Error(
            "The selected AMMEF file is empty."
        );
    }

    const transmissionKind =
        String(
            metadata.transmissionKind ||
            "audio"
        )
            .trim()
            .toLowerCase();

    const direct =
        networkTargetMode ===
            "direct" &&
        Boolean(
            networkDirectTarget
        );

    const durationMs =
        await getImportedAMMEFDurationMs(
            parsed
        );

    const sent =
        sendNetworkMessage({
            type:
                direct
                    ? "direct-ammef"
                    : "channel-ammef",

            from:
                getNetworkCallsign(),

            to:
                direct
                    ? networkDirectTarget
                    : null,

            /*
             * Route it on the frequency currently selected
             * by the transmitting operator.
             */
            frequency:
                getNetworkFrequency(),

            mode:
                comboMode.value,

            band:
                comboBand.value,

            bandwidth:
                comboBandwidth.value,

            transmissionKind,

            morseText:
                typeof metadata.morseText ===
                    "string"
                    ? metadata.morseText
                    : null,

            durationMs,

            mimeType:
                "application/x-ammef",

            fileName:
                file.name ||
                "transmission.ammef",

            data:
                bytesToBase64(
                    bytes
                ),

            timestamp:
                new Date()
                    .toISOString()
        });

    if (!sent) {
        throw new Error(
            "The relay connection closed before the AMMEF file was sent."
        );
    }

    setNetworkStatus(
        direct
            ? (
                `AMMEF file sent to ` +
                `${networkDirectTarget}.`
            )
            : (
                `AMMEF file transmitted on ` +
                `${getNetworkFrequency()} Vt.`
            ),
        "#00FF7F"
    );

    setTimeout(
        returnToReceiveMode,
        1000
    );
}

/**
 * Determines the approximate duration of an imported
 * AMMEF transmission for late-join replay.
 *
 * @param {object} parsed
 * @returns {Promise<number>}
 */
async function getImportedAMMEFDurationMs(
    parsed
) {
    const possibleAudioTracks = [
        parsed.cleanAudioBlob,
        parsed.monitorAudioBlob,
        parsed.fmMonitorAudioBlob,
        parsed.telemetryAudioBlob,
        parsed.photoMonitorAudioBlob,
        parsed.videoMonitorAudioBlob
    ];

    for (
        const track of
        possibleAudioTracks
    ) {
        if (
            track instanceof Blob
        ) {
            try {
                const duration =
                    await getAudioBlobDurationMs(
                        track
                    );

                if (duration > 0) {
                    return duration;
                }
            }
            catch (error) {
                console.warn(
                    "Could not read AMMEF track duration:",
                    error
                );
            }
        }
    }

    return 30000;
}

/**
 * Opens the AMMEF file selector.
 */
function selectAMMEFForTransmission() {
    if (
        !networkConnected
    ) {
        setNetworkStatus(
            "Connect to the ArNet relay before transmitting an AMMEF file.",
            "#FF3333"
        );

        return;
    }

    fileTransmitAMMEF.value =
        "";

    fileTransmitAMMEF.click();
}

/**
 * Handles a selected AMMEF file.
 *
 * @param {Event} event
 */
async function handleAMMEFTransmitSelection(
    event
) {
    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }

    try {
        await transmitExistingAMMEFFile(
            file
        );
    }
    catch (error) {
        console.error(
            "AMMEF file transmission failed:",
            error
        );

        setNetworkStatus(
            `AMMEF transmission failed: ${
                error.message ||
                "Unknown error"
            }`,
            "#FF3333"
        );

        returnToReceiveMode();
    }
}

// ======================================================
// Network control listeners
// ======================================================

function initializeNetworkControls() {
    if (txtCallsign) {
        txtCallsign.addEventListener(
            "change",
            updateNetworkRegistration
        );

        txtCallsign.addEventListener(
            "blur",
            updateNetworkRegistration
        );

        txtCallsign.addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                        "Enter"
                ) {
                    event.preventDefault();
                    txtCallsign.blur();
                }
            }
        );
    }
}

initializeNetworkControls();
if (
    btnTransmitAMMEF &&
    fileTransmitAMMEF
) {
    btnTransmitAMMEF.addEventListener(
        "click",
        selectAMMEFForTransmission
    );

    fileTransmitAMMEF.addEventListener(
        "change",
        handleAMMEFTransmitSelection
    );
}
