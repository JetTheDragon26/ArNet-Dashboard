// ======================================================
// ArNet Transceiver
// Global Variables & UI References
// ======================================================

// ---------- Audio ----------
let audioCtx = null;
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];

let lastCleanAudioBlob = null;
let lastModulatedAudioBlob = null;
let lastTelemetryAudioBlob = null;

let lastProcessedAudioBlob = null;
let lastAudioPcmArray = null;
let lastDecodedMorseText = "";
// ---------- AMMEF ----------
let lastAMMEFData = null;
let ammefVersion = "2.3";

let lastLoadedAMMEFMetadata = null;

let lastLoadedAMMEFCleanBlob = null;
let lastLoadedAMMEFMonitorBlob = null;
let lastLoadedAMMEFTelemetryBlob = null;

let lastLoadedAMMEFVideoMonitorBlob = null;
let lastLoadedAMMEFPhotoMonitorBlob = null;

let lastLoadedAMMEFVideoBlob = null;
let lastLoadedAMMEFVideoName = null;
let lastLoadedAMMEFVideoType = null;

let lastLoadedAMMEFPhotoBlob = null;
let lastLoadedAMMEFPhotoName = null;
let lastLoadedAMMEFPhotoType = null;

// ---------- Playback ----------
let isPlaying = false;
let playbackStartTime = 0;
let currentAmplitude = 0.02;
let currentAudioElement = null;
let currentAudioUrl = null;
let audioPlaybackQueue = [];
let audioQueueRunning = false;

// ---------- Automated service display audio ----------
let serviceAudioAmplitude =
    0;

let serviceAudioActiveTones =
    0;

// ---------- Frequency ----------
let minFreq = 4550;
let maxFreq = 6000;

// ---------- Video ----------
let lastOriginalVideoBlob = null;
let lastOriginalVideoType = null;
let lastOriginalVideoName = null;

let lastVideoMonitorAudioBlob = null;
let lastVideoMetadata = null;

// ---------- Photo ----------
let lastOriginalPhotoBlob = null;
let lastOriginalPhotoType = null;
let lastOriginalPhotoName = null;

let lastPhotoMonitorAudioBlob = null;
let lastPhotoMetadata = null;

// ---------- Networking ----------
let networkSocket = null;
let networkConnected = false;

let networkServerUrl =
    "wss://arnet-dashboard-server.onrender.com";

let networkStationId = null;
let networkCurrentFrequency = 4550;

let networkTargetMode = "channel";
let networkDirectTarget = "";

let networkListenerCount = 0;
let networkBusy = false;

// ---------- Display ----------
let isScopeMode = true;

// ---------- UI References ----------
const comboMode =
    document.getElementById("comboMode");

const comboBand =
    document.getElementById("comboBand");

const comboChannelSector =
    document.getElementById("comboChannelSector");

const comboBandwidth =
    document.getElementById("comboBandwidth");

const txtFrequency =
    document.getElementById("txtFrequency");

const txtStatus =
    document.getElementById("txtStatus");

const txtClock =
    document.getElementById("txtClock");

const txtTxState =
    document.getElementById("txtTxState");

const boxTxState =
    document.getElementById("boxTxState");

const txtCarrierVal =
    document.getElementById("txtCarrierVal");

const sliderCarrier =
    document.getElementById("sliderCarrier");

const lblScopeMode =
    document.getElementById("lblScopeMode");

const txtVideoLegend =
    document.getElementById("txtVideoLegend");

// ---------- Buttons ----------
const btnPtt =
    document.getElementById("btnPtt");

const btnIdent =
    document.getElementById("btnIdent");

const btnLoad =
    document.getElementById("btnLoad");

const btnLoadAMMEF =
    document.getElementById("btnLoadAMMEF");

const btnTransmitAMMEF =
    document.getElementById("btnTransmitAMMEF");

const fileTransmitAMMEF =
    document.getElementById("fileTransmitAMMEF");

const btnSave =
    document.getElementById("btnSave");

const btnLoadVideo =
    document.getElementById("btnLoadVideo");

const btnToggleDisplay =
    document.getElementById("btnToggleDisplay");

// ---------- Other Controls ----------
const txtCallsign =
    document.getElementById("txtCallsign");

const chkUnencoded =
    document.getElementById("chkUnencoded");
const txtMorseMessage =
    document.getElementById(
        "txtMorseMessage"
    );

const btnSendMorse =
    document.getElementById(
        "btnSendMorse"
    );
const txtMorseDecode =
    document.getElementById(
        "txtMorseDecode"
    );

const txtMorseDecodeInfo =
    document.getElementById(
        "txtMorseDecodeInfo"
    );

const btnClearMorseDecode =
    document.getElementById(
        "btnClearMorseDecode"
    );
// ---------- Canvases ----------
const canvasScope =
    document.getElementById("canvasScope");

const imgWaterfall =
    document.getElementById("imgWaterfall");

const canvasMeter =
    document.getElementById("canvasMeter");

const canvasOffsetMeter =
    document.getElementById("canvasOffsetMeter");

// ---------- Canvas Contexts ----------
const scopeCtx =
    canvasScope.getContext("2d");

const wfCtx =
    imgWaterfall.getContext("2d");

const meterCtx =
    canvasMeter.getContext("2d");

const offsetMeterCtx =
    canvasOffsetMeter.getContext("2d");

// ---------- Waterfall Buffer ----------
const wfWidth = 160;
const wfHeight = 80;

const wfOffscreen =
    document.createElement("canvas");

wfOffscreen.width = wfWidth;
wfOffscreen.height = wfHeight;

const wfOffCtx =
    wfOffscreen.getContext("2d");

const wfPixelData =
    wfOffCtx.createImageData(
        wfWidth,
        wfHeight
    );
