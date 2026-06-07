        let adminShopsCache = [];

        function renderSubscriptionPage() {
            if (!currentUser || !currentUser.subscription) return;

            const start = parseDate(currentUser.subscription.start);
            const end = parseDate(currentUser.subscription.end);
            const today = new Date();

            document.getElementById('subStartDate').innerText = formatDateSimple(start);
            document.getElementById('subEndDate').innerText = formatDateSimple(end);

            const totalDuration = end - start;
            const elapsed = today - start;
            const remaining = end - today;
            const daysLeft = Math.ceil(remaining / (1000 * 60 * 60 * 24));

            // حساب النسبة المئوية للتقدم
            let percentage = (elapsed / totalDuration) * 100;
            percentage = Math.min(Math.max(percentage, 0), 100); // حصر بين 0 و 100

            const isTrial = currentUser.isTrial === true || currentUser.isTrial === 'true' || 
                (currentUser.subscription && Math.ceil((parseDate(currentUser.subscription.end) - parseDate(currentUser.subscription.start)) / (1000 * 60 * 60 * 24)) <= 15);

            document.getElementById('subProgressBar').style.width = `${percentage}%`;
            
            // استخدام مفتاح تحذير تجريبي في حالة الفترة التجريبية
            const warningKey = isTrial ? 'trial_warning' : 'sub_warning';
            document.getElementById('subDaysLeft').innerText = daysLeft > 0 ? t(warningKey, { days: daysLeft }) : t('expired');

            // تلوين الشريط حسب الحالة
            const bar = document.getElementById('subProgressBar');
            if (daysLeft <= 30 || isTrial) {
                bar.classList.remove('bg-indigo-600', 'bg-emerald-500');
                bar.classList.add('bg-rose-500');
                
                // تحديث الرسالة والزر حسب حالة التجربة
                const msgEl = document.querySelector('[data-i18n="sub_expiring_msg"]');
                const btnEl = document.getElementById('requestRenewalBtn');
                
                if (isTrial) {
                    if (msgEl) msgEl.innerText = t('activate_sub_msg');
                    if (btnEl) {
                        btnEl.innerHTML = `<i class="fas fa-check-circle ml-2"></i> ${t('activate_account_or_sub')}`;
                    }
                } else {
                    if (msgEl) msgEl.innerText = t('sub_expiring_msg');
                    if (btnEl) {
                        btnEl.innerHTML = `<i class="fas fa-sync-alt ml-2"></i> ${t('request_renewal')}`;
                    }
                }

                document.getElementById('renewalSection').classList.remove('hidden');
            } else {
                bar.classList.remove('bg-rose-500');
                bar.classList.add('bg-indigo-600');
                document.getElementById('renewalSection').classList.add('hidden');
            }
        }

        function requestRenewal() {
            const btn = document.getElementById('requestRenewalBtn');
            setBtnLoading(btn, true, t('sending'));

            google.script.run
                .withSuccessHandler(res => {
                    setBtnLoading(btn, false);
                    if (res.success) {
                        document.getElementById('renewalSection').classList.add('hidden');
                        
                        // تحديث رسالة التأكيد ديناميكياً بناءً على نوع الحساب
                        const sentMsgSpan = document.querySelector('#renewalSentMessage span');
                        if (sentMsgSpan) {
                            sentMsgSpan.innerText = currentUser.isTrial ? (t('activation_sent_msg') || "تم إرسال طلب التفعيل بنجاح. سيتم التواصل معك قريباً لإتمام العملية.") : t('renewal_sent_msg');
                        }
                        
                        document.getElementById('renewalSentMessage').classList.remove('hidden');
                        showToast(currentUser.isTrial ? (t('activation_request_sent') || "تم إرسال طلب التفعيل بنجاح. سيظهر زر التفعيل لدى المشرف.") : t('renewal_request_sent'));
                    } else {
                        showToast(t('op_failed') + ': ' + res.message, 'error');
                    }
                })
                .withFailureHandler(err => {
                    setBtnLoading(btn, false);
                    showToast(t('connection_error'), 'error');
                })
                .requestShopRenewal(currentUser.shopName, currentUser.username, currentUser.email);
        }

        function openCustomEmailModal() {
            const shopSelect = document.getElementById('customEmailShopCode');
            shopSelect.innerHTML = '';

            shopSelect.innerHTML += `<option value="all" class="font-bold text-blue-600">${t('all_shops')}</option>`;
            if (adminShopsCache && adminShopsCache.length > 0) {
                adminShopsCache.forEach(shop => {
                    shopSelect.innerHTML += `<option value="${shop.username}">${shop.name} (${shop.email})</option>`;
                });
            }
            openModal('customEmailModal');

            document.getElementById('customEmailSubject').value = '';
            document.getElementById('customEmailBody').value = '';
        }

        function sendCustomEmail() {
            const shopCode = document.getElementById('customEmailShopCode').value;
            const subject = document.getElementById('customEmailSubject').value;
            const body = document.getElementById('customEmailBody').value;

            // Validate inputs
            if (!shopCode || !subject || !body) {
                showToast("الرجاء ملء جميع الحقول", 'error');
                return;
            }

            const btn = document.getElementById('sendCustomEmailBtn');
            setBtnLoading(btn, true, t('sending'));

            // Call the Apps Script function to send the email
            google.script.run
                .withSuccessHandler(result => {
                    setBtnLoading(btn, false);
                    if (result.success) {
                        showToast(t(result.message) || "تم إرسال البريد الإلكتروني بنجاح");
                        closeModal('customEmailModal');
                    } else {
                        showToast("فشل إرسال البريد الإلكتروني: " + result.message, 'error');
                    }
                })
                .withFailureHandler(error => {
                    setBtnLoading(btn, false);
                    showToast("حدث خطأ أثناء إرسال البريد الإلكتروني: " + error, 'error');
                })
                .handleSendCustomEmail(shopCode, subject, body);
        }

        function openShopSettings() {
            if (!currentUser) return;

            document.getElementById('shopPhoneInput').value = currentUser.shopPhone || '';
            document.getElementById('shopAddressInput').value = currentUser.shopAddress || '';
            document.getElementById('shopLogoInput').value = currentUser.shopLogo || '';
            document.getElementById('shopNameDisplay').value = currentUser.shopName || '';
            document.getElementById('shopOwnerDisplay').value = currentUser.ownerName || '';
            document.getElementById('scanSkipQtyInput').checked = currentUser.scanSkipQty || false;
            document.getElementById('settingPurchaseOnly').checked = currentUser.purchaseOnly || false;
            document.getElementById('settingShowPurchaseToEmployee').checked = currentUser.showPurchaseToEmployee || false;
            document.getElementById('settingLowResourceMode').checked = localStorage.getItem('lowResourceMode') === 'true';

            let savedInvoiceSize = currentUser.invoiceSize || 'A4';
            if (savedInvoiceSize === 'A5') savedInvoiceSize = 'A4';
            document.getElementById('settingInvoiceSize').value = savedInvoiceSize;
            document.getElementById('settingInvoiceWidth').value = currentUser.invoiceWidth || 80;

            document.getElementById('settingBarcodeSize').value = currentUser.barcodeSize || 'A4';
            document.getElementById('settingBarcodeWidth').value = currentUser.barcodeWidth || 40;
            document.getElementById('settingBarcodeHeight').value = currentUser.barcodeHeight || 25;
            document.getElementById('settingShowPriceOnBarcode').checked = currentUser.showPriceOnBarcode !== false;

            // استعادة لون الفاتورة
            const savedColor = localStorage.getItem('invoiceColor');
            if (savedColor) {
                document.getElementById('settingInvoiceColor').value = savedColor;
                currentUser.invoiceColor = savedColor;
            } else if (currentUser.invoiceColor) {
                document.getElementById('settingInvoiceColor').value = currentUser.invoiceColor;
            } else {
                document.getElementById('settingInvoiceColor').value = '#000000';
            }

            document.getElementById('settingInvoiceDesign').value = currentUser.invoiceDesign || 'standard';
            const footerInput = document.getElementById('settingInvoiceFooter');
            if (footerInput) {
                footerInput.value = currentUser.invoiceFooter || '';
            }

            // Charger les configurations de l'IA depuis le serveur (currentUser) ou localStorage
            const shopName = currentUser.shopName || 'DefaultShop';
            const aiActive = currentUser.aiActive !== undefined ? currentUser.aiActive : (localStorage.getItem(`tajirox_ai_active_${shopName}`) === 'true');
            const aiKey = currentUser.aiKey !== undefined ? currentUser.aiKey : (localStorage.getItem(`tajirox_ai_key_${shopName}`) || '');
            
            const aiActiveCheckbox = document.getElementById('settingAIActive');
            if (aiActiveCheckbox) aiActiveCheckbox.checked = aiActive;
            const aiKeyInput = document.getElementById('settingAIKey');
            if (aiKeyInput) aiKeyInput.value = aiKey;
            
            const aiModel = currentUser.aiModel !== undefined ? currentUser.aiModel : (localStorage.getItem(`tajirox_ai_model_${shopName}`) || 'auto');
            const aiModelSelect = document.getElementById('settingAIModel');
            if (aiModelSelect) aiModelSelect.value = aiModel;
            
            const aiTestStatus = document.getElementById('aiTestStatus');
            if (aiTestStatus) aiTestStatus.innerText = '';

            toggleInvoiceSettings();
            toggleBarcodeSettings();
            addQZTraySettingsToPage();
        }

        function saveShopSettings() {
            const phone = document.getElementById('shopPhoneInput').value.trim();
            const address = document.getElementById('shopAddressInput').value.trim();
            const logo = document.getElementById('shopLogoInput').value.trim();
            const scanSkipQty = document.getElementById('scanSkipQtyInput').checked;
            const purchaseOnly = document.getElementById('settingPurchaseOnly').checked;
            const showPurchaseToEmployee = document.getElementById('settingShowPurchaseToEmployee').checked;

            const invoiceSize = document.getElementById('settingInvoiceSize').value;
            const invoiceWidth = document.getElementById('settingInvoiceWidth').value;
            const barcodeSize = document.getElementById('settingBarcodeSize').value;
            const barcodeWidth = document.getElementById('settingBarcodeWidth').value;
            const barcodeHeight = document.getElementById('settingBarcodeHeight').value;

            const invoiceColor = document.getElementById('settingInvoiceColor').value;
            const invoiceDesign = document.getElementById('settingInvoiceDesign').value;
            const footerInput = document.getElementById('settingInvoiceFooter');
            const invoiceFooter = footerInput ? footerInput.value.trim() : '';
            const showPriceOnBarcode = document.getElementById('settingShowPriceOnBarcode').checked;

            // حفظ اللون في localStorage فوراً
            localStorage.setItem('invoiceColor', invoiceColor);

            // حفظ وضع الأجهزة الضعيفة في localStorage فوراً
            const lowResourceModeVal = document.getElementById('settingLowResourceMode').checked;
            localStorage.setItem('lowResourceMode', lowResourceModeVal);
            lowResourceMode = lowResourceModeVal;
            document.documentElement.classList.toggle('low-resource-active', lowResourceModeVal);

            // Sauvegarder les configurations de l'IA dans localStorage
            const shopName = currentUser.shopName || 'DefaultShop';
            const aiActiveCheckbox = document.getElementById('settingAIActive');
            const aiKeyInput = document.getElementById('settingAIKey');
            const aiModelSelect = document.getElementById('settingAIModel');
            
            if (aiActiveCheckbox) {
                localStorage.setItem(`tajirox_ai_active_${shopName}`, aiActiveCheckbox.checked);
            }
            if (aiKeyInput) {
                localStorage.setItem(`tajirox_ai_key_${shopName}`, aiKeyInput.value.trim());
            }
            if (aiModelSelect) {
                localStorage.setItem(`tajirox_ai_model_${shopName}`, aiModelSelect.value);
            }

            const btn = document.getElementById('saveShopSettingsBtn');

            setBtnLoading(btn, true, t('saving'));

            const aiActiveVal = aiActiveCheckbox ? aiActiveCheckbox.checked : false;
            const aiKeyVal = aiKeyInput ? aiKeyInput.value.trim() : '';
            const aiModelVal = aiModelSelect ? aiModelSelect.value : 'auto';

            google.script.run.withSuccessHandler(res => {
                setBtnLoading(btn, false);
                if (res.success) {
                    currentUser.shopPhone = phone;
                    currentUser.shopAddress = address;
                    currentUser.shopLogo = logo;
                    currentUser.scanSkipQty = scanSkipQty;
                    currentUser.purchaseOnly = purchaseOnly;
                    currentUser.showPurchaseToEmployee = showPurchaseToEmployee;

                    currentUser.invoiceSize = invoiceSize;
                    currentUser.invoiceWidth = invoiceWidth;
                    currentUser.barcodeSize = barcodeSize;
                    currentUser.barcodeWidth = barcodeWidth;
                    currentUser.barcodeHeight = barcodeHeight;
                    currentUser.invoiceColor = invoiceColor;
                    currentUser.invoiceDesign = invoiceDesign;
                    currentUser.invoiceFooter = invoiceFooter;
                    currentUser.showPriceOnBarcode = showPriceOnBarcode;
                    
                    // Sync AI settings locally in currentUser
                    currentUser.aiActive = aiActiveVal;
                    currentUser.aiKey = aiKeyVal;
                    currentUser.aiModel = aiModelVal;

                    if (logo) {
                        document.getElementById('sidebarUserIcon').innerHTML = `<img src="${logo}" class="w-full h-full object-cover rounded-2xl" alt="Logo">`;
                    } else {
                        document.getElementById('sidebarUserIcon').innerHTML = `<i class="fas fa-user-circle text-3xl"></i>`;
                    }

                    showToast(t('settings_saved'));

                    if (invoiceSize === 'Thermal') {
                        showToast(t('auto_print_enabled'), 'success');
                    }

                    // إعادة عرض الصفحة الحالية لتحديث اللون
                    const currentPage = document.querySelector('.page-content:not(.hidden)')?.id.replace('page-', '');
                    if (currentPage) {
                        showPage(currentPage);
                    }
                } else {
                    showToast(t(res.message) || res.message, 'error');
                }
            }).updateShopSettings(currentUser.shopCode, phone, address, logo, scanSkipQty, purchaseOnly, invoiceSize, invoiceWidth, barcodeSize, barcodeWidth, barcodeHeight, invoiceColor, invoiceDesign, invoiceFooter, showPurchaseToEmployee, showPriceOnBarcode, aiActiveVal, aiKeyVal, aiModelVal);
        }

        let lastVisitStats = null;
        let lastShopsData = null;

        function loadAdminData() {
            setLoading(true);
            lastVisitStats = null;
            lastShopsData = null;
            
            // تحميل الإحصائيات أولاً
            google.script.run
                .withSuccessHandler(stats => {
                    lastVisitStats = stats;
                    checkAndRenderStats();
                })
                .withFailureHandler(err => {
                    console.error("Error loading stats:", err);
                })
                .getVisitStats();

            google.script.run
                .withSuccessHandler(shops => {
                    setLoading(false);
                    adminShopsCache = shops || [];
                    lastShopsData = shops;
                    renderAdminShops(shops);
                    checkAndRenderStats();
                    
                    // Rafraîchir les conversations du support client
                    if (typeof loadAdminSupportInbox === 'function') {
                        loadAdminSupportInbox();
                    }
                })
                .withFailureHandler(err => {
                    setLoading(false);
                    showToast(t('connection_error'), 'error');
                })
                .getAllShops();
        }

        function checkAndRenderStats() {
            if (lastVisitStats && lastShopsData) {
                renderAdminStats(lastVisitStats, lastShopsData);
            }
        }

        function renderAdminStats(stats, shops) {
            const container = document.getElementById('adminStatsTabContainer');
            if (!container) return;

            if (!stats || stats.error) {
                container.innerHTML = `<div class="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs font-bold">${t('stats_failed') || "فشل تحميل الإحصائيات"}</div>`;
                return;
            }

            // Calculate total revenue and subscriber info
            let totalRevenue = 0;
            let totalShopsCount = shops ? shops.length : 0;
            if (shops) {
                shops.forEach(shop => {
                    if (!shop.isTrial && shop.isActive) {
                        totalRevenue += (shop.tariff - shop.discount);
                    }
                });
            }

            // ترتيب البيانات وعرض أول 5
            const getSortedList = (obj) => {
                return Object.entries(obj || {})
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);
            };

            const topCountries = getSortedList(stats.countries);
            const topCities = getSortedList(stats.cities);
            const topDevices = getSortedList(stats.devices);

            const renderProgressBars = (list, icon) => {
                if (list.length === 0) return `<p class="text-xs text-slate-400 font-bold p-2 text-center">${t('stats_no_data') || "لا توجد بيانات"}</p>`;
                let max = Math.max(...list.map(item => item[1]));
                return list.map(([name, count]) => {
                    const pct = max > 0 ? (count / max) * 100 : 0;
                    const displayName = (name === 'Unknown' || !name) ? t('unknown') : name;
                    return `
                        <div class="space-y-1">
                            <div class="flex justify-between text-[11px] font-black text-slate-700">
                                <span class="flex items-center gap-1.5"><i class="${icon} text-slate-400 text-[10px]"></i> ${displayName}</span>
                                <span>${count}</span>
                            </div>
                            <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div class="bg-indigo-500 h-1.5 rounded-full" style="width: ${pct}%"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            };

            const renderShopsList = (list) => {
                if (!list || list.length === 0) return `<p class="text-xs text-slate-400 font-bold p-2 text-center">${t('stats_no_data') || "لا توجد بيانات"}</p>`;
                return list.map(shop => {
                    let statusText = shop.isTrial ? (currentLang === 'fr' ? 'Essai' : 'تجريبي') : (shop.isActive ? (currentLang === 'fr' ? 'Actif' : 'نشط') : (currentLang === 'fr' ? 'Inactif' : 'غير نشط'));
                    let statusClass = shop.isTrial ? 'bg-amber-100 text-amber-700' : (shop.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700');
                    let revenueInfo = !shop.isTrial && shop.isActive ? `<span class="text-[10px] text-indigo-600 font-extrabold">${shop.tariff - shop.discount} DH</span>` : '';
                    return `
                        <div class="flex justify-between items-center text-xs font-bold border-b border-slate-100 pb-2 last:border-b-0 last:pb-0 text-slate-700">
                            <div class="flex flex-col">
                                <span class="text-slate-800 font-black">${shop.name}</span>
                                <span class="text-[9px] text-slate-400 font-bold">${shop.owner} (${shop.created_at})</span>
                            </div>
                            <div class="flex items-center gap-2">
                                ${revenueInfo}
                                <span class="text-[9px] px-2.5 py-0.5 rounded-full font-black ${statusClass}">${statusText}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            };

            container.className = "space-y-6 mb-6";
            container.innerHTML = `
                <!-- Cards Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <!-- Card 1: Total Visits -->
                    <div class="bg-gradient-to-br from-indigo-500 to-indigo-600 p-5 rounded-[2rem] shadow-sm text-white flex items-center justify-between hover:scale-[1.02] transition-all">
                        <div>
                            <p class="text-[10px] font-bold opacity-80 mb-1">${t('stats_total_visits') || "إجمالي زيارات التطبيق"}</p>
                            <h3 class="text-3xl font-black">${stats.totalVisits}</h3>
                        </div>
                        <div class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-xl">
                            <i class="fas fa-eye"></i>
                        </div>
                    </div>

                    <!-- Card 2: Unique Visitors -->
                    <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 rounded-[2rem] shadow-sm text-white flex items-center justify-between hover:scale-[1.02] transition-all">
                        <div>
                            <p class="text-[10px] font-bold opacity-80 mb-1">${t('stats_unique_visitors') || "الزوار الفريدين (IP)"}</p>
                            <h3 class="text-3xl font-black">${stats.uniqueVisitors}</h3>
                        </div>
                        <div class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-xl">
                            <i class="fas fa-users"></i>
                        </div>
                    </div>

                    <!-- Card 3: Registered Shops Count -->
                    <div class="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-[2rem] shadow-sm text-white flex items-center justify-between hover:scale-[1.02] transition-all">
                        <div>
                            <p class="text-[10px] font-bold opacity-80 mb-1">${t('stats_registered_shops') || "المحلات المسجلة"}</p>
                            <h3 class="text-3xl font-black">${totalShopsCount}</h3>
                        </div>
                        <div class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-xl">
                            <i class="fas fa-store"></i>
                        </div>
                    </div>

                    <!-- Card 4: Total Revenue -->
                    <div class="bg-gradient-to-br from-violet-500 to-violet-600 p-5 rounded-[2rem] shadow-sm text-white flex items-center justify-between hover:scale-[1.02] transition-all">
                        <div>
                            <p class="text-[10px] font-bold opacity-80 mb-1">${t('stats_total_revenue') || "إجمالي الإيرادات"}</p>
                            <h3 class="text-3xl font-black">${totalRevenue} DH</h3>
                        </div>
                        <div class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-xl">
                            <i class="fas fa-wallet"></i>
                        </div>
                    </div>
                </div>

                <!-- Breakdowns Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Column 3: Registered Shops -->
                    <div class="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 flex flex-col h-[300px]">
                        <h4 class="text-xs font-black text-slate-800 flex items-center gap-2 border-b pb-2 flex-shrink-0">
                            <i class="fas fa-store text-blue-600"></i> ${t('stats_registered_shops') || "المحلات المسجلة"}
                        </h4>
                        <div class="space-y-3 overflow-y-auto flex-1 pr-1 modal-scrollable-content">
                            ${renderShopsList(shops)}
                        </div>
                    </div>

                    <!-- Column 4: Devices -->
                    <div class="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 flex flex-col h-[300px]">
                        <h4 class="text-xs font-black text-slate-800 flex items-center gap-2 border-b pb-2 flex-shrink-0">
                            <i class="fas fa-laptop text-amber-600"></i> ${t('stats_devices') || "أجهزة الدخول منها"}
                        </h4>
                        <div class="space-y-3 overflow-y-auto flex-1 pr-1 modal-scrollable-content">
                            ${renderProgressBars(topDevices, 'fas fa-tablet-alt')}
                        </div>
                    </div>
                </div>
            `;
        }

        function renderAdminShops(shops) {
            const tbody = document.getElementById('adminShopsList');
            tbody.innerHTML = '';

            if (!shops || shops.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4">${t('no_shops')}</td></tr>`;
                return;
            }

            shops.forEach(shop => {
                const isActive = shop.isActive;
                const today = new Date();
                const subEnd = shop.subscriptionEnd ? parseDate(shop.subscriptionEnd) : new Date(today.getFullYear() - 1, 0, 1); // تاريخ قديم إذا لم يوجد
                const isExpired = subEnd < today;
                const renewalRequested = shop.renewalRequested; // هل تم طلب التجديد؟

                let statusBadge = '';
                if (!isActive) statusBadge = `<span class="bg-slate-100 text-slate-500 px-2 py-1 rounded-full text-[9px]">${t('suspended')}</span>`;
                else if (isExpired) statusBadge = `<span class="bg-rose-100 text-rose-600 px-2 py-1 rounded-full text-[9px]">${t('expired')}</span>`;
                else statusBadge = `<span class="bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full text-[9px]">${t('active')}</span>`;

                tbody.innerHTML += `
                    <tr class="border-b border-slate-50 hover:bg-slate-50 transition-all">
                        <td class="py-3 px-2">${shop.name}</td>
                        <td class="py-3 px-2">${shop.owner}</td>
                        <td class="py-3 px-2 text-[10px] text-slate-400 font-bold">${shop.email}</td>
                        <td class="py-3 px-2 text-[10px]">${shop.created_at}</td>
                        <td class="py-3 px-2 text-[10px] font-bold ${isExpired ? 'text-rose-600' : 'text-emerald-600'}">${shop.subscriptionEnd || t('unknown')}</td>
                        <td class="py-3 px-2 text-center">${statusBadge}</td>
                        <td class="py-3 px-2 text-center">
                            <div class="flex justify-center gap-2">
                                <button onclick="toggleShopStatus('${shop.username}', ${!isActive})" class="w-7 h-7 ${isActive ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'} rounded-lg flex items-center justify-center hover:scale-110 transition-all" title="${isActive ? t('stop_account') : t('activate_account')}">
                                    <i class="fas ${isActive ? 'fa-ban' : 'fa-check'} text-xs"></i>
                                </button>
                                <button onclick="downloadSubscriptionCertificate('${shop.username}')" class="w-7 h-7 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center hover:scale-110 transition-all" title="${t('download_cert')}">
                                    <i class="fas fa-certificate text-amber-500 text-xs"></i>
                                </button>
                                ${renewalRequested ? `
                                    <button onclick="openRenewModal('${shop.username}')" class="w-7 h-7 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center hover:scale-110 transition-all animate-pulse" title="${shop.isTrial ? t('activate_sub_req') : t('renew_sub_req')}">
                                        <i class="fas fa-calendar-plus text-xs"></i>
                                    </button>
                                ` : ''}
                                <button onclick="openEditTariffModal('${shop.username}')" class="w-7 h-7 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center hover:scale-110 transition-all" title="${t('edit_tariff_title')}">
                                    <i class="fas fa-coins text-xs"></i>
                                </button>
                                <button onclick="promptDeleteShop('${shop.username}')" class="w-7 h-7 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center hover:scale-110 transition-all" title="${t('delete_shop')}">
                                    <i class="fas fa-trash text-xs"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        function filterAdminShops() {
            const searchInput = document.getElementById('adminShopSearchInput');
            const statusFilter = document.getElementById('adminShopStatusFilter');
            if (!searchInput || !statusFilter) return;

            const query = searchInput.value.toLowerCase().trim();
            const status = statusFilter.value;

            const filtered = adminShopsCache.filter(shop => {
                const matchesQuery = !query || 
                    (shop.name && shop.name.toLowerCase().includes(query)) ||
                    (shop.owner && shop.owner.toLowerCase().includes(query)) ||
                    (shop.username && shop.username.toLowerCase().includes(query)) ||
                    (shop.email && shop.email.toLowerCase().includes(query));

                const today = new Date();
                const subEnd = shop.subscriptionEnd ? parseDate(shop.subscriptionEnd) : new Date(today.getFullYear() - 1, 0, 1);
                const isExpired = subEnd < today;

                let matchesStatus = true;
                if (status === 'active') {
                    matchesStatus = shop.isActive && !isExpired;
                } else if (status === 'inactive') {
                    matchesStatus = !shop.isActive;
                } else if (status === 'expired') {
                    matchesStatus = shop.isActive && isExpired;
                } else if (status === 'trial') {
                    matchesStatus = shop.isTrial === true || shop.isTrial === 'true';
                } else if (status === 'requested') {
                    matchesStatus = shop.renewalRequested === true || shop.renewalRequested === 'true';
                }

                return matchesQuery && matchesStatus;
            });

            renderAdminShops(filtered);
        }

        window.filterAdminShops = filterAdminShops;

        function toggleShopStatus(shopCode, newStatus) {
            setLoading(true);
            google.script.run.withSuccessHandler(() => {
                showToast(t('status_updated', { status: newStatus ? t('activated') : t('deactivated') }));
                loadAdminData(); // إعادة تحميل البيانات
            }).updateShopStatus(shopCode, newStatus);
        }

        function promptDeleteShop(shopCode) {
            const shop = adminShopsCache.find(s => s.username === shopCode) || { name: shopCode };
            const shopName = shop.name;
            openConfirm({
                title: t('delete_shop_title'),
                msg: t('delete_shop_msg', { name: shopName }),
                iconClass: "fas fa-trash-alt", colorClass: "bg-rose-600",
                onConfirm: () => {
                    setLoading(true);
                    google.script.run.withSuccessHandler(() => {
                        showToast(t('shop_deleted'));
                        loadAdminData();
                    }).deleteShop(shopCode);
                }
            });
        }

        function openRenewModal(shopCode) {
            document.getElementById('renewShopId').value = shopCode;
            document.getElementById('renewDuration').value = '1';
            
            // Get active discount and tariff from cache
            const shop = adminShopsCache.find(s => s.username === shopCode);
            const activeDiscount = (shop && shop.discount) ? shop.discount : 0;
            const activeTariff = (shop && shop.tariff) ? shop.tariff : 1200;
            document.getElementById('renewDiscount').value = activeDiscount;
            document.getElementById('renewTariff').value = activeTariff;

            // تحديث نصوص النافذة المنبثقة بناءً على ما إذا كان المتجر في الفترة التجريبية
            const isTrial = shop && (shop.isTrial === true || shop.isTrial === 'true');
            const titleEl = document.querySelector('#renewSubscriptionModal h3');
            const btnEl = document.getElementById('confirmRenewBtn');
            if (titleEl) {
                titleEl.innerText = isTrial ? (t('request_activation') || "تفعيل الاشتراك السنوي") : (t('renew_sub_title') || "تجديد الاشتراك");
            }
            if (btnEl) {
                btnEl.innerText = isTrial ? (t('request_activation') || "تفعيل الاشتراك") : (t('confirm_renew_btn') || "تأكيد التجديد");
            }

            openModal('renewSubscriptionModal');
        }

        function saveRenewal() {
            const shopCode = document.getElementById('renewShopId').value;
            const years = parseInt(document.getElementById('renewDuration').value);
            const discount = parseFloat(document.getElementById('renewDiscount').value) || 0;
            const tariff = parseFloat(document.getElementById('renewTariff').value) || 1200;
            const confirmBtn = document.getElementById('confirmRenewBtn');

            setBtnLoading(confirmBtn, true, t('saving'));

            // حساب تاريخ الانتهاء الجديد
            // La date de renouvellement doit être comptée à partir de la date d'abonnement existante si elle est dans le futur
            const shop = adminShopsCache.find(s => s.username === shopCode);
            const today = new Date();
            let referenceDate = today;

            if (shop && shop.subscriptionEnd) {
                const currentEnd = parseDate(shop.subscriptionEnd);
                if (currentEnd && !isNaN(currentEnd.getTime()) && currentEnd.getTime() > today.getTime()) {
                    referenceDate = currentEnd;
                }
            }

            const newEndDateObj = new Date(referenceDate.getTime());
            newEndDateObj.setFullYear(newEndDateObj.getFullYear() + years);

            // Format strictly as DD/MM/YYYY (JJ/MM/AAAA)
            const dd = String(newEndDateObj.getDate()).padStart(2, '0');
            const mm = String(newEndDateObj.getMonth() + 1).padStart(2, '0');
            const yyyy = newEndDateObj.getFullYear();
            const newEndDate = `${dd}/${mm}/${yyyy}`;

            google.script.run
                .withSuccessHandler(() => {
                    setBtnLoading(confirmBtn, false);
                    closeModal('renewSubscriptionModal');
                    showToast(t('renew_success', { years: years }));
                    loadAdminData();
                })
                .withFailureHandler(err => {
                    setBtnLoading(confirmBtn, false);
                    showToast(t('connection_error') + ": " + err, 'error');
                })
                .renewShopSubscription(shopCode, newEndDate, discount, tariff);
        }

                function downloadSubscriptionCertificate(shopData, includeStamp = false) {
            showToast(t('generating_pdf'), 'info');

            // تجهيز البيانات
            // إذا كانت البيانات قادمة من currentUser (صفحة اشتراكي) تكون الهيكلة مختلفة قليلاً عن Admin
            let shopName, ownerName, startDate, endDate, shopCode, discount = 0, tariff = 1200;

            let shopObj = null;
            if (typeof shopData === 'string') {
                shopObj = adminShopsCache.find(s => s.username === shopData);
                if (!shopObj) {
                    showToast("Magasin non trouvé", 'error');
                    return;
                }
            } else {
                shopObj = shopData;
            }

            if (shopObj.subscription) { // currentUser format
                shopName = shopObj.shopName;
                ownerName = shopObj.ownerName;
                startDate = formatDateSimple(parseDate(shopObj.subscription.start));
                endDate = formatDateSimple(parseDate(shopObj.subscription.end));
                shopCode = shopObj.shopCode || shopObj.username;
                discount = shopObj.discount ? Number(shopObj.discount) : 0;
                tariff = shopObj.tariff ? Number(shopObj.tariff) : 1200;
            } else { // Admin table format
                shopName = shopObj.name;
                ownerName = shopObj.owner;
                startDate = shopObj.created_at; // Admin table has formatted string
                endDate = shopObj.subscriptionEnd; // Admin table has formatted string
                shopCode = shopObj.username;
                discount = shopObj.discount ? Number(shopObj.discount) : 0;
                tariff = shopObj.tariff ? Number(shopObj.tariff) : 1200;
            }

            const refId = `CERT-${shopCode}-${new Date().getFullYear()}`;
            const isRtl = currentLang === 'ar';
            const dir = isRtl ? 'rtl' : 'ltr';
            const align = isRtl ? 'right' : 'left';

            let priceHtml = '';
            if (discount > 0) {
                const finalPrice = tariff - discount;
                priceHtml = `
                    <div style="display: flex; margin-bottom: 10px; font-size: 13px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px;">
                        <div style="flex: 1; font-weight: bold; color: #64748b;">${t('cert_original_price_label')}</div>
                        <div style="flex: 2; font-weight: bold; color: #475569; text-decoration: line-through;">${tariff} DH/an</div>
                    </div>
                    <div style="display: flex; margin-bottom: 10px; font-size: 13px; color: #dc2626; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px;">
                        <div style="flex: 1; font-weight: bold;">${t('cert_discount_label')}</div>
                        <div style="flex: 2; font-weight: bold;">- ${discount} DH</div>
                    </div>
                    <div style="display: flex; font-size: 16px; color: #16a34a; padding-top: 5px;">
                        <div style="flex: 1; font-weight: 900;">${t('cert_final_price_label')}</div>
                        <div style="flex: 2; font-weight: 900;">${finalPrice} DH/an</div>
                    </div>
                `;
            } else {
                priceHtml = `
                    <div style="display: flex;">
                        <div style="flex: 1; font-weight: bold; color: #64748b;">${t('cert_price_label')}</div>
                        <div style="flex: 2; font-weight: bold; color: #1e293b;">${tariff} DH/an</div>
                    </div>
                `;
            }

            const element = document.createElement('div');
            element.style.position = 'absolute';
            element.style.left = '0';
            element.style.top = '0';
            element.style.zIndex = '-9999';
            element.style.width = '1000px';
            element.style.height = '1400px';
            element.style.overflow = 'visible';
            element.innerHTML = `
                <div id="certOuterContainer" style="font-family: 'Cairo', sans-serif; padding: 25px 30px; background: #fff; direction: ${dir}; text-align: ${align}; border: 10px double #2563eb; width: 194mm; height: 275mm; box-sizing: border-box; display: flex; flex-direction: column; position: relative; margin: 0;">
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
                        #certOuterContainer img {
                            height: 60px !important;
                            width: auto !important;
                            margin-bottom: 5px !important;
                        }
                        #certOuterContainer h2 {
                            margin-top: 10px !important;
                            font-size: 20px !important;
                            margin-bottom: 2px !important;
                        }
                        #certOuterContainer p {
                            margin: 2px 0 12px 0 !important;
                            font-size: 12px !important;
                        }
                        #certOuterContainer div[style*="display: flex"] {
                            margin-bottom: 10px !important;
                            padding-bottom: 8px !important;
                        }
                        #certOuterContainer div[style*="font-size: 18px"] {
                            font-size: 15px !important;
                        }
                        #certOuterContainer div[style*="margin-bottom: 30px"] {
                            margin-bottom: 12px !important;
                        }
                        #certOuterContainer div[style*="background-color: #fffbeb"] {
                            padding: 8px 12px !important;
                            font-size: 10.5px !important;
                            margin-bottom: 12px !important;
                        }
                        #certOuterContainer div[style*="margin-top: 20px"] {
                            margin-top: 12px !important;
                            padding-top: 8px !important;
                        }
                        #certOuterContainer div[style*="direction: ltr"] {
                            padding: 6px 12px !important;
                            font-size: 10px !important;
                        }
                    </style>
                    
                    <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: flex-start;">
                        <!-- Header -->
                    <div style="text-align: center; margin-bottom: 30px;">
                        <img src="data:image/png;base64,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" style="width: 90px; height: 90px; margin: 0 auto 15px auto; display: block; object-fit: contain;" />
                        <h1 style="color: #1e293b; font-size: 30px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 1px;">${t('cert_title')}</h1>
                        <p style="color: #64748b; font-size: 13px; margin-top: 5px;">${t('cert_ref')}: <strong>${refId}</strong> &nbsp;|&nbsp; Date: <strong>${new Date().toLocaleDateString()}</strong></p>
                    </div>

                    <!-- Content -->
                    <div style="margin-bottom: 30px; padding: 30px; background-color: #f8fafc; border-radius: 20px; border: 1px solid #e2e8f0;">
                        <p style="font-size: 16px; color: #475569; margin-bottom: 30px; text-align: center;">${t('cert_subtitle')}</p>
                        
                        <div style="display: flex; margin-bottom: 10px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
                            <div style="flex: 1; font-weight: bold; color: #64748b;">${t('cert_shop_label')}</div>
                            <div style="flex: 2; font-weight: 900; color: #1e293b; font-size: 18px;">${shopName}</div>
                        </div>
                        
                        <div style="display: flex; margin-bottom: 10px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
                            <div style="flex: 1; font-weight: bold; color: #64748b;">${t('cert_owner_label')}</div>
                            <div style="flex: 2; font-weight: 900; color: #1e293b; font-size: 18px;">${ownerName}</div>
                        </div>

                        <div style="display: flex; margin-bottom: 10px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
                            <div style="flex: 1; font-weight: bold; color: #64748b;">${t('cert_valid_from')}</div>
                            <div style="flex: 2; font-weight: bold; color: #2563eb;">${startDate}</div>
                        </div>

                        <div style="display: flex; margin-bottom: 10px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
                            <div style="flex: 1; font-weight: bold; color: #64748b;">${t('cert_valid_to')}</div>
                            <div style="flex: 2; font-weight: bold; color: #2563eb;">${endDate}</div>
                        </div>

                        ${priceHtml}
                    </div>

                    <!-- Warning Notice Banner -->
                    <div style="margin-bottom: 15px; padding: 10px 15px; background-color: #fffbeb; border-radius: 12px; border: 1px solid #fde68a; color: #b45309; font-size: 11px; font-weight: bold; display: flex; align-items: center; line-height: 1.4; border-inline-start: 5px solid #f59e0b;">
                        <span style="font-size: 16px; margin-inline-end: 8px;">⚠️</span>
                        <span style="flex: 1;">${t('cert_renewal_warning')}</span>
                    </div>

                    <!-- Footer -->
                    <div style="text-align: center; margin-top: auto; border-top: 2px solid #e2e8f0; padding-top: 10px; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <div style="font-size: 10.5px; color: #475569; line-height: 1.8; direction: ltr; background-color: #f8fafc; padding: 10px 15px; border-radius: 12px; border: 1px dashed #cbd5e1; display: inline-block; width: 100%; box-sizing: border-box;">
                            <strong style="color: #1e293b;">El houssine TAQI (Entrepreneur individuel)</strong><br>
                            <span style="color: #64748b;">Email :</span> <a href="mailto:contact@tajirox.com" style="color: #2563eb; text-decoration: none; font-weight: bold;">tajiroxapp@gmail.com</a>
                            &nbsp;&bull;&nbsp;
                            <span style="color: #64748b;">Tél :</span> <span style="color: #1e293b; font-weight: bold;">+2126 89 18 82 41</span>
                        </div>
                    </div>
                    ${includeStamp ? `<img src="stamp.png" style="position: absolute; bottom: 100px; ${dir === 'ar' ? 'left: 45px;' : 'right: 45px;'} width: 110px; height: 110px; z-index: 10;" alt="Stamp">` : ''}
                </div>
            `;

            document.body.appendChild(element);

            // Wait a brief period for browser rendering layout and the Canvas QR Code to settle
            setTimeout(() => {
                const certTarget = element.querySelector('#certOuterContainer');
                
                // Impression native via iframe invisible pour un PDF vectoriel avec texte sélectionnable/recherchable
                const iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = '0';
                document.body.appendChild(iframe);
                
                const doc = iframe.contentWindow.document;
                doc.write(`
                    <html>
                    <head>
                        <title>Certificate-${shopCode}</title>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
                            body {
                                margin: 0;
                                padding: 0;
                                background: #ffffff;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            @page {
                                size: A4 portrait;
                                margin: 1.27cm;
                            }
                            #certOuterContainer {
                                box-sizing: border-box;
                                border: 10px double #2563eb;
                                width: 100%;
                                height: 100%;
                                padding: 25px 30px;
                                font-family: 'Cairo', sans-serif;
                                background: #fff;
                                direction: ${dir};
                                text-align: ${align};
                                display: flex;
                                flex-direction: column;
                                position: relative;
                                margin: 0;
                            }
                            #certOuterContainer img {
                                height: 60px !important;
                                width: auto !important;
                                margin-bottom: 5px !important;
                            }
                            #certOuterContainer h2 {
                                margin-top: 10px !important;
                                font-size: 20px !important;
                                margin-bottom: 2px !important;
                            }
                            #certOuterContainer p {
                                margin: 2px 0 12px 0 !important;
                                font-size: 12px !important;
                            }
                            #certOuterContainer div[style*="display: flex"] {
                                margin-bottom: 10px !important;
                                padding-bottom: 8px !important;
                            }
                            #certOuterContainer div[style*="font-size: 18px"] {
                                font-size: 15px !important;
                            }
                            #certOuterContainer div[style*="margin-bottom: 30px"] {
                                margin-bottom: 12px !important;
                            }
                            #certOuterContainer div[style*="background-color: #fffbeb"] {
                                padding: 8px 12px !important;
                                font-size: 10.5px !important;
                                margin-bottom: 12px !important;
                            }
                            #certOuterContainer div[style*="margin-top: 20px"] {
                                margin-top: 12px !important;
                                padding-top: 8px !important;
                            }
                            #certOuterContainer div[style*="direction: ltr"] {
                                padding: 6px 12px !important;
                                font-size: 10px !important;
                            }
                        </style>
                    </head>
                    <body>
                        ${certTarget.outerHTML}
                    </body>
                    </html>
                `);
                doc.close();

                setTimeout(() => {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                    document.body.removeChild(iframe);
                    element.remove();
                }, 1000);
            }, 600);
        }

        function openEditTariffModal(shopCode) {
            document.getElementById('editTariffShopId').value = shopCode;
            
            const shop = adminShopsCache.find(s => s.username === shopCode);
            const activeDiscount = (shop && shop.discount) ? shop.discount : 0;
            const activeTariff = (shop && shop.tariff) ? shop.tariff : 1200;
            
            document.getElementById('editDiscountValue').value = activeDiscount;
            document.getElementById('editTariffValue').value = activeTariff;

            openModal('editTariffModal');
        }

        function saveTariffChanges() {
            const shopCode = document.getElementById('editTariffShopId').value;
            const tariff = parseFloat(document.getElementById('editTariffValue').value) || 1200;
            const discount = parseFloat(document.getElementById('editDiscountValue').value) || 0;
            const confirmBtn = document.getElementById('confirmEditTariffBtn');

            setBtnLoading(confirmBtn, true, t('saving'));

            google.script.run
                .withSuccessHandler(() => {
                    setBtnLoading(confirmBtn, false);
                    closeModal('editTariffModal');
                    showToast(t('settings_saved'));
                    loadAdminData();
                })
                .withFailureHandler(err => {
                    setBtnLoading(confirmBtn, false);
                    showToast(t('connection_error') + ": " + err, 'error');
                })
                .updateShopTariff(shopCode, tariff, discount);
        }

        async function forceAppUpdate() {
            const btn = document.getElementById('btnForceUpdate');
            if (btn) setBtnLoading(btn, true, "...");
            
            showToast(t('app_updating_toast') || "Mise à jour en cours...", 'info');
            
            try {
                // 1. Désenregistrer tous les Service Workers
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (let registration of registrations) {
                        await registration.unregister();
                        console.log("🧹 [PWA] Service Worker désenregistré avec succès");
                    }
                }
                
                // 2. Vider tous les caches du navigateur
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    for (let cacheName of cacheNames) {
                        await caches.delete(cacheName);
                        console.log("🧹 [PWA] Cache vidé :", cacheName);
                    }
                }
                
                showToast(t('app_update_success_toast') || "Mise à jour réussie !", 'success');
                
                // 3. Recharger la page avec un paramètre anti-cache
                setTimeout(() => {
                    window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
                }, 1200);
                
            } catch (err) {
                console.error("❌ Erreur lors de la mise à jour PWA :", err);
                showToast("Échec de la mise à jour : " + err, 'error');
                if (btn) setBtnLoading(btn, false);
            }
        }

        window.forceAppUpdate = forceAppUpdate;

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

        async function testAIConnection() {
            const testBtn = document.getElementById('testAIBtn');
            const statusText = document.getElementById('aiTestStatus');
            const keyInput = document.getElementById('settingAIKey');
            const modelSelect = document.getElementById('settingAIModel');
            
            // Résolution sécurisée de la langue courante pour éviter les erreurs de scope sur mobile
            const lang = (typeof currentLang !== 'undefined' ? currentLang : (localStorage.getItem('appLang') || 'ar'));
            
            if (!keyInput || !keyInput.value.trim()) {
                if (statusText) {
                    statusText.innerText = lang === 'ar' ? '⚠️ يرجى إدخال مفتاح API أولاً' : '⚠️ Veuillez saisir une clé API d\'abord';
                    statusText.className = 'text-xs font-bold text-amber-600';
                }
                return;
            }
            
            const apiKey = keyInput.value.trim();
            const selectedModel = modelSelect ? modelSelect.value : 'auto';
            
            setBtnLoading(testBtn, true, lang === 'ar' ? 'جاري الاتصال...' : 'Connexion...');
            if (statusText) {
                statusText.innerText = '';
            }
            
            let defaultModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
            let modelsToTry = [...defaultModels];
            if (selectedModel !== 'auto') {
                modelsToTry = [selectedModel, ...defaultModels.filter(m => m !== selectedModel)];
            }
            
            let success = false;
            let lastError = '';
            let workingModel = '';
            let workingVersion = '';
            
            for (let model of modelsToTry) {
                const apiVersions = ['v1', 'v1beta'];
                let modelSuccess = false;
                
                for (let apiVer of apiVersions) {
                    try {
                        const response = await fetch(`https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent?key=${apiKey}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                contents: [{
                                    role: 'user',
                                    parts: [{ text: 'Hello' }]
                                }]
                            })
                        });
                        
                        if (response.ok) {
                            success = true;
                            modelSuccess = true;
                            workingModel = model;
                            workingVersion = apiVer;
                            break;
                        } else {
                            try {
                                const errData = await response.json();
                                lastError = errData.error?.message || `HTTP ${response.status}`;
                            } catch (e) {
                                lastError = `HTTP ${response.status}`;
                            }
                        }
                    } catch (err) {
                        lastError = err.message;
                    }
                }
                if (modelSuccess) break;
            }
            
            setBtnLoading(testBtn, false);
            if (success) {
                if (statusText) {
                    const successMsg = lang === 'ar' 
                        ? `✅ تم الاتصال بنجاح! (${workingModel} [${workingVersion}])` 
                        : `✅ Connexion réussie ! (${workingModel} [${workingVersion}])`;
                    statusText.innerText = successMsg;
                    statusText.className = 'text-xs font-bold text-emerald-600';
                }
            } else {
                if (statusText) {
                    let friendlyError = lastError;
                    if (lastError.includes("is not found") || lastError.includes("not supported") || lastError.includes("API_KEY_INVALID") || lastError.includes("API key not valid")) {
                        friendlyError = lang === 'ar'
                            ? `هذا يعني غالباً:\n1. حسابك مجاني في منطقة مقيدة (مثل أوروبا/بريطانيا) ويجب تفعيل الدفع (Billing) في Google AI Studio مجاناً للوصول للموديلات.\n2. أو أن مفتاح الـ API جديد ويحتاج 3 دقائق ليتفعل في خوادم Google.\n👉 يُنصح بشدة باختيار موديل Gemini 1.5 Flash في الإعدادات وحفظ التغييرات.`
                            : `Cela signifie généralement :\n1. Votre compte est gratuit dans une région restreinte (comme l'UE/Royaume-Uni). Veuillez activer la facturation (Billing) sur Google AI Studio (gratuit avec quota).\n2. Ou votre clé API est nouvelle et nécessite 3 minutes pour se propager.\n👉 Il est fortement recommandé de sélectionner le modèle Gemini 1.5 Flash dans vos paramètres et d'enregistrer.`;
                    }
                    statusText.innerText = (lang === 'ar' ? '❌ فشل الاتصال: ' : '❌ Connexion échouée : ') + friendlyError;
                    statusText.className = 'text-xs font-bold text-rose-600 whitespace-pre-wrap leading-normal';
                }
            }
        }
        
        window.togglePasswordVisibility = togglePasswordVisibility;
        window.testAIConnection = testAIConnection;