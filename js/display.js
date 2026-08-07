// ======================================================
// ArNet Transceiver
// Meter, Spectrum, and Waterfall Display
// ======================================================

const ARNET_WATERFALL_BAND_RANGES = {
    "UBA 2": {
        min: 1800,
        max: 3049
    },

    "ALFRS": {
        min: 3055,
        max: 4455
    },

    "SOLIDBAND": {
        min: 4550,
        max: 6000
    },

    "AHFRS 1 (LOW)": {
        min: 6500,
        max: 7499
    },

    "AHFRS 1 (HIGH)": {
        min: 7500,
        max: 7999
    },

    "AHFRS 2": {
        min: 8000,
        max: 8300
    },

    "ATF 1": {
        min: 8340,
        max: 9120
    }
};

const ARNET_WATERFALL_ZOOM_LEVELS = [
    1,
    2,
    4,
    8,
    16
];

let arnetWaterfallZoomLevel =
    1;

let arnetWaterfallHoverFrequency =
    null;

let arnetWaterfallControlsInitialized =
    false;

function getCurrentFullWaterfallBandRange() {
    const bandName =
        String(
            comboBand?.value ||
            ""
        )
            .trim()
            .toUpperCase();

    const configuredRange =
        ARNET_WATERFALL_BAND_RANGES[
            bandName
        ];

    if (configuredRange) {
        return configuredRange;
    }

    const frequency =
        Number.parseInt(
            txtFrequency?.value,
            10
        ) ||
        0;

    return {
        min:
            Math.max(
                0,
                frequency -
                    100
            ),

        max:
            frequency +
                100
    };
}

function getCurrentWaterfallBandRange() {
    const fullRange =
        getCurrentFullWaterfallBandRange();

    if (
        arnetWaterfallZoomLevel <=
        1
    ) {
        return {
            min:
                fullRange.min,

            max:
                fullRange.max
        };
    }

    const tunedFrequency =
        Number.parseFloat(
            txtFrequency?.value
        );

    const centerFrequency =
        Number.isFinite(
            tunedFrequency
        )
            ? tunedFrequency
            : (
                fullRange.min +
                fullRange.max
            ) /
                2;

    const fullSpan =
        fullRange.max -
        fullRange.min;

    const visibleSpan =
        fullSpan /
        arnetWaterfallZoomLevel;

    let minimum =
        centerFrequency -
        visibleSpan /
            2;

    let maximum =
        centerFrequency +
        visibleSpan /
            2;

    /*
     * Keep the zoomed display inside the band.
     */
    if (
        minimum <
        fullRange.min
    ) {
        maximum +=
            fullRange.min -
            minimum;

        minimum =
            fullRange.min;
    }

    if (
        maximum >
        fullRange.max
    ) {
        minimum -=
            maximum -
            fullRange.max;

        maximum =
            fullRange.max;
    }

    return {
        min:
            Math.max(
                fullRange.min,
                minimum
            ),

        max:
            Math.min(
                fullRange.max,
                maximum
            )
    };
}

function frequencyToWaterfallX(
    frequency,
    width
) {
    const range =
        getCurrentWaterfallBandRange();

    const span =
        range.max -
        range.min;

    if (
        !Number.isFinite(
            frequency
        ) ||
        span <= 0
    ) {
        return width /
            2;
    }

    const normalized =
        (
            frequency -
            range.min
        ) /
        span;

    return Math.max(
        0,
        Math.min(
            width -
                1,
            normalized *
                (
                    width -
                    1
                )
        )
    );
}

function waterfallVtWidthToPixels(
    bandwidthVt,
    canvasWidth = wfWidth
) {
    const range =
        getCurrentWaterfallBandRange();

    const visibleSpan =
        range.max -
        range.min;

    if (
        visibleSpan <= 0 ||
        canvasWidth <= 0
    ) {
        return 0.65;
    }

    const width =
        (
            Math.max(
                0.5,
                Number(
                    bandwidthVt
                ) ||
                1
            ) /
            visibleSpan
        ) *
        canvasWidth;

    /*
     * Keep narrow signals visible without turning them
     * into giant blocks.
     */
    return Math.max(
        0.65,
        Math.min(
            12,
            width
        )
    );
}

function isFrequencyInsideWaterfallBand(
    frequency
) {
    const range =
        getCurrentWaterfallBandRange();

    return (
        Number.isFinite(
            frequency
        ) &&
        frequency >=
            range.min &&
        frequency <=
            range.max
    );
}

function initializeArNetWaterfallControls() {
    if (
        arnetWaterfallControlsInitialized
    ) {
        return;
    }

    const zoomInButton =
        document.getElementById(
            "btnWaterfallZoomIn"
        );

    const zoomOutButton =
        document.getElementById(
            "btnWaterfallZoomOut"
        );

    const fullBandButton =
        document.getElementById(
            "btnWaterfallFullBand"
        );

    const hoverText =
        document.getElementById(
            "txtWaterfallHoverFrequency"
        );

    if (zoomInButton) {
        zoomInButton.addEventListener(
            "click",
            () => {
                changeArNetWaterfallZoom(
                    1
                );
            }
        );
    }

    if (zoomOutButton) {
        zoomOutButton.addEventListener(
            "click",
            () => {
                changeArNetWaterfallZoom(
                    -1
                );
            }
        );
    }

    if (fullBandButton) {
        fullBandButton.addEventListener(
            "click",
            resetArNetWaterfallZoom
        );
    }

    if (imgWaterfall) {
        imgWaterfall.style.cursor =
            "crosshair";

        imgWaterfall.addEventListener(
            "mousemove",
            event => {
                const rectangle =
                    imgWaterfall
                        .getBoundingClientRect();

                const x =
                    event.clientX -
                    rectangle.left;

                arnetWaterfallHoverFrequency =
                    waterfallXToFrequency(
                        x,
                        rectangle.width
                    );

                if (hoverText) {
                    hoverText.textContent =
                        `${arnetWaterfallHoverFrequency} Vt`;
                }
            }
        );

        imgWaterfall.addEventListener(
            "mouseleave",
            () => {
                arnetWaterfallHoverFrequency =
                    null;

                if (hoverText) {
                    hoverText.textContent =
                        "-- Vt";
                }
            }
        );

        imgWaterfall.addEventListener(
            "click",
            event => {
                const rectangle =
                    imgWaterfall
                        .getBoundingClientRect();

                const x =
                    event.clientX -
                    rectangle.left;

                const frequency =
                    waterfallXToFrequency(
                        x,
                        rectangle.width
                    );

                txtFrequency.value =
                    frequency;

                txtFrequency.dispatchEvent(
                    new Event(
                        "input",
                        {
                            bubbles:
                                true
                        }
                    )
                );

                txtFrequency.dispatchEvent(
                    new Event(
                        "change",
                        {
                            bubbles:
                                true
                        }
                    )
                );

                if (
                    typeof updateNetworkRegistration ===
                        "function"
                ) {
                    updateNetworkRegistration();
                }

                updateArNetWaterfallControls();

                console.log(
                    `[ArNet Waterfall] Tuned to ${frequency} Vt.`
                );
            }
        );
    }

    if (comboBand) {
        comboBand.addEventListener(
            "change",
            () => {
                resetArNetWaterfallZoom();
            }
        );
    }

    arnetWaterfallControlsInitialized =
        true;

    updateArNetWaterfallControls();
}

function getNetworkSignalIntensity(
    signal,
    x,
    signalX
) {
    const kind =
        String(
            signal.transmissionKind ||
            "audio"
        )
            .trim()
            .toLowerCase();

    const baseStrength =
        Math.max(
            0,
            Math.min(
                1,
                Number(
                    signal.strength
                ) ||
                0.5
            )
        );

    /*
     * Width values below are virtual bandwidth in Vt,
     * not raw pixels.
     */
    let bandwidthVt;

    switch (kind) {
        case "morse":
            bandwidthVt =
                1.5;
            break;

        case "ident":
            bandwidthVt =
                2;
            break;

        case "voice":
            bandwidthVt =
                3;
            break;

        case "audio":
        case "audio-stream":
        case "stream":
            bandwidthVt =
                4;
            break;

        case "music":
            bandwidthVt =
                6;
            break;

        case "photo":
            bandwidthVt =
                8;
            break;

        case "video":
            bandwidthVt =
                12;
            break;

        default:
            bandwidthVt =
                Math.max(
                    2,
                    Number(
                        signal.width
                    ) ||
                    3
                );
            break;
    }

    const widthPixels =
        waterfallVtWidthToPixels(
            bandwidthVt
        );

    const distance =
        Math.abs(
            x -
            signalX
        );

    if (
        distance >
        widthPixels
    ) {
        return 0;
    }

    let modulation =
        1;

    switch (kind) {
        case "morse":
            modulation =
                Math.random() >
                    0.42
                    ? 1
                    : 0.08;
            break;

        case "voice":
        case "audio":
        case "audio-stream":
        case "stream":
            modulation =
                0.48 +
                Math.random() *
                    0.52;
            break;

        case "music":
            modulation =
                0.74 +
                Math.random() *
                    0.26;
            break;

        case "photo":
            modulation =
                (
                    Math.floor(
                        Date.now() /
                        140
                    ) %
                    2
                )
                    ? 0.9
                    : 0.45;
            break;

        case "video":
            modulation =
                0.78 +
                Math.sin(
                    Date.now() /
                        70 +
                    x *
                        0.7
                ) *
                    0.14;
            break;

        default:
            modulation =
                0.6 +
                Math.random() *
                    0.4;
            break;
    }

    const shape =
        Math.cos(
            (
                distance /
                widthPixels
            ) *
            (
                Math.PI /
                2
            )
        );

    return (
        baseStrength *
        modulation *
        shape
    );
}

function changeArNetWaterfallZoom(
    direction
) {
    const currentIndex =
        ARNET_WATERFALL_ZOOM_LEVELS
            .indexOf(
                arnetWaterfallZoomLevel
            );

    const safeCurrentIndex =
        currentIndex >= 0
            ? currentIndex
            : 0;

    const nextIndex =
        Math.max(
            0,
            Math.min(
                ARNET_WATERFALL_ZOOM_LEVELS
                    .length -
                    1,
                safeCurrentIndex +
                    direction
            )
        );

    arnetWaterfallZoomLevel =
        ARNET_WATERFALL_ZOOM_LEVELS[
            nextIndex
        ];

    updateArNetWaterfallControls();
}

function resetArNetWaterfallZoom() {
    arnetWaterfallZoomLevel =
        1;

    updateArNetWaterfallControls();
}

function updateArNetWaterfallControls() {
    const zoomText =
        document.getElementById(
            "txtWaterfallZoom"
        );

    const rangeText =
        document.getElementById(
            "txtWaterfallVisibleRange"
        );

    if (zoomText) {
        zoomText.textContent =
            `${arnetWaterfallZoomLevel}×`;
    }

    if (rangeText) {
        const range =
            getCurrentWaterfallBandRange();

        rangeText.textContent =
            `${Math.round(range.min)}–` +
            `${Math.round(range.max)} Vt`;
    }
}

function waterfallXToFrequency(
    x,
    canvasWidth
) {
    const range =
        getCurrentWaterfallBandRange();

    const safeWidth =
        Math.max(
            1,
            canvasWidth
        );

    const normalized =
        Math.max(
            0,
            Math.min(
                1,
                x /
                    safeWidth
            )
        );

    return Math.round(
        range.min +
        normalized *
            (
                range.max -
                range.min
            )
    );
}

function chooseArNetWaterfallTickSpacing(
    visibleSpan
) {
    const spacings = [
        1,
        2,
        5,
        10,
        20,
        25,
        50,
        100,
        200,
        250,
        500,
        1000
    ];

    for (
        const spacing of
        spacings
    ) {
        if (
            visibleSpan /
                spacing <=
            7
        ) {
            return spacing;
        }
    }

    return 1000;
}

function drawArNetWaterfallFrequencyScale() {
    const range =
        getCurrentWaterfallBandRange();

    const visibleSpan =
        range.max -
        range.min;

    const spacing =
        chooseArNetWaterfallTickSpacing(
            visibleSpan
        );

    const firstFrequency =
        Math.ceil(
            range.min /
            spacing
        ) *
        spacing;

    wfCtx.save();

    wfCtx.font =
        "8px Consolas";

    wfCtx.textAlign =
        "center";

    wfCtx.textBaseline =
        "top";

    for (
        let frequency =
            firstFrequency;
        frequency <=
            range.max;
        frequency +=
            spacing
    ) {
        const x =
            frequencyToWaterfallX(
                frequency,
                imgWaterfall.width
            );

        wfCtx.strokeStyle =
            "rgba(120, 200, 255, 0.32)";

        wfCtx.lineWidth =
            1;

        wfCtx.beginPath();

        wfCtx.moveTo(
            x,
            0
        );

        wfCtx.lineTo(
            x,
            7
        );

        wfCtx.stroke();

        wfCtx.fillStyle =
            "rgba(180, 225, 255, 0.9)";

        wfCtx.fillText(
            String(
                Math.round(
                    frequency
                )
            ),
            x,
            8
        );
    }

    wfCtx.restore();
}

function drawArNetWaterfallTunedMarker() {
    const tunedFrequency =
        Number.parseFloat(
            txtFrequency?.value
        );

    if (
        !Number.isFinite(
            tunedFrequency
        )
    ) {
        return;
    }

    const range =
        getCurrentWaterfallBandRange();

    if (
        tunedFrequency <
            range.min ||
        tunedFrequency >
            range.max
    ) {
        return;
    }

    const x =
        frequencyToWaterfallX(
            tunedFrequency,
            imgWaterfall.width
        );

    wfCtx.save();

    wfCtx.strokeStyle =
        "#00FFFF";

    wfCtx.lineWidth =
        1;

    wfCtx.beginPath();

    wfCtx.moveTo(
        x,
        0
    );

    wfCtx.lineTo(
        x,
        imgWaterfall.height
    );

    wfCtx.stroke();

    const label =
        `${Math.round(tunedFrequency)} Vt`;

    wfCtx.font =
        "bold 9px Consolas";

    const labelWidth =
        wfCtx.measureText(
            label
        ).width +
        8;

    const labelX =
        Math.max(
            0,
            Math.min(
                imgWaterfall.width -
                    labelWidth,
                x -
                    labelWidth /
                        2
            )
        );

    wfCtx.fillStyle =
        "rgba(0, 18, 24, 0.9)";

    wfCtx.fillRect(
        labelX,
        imgWaterfall.height -
            15,
        labelWidth,
        14
    );

    wfCtx.fillStyle =
        "#00FFFF";

    wfCtx.textAlign =
        "center";

    wfCtx.textBaseline =
        "middle";

    wfCtx.fillText(
        label,
        labelX +
            labelWidth /
                2,
        imgWaterfall.height -
            8
    );

    wfCtx.restore();
}

/**
 * Calculates the RMS level of the current PCM playback
 * around a specific elapsed time.
 *
 * @param {number} elapsedSeconds
 * @param {number} windowSize
 * @returns {number}
 */
function getPcmRms(
    elapsedSeconds,
    windowSize
) {
    if (
        !lastAudioPcmArray ||
        lastAudioPcmArray.length === 0
    ) {
        return 0.02;
    }

    const sampleRate =
    typeof ARNET_SAMPLE_RATE === "number"
        ? ARNET_SAMPLE_RATE
        : 22050;

    const currentSampleIndex =
        Math.floor(
            elapsedSeconds *
            sampleRate
        );

    if (
        currentSampleIndex < 0 ||
        currentSampleIndex >=
            lastAudioPcmArray.length
    ) {
        return 0.02;
    }

    let sumSquared = 0;
    let count = 0;

    for (
        let offset = 0;
        offset < windowSize;
        offset += 2
    ) {
        const sampleIndex =
            currentSampleIndex +
            offset;

        if (
            sampleIndex <
            lastAudioPcmArray.length
        ) {
            const sample =
                lastAudioPcmArray[
                    sampleIndex
                ];

            const normalized =
                sample / 32768;

            sumSquared +=
                normalized *
                normalized;

            count++;
        }
    }

    if (count === 0) {
        return 0.02;
    }

    const rms =
        Math.sqrt(
            sumSquared /
            count
        );

    if (rms <= 0.02) {
        return 0.02;
    }

    return Math.min(
        1,
        rms * 3.8
    );
}

/**
 * Returns the amplitude currently shown by the radio.
 *
 * During recording, a simulated carrier level is used.
 * During playback, the level comes from the PCM waveform.
 *
 * @returns {number}
 */
function getCurrentAudioAmplitude() {
    if (
        typeof getIncomingArNetStreamAmplitude ===
            "function"
    ) {
        const streamAmplitude =
            getIncomingArNetStreamAmplitude();

        if (
            streamAmplitude >
            0.005
        ) {
            return streamAmplitude;
        }
    }

    if (
        serviceAudioAmplitude >
        0
    ) {
        return serviceAudioAmplitude;
    

    // Existing recording/playback logic continues...
}
    if (isRecording) {
        const carrierValue =
            Number.parseFloat(
                sliderCarrier.value
            ) || 0;

        const steadyCarrier =
            0.4 +
            (carrierValue * 0.8);

        const jitter =
            (
                Math.random() -
                0.5
            ) * 0.02;

        return Math.min(
            0.95,
            Math.max(
                0.2,
                steadyCarrier +
                jitter
            )
        );
    }

    if (
        isPlaying &&
        lastAudioPcmArray &&
        lastAudioPcmArray.length > 0
    ) {
        const elapsedSeconds =
            (
                Date.now() -
                playbackStartTime
            ) / 1000;

        return getPcmRms(
            elapsedSeconds,
            200
        );
    }

    return 0.02;
}

/**
 * Draws the analog-style S-meter.
 *
 * @param {number} amplitude
 */
function drawSignalMeter(amplitude) {
    meterCtx.clearRect(
        0,
        0,
        canvasMeter.width,
        canvasMeter.height
    );

    // Meter arc
    meterCtx.strokeStyle =
        "#666666";

    meterCtx.lineWidth = 2;

    meterCtx.beginPath();

    meterCtx.arc(
        100,
        85,
        70,
        Math.PI + 0.3,
        (Math.PI * 2) - 0.3
    );

    meterCtx.stroke();

    // High-signal red section
    meterCtx.strokeStyle =
        "#FF3333";

    meterCtx.lineWidth = 3;

    meterCtx.beginPath();

    meterCtx.arc(
        100,
        85,
        70,
        -0.7,
        0
    );

    meterCtx.stroke();

    // Scale labels
    meterCtx.fillStyle =
        "#AAAAAA";

    meterCtx.font =
        "8px Consolas";

    meterCtx.fillText(
        "S1",
        22,
        55
    );

    meterCtx.fillText(
        "3",
        45,
        30
    );

    meterCtx.fillText(
        "5",
        72,
        16
    );

    meterCtx.fillText(
        "7",
        102,
        10
    );

    meterCtx.fillText(
        "9",
        130,
        16
    );

    meterCtx.fillStyle =
        "#FF5555";

    meterCtx.fillText(
        "+20",
        150,
        30
    );

    meterCtx.fillText(
        "+60",
        168,
        55
    );

    meterCtx.fillStyle =
        "#00FFCC";

    meterCtx.font =
        "bold 9px Consolas";

    meterCtx.fillText(
        "S-METER",
        78,
        42
    );

    meterCtx.fillStyle =
        "#3399FF";

    meterCtx.fillText(
        "Decibels",
        87,
        56
    );

    // Center pivot
    meterCtx.fillStyle =
        "#444444";

    meterCtx.strokeStyle =
        "#AAAAAA";

    meterCtx.beginPath();

    meterCtx.arc(
        100,
        85,
        5,
        0,
        Math.PI * 2
    );

    meterCtx.fill();
    meterCtx.stroke();

    // Needle
    const angleDegrees =
        150 -
        (
            Math.min(
                1,
                amplitude
            ) * 120
        );

    const angleRadians =
        (
            angleDegrees *
            Math.PI
        ) / 180;

    const radius = 65;

    const needleX =
        100 +
        (
            radius *
            Math.cos(
                angleRadians
            )
        );

    const needleY =
        85 -
        (
            radius *
            Math.sin(
                angleRadians
            )
        );

    meterCtx.strokeStyle =
        "#55FF55";

    meterCtx.lineWidth = 2;

    meterCtx.beginPath();

    meterCtx.moveTo(
        100,
        85
    );

    meterCtx.lineTo(
        needleX,
        needleY
    );

    meterCtx.stroke();
}

/**
 * Resizes the scope canvas to its CSS display size.
 */
function resizeScopeCanvas() {
    const width =
        Math.max(
            1,
            Math.floor(
                canvasScope.clientWidth ||
                640
            )
        );

    const height =
        Math.max(
            1,
            Math.floor(
                canvasScope.clientHeight ||
                140
            )
        );

    if (
        canvasScope.width !== width
    ) {
        canvasScope.width =
            width;
    }

    if (
        canvasScope.height !== height
    ) {
        canvasScope.height =
            height;
    }
}

/**
 * Draws the simulated spectrum scope.
 *
 * @param {number} amplitude
 * @param {boolean} isTransmitting
 * @param {boolean} isAbmtvMode
 */
function drawSpectrumScope(
    amplitude,
    isTransmitting,
    isAbmtvMode
) {
    resizeScopeCanvas();

    const width =
        canvasScope.width;

    const height =
        canvasScope.height;

    scopeCtx.clearRect(
        0,
        0,
        width,
        height
    );

    // Vertical reference lines
    scopeCtx.strokeStyle =
        "#005577";

    scopeCtx.lineWidth = 1;

    scopeCtx.setLineDash(
        [2, 2]
    );

    const guidePositions = [
        width * 0.25,
        width * 0.5,
        width * 0.75
    ];

    for (
        const position of
        guidePositions
    ) {
        scopeCtx.beginPath();

        scopeCtx.moveTo(
            position,
            0
        );

        scopeCtx.lineTo(
            position,
            height
        );

        scopeCtx.stroke();
    }

    scopeCtx.setLineDash([]);

    scopeCtx.strokeStyle =
        "#FFFF00";

    scopeCtx.fillStyle =
        "rgba(34, 255, 255, 0.13)";

    scopeCtx.lineWidth = 1.5;

    scopeCtx.beginPath();

    scopeCtx.moveTo(
        0,
        height
    );

    const carrierX =
        width * 0.25;

    const audioX =
        width * 0.5;

    const videoX =
        width * 0.75;

    for (
        let x = 0;
        x < width;
        x += 4
    ) {
        const noise =
            Math.random() * 3;

        let carrierSpike = 0;

        if (isTransmitting) {
            const carrierDistance =
                Math.abs(
                    x -
                    carrierX
                );

            if (
                carrierDistance < 15
            ) {
                carrierSpike =
                    85 *
                    (
                        1 -
                        (
                            carrierDistance /
                            15
                        )
                    );
            }
        }

        const audioDistance =
            Math.abs(
                x -
                audioX
            );

        let audioPeak = 0;

        if (
            audioDistance < 60
        ) {
            audioPeak =
                (
                    amplitude *
                    100
                ) *
                Math.cos(
                    (
                        audioDistance /
                        60
                    ) *
                    (
                        Math.PI /
                        2
                    )
                );
        }

        let videoPeak = 0;

        if (
            isAbmtvMode &&
            isTransmitting
        ) {
            const videoDistance =
                Math.abs(
                    x -
                    videoX
                );

            if (
                videoDistance < 75
            ) {
                const videoRipple =
                    Math.sin(
                        x * 0.4
                    ) * 8;

                videoPeak =
                    (
                        (
                            amplitude *
                            115
                        ) +
                        videoRipple
                    ) *
                    Math.cos(
                        (
                            videoDistance /
                            75
                        ) *
                        (
                            Math.PI /
                            2
                        )
                    );
            }
        }

        let y =
            height -
            (
                noise +
                carrierSpike +
                audioPeak +
                videoPeak
            );

        y =
            Math.max(
                0,
                Math.min(
                    height,
                    y
                )
            );

        scopeCtx.lineTo(
            x,
            y
        );
    }

    scopeCtx.lineTo(
        width,
        height
    );

    scopeCtx.closePath();
    scopeCtx.fill();
    scopeCtx.stroke();
}

/**
 * Resizes the visible waterfall canvas.
 */
function resizeWaterfallCanvas() {
    const width =
        Math.max(
            1,
            Math.floor(
                imgWaterfall.clientWidth ||
                320
            )
        );

    const height =
        Math.max(
            1,
            Math.floor(
                imgWaterfall.clientHeight ||
                160
            )
        );

    if (
        imgWaterfall.width !== width
    ) {
        imgWaterfall.width =
            width;
    }

    if (
        imgWaterfall.height !== height
    ) {
        imgWaterfall.height =
            height;
    }
}

/**
 * Scrolls the internal waterfall image downward.
 */
function scrollWaterfallBuffer() {
    const stride =
        wfWidth * 4;

    const pixels =
        wfPixelData.data;

    pixels.copyWithin(
        stride,
        0,
        pixels.length -
        stride
    );
}

/**
 * Draws one new waterfall row.
 *
 * @param {number} amplitude
 * @param {boolean} isTransmitting
 * @param {boolean} isAbmtvMode
 */
function drawWaterfallRow(
    amplitude,
    isTransmitting,
    isAbmtvMode
) {
    const pixels =
        wfPixelData.data;

    const now =
        Date.now();

    /*
     * Ignore old spectrum data if the relay has not sent
     * an update recently.
     */
  if (
    Array.isArray(
        networkSpectrumSignals
    )
) {
    networkSpectrumSignals =
        networkSpectrumSignals
            .filter(
                signal =>
                    Number(
                        signal.expiresAt
                    ) >
                    now
            );
}

const activeSignals =
    Array.isArray(
        networkSpectrumSignals
    )
        ? networkSpectrumSignals
        : [];
    
    const tunedFrequency =
        Number.parseInt(
            txtFrequency?.value,
            10
        );

    const tunedX =
        frequencyToWaterfallX(
            tunedFrequency,
            wfWidth
        );

    for (
        let x = 0;
        x < wfWidth;
        x++
    ) {
        const noise =
    0.018 +
    Math.random() *
    0.055;

        let networkIntensity =
            0;

        for (
            const signal of
            activeSignals
        ) {
            if (
                !isFrequencyInsideWaterfallBand(
                    signal.frequency
                )
            ) {
                continue;
            }

            const signalX =
                frequencyToWaterfallX(
                    signal.frequency,
                    wfWidth
                );

            networkIntensity +=
                getNetworkSignalIntensity(
                    signal,
                    x,
                    signalX
                );
        }

        /*
         * Show this dashboard's own local TX/audio activity
         * even before the relay snapshot comes back.
         */
        let localSignal =
            0;

        if (
            isTransmitting &&
            Number.isFinite(
                tunedFrequency
            )
        ) {
            const distance =
                Math.abs(
                    x -
                    tunedX
                );

            const localWidth =
    waterfallVtWidthToPixels(
        isAbmtvMode
            ? 10
            : 3
    );

            if (
                distance <
                localWidth
            ) {
                localSignal =
                    amplitude *
                    Math.cos(
                        (
                            distance /
                            localWidth
                        ) *
                        (
                            Math.PI /
                            2
                        )
                    );
            }
        }

        /*
         * Faint tuned-frequency marker. This is deliberately
         * weaker than a real transmission.
         */
        const tunedMarker =
            Math.abs(
                x -
                tunedX
            ) <
            0.8
                ? 0.09
                : 0;

        const totalIntensity =
            Math.min(
                1,
                noise +
                networkIntensity +
                localSignal +
                tunedMarker
            );

        const blue =
            totalIntensity >
                0.05
                ? Math.min(
                    255,
                    totalIntensity *
                        190
                )
                : 0;

        const green =
            Math.min(
                255,
                Math.max(
                    0,
                    (
                        totalIntensity -
                        0.08
                    ) *
                    255 *
                    2.25
                )
            );

        const red =
            Math.min(
                255,
                Math.max(
                    0,
                    (
                        totalIntensity -
                        0.32
                    ) *
                    255 *
                    2.9
                )
            );

        const pixelIndex =
            x *
            4;

        pixels[
            pixelIndex
        ] =
            red;

        pixels[
            pixelIndex +
            1
        ] =
            green;

        pixels[
            pixelIndex +
            2
        ] =
            blue;

        pixels[
            pixelIndex +
            3
        ] =
            255;
    }
}

/**
 * Draws the waterfall display.
 *
 * @param {number} amplitude
 * @param {boolean} isTransmitting
 * @param {boolean} isAbmtvMode
 */
function drawWaterfall(
    amplitude,
    isTransmitting,
    isAbmtvMode
) {
    resizeWaterfallCanvas();

    scrollWaterfallBuffer();

    drawWaterfallRow(
        amplitude,
        isTransmitting,
        isAbmtvMode
    );

    wfOffCtx.putImageData(
        wfPixelData,
        0,
        0
    );

    wfCtx.imageSmoothingEnabled =
        false;

    wfCtx.clearRect(
        0,
        0,
        imgWaterfall.width,
        imgWaterfall.height
    );

    wfCtx.drawImage(
        wfOffscreen,
        0,
        0,
        wfWidth,
        wfHeight,
        0,
        0,
        imgWaterfall.width,
        imgWaterfall.height
    );

    drawArNetWaterfallFrequencyScale();
    drawArNetWaterfallTunedMarker();
}

/**
 * Draws one complete UI animation frame.
 */
function renderUIFrame() {
    const targetAmplitude =
        getCurrentAudioAmplitude();

    const stepSpeed =
        targetAmplitude <
        currentAmplitude
            ? 0.18
            : 0.45;

    currentAmplitude +=
        (
            targetAmplitude -
            currentAmplitude
        ) * stepSpeed;

    const amplitude =
        currentAmplitude;

    const isTransmitting =
        (
            isRecording ||
            isPlaying ||
            amplitude > 0.08
        );

    const isAbmtvMode =
        comboMode.value ===
        "ABMTV";

    drawSignalMeter(
        amplitude
    );

    if (isScopeMode) {
        drawSpectrumScope(
            amplitude,
            isTransmitting,
            isAbmtvMode
        );
    }
    else {
        drawWaterfall(
            amplitude,
            isTransmitting,
            isAbmtvMode
        );
    }

    requestAnimationFrame(
        renderUIFrame
    );
}

/**
 * Starts the display loop.
 */
function startDisplayLoop() {
    initializeArNetWaterfallControls();
    requestAnimationFrame(
        renderUIFrame
    );
}
