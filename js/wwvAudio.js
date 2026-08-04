
// ======================================================
// ArNet / ANITS Time Signal Audio Engine
//
// Custom ANITS identification:
// assets/time/uba/uba-time-ident.wav
//
// WWV voice sprite:
// assets/time/wwv/output.mp3
//
// Requires:
// - globals.js
// - audio.js
// - display.js
// - wwvSpriteData.js
// ======================================================

const ARNET_TIME_IDENT_URL =
    "assets/time/uba/uba-time-ident.wav";

const ARNET_WWV_AUDIO_URL =
    "assets/time/wwv/output.mp3";

/*
 * "v" = WWV male voice
 * "h" = WWVH female voice
 */
const ARNET_WWV_VOICE_PREFIX =
    "v";

const ARNET_WWV_PHRASE_GAP_MS =
    170;

const ARNET_WWV_IDENT_GAP_MS =
    280;

let arnetTimeIdentBuffer =
    null;

let arnetWWVAudioBuffer =
    null;

let arnetWWVAudioLoadingPromise =
    null;

let arnetWWVSequenceActive =
    false;

let arnetWWVSequenceNumber =
    0;

let arnetWWVAnalyser =
    null;

let arnetWWVAnalyserData =
    null;

let arnetWWVMeterFrame =
    null;

const arnetWWVActiveSources =
    new Set();

const arnetWWVSequenceTimers =
    new Set();

// ======================================================
// Loading
// ======================================================

async function loadWWVAudio() {
    if (
        arnetTimeIdentBuffer &&
        arnetWWVAudioBuffer
    ) {
        return true;
    }

    if (arnetWWVAudioLoadingPromise) {
        return arnetWWVAudioLoadingPromise;
    }

    arnetWWVAudioLoadingPromise =
        loadWWVAudioFiles();

    try {
        return await arnetWWVAudioLoadingPromise;
    }
    finally {
        arnetWWVAudioLoadingPromise =
            null;
    }
}

async function loadWWVAudioFiles() {
    initAudioContext();

    if (!audioCtx) {
        throw new Error(
            "The audio context could not be created."
        );
    }

    const [
        identBuffer,
        spriteBuffer
    ] =
        await Promise.all([
            fetchAndDecodeArNetAudio(
                ARNET_TIME_IDENT_URL
            ),

            fetchAndDecodeArNetAudio(
                ARNET_WWV_AUDIO_URL
            )
        ]);

    arnetTimeIdentBuffer =
        identBuffer;

    arnetWWVAudioBuffer =
        spriteBuffer;

    initializeArNetWWVAnalyser();

    console.log(
        "[ANITS Time] Audio assets loaded."
    );

    return true;
}

async function fetchAndDecodeArNetAudio(
    url
) {
    const response =
        await fetch(
            url,
            {
                cache:
                    "force-cache"
            }
        );

    if (!response.ok) {
        throw new Error(
            `Could not load ${url}. ` +
            `HTTP ${response.status}.`
        );
    }

    const arrayBuffer =
        await response.arrayBuffer();

    return await audioCtx.decodeAudioData(
        arrayBuffer.slice(0)
    );
}

// ======================================================
// Audio analyser and radio display
// ======================================================

function initializeArNetWWVAnalyser() {
    if (
        arnetWWVAnalyser ||
        !audioCtx
    ) {
        return;
    }

    arnetWWVAnalyser =
        audioCtx.createAnalyser();

    arnetWWVAnalyser.fftSize =
        512;

    arnetWWVAnalyser.smoothingTimeConstant =
        0.35;

    arnetWWVAnalyserData =
        new Uint8Array(
            arnetWWVAnalyser.fftSize
        );

    arnetWWVAnalyser.connect(
        audioCtx.destination
    );
}

function startArNetWWVMeterTracking() {
    stopArNetWWVMeterTracking(
        false
    );

    function updateMeter() {
        if (
            !arnetWWVSequenceActive ||
            !arnetWWVAnalyser ||
            !arnetWWVAnalyserData
        ) {
            stopArNetWWVMeterTracking();

            return;
        }

        arnetWWVAnalyser.getByteTimeDomainData(
            arnetWWVAnalyserData
        );

        let sumSquared =
            0;

        for (
            let index = 0;
            index <
                arnetWWVAnalyserData.length;
            index++
        ) {
            const normalized =
                (
                    arnetWWVAnalyserData[index] -
                    128
                ) /
                128;

            sumSquared +=
                normalized *
                normalized;
        }

        const rms =
            Math.sqrt(
                sumSquared /
                arnetWWVAnalyserData.length
            );

        /*
         * Increase the analyser level enough to produce a
         * visible but not permanently full-scale signal.
         */
        serviceAudioAmplitude =
            Math.min(
                0.92,
                rms * 4.8
            );

        if (
            serviceAudioAmplitude <
            0.025
        ) {
            serviceAudioAmplitude =
                0;
        }

        if (
            txtTxState &&
            boxTxState
        ) {
            if (
                serviceAudioAmplitude >
                0.04
            ) {
                txtTxState.textContent =
                    "TIME";

                boxTxState.style.background =
                    "#665500";
            }
            else {
                txtTxState.textContent =
                    "RX";

                boxTxState.style.background =
                    "#330000";
            }
        }

        arnetWWVMeterFrame =
            requestAnimationFrame(
                updateMeter
            );
    }

    arnetWWVMeterFrame =
        requestAnimationFrame(
            updateMeter
        );
}

function stopArNetWWVMeterTracking(
    resetDisplay = true
) {
    if (arnetWWVMeterFrame) {
        cancelAnimationFrame(
            arnetWWVMeterFrame
        );

        arnetWWVMeterFrame =
            null;
    }

    if (resetDisplay) {
        serviceAudioAmplitude =
            0;

        if (
            txtTxState &&
            boxTxState
        ) {
            txtTxState.textContent =
                "RX";

            boxTxState.style.background =
                "#330000";
        }
    }
}

// ======================================================
// Basic buffer playback
// ======================================================

function playArNetDecodedBuffer(
    buffer,
    options = {}
) {
    if (
        !audioCtx ||
        !buffer
    ) {
        return Promise.reject(
            new Error(
                "Audio has not been loaded."
            )
        );
    }

    const {
        offsetSeconds = 0,
        durationSeconds =
            buffer.duration -
            offsetSeconds,

        volume = 1,
        sequenceNumber =
            arnetWWVSequenceNumber
    } = options;

    return new Promise(
        (
            resolve,
            reject
        ) => {
            try {
                const source =
                    audioCtx
                        .createBufferSource();

                const gain =
                    audioCtx
                        .createGain();

                source.buffer =
                    buffer;

                gain.gain.value =
                    volume;

                source.connect(
                    gain
                );

                gain.connect(
                    arnetWWVAnalyser
                );

                arnetWWVActiveSources.add(
                    source
                );

                let finished =
                    false;

                const finish =
                    () => {
                        if (finished) {
                            return;
                        }

                        finished =
                            true;

                        arnetWWVActiveSources.delete(
                            source
                        );

                        try {
                            source.disconnect();
                            gain.disconnect();
                        }
                        catch {
                            // The nodes may already be disconnected.
                        }

                        resolve();
                    };

                source.addEventListener(
                    "ended",
                    finish,
                    {
                        once: true
                    }
                );

                /*
                 * Do not begin stale playback after a newer
                 * sequence has replaced this one.
                 */
                if (
                    sequenceNumber !==
                    arnetWWVSequenceNumber
                ) {
                    finish();

                    return;
                }

                source.start(
                    0,
                    Math.max(
                        0,
                        offsetSeconds
                    ),
                    Math.max(
                        0.01,
                        durationSeconds
                    )
                );
            }
            catch (error) {
                reject(
                    error
                );
            }
        }
    );
}

function waitForArNetWWVAudio(
    milliseconds,
    sequenceNumber
) {
    return new Promise(
        resolve => {
            if (
                milliseconds <=
                0
            ) {
                resolve();

                return;
            }

            const timer =
                setTimeout(
                    () => {
                        arnetWWVSequenceTimers.delete(
                            timer
                        );

                        resolve();
                    },
                    milliseconds
                );

            arnetWWVSequenceTimers.add(
                timer
            );
        }
    ).then(
        () => {
            if (
                sequenceNumber !==
                arnetWWVSequenceNumber
            ) {
                throw new Error(
                    "ANITS audio sequence cancelled."
                );
            }
        }
    );
}

// ======================================================
// WWV audio-sprite playback
// ======================================================

function getArNetWWVSprite(
    spriteName
) {
    const spriteMap =
        ARNET_WWV_SPRITE_LAYOUT?.sprite;

    if (!spriteMap) {
        throw new Error(
            "The WWV sprite layout is unavailable. " +
            "Check that wwvSpriteData.js loaded first."
        );
    }

    const prefix =
        ARNET_WWV_VOICE_PREFIX;

    const namedSprites = {
        atTheTone:
            `${prefix}_at_the_tone`,

        hour:
            `${prefix}_hour`,

        hours:
            `${prefix}_hours`,

        minute:
            `${prefix}_minute`,

        minutes:
            `${prefix}_minutes`,

        utc:
            `${prefix}_utc`
    };

    let originalSpriteName =
        namedSprites[spriteName];

    if (
        typeof spriteName ===
            "number" ||
        /^\d+$/.test(
            String(spriteName)
        )
    ) {
        originalSpriteName =
            `${prefix}_${Number(spriteName)}`;
    }

    if (!originalSpriteName) {
        return null;
    }

    return (
        spriteMap[originalSpriteName] ||
        null
    );
}

async function playWWVSprite(
    spriteName,
    options = {}
) {
    await loadWWVAudio();

    const sprite =
        getArNetWWVSprite(
            spriteName
        );

    if (
        !Array.isArray(
            sprite
        ) ||
        sprite.length <
            2
    ) {
        throw new Error(
            `Unknown WWV sprite: ${spriteName}`
        );
    }

    const [
        startMilliseconds,
        durationMilliseconds
    ] =
        sprite;

    return playArNetDecodedBuffer(
        arnetWWVAudioBuffer,
        {
            offsetSeconds:
                startMilliseconds /
                1000,

            durationSeconds:
                durationMilliseconds /
                1000,

            volume:
                options.volume ??
                1,

            sequenceNumber:
                options.sequenceNumber ??
                arnetWWVSequenceNumber
        }
    );
}

// ======================================================
// Public playback functions
// ======================================================

async function playTimeStationIdent(
    options = {}
) {
    await prepareArNetWWVPlayback();

    const sequenceNumber =
        options.sequenceNumber ??
        arnetWWVSequenceNumber;

    return playArNetDecodedBuffer(
        arnetTimeIdentBuffer,
        {
            volume:
                options.volume ??
                1,

            sequenceNumber
        }
    );
}

async function playWWVAnnouncement(
    hour,
    minute,
    options = {}
) {
    await prepareArNetWWVPlayback();

    const normalizedHour =
        normalizeArNetWWVHour(
            hour
        );

    const normalizedMinute =
        normalizeArNetWWVMinute(
            minute
        );

    const sequenceNumber =
        options.sequenceNumber ??
        arnetWWVSequenceNumber;

    const phraseGap =
        options.phraseGapMs ??
        ARNET_WWV_PHRASE_GAP_MS;

    const phraseSequence = [
        "atTheTone",
        normalizedHour,
        normalizedHour === 1
            ? "hour"
            : "hours",
        normalizedMinute,
        normalizedMinute === 1
            ? "minute"
            : "minutes",
        "utc"
    ];

    for (
        let index = 0;
        index <
            phraseSequence.length;
        index++
    ) {
        if (
            sequenceNumber !==
            arnetWWVSequenceNumber
        ) {
            return false;
        }

        await playWWVSprite(
            phraseSequence[index],
            {
                sequenceNumber
            }
        );

        if (
            index <
            phraseSequence.length -
                1
        ) {
            await waitForArNetWWVAudio(
                phraseGap,
                sequenceNumber
            );
        }
    }

    return true;
}

async function playFullTimeStationAnnouncement(
    hour,
    minute,
    options = {}
) {
    stopWWVAudio();

    const sequenceNumber =
        arnetWWVSequenceNumber;

    await prepareArNetWWVPlayback();

    arnetWWVSequenceActive =
        true;

    startArNetWWVMeterTracking();

    try {
        await playTimeStationIdent(
            {
                sequenceNumber,
                volume:
                    options.identVolume ??
                    1
            }
        );

        await waitForArNetWWVAudio(
            options.identGapMs ??
                ARNET_WWV_IDENT_GAP_MS,
            sequenceNumber
        );

        await playWWVAnnouncement(
            hour,
            minute,
            {
                sequenceNumber,

                phraseGapMs:
                    options.phraseGapMs ??
                    ARNET_WWV_PHRASE_GAP_MS
            }
        );

        if (
            sequenceNumber !==
            arnetWWVSequenceNumber
        ) {
            return false;
        }

        return true;
    }
    catch (error) {
        if (
            sequenceNumber ===
            arnetWWVSequenceNumber
        ) {
            console.error(
                "[ANITS Time] Announcement failed:",
                error
            );
        }

        return false;
    }
    finally {
        if (
            sequenceNumber ===
            arnetWWVSequenceNumber
        ) {
            arnetWWVSequenceActive =
                false;

            stopArNetWWVMeterTracking();
        }
    }
}

// ======================================================
// Audio preparation and cancellation
// ======================================================

async function prepareArNetWWVPlayback() {
    await loadWWVAudio();

    if (
        audioCtx.state ===
            "suspended"
    ) {
        await audioCtx.resume();
    }

    if (
        audioCtx.state !==
            "running"
    ) {
        throw new Error(
            "Browser audio is still suspended. " +
            "Enable time-station audio first."
        );
    }

    initializeArNetWWVAnalyser();

    if (
        !arnetWWVSequenceActive
    ) {
        arnetWWVSequenceActive =
            true;

        startArNetWWVMeterTracking();
    }

    return true;
}

function stopWWVAudio() {
    arnetWWVSequenceNumber++;

    arnetWWVSequenceActive =
        false;

    for (
        const timer of
        arnetWWVSequenceTimers
    ) {
        clearTimeout(
            timer
        );
    }

    arnetWWVSequenceTimers.clear();

    for (
        const source of
        arnetWWVActiveSources
    ) {
        try {
            source.stop();
        }
        catch {
            // The source may already have ended.
        }
    }

    arnetWWVActiveSources.clear();

    stopArNetWWVMeterTracking();
}

// ======================================================
// Helpers
// ======================================================

function normalizeArNetWWVHour(
    hour
) {
    const value =
        Number.parseInt(
            hour,
            10
        );

    if (
        !Number.isFinite(
            value
        )
    ) {
        throw new TypeError(
            "The WWV hour must be a number."
        );
    }

    return (
        (
            value %
            24
        ) +
        24
    ) %
    24;
}

function normalizeArNetWWVMinute(
    minute
) {
    const value =
        Number.parseInt(
            minute,
            10
        );

    if (
        !Number.isFinite(
            value
        )
    ) {
        throw new TypeError(
            "The WWV minute must be a number."
        );
    }

    return (
        (
            value %
            60
        ) +
        60
    ) %
    60;
}

// ======================================================
// Console/testing exports
// ======================================================

window.loadWWVAudio =
    loadWWVAudio;

window.playWWVSprite =
    playWWVSprite;

window.playTimeStationIdent =
    playTimeStationIdent;

window.playWWVAnnouncement =
    playWWVAnnouncement;

window.playFullTimeStationAnnouncement =
    playFullTimeStationAnnouncement;

window.stopWWVAudio =
    stopWWVAudio;