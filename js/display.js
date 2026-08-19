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
    16,
    32,
    64,
    128,
    256,
    512,
    1024
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
    Number.parseFloat(
        txtFrequency?.value
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
        `${arnetWaterfallHoverFrequency.toFixed(2)} Vt`;
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

let selectedFrequency =
    frequency;

if (
    typeof clampFrequencyToArNetSector ===
        "function"
) {
    const clamped =
        clampFrequencyToArNetSector(
            frequency
        );

    if (
        Number.isFinite(
            clamped
        )
    ) {
        selectedFrequency =
            clamped;
    }
}

txtFrequency.value =
    selectedFrequency.toFixed(2);

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

       const decimals =
    arnetWaterfallZoomLevel >= 128
        ? 2
        : (
            arnetWaterfallZoomLevel >= 32
                ? 1
                : 0
        );

rangeText.textContent =
    `${range.min.toFixed(decimals)}–` +
    `${range.max.toFixed(decimals)} Vt`;
        
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

    const frequency =
        range.min +
        normalized *
            (
                range.max -
                range.min
            );

    return Math.round(
        frequency * 100
    ) / 100;
}

function chooseArNetWaterfallTickSpacing(
    visibleSpan
) {
    const spacings = [
    0.01,
    0.02,
    0.05,
    0.10,
    0.20,
    0.25,
    0.50,
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

        let frequencyLabel;

if (
    spacing < 1
) {
    frequencyLabel =
        frequency.toFixed(2);
}
else {
    frequencyLabel =
        frequency.toFixed(0);
}

wfCtx.fillText(
    frequencyLabel,
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

    const channel =
        Math.floor(
            tunedFrequency
        );

    const sector =
        typeof getNetworkChannelSector ===
            "function"
            ? getNetworkChannelSector()
            : "FCS";

    let sectorMin;
    let sectorMax;

    switch (sector) {
        case "LCS":
            sectorMin =
                channel + 0.00;

            sectorMax =
                channel + 0.50;
            break;

        case "UCS":
            sectorMin =
                channel + 0.50;

            sectorMax =
                channel + 0.99;
            break;

        case "FCS":
        default:
            sectorMin =
                channel + 0.00;

            sectorMax =
                channel + 0.99;
            break;
    }

    const visibleRange =
        getCurrentWaterfallBandRange();

    if (
        sectorMax <
            visibleRange.min ||
        sectorMin >
            visibleRange.max
    ) {
        return;
    }

    const visibleMin =
        Math.max(
            sectorMin,
            visibleRange.min
        );

    const visibleMax =
        Math.min(
            sectorMax,
            visibleRange.max
        );

    const leftX =
        frequencyToWaterfallX(
            visibleMin,
            imgWaterfall.width
        );

    const rightX =
        frequencyToWaterfallX(
            visibleMax,
            imgWaterfall.width
        );

    const tunedX =
        frequencyToWaterfallX(
            tunedFrequency,
            imgWaterfall.width
        );

    const bottom =
        imgWaterfall.height - 2;

    const edgeHeight =
        11;

    wfCtx.save();

    wfCtx.strokeStyle =
        "#D8D52A";

    wfCtx.lineWidth =
        1.4;

    wfCtx.lineJoin =
        "round";

    wfCtx.lineCap =
        "round";

    /*
     * Main yellow passband line.
     */
    wfCtx.beginPath();

    wfCtx.moveTo(
        leftX,
        bottom - edgeHeight
    );

    wfCtx.lineTo(
        rightX,
        bottom - edgeHeight
    );

    wfCtx.stroke();

    /*
     * Left hook.
     */
    wfCtx.beginPath();

    wfCtx.moveTo(
        leftX,
        bottom - edgeHeight
    );

    wfCtx.lineTo(
        leftX + 3,
        bottom - 3
    );

    wfCtx.lineTo(
        leftX + 7,
        bottom
    );

    wfCtx.stroke();

    /*
     * Right hook.
     */
    wfCtx.beginPath();

    wfCtx.moveTo(
        rightX,
        bottom - edgeHeight
    );

    wfCtx.lineTo(
        rightX - 3,
        bottom - 3
    );

    wfCtx.lineTo(
        rightX - 7,
        bottom
    );

    wfCtx.stroke();

    /*
     * Exact tuning notch.
     */
    if (
        tunedFrequency >=
            visibleRange.min &&
        tunedFrequency <=
            visibleRange.max
    ) {
        wfCtx.beginPath();

        wfCtx.moveTo(
            tunedX - 4,
            bottom - edgeHeight
        );

        wfCtx.lineTo(
            tunedX,
            bottom - 4
        );

        wfCtx.lineTo(
            tunedX + 4,
            bottom - edgeHeight
        );

        wfCtx.stroke();
    }

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

function getFrequencyDecimalOffset() {
    const frequency =
        Number.parseFloat(
            txtFrequency.value
        );

    if (
        !Number.isFinite(
            frequency
        )
    ) {
        return 0;
    }

    const whole =
        Math.floor(
            frequency
        );

    const decimal =
        frequency -
        whole;

    return Math.max(
        0,
        Math.min(
            0.99,
            decimal
        )
    );
}

function drawSignalMeter(amplitude) {
    const width =
        canvasMeter.width;

    const height =
        canvasMeter.height;

    const centerX =
        width / 2;

    const pivotY =
        height - 8;

    const radius =
        Math.min(
            88,
            width * 0.37
        );

    meterCtx.clearRect(
        0,
        0,
        width,
        height
    );

    /*
     * ==================================================
     * BACKGROUND
     * ==================================================
     */

    meterCtx.fillStyle =
        "#020503";

    meterCtx.fillRect(
        0,
        0,
        width,
        height
    );

    /*
     * Subtle inner frame.
     */
    meterCtx.strokeStyle =
        "#18351E";

    meterCtx.lineWidth =
        1;

    meterCtx.strokeRect(
        1.5,
        1.5,
        width - 3,
        height - 3
    );


    /*
     * ==================================================
     * SCALE ARC
     * ==================================================
     */

    const startAngle =
        Math.PI +
        0.32;

    const endAngle =
        (Math.PI * 2) -
        0.32;

    meterCtx.strokeStyle =
        "#46694D";

    meterCtx.lineWidth =
        1.5;

    meterCtx.beginPath();

    meterCtx.arc(
        centerX,
        pivotY,
        radius,
        startAngle,
        endAngle
    );

    meterCtx.stroke();


    /*
     * ==================================================
     * S-METER TICKS
     * ==================================================
     */

    const scaleMarks = [
        {
            position: 0.00,
            label: "1"
        },
        {
            position: 0.16,
            label: "3"
        },
        {
            position: 0.32,
            label: "5"
        },
        {
            position: 0.48,
            label: "7"
        },
        {
            position: 0.64,
            label: "9"
        },
        {
            position: 0.82,
            label: "+20"
        },
        {
            position: 1.00,
            label: "+60"
        }
    ];

    meterCtx.textAlign =
        "center";

    meterCtx.textBaseline =
        "middle";

    for (
        const mark of
        scaleMarks
    ) {
        const angle =
            startAngle +
            (
                (
                    endAngle -
                    startAngle
                ) *
                mark.position
            );

        const isHighSignal =
            mark.position >=
            0.82;

        const tickOuterRadius =
            radius;

        const tickInnerRadius =
            isHighSignal
                ? radius - 9
                : radius - 7;

        const x1 =
            centerX +
            (
                Math.cos(angle) *
                tickInnerRadius
            );

        const y1 =
            pivotY +
            (
                Math.sin(angle) *
                tickInnerRadius
            );

        const x2 =
            centerX +
            (
                Math.cos(angle) *
                tickOuterRadius
            );

        const y2 =
            pivotY +
            (
                Math.sin(angle) *
                tickOuterRadius
            );

        meterCtx.strokeStyle =
            isHighSignal
                ? "#9C3B3B"
                : "#5F8A68";

        meterCtx.lineWidth =
            isHighSignal
                ? 1.5
                : 1;

        meterCtx.beginPath();

        meterCtx.moveTo(
            x1,
            y1
        );

        meterCtx.lineTo(
            x2,
            y2
        );

        meterCtx.stroke();

        const labelRadius =
            radius - 17;

        const labelX =
            centerX +
            (
                Math.cos(angle) *
                labelRadius
            );

        const labelY =
            pivotY +
            (
                Math.sin(angle) *
                labelRadius
            );

        meterCtx.fillStyle =
            isHighSignal
                ? "#C55B5B"
                : "#78C786";

        meterCtx.font =
            mark.label.length >
                2
                ? "7px Consolas"
                : "8px Consolas";

        meterCtx.fillText(
            mark.label,
            labelX,
            labelY
        );
    }


    /*
     * ==================================================
     * RED HIGH-SIGNAL ARC
     * ==================================================
     */

    const redStart =
        startAngle +
        (
            (
                endAngle -
                startAngle
            ) *
            0.78
        );

    meterCtx.strokeStyle =
        "#7F2B2B";

    meterCtx.lineWidth =
        2.5;

    meterCtx.beginPath();

    meterCtx.arc(
        centerX,
        pivotY,
        radius,
        redStart,
        endAngle
    );

    meterCtx.stroke();


    /*
     * ==================================================
     * SECONDARY RF SCALE
     * ==================================================
     */

    meterCtx.fillStyle =
        "#496851";

    meterCtx.font =
        "7px Consolas";

    meterCtx.fillText(
        "RF",
        20,
        height - 18
    );

    const rfLabels = [
    {
        text: "0",
        x: 48
    },
    {
        text: "25",
        x: 82
    },
    {
        text: "50",
        x: 120
    },
    {
        text: "75",
        x: 158
    },
    {
        text: "100",
        x: 198
    }
];
    for (
        const label of
        rfLabels
    ) {
        meterCtx.fillText(
            label.text,
            label.x,
            height - 18
        );
    }


    /*
     * ==================================================
     * METER LABELS
     * ==================================================
     */

    meterCtx.fillStyle =
        "#8BEA9D";

    meterCtx.font =
        "bold 9px Consolas";

    meterCtx.fillText(
        "S",
        centerX,
        15
    );

    meterCtx.fillStyle =
        "#4E7456";

    meterCtx.font =
        "7px Consolas";

    meterCtx.fillText(
        "SIGNAL",
        centerX,
        26
    );


    /*
     * ==================================================
     * NEEDLE
     * ==================================================
     */

    const normalizedAmplitude =
        Math.max(
            0,
            Math.min(
                1,
                Number(amplitude) ||
                0
            )
        );

    const needleAngle =
        startAngle +
        (
            (
                endAngle -
                startAngle
            ) *
            normalizedAmplitude
        );

    const needleRadius =
        radius - 5;

    const needleX =
        centerX +
        (
            Math.cos(
                needleAngle
            ) *
            needleRadius
        );

    const needleY =
        pivotY +
        (
            Math.sin(
                needleAngle
            ) *
            needleRadius
        );

    /*
     * Soft needle shadow.
     */
    meterCtx.strokeStyle =
        "rgba(0,0,0,0.7)";

    meterCtx.lineWidth =
        3;

    meterCtx.beginPath();

    meterCtx.moveTo(
        centerX + 1,
        pivotY + 1
    );

    meterCtx.lineTo(
        needleX + 1,
        needleY + 1
    );

    meterCtx.stroke();

    /*
     * Main needle.
     */
    meterCtx.strokeStyle =
        "#B7E8BF";

    meterCtx.lineWidth =
        1.6;

    meterCtx.beginPath();

    meterCtx.moveTo(
        centerX,
        pivotY
    );

    meterCtx.lineTo(
        needleX,
        needleY
    );

    meterCtx.stroke();


    /*
     * ==================================================
     * PIVOT
     * ==================================================
     */

    meterCtx.fillStyle =
        "#111A13";

    meterCtx.strokeStyle =
        "#6A8B70";

    meterCtx.lineWidth =
        1;

    meterCtx.beginPath();

    meterCtx.arc(
        centerX,
        pivotY,
        4.5,
        0,
        Math.PI * 2
    );

    meterCtx.fill();

    meterCtx.stroke();
}

function drawFrequencyOffsetMeter() {
    const width =
        canvasOffsetMeter.width;

    const height =
        canvasOffsetMeter.height;

    const centerX =
        width / 2;

    const pivotY =
        height - 8;

    const radius =
        Math.min(
            88,
            width * 0.37
        );

    const offset =
        getFrequencyDecimalOffset();

    offsetMeterCtx.clearRect(
        0,
        0,
        width,
        height
    );

    /*
     * ==========================================
     * BACKGROUND
     * ==========================================
     */

    offsetMeterCtx.fillStyle =
        "#020503";

    offsetMeterCtx.fillRect(
        0,
        0,
        width,
        height
    );

    offsetMeterCtx.strokeStyle =
        "#18351E";

    offsetMeterCtx.lineWidth =
        1;

    offsetMeterCtx.strokeRect(
        1.5,
        1.5,
        width - 3,
        height - 3
    );


    /*
     * ==========================================
     * ARC
     * ==========================================
     */

    const startAngle =
        Math.PI + 0.32;

    const endAngle =
        (Math.PI * 2) - 0.32;

    offsetMeterCtx.strokeStyle =
        "#46694D";

    offsetMeterCtx.lineWidth =
        1.5;

    offsetMeterCtx.beginPath();

    offsetMeterCtx.arc(
        centerX,
        pivotY,
        radius,
        startAngle,
        endAngle
    );

    offsetMeterCtx.stroke();


    /*
     * ==========================================
     * OFFSET SCALE
     * ==========================================
     */

    const marks = [
        {
            value: 0.00,
            label: ".00"
        },
        {
            value: 0.25,
            label: ".25"
        },
        {
            value: 0.50,
            label: ".50"
        },
        {
            value: 0.75,
            label: ".75"
        },
        {
            value: 0.99,
            label: ".99"
        }
    ];

    offsetMeterCtx.textAlign =
        "center";

    offsetMeterCtx.textBaseline =
        "middle";

    for (
        const mark of
        marks
    ) {
        const normalized =
            mark.value / 0.99;

        const angle =
            startAngle +
            (
                (
                    endAngle -
                    startAngle
                ) *
                normalized
            );

        const outerRadius =
            radius;

        const innerRadius =
            radius - 8;

        const x1 =
            centerX +
            (
                Math.cos(angle) *
                innerRadius
            );

        const y1 =
            pivotY +
            (
                Math.sin(angle) *
                innerRadius
            );

        const x2 =
            centerX +
            (
                Math.cos(angle) *
                outerRadius
            );

        const y2 =
            pivotY +
            (
                Math.sin(angle) *
                outerRadius
            );

        /*
         * Make .50 slightly brighter because
         * it's the center of an ArNet channel.
         */

        const isCenter =
            mark.value === 0.50;

        offsetMeterCtx.strokeStyle =
            isCenter
                ? "#8BEA9D"
                : "#5F8A68";

        offsetMeterCtx.lineWidth =
            isCenter
                ? 2
                : 1;

        offsetMeterCtx.beginPath();

        offsetMeterCtx.moveTo(
            x1,
            y1
        );

        offsetMeterCtx.lineTo(
            x2,
            y2
        );

        offsetMeterCtx.stroke();


        /*
         * Labels
         */

        const labelRadius =
            radius - 19;

        const labelX =
            centerX +
            (
                Math.cos(angle) *
                labelRadius
            );

        const labelY =
            pivotY +
            (
                Math.sin(angle) *
                labelRadius
            );

        offsetMeterCtx.fillStyle =
            isCenter
                ? "#9AF0AA"
                : "#6FAE79";

        offsetMeterCtx.font =
            isCenter
                ? "bold 8px Consolas"
                : "8px Consolas";

        offsetMeterCtx.fillText(
            mark.label,
            labelX,
            labelY
        );
    }


    /*
     * ==========================================
     * TITLE
     * ==========================================
     */

    offsetMeterCtx.fillStyle =
        "#8BEA9D";

    offsetMeterCtx.font =
        "bold 9px Consolas";

    offsetMeterCtx.fillText(
        "OFFSET",
        centerX,
        15
    );

    offsetMeterCtx.fillStyle =
        "#4E7456";

    offsetMeterCtx.font =
        "7px Consolas";

    offsetMeterCtx.fillText(
        "CHANNEL POSITION",
        centerX,
        26
    );


    /*
     * ==========================================
     * CENTER REFERENCE
     * ==========================================
     */

    const centerAngle =
        startAngle +
        (
            (
                endAngle -
                startAngle
            ) *
            (0.50 / 0.99)
        );

    const centerInner =
        radius - 13;

    const centerOuter =
        radius + 2;

    offsetMeterCtx.strokeStyle =
        "#315D39";

    offsetMeterCtx.lineWidth =
        1;

    offsetMeterCtx.beginPath();

    offsetMeterCtx.moveTo(
        centerX +
            Math.cos(
                centerAngle
            ) *
            centerInner,
        pivotY +
            Math.sin(
                centerAngle
            ) *
            centerInner
    );

    offsetMeterCtx.lineTo(
        centerX +
            Math.cos(
                centerAngle
            ) *
            centerOuter,
        pivotY +
            Math.sin(
                centerAngle
            ) *
            centerOuter
    );

    offsetMeterCtx.stroke();


    /*
     * ==========================================
     * NEEDLE
     * ==========================================
     */

    const normalizedOffset =
        Math.max(
            0,
            Math.min(
                1,
                offset / 0.99
            )
        );

    const needleAngle =
        startAngle +
        (
            (
                endAngle -
                startAngle
            ) *
            normalizedOffset
        );

    const needleRadius =
        radius - 5;

    const needleX =
        centerX +
        (
            Math.cos(
                needleAngle
            ) *
            needleRadius
        );

    const needleY =
        pivotY +
        (
            Math.sin(
                needleAngle
            ) *
            needleRadius
        );


    /*
     * Needle shadow
     */

    offsetMeterCtx.strokeStyle =
        "rgba(0,0,0,0.7)";

    offsetMeterCtx.lineWidth =
        3;

    offsetMeterCtx.beginPath();

    offsetMeterCtx.moveTo(
        centerX + 1,
        pivotY + 1
    );

    offsetMeterCtx.lineTo(
        needleX + 1,
        needleY + 1
    );

    offsetMeterCtx.stroke();


    /*
     * Needle
     */

    offsetMeterCtx.strokeStyle =
        "#B7E8BF";

    offsetMeterCtx.lineWidth =
        1.6;

    offsetMeterCtx.beginPath();

    offsetMeterCtx.moveTo(
        centerX,
        pivotY
    );

    offsetMeterCtx.lineTo(
        needleX,
        needleY
    );

    offsetMeterCtx.stroke();


    /*
     * ==========================================
     * PIVOT
     * ==========================================
     */

    offsetMeterCtx.fillStyle =
        "#111A13";

    offsetMeterCtx.strokeStyle =
        "#6A8B70";

    offsetMeterCtx.lineWidth =
        1;

    offsetMeterCtx.beginPath();

    offsetMeterCtx.arc(
        centerX,
        pivotY,
        4.5,
        0,
        Math.PI * 2
    );

    offsetMeterCtx.fill();

    offsetMeterCtx.stroke();
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
    Number.parseFloat(
        txtFrequency?.value
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
        isPlaying
    );

    const isAbmtvMode =
        comboMode.value ===
        "ABMTV";

    drawSignalMeter(
        amplitude
    );

    drawFrequencyOffsetMeter();

  drawSpectrumScope(
    amplitude,
    isTransmitting,
    isAbmtvMode
);

drawWaterfall(
    amplitude,
    isTransmitting,
    isAbmtvMode
);

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
