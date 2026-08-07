// ======================================================
// ArNet Transceiver
// Main Application
// ======================================================

function updateClock() {
    const now = new Date();

    txtClock.textContent =
        now.toTimeString().split(" ")[0];
}

function updateBandList() {
    const mode = comboMode.value;

    comboBand.innerHTML = "";

    const addOption = text => {
        const option =
            document.createElement("option");

        option.value = text;
        option.textContent = text;

        comboBand.appendChild(option);
    };

    if (mode === "AARM") {
        addOption("ALFRS");
        addOption("SOLIDBAND");
        addOption("AHFRS 2");
        addOption("ATF 1");

        comboBand.selectedIndex = 1;

        setButtonEnabled(btnLoad, false);

        txtVideoLegend.style.display = "none";
    }
else if (mode === "ABM") {

    addOption("AHFRS 1 (Low)");
    addOption("UBA 2");

    comboBand.value = "AHFRS 1 (Low)";

    setButtonEnabled(btnLoad, true);

    txtVideoLegend.style.display = "none";
}
    
    else if (mode === "ABMTV") {
        addOption("AHFRS 1 (High)");

        comboBand.selectedIndex = 0;

        setButtonEnabled(btnLoad, true);

        txtVideoLegend.style.display = "inline";
    }

    updateFrequencyLimits();
}

function updateFrequencyLimits() {
    const selectedBand = comboBand.value;

    switch (selectedBand) {
        case "UBA 2":
            minFreq = 1800;
            maxFreq = 3049;
            break;    
        case "ALFRS":
            minFreq = 3055;
            maxFreq = 4455;
            break;

        case "SOLIDBAND":
            minFreq = 4550;
            maxFreq = 6000;
            break;

        case "AHFRS 1 (Low)":
            minFreq = 6500;
            maxFreq = 7499;
            break;

        case "AHFRS 1 (High)":
            minFreq = 7500;
            maxFreq = 7999;
            break;

        case "AHFRS 2":
            minFreq = 8000;
            maxFreq = 8300;
            break;

        case "ATF 1":
            minFreq = 8340;
            maxFreq = 9120;
            break;

        default:
            minFreq = 4550;
            maxFreq = 6000;
            break;
    }

    txtFrequency.value = Number(minFreq).toFixed(2);

    setStatus(
        `Band [${selectedBand}] Active (${minFreq} - ${maxFreq} Vt)`,
        "#00FFFF"
    );
}

function validateFrequency() {
    let value =
        Number.parseFloat(
            txtFrequency.value
        );

    if (
        !Number.isFinite(value) ||
        value < minFreq
    ) {
        value =
            minFreq;
    }

    if (
        value >
        maxFreq + 0.99
    ) {
        value =
            maxFreq + 0.99;
    }

    value =
        Math.round(
            value * 100
        ) / 100;

    /*
     * THIS makes the textbox display XXXX.xx
     */
    txtFrequency.value =
        value.toFixed(2);

    if (
        typeof tuneNetworkFrequency ===
            "function"
    ) {
        tuneNetworkFrequency(
            value
        );
    }

    if (
        typeof updateNetworkRegistration ===
            "function"
    ) {
        updateNetworkRegistration();
    }
}

function initializeApplication() {
    comboMode.addEventListener(
        "change",
        updateBandList
    );

    comboBand.addEventListener(
        "change",
        updateFrequencyLimits
    );

    txtFrequency.addEventListener(
        "blur",
        validateFrequency
    );

    initializeUIControls();

/*
 * Start the normal dashboard before attempting
 * the optional network connection.
 */
updateBandList();
updateClock();

setInterval(
    updateClock,
    1000
);

startDisplayLoop();

setStatus(
    "ArNet ready.",
    "#00FF7F"
);

try {
    connectArNetNetwork();
}
catch (error) {
    console.error(
        "Network startup failed:",
        error
    );

    setStatus(
        "ArNet ready — relay unavailable.",
        "#FFAA00"
    );
}
}

window.addEventListener(
    "DOMContentLoaded",
    initializeApplication
);
