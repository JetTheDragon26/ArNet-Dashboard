// ======================================================
// ArNet Transceiver
// Compressed Video Import and ABMTV Monitor Encoder
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

/**
 * Enables video formats that browsers commonly support.
 *
 * MP4 support depends on the codecs stored inside the
 * container. H.264/AAC is generally the safest MP4 type.
 */
function isSupportedVideoFile(file) {
    if (!(file instanceof File)) {
        return false;
    }

    const name =
        file.name.toLowerCase();

    const allowedExtension =
        name.endsWith(".mp4") ||
        name.endsWith(".m4v") ||
        name.endsWith(".webm") ||
        name.endsWith(".mov");

    const allowedMime =
        file.type.startsWith("video/");

    return allowedExtension || allowedMime;
}

/**
 * Loads a video Blob into a temporary HTMLVideoElement.
 *
 * @param {Blob} videoBlob
 * @returns {Promise<{
 *     video: HTMLVideoElement,
 *     url: string
 * }>}
 */
function createLoadedVideoElement(videoBlob) {
    return new Promise((resolve, reject) => {
        const url =
            URL.createObjectURL(videoBlob);

        const video =
            document.createElement("video");

        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
            resolve({
                video,
                url
            });
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);

            reject(
                new Error(
                    "The browser could not load this video. " +
                    "The MP4 may use an unsupported codec."
                )
            );
        };

        video.src = url;
    });
}

/**
 * Waits for a video element to seek to a requested time.
 *
 * @param {HTMLVideoElement} video
 * @param {number} time
 * @returns {Promise<void>}
 */
function seekVideo(video, time) {
    return new Promise((resolve, reject) => {
        const timeout =
            setTimeout(() => {
                cleanup();

                reject(
                    new Error(
                        "Timed out while reading a video frame."
                    )
                );
            }, 5000);

        const cleanup = () => {
            clearTimeout(timeout);

            video.removeEventListener(
                "seeked",
                handleSeeked
            );

            video.removeEventListener(
                "error",
                handleError
            );
        };

        const handleSeeked = () => {
            cleanup();
            resolve();
        };

        const handleError = () => {
            cleanup();

            reject(
                new Error(
                    "The browser failed while seeking the video."
                )
            );
        };

        video.addEventListener(
            "seeked",
            handleSeeked,
            { once: true }
        );

        video.addEventListener(
            "error",
            handleError,
            { once: true }
        );

        video.currentTime =
            Math.max(
                0,
                Math.min(
                    time,
                    video.duration || time
                )
            );
    });
}

/**
 * Appends one sine-wave tone to a PCM array.
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
            ) / ARNET_SAMPLE_RATE;

        destination.push(
            Math.round(
                Math.sin(
                    phaseState.value
                ) * 14500
            )
        );
    }
}

/**
 * Converts one canvas frame into ABMTV-style tones.
 *
 * Each scan row starts with a synchronization tone.
 * Pixel brightness controls the following tone frequency.
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
                (x * 4);

            const red =
                rgbaData[pixelIndex];

            const green =
                rgbaData[pixelIndex + 1];

            const blue =
                rgbaData[pixelIndex + 2];

            const brightness =
                (
                    (red * 0.299) +
                    (green * 0.587) +
                    (blue * 0.114)
                ) / 255;

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

/**
 * Samples frames from a compressed video and generates
 * a low-resolution ABMTV monitor waveform.
 *
 * The original MP4/WebM remains unchanged and is stored
 * separately. This function only creates the radio-style
 * audible representation.
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
            Number.isFinite(video.duration)
                ? video.duration
                : 0;

        if (sourceDuration <= 0) {
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
                Math.floor(
                    encodedDuration *
                    ARNET_VIDEO_FRAME_RATE
                )
            );

        const canvas =
            document.createElement("canvas");

        canvas.width =
            ARNET_VIDEO_SCAN_WIDTH;

        canvas.height =
            ARNET_VIDEO_SCAN_HEIGHT;

        const context =
            canvas.getContext(
                "2d",
                {
                    willReadFrequently: true
                }
            );

        if (!context) {
            throw new Error(
                "Could not create the video frame canvas."
            );
        }

        const pcmSamples = [];
        const phaseState = {
            value: 0
        };

        for (
            let frameIndex = 0;
            frameIndex < frameCount;
            frameIndex++
        ) {
            const frameTime =
                Math.min(
                    encodedDuration,
                    frameIndex /
                    ARNET_VIDEO_FRAME_RATE
                );

            txtStatus.textContent =
                `STATUS: Encoding ABMTV frame ` +
                `${frameIndex + 1}/${frameCount}...`;

            txtStatus.style.color =
                "magenta";

            await seekVideo(
                video,
                frameTime
            );

            context.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

            context.drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height
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
                "1.0",

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

            mode:
                "ABMTV",

            virtualFrequency:
                Number(
                    txtFrequency.value
                ),

            frequencyUnit:
                "Vt",

            created:
                new Date().toISOString()
        };

        return {
            monitorAudioBlob,
            pcmSamples:
                pcmArray,
            metadata
        };
    }
    finally {
        URL.revokeObjectURL(
            url
        );
    }
}

/**
 * Imports a compressed video and prepares both:
 *
 * 1. Original compressed video for AMMEF storage.
 * 2. ABMTV tone waveform for radio-style monitoring.
 *
 * @param {File} file
 */
async function importCompressedVideo(file) {
    if (!isSupportedVideoFile(file)) {
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
        "ABMTV";

    boxTxState.style.background =
        "purple";

    txtStatus.textContent =
        `STATUS: Loading compressed video [${file.name}]...`;

    txtStatus.style.color =
        "magenta";

    /*
     * Preserve the original compressed file unchanged.
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
     * The video monitor waveform acts as the modulated
     * signal for ABMTV.
     */
    lastModulatedAudioBlob =
        result.monitorAudioBlob;

    /*
     * For now, this is the audio payload used by the
     * existing save/display flow. The AMMEF writer will
     * later store the original video separately.
     */
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

    txtStatus.textContent =
        `STATUS: Video ready — original compressed file preserved, ` +
        `${result.metadata.frameCount} ABMTV frames encoded.`;

    txtStatus.style.color =
        "#00FF7F";
}

/**
 * Opens the selected compressed video in a normal browser
 * video player using the original unchanged bytes.
 */
function previewOriginalVideo() {
    if (
        !(lastOriginalVideoBlob instanceof Blob)
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

    const videoWindow =
        window.open(
            "",
            "_blank",
            "width=800,height=600"
        );

    if (!videoWindow) {
        URL.revokeObjectURL(url);

        txtStatus.textContent =
            "ERROR: The browser blocked the video preview window.";

        txtStatus.style.color =
            "#FF3333";

        return;
    }

    const safeTitle =
        (
            lastOriginalVideoName ||
            "ArNet Video"
        )
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");

    videoWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>${safeTitle}</title>

            <style>
                html,
                body {
                    width: 100%;
                    height: 100%;
                    margin: 0;
                    background: #000;
                    color: #fff;
                    font-family: Consolas, monospace;
                }

                body {
                    display: flex;
                    flex-direction: column;
                }

                header {
                    padding: 10px;
                    background: #111;
                    color: #00ffff;
                }

                video {
                    width: 100%;
                    flex: 1;
                    min-height: 0;
                    background: #000;
                }
            </style>
        </head>

        <body>
            <header>${safeTitle}</header>

            <video
                controls
                autoplay
                playsinline
                src="${url}"
            ></video>
        </body>
        </html>
    `);

    videoWindow.document.close();

    videoWindow.addEventListener(
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

/**
 * Handles the LOAD VIDEO / IMAGE button.
 *
 * This version focuses on compressed video. Image support
 * can remain as a separate path or be added afterward.
 */
function openCompressedVideoPicker() {
    const fileInput =
        document.createElement(
            "input"
        );

    fileInput.type =
        "file";

    fileInput.accept =
        "video/mp4,video/x-m4v,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov";

    fileInput.onchange =
        async event => {
            const file =
                event.target.files[0];

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
                    `ERROR: ${error.message}`;

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
