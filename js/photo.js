// ======================================================
// ArNet Transceiver
// Compressed Photo Import and ABMTV Still-Frame Encoder
// ======================================================

const ARNET_PHOTO_SCAN_WIDTH = 128;
const ARNET_PHOTO_SCAN_HEIGHT = 96;

const ARNET_PHOTO_SYNC_FREQUENCY = 1200;
const ARNET_PHOTO_BLACK_FREQUENCY = 1500;
const ARNET_PHOTO_WHITE_FREQUENCY = 2300;

const ARNET_PHOTO_SYNC_DURATION = 0.005;
const ARNET_PHOTO_PIXEL_DURATION = 0.0015;

/**
 * Checks whether a selected file is a supported image.
 *
 * @param {File} file
 * @returns {boolean}
 */
function isSupportedPhotoFile(file) {
    if (!(file instanceof File)) {
        return false;
    }

    const name =
        file.name.toLowerCase();

    const supportedExtension =
        name.endsWith(".png") ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg") ||
        name.endsWith(".webp") ||
        name.endsWith(".gif") ||
        name.endsWith(".bmp");

    const supportedMime =
        file.type.startsWith("image/");

    return supportedExtension || supportedMime;
}

/**
 * Loads an image Blob into an HTMLImageElement.
 *
 * @param {Blob} imageBlob
 * @returns {Promise<{
 *     image: HTMLImageElement,
 *     url: string
 * }>}
 */
function createLoadedPhotoElement(imageBlob) {
    return new Promise((resolve, reject) => {
        const url =
            URL.createObjectURL(imageBlob);

        const image =
            new Image();

        image.onload = () => {
            resolve({
                image,
                url
            });
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);

            reject(
                new Error(
                    "The browser could not load this image."
                )
            );
        };

        image.src = url;
    });
}

/**
 * Appends an audible sine-wave tone.
 *
 * @param {number[]} destination
 * @param {number} frequency
 * @param {number} durationSeconds
 * @param {{ value: number }} phaseState
 */
function appendPhotoTone(
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
        let sampleIndex = 0;
        sampleIndex < sampleCount;
        sampleIndex++
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
                ) * 15000
            )
        );
    }
}

/**
 * Converts one RGBA image frame into ABMTV tones.
 *
 * Each row begins with a synchronization tone.
 * Pixel brightness determines the following frequency.
 *
 * @param {Uint8ClampedArray} rgbaData
 * @param {number[]} pcmSamples
 * @param {{ value: number }} phaseState
 */
function encodePhotoPixels(
    rgbaData,
    pcmSamples,
    phaseState
) {
    for (
        let y = 0;
        y < ARNET_PHOTO_SCAN_HEIGHT;
        y++
    ) {
        appendPhotoTone(
            pcmSamples,
            ARNET_PHOTO_SYNC_FREQUENCY,
            ARNET_PHOTO_SYNC_DURATION,
            phaseState
        );

        const rowOffset =
            y *
            ARNET_PHOTO_SCAN_WIDTH *
            4;

        for (
            let x = 0;
            x < ARNET_PHOTO_SCAN_WIDTH;
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
                ARNET_PHOTO_BLACK_FREQUENCY +
                (
                    brightness *
                    (
                        ARNET_PHOTO_WHITE_FREQUENCY -
                        ARNET_PHOTO_BLACK_FREQUENCY
                    )
                );

            appendPhotoTone(
                pcmSamples,
                frequency,
                ARNET_PHOTO_PIXEL_DURATION,
                phaseState
            );
        }
    }
}

/**
 * Creates an ABMTV tone waveform from a compressed image.
 *
 * The original image remains unchanged and is stored
 * separately for later AMMEF packaging.
 *
 * @param {Blob} photoBlob
 * @returns {Promise<{
 *     monitorAudioBlob: Blob,
 *     pcmSamples: Int16Array,
 *     metadata: object
 * }>}
 */
async function encodeCompressedPhotoMonitor(
    photoBlob
) {
    const {
        image,
        url
    } =
        await createLoadedPhotoElement(
            photoBlob
        );

    try {
        const canvas =
            document.createElement("canvas");

        canvas.width =
            ARNET_PHOTO_SCAN_WIDTH;

        canvas.height =
            ARNET_PHOTO_SCAN_HEIGHT;

        const context =
            canvas.getContext(
                "2d",
                {
                    willReadFrequently: true
                }
            );

        if (!context) {
            throw new Error(
                "Could not create the photo encoding canvas."
            );
        }

        /*
         * Fill the canvas black first so transparent image
         * areas do not become unpredictable.
         */
        context.fillStyle =
            "#000000";

        context.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        /*
         * Preserve the source aspect ratio.
         */
        const sourceWidth =
            image.naturalWidth ||
            image.width;

        const sourceHeight =
            image.naturalHeight ||
            image.height;

        if (
            sourceWidth <= 0 ||
            sourceHeight <= 0
        ) {
            throw new Error(
                "The selected image has invalid dimensions."
            );
        }

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
            ) / 2;

        const drawY =
            (
                canvas.height -
                drawHeight
            ) / 2;

        context.drawImage(
            image,
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

        const pcmSamples = [];

        const phaseState = {
            value: 0
        };

        encodePhotoPixels(
            frameData.data,
            pcmSamples,
            phaseState
        );

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
                "ArNet-Compressed-Photo",

            version:
                "1.0",

            originalWidth:
                sourceWidth,

            originalHeight:
                sourceHeight,

            scanWidth:
                ARNET_PHOTO_SCAN_WIDTH,

            scanHeight:
                ARNET_PHOTO_SCAN_HEIGHT,

            originalMimeType:
                photoBlob.type ||
                "application/octet-stream",

            originalSize:
                photoBlob.size,

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
 * Imports a compressed photo and prepares both:
 *
 * 1. Original compressed image for AMMEF storage.
 * 2. ABMTV tone waveform for monitoring and decoding.
 *
 * @param {File} file
 */
async function importCompressedPhoto(file) {
    if (!isSupportedPhotoFile(file)) {
        throw new Error(
            "Please select a PNG, JPEG, WebP, GIF, or BMP image."
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
        "PHOTO";

    boxTxState.style.background =
        "purple";

    txtStatus.textContent =
        `STATUS: Loading compressed image [${file.name}]...`;

    txtStatus.style.color =
        "magenta";

    /*
     * Preserve the original compressed image exactly.
     */
    lastOriginalPhotoBlob =
        file;

    lastOriginalPhotoType =
        file.type ||
        "application/octet-stream";

    lastOriginalPhotoName =
        file.name;

    const result =
        await encodeCompressedPhotoMonitor(
            file
        );

    lastPhotoMonitorAudioBlob =
        result.monitorAudioBlob;

    lastPhotoMetadata =
        result.metadata;

    /*
     * The still-frame tone track becomes the current
     * ABMTV monitor waveform.
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

    txtStatus.textContent =
        `STATUS: Image ready — original compressed file preserved, ` +
        `${result.metadata.scanWidth}×${result.metadata.scanHeight} ` +
        `ABMTV still frame encoded.`;

    txtStatus.style.color =
        "#00FF7F";
}

/**
 * Opens the preserved original image in a new window.
 */
function previewOriginalPhoto() {
    if (
        !(lastOriginalPhotoBlob instanceof Blob)
    ) {
        txtStatus.textContent =
            "ERROR: No original image has been loaded.";

        txtStatus.style.color =
            "#FF3333";

        return;
    }

    const url =
        URL.createObjectURL(
            lastOriginalPhotoBlob
        );

    const photoWindow =
        window.open(
            "",
            "_blank",
            "width=900,height=700"
        );

    if (!photoWindow) {
        URL.revokeObjectURL(url);

        txtStatus.textContent =
            "ERROR: The browser blocked the image preview window.";

        txtStatus.style.color =
            "#FF3333";

        return;
    }

    const safeTitle =
        (
            lastOriginalPhotoName ||
            "ArNet Photo"
        )
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");

    photoWindow.document.write(`
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

                main {
                    flex: 1;
                    min-height: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    overflow: auto;
                    padding: 12px;
                    box-sizing: border-box;
                }

                img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    image-rendering: auto;
                }
            </style>
        </head>

        <body>
            <header>${safeTitle}</header>

            <main>
                <img
                    src="${url}"
                    alt="${safeTitle}"
                >
            </main>
        </body>
        </html>
    `);

    photoWindow.document.close();

    photoWindow.addEventListener(
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
 * Opens a file picker for still images.
 */
function openCompressedPhotoPicker() {
    const fileInput =
        document.createElement(
            "input"
        );

    fileInput.type =
        "file";

    fileInput.accept =
        "image/png,image/jpeg,image/webp,image/gif,image/bmp," +
        ".png,.jpg,.jpeg,.webp,.gif,.bmp";

    fileInput.onchange =
        async event => {
            const file =
                event.target.files[0];

            if (!file) {
                return;
            }

            try {
                await importCompressedPhoto(
                    file
                );
            }
            catch (error) {
                console.error(
                    "Photo import error:",
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

