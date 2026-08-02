// ======================================================
// ArNet Transceiver
// WebSocket Networking and AMMEF Transport
// ======================================================

function setNetworkStatus(rec
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
            getNetworkFrequency()
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

    networkSocket =
        new WebSocket(
            networkServerUrl
        );

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
                    networkCurrentFrequency
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
        () => {
            networkConnected =
                false;

            networkBusy =
                false;

            setNetworkStatus(
                "Disconnected from ArNet relay.",
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
        networkSocket.close();
    }

    networkSocket =
        null;

    networkConnected =
        false;
}

function sendNetworkMessage(message) {
    if (
        !networkSocket ||
        networkSocket.readyState !==
            WebSocket.OPEN
    ) {
        return false;
    }

    networkSocket.send(
        JSON.stringify(message)
    );

    return true;
}

function tuneNetworkFrequency(frequency) {
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
                numericFrequency
        });
    }
}

// ======================================================
// Base64 helpers
// ======================================================

function bytesToBase64(bytes) {
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

    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary =
        atob(base64);

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
// AMMEF transmission
// ======================================================

async function sendCurrentAMMEFToNetwork(
    transmissionKind = "audio"
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

    const direct =
        networkTargetMode ===
            "direct" &&
        Boolean(
            networkDirectTarget
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

            frequency:
                getNetworkFrequency(),

            mode:
                comboMode.value,

            transmissionKind,

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
// Compatibility audio-only transport
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
// Incoming network messages
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

    switch (message.type) {
        case "welcome":
            networkStationId =
                message.stationId ||
                networkStationId;

            break;

        case "registered":
            networkStationId =
                message.stationId;

            setNetworkStatus(
                `Registered as ${message.callsign} ` +
                `on ${message.frequency} Vt.`,
                "#00FF7F"
            );

            break;

        case "tuned":
            setNetworkStatus(
                `Tuned to ${message.frequency} Vt.`,
                "#00FFFF"
            );

            break;

        case "listener-count":
            networkListenerCount =
                message.count || 0;

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
            await receiveNetworkAudio(
                message
            );

            break;

        case "channel-ammef":
        case "direct-ammef":
            await receiveNetworkAMMEF(
                message
            );

            break;

        case "transmission-result":
            setNetworkStatus(
                `Transmission delivered to ` +
                `${message.recipients || 0} station(s).`,
                "#00FF7F"
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
// Audio reception
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
            blob
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

        await decodeIncomingAMMEFPacket(
    parsed,
    message
);
        

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
}

async function decodeReceivedAMMEF(
    parsed,
    message
) {
    const kind =
        message.transmissionKind ||
        "audio";

    if (
        kind === "photo" &&
        parsed.originalPhotoBlob
    ) {
        if (
            parsed.photoMonitorAudioBlob
        ) {
            const decoded =
                await decodeAudioBlob(
                    parsed.photoMonitorAudioBlob
                );

            lastAudioPcmArray =
                decoded.pcmSamples;

            await playAudioBlob(
                parsed.photoMonitorAudioBlob
            );
        }

        setNetworkStatus(
            `Decoded photo from ${message.from}. ` +
            `Use ORIGINAL PHOTO to view it.`,
            "#00FF7F"
        );

        return;
    }

    if (
        kind === "video" &&
        parsed.originalVideoBlob
    ) {
        if (
            parsed.videoMonitorAudioBlob
        ) {
            const decoded =
                await decodeAudioBlob(
                    parsed.videoMonitorAudioBlob
                );

            lastAudioPcmArray =
                decoded.pcmSamples;

            await playAudioBlob(
                parsed.videoMonitorAudioBlob
            );
        }

        setNetworkStatus(
            `Decoded video from ${message.from}. ` +
            `Use ORIGINAL VIDEO to view it.`,
            "#00FF7F"
        );

        return;
    }

    const audioTrack =
        parsed.cleanAudioBlob ||
        parsed.monitorAudioBlob ||
        parsed.telemetryAudioBlob ||
        parsed.photoMonitorAudioBlob ||
        parsed.videoMonitorAudioBlob;

    if (!audioTrack) {
        throw new Error(
            "The transmission contains no usable payload."
        );
    }

    const decoded =
        await decodeAudioBlob(
            audioTrack
        );

    lastAudioPcmArray =
        decoded.pcmSamples;

    await playAudioBlob(
        audioTrack
    );

    setNetworkStatus(
        `Decoded ${kind} transmission ` +
        `from ${message.from}.`,
        "#00FF7F"
    );
}

// ======================================================
// Imported audio encoder
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

    const rawChannel =
        decoded.getChannelData(0);

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
// Networking event listeners
// ======================================================

function initializeNetworkControls() {
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

    txtFrequency.addEventListener(
        "change",
        () => {
            tuneNetworkFrequency(
                txtFrequency.value
            );
        }
    );

    txtFrequency.addEventListener(
        "keydown",
        event => {
            if (
                event.key ===
                "Enter"
            ) {
                event.preventDefault();

                txtFrequency.blur();

                tuneNetworkFrequency(
                    txtFrequency.value
                );
            }
        }
    );
}

initializeNetworkControls();
