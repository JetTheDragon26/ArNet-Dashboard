// ======================================================
// ArNet Transceiver
// Video Import, ABMTV Encoding, and Network Transport
// ======================================================

const ARNET_VIDEO_MAX_DURATION = 30;
const ARNET_VIDEO_FRAME_RATE = 2;

const ARNET_VIDEO_SCAN_WIDTH = 64;
const ARNET_VIDEO_SCAN_HEIGHT = 48;

const ARNET_VIDEO_SYNC_FREQUENCY = 1200;
const ARNET_VIDEO_BLACK_FREQUENCY = 1500;
const ARNET_VIDEO_WHITE_FREQUENCY = 2300;

const ARNET_VIDEO_SYNC_DURATION = 0.004;
const ARNET_VIDEO_PIXEL_DURATION = 0.00035;

// ======================================================
// File validation
// ======================================================

/**
 * Checks whether a selected file is a supported
 * compressed video.
 *
 * Actual playback support depends on the codec inside
 * the container. H.264/AAC MP4 and standard WebM are
 * normally the safest choices.
 *
 * @param {File} file
 * @returns {boolean}
 */
function isSupportedVideoFile(file) {
    if (!(file instanceof File)) {
        return false;
    }

    const name =
        file.name.toLowerCase();

    const supportedExtension =
        name.endsWith(".mp4") ||
        name.endsWith(".m4v") ||
        name.endsWith(".webm") ||
        name.endsWith(".mov");

    const supportedMime =
        typeof file.type === "string" &&
        file.type.startsWith("video/");

    return (
        supportedExtension ||
        supportedMime
    );
}

// ======================================================
// Temporary video loading
// ======================================================

/**
 * Loads a video Blob into a temporary video element.
 *
 * @param {Blob} videoBlob
 * @returns {Promise<{
 *     video: HTMLVideoElement,
 *     url: string
 * }>}
 */
function createLoadedVideoElement(
    videoBlob
) {
    return new Promise(
        (
            resolve,
            reject
        ) => {
            const url =
                URL.createObjectURL(
                    videoBlob
                );

            const video =
                document.createElement(
                    "video"
                );

            video.preload =
                "metadata";

            video.muted =
                true;

            video.playsInline =
                true;

            const cleanupFailure =
                message => {
                    URL.revokeObjectURL(
                        url
                    );

                    reject(
                        new Error(
                            message
                        )
                    );
                };

            video.addEventListener(
                "loadedmetadata",
                () => {
                    resolve({
                        video,
                        url
                    });
                },
                {
                    once: true
                }
            );

            video.addEventListener(
                "error",
                () => {
                    cleanupFailure(
                        "The browser could not load this video. " +
                        "Its container or codec may not be supported."
                    );
                },
                {
                    once: true
                }
            );

            video.src =
                url;

            video.load();
        }
    );
}

/**
 * Waits for a video element to seek to the requested
 * timestamp.
 *
 * @param {HTMLVideoElement} video
 * @param {number} time
 * @returns {Promise<void>}
 */
function seekVideo(
    video,
    time
) {
    return new Promise(
        (
            resolve,
            reject
        ) => {
            const requestedTime =
                Math.max(
                    0,
                    Math.min(
                        time,
                        Math.max(
                            0,
                            (
                                video.duration ||
                                time
                            ) -
                            0.001
                        )
                    )
                );

            /*
             * The first frame can already be at time zero,
             * so forcing another seek may not produce a
             * seeked event.
             */
            if (
                Math.abs(
                    video.currentTime -
                    requestedTime
                ) < 0.001 &&
                video.readyState >= 2
            ) {
                resolve();
                return;
            }

            let timeoutId;

            const cleanup =
                () => {
                    clearTimeout(
                        timeoutId
                    );

                    video.removeEventListener(
                        "seeked",
                        handleSeeked
                    );

                    video.removeEventListener(
                        "error",
                        handleError
                    );
                };

            const handleSeeked =
                () => {
                    cleanup();
                    resolve();
                };

            const handleError =
                () => {
                    cleanup();

                    reject(
                        new Error(
                            "The browser failed while seeking the video."
                        )
                    );
                };

            timeoutId =
                setTimeout(
                    () => {
                        cleanup();

                        reject(
                            new Error(
                                "Timed out while reading a video frame."
                            )
                        );
                    },
                    7000
                );

            video.addEventListener(
                "seeked",
                handleSeeked,
                {
                    once: true
                }
            );

            video.addEventListener(
                "error",
                handleError,
                {
                    once: true
                }
            );

            try {
                video.currentTime =
                    requestedTime;
            }
            catch (error) {
                cleanup();
                reject(error);
            }
        }
    );
}

// ======================================================
// Tone generation
// ======================================================

/**
 * Appends a sine-wave tone to a PCM array.
 *
 * @param {number[]} destination
 * @param {number} frequency
 * @param {number} durationSeconds
 * @param {{ value: number }} phaseState
 */
function appendVideoTone(
    destination,
    frequency,
    durationSeconds,
    phaseState
) {
    const sampleCount =
        Math.max(
            1,
            Math.floor(
                durationSeconds *
                ARNET_SAMPLE_RATE
            )
        );

    for (
        let index = 0;
        index < sampleCount;
        index++
    ) {
        phaseState.value +=
            (
                2 *
                Math.PI *
                frequency
            ) /
            ARNET_SAMPLE_RATE;

        const sample =
            Math.sin(
                phaseState.value
            ) *
            14500;

        destination.push(
            Math.max(
                -32768,
                Math.min(
                    32767,
                    Math.round(
                        sample
                    )
                )
            )
        );
    }
}

/**
 * Converts one RGBA video frame into ABMTV-style tones.
 *
 * Each row begins with a sync tone. Pixel brightness
 * determines the following tone frequency.
 *
 * @param {Uint8ClampedArray} rgbaData
 * @param {number[]} pcmSamples
 * @param {{ value: number }} phaseState
 */
function encodeVideoFramePixels(
    rgbaData,
    pcmSamples,
    phaseState
) {
    for (
        let y = 0;
        y < ARNET_VIDEO_SCAN_HEIGHT;
        y++
    ) {
        appendVideoTone(
            pcmSamples,
            ARNET_VIDEO_SYNC_FREQUENCY,
            ARNET_VIDEO_SYNC_DURATION,
            phaseState
        );

        const rowOffset =
            y *
            ARNET_VIDEO_SCAN_WIDTH *
            4;

        for (
            let x = 0;
            x < ARNET_VIDEO_SCAN_WIDTH;
            x++
        ) {
            const pixelIndex =
                rowOffset +
                (
                    x *
                    4
                );

            const red =
                rgbaData[
                    pixelIndex
                ];

            const green =
                rgbaData[
                    pixelIndex + 1
                ];

            const blue =
                rgbaData[
                    pixelIndex + 2
                ];

            const brightness =
                (
                    (
                        red *
                        0.299
                    ) +
                    (
                        green *
                        0.587
                    ) +
                    (
                        blue *
                        0.114
                    )
                ) /
                255;

            const frequency =
                ARNET_VIDEO_BLACK_FREQUENCY +
                (
                    brightness *
                    (
                        ARNET_VIDEO_WHITE_FREQUENCY -
                        ARNET_VIDEO_BLACK_FREQUENCY
                    )
                );

            appendVideoTone(
                pcmSamples,
                frequency,
                ARNET_VIDEO_PIXEL_DURATION,
                phaseState
            );
        }
    }
}

// ======================================================
// Video monitor encoder
// ======================================================

/**
 * Samples frames from a compressed video and creates a
 * low-resolution ABMTV monitor waveform.
 *
 * The original video bytes are not modified.
 *
 * @param {Blob} videoBlob
 * @returns {Promise<{
 *     monitorAudioBlob: Blob,
 *     pcmSamples: Int16Array,
 *     metadata: object
 * }>}
 */
async function encodeCompressedVideoMonitor(
    videoBlob
) {
    const {
        video,
        url
    } =
        await createLoadedVideoElement(
            videoBlob
        );

    try {
        const sourceDuration =
            Number.isFinite(
                video.duration
            )
                ? video.duration
                : 0;

        if (
            sourceDuration <= 0
        ) {
            throw new Error(
                "The selected video has no readable duration."
            );
        }

        const encodedDuration =
            Math.min(
                sourceDuration,
                ARNET_VIDEO_MAX_DURATION
            );

        const frameCount =
            Math.max(
                1,
                Math.ceil(
                    encodedDuration *
                    ARNET_VIDEO_FRAME_RATE
                )
            );

        const canvas =
            document.createElement(
                "canvas"
            );

        canvas.width =
            ARNET_VIDEO_SCAN_WIDTH;

        canvas.height =
            ARNET_VIDEO_SCAN_HEIGHT;

        const context =
            canvas.getContext(
                "2d",
                {
                    willReadFrequently:
                        true
                }
            );

        if (!context) {
            throw new Error(
                "Could not create the video encoding canvas."
            );
        }

        const pcmSamples = [];

        const phaseState = {
            value: 0
        };

        const sourceWidth =
            video.videoWidth ||
            ARNET_VIDEO_SCAN_WIDTH;

        const sourceHeight =
            video.videoHeight ||
            ARNET_VIDEO_SCAN_HEIGHT;

        for (
            let frameIndex = 0;
            frameIndex < frameCount;
            frameIndex++
        ) {
            const frameTime =
                Math.min(
                    Math.max(
                        0,
                        encodedDuration -
                        0.001
                    ),
                    frameIndex /
                    ARNET_VIDEO_FRAME_RATE
                );

            txtStatus.textContent =
                `STATUS: Encoding ABMTV video frame ` +
                `${frameIndex + 1}/${frameCount}...`;

            txtStatus.style.color =
                "magenta";

            await seekVideo(
                video,
                frameTime
            );

            context.fillStyle =
                "#000000";

            context.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

            /*
             * Preserve the source aspect ratio and
             * letterbox when necessary.
             */
            const scale =
                Math.min(
                    canvas.width /
                        sourceWidth,
                    canvas.height /
                        sourceHeight
                );

            const drawWidth =
                sourceWidth *
                scale;

            const drawHeight =
                sourceHeight *
                scale;

            const drawX =
                (
                    canvas.width -
                    drawWidth
                ) /
                2;

            const drawY =
                (
                    canvas.height -
                    drawHeight
                ) /
                2;

            context.drawImage(
                video,
                drawX,
                drawY,
                drawWidth,
                drawHeight
            );

            const frameData =
                context.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

            encodeVideoFramePixels(
                frameData.data,
                pcmSamples,
                phaseState
            );
        }

        const pcmArray =
            Int16Array.from(
                pcmSamples
            );

        const monitorAudioBlob =
            createWavBuffer(
                pcmArray,
                ARNET_SAMPLE_RATE
            );

        const metadata = {
            format:
                "ArNet-Compressed-Video",

            version:
                "1.1",

            mode:
                "ABMTV",

            originalWidth:
                sourceWidth,

            originalHeight:
                sourceHeight,

            originalDuration:
                sourceDuration,

            encodedDuration,

            frameRate:
                ARNET_VIDEO_FRAME_RATE,

            frameCount,

            scanWidth:
                ARNET_VIDEO_SCAN_WIDTH,

            scanHeight:
                ARNET_VIDEO_SCAN_HEIGHT,

            originalMimeType:
                videoBlob.type ||
                "application/octet-stream",

            originalSize:
                videoBlob.size,

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
                    .toISOString()
        };

        return {
            monitorAudioBlob,

            pcmSamples:
                pcmArray,

            metadata
        };
    }
    finally {
        video.pause();

        video.removeAttribute(
            "src"
        );

        video.load();

        URL.revokeObjectURL(
            url
        );
    }
}

// ======================================================
// Video import and transmission
// ======================================================

/**
 * Imports a compressed video, creates its ABMTV monitor
 * track, preserves the original compressed file, and
 * sends it as an AMMEF packet when connected.
 *
 * @param {File} file
 */
async function importCompressedVideo(
    file
) {
    if (
        !isSupportedVideoFile(
            file
        )
    ) {
        throw new Error(
            "Please select an MP4, M4V, WebM, or MOV video."
        );
    }

    comboMode.value =
        "ABMTV";

    if (
        typeof updateBandList ===
        "function"
    ) {
        updateBandList();
    }

    txtTxState.textContent =
        "VIDEO";

    boxTxState.style.background =
        "purple";

    txtStatus.textContent =
        `STATUS: Loading compressed video [${file.name}]...`;

    txtStatus.style.color =
        "magenta";

    /*
     * Clear unrelated audio/photo payloads so the AMMEF
     * contains only this video transmission.
     */
    lastCleanAudioBlob =
        null;

    lastTelemetryAudioBlob =
        null;

    lastOriginalPhotoBlob =
        null;

    lastOriginalPhotoType =
        null;

    lastOriginalPhotoName =
        null;

    lastPhotoMonitorAudioBlob =
        null;

    lastPhotoMetadata =
        null;

    /*
     * Preserve the original compressed video exactly.
     */
    lastOriginalVideoBlob =
        file;

    lastOriginalVideoType =
        file.type ||
        "application/octet-stream";

    lastOriginalVideoName =
        file.name;

    const result =
        await encodeCompressedVideoMonitor(
            file
        );

    lastVideoMonitorAudioBlob =
        result.monitorAudioBlob;

    lastVideoMetadata =
        result.metadata;

    /*
     * The generated tones are the monitor/modulated
     * representation of the visual transmission.
     */
    lastModulatedAudioBlob =
        result.monitorAudioBlob;

    lastProcessedAudioBlob =
        result.monitorAudioBlob;

    lastAudioPcmArray =
        result.pcmSamples;

    await playAudioBlob(
        result.monitorAudioBlob
    );

    if (
        typeof enableSaveButton ===
        "function"
    ) {
        enableSaveButton();
    }

    if (
        networkConnected &&
        typeof sendCurrentAMMEFToNetwork ===
            "function"
    ) {
        txtTxState.textContent =
            "TX-VID";

        boxTxState.style.background =
            "#770077";

        txtStatus.textContent =
            "STATUS: Building and sending video AMMEF packet...";

        txtStatus.style.color =
            "#FFD700";

        try {
            await sendCurrentAMMEFToNetwork(
                "video"
            );
        }
        catch (error) {
            console.error(
                "Video network transmission failed:",
                error
            );

            txtStatus.textContent =
                `ERROR: ${
                    error.message ||
                    "Video transmission failed."
                }`;

            txtStatus.style.color =
                "#FF3333";

            returnToReceiveMode();

            throw error;
        }
    }

    txtStatus.textContent =
        networkConnected
            ? (
                `STATUS: Video [${file.name}] encoded and transmitted. ` +
                `${result.metadata.frameCount} monitor frames generated.`
            )
            : (
                `STATUS: Video [${file.name}] encoded. ` +
                `${result.metadata.frameCount} monitor frames ready for AMMEF.`
            );

    txtStatus.style.color =
        "#00FF7F";

    if (
        typeof refreshMediaActionButtons ===
        "function"
    ) {
        refreshMediaActionButtons();
    }

    setTimeout(
        returnToReceiveMode,
        1500
    );
}

// ======================================================
// Video preview
// ======================================================

/**
 * Escapes text before writing it into the preview window.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeVideoHtml(
    value
) {
    return String(
        value ||
        ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            "\"",
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

/**
 * Opens the preserved original compressed video in a
 * normal browser player.
 */
function previewOriginalVideo() {
    if (
        !(
            lastOriginalVideoBlob
            instanceof Blob
        )
    ) {
        txtStatus.textContent =
            "ERROR: No original video has been loaded.";

        txtStatus.style.color =
            "#FF3333";

        return;
    }

    const url =
        URL.createObjectURL(
            lastOriginalVideoBlob
        );

    const previewWindow =
        window.open(
            "",
            "_blank",
            "width=900,height=700"
        );

    if (!previewWindow) {
        URL.revokeObjectURL(
            url
        );

        txtStatus.textContent =
            "ERROR: The browser blocked the video preview window.";

        txtStatus.style.color =
            "#FF3333";

        return;
    }

    const safeTitle =
        escapeVideoHtml(
            lastOriginalVideoName ||
            "ArNet Video"
        );

    previewWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">

            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
            >

            <title>${safeTitle}</title>

            <style>
                html,
                body {
                    width: 100%;
                    height: 100%;
                    margin: 0;
                    background: #000000;
                    color: #ffffff;
                    font-family: Consolas, monospace;
                }

                body {
                    display: flex;
                    flex-direction: column;
                }

                header {
                    padding: 10px;
                    background: #111111;
                    color: #00ffff;
                    border-bottom: 1px solid #333333;
                }

                main {
                    flex: 1;
                    min-height: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 10px;
                    box-sizing: border-box;
                }

                video {
                    width: 100%;
                    height: 100%;
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    background: #000000;
                }
            </style>
        </head>

        <body>
            <header>${safeTitle}</header>

            <main>
                <video
                    controls
                    autoplay
                    playsinline
                    src="${url}"
                ></video>
            </main>
        </body>
        </html>
    `);

    previewWindow.document.close();

    previewWindow.addEventListener(
        "beforeunload",
        () => {
            URL.revokeObjectURL(
                url
            );
        },
        {
            once: true
        }
    );
}

// ======================================================
// File picker
// ======================================================

/**
 * Opens the browser file picker for compressed video.
 */
function openCompressedVideoPicker() {
    const fileInput =
        document.createElement(
            "input"
        );

    fileInput.type =
        "file";

    fileInput.accept =
        [
            "video/mp4",
            "video/x-m4v",
            "video/webm",
            "video/quicktime",
            ".mp4",
            ".m4v",
            ".webm",
            ".mov"
        ].join(",");

    fileInput.onchange =
        async event => {
            const file =
                event.target.files?.[0];

            if (!file) {
                return;
            }

            try {
                await importCompressedVideo(
                    file
                );
            }
            catch (error) {
                console.error(
                    "Video import error:",
                    error
                );

                txtStatus.textContent =
                    `ERROR: ${
                        error.message ||
                        "Video import failed."
                    }`;

                txtStatus.style.color =
                    "#FF3333";

                if (
                    typeof returnToReceiveMode ===
                    "function"
                ) {
                    returnToReceiveMode();
                }
            }
        };

    fileInput.click();
}
