/**
 * Tajirox Local Camera Barcode Scanner
 * Used when the system is opened directly on a mobile device to scan using the local camera.
 */

let html5QrcodeScanner = null;
let currentScanTargetInputId = null;
let currentScanMode = null;

function startCameraScanner(targetInputId, mode = null) {
    currentScanTargetInputId = targetInputId;
    currentScanMode = mode;
    
    // Show modal
    const modal = document.getElementById('cameraScannerModal');
    if (modal) modal.classList.remove('hidden');

    const handleFailure = (finalErr) => {
        console.error("Camera start error", finalErr);
        let errorMsg = "تعذر تشغيل الكاميرا. تأكد من تفعيل الصلاحيات.";
        
        if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            errorMsg = "خطأ أمني: يمنع المتصفح تشغيل الكاميرا على الاتصال غير الآمن (HTTP). يرجى تفعيل اتصال آمن (HTTPS) أو تشغيل النظام محلياً على localhost.";
        } else if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            errorMsg = "المتصفح لا يدعم الوصول إلى الكاميرا في هذه البيئة. يرجى تفعيل الاتصال الآمن (HTTPS).";
        } else if (finalErr && (finalErr.name === 'NotAllowedError' || finalErr.name === 'PermissionDeniedError' || (finalErr.message && finalErr.message.includes('Permission')))) {
            errorMsg = "تم رفض إذن الوصول للكاميرا. يرجى السماح للموقع باستخدام الكاميرا من إعدادات المتصفح.";
        }

        if (typeof showToast === 'function') {
            showToast(errorMsg, "error");
        } else {
            alert(errorMsg);
        }
        stopCameraScanner();
    };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        handleFailure(new Error("MediaDevices or getUserMedia not supported (likely due to insecure HTTP context)"));
        return;
    }

    // Initialize Html5Qrcode
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(err => console.error("Error clearing scanner", err));
    }

    // Initialize Html5Qrcode with stable ZXing engine to avoid format incompatibilities and launch crashes
    html5QrcodeScanner = new Html5Qrcode("cameraScannerReader", {
        experimentalFeatures: {
            useBarCodeDetectorIfSupported: false
        }
    });

    const config = { 
        fps: 25, // Increase scan frequency to 25 FPS
        qrbox: function(width, height) {
            const size = Math.min(width, height);
            return { width: size * 0.85, height: size * 0.55 }; // Wider box for easy scanning
        },
        aspectRatio: 1.0,
        formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.PDF_417
        ]
    };

    const startWithFacingMode = (constraints) => {
        try {
            return html5QrcodeScanner.start(
                constraints,
                config,
                onLocalScanSuccess,
                onLocalScanFailure
            );
        } catch (e) {
            return Promise.reject(e);
        }
    };

    const startWithDeviceId = (deviceId) => {
        try {
            return html5QrcodeScanner.start(
                deviceId,
                config,
                onLocalScanSuccess,
                onLocalScanFailure
            );
        } catch (e) {
            return Promise.reject(e);
        }
    };

    // First attempt: environment camera with ideal constraints
    startWithFacingMode({ 
        facingMode: "environment",
        width: { ideal: 1920 },
        height: { ideal: 1080 }
    }).catch(err => {
        console.warn("First camera start attempt failed, trying fallback...", err);
        
        let getCamerasPromise;
        try {
            getCamerasPromise = Html5Qrcode.getCameras();
        } catch (e) {
            getCamerasPromise = Promise.reject(e);
        }

        getCamerasPromise.then(devices => {
            if (devices && devices.length > 0) {
                let backCamera = devices.find(device => {
                    const label = (device.label || "").toLowerCase();
                    return label.includes('back') || label.includes('env') || label.includes('rear') || label.includes('خلف');
                });
                let selectedDeviceId = backCamera ? backCamera.id : devices[0].id;
                
                startWithDeviceId(selectedDeviceId)
                .catch(err2 => {
                    console.warn("Attempting with simple user facingMode...", err2);
                    // Third attempt: simple facingMode user
                    startWithFacingMode({ facingMode: "user" })
                    .catch(err3 => {
                        // Fourth attempt: simple default constraints
                        startWithFacingMode({})
                        .catch(err4 => {
                            handleFailure(err4);
                        });
                    });
                });
            } else {
                // Third attempt if no devices/labels listed (maybe permission issue or browser restriction): try user
                startWithFacingMode({ facingMode: "user" })
                .catch(err2 => {
                    // Fourth attempt: default empty constraints
                    startWithFacingMode({})
                    .catch(err3 => {
                        handleFailure(err3);
                    });
                });
            }
        }).catch(err2 => {
            console.warn("Error getting cameras, trying simple constraints fallback...", err2);
            startWithFacingMode({ facingMode: "environment" })
            .catch(err3 => {
                startWithFacingMode({ facingMode: "user" })
                .catch(err4 => {
                    startWithFacingMode({})
                    .catch(err5 => {
                        handleFailure(err5);
                    });
                });
            });
        });
    });
}

function onLocalScanSuccess(decodedText) {
    // Fill the input
    const input = document.getElementById(currentScanTargetInputId);
    if (input) {
        input.value = decodedText;
        
        // Trigger event
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Trigger simulate enter / search
        if (currentScanMode) {
            if (typeof handlePhysicalScan === 'function') {
                const event = {
                    key: 'Enter',
                    target: input,
                    preventDefault: () => {}
                };
                handlePhysicalScan(event, currentScanMode);
            } else if (currentScanMode === 'inventory_search' && typeof searchInventory === 'function') {
                searchInventory();
            }
        }
    }

    // Play sound and stop
    playBeepSoundFeedback();
    stopCameraScanner();
}

function onLocalScanFailure(error) {
    // Failure is normal when searching frames
}

function stopCameraScanner() {
    const modal = document.getElementById('cameraScannerModal');
    if (modal) modal.classList.add('hidden');

    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }).catch(err => {
            console.error("Failed to stop local scanner", err);
            html5QrcodeScanner = null;
        });
    }
}

// Flash/Torch support
let localFlashOn = false;
function toggleLocalCameraFlash() {
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        localFlashOn = !localFlashOn;
        html5QrcodeScanner.applyVideoConstrains({
            advanced: [{ torch: localFlashOn }]
        }).then(() => {
            const btn = document.getElementById('cameraScannerFlashBtn');
            if (btn) {
                if (localFlashOn) {
                    btn.className = "flex-1 py-3 bg-amber-500 text-white rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2";
                } else {
                    btn.className = "flex-1 py-3 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2";
                }
            }
        }).catch(err => {
            console.warn("Torch not supported", err);
            if (typeof showToast === 'function') {
                showToast("الفلاش غير مدعوم على هذا الجهاز", "warning");
            }
        });
    }
}

function playBeepSoundFeedback() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); // 1000Hz
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.08);
    } catch (e) {}
}
