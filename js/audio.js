// ======================================================
// ArNet Transceiver
// Audio Engine
// ======================================================

// ======================================================
// Audio context
// ======================================================

function initAudioContext() {
    if (!audioCtx) {
        audioCtx =
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();
    }
}

// ======================================================
// WAV creation
// ======================================================

function createWavBuffer(
    pcmShorts,
    sampleRate
) {
    const pcmLength =
        pcmShorts.length * 2;

    const buffer =
        new ArrayBuffer(
            44 + pcmLength
        );

    const view =
        new DataView(buffer);

    // RIFF header
    view.setUint32(
        0,
        0x52494646,
        false
    );

    view.setUint32(
        4,
        36 + pcmLength,
        true
    );

    view.setUint32(
        8,
        0x57415645,
        false
    );

    // fmt chunk
    view.setUint32(
        12,
        0x666D7420,
        false
    );

    view.setUint32(
        16,
        16,
        true
    );

    view.setUint16(
        20,
        1,
        true
    );

    view.setUint16(
        22,
        1,
        true
    );

    view.setUint32(
        24,
        sampleRate,
        true
    );

    view.setUint32(
        28,
        sampleRate * 2,
        true
    );

    view.setUint16(
        32,
        2,
        true
    );

    view.setUint16(
        34,
        16,
        true
    );

    // data chunk
    view.setUint32(
        36,
        0x64617461,
        false
    );

    view.setUint32(
        40,
        pcmLength,
        true
    );

    let offset =
        44;

    for (
        let index = 0;
        index < pcmShorts.length;
        index++,
        offset += 2
    ) {
        view.setInt16(
            offset,
            pcmShorts[index],
            true
        );
    }

    lastAudioPcmArray =
        pcmShorts;

    return new Blob(
        [buffer],
        {
            type:
                "audio/wav"
        }
    );
}

// ======================================================
// Playback queue
// ======================================================

/**
 * Queues an audio Blob for playback.
 *
 * options.startOffsetSeconds may be used when a station
 * joins a transmission after it has already started.
 *
 * @param {Blob} blob
 * @param {object} options
 * @returns {Promise<void>}
 */
function playAudioBlob(
    blob,
    options = {}
) {
    if (!(blob instanceof Blob)) {
        return Promise.reject(
            new TypeError(
                "playAudioBlob requires an audio Blob."
            )
        );
    }

    return new Promise(
        (resolve, reject) => {
            audioPlaybackQueue.push({
                blob,
                options,
                resolve,
                reject
            });

            processAudioPlaybackQueue();
        }
    );
}

/**
 * Plays queued audio one item at a time.
 */
async function processAudioPlaybackQueue() {
    if (audioQueueRunning) {
        return;
    }

    audioQueueRunning =
        true;

    try {
        while (
            audioPlaybackQueue.length > 0
        ) {
            const item =
                audioPlaybackQueue.shift();

            try {
                await playSingleAudioBlob(
                    item.blob,
                    item.options
                );

                item.resolve();
            }
            catch (error) {
                item.reject(
                    error
                );
            }
        }
    }
    finally {
        audioQueueRunning =
            false;

        isPlaying =
            false;

        if (
            typeof returnToReceiveMode ===
            "function"
        ) {
            returnToReceiveMode();
        }
    }
}

/**
 * Plays one Blob and resolves only after playback ends.
 *
 * @param {Blob} blob
 * @param {object} options
 * @returns {Promise<void>}
 */
async function playSingleAudioBlob(
    blob,
    options = {}
) {
    initAudioContext();

    if (
        audioCtx &&
        audioCtx.state ===
            "suspended"
    ) {
        await audioCtx.resume();
    }

    cleanupCurrentAudioPlayback();

    const audioURL =
        URL.createObjectURL(
            blob
        );

    const audio =
        new Audio(
            audioURL
        );

    currentAudioElement =
        audio;

    currentAudioUrl =
        audioURL;

    const requestedOffset =
        Math.max(
            0,
            Number(
                options.startOffsetSeconds
            ) || 0
        );

    return new Promise(
        async (
            resolve,
            reject
        ) => {
            let finished =
                false;

            const finish =
                error => {
                    if (finished) {
                        return;
                    }

                    finished =
                        true;

                    cleanupCurrentAudioPlayback();

                    if (error) {
                        reject(
                            error
                        );
                    }
                    else {
                        resolve();
                    }
                };

            audio.addEventListener(
                "ended",
                () => {
                    finish();
                },
                {
                    once: true
                }
            );

            audio.addEventListener(
                "error",
                () => {
                    finish(
                        new Error(
                            "The browser could not play the audio transmission."
                        )
                    );
                },
                {
                    once: true
                }
            );

            try {
                if (
                    requestedOffset > 0
                ) {
                    await waitForAudioMetadata(
                        audio
                    );

                    if (
                        Number.isFinite(
                            audio.duration
                        ) &&
                        requestedOffset >=
                            audio.duration
                    ) {
                        finish();
                        return;
                    }

                    audio.currentTime =
                        requestedOffset;
                }

                playbackStartTime =
                    Date.now() -
                    (
                        requestedOffset *
                        1000
                    );

                isPlaying =
                    true;

                await audio.play();
            }
            catch (error) {
                console.error(
                    "Audio playback failed:",
                    error
                );

                finish(
                    error
                );
            }
        }
    );
}

/**
 * Waits until an Audio element has duration metadata.
 *
 * @param {HTMLAudioElement} audio
 * @returns {Promise<void>}
 */
function waitForAudioMetadata(
    audio
) {
    if (
        audio.readyState >= 1
    ) {
        return Promise.resolve();
    }

    return new Promise(
        (
            resolve,
            reject
        ) => {
            const timeout =
                setTimeout(
                    () => {
                        cleanup();

                        reject(
                            new Error(
                                "Timed out while loading audio metadata."
                            )
                        );
                    },
                    7000
                );

            const cleanup =
                () => {
                    clearTimeout(
                        timeout
                    );

                    audio.removeEventListener(
                        "loadedmetadata",
                        handleLoaded
                    );

                    audio.removeEventListener(
                        "error",
                        handleError
                    );
                };

            const handleLoaded =
                () => {
                    cleanup();
                    resolve();
                };

            const handleError =
                () => {
                    cleanup();

                    reject(
                        new Error(
                            "The browser could not read the audio metadata."
                        )
                    );
                };

            audio.addEventListener(
                "loadedmetadata",
                handleLoaded,
                {
                    once: true
                }
            );

            audio.addEventListener(
                "error",
                handleError,
                {
                    once: true
                }
            );

            audio.load();
        }
    );
}

/**
 * Stops and clears the currently active Audio element.
 */
function cleanupCurrentAudioPlayback() {
    if (currentAudioElement) {
        currentAudioElement.pause();

        currentAudioElement.removeAttribute(
            "src"
        );

        currentAudioElement.load();

        currentAudioElement =
            null;
    }

    if (currentAudioUrl) {
        URL.revokeObjectURL(
            currentAudioUrl
        );

        currentAudioUrl =
            null;
    }

    isPlaying =
        false;
}

/**
 * Stops the current audio and rejects all queued items.
 */
function clearAudioPlaybackQueue() {
    cleanupCurrentAudioPlayback();

    const pendingItems =
        audioPlaybackQueue.splice(
            0,
            audioPlaybackQueue.length
        );

    for (
        const item of
        pendingItems
    ) {
        item.reject(
            new Error(
                "Audio playback queue was cleared."
            )
        );
    }

    audioQueueRunning =
        false;
}