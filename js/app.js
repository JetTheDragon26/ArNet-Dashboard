// ======================================================
// ArNet Transceiver
// Main Application
// ======================================================

function initializeApplication() {

    console.log("======================================");
    console.log("ArNet Transceiver Starting...");
    console.log("AMMEF Version:", AMMEF_MEDIA_VERSION);
    console.log("======================================");

    // Create AudioContext
    initAudioContext();

    // Populate modes/bands
    updateBandList();

    // Set carrier slider text
    updateCarrierDisplay();

    // Hook up every UI button
    initializeUIControls();

    // Start clock
    updateClock();
    setInterval(updateClock, 1000);

    // Start spectrum/waterfall
    startDisplayLoop();

    txtStatus.textContent =
        "STATUS: ArNet Ready";

    txtStatus.style.color =
        "#00FF7F";
}

window.addEventListener(
    "load",
    initializeApplication
);
