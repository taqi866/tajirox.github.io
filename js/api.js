// === PROXY GOOGLE APPS SCRIPT API ===
// Remplacez cette URL par l'URL de votre Web App Google Apps Script
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwf4jYEAZgfRpE74fu1Ugv5VUxx0o_nTUPTzNsNtkqzTnG4XudFhqOK1sC616uLW7FnCQ/exec";

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
                            args: args,
                            session: {
                                username: (typeof currentUser !== 'undefined' && currentUser && currentUser.username) || null,
                                dbId: (typeof currentDbId !== 'undefined' && currentDbId) || null,
                                role: (typeof currentUser !== 'undefined' && currentUser && currentUser.role) || null,
                                token: (typeof currentUser !== 'undefined' && currentUser && currentUser.sessionToken) || null
                            }
                        };

                        // Afficher un indicateur de chargement global si existant (sauf pour les requêtes silencieuses de support en arrière-plan)
                        const silentFunctions = ['getSupportMessagesFromServer', 'saveSupportMessageOnServer'];
                        const isSilent = silentFunctions.includes(prop);
                        const topLoading = document.getElementById('topLoading');
                        if (topLoading && !isSilent) topLoading.classList.remove('hidden');

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
                                if (topLoading && !isSilent) topLoading.classList.add('hidden');
                                if (data.error) {
                                    if (target._failureHandler) target._failureHandler(data.error);
                                    else console.error("Erreur Serveur:", data.error);
                                } else {
                                    if (target._successHandler) target._successHandler(data.result);
                                }
                            })
                            .catch(error => {
                                if (topLoading && !isSilent) topLoading.classList.add('hidden');
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
