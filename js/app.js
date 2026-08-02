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

        comboBand.selectedIndex = 0;

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
        case "ALFRS":
            minFreq = 3050;
            maxFreq = 4455;
            break;

        case "SOLIDBAND":
            minFreq = 4550;
            maxFreq = 6000;
            break;

        case "AHFRS 1 (Low)":
            minFreq = 6500;
            maxFreq = 7500;
            break;

        case "AHFRS 1 (High)":
            minFreq = 7500;
            maxFreq = 8000;
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

    txtFrequency.value = String(minFreq);

    setStatus(
        `Band [${selectedBand}] Active (${minFreq} - ${maxFreq} Vt)`,
        "#00FFFF"
    );
}

function validateFrequency() {
    const value =
        Number.parseInt(
            txtFrequency.value,
            10
        );

    if (
        !Number.isFinite(value) ||
        value < minFreq
    ) {
        txtFrequency.value =
            String(minFreq);

        return;
    }

    if (value > maxFreq) {
        txtFrequency.value =
            String(maxFreq);
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

    connectArNetNetwork();
    
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
}

window.addEventListener(
    "DOMContentLoaded",
    initializeApplication
);
