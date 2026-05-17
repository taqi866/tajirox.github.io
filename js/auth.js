        async function handleLogin() {
            const u = document.getElementById('loginUser').value.trim();
            const p = document.getElementById('loginPass').value.trim();
            const loginBtn = document.getElementById('loginBtn');
            if (!u || !p) return showToast(t('fill_fields_error'), 'error');

            setLoading(true);
            setBtnLoading(loginBtn, true, t('login_btn'));

            try {
                const hashedP = await hashPassword(p);

                google.script.run
                    .withSuccessHandler(res => {
                        setLoading(false);
                        setBtnLoading(loginBtn, false);

                        if (res.success) {
                            currentUser = res.user;
                            currentDbId = res.dbId;

                            if (!currentUser.shopName) currentUser.shopName = res.shopName || "متجر " + currentUser.username;

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
                                const subEnd = currentUser.subscriptionEnd ? new Date(currentUser.subscriptionEnd) : new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
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

                            document.getElementById('userNameDisplay').innerText = currentUser.username;
                            document.getElementById('userRoleDisplay').innerText = isAdmin ? t('admin_role') : t('staff_role');

                            // --- Super Admin ---
                            if (currentUser.role === 'super_admin') {
                                document.getElementById('userNameDisplay').innerText = t('system_admin');
                                document.getElementById('userRoleDisplay').innerText = t('admin_role');
                                document.getElementById('userRoleDisplay').className = "text-[9px] bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full inline-block mt-1 font-black";

                                 document.querySelector('nav').innerHTML = `
                            <button onclick="showPage('admin-dashboard')" class="sidebar-link active w-full flex items-center p-3 rounded-xl transition-all font-bold text-indigo-600" data-i18n="admin_shops_manage">
                                <i class="fas fa-store-alt ml-3 opacity-80"></i> ${t('admin_shops_manage')}
                            </button>
                        `;

                                loadAdminData();
                                showPage('admin-dashboard');
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
                        } else {
                            showToast(t(res.message) || res.message, 'error');
                        }
                    })
                    .withFailureHandler(err => {
                        setLoading(false);
                        setBtnLoading(loginBtn, false);
                        showToast(t('connection_error') + ': ' + (err.message || err), 'error');
                    })
                    .login(u, hashedP);
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
                    currentUser = null;
                    document.getElementById('appSection').classList.add('hidden');
                    document.getElementById('authSection').classList.remove('hidden');
                    document.getElementById('whatsappBtn').classList.remove('hidden'); // إظهار زر الواتساب عند الخروج
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
                    showToast(t('otp_sent'));
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