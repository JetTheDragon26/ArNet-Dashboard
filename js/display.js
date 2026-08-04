// ======================================================
// ArNet Transceiver
// Meter, Spectrum, and Waterfall Display
// ======================================================

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
    serviceAudioAmplitude >
        0
) {
    return serviceAudioAmplitude;
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

    const carrierX =
        wfWidth * 0.25;

    const audioX =
        wfWidth * 0.5;

    const videoX =
        wfWidth * 0.75;

    for (
        let x = 0;
        x < wfWidth;
        x++
    ) {
        const noise =
            Math.random() * 0.04;

        const carrierBar =
            (
                isTransmitting &&
                Math.abs(
                    x -
                    carrierX
                ) < 2.5
            )
                ? 0.85
                : 0;

        const audioDistance =
            Math.abs(
                x -
                audioX
            );

        const audioSignal =
            audioDistance < 25
                ? (
                    amplitude *
                    1.2
                ) *
                    Math.cos(
                        (
                            audioDistance /
                            25
                        ) *
                        (
                            Math.PI /
                            2
                        )
                    )
                : 0;

        const videoDistance =
            Math.abs(
                x -
                videoX
            );

        const videoSignal =
            (
                isAbmtvMode &&
                isTransmitting &&
                videoDistance < 35
            )
                ? (
                    amplitude *
                    1.5
                ) *
                    Math.cos(
                        (
                            videoDistance /
                            35
                        ) *
                        (
                            Math.PI /
                            2
                        )
                    )
                : 0;

        const totalIntensity =
            Math.min(
                1,
                noise +
                carrierBar +
                audioSignal +
                videoSignal
            );

        const blue =
            totalIntensity > 0.08
                ? Math.min(
                    255,
                    totalIntensity *
                    180
                )
                : 0;

        const green =
            Math.min(
                255,
                Math.max(
                    0,
                    (
                        totalIntensity -
                        0.1
                    ) *
                    255 *
                    2.2
                )
            );

        const red =
            Math.min(
                255,
                Math.max(
                    0,
                    (
                        totalIntensity -
                        0.35
                    ) *
                    255 *
                    2.8
                )
            );

        const pixelIndex =
            x * 4;

        pixels[pixelIndex] =
            red;

        pixels[pixelIndex + 1] =
            green;

        pixels[pixelIndex + 2] =
            blue;

        pixels[pixelIndex + 3] =
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
    requestAnimationFrame(
        renderUIFrame
    );
}
