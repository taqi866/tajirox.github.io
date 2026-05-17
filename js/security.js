// === Tajirox Security & Anti-Inspection Module ===
(function() {
    // 1. Disable Right-Click Context Menu
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    }, false);

    // 2. Disable standard DevTools hotkeys
    document.addEventListener('keydown', function(e) {
        // Disable F12
        if (e.key === 'F12') {
            e.preventDefault();
            return false;
        }

        // Disable Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C' || e.key === 'i' || e.key === 'j' || e.key === 'c')) {
            e.preventDefault();
            return false;
        }

        // Disable Ctrl+U (View Source) and Ctrl+S (Save page)
        if (e.ctrlKey && (e.key === 'U' || e.key === 'S' || e.key === 'u' || e.key === 's')) {
            e.preventDefault();
            return false;
        }
    }, false);

    // 3. Active DevTools Anti-Debugging
    // This runs a debugger statement periodically. If Developer Tools are open,
    // the debugger will catch it and pause the page, rendering the DevTools console useless.
    setInterval(function() {
        (function() {
            // Self-executing anonymous debugger loop
            (function a() {
                try {
                    (function b(i) {
                        if (('' + (i / i)).length !== 1 || i % 20 === 0) {
                            (function() {}).constructor('debugger')();
                        } else {
                            debugger;
                        }
                        b(++i);
                    })(0);
                } catch (e) {
                    setTimeout(a, 1000);
                }
            })();
        })();
    }, 1000);
})();
