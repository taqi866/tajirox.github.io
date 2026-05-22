// === PROXY GOOGLE APPS SCRIPT API ===
// Remplacez cette URL par l'URL de votre Web App Google Apps Script
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxmx97O3ec98EGc82t4jUNyDk4X8xp4-GR5L-Uo75qufYkl7cbJrj10wPpeaZSuYTWZiQ/exec";

window.google = {
    script: {
        get run() {
            const obj = {
                _successHandler: null,
                _failureHandler: null
            };

            const proxy = new Proxy(obj, {
                get: function (target, prop) {
                    if (prop === 'withSuccessHandler') {
                        return function (handler) {
                            target._successHandler = handler;
                            return proxy;
                        };
                    }
                    if (prop === 'withFailureHandler') {
                        return function (handler) {
                            target._failureHandler = handler;
                            return proxy;
                        };
                    }

                    // Exécution de la fonction distante
                    return function (...args) {
                        const payload = {
                            func: prop,
                            args: args
                        };

                        // Afficher un indicateur de chargement global si existant
                        const topLoading = document.getElementById('topLoading');
                        if (topLoading) topLoading.classList.remove('hidden');

                        fetch(SCRIPT_URL, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'text/plain;charset=utf-8'
                            },
                            body: JSON.stringify(payload)
                        })
                            .then(response => {
                                if (!response.ok) throw new Error('Erreur réseau');
                                return response.json();
                            })
                            .then(data => {
                                if (topLoading) topLoading.classList.add('hidden');
                                if (data.error) {
                                    if (target._failureHandler) target._failureHandler(data.error);
                                    else console.error("Erreur Serveur:", data.error);
                                } else {
                                    if (target._successHandler) target._successHandler(data.result);
                                }
                            })
                            .catch(error => {
                                if (topLoading) topLoading.classList.add('hidden');
                                if (target._failureHandler) target._failureHandler(error);
                                else console.error("Erreur Fetch:", error);
                            });
                    };
                }
            });
            return proxy;
        }
    }
};
