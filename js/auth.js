function handleLoginSuccess(res, loginBtn) {
            setLoading(false);
            if (loginBtn) setBtnLoading(loginBtn, false);

            if (res.success) {
                if (res.require2FA) {
                    window.temp2FASession = res.tempSession;
                    document.getElementById('login2FACodeInput').value = '';
                    document.getElementById('login2FAMsg').innerText = (currentLang === 'fr' ? "Le code de vérification a été envoyé à : " : "تم إرسال رمز التحقق إلى: ") + res.email;
                    openModal('login2FAModal');
                    return;
                }

                currentUser = res.user;
                currentDbId = res.dbId;

                if (!currentUser.shopName) currentUser.shopName = res.shopName || "متجر " + currentUser.username;

                // --- Mettre en cache locale les configurations de l'IA provenant du serveur ---
                const shopName = currentUser.shopName;
                const localKey = localStorage.getItem(`tajirox_ai_key_${shopName}`);
                const localActive = localStorage.getItem(`tajirox_ai_active_${shopName}`) === 'true';
                const localModel = localStorage.getItem(`tajirox_ai_model_${shopName}`) || 'auto';

                if (currentUser.aiKey) {
                    // Le serveur a une clé, on met à jour le cache local
                    localStorage.setItem(`tajirox_ai_active_${shopName}`, currentUser.aiActive);
                    localStorage.setItem(`tajirox_ai_key_${shopName}`, currentUser.aiKey);
                    localStorage.setItem(`tajirox_ai_model_${shopName}`, currentUser.aiModel);
                } else if (localKey) {
                    // Le serveur n'a pas de clé mais le client en a une locale : on la préserve et on la sauvegarde sur le serveur !
                    currentUser.aiActive = localActive;
                    currentUser.aiKey = localKey;
                    currentUser.aiModel = localModel;

                    google.script.run.updateShopSettings(
                        currentUser.shopCode,
                        currentUser.shopPhone || '',
                        currentUser.shopAddress || '',
                        currentUser.shopLogo || '',
                        currentUser.scanSkipQty || false,
                        currentUser.purchaseOnly || false,
                        currentUser.invoiceSize || 'A4',
                        currentUser.invoiceWidth || 80,
                        currentUser.barcodeSize || 'A4',
                        currentUser.barcodeWidth || 40,
                        currentUser.barcodeHeight || 25,
                        currentUser.invoiceColor || '#000000',
                        currentUser.invoiceDesign || 'standard',
                        currentUser.invoiceFooter || '',
                        currentUser.showPurchaseToEmployee || false,
                        currentUser.showPriceOnBarcode !== false,
                        localActive,
                        localKey,
                        localModel
                    );
                }

                // --- Gestion des droits pour les employés ---
                const isAdmin = currentUser.role === 'admin';
                const isStaff = currentUser.role === 'staff';

                if (isStaff) {
                    document.body.classList.add('staff-mode');

                    // ========== إخفاء قسم الشيكات والكمبيالات للموظف ==========
                    // إخفاء زر الشيكات والكمبيالات في القائمة الجانبية
                    const checksButton = document.querySelector('button[onclick="showPage(\'checks-promissory\')"]');
                    if (checksButton) {
                        checksButton.classList.add('hidden');
                    }

                    // إخفاء زر التنبيه الخاص بالشيكات في الهيدر
                    const checksAlertBtn = document.getElementById('checksAlertBtn');
                    if (checksAlertBtn) {
                        checksAlertBtn.classList.add('hidden');
                    }
                    // ========== نهاية الإخفاء ==========

                } else {
                    document.body.classList.remove('staff-mode');
                }

                // Liste de tous les boutons à contrôler
                const adminOnlyButtons = ['importExcelBtn', 'newProductBtn'];

                adminOnlyButtons.forEach(btnId => {
                    const btn = document.getElementById(btnId);
                    if (btn) {
                        btn.style.display = isAdmin ? 'inline-flex' : 'none';
                    }
                });

                // --- Vérification de l'abonnement ---
                if (currentUser.role !== 'super_admin') {
                    if (currentUser.isActive === false) {
                        showToast(t('account_suspended'), 'error');
                        return;
                    }

                    const today = new Date();
                    const subEnd = currentUser.subscriptionEnd ? parseDate(currentUser.subscriptionEnd) : new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
                    if (subEnd < today) {
                        if (currentUser.isTrial) {
                            showToast(t('trial_expired'), 'error');
                        } else {
                            showToast(t('sub_expired'), 'error');
                        }
                        return;
                    }
                }

                document.getElementById('authSection').classList.add('hidden');
                document.getElementById('appSection').classList.remove('hidden');
                document.getElementById('whatsappBtn').classList.add('hidden');
                
                // Initialiser le widget de support technique en ligne
                if (typeof initSupportWidget === 'function') {
                    initSupportWidget();
                }

                document.getElementById('userNameDisplay').innerText = currentUser.username;
                document.getElementById('userRoleDisplay').innerText = isAdmin ? t('admin_role') : t('staff_role');

                // --- Super Admin ---
                if (currentUser.role === 'super_admin') {
                    document.getElementById('userNameDisplay').innerText = t('system_admin');
                    document.getElementById('userRoleDisplay').innerText = t('admin_role');
                    document.getElementById('userRoleDisplay').className = "text-[9px] bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full inline-block mt-1 font-black";

                    // Utiliser le logo.png sur l'espace Admin Système
                    const sidebarIcon = document.getElementById('sidebarUserIcon');
                    if (sidebarIcon) {
                        sidebarIcon.innerHTML = `<img src="logo.png" class="w-full h-full object-cover rounded-2xl" alt="Logo">`;
                    }

                    // إخفاء شريط التنقل السفلي للموبايل للمشرف العام
                    const mobileBottomNav = document.getElementById('mobileBottomNav');
                    if (mobileBottomNav) mobileBottomNav.classList.add('hidden');

                    const sidebarNav = document.querySelector('#sidebar nav');
                    if (sidebarNav) {
                        sidebarNav.innerHTML = `
                            <button onclick="showPage('admin-dashboard'); switchAdminTab('stats');" class="sidebar-link active w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-indigo-600" id="sidebarStatsBtn">
                                <i class="fas fa-chart-line opacity-80"></i> <span data-i18n="support_tab_dashboard">${t('support_tab_dashboard')}</span>
                            </button>
                            <button onclick="showPage('admin-dashboard'); switchAdminTab('shops');" class="sidebar-link w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-slate-600 hover:text-indigo-600" id="sidebarShopsBtn">
                                <i class="fas fa-store-alt opacity-80"></i> <span data-i18n="support_tab_shops">${t('support_tab_shops')}</span>
                            </button>
                            <button onclick="showPage('admin-dashboard'); switchAdminTab('support');" class="sidebar-link w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-slate-600 hover:text-indigo-600" id="sidebarSupportBtn">
                                <i class="fas fa-comments opacity-80"></i> <span data-i18n="support_tab_chat">${t('support_tab_chat')}</span>
                            </button>
                        `;
                    }

                    loadAdminData();
                    showPage('admin-dashboard');
                    if (typeof switchAdminTab === 'function') {
                        switchAdminTab('stats');
                    }
                    showToast(t('welcome_admin'));
                    return;
                }

                // --- Mise à jour du logo ---
                if (currentUser.shopLogo) {
                    document.getElementById('sidebarUserIcon').innerHTML = `<img src="${currentUser.shopLogo}" class="w-full h-full object-cover rounded-2xl" alt="Logo">`;
                } else {
                    document.getElementById('sidebarUserIcon').innerHTML = `<i class="fas fa-user-circle text-3xl"></i>`;
                }

                // --- Gestion des menus selon le rôle ---
                if (isAdmin) {
                    // Admin : tous les menus sont visibles
                    document.getElementById('adminMenu').classList.remove('hidden');
                    document.getElementById('reportsMenuButton').classList.remove('reports-hidden');
                    document.getElementById('subscriptionMenuBtn').classList.remove('hidden');
                    document.getElementById('shopSettingsBtn').classList.remove('hidden');

                    ['sidebarDashboard', 'sidebarExpenses', 'sidebarClients', 'sidebarChangePass'].forEach(id => {
                        if (document.getElementById(id)) document.getElementById(id).classList.remove('hidden');
                    });

                    const checksButton = document.querySelector('button[onclick="showPage(\'checks-promissory\')"]');
                    if (checksButton) checksButton.classList.remove('hidden');

                    checkSubscriptionStatus();
                } else {
                    // Employé (staff) : masquer les menus sensibles
                    document.getElementById('adminMenu').classList.add('hidden');
                    document.getElementById('reportsMenuButton').classList.add('reports-hidden');
                    document.getElementById('subscriptionMenuBtn').classList.add('hidden');
                    document.getElementById('shopSettingsBtn').classList.add('hidden');

                    ['sidebarDashboard', 'sidebarExpenses', 'sidebarClients', 'sidebarChangePass'].forEach(id => {
                        if (document.getElementById(id)) document.getElementById(id).classList.add('hidden');
                    });

                    const checksButton = document.querySelector('button[onclick="showPage(\'checks-promissory\')"]');
                    if (checksButton) checksButton.classList.add('hidden');

                    document.body.classList.add('staff-mode');

                    showPage('inventory');
                }

                initFilterOptions();
                refreshData();
                showToast(t('welcome_user', { name: currentUser.username }));

                if (currentUser && currentUser.invoiceSize === 'Thermal' && typeof initQZTray === 'function') {
                    initQZTray();
                }

                // تحديث واجهة البصمة
                if (typeof updateBiometricUIState === 'function') {
                    updateBiometricUIState();
                }
            } else {
                showToast(t(res.message) || res.message, 'error');
            }
        }

        async function handleLogin() {
            const u = document.getElementById('loginUser').value.trim();
            const p = document.getElementById('loginPass').value.trim();
            const loginBtn = document.getElementById('loginBtn');
            if (!u || !p) return showToast(t('fill_fields_error'), 'error');

            setLoading(true);
            setBtnLoading(loginBtn, true, t('login_btn'));

            let deviceId = localStorage.getItem('tajirox_device_id');
            if (!deviceId) {
                deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
                localStorage.setItem('tajirox_device_id', deviceId);
            }

            try {
                const hashedP = await hashPassword(p);

                google.script.run
                    .withSuccessHandler(res => {
                        handleLoginSuccess(res, loginBtn);
                    })
                    .withFailureHandler(err => {
                        setLoading(false);
                        setBtnLoading(loginBtn, false);
                        showToast(t('connection_error') + ': ' + (err.message || err), 'error');
                    })
                    .login(u, hashedP, deviceId);
            } catch (error) {
                setLoading(false);
                setBtnLoading(loginBtn, false);
                showToast("خطأ في عملية الدخول", 'error');
                console.error(error);
            }
        }

        function promptLogout() {
            openConfirm({
                title: t('logout_title'),
                msg: t('logout_msg'),
                iconClass: "fas fa-sign-out-alt",
                colorClass: "bg-rose-600",
                onConfirm: () => {
                    if (currentDbId && typeof clearLocalCache === 'function') {
                        clearLocalCache(currentDbId);
                    }
                    
                    // Détruire le widget de support lors de la déconnexion
                    if (typeof destroySupportWidget === 'function') {
                        destroySupportWidget();
                    }

                    // Restaurer le menu de navigation latéral original si sauvegardé
                    if (window.originalSidebarNavHtml) {
                        const sidebarNav = document.querySelector('#sidebar nav');
                        if (sidebarNav) {
                            sidebarNav.innerHTML = window.originalSidebarNavHtml;
                        }
                    }

                    // Réafficher le menu mobile inférieur
                    const mobileBottomNav = document.getElementById('mobileBottomNav');
                    if (mobileBottomNav) {
                        mobileBottomNav.classList.remove('hidden');
                    }

                    currentUser = null;
                    currentDbId = null;
                    document.getElementById('appSection').classList.add('hidden');
                    document.getElementById('authSection').classList.remove('hidden');
                    document.getElementById('whatsappBtn').classList.add('hidden'); // إظهار زر الواتساب عند الخروج
                    document.getElementById('loginPass').value = "";
                    showToast(t('logout_success'));
                }
            });
        }

        function openRegisterModal() {
            document.getElementById('regShopName').value = '';
            document.getElementById('regOwnerName').value = '';
            document.getElementById('regUsername').value = '';
            document.getElementById('regEmail').value = '';
            document.getElementById('regPhone').value = '';
            document.getElementById('regPass').value = '';
            document.getElementById('regAcceptTerms').checked = false;
            openModal('registerModal');
        }

        async function handleRegister() {
            const rawPass = document.getElementById('regPass').value.trim();
            const hashedPass = rawPass ? await hashPassword(rawPass) : '';
            const data = {
                shopName: document.getElementById('regShopName').value.trim(),
                ownerName: document.getElementById('regOwnerName').value.trim(),
                username: document.getElementById('regUsername').value.trim(),
                email: document.getElementById('regEmail').value.trim(),
                phone: document.getElementById('regPhone').value.trim(),
                password: hashedPass,
                lang: currentLang
            };
            const regBtn = document.getElementById('registerBtn');

            if (!data.shopName || !data.ownerName || !data.username || !data.email || !data.password) return showToast(t('fill_fields_error'), 'error');

            const acceptTerms = document.getElementById('regAcceptTerms').checked;
            if (!acceptTerms) return showToast(t('accept_terms_error'), 'error');

            setLoading(true);
            setBtnLoading(regBtn, true, t('creating_account'));
            google.script.run.withSuccessHandler(res => {
                setLoading(false);
                setBtnLoading(regBtn, false);
                if (res.success) {
                    closeModal('registerModal');
                    showToast(t(res.message) || t('SHOP_REGISTERED_SUCCESS_MSG'), 'info');
                    document.getElementById('loginUser').value = '';
                } else {
                    showToast(t(res.message) || res.message, 'error');
                }
            }).registerNewShop(data);
        }

        function openForgotPassModal() {
            document.getElementById('forgotEmailInput').value = "";
            document.getElementById('otpInput').value = "";
            document.getElementById('resetNewPassInput').value = "";
            document.getElementById('forgotStep1').classList.remove('hidden');
            document.getElementById('forgotStep2').classList.add('hidden');
            openModal('forgotPassModal');
        }

        function handleRequestOtp() {
            const email = document.getElementById('forgotEmailInput').value.trim();
            const btn = document.getElementById('btnSendOtp');
            if (!email) return showToast(t('fill_fields_error'), 'error');

            setLoading(true);
            setBtnLoading(btn, true, t('sending'));
            google.script.run.withSuccessHandler(res => {
                setLoading(false);
                setBtnLoading(btn, false);
                if (res.success) {
                    document.getElementById('forgotStep1').classList.add('hidden');
                    document.getElementById('forgotStep2').classList.remove('hidden');
                    document.getElementById('otpInput').focus();
                    
                    const step2Msg = document.querySelector('#forgotStep2 p');
                    showToast(t('otp_sent'));
                    if (step2Msg) step2Msg.innerText = t('otp_sent_msg');
                } else { showToast(res.message, 'error'); }
            }).sendOtp(email, currentLang);
        }

        async function handleVerifyAndReset() {
            const email = document.getElementById('forgotEmailInput').value.trim();
            const otp = document.getElementById('otpInput').value.trim();
            const newPass = document.getElementById('resetNewPassInput').value.trim();
            const btn = document.getElementById('btnResetConfirm');
            if (!otp || !newPass) return showToast(t('enter_otp_pass'), 'error');

            setLoading(true);
            setBtnLoading(btn, true, t('changing_pass'));
            const newHash = await hashPassword(newPass);
            google.script.run.withSuccessHandler(res => {
                setLoading(false);
                setBtnLoading(btn, false);
                if (res.success) {
                    showToast(t('pass_changed_success'));
                    closeModal('forgotPassModal');
                } else { showToast(res.message, 'error'); }
            }).verifyOtpAndResetPassword(email, otp, newHash);
        }

        function openChangePassModal() {
            document.getElementById('oldPassInput').value = "";
            document.getElementById('newPassInput').value = "";
            openModal('changePassModal');
        }

        async function submitChangePass() {
            const oldPass = document.getElementById('oldPassInput').value.trim();
            const newPass = document.getElementById('newPassInput').value.trim();
            const btn = document.getElementById('btnUpdatePass');

            if (!oldPass || !newPass) {
                showToast(t('fill_fields'), 'error');
                return;
            }

            // التحقق من أن كلمة المرور الجديدة مختلفة
            if (oldPass === newPass) {
                showToast('كلمة المرور الجديدة يجب أن تكون مختلفة عن القديمة', 'error');
                return;
            }

            setLoading(true);
            setBtnLoading(btn, true, t('updating'));

            try {
                const oldHash = await hashPassword(oldPass);
                const newHash = await hashPassword(newPass);

                google.script.run
                    .withSuccessHandler(res => {
                        setLoading(false);
                        setBtnLoading(btn, false);

                        if (res.success) {
                            showToast(t('pass_updated_success'));
                            closeModal('changePassModal'); // إغلاق النافذة المنبثقة
                            // تفريغ الحقول بعد الإغلاق
                            document.getElementById('oldPassInput').value = "";
                            document.getElementById('newPassInput').value = "";
                        } else {
                            showToast(t(res.message) || res.message, 'error');
                        }
                    })
                    .withFailureHandler(err => {
                        setLoading(false);
                        setBtnLoading(btn, false);
                        showToast('حدث خطأ في الاتصال: ' + err, 'error');
                    })
                    .changePassword(currentUser.id, oldHash, newHash, currentDbId);

            } catch (error) {
                setLoading(false);
                setBtnLoading(btn, false);
                showToast('حدث خطأ: ' + error, 'error');
            }
        }

        function togglePasswordVisibility(inputId, iconId = null) {
            const input = document.getElementById(inputId);
            if (!input) return;
            
            // محاولة إيجاد الأيقونة بكافة الطرق والأنماط الممكنة
            let icon = iconId ? document.getElementById(iconId) : null;
            if (!icon) {
                icon = document.getElementById(`eyeIcon-${inputId}`) || 
                       document.getElementById('eyeIcon' + inputId.charAt(0).toUpperCase() + inputId.slice(1)) ||
                       document.getElementById(inputId.replace('Input', 'Eye')) ||
                       document.getElementById('eyeIcon' + inputId.replace('Input', '')) ||
                       document.querySelector(`[onclick*="${inputId}"] i`);
            }
            
            if (input.type === 'password') {
                input.type = 'text';
                if (icon) {
                    icon.className = 'fas fa-eye-slash text-sm';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                }
            } else {
                input.type = 'password';
                if (icon) {
                    icon.className = 'fas fa-eye text-sm';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            }
        }
        window.togglePasswordVisibility = togglePasswordVisibility;

        // ==========================================
        //         بصمة الوجه / الإصبع (WebAuthn)
        // ==========================================

        function isBiometricSupported() {
            const hasCredSupport = !!window.PublicKeyCredential;
            
            // تحقق صارم مما إذا كان الجهاز هاتفاً أو تابلت وليس كمبيوتر ديسك توب
            const ua = navigator.userAgent.toLowerCase();
            const isMobileOrTablet = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua) ||
                                     (/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk)/i.test(ua)) ||
                                     (('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 1024);

            return hasCredSupport && isMobileOrTablet;
        }

        async function initBiometricUI() {
            const faceIdBtn = document.getElementById('faceIdBtn');
            if (!faceIdBtn) return;

            if (isBiometricSupported()) {
                faceIdBtn.classList.remove('hidden'); // يظهر دائماً على الهواتف والتابلت
            } else {
                faceIdBtn.classList.add('hidden'); // يختفي على الكمبيوتر
            }
        }

        // تحديث حالة الواجهة لتبويب إعدادات المتجر
        async function updateBiometricUIState() {
            const badge = document.getElementById('biometricStatusBadge');
            const btn = document.getElementById('btnToggleBiometric');
            const settingsCard = document.getElementById('biometricSettingsCard');
            
            if (!isBiometricSupported()) {
                if (settingsCard) {
                    settingsCard.style.display = 'none'; // إخفاء الميزة تماماً من إعدادات الكمبيوتر
                }
                if (badge && btn) {
                    badge.innerText = t('biometric_not_supported') || "غير مدعوم";
                    badge.className = "bg-rose-50 text-rose-600 px-3 py-1.5 rounded-full font-black text-[9px]";
                    btn.style.display = 'none';
                }
                return;
            }

            if (settingsCard) {
                settingsCard.style.display = 'block'; // التأكد من ظهوره على الهاتف والتابلت
            }
            if (!badge || !btn) return;

            const isEnrolled = localStorage.getItem('biometric_enrolled') === 'true';
            if (isEnrolled) {
                badge.innerText = t('biometric_active') || "نشط ومفعل";
                badge.className = "bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full font-black text-[9px]";
                btn.innerText = t('biometric_btn_disable') || "إلغاء التفعيل";
                btn.className = "px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95";
            } else {
                badge.innerText = t('biometric_inactive') || "غير نشط";
                badge.className = "bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full font-black text-[9px]";
                btn.innerText = t('biometric_btn_enable') || "تفعيل الآن";
                btn.className = "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95";
            }
        }

        async function enrollBiometricOnLogin(u, rawPass) {
            setLoading(true);
            const faceIdBtn = document.getElementById('faceIdBtn');
            if (faceIdBtn) setBtnLoading(faceIdBtn, true, "...");

            const hashed = await hashPassword(rawPass);

            // 1. تحقق من صحة الحساب على السيرفر أولاً
            google.script.run
                .withSuccessHandler(async res => {
                    if (!res.success) {
                        setLoading(false);
                        if (faceIdBtn) setBtnLoading(faceIdBtn, false);
                        showToast(res.message, 'error');
                        return;
                    }

                    // 2. إطلاق بصمة الوجه للجهاز لتسجيل البصمة محلياً
                    try {
                        const challenge = new Uint8Array(32);
                        window.crypto.getRandomValues(challenge);

                        const userId = new Uint8Array(4);
                        window.crypto.getRandomValues(userId);

                        const publicKeyOptions = {
                            challenge: challenge,
                            rp: {
                                name: "Tajirox",
                                id: window.location.hostname
                            },
                            user: {
                                id: userId,
                                name: u,
                                displayName: u
                            },
                            pubKeyCredParams: [{
                                type: "public-key",
                                alg: -7 // ES256
                            }],
                            authenticatorSelection: {
                                userVerification: "required"
                            },
                            timeout: 60000
                        };

                        const credential = await navigator.credentials.create({ publicKey: publicKeyOptions });
                        if (credential) {
                            // توليد التوكن الآمن
                            const token = Array.from(window.crypto.getRandomValues(new Uint8Array(32)))
                                .map(b => b.toString(16).padStart(2, '0')).join('');
                            const dbId = res.dbId || res.shopDbId;

                            // 3. حفظ توكن البصمة على السيرفر
                            google.script.run
                                .withSuccessHandler(regRes => {
                                    setLoading(false);
                                    if (faceIdBtn) setBtnLoading(faceIdBtn, false);

                                    if (regRes.success) {
                                        // حفظ البيانات محلياً
                                        localStorage.setItem('biometric_enrolled', 'true');
                                        localStorage.setItem('biometric_username', u);
                                        localStorage.setItem('biometric_token', token);
                                        localStorage.setItem('biometric_db_id', dbId);

                                        showToast(t('biometric_enroll_success') || "تم تفعيل الدخول ببصمة الوجه بنجاح!");
                                        
                                        // تسجيل الدخول الفوري
                                        handleLoginSuccess(res, faceIdBtn);
                                    } else {
                                        showToast("فشل تسجيل البصمة على الخادم: " + regRes.message, "error");
                                    }
                                })
                                .withFailureHandler(err => {
                                    setLoading(false);
                                    if (faceIdBtn) setBtnLoading(faceIdBtn, false);
                                    showToast("فشل الاتصال بالخادم لتسجيل البصمة", "error");
                                })
                                .registerBiometricToken(res.user.id, token, dbId);
                        } else {
                            setLoading(false);
                            if (faceIdBtn) setBtnLoading(faceIdBtn, false);
                        }
                    } catch (err) {
                        console.error("Biometric registration error:", err);
                        showToast(t('biometric_not_supported') || "فشل تفعيل البصمة أو البصمة غير مدعومة", 'error');
                        setLoading(false);
                        if (faceIdBtn) setBtnLoading(faceIdBtn, false);
                    }
                })
                .withFailureHandler(err => {
                    setLoading(false);
                    if (faceIdBtn) setBtnLoading(faceIdBtn, false);
                    showToast(t('connection_error') + ': ' + (err.message || err), 'error');
                })
                .login(u, hashed);
        }

        let hasAttemptedBiometric = false;

        async function handleBiometricLogin(isExplicit = false) {
            if (!isBiometricSupported()) {
                if (isExplicit) showToast(t('biometric_not_supported'), 'error');
                return;
            }

            // إذا كان استدعاء تلقائياً وتمت المحاولة مسبقاً، لا تفعل شيئاً لمنع التكرار المزعج
            if (!isExplicit && hasAttemptedBiometric) {
                return;
            }

            const u = localStorage.getItem('biometric_username');
            const token = localStorage.getItem('biometric_token');
            const dbId = localStorage.getItem('biometric_db_id');

            if (!u || !token || !dbId) {
                if (isExplicit) {
                    const enteredUser = document.getElementById('loginUser').value.trim();
                    const enteredPass = document.getElementById('loginPass').value.trim();

                    if (enteredUser && enteredPass) {
                        // تفعيل فوري وبدون إعدادات!
                        enrollBiometricOnLogin(enteredUser, enteredPass);
                    } else {
                        showToast(t('biometric_not_configured') || "لتفعيل بصمة الوجه (Face ID)، يرجى كتابة اسم المستخدم وكلمة المرور أولاً ثم الضغط على هذا الزر لتأكيد جهازك.", 'info');
                    }
                }
                return;
            }

            // وضع علامة على أنه تمت المحاولة لمنع أي استدعاء آلي آخر
            if (!isExplicit) {
                hasAttemptedBiometric = true;
            }

            try {
                // طلب التحدي والتحقق من البصمة محلياً أولاً لحماية التوكن
                const challenge = new Uint8Array(32);
                window.crypto.getRandomValues(challenge);

                const publicKeyOptions = {
                    challenge: challenge,
                    rpId: window.location.hostname,
                    userVerification: "required",
                    timeout: 60000
                };

                const assertion = await navigator.credentials.get({ publicKey: publicKeyOptions });
                if (assertion) {
                    setLoading(true);
                    const faceIdBtn = document.getElementById('faceIdBtn');
                    if (faceIdBtn) setBtnLoading(faceIdBtn, true, "...");

                    document.getElementById('loginUser').value = u;
                    document.getElementById('loginPass').value = "••••••••";

                    google.script.run
                        .withSuccessHandler(res => {
                            if (faceIdBtn) setBtnLoading(faceIdBtn, false);
                            handleLoginSuccess(res, faceIdBtn);
                        })
                        .withFailureHandler(err => {
                            setLoading(false);
                            if (faceIdBtn) setBtnLoading(faceIdBtn, false);
                            showToast(t('connection_error') + ': ' + (err.message || err), 'error');
                        })
                        .loginWithBiometricToken(u, token, dbId);
                }
            } catch (err) {
                console.error("Biometric authentication error:", err);
                if (isExplicit) {
                    showToast("فشلت عملية التحقق بالبصمة", 'error');
                }
            }
        }

        // ==========================================
        //         Visitor Tracking Functions
        // ==========================================
        function getBrowserAndDevice() {
            const ua = navigator.userAgent;
            let browser = "Unknown Browser";
            let os = "Unknown OS";
            let device = "Desktop";

            // Detect Device
            if (/Mobi|Android|iPhone|iPod/i.test(ua)) {
                device = "Mobile";
            } else if (/Tablet|iPad/i.test(ua)) {
                device = "Tablet";
            }

            // Detect OS
            if (/Windows/i.test(ua)) os = "Windows";
            else if (/Android/i.test(ua)) os = "Android";
            else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
            else if (/Macintosh|Mac OS X/i.test(ua)) os = "macOS";
            else if (/Linux/i.test(ua)) os = "Linux";

            // Detect Browser
            if (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua)) browser = "Chrome";
            else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
            else if (/Firefox/i.test(ua)) browser = "Firefox";
            else if (/Edge|Edg/i.test(ua)) browser = "Edge";
            else if (/MSIE|Trident/i.test(ua)) browser = "Internet Explorer";

            return { device, os, browser };
        }

        async function trackVisit(username, shopName) {
            try {
                let ip = "Unknown", country = "Unknown", city = "Unknown";
                try {
                    const response = await fetch("https://freeipapi.com/api/json");
                    if (response.ok) {
                        const geo = await response.json();
                        ip = geo.ipAddress || geo.ip || "Unknown";
                        country = geo.countryName || geo.country || "Unknown";
                        city = geo.cityName || geo.city || "Unknown";
                    }
                } catch (e) {
                    console.error("GeoIP lookup failed, using fallbacks:", e);
                }

                const clientInfo = getBrowserAndDevice();
                
                google.script.run
                    .withSuccessHandler(res => {
                        console.log("Visit logged successfully:", res);
                    })
                    .withFailureHandler(err => {
                        console.error("Failed to log visit:", err);
                    })
                    .logVisit(
                        username || "Guest",
                        shopName || "Public",
                        ip,
                        country,
                        city,
                        clientInfo.device,
                        clientInfo.os,
                        clientInfo.browser
                    );
            } catch (err) {
                console.error("Error in trackVisit:", err);
            }
        }

        async function submit2FACode() {
            const code = document.getElementById('login2FACodeInput').value.trim();
            const btn = document.getElementById('confirm2FABtn');
            if (!code || code.length !== 6) {
                showToast(currentLang === 'fr' ? "Veuillez entrer un code à 6 chiffres" : "الرجاء إدخال رمز مكون من 6 أرقام", "error");
                return;
            }
            if (!window.temp2FASession) return;

            setLoading(true);
            setBtnLoading(btn, true, t('sending') || 'جاري...');
            
            let deviceId = localStorage.getItem('tajirox_device_id');

            google.script.run
                .withSuccessHandler(res => {
                    setLoading(false);
                    setBtnLoading(btn, false);
                    if (res.success) {
                        closeModal('login2FAModal');
                        window.temp2FASession = null;
                        handleLoginSuccess(res, document.getElementById('loginBtn'));
                    } else {
                        showToast(currentLang === 'fr' ? "Code invalide ou expiré" : "رمز غير صحيح أو منتهي الصلاحية", "error");
                    }
                })
                .withFailureHandler(err => {
                    setLoading(false);
                    setBtnLoading(btn, false);
                    showToast("خطأ في التحقق: " + (err.message || err), 'error');
                })
                .verifyLogin2FA(window.temp2FASession.username, code, window.temp2FASession, deviceId);
        }
        window.submit2FACode = submit2FACode;
