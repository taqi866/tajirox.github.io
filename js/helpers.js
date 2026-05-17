        function formatDateSimple(date) {
            if (!date) return '';
            const d = new Date(date);
            return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        }

        function handlePhysicalScan(event, mode) {
            // قارئات الباركود ترسل زر Enter في النهاية
            if (event.key === 'Enter') {
                const code = event.target.value.trim();
                if (!code) return;

                if (mode === 'invoice_add') {
                    clearTimeout(invoiceSearchTimeout); // إلغاء أي بحث يدوي معلق لضمان السرعة
                    // البحث عن تطابق تام
                    const product = allData.inventory.find(p => p.id == code);
                    if (product) {
                        event.preventDefault(); // منع إرسال النموذج أو السلوك الافتراضي

                        // التحقق من إعداد تخطي الكمية
                        if (currentUser && currentUser.scanSkipQty) {
                            addDirectToCart(product);
                        } else {
                            selectProductFromSearch(product.id);
                        }
                        event.target.value = ''; // مسح الحقل للمسح التالي
                    }
                } else if (mode === 'consumption_add') {
                    clearTimeout(consumptionSearchTimeout);
                    const product = allData.inventory.find(p => p.id == code);
                    if (product) {
                        event.preventDefault();
                        selectProductForConsumptionFromSearch(product.id);
                        event.target.value = '';
                    }
                } else if (mode === 'inventory_search') {
                    event.preventDefault();

                    // إضافة فاصلة تلقائياً للاستعداد للمسح التالي
                    const input = event.target;
                    if (input.value && !input.value.trim().endsWith(',')) {
                        input.value = input.value + ', ';
                        searchInventory();
                    }
                }
            }
        }

        function parseDate(dateStr) {
            if (!dateStr) return new Date();
            if (dateStr instanceof Date) return dateStr;

            // معالجة صيغة dd/MM/yyyy التي قد تأتي من Sheets
            if (typeof dateStr === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) {
                const parts = dateStr.split('/');
                return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
            return new Date(dateStr);
        }

        function safeNum(n) {
            if (!n) return 0;
            // إذا كان الرقم نصاً ويحتوي على فاصلة، نحولها لنقطة ليتمكن الكمبيوتر من حسابه
            if (typeof n === 'string') {
                n = n.replace(/,/g, '.'); // تحويل الفاصلة إلى نقطة للحساب
                n = n.replace(/\s/g, ''); // إزالة المسافات إن وجدت
            }
            const num = parseFloat(n);
            return isNaN(num) ? 0 : num;
        }

        function formatCurrency(n) {
            // 1. تحويل الرقم لثابت عشري وتغيير النقطة لرمز مؤقت
            let parts = safeNum(n).toFixed(2).split('.');
            // 2. إضافة النقطة كفاصل للألوف للجزء الصحيح
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            // 3. تجميع الرقم مع الفاصلة العشرية
            return parts.join(',') + ' ' + t('currency_symbol');
        }

        function formatInput(n) {
            return safeNum(n).toFixed(2); // يعيد 1500.00 (نقطة) لأن حقول type="number" تتطلب ذلك
        }

        function setLoading(s) { document.getElementById('topLoading').classList.toggle('hidden', !s); }

        function setBtnLoading(btnId, isLoading, text = 'جاري...') {
            const btn = typeof btnId === 'string' ? document.getElementById(btnId) : btnId;
            if (!btn) return;
            if (isLoading) {
                // Save original text only if it's not already in loading state (indicated by disabled property)
                if (!btn.disabled) {
                    btn.dataset.originalText = btn.innerHTML;
                }
                btn.disabled = true;
                btn.innerHTML = `<i class="fas fa-spinner fa-spin ml-2"></i> ${text}`;
                btn.classList.add('opacity-75', 'cursor-not-allowed');
            } else {
                btn.disabled = false;
                if (btn.dataset.originalText) {
                    btn.innerHTML = btn.dataset.originalText;
                }
                btn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        }

        function performOptimisticAction(listName, data, isDelete, renderCallback, serverCallback) {
            // 1. التحديث المحلي (Optimistic Update)
            const id = isDelete ? data : data.id;
            const index = allData[listName].findIndex(item => String(item.id) === String(id));

            if (isDelete) {
                if (index !== -1) allData[listName].splice(index, 1); // حذف
            } else {
                if (index !== -1) allData[listName][index] = data; // تعديل
                else allData[listName].unshift(data); // إضافة
            }

            // 2. تحديث الواجهة فوراً
            if (renderCallback) renderCallback();

            // 3. رسالة فورية
            const actionMsg = isDelete ? t('deleted_local') : t('saved_local');
            showToast(actionMsg, 'info');

            // 4. إرسال للسيرفر
            if (serverCallback) {
                serverCallback(
                    google.script.run
                        .withSuccessHandler(() => showToast(isDelete ? t('deleted_server') : t('saved_server')))
                        .withFailureHandler((e) => { console.log(e); showToast(t('sync_error'), 'error'); })
                        .withSuccessHandler((res) => {
                            if (res && res.success === false) {
                                showToast(t('op_failed') + ': ' + (t(res.message) || res.message), 'error');
                                refreshData(); // إعادة تحميل البيانات للتراجع عن التحديث المحلي
                            } else {
                                showToast(isDelete ? t('deleted_server') : t('saved_server'));
                            }
                        })
                        .withFailureHandler((e) => {
                            console.log(e);
                            showToast(t('sync_error'), 'error');
                            refreshData(); // إعادة تحميل البيانات للتراجع
                        })
                );
            }
        }

        async function hashPassword(str) {
            const msgBuffer = new TextEncoder().encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        function getFilteredData(arr) {
            if (!arr || !Array.isArray(arr)) return [];

            // إذا لم يكن هناك فلتر نشط، أرجع كل البيانات
            if (!filters.year && !filters.month && !filters.day) {
                return arr;
            }

            return arr.filter(item => {
                // محاولة الحصول على التاريخ من الكائن
                let dateStr = item.date || item.created_at || '';
                if (!dateStr) return true; // إذا لم يكن هناك تاريخ، نعرض العنصر

                const d = parseDate(dateStr);
                if (isNaN(d.getTime())) return true; // إذا كان التاريخ غير صالح، نعرض العنصر

                // فلترة حسب السنة والشهر واليوم
                const yearMatch = !filters.year || d.getFullYear() == filters.year;
                const monthMatch = !filters.month || (d.getMonth() + 1) == filters.month;
                const dayMatch = !filters.day || d.getDate() == filters.day;

                return yearMatch && monthMatch && dayMatch;
            });
        }

        function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

        function renderDashboard(fInvs, fExps) {
            // التعديل هنا: طرح الخصم من الإجمالي لحساب المبيعات الحقيقية
            const sales = fInvs.reduce((s, i) => s + (safeNum(i.total) - safeNum(i.discount)), 0);

            const exps = fExps.reduce((s, i) => s + safeNum(i.amount), 0);
            const customerDebts = fInvs.reduce((s, i) => s + safeNum(i.balance), 0);

            // صافي الربح = (المبيعات بعد الخصم) - المصاريف
            const netProfit = sales - exps;

            document.getElementById('statSales').innerText = formatCurrency(sales);
            document.getElementById('statExpenses').innerText = formatCurrency(exps);
            document.getElementById('statProfit').innerText = formatCurrency(netProfit);
            document.getElementById('statDebts').innerText = formatCurrency(customerDebts);

            renderMainChart(fInvs);
        }

        function isValidEmail(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        }