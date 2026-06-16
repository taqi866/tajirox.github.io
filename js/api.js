// === PROXY GOOGLE APPS SCRIPT API ET MODULE DE CHIFFREMENT CÔTÉ CLIENT ===
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwf4jYEAZgfRpE74fu1Ugv5VUxx0o_nTUPTzNsNtkqzTnG4XudFhqOK1sC616uLW7FnCQ/exec";

// Configuration des champs à chiffrer pour chaque entité
const FIELDS_TO_ENCRYPT = {
    inventory: ['name', 'purchase_price', 'sale_price', 'qty', 'category', 'unit_type', 'expiry_date'],
    invoices: ['customer', 'customer_id', 'payment_method', 'payment_reference', 'due_date', 'items', 'total', 'paid', 'balance', 'discount', 'discount_type', 'cancelled_remainder', 'type', 'customer_ice', 'customer_address'],
    expenses: ['category', 'description', 'supplier', 'supplier_id', 'invoice_number', 'payment_reference', 'due_date', 'amount', 'paid', 'balance', 'method'],
    clients: ['type', 'name', 'phone', 'email', 'address', 'notes', 'ice'],
    payments: ['type', 'client_id', 'client_name', 'method', 'reference', 'amount', 'description', 'debt_id', 'debt_type'],
    checks_promissory: ['reference', 'type', 'amount', 'due_date', 'status', 'client_name', 'debt_id', 'debt_type'],
    transfers: ['from_account', 'to_account', 'amount', 'description'],
    consumptions: ['store', 'notes', 'items', 'total']
};

// Fonctions utilitaires de chiffrement
function encryptValue(val) {
    if (!window.encryptionKey) return val;
    if (val === null || val === undefined) return "";
    let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.startsWith("U2FsdGVkX1")) return val; // déjà chiffré
    return CryptoJS.AES.encrypt(str, window.encryptionKey).toString();
}

function decryptValue(val) {
    if (!window.encryptionKey) return val;
    if (val === null || val === undefined) return val;
    let str = String(val).trim();
    if (!str.startsWith("U2FsdGVkX1")) return val;
    try {
        let bytes = CryptoJS.AES.decrypt(str, window.encryptionKey);
        let decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
        if (decryptedStr.startsWith("{") || decryptedStr.startsWith("[")) {
            try {
                return JSON.parse(decryptedStr);
            } catch (e) {
                return decryptedStr;
            }
        }
        return decryptedStr;
    } catch (e) {
        console.error("Déchiffrement échoué : ", e);
        return val;
    }
}

function encryptObject(item, type) {
    const fields = FIELDS_TO_ENCRYPT[type];
    if (!fields) return item;
    const encrypted = { ...item };
    fields.forEach(f => {
        if (encrypted[f] !== undefined && encrypted[f] !== null) {
            encrypted[f] = encryptValue(encrypted[f]);
        }
    });
    return encrypted;
}

function decryptObject(item, type) {
    const fields = FIELDS_TO_ENCRYPT[type];
    if (!fields) return item;
    const decrypted = { ...item };
    fields.forEach(f => {
        if (decrypted[f] !== undefined && decrypted[f] !== null) {
            decrypted[f] = decryptValue(decrypted[f]);
        }
    });
    return decrypted;
}

function decryptAllData(data) {
    const decrypted = {};
    for (let key in data) {
        if (Array.isArray(data[key])) {
            const fields = FIELDS_TO_ENCRYPT[key];
            if (fields) {
                decrypted[key] = data[key].map(item => decryptObject(item, key));
            } else {
                decrypted[key] = data[key];
            }
        } else {
            decrypted[key] = data[key];
        }
    }
    return decrypted;
}

// Vérifier et migrer les anciennes données en clair vers le format chiffré
function checkAndMigrateOldData(rawData, decryptedData) {
    if (!window.encryptionKey) return;
    
    let needsMigration = false;
    for (let key in FIELDS_TO_ENCRYPT) {
        const list = rawData[key];
        if (list && list.length > 0) {
            const fields = FIELDS_TO_ENCRYPT[key];
            const hasUnencrypted = list.some(item => {
                return fields.some(f => {
                    const val = item[f];
                    return val !== undefined && val !== null && val !== "" && typeof val === 'string' && !val.startsWith("U2FsdGVkX1");
                });
            });
            if (hasUnencrypted) {
                needsMigration = true;
                break;
            }
        }
    }
    
    if (needsMigration) {
        console.log("🔄 Données non chiffrées détectées. Chiffrement et migration automatique en cours...");
        
        const migratedData = {};
        for (let key in rawData) {
            if (Array.isArray(rawData[key])) {
                migratedData[key] = decryptedData[key].map(item => encryptObject(item, key));
            } else {
                migratedData[key] = rawData[key];
            }
        }
        
        google.script.run
            .withSuccessHandler(res => {
                if (res.success) {
                    if (typeof showToast === 'function') {
                        showToast("Toutes vos anciennes données ont été chiffrées avec succès !", "success");
                    }
                } else {
                    console.error("Migration error:", res.error);
                }
            })
            .withFailureHandler(err => {
                console.error("Migration failed:", err);
            })
            .saveMigratedData(migratedData, currentDbId);
    }
}

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
                        // Chiffrement automatique des arguments sortants si la clé existe
                        if (window.encryptionKey) {
                            if (prop === 'saveInventoryItem') {
                                args[0] = encryptObject(args[0], 'inventory');
                            } else if (prop === 'saveInventoryBatch') {
                                args[0] = args[0].map(x => encryptObject(x, 'inventory'));
                            } else if (prop === 'saveInvoice') {
                                args[0] = encryptObject(args[0], 'invoices');
                            } else if (prop === 'saveExpense') {
                                args[0] = encryptObject(args[0], 'expenses');
                            } else if (prop === 'saveClient') {
                                args[0] = encryptObject(args[0], 'clients');
                            } else if (prop === 'savePaymentRecord') {
                                args[0] = encryptObject(args[0], 'payments');
                            } else if (prop === 'updatePaymentAndCheck') {
                                args[1] = encryptObject(args[1], 'payments');
                                if (args[3]) args[3] = encryptObject(args[3], 'checks_promissory');
                            } else if (prop === 'saveCheckPromissory') {
                                args[0] = encryptObject(args[0], 'checks_promissory');
                            } else if (prop === 'saveTransfer') {
                                args[0] = encryptObject(args[0], 'transfers');
                            } else if (prop === 'saveConsumption') {
                                args[0] = encryptObject(args[0], 'consumptions');
                            } else if (prop === 'settleMultipleInvoices') {
                                args[0] = args[0].map(x => encryptObject(x, 'invoices'));
                                args[1] = args[1].map(x => encryptObject(x, 'payments'));
                                args[2] = args[2].map(x => encryptObject(x, 'checks_promissory'));
                            }
                        }

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
                                    let result = data.result;
                                    // Déchiffrement automatique des données entrantes si la clé existe
                                    if (prop === 'getAllData' && result && !result.error) {
                                        if (window.encryptionKey) {
                                            const decrypted = decryptAllData(result);
                                            checkAndMigrateOldData(result, decrypted);
                                            result = decrypted;
                                        }
                                    }
                                    if (target._successHandler) target._successHandler(result);
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
