        document.getElementById('mobileMenuBtn').onclick = () => {
            const sidebar = document.getElementById('sidebar');
            const isOpen = !sidebar.classList.contains('translate-x-full');
            if (isOpen) {
                closeSidebarMobile();
            } else {
                openSidebarMobile();
            }
        };

        // تهيئة عند تحميل الصفحة
        window.onload = function () {
            // ============================================
            // 1. Initialisation de base
            // ============================================

            // Initialiser les traductions
            updateUI();

            // Initialiser les dates par défaut
            const today = new Date().toISOString().split('T')[0];

            // Date pour le formulaire de service
            const serviceDate = document.getElementById('serviceDate');
            if (serviceDate) {
                serviceDate.value = today;
            }

            // Date pour le formulaire de règlement de dette
            const settleDate = document.getElementById('settleDate');
            if (settleDate) {
                settleDate.value = today;
            }

            // Date pour le formulaire de consommation
            const cDate = document.getElementById('cDate');
            if (cDate) {
                cDate.value = today;
            }

            // ============================================
            // 2. Initialisation des écouteurs d'événements
            // ============================================

            // Menu mobile
            const mobileMenuBtn = document.getElementById('mobileMenuBtn');
            if (mobileMenuBtn) {
                mobileMenuBtn.onclick = () => {
                    const sidebar = document.getElementById('sidebar');
                    const isOpen = !sidebar.classList.contains('translate-x-full');
                    if (isOpen) {
                        closeSidebarMobile();
                    } else {
                        openSidebarMobile();
                    }
                };
            }

            // Recherche globale
            const tableSearch = document.getElementById('tableSearch');
            if (tableSearch) {
                tableSearch.onkeyup = filterTables;
            }

            // Bouton de rafraîchissement
            const refreshBtn = document.querySelector('button[onclick="refreshData()"]');
            if (refreshBtn) {
                // Déjà géré par l'attribut onclick
            }

            // ============================================
            // 3. Initialisation des filtres
            // ============================================

            // Initialiser les options de filtre (année, mois, jour)
            initFilterOptions();

            // ============================================
            // 4. Gestion des clics en dehors des modales
            // ============================================

            // Fermer les modales en cliquant sur l'arrière-plan
            const modals = document.querySelectorAll('.fixed.inset-0.bg-slate-900\\/60');
            modals.forEach(modal => {
                modal.addEventListener('click', function (e) {
                    if (e.target === this) {
                        this.classList.add('hidden');
                    }
                });
            });

            // ============================================
            // 5. Initialisation des événements des formulaires
            // ============================================

            // Champ de recherche dans l'inventaire
            const inventorySearch = document.getElementById('inventorySearch');
            if (inventorySearch) {
                inventorySearch.addEventListener('keyup', searchInventory);
                inventorySearch.addEventListener('keydown', (e) => handlePhysicalScan(e, 'inventory_search'));
            }

            // Champ de recherche dans la facture
            const itemSearch = document.getElementById('iItemSearch');
            if (itemSearch) {
                itemSearch.addEventListener('keyup', searchProductForInvoice);
                itemSearch.addEventListener('keydown', (e) => handlePhysicalScan(e, 'invoice_add'));
            }

            // Champ de recherche dans la consommation
            const cItemSearch = document.getElementById('cItemSearch');
            if (cItemSearch) {
                cItemSearch.addEventListener('keyup', searchProductForConsumption);
                cItemSearch.addEventListener('keydown', (e) => handlePhysicalScan(e, 'consumption_add'));
            }

            // ============================================
            // 6. Initialisation de la connexion automatique
            // ============================================

            // Vérifier si l'utilisateur était déjà connecté
            const savedUser = localStorage.getItem('lastUser');
            if (savedUser) {
                // Optionnel: remplir le champ username
                const loginUser = document.getElementById('loginUser');
                if (loginUser) {
                    loginUser.value = savedUser;
                }
            }

            // تهيئة الدخول ببصمة الوجه وتشغيله تلقائياً إذا كان مفعلاً
            if (typeof initBiometricUI === 'function') {
                initBiometricUI();
                if (localStorage.getItem('biometric_enrolled') === 'true' && typeof handleBiometricLogin === 'function') {
                    // 1. محاولة التشغيل التلقائي الهادئ فور تحميل الصفحة
                    setTimeout(() => {
                        handleBiometricLogin(false);
                    }, 500);

                    // 2. تفعيل الاستدعاء الفوري والسلس بمجرد لمس أو الضغط في أي مكان في الصفحة أو التركيز على حقول الدخول (حل مشكلة حماية المتصفح للمس الشاشة User Gesture)
                    const triggerBiometricGesture = () => {
                        handleBiometricLogin(false);
                        // إزالة المستمعين لتجنب التكرار المزعج
                        document.removeEventListener('click', triggerBiometricGesture);
                        document.removeEventListener('touchstart', triggerBiometricGesture);
                    };
                    document.addEventListener('click', triggerBiometricGesture);
                    document.addEventListener('touchstart', triggerBiometricGesture);

                    const uField = document.getElementById('loginUser');
                    if (uField) uField.addEventListener('focus', () => handleBiometricLogin(false));
                    
                    const pField = document.getElementById('loginPass');
                    if (pField) pField.addEventListener('focus', () => handleBiometricLogin(false));
                }
            }

            // ============================================
            // 7. Initialisation de QZ Tray (impression directe)
            // ============================================

            // Vérifier si QZ Tray est disponible
            if (typeof qz !== 'undefined') {
                console.log('🖨️ Bibliothèque QZ Tray détectée, initialisation...');

                // Initialisation silencieuse après 3 secondes
                // (pour laisser le temps à l'utilisateur de se connecter d'abord)
                setTimeout(() => {
                    // Ne tenter la connexion que si l'utilisateur est connecté
                    if (currentUser) {
                        console.log('🖨️ Tentative de connexion à QZ Tray...');
                        initQZTray();
                    } else {
                        console.log('🖨️ Utilisateur non connecté, attente pour QZ Tray');
                    }
                }, 3000);

                // Mettre à jour le statut périodiquement
                setInterval(() => {
                    if (currentUser) {
                        updateQZStatus();
                    }
                }, 5000);
            } else {
                console.log('ℹ️ QZ Tray non détecté, utilisation de l\'impression standard');
            }

            // ============================================
            // 8. Gestion des touches Entrée dans les formulaires
            // ============================================

            // Formulaire de login
            const loginPass = document.getElementById('loginPass');
            if (loginPass) {
                loginPass.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') handleLogin();
                });
            }

            const loginUser = document.getElementById('loginUser');
            if (loginUser) {
                loginUser.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') document.getElementById('loginPass').focus();
                });
            }

            // Formulaire de changement de mot de passe
            const newPassInput = document.getElementById('newPassInput');
            if (newPassInput) {
                newPassInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') submitChangePass();
                });
            }

            // Formulaire d'ajout de produit
            const invQty = document.getElementById('invQty');
            if (invQty) {
                invQty.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') saveInventory();
                });
            }

            // Formulaire de quantité
            const quantityInput = document.getElementById('quantityInput');
            if (quantityInput) {
                quantityInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') addProductWithQuantity();
                });
            }

            // Formulaire de dépense
            const expPaid = document.getElementById('expPaid');
            if (expPaid) {
                expPaid.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') saveExpense();
                });
            }

            // ============================================
            // 9. Initialisation des graphiques (si nécessaire)
            // ============================================

            // Le graphique sera initialisé lors du premier rendu du dashboard

            // ============================================
            // 10. Gestion du redimensionnement de la fenêtre
            // ============================================

            window.addEventListener('resize', function () {
                // Réinitialiser le menu mobile si la fenêtre devient grande
                if (window.innerWidth >= 768) {
                    const sidebar = document.getElementById('sidebar');
                    if (sidebar) {
                        sidebar.classList.remove('translate-x-full');
                    }
                }

                // Recalculer les graphiques si nécessaire
                if (window.myChart && typeof window.myChart.resize === 'function') {
                    window.myChart.resize();
                }
            });

            // ============================================
            // 11. Nettoyage des données temporaires
            // ============================================

            // Vider le panier au démarrage
            cart = [];
            consumptionCart = [];

            // ============================================
            // 12. Vérification du mode hors ligne
            // ============================================

            window.addEventListener('online', function () {
                console.log('📶 Connexion rétablie, synchronisation...');
                showToast('✅ Connexion rétablie, synchronisation en cours...', 'info');
                if (currentUser) {
                    refreshData();
                }
            });

            window.addEventListener('offline', function () {
                console.log('📶 Connexion perdue, mode hors ligne');
                showToast('⚠️ Mode hors ligne - Les données sont sauvegardées localement', 'warning');
            });

            // ============================================
            // 13. Journalisation
            // ============================================

            console.log('🚀 Application initialisée avec succès');
            console.log('📅 Date du jour:', today);
            console.log('🌐 Langue:', currentLang);

            // Afficher un message de bienvenue si l'utilisateur était déjà connecté
            if (currentUser) {
                console.log('👤 Utilisateur connecté:', currentUser.username);
            }

            // ============================================
            // 14. Focus automatique sur le premier champ
            // ============================================

            // Sur la page de login, focus sur le champ username
            if (!currentUser) {
                const loginUserField = document.getElementById('loginUser');
                if (loginUserField) {
                    setTimeout(() => loginUserField.focus(), 100);
                }
            }
        };

        // تحديث عند تغيير حجم النافذة
        window.addEventListener('resize', function () {
            // لا حاجة لتغيير DOM هنا، CSS سيتكفل بالتحسينات
        });
