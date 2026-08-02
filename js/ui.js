// ======================================================
// ArNet Transceiver
// User Interface Controls
// ======================================================

let btnPlayCleanAMMEF = null;
let btnPlayRawAMMEF = null;
let btnPlayTelemetryAMMEF = null;

let btnPlayVideoMonitor = null;
let btnPlayPhotoMonitor = null;

let btnPreviewVideo = null;
let btnPreviewPhoto = null;

// ======================================================
// Shared UI helpers
// ======================================================

function setStatus(
    message,
    color = "#888888"
) {
    txtStatus.textContent =
        message.startsWith("STATUS:") ||
        message.startsWith("ERROR:")
            ? message
            : `STATUS: ${message}`;

    txtStatus.style.color =
        color;
}

function setButtonEnabled(
    button,
    enabled
) {
    if (!button) {
        return;
    }

    button.disabled =
        !enabled;

    button.style.opacity =
        enabled
            ? "1"
            : "0.5";

    button.style.cursor =
        enabled
            ? "pointer"
            : "not-allowed";
}

function createActionButton(
    id,
    text,
    background
) {
    const button =
        document.createElement(
            "button"
        );

    button.id =
        id;

    button.type =
        "button";

    button.textContent =
        text;

    button.style.minHeight =
        "30px";

    button.style.background =
        background;

    button.style.color =
        "white";

    button.style.fontWeight =
        "bold";

    button.style.fontSize =
        "9px";

    button.style.cursor =
        "pointer";

    button.style.opacity =
        "0.5";

    button.disabled =
        true;

    return button;
}

// ======================================================
// Additional AMMEF/media controls
// ======================================================

function createExtendedMediaControls() {
    const bottomGrid =
        document.querySelector(
            ".bottom-grid"
        );

    if (!bottomGrid) {
        console.warn(
            "Could not find .bottom-grid."
        );

        return;
    }

    if (
        document.getElementById(
            "extendedMediaControls"
        )
    ) {
        return;
    }

    const section =
        document.createElement(
            "div"
        );

    section.id =
        "extendedMediaControls";

    section.className =
        "border-box";

    section.style.display =
        "grid";

    section.style.gridTemplateColumns =
        "repeat(4, minmax(0, 1fr))";

    section.style.gap =
        "4px";

    section.style.padding =
        "5px";

    section.style.minHeight =
        "68px";

    btnPlayCleanAMMEF =
        createActionButton(
            "btnPlayCleanAMMEF",
            "🔊 CLEAN AUDIO",
            "#164422"
        );

    btnPlayRawAMMEF =
        createActionButton(
            "btnPlayRawAMMEF",
            "📡 FM MONITOR",
            "#665500"
        );

    btnPlayTelemetryAMMEF =
        createActionButton(
            "btnPlayTelemetryAMMEF",
            "📊 TELEMETRY",
            "#663366"
        );

    btnPlayVideoMonitor =
        createActionButton(
            "btnPlayVideoMonitor",
            "📺 VIDEO TONES",
            "#552255"
        );

    btnPlayPhotoMonitor =
        createActionButton(
            "btnPlayPhotoMonitor",
            "🖼 PHOTO TONES",
            "#552255"
        );

    btnPreviewVideo =
        createActionButton(
            "btnPreviewVideo",
            "▶ ORIGINAL VIDEO",
            "#224466"
        );

    btnPreviewPhoto =
        createActionButton(
            "btnPreviewPhoto",
            "🔍 ORIGINAL PHOTO",
            "#224466"
        );

    const btnClearMedia =
        createActionButton(
            "btnClearMedia",
            "🧹 CLEAR MEDIA",
            "#442222"
        );

    setButtonEnabled(
        btnClearMedia,
        true
    );

    section.append(
        btnPlayCleanAMMEF,
        btnPlayRawAMMEF,
        btnPlayTelemetryAMMEF,
        btnPlayVideoMonitor,
        btnPlayPhotoMonitor,
        btnPreviewVideo,
        btnPreviewPhoto,
        btnClearMedia
    );

    /*
     * Insert the extra controls between the main file
     * controls and the status bar.
     */
    const statusBox =
        txtStatus.closest(
            ".border-box"
        );

    if (
        statusBox &&
        statusBox.parentElement ===
            bottomGrid
    ) {
        bottomGrid.insertBefore(
            section,
            statusBox
        );
    }
    else {
        bottomGrid.appendChild(
            section
        );
    }

    btnPlayCleanAMMEF.addEventListener(
        "click",
        async () => {
            try {
                await playLoadedAMMEFCleanTrack();
            }
            catch (error) {
                console.error(
                    "Clean-track playback failed:",
                    error
                );
            }
        }
    );

    btnPlayRawAMMEF.addEventListener(
        "click",
        async () => {
            try {
                await playLoadedAMMEFRawTrack();
            }
            catch (error) {
                console.error(
                    "FM-monitor playback failed:",
                    error
                );
            }
        }
    );

    btnPlayTelemetryAMMEF.addEventListener(
        "click",
        async () => {
            try {
                await playLoadedAMMEFTelemetryTrack();
            }
            catch (error) {
                console.error(
                    "Telemetry playback failed:",
                    error
                );
            }
        }
    );

    btnPlayVideoMonitor.addEventListener(
        "click",
        async () => {
            try {
                await playLoadedAMMEFVideoMonitorTrack();
            }
            catch (error) {
                console.error(
                    "Video-monitor playback failed:",
                    error
                );
            }
        }
    );

    btnPlayPhotoMonitor.addEventListener(
        "click",
        async () => {
            try {
                await playLoadedAMMEFPhotoMonitorTrack();
            }
            catch (error) {
                console.error(
                    "Photo-monitor playback failed:",
                    error
                );
            }
        }
    );

    btnPreviewVideo.addEventListener(
        "click",
        () => {
            /*
             * Use the AMMEF-specific wrapper if the media
             * came from an AMMEF file. Otherwise preview
             * the most recently imported original video.
             */
            if (
                lastLoadedAMMEFVideoBlob
                instanceof Blob
            ) {
                previewLoadedAMMEFVideo();
            }
            else {
                previewOriginalVideo();
            }
        }
    );

    btnPreviewPhoto.addEventListener(
        "click",
        () => {
            if (
                lastLoadedAMMEFPhotoBlob
                instanceof Blob
            ) {
                previewLoadedAMMEFPhoto();
            }
            else {
                previewOriginalPhoto();
            }
        }
    );

    btnClearMedia.addEventListener(
        "click",
        clearCurrentMedia
    );

    refreshMediaActionButtons();
}

function refreshMediaActionButtons() {
    setButtonEnabled(
        btnPlayCleanAMMEF,
        lastLoadedAMMEFCleanBlob
            instanceof Blob
    );

    setButtonEnabled(
        btnPlayRawAMMEF,
        lastLoadedAMMEFMonitorBlob
            instanceof Blob
    );

    setButtonEnabled(
        btnPlayTelemetryAMMEF,
        lastLoadedAMMEFTelemetryBlob
            instanceof Blob
    );

    setButtonEnabled(
        btnPlayVideoMonitor,
        lastLoadedAMMEFVideoMonitorBlob
            instanceof Blob
    );

    setButtonEnabled(
        btnPlayPhotoMonitor,
        lastLoadedAMMEFPhotoMonitorBlob
            instanceof Blob
    );

    setButtonEnabled(
        btnPreviewVideo,
        (
            lastLoadedAMMEFVideoBlob
            instanceof Blob
        ) ||
        (
            lastOriginalVideoBlob
            instanceof Blob
        )
    );

    setButtonEnabled(
        btnPreviewPhoto,
        (
            lastLoadedAMMEFPhotoBlob
            instanceof Blob
        ) ||
        (
            lastOriginalPhotoBlob
            instanceof Blob
        )
    );
}

// ======================================================
// Media-state cleanup
// ======================================================

function clearCurrentMedia() {
    lastProcessedAudioBlob =
        null;

    lastCleanAudioBlob =
        null;

    lastModulatedAudioBlob =
        null;

    lastTelemetryAudioBlob =
        null;

    lastAudioPcmArray =
        null;

    lastOriginalVideoBlob =
        null;

    lastOriginalVideoName =
        null;

    lastOriginalVideoType =
        null;

    lastVideoMonitorAudioBlob =
        null;

    lastVideoMetadata =
        null;

    lastOriginalPhotoBlob =
        null;

    lastOriginalPhotoName =
        null;

    lastOriginalPhotoType =
        null;

    lastPhotoMonitorAudioBlob =
        null;

    lastPhotoMetadata =
        null;

    lastLoadedAMMEFMetadata =
        null;

    lastLoadedAMMEFCleanBlob =
        null;

    lastLoadedAMMEFMonitorBlob =
        null;

    lastLoadedAMMEFTelemetryBlob =
        null;

    lastLoadedAMMEFVideoMonitorBlob =
        null;

    lastLoadedAMMEFPhotoMonitorBlob =
        null;

    lastLoadedAMMEFVideoBlob =
        null;

    lastLoadedAMMEFVideoName =
        null;

    lastLoadedAMMEFVideoType =
        null;

    lastLoadedAMMEFPhotoBlob =
        null;

    lastLoadedAMMEFPhotoName =
        null;

    lastLoadedAMMEFPhotoType =
        null;

    lastAMMEFData =
        null;

    isPlaying =
        false;

    currentAmplitude =
        0.02;

    setButtonEnabled(
        btnSave,
        false
    );

    refreshMediaActionButtons();

    returnToReceiveMode();

    setStatus(
        "STATUS: Media buffers cleared.",
        "#AAAAAA"
    );
}

// ======================================================
// WAV import
// ======================================================

function openWavPicker() {
    const fileInput =
        document.createElement(
            "input"
        );

    fileInput.type =
        "file";

    fileInput.accept =
        ".wav,audio/wav";

    fileInput.onchange =
        async event => {
            const file =
                event.target.files[0];

            if (!file) {
                return;
            }

            try {
                await decodeWavFile(
                    file
                );
            }
            catch (error) {
                console.error(
                    "WAV import failed:",
                    error
                );
            }
        };

    fileInput.click();
}

// ======================================================
// AMMEF import
// ======================================================

function openAMMEFPicker() {
    const fileInput =
        document.createElement(
            "input"
        );

    fileInput.type =
        "file";

    fileInput.accept =
        ".ammef,application/x-ammef";

    fileInput.onchange =
        async event => {
            const file =
                event.target.files[0];

            if (!file) {
                return;
            }

            try {
                await loadAMMEF(
                    file
                );

                refreshMediaActionButtons();
            }
            catch (error) {
                console.error(
                    "AMMEF import failed:",
                    error
                );
            }
        };

    fileInput.click();
}

// ======================================================
// Combined photo/video import
// ======================================================

function openMediaPicker() {
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
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/gif",
            "image/bmp",
            ".mp4",
            ".m4v",
            ".webm",
            ".mov",
            ".png",
            ".jpg",
            ".jpeg",
            ".webp",
            ".gif",
            ".bmp"
        ].join(",");

    fileInput.onchange =
        async event => {
            const file =
                event.target.files[0];

            if (!file) {
                return;
            }

            try {
                if (
                    file.type.startsWith(
                        "video/"
                    ) ||
                    /\.(mp4|m4v|webm|mov)$/i.test(
                        file.name
                    )
                ) {
                    await importCompressedVideo(
                        file
                    );
                }
                else if (
                    file.type.startsWith(
                        "image/"
                    ) ||
                    /\.(png|jpe?g|webp|gif|bmp)$/i.test(
                        file.name
                    )
                ) {
                    await importCompressedPhoto(
                        file
                    );
                }
                else {
                    throw new Error(
                        "The selected file is not a supported photo or video."
                    );
                }

                refreshMediaActionButtons();
            }
            catch (error) {
                console.error(
                    "Media import failed:",
                    error
                );

                setStatus(
                    `ERROR: ${error.message}`,
                    "#FF3333"
                );

                returnToReceiveMode();
            }
        };

    fileInput.click();
}

// ======================================================
// Scope/waterfall controls
// ======================================================

function toggleDisplayMode() {
    isScopeMode =
        !isScopeMode;

    if (isScopeMode) {
        canvasScope.style.display =
            "block";

        imgWaterfall.style.display =
            "none";

        lblScopeMode.textContent =
            "SPECTRUM SCOPE";

        btnToggleDisplay.textContent =
            "🔄 SWITCH TO WATERFALL";
    }
    else {
        canvasScope.style.display =
            "none";

        imgWaterfall.style.display =
            "block";

        lblScopeMode.textContent =
            "WATERFALL DISPLAY";

        btnToggleDisplay.textContent =
            "🔄 SWITCH TO SPECTRUM";
    }
}

function updateCarrierDisplay() {
    const carrierValue =
        Number.parseFloat(
            sliderCarrier.value
        ) || 0;

    const percentage =
        Math.round(
            (
                carrierValue /
                0.5
            ) * 100
        );

    txtCarrierVal.textContent =
        `${percentage}%`;
}

// ======================================================
// Save handling
// ======================================================

async function handleSaveAMMEF() {
    try {
        await saveAMMEFFile();
    }
    catch (error) {
        console.error(
            "AMMEF save button failed:",
            error
        );
    }
}

// ======================================================
// Primary listener setup
// ======================================================

function initializeUIControls() {
    btnLoad.addEventListener(
        "click",
        openWavPicker
    );

    btnLoadAMMEF.addEventListener(
        "click",
        openAMMEFPicker
    );

    btnSave.addEventListener(
        "click",
        handleSaveAMMEF
    );

    /*
     * The existing LOAD VIDEO / IMAGE button now handles
     * both compressed moving video and still photos.
     */
    btnLoadVideo.addEventListener(
        "click",
        openMediaPicker
    );

    btnToggleDisplay.addEventListener(
        "click",
        toggleDisplayMode
    );

    sliderCarrier.addEventListener(
        "input",
        updateCarrierDisplay
    );

    createExtendedMediaControls();

    updateCarrierDisplay();

    refreshMediaActionButtons();

    txtCallsign.addEventListener(
    "change",
    updateNetworkRegistration
);

txtCallsign.addEventListener(
    "blur",
    updateNetworkRegistration
);
    
}
