        function openConfirm({ title, msg, iconClass, colorClass, onConfirm, hasInput = false }) {
            const modal = document.getElementById('confirmModal');
            const iconDiv = document.getElementById('confirmIcon');
            const btn = document.getElementById('confirmBtn');
            const inputArea = document.getElementById('confirmInputArea');
            const input = document.getElementById('confirmInput');

            document.getElementById('confirmTitle').innerText = title;
            document.getElementById('confirmMsg').innerText = msg;
            iconDiv.className = `w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl text-3xl ${colorClass.replace('bg-', 'text-')} ${colorClass.replace('bg-', 'bg-opacity-10 ')}`;
            iconDiv.innerHTML = `<i class="${iconClass}"></i>`;
            btn.className = `py-3 rounded-xl font-black text-white text-xs shadow-lg transition-all active:scale-95 ${colorClass}`;

            inputArea.classList.toggle('hidden', !hasInput);
            if (hasInput) { input.value = ""; input.focus(); }

            btn.onclick = () => {
                const val = hasInput ? input.value : true;
                if (val !== "" && val !== null) { onConfirm(val); closeConfirm(); }
            };
            modal.classList.remove('hidden');
        }

        function closeConfirm() { document.getElementById('confirmModal').classList.add('hidden'); }

        function renderAll() {
            const fInvs = getFilteredData(allData.invoices);
            const fExps = getFilteredData(allData.expenses);
            renderDashboard(fInvs, fExps);
            // renderInventory(); // تم الإزالة لمنع مسح بحث المخزون عند تغيير فلاتر التاريخ
            renderInvoices(fInvs);
            renderExpenses(fExps);
            renderClients();
            renderSuppliers();
            renderPayments();
            renderChecksPromissory();
            renderTreasury();

            checkLowStockAlert(); // التحقق من تنبيهات المخزون
            // تحديث قوائم الزبناء والموردين في النماذج
            updateClientLists();

            // عرض التقارير فقط للمدير
            if (currentUser?.role === 'admin') {
                renderReports(fInvs, fExps);
            }

            if (currentUser?.role === 'admin') renderUsers();
        }

        function updateFilterSummary() {
            const summaryDiv = document.getElementById('filterSummary');
            const summaryText = document.getElementById('filterSummaryText');
            if (!summaryDiv || !summaryText) return;

            const filters = [];
            const searchVal = document.getElementById('checkSearch')?.value;
            if (searchVal) filters.push(`${t('search_word')}: "${searchVal}"`);

            ['checkDirectionFilter', 'checkStatusFilter', 'checkTypeFilter'].forEach(id => {
                const el = document.getElementById(id);
                if (el && el.value) filters.push(el.options[el.selectedIndex].text);
            });

            if (filters.length > 0) {
                summaryText.innerText = filters.join(' • ');
                summaryDiv.classList.remove('hidden');
            } else {
                summaryDiv.classList.add('hidden');
            }
        }

        function closeSidebarMobile() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.add('translate-x-full');
            const backdrop = document.getElementById('sidebarBackdrop');
            if (backdrop) backdrop.classList.add('hidden');
        }

        function openSidebarMobile() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('translate-x-full');
            const backdrop = document.getElementById('sidebarBackdrop');
            if (backdrop) backdrop.classList.remove('hidden');
        }

        function toggleSubmenu(menuId) {
            const submenu = document.getElementById(menuId);
            const chevron = document.getElementById(menuId.replace('Submenu', 'Chevron'));
            const isOpening = submenu.classList.contains('hidden');

            // إغلاق كافة القوائم الفرعية الأخرى أولاً (Accordion Behavior)
            const submenus = ['clientsSubmenu', 'treasuryChecksSubmenu', 'myAccountSubmenu'];
            submenus.forEach(id => {
                const sub = document.getElementById(id);
                const chev = document.getElementById(id.replace('Submenu', 'Chevron'));
                if (sub) sub.classList.add('hidden');
                if (chev) chev.classList.remove('rotate-180');
            });

            if (isOpening) {
                submenu.classList.remove('hidden');
                chevron.classList.add('rotate-180');
            }
        }

        function initFilterOptions() {
            const ySelect = document.getElementById('filterYear');
            const dSelect = document.getElementById('filterDay');

            ySelect.innerHTML = '';
            dSelect.innerHTML = `<option value="" data-i18n="all_days">${t('all_days')}</option>`;

            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth(); // 0 = janvier

            ySelect.innerHTML = `<option value="${currentYear}" selected>${currentYear}</option>`;

            // Si on est en janvier (nouvelle année commencée)
            if (currentMonth === 0) {
                const nextOption = document.createElement("option");
                nextOption.value = currentYear + 1;
                nextOption.textContent = currentYear + 1;
                ySelect.appendChild(nextOption);
            }

            for (let d = 1; d <= 31; d++) {
                dSelect.innerHTML += `<option value="${d}">${d}</option>`;
            }

            ySelect.onchange = (e) => {
                filters.year = e.target.value;
                renderAll();
            };

            document.getElementById('filterMonth').onchange = (e) => {
                filters.month = e.target.value;
                renderAll();
            };

            dSelect.onchange = (e) => {
                filters.day = e.target.value;
                renderAll();
            };

            // تحديث حقول المصاريف عند تغيير الفئة
            document.getElementById('expCat').addEventListener('change', updateExpenseFields);

            // تعيين التاريخ الحالي في نموذج تسديد الدين
            document.getElementById('settleDate').value = new Date().toISOString().split('T')[0];
        }

        function filterTables() {
            clearTimeout(globalSearchTimeout);
            globalSearchTimeout = setTimeout(() => {
                const q = document.getElementById('tableSearch').value.trim().toLowerCase();
                
                const fInvs = getFilteredData(allData.invoices);
                const fExps = getFilteredData(allData.expenses);
                renderInvoices(fInvs, q);
                renderExpenses(fExps, q);
                
                document.querySelectorAll('tbody tr, #usersList > div, #customerDebtsList > div, #supplierDebtsList > div, #paymentsContainer > div').forEach(el => {
                    el.style.display = el.innerText.toLowerCase().includes(q) ? '' : 'none';
                });
            }, 300);
        }

        function showPage(p) {
            // التحقق من الصلاحية قبل عرض الصفحة
            if (currentUser?.role !== 'admin') {
                const restrictedPages = ['reports', 'clients', 'suppliers', 'payments', 'users', 'expenses', 'treasury'];
                if (restrictedPages.includes(p)) {
                    showToast(t('no_access'), 'error');
                    showPage('dashboard');
                    return;
                }
            }

            // إخفاء جميع الصفحات وإظهار الصفحة المطلوبة
            document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));
            document.getElementById('page-' + p).classList.remove('hidden');

            // إخفاء/إظهار البحث السريع بناءً على الصفحة
            if (p === 'settings') {
                document.getElementById('globalFilter').classList.add('hidden');
            } else {
                document.getElementById('globalFilter').classList.remove('hidden');
            }

            // تحديث القائمة الجانبية
            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

            // تحديد الرابط النشط
            const activeLink = Array.from(document.querySelectorAll('.sidebar-link')).find(btn => {
                const onclickAttr = btn.getAttribute('onclick');
                return onclickAttr && onclickAttr.includes(`'${p}'`);
            });

            const activeSubLink = Array.from(document.querySelectorAll('.submenu-link')).find(btn => {
                const onclickAttr = btn.getAttribute('onclick');
                return onclickAttr && onclickAttr.includes(`'${p}'`);
            });

            if (activeLink) activeLink.classList.add('active');
            if (activeSubLink) {
                const parentButton = activeSubLink.closest('.space-y-1').querySelector('.sidebar-link');
                if (parentButton) {
                    parentButton.classList.add('active');
                    const submenuId = parentButton.getAttribute('onclick').match(/toggleSubmenu\('([^']+)'\)/)?.[1];
                    if (submenuId) {
                        const submenu = document.getElementById(submenuId);
                        const chevron = document.getElementById(submenuId.replace('Submenu', 'Chevron'));
                        if (submenu) submenu.classList.remove('hidden');
                        if (chevron) chevron.classList.add('rotate-180');
                    }
                }
            }

            // Update Page Title using translation keys if possible, or fallback to text
            let pageTitle = '';
            if (activeLink && activeLink.querySelector('[data-i18n]')) {
                pageTitle = t(activeLink.querySelector('[data-i18n]').getAttribute('data-i18n'));
            } else if (activeSubLink && activeSubLink.querySelector('[data-i18n]')) {
                pageTitle = t(activeSubLink.querySelector('[data-i18n]').getAttribute('data-i18n'));
            } else {
                pageTitle = activeLink ? activeLink.innerText.trim() : activeSubLink ? activeSubLink.innerText.trim() : t('app_title_hero').replace('<br/>', ' ');
            }
            document.getElementById('pageTitleDisplay').innerText = pageTitle;

            // إغلاق كافة القوائم الفرعية الأخرى عند الانتقال لصفحة رئيسية (ليست فرعية)
            if (!activeSubLink) {
                const submenus = ['clientsSubmenu', 'treasuryChecksSubmenu', 'myAccountSubmenu'];
                submenus.forEach(id => {
                    const sub = document.getElementById(id);
                    const chev = document.getElementById(id.replace('Submenu', 'Chevron'));
                    if (sub) sub.classList.add('hidden');
                    if (chev) chev.classList.remove('rotate-180');
                });
            } else {
                // في حال فتح صفحة فرعية، تأكد من إغلاق القوائم الفرعية الأخرى غير النشطة
                const parentBtn = activeSubLink.closest('.space-y-1').querySelector('.sidebar-link');
                const activeSubmenuId = parentBtn ? parentBtn.getAttribute('onclick').match(/toggleSubmenu\('([^']+)'\)/)?.[1] : null;
                const submenus = ['clientsSubmenu', 'treasuryChecksSubmenu', 'myAccountSubmenu'];
                submenus.forEach(id => {
                    if (id !== activeSubmenuId) {
                        const sub = document.getElementById(id);
                        const chev = document.getElementById(id.replace('Submenu', 'Chevron'));
                        if (sub) sub.classList.add('hidden');
                        if (chev) chev.classList.remove('rotate-180');
                    }
                });
            }

            // إغلاق القائمة الجانبية على الهواتف تلقائياً
            closeSidebarMobile();

            // === التعديل الجوهري هنا ===
            // بدلاً من طلب البيانات من السيرفر، نقوم بإعادة رسم البيانات المحلية فقط
            // هذا يجعل التنقل فورياً

            const fInvs = getFilteredData(allData.invoices);
            const fExps = getFilteredData(allData.expenses);

            if (p === 'dashboard') renderDashboard(fInvs, fExps);
            if (p === 'inventory') {
                // تحسين: عرض المخزون مباشرة دون تأخير
                renderInventory();
            }
            if (p === 'invoices') renderInvoices(fInvs, q);
            if (p === 'expenses') renderExpenses(fExps, q);
            if (p === 'clients') renderClients();
            if (p === 'suppliers') renderSuppliers();
            if (p === 'payments') renderPayments();
            if (p === 'checks-promissory') renderChecksPromissory();
            if (p === 'treasury') renderTreasury();

            // إعادة إظهار فلتر نوع الدفعات عند العودة للصفحة الرئيسية للدفعات
            if (p === 'payments' && !currentPaymentClient) {
                document.getElementById('paymentTypeFilter').parentElement.classList.remove('hidden');
            }

            if (p === 'debts') renderClientDebtsPage();
            if (p === 'users') renderUsers();
            if (p === 'admin-dashboard') { /* البيانات تحمل عبر loadAdminData */ }
            if (p === 'settings') openShopSettings();
            if (p === 'subscription') renderSubscriptionPage();

            if (p === 'reports' && currentUser?.role === 'admin') {
                // التقارير قد تحتاج حسابات ثقيلة، لذا نعرضها محلياً
                renderReports(fInvs, fExps);
            }

            // تحديث القوائم المنسدلة عند الحاجة
            if (p === 'invoices' || p === 'expenses' || p === 'clients' || p === 'suppliers') {
                updateClientLists();
            }
        }

        function showToast(m, t = 'success') {
            const div = document.createElement('div');
            div.className = `fixed bottom-6 left-6 z-[300] px-6 py-4 rounded-[2rem] shadow-2xl text-[11px] font-black animate-bounce flex items-center gap-3 transition-all ${t === 'error' ? 'bg-rose-500 text-white' : 'bg-slate-900 text-white'}`;
            div.innerHTML = `<i class="fas ${t === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> ${m}`;
            document.body.appendChild(div);
            setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 500); }, 3000);
        }

        function openModal(id) {
            document.getElementById(id).classList.remove('hidden');
        }

        function closeModal(id) {
            document.getElementById(id).classList.add('hidden');
        }