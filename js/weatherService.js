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
                display:none;
                margin-top:7px;
                padding:7px;
                background:#331000;
                border:1px solid #AA3300;
                color:#FFAA66;
                font-size:10px;
                font-weight:bold;
            "
        >
            WEATHER ALERT
        </div>

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
            Weather data: Open-Meteo
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
        "DATA LOCK"
    );

    setWeatherElementColor(
        "weatherServiceState",
        "#00FF7F"
    );

    setWeatherElementText(
        "weatherServiceMessage",
        "Receiving current weather data..."
    );

    fetchArNetWeatherData();

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
}

function deactivateArNetWeatherChannel() {
    arnetWeatherChannelActive =
        false;

    if (
        arnetWeatherRefreshTimer
    ) {
        clearInterval(
            arnetWeatherRefreshTimer
        );

        arnetWeatherRefreshTimer =
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
