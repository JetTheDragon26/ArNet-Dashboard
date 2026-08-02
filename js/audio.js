// ======================================================
// ArNet Transceiver
// Audio Engine
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

    // RIFF Header

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

    let offset = 44;

    for (
        let i = 0;
        i < pcmShorts.length;
        i++,
        offset += 2
    ) {

        view.setInt16(
            offset,
            pcmShorts[i],
            true
        );

    }

    lastAudioPcmArray =
        pcmShorts;

    return new Blob(

        [buffer],

        {
            type: "audio/wav"
        }

    );

}

async function playAudioBlob(blob) {

    initAudioContext();

    if (
        audioCtx &&
        audioCtx.state === "suspended"
    ) {

        await audioCtx.resume();

    }

    const audioURL =
        URL.createObjectURL(blob);

    const audio =
        new Audio(audioURL);

    try {

        await audio.play();

    }
    catch (err) {

        console.log(
            "Audio play error:",
            err
        );

    }

    playbackStartTime =
        Date.now();

    isPlaying = true;

    audio.onended = () => {

        isPlaying = false;

        URL.revokeObjectURL(
            audioURL
        );

    };

}
