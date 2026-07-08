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
        } else if (finalErr) {
            if (finalErr.name === 'NotAllowedError' || finalErr.name === 'PermissionDeniedError' || (finalErr.message && finalErr.message.includes('Permission'))) {
                    errorMsg = "تم رفض إذن الوصول للكاميرا. يرجى السماح للموقع باستخدام الكاميرا من إعدادات المتصفح.";
                } else if (finalErr.name === 'OverconstrainedError') {
                errorMsg = "تم رفض إذن الوصول للكاميرا. يرجى السماح للموقع باستخدام الكاميرا من إعدادات المتصفح.";
            } else if (finalErr.name === 'NotReadableError' || finalErr.name === 'TrackStartError') {
                errorMsg = "الكاميرا قيد الاستخدام بالفعل من قبل تطبيق آخر أو علامة تبويب أخرى. يرجى إغلاق التطبيقات الأخرى التي تستخدم الكاميرا والمحاولة مرة أخرى.";
            } else if (finalErr.name === 'NotFoundError' || finalErr.name === 'DevicesNotFoundError') {
                errorMsg = "لم يتم العثور على كاميرا على هذا الجهاز.";
            } else if (finalErr.name === 'OverconstrainedError') {
                errorMsg = "الكاميرا لا تدعم الإعدادات المطلوبة (مثل الدقة). سيتم تجربة إعدادات أبسط.";
            } else {
                errorMsg = `خطأ غير متوقع في الكاميرا: ${finalErr.message || finalErr.name}. يرجى إعادة تحميل الصفحة.`;
            }
        }
        if (typeof showToast === 'function') {
            showToast(errorMsg, "error");
        } else {
            alert(errorMsg);
        }
        stopCameraScanner();
    };

    // Pre-check for MediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        handleFailure(new Error("MediaDevices or getUserMedia not supported (likely due to insecure HTTP context)"));
        return;
    }

    // Initialize Html5Qrcode
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.clear().catch(err => console.error("Error clearing scanner", err));
    }
    html5QrcodeScanner = new Html5Qrcode("cameraScannerReader", {
        experimentalFeatures: {
            useBarCodeDetectorIfSupported: false
        }
    });

    const config = { 
        fps: 15, // Adjusted FPS for better performance on some devices
        qrbox: function(width, height) {
            const size = Math.min(width, height);
            return { width: size * 0.8, height: size * 0.5 }; // Wider box for easier barcode scanning
        },
        aspectRatio: 1.777778, // 16:9 aspect ratio
        formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93, // Added for more barcode types
            Html5QrcodeSupportedFormats.UPC_A, // Added for more barcode types
            Html5QrcodeSupportedFormats.UPC_E, // Added for more barcode types
            Html5QrcodeSupportedFormats.CODABAR, // Added for more barcode types
            Html5QrcodeSupportedFormats.ITF, // Added for more barcode types
            Html5QrcodeSupportedFormats.DATA_MATRIX, // Added for more barcode types
            Html5QrcodeSupportedFormats.PDF_417 // Added for more barcode types
        ]
    };

    const tryStartCamera = async (constraints, deviceId = null) => {
        try {
            if (deviceId) {
                await html5QrcodeScanner.start(deviceId, config, onLocalScanSuccess, onLocalScanFailure);
            } else {
                await html5QrcodeScanner.start(constraints, config, onLocalScanSuccess, onLocalScanFailure);
            }
            return true; // Camera started successfully
        } catch (e) {
            console.warn("Camera start failed with constraints:", constraints, e);
            return false; // Camera failed to start with these constraints
        }
    };
    
    (async () => {
        // Attempt 1: Simplest environment camera
        if (await tryStartCamera({ facingMode: "environment" })) return;

        // Attempt 2: Simplest user-facing camera
        if (await tryStartCamera({ facingMode: "user" })) return;

        // Attempt 3: Enumerate devices and try specific back camera
        try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
                let backCamera = devices.find(device => {
                    const label = (device.label || "").toLowerCase();
                    return label.includes('back') || label.includes('env') || label.includes('rear') || label.includes('خلف');
                });
                
                if (backCamera && await tryStartCamera(null, backCamera.id)) return;

                // Attempt 4: Enumerate devices and try specific front camera
                let frontCamera = devices.find(device => {
                    const label = (device.label || "").toLowerCase();
                    return label.includes('front') || label.includes('user');
                });
                if (frontCamera && await tryStartCamera(null, frontCamera.id)) return;

                // Attempt 5: Try the first available device if others fail
                if (await tryStartCamera(null, devices[0].id)) return;
            }
        } catch (e) {
            console.warn("Error getting camera devices, proceeding with generic fallback:", e);
        }
        
        // Attempt 6: Default constraints (let browser decide, no specific facingMode)
        if (await tryStartCamera({})) return;

        // If all attempts fail
        handleFailure(new Error("All camera startup attempts failed."));
    })();
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
            localFlashOn = false; // Reset flash state
            // Reset flash button UI
            const btn = document.getElementById('cameraScannerFlashBtn');
            if (btn) {
                btn.className = "flex-1 py-3 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2";
            }
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
