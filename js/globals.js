// ======================================================
// ArNet Transceiver
// Global Variables & UI References
// ======================================================

// ---------- Audio ----------
let audioCtx = null;
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];

// Clean/original audio stored in AMMEF
let lastCleanAudioBlob = null;

// FM-modulated audio used for local monitoring
let lastModulatedAudioBlob = null;

// General compatibility reference
let lastProcessedAudioBlob = null;
let lastAudioPcmArray = null;

let lastLoadedAMMEFMetadata = null;
let lastLoadedAMMEFCleanBlob = null;
let lastLoadedAMMEFMonitorBlob = null;
let lastAMMEFData = null;
let ammefVersion = "1.0";
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

// ---------- Frequency ----------
let minFreq = 4550;
let maxFreq = 6000;

// ------------Video------------ 
let lastOriginalVideoBlob = null;
let lastOriginalVideoType = null;
let lastOriginalVideoName = null;

let lastVideoMonitorAudioBlob = null;
let lastVideoMetadata = null;

// ------------Photo------------
let lastOriginalPhotoBlob = null;
let lastOriginalPhotoType = null;
let lastOriginalPhotoName = null;

let lastPhotoMonitorAudioBlob = null;
let lastPhotoMetadata = null;

// ---------- Display ----------
let isScopeMode = true;

// ---------- UI References ----------
const comboMode = document.getElementById("comboMode");
const comboBand = document.getElementById("comboBand");
const comboBandwidth = document.getElementById("comboBandwidth");

const txtFrequency = document.getElementById("txtFrequency");
const txtStatus = document.getElementById("txtStatus");
const txtClock = document.getElementById("txtClock");

const txtTxState = document.getElementById("txtTxState");
const boxTxState = document.getElementById("boxTxState");

const txtCarrierVal = document.getElementById("txtCarrierVal");
const sliderCarrier = document.getElementById("sliderCarrier");

const lblScopeMode = document.getElementById("lblScopeMode");
const txtVideoLegend = document.getElementById("txtVideoLegend");

// ---------- Buttons ----------
const btnPtt = document.getElementById("btnPtt");
const btnIdent = document.getElementById("btnIdent");
const btnLoad = document.getElementById("btnLoad");
const btnLoadAMMEF = document.getElementById("btnLoadAMMEF");
const btnSave = document.getElementById("btnSave");
const btnLoadVideo = document.getElementById("btnLoadVideo");
const btnToggleDisplay = document.getElementById("btnToggleDisplay");

// ---------- Other Controls ----------
const txtCallsign = document.getElementById("txtCallsign");
const chkUnencoded = document.getElementById("chkUnencoded");

// ---------- Canvases ----------
const canvasScope = document.getElementById("canvasScope");
const imgWaterfall = document.getElementById("imgWaterfall");
const canvasMeter = document.getElementById("canvasMeter");

// ---------- Canvas Contexts ----------
const scopeCtx = canvasScope.getContext("2d");
const wfCtx = imgWaterfall.getContext("2d");
const meterCtx = canvasMeter.getContext("2d");

// ---------- Waterfall Buffer ----------
const wfWidth = 160;
const wfHeight = 80;

const wfOffscreen = document.createElement("canvas");
wfOffscreen.width = wfWidth;
wfOffscreen.height = wfHeight;

const wfOffCtx = wfOffscreen.getContext("2d");

const wfPixelData =
    wfOffCtx.createImageData(
        wfWidth,
        wfHeight
    );
