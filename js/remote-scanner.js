/**
 * Tajirox Wireless Phone Barcode Scanner Integration
 * Handles connection to MQTT broker, session management, and routing scanned barcodes to active inputs.
 */

(function () {
    'use strict';

    let mqttClient = null;
    let sessionId = null;
    let isMqttConnected = false;
    let isPhoneConnected = false;
    
    const brokers = [
        { host: "broker.hivemq.com", port: 8884, path: "/mqtt" },
        { host: "broker.emqx.io", port: 8084, path: "/mqtt" }
    ];
    let currentBrokerIndex = 0;

    // 1. Generate or Retrieve Session ID
    function getSessionId() {
        if (!sessionId) {
            sessionId = localStorage.getItem('remote_scanner_session');
            if (!sessionId) {
                // Generate a random 7-character session code
                sessionId = Math.random().toString(36).substring(2, 9).toUpperCase();
                localStorage.setItem('remote_scanner_session', sessionId);
            }
        }
        return sessionId;
    }

    // 2. Initialize and Connect to MQTT
    function connectMqtt() {
        if (mqttClient && isMqttConnected) return;

        const session = getSessionId();
        const topic = `tajirox/remote_scan/${session}`;
        
        const broker = brokers[currentBrokerIndex];
        const clientId = "comp_client_" + Math.random().toString(36).substring(2, 9);
        
        mqttClient = new Paho.MQTT.Client(broker.host, Number(broker.port), broker.path, clientId);

        mqttClient.onConnectionLost = (responseObject) => {
            console.warn("Remote Scanner: Connection to broker lost.", responseObject.errorMessage);
            isMqttConnected = false;
            updateConnectionStatusUI();
            // Retry connection
            setTimeout(connectMqtt, 3000);
        };

        mqttClient.onMessageArrived = (message) => {
            try {
                const payload = JSON.parse(message.payloadString);
                handleRemoteMessage(payload);
            } catch (e) {
                console.error("Remote Scanner: Failed to parse incoming message", e);
            }
        };

        mqttClient.connect({
            useSSL: true,
            onSuccess: () => {
                console.log(`Remote Scanner: Successfully connected to MQTT Broker (${broker.host})!`);
                isMqttConnected = true;
                mqttClient.subscribe(topic);
                updateConnectionStatusUI();
            },
            onFailure: (err) => {
                console.error("Remote Scanner: Failed to connect to MQTT Broker:", err);
                isMqttConnected = false;
                updateConnectionStatusUI();
                
                // Fallback to next broker
                currentBrokerIndex = (currentBrokerIndex + 1) % brokers.length;
                setTimeout(connectMqtt, 4000);
            },
            keepAliveInterval: 30
        });
    }

    // 3. Handle Messages received from the phone
    function handleRemoteMessage(payload) {
        if (payload.action === 'device_connected') {
            isPhoneConnected = true;
            if (typeof showToast === 'function') {
                showToast(t('phone_connected') || "تم ربط الهاتف بنجاح وجاهز للمسح", "success");
            }
            playConnectionSound();
            updateConnectionStatusUI();
        } else if (payload.action === 'scan_result') {
            const barcode = payload.code;
            if (!barcode) return;

            routeScannedBarcode(barcode);
        }
    }

    // 4. Smart Barcode Routing
    function routeScannedBarcode(barcode) {
        let routed = false;
        let targetInput = null;
        let mode = null;

        // Check active elements & modals in the page
        const inventoryModal = document.getElementById('inventoryModal');
        const invoiceModal = document.getElementById('invoiceModal');
        const consumptionModal = document.getElementById('consumptionModal');
        const activePageInventory = document.getElementById('page-inventory');

        if (inventoryModal && !inventoryModal.classList.contains('hidden')) {
            // 1. Inventory Form Modal is open
            targetInput = document.getElementById('invCode');
        } else if (invoiceModal && !invoiceModal.classList.contains('hidden')) {
            // 2. Invoice Form Modal is open
            targetInput = document.getElementById('iItemSearch');
            mode = 'invoice_add';
        } else if (consumptionModal && !consumptionModal.classList.contains('hidden')) {
            // 3. Consumption Form Modal is open
            targetInput = document.getElementById('cItemSearch');
            mode = 'consumption_add';
        } else if (activePageInventory && !activePageInventory.classList.contains('hidden')) {
            // 4. On the Inventory Tab Page
            targetInput = document.getElementById('inventorySearch');
            mode = 'inventory_search';
        }

        if (targetInput) {
            targetInput.value = barcode;
            routed = true;

            // Trigger events
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            targetInput.dispatchEvent(new Event('change', { bubbles: true }));

            // Simulate physical scan (Enter key press)
            if (mode) {
                if (typeof handlePhysicalScan === 'function') {
                    const event = {
                        key: 'Enter',
                        target: targetInput,
                        preventDefault: () => {}
                    };
                    handlePhysicalScan(event, mode);
                } else if (mode === 'inventory_search' && typeof searchInventory === 'function') {
                    searchInventory();
                }
            }
        } else {
            // Fallback: check if there's any currently focused text input on screen
            const focusedEl = document.activeElement;
            if (focusedEl && (focusedEl.tagName === 'INPUT' || focusedEl.tagName === 'TEXTAREA') && focusedEl.type === 'text') {
                focusedEl.value = barcode;
                focusedEl.dispatchEvent(new Event('input', { bubbles: true }));
                focusedEl.dispatchEvent(new Event('change', { bubbles: true }));
                routed = true;
            }
        }

        // Show feedback toast and sound
        if (routed) {
            playBeepSound();
            if (typeof showToast === 'function') {
                showToast(`${t('scanned_code') || 'تم مسح الرمز'}: ${barcode}`, 'success');
            }
        } else {
            // If no input was focused, copy to clipboard and notify
            navigator.clipboard.writeText(barcode).catch(() => {});
            if (typeof showToast === 'function') {
                showToast(`تم مسح: ${barcode} (نسخ للحافظة)`, 'info');
            }
            playBeepSound();
        }
    }

    // 5. Update UI states for connection status
    function updateConnectionStatusUI() {
        const indicator = document.getElementById('remoteScannerIndicator');
        const statusText = document.getElementById('remoteScannerStatusText');
        const settingsBtnIndicator = document.getElementById('remoteScannerSettingsIndicator');
        
        if (!indicator || !statusText) return;

        if (isPhoneConnected) {
            // Phone connected
            indicator.className = "w-3 h-3 rounded-full bg-emerald-500 animate-ping";
            statusText.innerText = t('phone_connected') || "الهاتف متصل وجاهز للمسح";
            statusText.className = "text-xs font-black text-emerald-600";
            
            if (settingsBtnIndicator) {
                settingsBtnIndicator.className = "w-2.5 h-2.5 rounded-full bg-emerald-500";
            }
        } else if (isMqttConnected) {
            // Computer connected to broker, waiting for phone
            indicator.className = "w-3 h-3 rounded-full bg-amber-500 animate-pulse";
            statusText.innerText = t('phone_disconnected') || "بانتظار ربط الهاتف...";
            statusText.className = "text-xs font-black text-amber-500 animate-pulse";
            
            if (settingsBtnIndicator) {
                settingsBtnIndicator.className = "w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse";
            }
        } else {
            // Offline/Connecting
            indicator.className = "w-3 h-3 rounded-full bg-rose-500";
            statusText.innerText = "جاري الاتصال بالسيرفر اللاسلكي...";
            statusText.className = "text-xs font-bold text-slate-400";
            
            if (settingsBtnIndicator) {
                settingsBtnIndicator.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
            }
        }
    }

    // 6. Modal open/close actions
    window.openRemoteScannerModal = function () {
        const modal = document.getElementById('remoteScannerModal');
        if (!modal) return;

        // Auto-connect to MQTT
        connectMqtt();

        const session = getSessionId();
        
        // Define Scan page URL
        let scanPageUrl = `${location.origin}/scan.html?session=${session}`;
        if (location.protocol === 'file:' || location.hostname === '') {
            // Local file fallback to hosted scan page on Github Pages
            scanPageUrl = `https://tajirox.github.io/scan.html?session=${session}`;
        } else {
            // Dynamic path for subfolders (e.g. GitHub Pages project pages)
            let path = window.location.pathname;
            let dir = path.substring(0, path.lastIndexOf('/'));
            scanPageUrl = `${location.origin}${dir}/scan.html?session=${session}`;
        }
        
        // Update QR code source using public server API
        const qrImg = document.getElementById('remoteScannerQR');
        if (qrImg) {
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(scanPageUrl)}`;
        }

        // Show session code text
        const sessionCodeText = document.getElementById('remoteScannerSessionCode');
        if (sessionCodeText) {
            sessionCodeText.innerText = session;
        }

        // Update UI
        updateConnectionStatusUI();

        // Show Modal
        modal.classList.remove('hidden');
    };

    window.closeRemoteScannerModal = function () {
        const modal = document.getElementById('remoteScannerModal');
        if (modal) modal.classList.add('hidden');
    };

    window.disconnectRemoteScanner = function() {
        isPhoneConnected = false;
        if (mqttClient) {
            try {
                mqttClient.disconnect();
            } catch(e) {}
            mqttClient = null;
        }
        isMqttConnected = false;
        updateConnectionStatusUI();
        if (typeof showToast === 'function') {
            showToast("تم قطع الاتصال بالماسح اللاسلكي", "info");
        }
        
        // Reconnect computer to broker for next usage
        setTimeout(connectMqtt, 1000);
    };

    // 7. Feedback Sound Effects
    function playBeepSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); // 1000Hz crisp beep
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } catch (e) {
            console.warn("Sound feedback not supported:", e);
        }
    }

    function playConnectionSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = 'sine';
            // Play two ascending notes (C5 then E5)
            oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.35);
        } catch (e) {}
    }

    // 8. Auto-start connection in background on page load
    window.addEventListener('load', () => {
        // Delay connection slightly to allow DOM resources to initialize
        setTimeout(connectMqtt, 1500);
    });

    // 9. Global Smart Scanner trigger (Local if mobile, Remote pairing if desktop)
    window.triggerScanner = function(targetInputId, mode = null) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        if (isMobile) {
            if (typeof startCameraScanner === 'function') {
                startCameraScanner(targetInputId, mode);
            } else {
                // Fallback to remote scanner modal
                openRemoteScannerModal();
            }
        } else {
            openRemoteScannerModal();
        }
    };

})();
