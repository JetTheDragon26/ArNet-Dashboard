// ======================================================
// ArNet / ANITS Time Signal Service
//
// Station:
// ANITS Time Signal Station
// UBA-TS001
//
// Channel:
// 2800 Vt
// ABM
// UBA 2
//
// Requires:
// - globals.js
// - audio.js
// - display.js
// - wwvSpriteData.js
// - wwvAudio.js
// ======================================================

const ARNET_TIME_FREQUENCY =
    2800;

const ARNET_TIME_MODE =
    "ABM";

const ARNET_TIME_BAND =
    "UBA 2";

const ARNET_TIME_CALLSIGN =
    "UBA-TS001";

/*
 * The full announcement begins at this second.
 *
 * Your ident is approximately 14 seconds long.
 * The WWV announcement takes several more seconds.
 *
 * Starting at second 35 gives the sequence enough time
 * to finish before the exact minute marker.
 */
const ARNET_TIME_ANNOUNCEMENT_SECOND =
    35;

/*
 * Second ticks.
 */
const ARNET_TIME_TICK_FREQUENCY =
    1000;

const ARNET_TIME_TICK_DURATION =
    0.008;

const ARNET_TIME_TICK_VOLUME =
    0.17;

/*
 * Exact minute marker.
 */
const ARNET_TIME_MINUTE_FREQUENCY =
    1000;

const ARNET_TIME_MINUTE_DURATION =
    0.8;

const ARNET_TIME_MINUTE_VOLUME =
    0.24;

/*
 * At the beginning of an hour, use a slightly higher
 * tone to distinguish it from an ordinary minute.
 */
const ARNET_TIME_HOUR_FREQUENCY =
    1500;

const ARNET_TIME_HOUR_DURATION =
    0.8;

const ARNET_TIME_HOUR_VOLUME =
    0.25;

// ======================================================
// State
// ======================================================

let arnetTimePanel =
    null;

let arnetTimeChannelActive =
    false;

let arnetTimeAudioUnlocked =
    false;

let arnetTimeClockTimer =
    null;

let arnetTimeSchedulerTimer =
    null;

let arnetTimeLastHandledSecond =
    -1;

let arnetTimeLastAnnouncementMinute =
    "";

let arnetTimeLastMarkerMinute =
    "";

let arnetTimeToneSources =
    new Set();

let arnetTimeToneDisplayTimers =
    new Set();

let arnetTimeActiveDisplayTones =
    0;

// ======================================================
// Time panel
// ======================================================

function createArNetTimePanel() {
    if (arnetTimePanel) {
        return arnetTimePanel;
    }

    const panel =
        document.createElement(
            "section"
        );

    panel.id =
        "arnetTimePanel";

    panel.className =
        "border-box";

    panel.style.display =
        "none";

    panel.style.marginTop =
        "8px";

    panel.style.marginBottom =
        "8px";

    panel.style.padding =
        "8px";

    panel.style.border =
        "1px solid #8A7500";

    panel.style.background =
        "#121005";

    panel.innerHTML = `
        <div
            style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:8px;
                margin-bottom:8px;
            "
        >
            <div>
                <div
                    style="
                        color:#FFD700;
                        font-size:12px;
                        font-weight:bold;
                    "
                >
                    ANITS TIME SIGNAL STATION
                </div>

                <div
                    style="
                        color:#918866;
                        font-size:9px;
                        margin-top:2px;
                    "
                >
                    ${ARNET_TIME_CALLSIGN}
                    · ${ARNET_TIME_FREQUENCY} Vt
                    · ABM / UBA 2
                </div>
            </div>

            <div
                id="arnetTimeServiceState"
                style="
                    color:#FFD700;
                    font-size:9px;
                    font-weight:bold;
                    white-space:nowrap;
                "
            >
                STANDBY
            </div>
        </div>

        <div
            style="
                display:grid;
                grid-template-columns:
                    repeat(2, minmax(0, 1fr));
                gap:8px;
            "
        >
            <div
                style="
                    background:#080700;
                    border:1px solid #443B10;
                    padding:10px;
                    text-align:center;
                "
            >
                <div
                    style="
                        color:#887A44;
                        font-size:8px;
                        font-weight:bold;
                    "
                >
                    LOCAL TIME
                </div>

                <div
                    id="arnetTimeLocalClock"
                    style="
                        color:#FFD700;
                        font-family:Consolas, monospace;
                        font-size:27px;
                        font-weight:bold;
                        margin-top:4px;
                    "
                >
                    --:--:--
                </div>

                <div
                    id="arnetTimeLocalDate"
                    style="
                        color:#AAA688;
                        font-size:9px;
                        margin-top:3px;
                    "
                >
                    Waiting for time
                </div>
            </div>

            <div
                style="
                    background:#080700;
                    border:1px solid #443B10;
                    padding:10px;
                    text-align:center;
                "
            >
                <div
                    style="
                        color:#887A44;
                        font-size:8px;
                        font-weight:bold;
                    "
                >
                    COORDINATED UNIVERSAL TIME
                </div>

                <div
                    id="arnetTimeUtcClock"
                    style="
                        color:#FFFFFF;
                        font-family:Consolas, monospace;
                        font-size:27px;
                        font-weight:bold;
                        margin-top:4px;
                    "
                >
                    --:--:-- UTC
                </div>

                <div
                    id="arnetTimeUtcDate"
                    style="
                        color:#AAAAAA;
                        font-size:9px;
                        margin-top:3px;
                    "
                >
                    Waiting for UTC
                </div>
            </div>
        </div>

        <div
            style="
                display:grid;
                grid-template-columns:
                    repeat(3, minmax(0, 1fr));
                gap:5px;
                margin-top:7px;
            "
        >
            ${createArNetTimeStatusCell(
                "CURRENT SECOND",
                "arnetTimeSecond",
                "--"
            )}

            ${createArNetTimeStatusCell(
                "NEXT ANNOUNCEMENT",
                "arnetTimeNextAnnouncement",
                "--"
            )}

            ${createArNetTimeStatusCell(
                "CLOCK SOURCE",
                "arnetTimeClockSource",
                "DEVICE UTC"
            )}
        </div>

        <button
            id="btnEnableArNetTimeAudio"
            type="button"
            style="
                width:100%;
                margin-top:7px;
                padding:7px;
                background:#554400;
                border:1px solid #AA8800;
                color:#FFFFFF;
                font-size:10px;
                font-weight:bold;
                cursor:pointer;
            "
        >
            ENABLE TIME SIGNAL AUDIO
        </button>

        <div
            id="arnetTimeServiceMessage"
            style="
                color:#888066;
                font-size:9px;
                margin-top:6px;
            "
        >
            Tune to this channel to receive the ANITS time service.
        </div>

        <div
            style="
                color:#575344;
                font-size:8px;
                margin-top:4px;
            "
        >
            Announcement voice components adapted from
            kalafut/wwv under the MIT License.
        </div>
    `;

    const scopeSection =
        document.querySelector(
            ".scope-grid"
        );

    if (
        scopeSection &&
        scopeSection.parentElement
    ) {
        scopeSection.parentElement.insertBefore(
            panel,
            scopeSection
        );
    }
    else {
        const app =
            document.getElementById(
                "app"
            );

        if (app) {
            app.appendChild(
                panel
            );
        }
    }

    arnetTimePanel =
        panel;

    const enableButton =
        panel.querySelector(
            "#btnEnableArNetTimeAudio"
        );

    if (enableButton) {
        enableButton.addEventListener(
            "click",
            enableArNetTimeAudio
        );
    }

    return panel;
}

function createArNetTimeStatusCell(
    label,
    id,
    defaultValue
) {
    return `
        <div
            style="
                background:#080700;
                border:1px solid #443B10;
                padding:6px;
            "
        >
            <div
                style="
                    color:#887A44;
                    font-size:8px;
                    font-weight:bold;
                "
            >
                ${label}
            </div>

            <div
                id="${id}"
                style="
                    color:#DDCC77;
                    font-size:10px;
                    font-weight:bold;
                    margin-top:3px;
                "
            >
                ${defaultValue}
            </div>
        </div>
    `;
}

// ======================================================
// Channel detection
// ======================================================

function isArNetTimeChannelSelected() {
    const frequency =
        Number.parseInt(
            txtFrequency?.value,
            10
        );

    const mode =
        String(
            comboMode?.value ||
            ""
        )
            .trim()
            .toUpperCase();

    const band =
        String(
            comboBand?.value ||
            ""
        )
            .trim()
            .toUpperCase();

    return (
        frequency ===
            ARNET_TIME_FREQUENCY &&
        mode ===
            ARNET_TIME_MODE &&
        band ===
            ARNET_TIME_BAND
                .toUpperCase()
    );
}

function evaluateArNetTimeChannel() {
    /*
     * Wait until app.js finishes changing the available
     * band and frequency values.
     */
    setTimeout(
        () => {
            if (
                isArNetTimeChannelSelected()
            ) {
                activateArNetTimeChannel();
            }
            else {
                deactivateArNetTimeChannel();
            }
        },
        0
    );
}

// ======================================================
// Activation and shutdown
// ======================================================

function activateArNetTimeChannel() {
    createArNetTimePanel();

    arnetTimePanel.style.display =
        "block";

    if (
        arnetTimeChannelActive
    ) {
        return;
    }

    arnetTimeChannelActive =
        true;

    arnetTimeLastHandledSecond =
        -1;

    arnetTimeLastAnnouncementMinute =
        "";

    arnetTimeLastMarkerMinute =
        "";

    setArNetTimeText(
        "arnetTimeServiceState",
        "TIME LOCK"
    );

    setArNetTimeColor(
        "arnetTimeServiceState",
        "#00FF7F"
    );

    setArNetTimeText(
        "arnetTimeServiceMessage",
        arnetTimeAudioUnlocked
            ? "ANITS time signal synchronized."
            : "Time locked. Enable audio to hear the station."
    );

    updateArNetTimeDisplay();

    clearInterval(
        arnetTimeClockTimer
    );

    arnetTimeClockTimer =
        setInterval(
            updateArNetTimeDisplay,
            200
        );

    startArNetTimeScheduler();
}

function deactivateArNetTimeChannel() {
    if (
        !arnetTimeChannelActive &&
        (
            !arnetTimePanel ||
            arnetTimePanel.style.display ===
                "none"
        )
    ) {
        return;
    }

    arnetTimeChannelActive =
        false;

    if (
        arnetTimeClockTimer
    ) {
        clearInterval(
            arnetTimeClockTimer
        );

        arnetTimeClockTimer =
            null;
    }

    stopArNetTimeScheduler();

    stopArNetTimeTones();

    if (
        typeof stopWWVAudio ===
            "function"
    ) {
        stopWWVAudio();
    }

    if (arnetTimePanel) {
        arnetTimePanel.style.display =
            "none";
    }
}

// ======================================================
// Clock display
// ======================================================

function updateArNetTimeDisplay() {
    if (
        !arnetTimeChannelActive
    ) {
        return;
    }

    const now =
        new Date();

    setArNetTimeText(
        "arnetTimeLocalClock",
        now.toLocaleTimeString(
            [],
            {
                hour12:
                    false,

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                second:
                    "2-digit"
            }
        )
    );

    setArNetTimeText(
        "arnetTimeLocalDate",
        now.toLocaleDateString(
            [],
            {
                weekday:
                    "long",

                year:
                    "numeric",

                month:
                    "long",

                day:
                    "numeric"
            }
        )
    );

    setArNetTimeText(
        "arnetTimeUtcClock",
        createArNetUtcClockText(
            now
        )
    );

    setArNetTimeText(
        "arnetTimeUtcDate",
        now.toLocaleDateString(
            "en-US",
            {
                timeZone:
                    "UTC",

                weekday:
                    "long",

                year:
                    "numeric",

                month:
                    "long",

                day:
                    "numeric"
            }
        )
    );

    setArNetTimeText(
        "arnetTimeSecond",
        String(
            now.getUTCSeconds()
        ).padStart(
            2,
            "0"
        )
    );

    setArNetTimeText(
        "arnetTimeNextAnnouncement",
        createArNetNextAnnouncementText(
            now
        )
    );
}

function createArNetUtcClockText(
    date
) {
    const hours =
        String(
            date.getUTCHours()
        ).padStart(
            2,
            "0"
        );

    const minutes =
        String(
            date.getUTCMinutes()
        ).padStart(
            2,
            "0"
        );

    const seconds =
        String(
            date.getUTCSeconds()
        ).padStart(
            2,
            "0"
        );

    return (
        `${hours}:${minutes}:${seconds} UTC`
    );
}

function createArNetNextAnnouncementText(
    now
) {
    const next =
        new Date(
            now.getTime()
        );

    if (
        now.getUTCSeconds() >=
            ARNET_TIME_ANNOUNCEMENT_SECOND
    ) {
        next.setUTCMinutes(
            next.getUTCMinutes() +
            1
        );
    }

    next.setUTCSeconds(
        ARNET_TIME_ANNOUNCEMENT_SECOND,
        0
    );

    return next.toLocaleTimeString(
        "en-GB",
        {
            timeZone:
                "UTC",

            hour12:
                false,

            hour:
                "2-digit",

            minute:
                "2-digit",

            second:
                "2-digit"
        }
    ) +
    " UTC";
}

// ======================================================
// Audio unlock
// ======================================================

async function enableArNetTimeAudio() {
    try {
        initAudioContext();

        if (!audioCtx) {
            throw new Error(
                "The audio context could not be created."
            );
        }

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
                "The browser kept audio suspended."
            );
        }

        setArNetTimeText(
            "arnetTimeServiceMessage",
            "Loading time-station audio..."
        );

        if (
            typeof loadWWVAudio !==
                "function"
        ) {
            throw new Error(
                "wwvAudio.js did not load."
            );
        }

        await loadWWVAudio();

        arnetTimeAudioUnlocked =
            true;

        const button =
            document.getElementById(
                "btnEnableArNetTimeAudio"
            );

        if (button) {
            button.textContent =
                "TIME SIGNAL AUDIO ENABLED";

            button.disabled =
                true;

            button.style.background =
                "#224422";

            button.style.borderColor =
                "#448844";

            button.style.cursor =
                "default";
        }

        setArNetTimeText(
            "arnetTimeServiceMessage",
            "Time signal audio enabled."
        );

        /*
         * Play a short confirmation tick.
         */
        playArNetTimeTone(
            ARNET_TIME_TICK_FREQUENCY,
            0.12,
            0.18,
            0.58
        );
    }
    catch (error) {
        console.error(
            "[ANITS Time] Audio enable failed:",
            error
        );

        setArNetTimeText(
            "arnetTimeServiceMessage",
            error?.message ||
            "Time signal audio could not be enabled."
        );
    }
}

// ======================================================
// Main scheduler
// ======================================================

function startArNetTimeScheduler() {
    stopArNetTimeScheduler();

    /*
     * Run more frequently than once per second so the
     * scheduler can notice the exact second boundary.
     */
    arnetTimeSchedulerTimer =
        setInterval(
            processArNetTimeScheduler,
            100
        );

    processArNetTimeScheduler();
}

function stopArNetTimeScheduler() {
    if (
        arnetTimeSchedulerTimer
    ) {
        clearInterval(
            arnetTimeSchedulerTimer
        );

        arnetTimeSchedulerTimer =
            null;
    }

    arnetTimeLastHandledSecond =
        -1;
}

function processArNetTimeScheduler() {
    if (
        !arnetTimeChannelActive
    ) {
        return;
    }

    const now =
        new Date();

    const currentSecond =
        now.getUTCSeconds();

    if (
        currentSecond ===
            arnetTimeLastHandledSecond
    ) {
        return;
    }

    arnetTimeLastHandledSecond =
        currentSecond;

    const minuteKey =
        createArNetMinuteKey(
            now
        );

    /*
     * Begin the custom ident and WWV time announcement.
     */
    if (
        currentSecond ===
            ARNET_TIME_ANNOUNCEMENT_SECOND &&
        arnetTimeLastAnnouncementMinute !==
            minuteKey
    ) {
        arnetTimeLastAnnouncementMinute =
            minuteKey;

        startArNetTimeAnnouncement(
            now
        );

        return;
    }

    /*
     * Exact minute marker.
     */
    if (
        currentSecond === 0 &&
        arnetTimeLastMarkerMinute !==
            minuteKey
    ) {
        arnetTimeLastMarkerMinute =
            minuteKey;

        playArNetMinuteMarker(
            now
        );

        return;
    }

    /*
     * Exact minute marker.
     */
    if (
        currentSecond === 0 &&
        arnetTimeLastMarkerMinute !==
            minuteKey
    ) {
        arnetTimeLastMarkerMinute =
            minuteKey;

        playArNetMinuteMarker(
            now
        );

        return;
    }

    /*
     * Do not play second ticks over the spoken
     * announcement.
     */
    if (
        isArNetTimeVoicePlaying()
    ) {
        return;
    }

    /*
     * WWV-style omitted ticks.
     */
    if (
        currentSecond === 29 ||
        currentSecond === 59
    ) {
        return;
    }

    /*
     * No ordinary tick at second zero because the
     * minute marker replaces it.
     */
    if (
        currentSecond !== 0
    ) {
        playArNetSecondTick(
            currentSecond
        );
    }
}

function createArNetMinuteKey(
    date
) {
    return [
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes()
    ].join("-");
}

// ======================================================
// Announcement
// ======================================================

async function startArNetTimeAnnouncement(
    currentTime
) {
    if (
        !arnetTimeAudioUnlocked ||
        !arnetTimeChannelActive
    ) {
        return;
    }

    if (
        typeof playFullTimeStationAnnouncement !==
            "function"
    ) {
        console.error(
            "[ANITS Time] " +
            "playFullTimeStationAnnouncement() is unavailable."
        );

        return;
    }

    /*
     * Announce the upcoming UTC minute.
     */
    const announcedTime =
        new Date(
            currentTime.getTime()
        );

    announcedTime.setUTCMinutes(
        announcedTime.getUTCMinutes() +
        1
    );

    announcedTime.setUTCSeconds(
        0,
        0
    );

    const announcedHour =
        announcedTime.getUTCHours();

    const announcedMinute =
        announcedTime.getUTCMinutes();

    setArNetTimeText(
        "arnetTimeServiceState",
        "ANNOUNCING"
    );

    setArNetTimeColor(
        "arnetTimeServiceState",
        "#FFD700"
    );

    setArNetTimeText(
        "arnetTimeServiceMessage",
        (
            "Announcing " +
            String(
                announcedHour
            ).padStart(
                2,
                "0"
            ) +
            ":" +
            String(
                announcedMinute
            ).padStart(
                2,
                "0"
            ) +
            " UTC."
        )
    );

    try {
        await playFullTimeStationAnnouncement(
            announcedHour,
            announcedMinute,
            {
                identGapMs:
                    280,

                phraseGapMs:
                    170
            }
        );
    }
    catch (error) {
        console.error(
            "[ANITS Time] Announcement error:",
            error
        );
    }
    finally {
        if (
            arnetTimeChannelActive
        ) {
            setArNetTimeText(
                "arnetTimeServiceState",
                "TIME LOCK"
            );

            setArNetTimeColor(
                "arnetTimeServiceState",
                "#00FF7F"
            );

            setArNetTimeText(
                "arnetTimeServiceMessage",
                "Awaiting exact minute marker."
            );
        }
    }
}

function isArNetTimeVoicePlaying() {
    return (
        typeof arnetWWVSequenceActive !==
            "undefined" &&
        arnetWWVSequenceActive
    );
}

// ======================================================
// Ticks and minute markers
// ======================================================

function playArNetSecondTick(
    second
) {
    if (
        !arnetTimeAudioUnlocked
    ) {
        return;
    }

    let duration =
        ARNET_TIME_TICK_DURATION;

    let amplitude =
        0.46;

    /*
     * Slightly longer ticks at seconds 27 and 57,
     * inspired by the WWV simulator's pulse pattern.
     */
    if (
        second === 27 ||
        second === 57
    ) {
        duration =
            0.16;

        amplitude =
            0.62;
    }

    playArNetTimeTone(
        ARNET_TIME_TICK_FREQUENCY,
        duration,
        ARNET_TIME_TICK_VOLUME,
        amplitude
    );
}

function playArNetMinuteMarker(
    now
) {
    if (
        !arnetTimeAudioUnlocked
    ) {
        return;
    }

    const topOfHour =
        now.getUTCMinutes() ===
            0;

    const frequency =
        topOfHour
            ? ARNET_TIME_HOUR_FREQUENCY
            : ARNET_TIME_MINUTE_FREQUENCY;

    const duration =
        topOfHour
            ? ARNET_TIME_HOUR_DURATION
            : ARNET_TIME_MINUTE_DURATION;

    const volume =
        topOfHour
            ? ARNET_TIME_HOUR_VOLUME
            : ARNET_TIME_MINUTE_VOLUME;

    playArNetTimeTone(
        frequency,
        duration,
        volume,
        0.86
    );

    setArNetTimeText(
        "arnetTimeServiceState",
        topOfHour
            ? "HOUR MARK"
            : "MINUTE MARK"
    );

    setArNetTimeColor(
        "arnetTimeServiceState",
        "#FFFFFF"
    );

    setArNetTimeText(
        "arnetTimeServiceMessage",
        topOfHour
            ? "Exact UTC hour marker transmitted."
            : "Exact UTC minute marker transmitted."
    );

    setTimeout(
        () => {
            if (
                arnetTimeChannelActive
            ) {
                setArNetTimeText(
                    "arnetTimeServiceState",
                    "TIME LOCK"
                );

                setArNetTimeColor(
                    "arnetTimeServiceState",
                    "#00FF7F"
                );
            }
        },
        1200
    );
}

// ======================================================
// Generated tone playback
// ======================================================

function playArNetTimeTone(
    frequency,
    durationSeconds,
    volume,
    displayAmplitude
) {
    if (
        !arnetTimeChannelActive ||
        !arnetTimeAudioUnlocked ||
        !audioCtx
    ) {
        return;
    }

    const startTime =
        audioCtx.currentTime +
        0.006;

    const oscillator =
        audioCtx.createOscillator();

    const gain =
        audioCtx.createGain();

    oscillator.type =
        "sine";

    oscillator.frequency.setValueAtTime(
        frequency,
        startTime
    );

    gain.gain.setValueAtTime(
        0,
        startTime
    );

    gain.gain.linearRampToValueAtTime(
        volume,
        startTime +
            0.002
    );

    gain.gain.setValueAtTime(
        volume,
        Math.max(
            startTime +
                0.002,
            startTime +
                durationSeconds -
                0.003
        )
    );

    gain.gain.linearRampToValueAtTime(
        0,
        startTime +
            durationSeconds
    );

    oscillator.connect(
        gain
    );

    gain.connect(
        audioCtx.destination
    );

    oscillator.start(
        startTime
    );

    oscillator.stop(
        startTime +
            durationSeconds +
            0.01
    );

    arnetTimeToneSources.add(
        oscillator
    );

    scheduleArNetTimeToneDisplay(
        startTime,
        durationSeconds,
        displayAmplitude
    );

    oscillator.addEventListener(
        "ended",
        () => {
            arnetTimeToneSources.delete(
                oscillator
            );

            try {
                oscillator.disconnect();
                gain.disconnect();
            }
            catch {
                // Nodes may already be disconnected.
            }
        },
        {
            once: true
        }
    );
}

function scheduleArNetTimeToneDisplay(
    startTime,
    durationSeconds,
    amplitude
) {
    const startDelay =
        Math.max(
            0,
            (
                startTime -
                audioCtx.currentTime
            ) *
            1000
        );

    const endDelay =
        startDelay +
        (
            durationSeconds *
            1000
        );

    const startTimer =
        setTimeout(
            () => {
                arnetTimeToneDisplayTimers.delete(
                    startTimer
                );

                if (
                    !arnetTimeChannelActive
                ) {
                    return;
                }

                arnetTimeActiveDisplayTones++;

                serviceAudioAmplitude =
                    amplitude;

                if (
                    txtTxState &&
                    boxTxState
                ) {
                    txtTxState.textContent =
                        "TIME";

                    boxTxState.style.background =
                        "#665500";
                }
            },
            startDelay
        );

    const endTimer =
        setTimeout(
            () => {
                arnetTimeToneDisplayTimers.delete(
                    endTimer
                );

                arnetTimeActiveDisplayTones =
                    Math.max(
                        0,
                        arnetTimeActiveDisplayTones -
                            1
                    );

                if (
                    arnetTimeActiveDisplayTones ===
                        0 &&
                    !isArNetTimeVoicePlaying()
                ) {
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
            },
            endDelay
        );

    arnetTimeToneDisplayTimers.add(
        startTimer
    );

    arnetTimeToneDisplayTimers.add(
        endTimer
    );
}

function stopArNetTimeTones() {
    for (
        const source of
        arnetTimeToneSources
    ) {
        try {
            source.stop();
        }
        catch {
            // Source may already have ended.
        }
    }

    arnetTimeToneSources.clear();

    for (
        const timer of
        arnetTimeToneDisplayTimers
    ) {
        clearTimeout(
            timer
        );
    }

    arnetTimeToneDisplayTimers.clear();

    arnetTimeActiveDisplayTones =
        0;

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

// ======================================================
// DOM helpers
// ======================================================

function setArNetTimeText(
    id,
    value
) {
    const element =
        document.getElementById(
            id
        );

    if (element) {
        element.textContent =
            String(
                value
            );
    }
}

function setArNetTimeColor(
    id,
    value
) {
    const element =
        document.getElementById(
            id
        );

    if (element) {
        element.style.color =
            value;
    }
}

// ======================================================
// Initialization
// ======================================================

function initializeArNetTimeService() {
    createArNetTimePanel();

    const controls = [
        comboMode,
        comboBand,
        txtFrequency
    ];

    for (
        const control of
        controls
    ) {
        if (!control) {
            continue;
        }

        control.addEventListener(
            "change",
            evaluateArNetTimeChannel
        );

        control.addEventListener(
            "input",
            evaluateArNetTimeChannel
        );

        control.addEventListener(
            "blur",
            evaluateArNetTimeChannel
        );
    }

    evaluateArNetTimeChannel();
}

window.addEventListener(
    "DOMContentLoaded",
    initializeArNetTimeService
);

// ======================================================
// Console testing helpers
// ======================================================

window.activateArNetTimeChannel =
    activateArNetTimeChannel;

window.deactivateArNetTimeChannel =
    deactivateArNetTimeChannel;

window.enableArNetTimeAudio =
    enableArNetTimeAudio;

window.startArNetTimeAnnouncement =
    startArNetTimeAnnouncement;
