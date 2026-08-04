// ======================================================
// ArNet Transceiver
// UBA Weather Data Service
// Frequency: 2550 Vt
// Mode: ABM
// Band: UBA 2
// ======================================================

const ARNET_WEATHER_FREQUENCY =
    2550;

const ARNET_WEATHER_MODE =
    "ABM";

const ARNET_WEATHER_BAND =
    "UBA 2";

const ARNET_WEATHER_REFRESH_MS =
    10 * 60 * 1000;

const ARNET_WEATHER_MORSE_TEXT =
    "WX WX WX DE UBA-WD-001";

const ARNET_WEATHER_MORSE_INTERVAL_MS =
    60 * 1000;

const ARNET_WEATHER_MORSE_FREQUENCY =
    700;

const ARNET_WEATHER_MORSE_WPM =
    18;

const ARNET_WEATHER_ALERT_REFRESH_MS =
    60 * 1000;

const ARNET_WEATHER_ALERT_MORSE_TEXT =
    "WXA WXA DE UBA-WD-001";

const ARNET_WEATHER_NORMAL_BORDER =
    "1px solid #006688";

const ARNET_WEATHER_NORMAL_BACKGROUND =
    "#071015";

const ARNET_WEATHER_ALERT_BORDER =
    "2px solid #FF3300";

const ARNET_WEATHER_ALERT_BACKGROUND =
    "#250600";

let arnetWeatherMorseTimer =
    null;

let arnetWeatherMorseSources =
    new Set();

let arnetWeatherMorsePlaying =
    false;

let arnetWeatherAudioUnlocked =
    false;

let arnetWeatherAlertTimer =
    null;

let arnetWeatherAlertRequestRunning =
    false;

let arnetWeatherActiveAlerts =
    [];

let arnetWeatherLastAlertSignature =
    "";

let arnetWeatherAlertMorsePlaying =
    false;

/*
 * Default location:
 * Wheat Ridge, Colorado
 *
 * Change these values later to move the weather station.
 */
const ARNET_WEATHER_LOCATION = {
    name:
        "Wheat Ridge, Colorado",

    latitude:
        39.7661,

    longitude:
        -105.0772
};

let arnetWeatherPanel =
    null;

let arnetWeatherRefreshTimer =
    null;

let arnetWeatherRequestRunning =
    false;

let arnetWeatherChannelActive =
    false;

// ======================================================
// Weather-panel creation
// ======================================================

function createArNetWeatherPanel() {
    if (arnetWeatherPanel) {
        return arnetWeatherPanel;
    }

    const panel =
        document.createElement(
            "section"
        );

    panel.id =
        "arnetWeatherPanel";

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
        "1px solid #006688";

    panel.style.background =
        "#071015";

    panel.innerHTML = `
        <div
            style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:7px;
            "
        >
            <div>
                <div
                    style="
                        color:#00FFFF;
                        font-size:12px;
                        font-weight:bold;
                    "
                >
                    UBA WEATHER DATA SERVICE
                </div>

                <div
                    style="
                        color:#888888;
                        font-size:9px;
                        margin-top:2px;
                    "
                >
                    UBA-WD-001 · 2550 Vt · ABM / UBA 2
                </div>
            </div>

            <div
                id="weatherServiceState"
                style="
                    color:#FFD700;
                    font-size:9px;
                    font-weight:bold;
                "
            >
                STANDBY
            </div>
        </div>

        <div
            style="
                display:grid;
                grid-template-columns:
                    minmax(120px, 0.8fr)
                    minmax(180px, 1.5fr);
                gap:8px;
            "
        >
            <div
                style="
                    background:#050A0D;
                    border:1px solid #17323A;
                    padding:9px;
                "
            >
                <div
                    id="weatherLocation"
                    style="
                        color:#AAAAAA;
                        font-size:10px;
                    "
                >
                    ${escapeWeatherHtml(
                        ARNET_WEATHER_LOCATION.name
                    )}
                </div>

                <div
                    id="weatherTemperature"
                    style="
                        color:#00FFFF;
                        font-size:31px;
                        font-weight:bold;
                        margin-top:5px;
                    "
                >
                    --°F
                </div>

                <div
                    id="weatherCondition"
                    style="
                        color:#FFFFFF;
                        font-size:12px;
                        font-weight:bold;
                        min-height:18px;
                    "
                >
                    Waiting for data
                </div>

                <div
                    id="weatherFeelsLike"
                    style="
                        color:#888888;
                        font-size:9px;
                        margin-top:4px;
                    "
                >
                    Feels like: --
                </div>
            </div>

            <div
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(2, minmax(0, 1fr));
                    gap:5px;
                "
            >
                ${createWeatherDataCell(
                    "HUMIDITY",
                    "weatherHumidity"
                )}

                ${createWeatherDataCell(
                    "WIND",
                    "weatherWind"
                )}

                ${createWeatherDataCell(
                    "TODAY HIGH",
                    "weatherHigh"
                )}

                ${createWeatherDataCell(
                    "TONIGHT LOW",
                    "weatherLow"
                )}

                ${createWeatherDataCell(
                    "PRECIPITATION",
                    "weatherPrecipitation"
                )}

                ${createWeatherDataCell(
                    "UPDATED",
                    "weatherUpdated"
                )}
            </div>
        </div>

        <div
            id="weatherAlertBox"
            style="
                display:block;
                margin-top:7px;
                padding:8px;
                background:#080C0E;
                border:1px solid #294047;
                color:#AAAAAA;
            "
        >
            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:8px;
                "
            >
                <div
                    id="weatherAlertHeadline"
                    style="
                        color:#AAAAAA;
                        font-size:10px;
                        font-weight:bold;
                    "
                >
                    WEATHER ALERTS
                </div>

                <div
                    id="weatherAlertSeverity"
                    style="
                        color:#AAAAAA;
                        background:#182226;
                        padding:2px 5px;
                        font-size:8px;
                        font-weight:bold;
                    "
                >
                    CHECKING
                </div>
            </div>

            <div
                id="weatherAlertArea"
                style="
                    color:#77888C;
                    font-size:9px;
                    margin-top:4px;
                "
            >
                Checking active alerts for
                ${escapeWeatherHtml(
                    ARNET_WEATHER_LOCATION.name
                )}...
            </div>

            <div
                id="weatherAlertDescription"
                style="
                    color:#CCCCCC;
                    font-size:10px;
                    line-height:1.35;
                    margin-top:6px;
                    max-height:120px;
                    overflow-y:auto;
                    white-space:pre-wrap;
                "
            >
                Waiting for official alert data.
            </div>

            <div
                id="weatherAlertInstruction"
                style="
                    display:none;
                    color:#FFDD88;
                    font-size:9px;
                    line-height:1.35;
                    margin-top:6px;
                    padding-top:6px;
                    border-top:1px solid #773300;
                    white-space:pre-wrap;
                "
            >
            </div>

            <div
                id="weatherAlertCount"
                style="
                    color:#66777A;
                    font-size:8px;
                    margin-top:6px;
                "
            >
                Alert status not loaded yet.
            </div>
        </div>

        <button
            id="btnEnableWeatherAudio"
            type="button"
            style="
                width:100%;
                margin-top:7px;
                padding:6px;
                background:#004466;
                border:1px solid #0088AA;
                color:#FFFFFF;
                font-size:10px;
                font-weight:bold;
                cursor:pointer;
            "
        >
            ENABLE WEATHER MORSE AUDIO
        </button>

        <div
            id="weatherServiceMessage"
            style="
                color:#777777;
                font-size:9px;
                margin-top:6px;
            "
        >
            Tune to this data channel to receive live weather.
        </div>

        <div
            style="
                color:#555555;
                font-size:8px;
                margin-top:4px;
            "
        >
            Weather data: Open-Meteo · Alerts: National Weather Service
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

    arnetWeatherPanel =
        panel;

    const enableAudioButton =
        panel.querySelector(
            "#btnEnableWeatherAudio"
        );

    if (enableAudioButton) {
        enableAudioButton.addEventListener(
            "click",
            enableArNetWeatherAudio
        );
    }

    return panel;
}

function createWeatherDataCell(
    label,
    valueId
) {
    return `
        <div
            style="
                background:#050A0D;
                border:1px solid #17323A;
                padding:6px;
                min-height:38px;
            "
        >
            <div
                style="
                    color:#66777A;
                    font-size:8px;
                    font-weight:bold;
                "
            >
                ${label}
            </div>

            <div
                id="${valueId}"
                style="
                    color:#DDFFFF;
                    font-size:11px;
                    font-weight:bold;
                    margin-top:3px;
                "
            >
                --
            </div>
        </div>
    `;
}

// ======================================================
// Channel detection
// ======================================================

function isArNetWeatherChannelSelected() {
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
            ARNET_WEATHER_FREQUENCY &&
        mode ===
            ARNET_WEATHER_MODE &&
        band ===
            ARNET_WEATHER_BAND
                .toUpperCase()
    );
}

function evaluateArNetWeatherChannel() {
    /*
     * app.js may still be updating the frequency after
     * a mode or band change, so check on the next turn.
     */
    setTimeout(
        () => {
            if (
                isArNetWeatherChannelSelected()
            ) {
                activateArNetWeatherChannel();
            }
            else {
                deactivateArNetWeatherChannel();
            }
        },
        0
    );
}

// ======================================================
// Channel activation and shutdown
// ======================================================

function activateArNetWeatherChannel() {
    createArNetWeatherPanel();

    arnetWeatherPanel.style.display =
        "block";

    if (
        arnetWeatherChannelActive
    ) {
        return;
    }

    arnetWeatherChannelActive =
        true;

    setWeatherElementText(
        "weatherServiceState",
        "CONNECTING"
    );

    setWeatherElementColor(
        "weatherServiceState",
        "#FFD700"
    );

    setWeatherElementText(
        "weatherServiceMessage",
        "Connecting to UBA-WD-001..."
    );

    setWeatherElementText(
        "weatherAlertSeverity",
        "CHECKING"
    );

    fetchArNetWeatherData();

    fetchArNetWeatherAlerts();

    startArNetWeatherMorseService();

    clearInterval(
        arnetWeatherRefreshTimer
    );

    arnetWeatherRefreshTimer =
        setInterval(
            () => {
                if (
                    arnetWeatherChannelActive
                ) {
                    fetchArNetWeatherData();
                }
            },
            ARNET_WEATHER_REFRESH_MS
        );

    clearInterval(
        arnetWeatherAlertTimer
    );

    arnetWeatherAlertTimer =
        setInterval(
            () => {
                if (
                    arnetWeatherChannelActive
                ) {
                    fetchArNetWeatherAlerts();
                }
            },
            ARNET_WEATHER_ALERT_REFRESH_MS
        );
}

function deactivateArNetWeatherChannel() {
    arnetWeatherChannelActive =
        false;

    stopArNetWeatherMorseService();

    if (
        arnetWeatherRefreshTimer
    ) {
        clearInterval(
            arnetWeatherRefreshTimer
        );

        arnetWeatherRefreshTimer =
            null;
    }

    if (
        arnetWeatherAlertTimer
    ) {
        clearInterval(
            arnetWeatherAlertTimer
        );

        arnetWeatherAlertTimer =
            null;
    }

    if (arnetWeatherPanel) {
        arnetWeatherPanel.style.display =
            "none";
    }
}
// ======================================================
// Weather API
// ======================================================

async function fetchArNetWeatherData() {
    if (
        arnetWeatherRequestRunning ||
        !arnetWeatherChannelActive
    ) {
        return;
    }

    arnetWeatherRequestRunning =
        true;

    setWeatherElementText(
        "weatherServiceState",
        "UPDATING"
    );

    setWeatherElementColor(
        "weatherServiceState",
        "#FFD700"
    );

    try {
        const query =
            new URLSearchParams({
                latitude:
                    String(
                        ARNET_WEATHER_LOCATION
                            .latitude
                    ),

                longitude:
                    String(
                        ARNET_WEATHER_LOCATION
                            .longitude
                    ),

                current: [
                    "temperature_2m",
                    "relative_humidity_2m",
                    "apparent_temperature",
                    "weather_code",
                    "wind_speed_10m",
                    "wind_direction_10m"
                ].join(","),

                daily: [
                    "temperature_2m_max",
                    "temperature_2m_min",
                    "precipitation_probability_max"
                ].join(","),

                temperature_unit:
                    "fahrenheit",

                wind_speed_unit:
                    "mph",

                precipitation_unit:
                    "inch",

                timezone:
                    "auto",

                forecast_days:
                    "2"
            });

        const response =
            await fetch(
                `https://api.open-meteo.com/v1/forecast?${query}`
            );

        if (!response.ok) {
            throw new Error(
                `Weather API returned ${response.status}.`
            );
        }

        const data =
            await response.json();

        if (
            !arnetWeatherChannelActive
        ) {
            return;
        }

        renderArNetWeatherData(
            data
        );
    }
    catch (error) {
        console.error(
            "ArNet weather request failed:",
            error
        );

        setWeatherElementText(
            "weatherServiceState",
            "DATA ERROR"
        );

        setWeatherElementColor(
            "weatherServiceState",
            "#FF3333"
        );

        setWeatherElementText(
            "weatherCondition",
            "Weather unavailable"
        );

        setWeatherElementText(
            "weatherServiceMessage",
            error.message ||
            "The weather service could not be reached."
        );
    }
    finally {
        arnetWeatherRequestRunning =
            false;
    }
}

// ======================================================
// Official NWS weather alerts
// ======================================================

async function fetchArNetWeatherAlerts() {
    if (
        arnetWeatherAlertRequestRunning ||
        !arnetWeatherChannelActive
    ) {
        return;
    }

    arnetWeatherAlertRequestRunning =
        true;

    setWeatherElementText(
        "weatherAlertSeverity",
        "CHECKING"
    );

    try {
        const latitude =
            ARNET_WEATHER_LOCATION.latitude;

        const longitude =
            ARNET_WEATHER_LOCATION.longitude;

        const alertUrl =
            "https://api.weather.gov/alerts/active" +
            `?point=${latitude},${longitude}`;

        const response =
            await fetch(
                alertUrl,
                {
                    headers: {
                        Accept:
                            "application/geo+json"
                    },

                    cache:
                        "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                `NWS alert service returned ${response.status}.`
            );
        }

        const data =
            await response.json();

        if (
            !arnetWeatherChannelActive
        ) {
            return;
        }

        const alerts =
            Array.isArray(
                data.features
            )
                ? data.features
                    .map(
                        normalizeArNetWeatherAlert
                    )
                    .filter(
                        Boolean
                    )
                : [];

        alerts.sort(
            compareArNetWeatherAlerts
        );

        renderArNetWeatherAlerts(
            alerts
        );
    }
    catch (error) {
        console.error(
            "ArNet NWS alert request failed:",
            error
        );

        renderArNetWeatherAlertError(
            error
        );
    }
    finally {
        arnetWeatherAlertRequestRunning =
            false;
    }
}

function normalizeArNetWeatherAlert(
    feature
) {
    const properties =
        feature?.properties;

    if (!properties) {
        return null;
    }

    return {
        id:
            String(
                feature.id ||
                properties.id ||
                ""
            ),

        event:
            String(
                properties.event ||
                "Weather Alert"
            ),

        headline:
            String(
                properties.headline ||
                properties.event ||
                "Weather Alert"
            ),

        severity:
            String(
                properties.severity ||
                "Unknown"
            ),

        urgency:
            String(
                properties.urgency ||
                "Unknown"
            ),

        area:
            String(
                properties.areaDesc ||
                ARNET_WEATHER_LOCATION.name
            ),

        description:
            cleanArNetWeatherAlertText(
                properties.description
            ),

        instruction:
            cleanArNetWeatherAlertText(
                properties.instruction
            ),

        sent:
            properties.sent ||
            "",

        expires:
            properties.expires ||
            ""
    };
}

function cleanArNetWeatherAlertText(
    value
) {
    return String(
        value ||
        ""
    )
        .replace(
            /\r\n/g,
            "\n"
        )
        .replace(
            /\n{3,}/g,
            "\n\n"
        )
        .trim();
}

function getArNetWeatherAlertPriority(
    alert
) {
    const severityPriority = {
        Extreme:
            4,

        Severe:
            3,

        Moderate:
            2,

        Minor:
            1,

        Unknown:
            0
    };

    const urgencyPriority = {
        Immediate:
            4,

        Expected:
            3,

        Future:
            2,

        Past:
            1,

        Unknown:
            0
    };

    return (
        (
            severityPriority[
                alert.severity
            ] || 0
        ) *
        10
    ) +
    (
        urgencyPriority[
            alert.urgency
        ] || 0
    );
}

function compareArNetWeatherAlerts(
    first,
    second
) {
    return (
        getArNetWeatherAlertPriority(
            second
        ) -
        getArNetWeatherAlertPriority(
            first
        )
    );
}

// ======================================================
// Weather rendering
// ======================================================

function renderArNetWeatherData(
    data
) {
    const current =
        data.current ||
        {};

    const daily =
        data.daily ||
        {};

    const weatherDescription =
        describeArNetWeatherCode(
            Number(
                current.weather_code
            )
        );

    const windDirection =
        formatArNetWindDirection(
            Number(
                current.wind_direction_10m
            )
        );

    setWeatherElementText(
        "weatherLocation",
        ARNET_WEATHER_LOCATION.name
    );

    setWeatherElementText(
        "weatherTemperature",
        formatWeatherTemperature(
            current.temperature_2m
        )
    );

    setWeatherElementText(
        "weatherCondition",
        weatherDescription
    );

    setWeatherElementText(
        "weatherFeelsLike",
        `Feels like: ${
            formatWeatherTemperature(
                current.apparent_temperature
            )
        }`
    );

    setWeatherElementText(
        "weatherHumidity",
        Number.isFinite(
            Number(
                current.relative_humidity_2m
            )
        )
            ? `${Math.round(
                Number(
                    current.relative_humidity_2m
                )
            )}%`
            : "--"
    );

    setWeatherElementText(
        "weatherWind",
        `${
            windDirection
        } ${
            formatWeatherNumber(
                current.wind_speed_10m,
                0
            )
        } mph`
    );

    setWeatherElementText(
        "weatherHigh",
        formatWeatherTemperature(
            daily.temperature_2m_max?.[0]
        )
    );

    setWeatherElementText(
        "weatherLow",
        formatWeatherTemperature(
            daily.temperature_2m_min?.[0]
        )
    );

    setWeatherElementText(
        "weatherPrecipitation",
        Number.isFinite(
            Number(
                daily
                    .precipitation_probability_max
                    ?.[0]
            )
        )
            ? `${Math.round(
                Number(
                    daily
                        .precipitation_probability_max
                        ?.[0]
                )
            )}%`
            : "--"
    );

    const updatedTime =
        current.time
            ? new Date(
                current.time
            )
            : new Date();

    setWeatherElementText(
        "weatherUpdated",
        Number.isNaN(
            updatedTime.getTime()
        )
            ? "--"
            : updatedTime
                .toLocaleTimeString(
                    [],
                    {
                        hour:
                            "numeric",

                        minute:
                            "2-digit"
                    }
                )
    );

    setWeatherElementText(
        "weatherServiceState",
        "DATA LOCK"
    );

    setWeatherElementColor(
        "weatherServiceState",
        "#00FF7F"
    );

    setWeatherElementText(
        "weatherServiceMessage",
        "Live weather received. Automatic refresh every 10 minutes."
    );
}

function renderArNetWeatherAlerts(
    alerts
) {
    arnetWeatherActiveAlerts =
        alerts;

    if (!alerts.length) {
        renderNoArNetWeatherAlerts();

        return;
    }

    const primaryAlert =
        alerts[0];

    if (arnetWeatherPanel) {
        arnetWeatherPanel.style.border =
            ARNET_WEATHER_ALERT_BORDER;

        arnetWeatherPanel.style.background =
            ARNET_WEATHER_ALERT_BACKGROUND;
    }

    const alertBox =
        document.getElementById(
            "weatherAlertBox"
        );

    if (alertBox) {
        alertBox.style.background =
            "#331000";

        alertBox.style.border =
            "1px solid #AA3300";
    }

    setWeatherElementText(
        "weatherAlertHeadline",
        primaryAlert.headline
    );

    setWeatherElementColor(
        "weatherAlertHeadline",
        "#FF6633"
    );

    setWeatherElementText(
        "weatherAlertSeverity",
        primaryAlert.severity
            .toUpperCase()
    );

    setWeatherElementColor(
        "weatherAlertSeverity",
        "#FFFFFF"
    );

    const severityElement =
        document.getElementById(
            "weatherAlertSeverity"
        );

    if (severityElement) {
        severityElement.style.background =
            "#881100";
    }

    setWeatherElementText(
        "weatherAlertArea",
        primaryAlert.area
    );

    setWeatherElementColor(
        "weatherAlertArea",
        "#FFCC99"
    );

    setWeatherElementText(
        "weatherAlertDescription",
        primaryAlert.description ||
        "No alert description was supplied."
    );

    setWeatherElementColor(
        "weatherAlertDescription",
        "#FFFFFF"
    );

    const instructionElement =
        document.getElementById(
            "weatherAlertInstruction"
        );

    if (instructionElement) {
        if (
            primaryAlert.instruction
        ) {
            instructionElement.style.display =
                "block";

            instructionElement.textContent =
                "INSTRUCTIONS:\n" +
                primaryAlert.instruction;
        }
        else {
            instructionElement.style.display =
                "none";

            instructionElement.textContent =
                "";
        }
    }

    setWeatherElementText(
        "weatherAlertCount",
        createArNetWeatherAlertSummary(
            alerts,
            primaryAlert
        )
    );

    setWeatherElementColor(
        "weatherAlertCount",
        "#CC8866"
    );

    setWeatherElementText(
        "weatherServiceState",
        "WEATHER ALERT"
    );

    setWeatherElementColor(
        "weatherServiceState",
        "#FF5533"
    );
}

function renderNoArNetWeatherAlerts() {
    if (arnetWeatherPanel) {
        arnetWeatherPanel.style.border =
            ARNET_WEATHER_NORMAL_BORDER;

        arnetWeatherPanel.style.background =
            ARNET_WEATHER_NORMAL_BACKGROUND;
    }

    const alertBox =
        document.getElementById(
            "weatherAlertBox"
        );

    if (alertBox) {
        alertBox.style.background =
            "#080C0E";

        alertBox.style.border =
            "1px solid #294047";
    }

    setWeatherElementText(
        "weatherAlertHeadline",
        "WEATHER ALERTS"
    );

    setWeatherElementColor(
        "weatherAlertHeadline",
        "#AAAAAA"
    );

    setWeatherElementText(
        "weatherAlertSeverity",
        "CLEAR"
    );

    setWeatherElementColor(
        "weatherAlertSeverity",
        "#00FF7F"
    );

    const severityElement =
        document.getElementById(
            "weatherAlertSeverity"
        );

    if (severityElement) {
        severityElement.style.background =
            "#123322";
    }

    setWeatherElementText(
        "weatherAlertArea",
        ARNET_WEATHER_LOCATION.name
    );

    setWeatherElementColor(
        "weatherAlertArea",
        "#77888C"
    );

    setWeatherElementText(
        "weatherAlertDescription",
        "No active National Weather Service alerts."
    );

    setWeatherElementColor(
        "weatherAlertDescription",
        "#CCCCCC"
    );

    const instructionElement =
        document.getElementById(
            "weatherAlertInstruction"
        );

    if (instructionElement) {
        instructionElement.style.display =
            "none";

        instructionElement.textContent =
            "";
    }

    setWeatherElementText(
        "weatherAlertCount",
        "0 active alerts."
    );

    setWeatherElementColor(
        "weatherAlertCount",
        "#66777A"
    );

    setWeatherElementText(
        "weatherServiceState",
        "DATA LOCK"
    );

    setWeatherElementColor(
        "weatherServiceState",
        "#00FF7F"
    );
}

function renderArNetWeatherAlertError(
    error
) {
    setWeatherElementText(
        "weatherAlertHeadline",
        "WEATHER ALERTS"
    );

    setWeatherElementText(
        "weatherAlertSeverity",
        "ERROR"
    );

    setWeatherElementColor(
        "weatherAlertSeverity",
        "#FF3333"
    );

    setWeatherElementText(
        "weatherAlertArea",
        ARNET_WEATHER_LOCATION.name
    );

    setWeatherElementText(
        "weatherAlertDescription",
        "Official alert data could not be loaded."
    );

    setWeatherElementText(
        "weatherAlertCount",
        error?.message ||
        "Alert service unavailable."
    );
}

function createArNetWeatherAlertSummary(
    alerts,
    primaryAlert
) {
    const alertCountText =
        alerts.length === 1
            ? "1 active alert."
            : `${alerts.length} active alerts.`;

    if (!primaryAlert.expires) {
        return alertCountText;
    }

    const expiration =
        new Date(
            primaryAlert.expires
        );

    if (
        Number.isNaN(
            expiration.getTime()
        )
    ) {
        return alertCountText;
    }

    return (
        `${alertCountText} Primary alert expires ` +
        expiration.toLocaleString(
            [],
            {
                weekday:
                    "short",

                hour:
                    "numeric",

                minute:
                    "2-digit"
            }
        ) +
        "."
    );
}

// ======================================================
// Weather-code helpers
// ======================================================

function describeArNetWeatherCode(
    code
) {
    const descriptions = {
        0:
            "Clear sky",

        1:
            "Mostly clear",

        2:
            "Partly cloudy",

        3:
            "Overcast",

        45:
            "Fog",

        48:
            "Freezing fog",

        51:
            "Light drizzle",

        53:
            "Drizzle",

        55:
            "Heavy drizzle",

        56:
            "Freezing drizzle",

        57:
            "Heavy freezing drizzle",

        61:
            "Light rain",

        63:
            "Rain",

        65:
            "Heavy rain",

        66:
            "Freezing rain",

        67:
            "Heavy freezing rain",

        71:
            "Light snow",

        73:
            "Snow",

        75:
            "Heavy snow",

        77:
            "Snow grains",

        80:
            "Light rain showers",

        81:
            "Rain showers",

        82:
            "Heavy rain showers",

        85:
            "Snow showers",

        86:
            "Heavy snow showers",

        95:
            "Thunderstorm",

        96:
            "Thunderstorm with hail",

        99:
            "Severe thunderstorm with hail"
    };

    return descriptions[code] ||
        "Unknown conditions";
}

function formatArNetWindDirection(
    degrees
) {
    if (
        !Number.isFinite(
            degrees
        )
    ) {
        return "--";
    }

    const directions = [
        "N",
        "NNE",
        "NE",
        "ENE",
        "E",
        "ESE",
        "SE",
        "SSE",
        "S",
        "SSW",
        "SW",
        "WSW",
        "W",
        "WNW",
        "NW",
        "NNW"
    ];

    const index =
        Math.round(
            (
                (
                    degrees %
                    360
                ) /
                22.5
            )
        ) %
        16;

    return directions[index];
}

function formatWeatherTemperature(
    value
) {
    const number =
        Number(
            value
        );

    return Number.isFinite(
        number
    )
        ? `${Math.round(
            number
        )}°F`
        : "--°F";
}

function formatWeatherNumber(
    value,
    decimals = 0
) {
    const number =
        Number(
            value
        );

    return Number.isFinite(
        number
    )
        ? number.toFixed(
            decimals
        )
        : "--";
}

// ======================================================
// DOM helpers
// ======================================================

function setWeatherElementText(
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

function setWeatherElementColor(
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

function escapeWeatherHtml(
    value
) {
    return String(
        value
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            "\"",
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

async function enableArNetWeatherAudio() {
    try {
        initAudioContext();

        if (!audioCtx) {
            throw new Error(
                "Audio context could not be created."
            );
        }

        if (
            audioCtx.state ===
                "suspended"
        ) {
            await audioCtx.resume();
        }

        arnetWeatherAudioUnlocked =
            audioCtx.state ===
            "running";

        const button =
            document.getElementById(
                "btnEnableWeatherAudio"
            );

        if (
            arnetWeatherAudioUnlocked
        ) {
            if (button) {
                button.textContent =
                    "WEATHER AUDIO ENABLED";

                button.disabled =
                    true;

                button.style.background =
                    "#164422";

                button.style.cursor =
                    "default";
            }

            setWeatherElementText(
                "weatherServiceMessage",
                "Weather Morse audio enabled."
            );

            if (
                arnetWeatherChannelActive
            ) {
                await playArNetWeatherMorseIdent();
            }
        }
        else {
            throw new Error(
                "The browser kept audio suspended."
            );
        }
    }
    catch (error) {
        console.error(
            "Could not enable weather audio:",
            error
        );

        setWeatherElementText(
            "weatherServiceMessage",
            "Click again to allow weather audio."
        );
    }
}

// ======================================================
// Weather-channel Morse identification
// ======================================================

function getArNetWeatherMorseUnitSeconds() {
    return (
        1.2 /
        ARNET_WEATHER_MORSE_WPM
    );
}

async function playArNetWeatherMorseIdent() {
   if (
    !arnetWeatherChannelActive ||
    arnetWeatherMorsePlaying ||
    !arnetWeatherAudioUnlocked
) {
    return;
}

    if (
        typeof textToMorse !==
            "function"
    ) {
        console.warn(
            "Weather Morse ID unavailable: " +
            "morse.js has not loaded."
        );

        return;
    }

    initAudioContext();

    if (!audioCtx) {
        return;
    }

    try {
        if (
            audioCtx.state ===
                "suspended"
        ) {
            await audioCtx.resume();
        }
    }
    catch (error) {
        console.warn(
            "Weather Morse audio could not start:",
            error
        );

        return;
    }

    if (
        !arnetWeatherChannelActive
    ) {
        return;
    }

    arnetWeatherMorsePlaying =
        true;

    const unit =
        getArNetWeatherMorseUnitSeconds();

    const morse =
        textToMorse(
            ARNET_WEATHER_MORSE_TEXT
        );

    let scheduledTime =
        audioCtx.currentTime +
        0.08;

    /*
     * textToMorse() produces:
     *
     * one space between Morse letters
     * three spaces between words
     */
    const tokens =
        morse.split(
            /(\s+)/
        );

    for (
        const token of
        tokens
    ) {
        if (
            !arnetWeatherChannelActive
        ) {
            break;
        }

        if (
            !token
        ) {
            continue;
        }

        if (
            /^\s+$/.test(
                token
            )
        ) {
            /*
             * A single separator represents the normal
             * three-unit gap between letters.
             *
             * Longer separators represent the seven-unit
             * gap between words.
             */
            scheduledTime +=
                token.length >= 3
                    ? unit * 7
                    : unit * 3;

            continue;
        }

        for (
            let index = 0;
            index < token.length;
            index++
        ) {
            const symbol =
                token[index];

            const toneDuration =
                symbol === "-"
                    ? unit * 3
                    : unit;

            scheduleArNetWeatherMorseTone(
                scheduledTime,
                toneDuration
            );

            scheduledTime +=
                toneDuration;

            /*
             * One Morse unit between symbols in the same
             * letter.
             */
            if (
                index <
                token.length - 1
            ) {
                scheduledTime +=
                    unit;
            }
        }
    }

    const playbackDurationMs =
        Math.max(
            0,
            (
                scheduledTime -
                audioCtx.currentTime
            ) *
            1000
        );

    setWeatherElementText(
        "weatherServiceMessage",
        `Morse ID: ${ARNET_WEATHER_MORSE_TEXT}`
    );

    setTimeout(
        () => {
            arnetWeatherMorsePlaying =
                false;

            if (
                arnetWeatherChannelActive
            ) {
                setWeatherElementText(
                    "weatherServiceMessage",
                    "Live weather received. " +
                    "Automatic refresh every 10 minutes."
                );
            }
        },
        playbackDurationMs + 100
    );
}

function scheduleArNetWeatherMorseTone(
    startTime,
    durationSeconds
) {
    const oscillator =
        audioCtx.createOscillator();

    const gain =
        audioCtx.createGain();

    oscillator.type =
        "sine";

    oscillator.frequency.setValueAtTime(
        ARNET_WEATHER_MORSE_FREQUENCY,
        startTime
    );

    /*
     * Short fade-in and fade-out prevents clicks.
     */
    gain.gain.setValueAtTime(
        0,
        startTime
    );

    gain.gain.linearRampToValueAtTime(
        0.18,
        startTime + 0.004
    );

    gain.gain.setValueAtTime(
        0.18,
        Math.max(
            startTime + 0.004,
            startTime +
                durationSeconds -
                0.004
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

    arnetWeatherMorseSources.add(
        oscillator
    );

    oscillator.addEventListener(
        "ended",
        () => {
            arnetWeatherMorseSources.delete(
                oscillator
            );

            oscillator.disconnect();
            gain.disconnect();
        },
        {
            once: true
        }
    );
}

function startArNetWeatherMorseService() {
    stopArNetWeatherMorseService();

    /*
     * Give the dashboard a moment to finish tuning before
     * playing the first station identification.
     */
    setTimeout(
        () => {
            if (
                arnetWeatherChannelActive
            ) {
                playArNetWeatherMorseIdent();
            }
        },
        1500
    );

    arnetWeatherMorseTimer =
        setInterval(
            () => {
                if (
                    arnetWeatherChannelActive
                ) {
                    playArNetWeatherMorseIdent();
                }
            },
            ARNET_WEATHER_MORSE_INTERVAL_MS
        );
}

function stopArNetWeatherMorseService() {
    if (
        arnetWeatherMorseTimer
    ) {
        clearInterval(
            arnetWeatherMorseTimer
        );

        arnetWeatherMorseTimer =
            null;
    }

    for (
        const source of
        arnetWeatherMorseSources
    ) {
        try {
            source.stop();
        }
        catch {
            // It may already have finished.
        }
    }

    arnetWeatherMorseSources.clear();

    arnetWeatherMorsePlaying =
        false;
}

// ======================================================
// Initialization
// ======================================================

function initializeArNetWeatherService() {
    createArNetWeatherPanel();

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
            evaluateArNetWeatherChannel
        );

        control.addEventListener(
            "input",
            evaluateArNetWeatherChannel
        );

        control.addEventListener(
            "blur",
            evaluateArNetWeatherChannel
        );
    }

    evaluateArNetWeatherChannel();
}

window.addEventListener(
    "DOMContentLoaded",
    initializeArNetWeatherService
);
