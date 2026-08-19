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

function fineTuneFrequency(
    delta
) {
    let current =
        Number.parseFloat(
            txtFrequency.value
        );

    if (
        !Number.isFinite(
            current
        )
    ) {
        current =
            minFreq;
    }

    let next =
        current +
        delta;

    const minimum =
        Number(
            minFreq
        );

    const maximum =
        Number(
            maxFreq
        ) +
        0.99;

    next =
        Math.max(
            minimum,
            Math.min(
                maximum,
                next
            )
        );

    next =
        Math.round(
            next *
            100
        ) /
        100;

    const sectorClamped =
    typeof clampFrequencyToArNetSector ===
        "function"
        ? clampFrequencyToArNetSector(
            next
        )
        : next;

if (
    Number.isFinite(
        sectorClamped
    )
) {
    next =
        sectorClamped;
}

    txtFrequency.value =
    next.toFixed(
        2
    );

    if (
        typeof stopAllIncomingArNetStreams ===
            "function"
    ) {
        stopAllIncomingArNetStreams();
    }

    if (
        typeof tuneNetworkFrequency ===
            "function"
    ) {
        tuneNetworkFrequency(
            next
        );
    }

    if (
        typeof updateNetworkRegistration ===
            "function"
    ) {
        updateNetworkRegistration();
    }

    if (
        typeof updateArNetWaterfallControls ===
            "function"
    ) {
        updateArNetWaterfallControls();
    }
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

function isFrequencyInsideArNetSector(
    frequency,
    sector = getNetworkChannelSector()
) {
    const numeric =
        Number.parseFloat(
            frequency
        );

    if (
        !Number.isFinite(
            numeric
        )
    ) {
        return false;
    }

    const decimal =
        numeric -
        Math.floor(
            numeric
        );

    const range =
        getArNetSectorRange(
            sector
        );

    return (
        decimal >=
            range.min &&
        decimal <=
            range.max
    );
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

    const waterfallControls =
        document.getElementById(
            "arnetWaterfallControls"
        );

    if (isScopeMode) {
        canvasScope.style.display =
            "block";

        imgWaterfall.style.display =
            "none";

        if (waterfallControls) {
            waterfallControls.style.display =
                "none";
        }

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

        if (waterfallControls) {
            waterfallControls.style.display =
                "flex";
        }

        lblScopeMode.textContent =
            "WATERFALL DISPLAY";

        btnToggleDisplay.textContent =
            "🔄 SWITCH TO SPECTRUM";

        if (
            typeof updateArNetWaterfallControls ===
                "function"
        ) {
            updateArNetWaterfallControls();
        }
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

   if (
    btnToggleDisplay
) {
    btnToggleDisplay.addEventListener(
        "click",
        toggleDisplayMode
    );
}

    sliderCarrier.addEventListener(
        "input",
        updateCarrierDisplay
    );

    //createExtendedMediaControls();

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

txtCallsign.addEventListener(
    "change",
    updateNetworkRegistration
);

txtCallsign.addEventListener(
    "blur",
    updateNetworkRegistration
);

    if (
    comboChannelSector
) {
    comboChannelSector.addEventListener(
        "change",
        () => {
            const currentFrequency =
                Number.parseFloat(
                    txtFrequency.value
                );

            const centeredFrequency =
                getArNetSectorCenterFrequency(
                    currentFrequency,
                    comboChannelSector.value
                );

            if (
                Number.isFinite(
                    centeredFrequency
                )
            ) {
                txtFrequency.value =
                    centeredFrequency.toFixed(
                        2
                    );

                if (
                    typeof tuneNetworkFrequency ===
                        "function"
                ) {
                    tuneNetworkFrequency(
                        centeredFrequency
                    );
                }
            }

            if (
                typeof updateNetworkRegistration ===
                    "function"
            ) {
                updateNetworkRegistration();
            }

            if (
                typeof updateArNetWaterfallControls ===
                    "function"
            ) {
                updateArNetWaterfallControls();
            }
        }
    );
}

    const btnToggleMorsePanel =
    document.getElementById(
        "btnToggleMorsePanel"
    );

const morseUtilityDrawer =
    document.getElementById(
        "morseUtilityDrawer"
    );

if (
    btnToggleMorsePanel &&
    morseUtilityDrawer
) {
    btnToggleMorsePanel.addEventListener(
        "click",
        () => {
            const isOpening =
                morseUtilityDrawer.hidden;

            morseUtilityDrawer.hidden =
                !isOpening;

            btnToggleMorsePanel
                .setAttribute(
                    "aria-expanded",
                    String(
                        isOpening
                    )
                );

            btnToggleMorsePanel.textContent =
                isOpening
                    ? "MORSE ▾"
                    : "MORSE ▸";
        }
    );
}

    const btnDashboardHelp =
    document.getElementById(
        "btnDashboardHelp"
    );

const btnCloseDashboardHelp =
    document.getElementById(
        "btnCloseDashboardHelp"
    );

const dashboardHelpOverlay =
    document.getElementById(
        "dashboardHelpOverlay"
    );

if (
    btnDashboardHelp &&
    dashboardHelpOverlay
) {
    btnDashboardHelp.addEventListener(
        "click",
        () => {
            dashboardHelpOverlay.style.display =
                "flex";
        }
    );
}

if (
    btnCloseDashboardHelp &&
    dashboardHelpOverlay
) {
    btnCloseDashboardHelp.addEventListener(
        "click",
        () => {
            dashboardHelpOverlay.style.display =
                "none";
        }
    );
}

/*
 * Clicking the dark area outside the guide
 * also closes it.
 */
if (dashboardHelpOverlay) {
    dashboardHelpOverlay.addEventListener(
        "click",
        event => {
            if (
                event.target ===
                dashboardHelpOverlay
            ) {
                dashboardHelpOverlay.style.display =
                    "none";
            }
        }
    );
}

    document.addEventListener(
    "keydown",
    event => {
        if (
            event.key === "Escape" &&
            dashboardHelpOverlay &&
            dashboardHelpOverlay.style.display ===
                "flex"
        ) {
            dashboardHelpOverlay.style.display =
                "none";
        }
    }
);

    const btnTuneDownBig =
    document.getElementById(
        "btnTuneDownBig"
    );

const btnTuneDownMedium =
    document.getElementById(
        "btnTuneDownMedium"
    );

const btnTuneDownSmall =
    document.getElementById(
        "btnTuneDownSmall"
    );

const btnTuneUpSmall =
    document.getElementById(
        "btnTuneUpSmall"
    );

const btnTuneUpMedium =
    document.getElementById(
        "btnTuneUpMedium"
    );

const btnTuneUpBig =
    document.getElementById(
        "btnTuneUpBig"
    );

if (btnTuneDownBig) {
    btnTuneDownBig.addEventListener(
        "click",
        () => {
            fineTuneFrequency(
                -1.00
            );
        }
    );
}

if (btnTuneDownMedium) {
    btnTuneDownMedium.addEventListener(
        "click",
        () => {
            fineTuneFrequency(
                -0.10
            );
        }
    );
}

if (btnTuneDownSmall) {
    btnTuneDownSmall.addEventListener(
        "click",
        () => {
            fineTuneFrequency(
                -0.01
            );
        }
    );
}

if (btnTuneUpSmall) {
    btnTuneUpSmall.addEventListener(
        "click",
        () => {
            fineTuneFrequency(
                0.01
            );
        }
    );
}

if (btnTuneUpMedium) {
    btnTuneUpMedium.addEventListener(
        "click",
        () => {
            fineTuneFrequency(
                0.10
            );
        }
    );
}

if (btnTuneUpBig) {
    btnTuneUpBig.addEventListener(
        "click",
        () => {
            fineTuneFrequency(
                1.00
            );
        }
    );
}
    
txtCallsign.addEventListener(
    "keydown",
    event => {
        if (event.key === "Enter") {
            event.preventDefault();
            updateNetworkRegistration();
            txtCallsign.blur();
        }
    }
);
    
}
