// ======================================================
// ArNet Transceiver
// WebSocket Networking
// ======================================================

function setNetworkStatus(message, color = "#AAAAAA") {
    console.log("[ArNet Network]", message);

    if (typeof setStatus === "function") {
        setStatus(message, color);
    }
}

function updateNetworkRegistration() {
    if (
        !networkSocket ||
        networkSocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    sendNetworkMessage({
        type: "register",
        callsign: getNetworkCallsign(),
        frequency: getNetworkFrequency()
    });
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

async function sendCurrentAMMEFToNetwork(
    transmissionKind = "audio"
) {
    if (
        !networkSocket ||
        networkSocket.readyState !== WebSocket.OPEN
    ) {
        throw new Error(
            "ArNet is not connected."
        );
    }

    async function receiveNetworkAMMEF(message) {
    if (!message.data) {
        return;
    }

    const bytes =
        base64ToBytes(
            message.data
        );

    const ammefBlob =
        new Blob(
            [bytes],
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
        `Receiving ${message.transmissionKind || "ArNet"} ` +
        `from ${message.from || "UNKNOWN"} ` +
        `on ${message.frequency} Vt.`,
        "#00FFFF"
    );

    try {
        const parsed =
            await readAMMEFFile(
                ammefBlob
            );

        await decodeReceivedAMMEF(
            parsed,
            message
        );

        refreshMediaActionButtons();
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
        previewLoadedAMMEFPhoto();

        setNetworkStatus(
            `Decoded photo from ${message.from}.`,
            "#00FF7F"
        );

        return;
    }

    if (
        kind === "video" &&
        parsed.originalVideoBlob
    ) {
        previewLoadedAMMEFVideo();

        setNetworkStatus(
            `Decoded video from ${message.from}.`,
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
        `Decoded ${kind} transmission from ${message.from}.`,
        "#00FF7F"
    );
}
    
    const ammefBlob =
        await createAMMEFBlob();

    const bytes =
        new Uint8Array(
            await ammefBlob.arrayBuffer()
        );

    sendNetworkMessage({
        type:
            networkTargetMode === "direct" &&
            networkDirectTarget
                ? "direct-ammef"
                : "channel-ammef",

        from:
            getNetworkCallsign(),

        to:
            networkTargetMode === "direct"
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
            bytesToBase64(bytes),

        timestamp:
            new Date().toISOString()
    });

    setNetworkStatus(
        `Sent ${transmissionKind} transmission on ` +
        `${getNetworkFrequency()} Vt.`,
        "#00FF7F"
    );
}

function connectArNetNetwork() {
    if (
        networkSocket &&
        (
            networkSocket.readyState === WebSocket.OPEN ||
            networkSocket.readyState === WebSocket.CONNECTING
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
            networkConnected = true;

            networkCurrentFrequency =
                getNetworkFrequency();

            sendNetworkMessage({
                type: "register",

                callsign:
                    getNetworkCallsign(),

                frequency:
                    networkCurrentFrequency
            });

            setNetworkStatus(
                `Connected to ArNet on ${networkCurrentFrequency} Vt.`,
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
            networkConnected = false;
            networkBusy = false;

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
                "Network connection failed.",
                "#FF3333"
            );
        }
    );
}

function disconnectArNetNetwork() {
    if (!networkSocket) {
        return;
    }

    networkSocket.close();
    networkSocket = null;
    networkConnected = false;
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

    if (!Number.isFinite(numericFrequency)) {
        return;
    }

    networkCurrentFrequency =
        numericFrequency;

    if (networkConnected) {
        sendNetworkMessage({
            type: "tune",
            frequency:
                numericFrequency
        });
    }
}

async function sendAudioBlobToNetwork(
    audioBlob,
    options = {}
) {
    if (!(audioBlob instanceof Blob)) {
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

    const arrayBuffer =
        await audioBlob.arrayBuffer();

    const bytes =
        new Uint8Array(arrayBuffer);

    const base64 =
        bytesToBase64(bytes);

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
            base64,

        timestamp:
            new Date().toISOString()
    });

    setNetworkStatus(
        options.directTarget
            ? `Sent transmission to ${options.directTarget}.`
            : `Sent transmission on ${getNetworkFrequency()} Vt.`,
        "#00FF7F"
    );
}

function bytesToBase64(bytes) {
    let binary = "";

    const chunkSize = 0x8000;

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
            binary.charCodeAt(index);
    }

    return bytes;
}

function updateNetworkRegistration() {
    if (
        !networkConnected ||
        !networkSocket ||
        networkSocket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    sendNetworkMessage({
        type: "register",
        callsign: getNetworkCallsign(),
        frequency: getNetworkFrequency()
    });

    setNetworkStatus(
        `Registered as ${getNetworkCallsign()} on ${getNetworkFrequency()} Vt.`,
        "#00FF7F"
    );
}

async function handleNetworkMessage(event) {
    if (typeof event.data !== "string") {
        return;
    }
    case "channel-ammef":
    case "direct-ammef":
    await receiveNetworkAMMEF(message);
    break;
    let message;

    try {
        message =
            JSON.parse(event.data);
    }
    catch (error) {
        console.warn(
            "Invalid network message:",
            event.data
        );

        return;
    }

    switch (message.type) {
        case "registered":
            networkStationId =
                message.stationId;

            break;

        case "listener-count":
            networkListenerCount =
                message.count || 0;

            setNetworkStatus(
                `${networkListenerCount} station(s) listening on ${message.frequency} Vt.`,
                "#00FFFF"
            );

            break;

        case "busy":
            networkBusy =
                Boolean(message.busy);

            break;

        case "channel-audio":
        case "direct-audio":
            await receiveNetworkAudio(
                message
            );

            break;

        case "error":
            setNetworkStatus(
                `Network error: ${message.message}`,
                "#FF3333"
            );

            break;
    }
}

async function receiveNetworkAudio(message) {
    if (!message.audio) {
        return;
    }

    const bytes =
        base64ToBytes(
            message.audio
        );

    const blob =
        new Blob(
            [bytes],
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
        `Receiving ${message.from || "unknown"} on ${message.frequency} Vt.`,
        "#00FFFF"
    );

    try {
        const decoded =
            await decodeAudioBlob(blob);

        lastAudioPcmArray =
            decoded.pcmSamples;

        await playAudioBlob(blob);
    }
    catch (error) {
        console.error(
            "Incoming audio playback failed:",
            error
        );

        setNetworkStatus(
            "Incoming network audio could not be played.",
            "#FF3333"
        );
    }
}
