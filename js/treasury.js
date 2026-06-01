        function updateBankBalance() {
            const newBalance = calculateBankBalance();

            // إذا تغير الرصيد، نحدث المخزن ونخطر المستمعين
            if (newBalance !== cachedBankBalance) {
                cachedBankBalance = newBalance;
                notifyBankBalanceChange();
            }

            return newBalance;
        }

        function addBankBalanceListener(callback) {
            bankBalanceListeners.push(callback);
            // استدعاء فوري بالقيمة الحالية
            callback(cachedBankBalance);
        }

        function notifyBankBalanceChange() {
            bankBalanceListeners.forEach(callback => {
                try {
                    callback(cachedBankBalance);
                } catch (e) {
                    console.error('خطأ في مستمع الرصيد البنكي:', e);
                }
            });
        }

        function getCurrentBankBalance() {
            return cachedBankBalance;
        }

        function initBankBalance() {
            cachedBankBalance = calculateBankBalance();
            console.log('تم تهيئة الرصيد البنكي:', formatCurrency(cachedBankBalance));
        }

        function calculateChecksSummaries(filteredChecks = null) {
            const checks = filteredChecks || allData.checks_promissory || [];

            const summaries = {
                received: { total: 0, count: 0, checks: 0, promissory: 0 },
                given: { total: 0, count: 0, checks: 0, promissory: 0 },
                netBalance: 0,
                period: ''
            };

            checks.forEach(check => {
                const amount = safeNum(check.amount);
                const isReceived = check.debt_type === 'invoice';
                const isCheck = check.type === 'شيك';

                if (isReceived) {
                    summaries.received.total += amount;
                    summaries.received.count++;
                    if (isCheck) {
                        summaries.received.checks++;
                    } else {
                        summaries.received.promissory++;
                    }
                } else {
                    summaries.given.total += amount;
                    summaries.given.count++;
                    if (isCheck) {
                        summaries.given.checks++;
                    } else {
                        summaries.given.promissory++;
                    }
                }
            });

            summaries.netBalance = summaries.received.total - summaries.given.total;

            return summaries;
        }

        function updateChecksSummaries() {
            const monthFilter = document.getElementById('checkMonthFilter')?.value;
            const yearFilter = document.getElementById('checkYearFilter')?.value;

            let filteredChecks = allData.checks_promissory || [];

            // تطبيق فلترة الشهر والسنة
            if (monthFilter || yearFilter) {
                filteredChecks = filteredChecks.filter(check => {
                    if (!check.date) return true;
                    const date = new Date(check.date);
                    if (isNaN(date.getTime())) return true;

                    const checkMonth = date.getMonth() + 1;
                    const checkYear = date.getFullYear();

                    return (!monthFilter || checkMonth == monthFilter) &&
                        (!yearFilter || checkYear == yearFilter);
                });
            }

            const summaries = calculateChecksSummaries(filteredChecks);

            // تحديد نص الفترة
            let periodText = '';
            if (monthFilter && yearFilter) {
                const monthNames = [t('jan'), t('feb'), t('mar'), t('apr'), t('may'), t('jun'),
                t('jul'), t('aug'), t('sep'), t('oct'), t('nov'), t('dec')];
                periodText = `${monthNames[monthFilter - 1]} ${yearFilter}`;
            } else if (monthFilter) {
                const monthNames = [t('jan'), t('feb'), t('mar'), t('apr'), t('may'), t('jun'),
                t('jul'), t('aug'), t('sep'), t('oct'), t('nov'), t('dec')];
                periodText = `${t('month_word')} ${monthNames[monthFilter - 1]}`;
            } else if (yearFilter) {
                periodText = `${t('year_word')} ${yearFilter}`;
            } else {
                periodText = t('all_months');
            }

            // تحديث العناصر في الواجهة
            document.getElementById('totalReceivedChecks').textContent = formatCurrency(summaries.received.total).replace(' د.م', '');
            document.getElementById('receivedChecksCount').textContent = summaries.received.checks;
            document.getElementById('receivedPromissoryCount').textContent = summaries.received.promissory;

            document.getElementById('totalGivenChecks').textContent = formatCurrency(summaries.given.total).replace(' د.م', '');
            document.getElementById('givenChecksCount').textContent = summaries.given.checks;
            document.getElementById('givenPromissoryCount').textContent = summaries.given.promissory;

            document.getElementById('netChecksBalance').textContent = formatCurrency(summaries.netBalance).replace(' د.م', '');
            document.getElementById('netBalancePeriod').textContent = periodText;

            // تغيير لون صافي الرصيد حسب قيمته
            const netElement = document.getElementById('netChecksBalance');
            if (netElement) {
                if (summaries.netBalance > 0) {
                    netElement.className = 'text-2xl font-black text-emerald-300';
                } else if (summaries.netBalance < 0) {
                    netElement.className = 'text-2xl font-black text-rose-300';
                } else {
                    netElement.className = 'text-2xl font-black text-white';
                }
            }

            return summaries;
        }

        function initCheckYearFilter() {
            const yearSelect = document.getElementById('checkYearFilter');
            if (!yearSelect) return;

            // جمع السنوات المتوفرة من الشيكات
            const years = new Set();
            (allData.checks_promissory || []).forEach(check => {
                if (check.date) {
                    const year = new Date(check.date).getFullYear();
                    if (!isNaN(year)) years.add(year);
                }
            });

            // ترتيب السنوات تنازلياً
            const sortedYears = Array.from(years).sort((a, b) => b - a);

            yearSelect.innerHTML = '<option value="" data-i18n="all_years">كل السنوات</option>';
            sortedYears.forEach(year => {
                yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
            });
        }

        function resetCheckFilters() {
            document.getElementById('checkSearch').value = '';
            document.getElementById('checkDirectionFilter').value = '';
            document.getElementById('checkStatusFilter').value = '';
            document.getElementById('checkTypeFilter').value = '';
            document.getElementById('checkMonthFilter').value = '';
            document.getElementById('checkYearFilter').value = '';

            filterChecks();
        }

        function addToChecksPromissory(data, clientName, debtId, debtType) {
            if (!allData.checks_promissory) {
                allData.checks_promissory = [];
            }

            const checkRec = {
                id: 'CHK-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                reference: data.reference,
                type: data.method,
                amount: data.amount,
                date: data.date,
                due_date: data.due_date || data.date,
                status: 'pending',
                client_name: clientName,
                debt_id: debtId,
                debt_type: debtType
            };

            allData.checks_promissory.unshift(checkRec);

            // تحديث صفحة الشيكات إذا كانت مفتوحة
            if (!document.getElementById('page-checks-promissory').classList.contains('hidden')) {
                renderChecksPromissory();
            }

            // تحديث التنبيهات
            checkDueDateAlerts();

            return checkRec;
        }

        function checkSubscriptionStatus() {
            if (!currentUser || !currentUser.subscription) return;

            const end = parseDate(currentUser.subscription.end);
            const today = new Date();
            const diffTime = end - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 30 && diffDays > 0) {
                const isTrial = currentUser.isTrial === true || currentUser.isTrial === 'true' || 
                    (currentUser.subscription && Math.ceil((parseDate(currentUser.subscription.end) - parseDate(currentUser.subscription.start)) / (1000 * 60 * 60 * 24)) <= 15);
                if (isTrial) {
                    showToast(t('trial_warning', { days: diffDays }), 'info');
                } else {
                    showToast(t('sub_warning', { days: diffDays }), 'info');
                }
                // يمكن إضافة علامة حمراء على زر الاشتراك
                document.getElementById('subscriptionMenuBtn').classList.add('text-rose-600', 'bg-rose-50');
                document.getElementById('subscriptionMenuBtn').classList.remove('text-indigo-600');
            }
        }

        function checkLowStockAlert() {
            const criticalStock = allData.inventory.filter(item => safeNum(item.qty) <= 5);
            const alertBtn = document.getElementById('lowStockAlertBtn');
            const badge = document.getElementById('lowStockCountBadge');

            if (criticalStock.length > 0) {
                alertBtn.classList.remove('hidden');
                badge.innerText = criticalStock.length > 99 ? '+99' : criticalStock.length;
                // إظهار رسالة قصيرة (Toast) عند التحميل إذا وجد نقص حاد
                if (criticalStock.length > 0 && !window.hasShownStockAlert) {
                    showToast(t('low_stock_alert', { count: criticalStock.length }), 'error');
                    window.hasShownStockAlert = true; // لمنع تكرار الرسالة في نفس الجلسة
                }
            } else {
                alertBtn.classList.add('hidden');
            }
        }

        function checkDueDateAlerts() {
            if (!allData.checks_promissory || allData.checks_promissory.length === 0) {
                document.getElementById('checksAlertBtn').classList.add('hidden');
                return;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // الكمبيالات التي أجلها خلال 7 أيام أو أقل أو متأخرة
            const alertChecks = allData.checks_promissory.filter(check => {
                // فقط الشيكات/الكمبيالات غير المدفوعة وغير الملغاة
                if (check.status !== 'pending') return false;
                if (!check.due_date) return false;

                const dueDate = new Date(check.due_date);
                dueDate.setHours(0, 0, 0, 0);

                const diffTime = dueDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // تنبيه إذا كان التاريخ قد مضى أو خلال 7 أيام القادمة
                return diffDays <= 7;
            });

            const alertBtn = document.getElementById('checksAlertBtn');
            const badge = document.getElementById('checksAlertCount');

            if (alertChecks.length > 0) {
                alertBtn.classList.remove('hidden');
                badge.innerText = alertChecks.length > 99 ? '+99' : alertChecks.length;

                // عرض رسالة تنبيه للمرة الأولى فقط
                if (!window.hasShownChecksAlert) {
                    const overdueCount = alertChecks.filter(check => {
                        const dueDate = new Date(check.due_date);
                        dueDate.setHours(0, 0, 0, 0);
                        return dueDate < today;
                    }).length;

                    const nearCount = alertChecks.length - overdueCount;

                    if (overdueCount > 0) {
                        showToast(`⚠️ تنبيه: يوجد ${overdueCount} كمبيالة/شيك متأخرة عن السداد`, 'error');
                    } else if (nearCount > 0) {
                        showToast(`🔔 تنبيه: يوجد ${nearCount} كمبيالة/شيك تقترب من تاريخ الاستحقاق`, 'info');
                    }

                    window.hasShownChecksAlert = true;
                }
            } else {
                alertBtn.classList.add('hidden');
            }
        }

        function filterChecksByAlert() {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (!allData.checks_promissory) return;

            // تطبيق فلترة على الصفحة لعرض الكمبيالات المحتاجة متابعة فقط
            const alertChecks = allData.checks_promissory.filter(check => {
                if (check.status !== 'pending') return false;
                if (!check.due_date) return false;

                const dueDate = new Date(check.due_date);
                dueDate.setHours(0, 0, 0, 0);

                const diffTime = dueDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                return diffDays <= 7;
            });

            // تحديث الفلاتر في الصفحة
            const statusFilter = document.getElementById('checkStatusFilter');
            const directionFilter = document.getElementById('checkDirectionFilter');

            if (statusFilter) statusFilter.value = 'pending';
            if (directionFilter) directionFilter.value = '';

            // عرض النتائج المفلترة
            if (typeof renderChecksPromissory === 'function') {
                // تعديل مؤقت لدالة الفلترة لعرض التنبيهات فقط
                const originalFilter = filterChecksData;
                if (originalFilter) {
                    // هذا الجزء سيتم تنفيذه في الدالة المعدلة
                }
                renderChecksPromissory();
            }
        }

        function debugChecks(debtId, debtType) {
            console.log('=== فحص الشيكات المرتبطة ===');
            const relatedChecks = allData.checks_promissory.filter(c =>
                c.debt_id === debtId && c.debt_type === debtType
            );

            console.log(`المعرف: ${debtId}, النوع: ${debtType}`);
            console.log(`عدد الشيكات المرتبطة: ${relatedChecks.length}`);

            if (relatedChecks.length > 1) {
                console.warn('⚠️ يوجد أكثر من شيك لنفس المستند!');
                relatedChecks.forEach((c, index) => {
                    console.log(`${index + 1}. ID: ${c.id}, المرجع: ${c.reference}, المبلغ: ${c.amount}`);
                });
            } else if (relatedChecks.length === 1) {
                console.log('✅ يوجد شيك واحد فقط:', relatedChecks[0]);
            } else {
                console.log('ℹ️ لا يوجد شيكات مرتبطة');
            }
            console.log('=========================');
        }

        function verifierCheques(debtId, debtType) {
            console.log('=== VÉRIFICATION DES CHÈQUES ===');

            if (!allData.checks_promissory || allData.checks_promissory.length === 0) {
                console.log('Aucun chèque dans la base');
                return;
            }

            const cheques = allData.checks_promissory.filter(c =>
                String(c.debt_id) === String(debtId) && c.debt_type === debtType
            );

            console.log(`Recherche pour ${debtType} #${debtId}: ${cheques.length} trouvé(s)`);

            if (cheques.length > 1) {
                console.warn('⚠️ ATTENTION: Plusieurs chèques détectés!');
                cheques.forEach((c, i) => {
                    console.log(`${i + 1}. ID: ${c.id}, Réf: ${c.reference}, Montant: ${c.amount}, Statut: ${c.status}`);
                });
            } else if (cheques.length === 1) {
                console.log('✅ Un seul chèque trouvé:', cheques[0]);
            } else {
                console.log('ℹ️ Aucun chèque trouvé');
            }
            console.log('===============================');

            return cheques;
        }

        function debugCheckDoublons(debtId, debtType) {
            if (!allData.checks_promissory) return;

            const relatedChecks = allData.checks_promissory.filter(c =>
                c.debt_id === debtId && c.debt_type === debtType
            );

            console.log(`=== Vérification des doublons pour ${debtType} ${debtId} ===`);
            console.log(`Nombre de chèques trouvés: ${relatedChecks.length}`);

            if (relatedChecks.length > 1) {
                console.warn('⚠️ ATTENTION: Doublons détectés!');
                relatedChecks.forEach((check, index) => {
                    console.log(`${index + 1}. ID: ${check.id}, Réf: ${check.reference}, Montant: ${check.amount}, Statut: ${check.status}`);
                });
            } else if (relatedChecks.length === 1) {
                console.log('✅ Un seul chèque trouvé:', relatedChecks[0]);
            } else {
                console.log('ℹ️ Aucun chèque trouvé');
            }
            console.log('=======================================');
        }

        function checkDueDateAlerts() {
            if (!allData.checks_promissory || allData.checks_promissory.length === 0) return;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // الكمبيالات التي أجلها خلال 7 أيام أو أقل
            const nearDueChecks = allData.checks_promissory.filter(check => {
                if (check.status !== 'pending') return false; // فقط الغير مدفوعة
                if (!check.due_date) return false;

                const dueDate = new Date(check.due_date);
                dueDate.setHours(0, 0, 0, 0);

                const diffTime = dueDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                return diffDays >= 0 && diffDays <= 7; // خلال 7 أيام القادمة
            });

            // الكمبيالات المتأخرة
            const overdueChecks = allData.checks_promissory.filter(check => {
                if (check.status !== 'pending') return false;
                if (!check.due_date) return false;

                const dueDate = new Date(check.due_date);
                dueDate.setHours(0, 0, 0, 0);

                return dueDate < today; // تاريخ الاستحقاق passed
            });

            // عرض التنبيهات
            if (overdueChecks.length > 0) {
                showToast(`⚠️ تنبيه: يوجد ${overdueChecks.length} كمبيالة/شيك متأخرة عن السداد`, 'error');
            } else if (nearDueChecks.length > 0) {
                showToast(`🔔 تنبيه: يوجد ${nearDueChecks.length} كمبيالة/شيك تقترب من تاريخ الاستحقاق`, 'info');
            }

            // يمكنك أيضاً إضافة علامة في القائمة الجانبية
            const alertBtn = document.getElementById('checksAlertBtn');
            if (alertBtn) {
                const totalAlerts = overdueChecks.length + nearDueChecks.length;
                if (totalAlerts > 0) {
                    alertBtn.classList.remove('hidden');
                    document.getElementById('checksAlertCount').innerText = totalAlerts > 99 ? '+99' : totalAlerts;
                } else {
                    alertBtn.classList.add('hidden');
                }
            }
        }

        function filterChecksData() {
            const searchTerm = document.getElementById('checkSearch')?.value.toLowerCase() || '';
            const directionFilter = document.getElementById('checkDirectionFilter')?.value || '';
            const typeFilter = document.getElementById('checkTypeFilter')?.value || '';
            const statusFilter = document.getElementById('checkStatusFilter')?.value || '';

            // جلب فلاتر السنة والشهر من الفلتر العام
            const yearFilter = document.getElementById('filterYear')?.value || '';
            const monthFilter = document.getElementById('filterMonth')?.value || '';

            if (!allData.checks_promissory) return [];

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const filteredChecks = allData.checks_promissory.filter(check => {
                // فلترة التاريخ حسب السنة والشهر
                let matchesDate = true;
                if (yearFilter || monthFilter) {
                    const checkDate = new Date(check.date || check.due_date);
                    if (!isNaN(checkDate.getTime())) {
                        if (yearFilter && checkDate.getFullYear() != yearFilter) {
                            matchesDate = false;
                        }
                        if (monthFilter && (checkDate.getMonth() + 1) != monthFilter) {
                            matchesDate = false;
                        }
                    }
                }

                if (!matchesDate) return false;

                // فلترة البحث
                const matchesTerm = searchTerm === '' ||
                    (check.reference || '').toLowerCase().includes(searchTerm) ||
                    (check.client_name || '').toLowerCase().includes(searchTerm) ||
                    (check.debt_id || '').toLowerCase().includes(searchTerm);

                // فلترة النوع (شيك/كمبيالة)
                const matchesType = !typeFilter || check.type === typeFilter;

                // فلترة الحالة (pending/paid/cancelled)
                const matchesStatus = !statusFilter || check.status === statusFilter;

                // فلترة الاتجاه (وارد/صادر)
                // فلترة الاتجاه (وارد/صادر)
                let matchesDirection = true;
                if (directionFilter === 'received') {
                    matchesDirection = check.debt_type === 'invoice';
                } else if (directionFilter === 'given') {
                    matchesDirection = check.debt_type === 'expense';
                }

                // تعديل: إظهار العنصر إذا كان قد تم التفاعل معه للتو (للحفاظ على الظهور) أو إذا طابق الفلاتر
                const isJustActioned = check._justActioned === true;
                return isJustActioned || (matchesTerm && matchesType && matchesStatus && matchesDirection);
            });

            return filteredChecks;
        }

       function updateChecksDashboard() {
    if (!document.getElementById('page-checks-promissory') || 
        document.getElementById('page-checks-promissory').classList.contains('hidden')) {
        return;
    }
    
    if (!allData.checks_promissory) return;

    let totalReceived = 0;
    let totalGiven = 0;
    let pendingReceivedCount = 0;
    let paidReceivedCount = 0;
    let pendingGivenCount = 0;
    let paidGivenCount = 0;
    let receivedCount = 0;
    let givenCount = 0;
    let totalChecksCount = allData.checks_promissory.length;
    let pendingChecksCount = 0;
    let paidChecksCount = 0;
    let cancelledChecksCount = 0;

    allData.checks_promissory.forEach(check => {
        const isReceived = check.debt_type === 'invoice';
        const amount = safeNum(check.amount);

        // Calculs pour les montants (seulement les chèques payés)
        if (check.status === 'paid') {
            if (isReceived) {
                totalReceived += amount;
            } else {
                totalGiven += amount;
            }
        }

        // Comptages par direction
        if (isReceived) {
            receivedCount++;
            if (check.status === 'paid') paidReceivedCount++;
            if (check.status === 'pending' || !check.status) pendingReceivedCount++;
        } else {
            givenCount++;
            if (check.status === 'paid') paidGivenCount++;
            if (check.status === 'pending' || !check.status) pendingGivenCount++;
        }

        // Comptages par statut global
        if (check.status === 'pending' || !check.status) pendingChecksCount++;
        else if (check.status === 'paid') paidChecksCount++;
        else if (check.status === 'cancelled') cancelledChecksCount++;
    });

    const netBalance = totalReceived - totalGiven;

    // Mise à jour de l'interface
    const totalReceivedEl = document.getElementById('totalReceivedChecks');
    if (totalReceivedEl) totalReceivedEl.textContent = formatCurrency(totalReceived);
    
    const pendingReceivedEl = document.getElementById('pendingReceivedCount');
    if (pendingReceivedEl) pendingReceivedEl.textContent = pendingReceivedCount;
    
    const paidReceivedEl = document.getElementById('paidReceivedCount');
    if (paidReceivedEl) paidReceivedEl.textContent = paidReceivedCount;

    const totalGivenEl = document.getElementById('totalGivenChecks');
    if (totalGivenEl) totalGivenEl.textContent = formatCurrency(totalGiven);
    
    const pendingGivenEl = document.getElementById('pendingGivenCount');
    if (pendingGivenEl) pendingGivenEl.textContent = pendingGivenCount;
    
    const paidGivenEl = document.getElementById('paidGivenCount');
    if (paidGivenEl) paidGivenEl.textContent = paidGivenCount;

    const netBalanceEl = document.getElementById('netChecksBalance');
    if (netBalanceEl) netBalanceEl.textContent = formatCurrency(netBalance);
    
    const receivedCountEl = document.getElementById('receivedCount');
    if (receivedCountEl) receivedCountEl.textContent = receivedCount;
    
    const givenCountEl = document.getElementById('givenCount');
    if (givenCountEl) givenCountEl.textContent = givenCount;

    const totalChecksEl = document.getElementById('totalChecksCount');
    if (totalChecksEl) totalChecksEl.textContent = totalChecksCount;
    
    const pendingChecksEl = document.getElementById('pendingChecksCount');
    if (pendingChecksEl) pendingChecksEl.textContent = pendingChecksCount;
    
    const paidChecksEl = document.getElementById('paidChecksCount');
    if (paidChecksEl) paidChecksEl.textContent = paidChecksCount;
    
    const cancelledChecksEl = document.getElementById('cancelledChecksCount');
    if (cancelledChecksEl) cancelledChecksEl.textContent = cancelledChecksCount;

    // Couleur du solde net
    if (netBalanceEl) {
        const netClass = netBalance > 0 ? 'text-emerald-600' : (netBalance < 0 ? 'text-rose-600' : 'text-slate-600');
        netBalanceEl.className = `text-xl font-black ${netClass}`;
    }
}

      function renderChecksPromissory() {
    const container = document.getElementById('checksContainer');
    const noChecksMessage = document.getElementById('noChecksMessage');

    if (!container) return;

    container.innerHTML = '';

    // Mettre à jour les cartes de résumé
    updateChecksDashboard();

    if (!allData.checks_promissory || allData.checks_promissory.length === 0) {
        container.classList.add('hidden');
        if (noChecksMessage) {
            noChecksMessage.classList.remove('hidden');
            noChecksMessage.innerHTML = `
                <i class="fas fa-money-check-alt text-3xl text-slate-300 mb-3"></i>
                <p class="text-slate-400 font-bold">${t('no_checks')}</p>
            `;
        }
        return;
    } else {
        container.classList.remove('hidden');
        if (noChecksMessage) noChecksMessage.classList.add('hidden');
    }

    // Appliquer les filtres
    const filteredChecks = filterChecksData();
    updateFilterSummary();

    if (filteredChecks.length === 0) {
        container.innerHTML = `
            <div class="text-center p-8 bg-white rounded-[2rem] shadow-sm">
                <i class="fas fa-search text-3xl text-slate-300 mb-3"></i>
                <p class="text-slate-400 font-bold">${t('no_results_found')}</p>
            </div>
        `;
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ترتيب الشيكات والكمبيالات: النشطة (المعلقة) التي قرب تاريخ استحقاقها/صرفها أولاً في الأعلى، والأخرى (المدفوعة/الملغاة) في الأسفل
    filteredChecks.sort((a, b) => {
        const isPendingA = a.status === 'pending' || !a.status;
        const isPendingB = b.status === 'pending' || !b.status;

        // 1. الشيكات المعلقة لها الأولوية في الظهور بالأعلى
        if (isPendingA && !isPendingB) return -1;
        if (!isPendingA && isPendingB) return 1;

        // 2. إذا كانت كلا الشيكين معلقين، نرتب حسب تاريخ الاستحقاق تصاعدياً (الأقرب تاريخ صرف أولاً)
        if (isPendingA && isPendingB) {
            const dateA = new Date(a.due_date || a.date);
            const dateB = new Date(b.due_date || b.date);
            const timeA = isNaN(dateA.getTime()) ? Infinity : dateA.getTime();
            const timeB = isNaN(dateB.getTime()) ? Infinity : dateB.getTime();
            
            if (timeA !== timeB) return timeA - timeB;
            
            // ترتيب فرعي: تاريخ الإصدار الأحدث أولاً
            const issueA = new Date(a.date);
            const issueB = new Date(b.date);
            const issueTimeA = isNaN(issueA.getTime()) ? Infinity : issueA.getTime();
            const issueTimeB = isNaN(issueB.getTime()) ? Infinity : issueB.getTime();
            return issueTimeB - issueTimeA;
        }

        // 3. إذا كانت كلا الشيكين غير معلقين (مدفوع أو ملغي)، نرتب تنازلياً حسب تاريخ الاستحقاق (الأحدث أولاً في الأسفل)
        const dateA = new Date(a.due_date || a.date);
        const dateB = new Date(b.due_date || b.date);
        const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
        const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
        return timeB - timeA;
    });

    filteredChecks.forEach(check => {
        // Déterminer la direction (entrant/sortant)
        const isReceived = check.debt_type === 'invoice';
        const directionText = isReceived ? t('received_dir') : t('given_dir');
        const directionClass = isReceived ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50';

        // Déterminer le statut
        const isPending = check.status === 'pending' || !check.status;
        const isPaid = check.status === 'paid';
        const isCancelled = check.status === 'cancelled';

        let statusClass = '';
        let statusText = '';

        if (isPending) {
            statusClass = 'text-amber-600 bg-amber-50';
            statusText = t('pending');
        } else if (isPaid) {
            statusClass = 'text-emerald-600 bg-emerald-50';
            statusText = t('paid');
        } else if (isCancelled) {
            statusClass = 'text-rose-600 bg-rose-50';
            statusText = t('cancelled');
        }

        // Type de document (chèque ou billet à ordre)
        const isCheck = check.type === 'شيك';
        const typeText = isCheck ? t('check_word') : t('promissory');
        const typeClass = isCheck ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600';

        // Nom du client/fournisseur
        let clientName = check.client_name || t('unknown');

        // Essayer d'obtenir le nom depuis les données liées
        if (check.debt_type === 'invoice' && check.debt_id) {
            const invoice = allData.invoices?.find(i => 
                String(i.id) === String(check.debt_id) || 
                'INV-' + String(i.id) === String(check.debt_id) || 
                String(i.id) === 'INV-' + String(check.debt_id)
            );
            if (invoice && invoice.customer) {
                clientName = invoice.customer;
            }
        } else if (check.debt_type === 'expense' && check.debt_id) {
            const expense = allData.expenses?.find(e => String(e.id) === String(check.debt_id));
            if (expense && expense.supplier) {
                clientName = expense.supplier;
            }
        }

        // Vérifier la date d'échéance
        let dueDateClass = '';
        let dueDateIcon = '';
        let dueDateText = '';

        if (isPending && check.due_date) {
            const dueDate = new Date(check.due_date);
            dueDate.setHours(0, 0, 0, 0);

            const diffTime = dueDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                dueDateClass = 'text-rose-600 font-black';
                dueDateIcon = '⚠️';
                dueDateText = t('late_by', { days: Math.abs(diffDays) });
            } else if (diffDays === 0) {
                dueDateClass = 'text-rose-600 font-black';
                dueDateIcon = '🔴';
                dueDateText = t('today');
            } else if (diffDays <= 3) {
                dueDateClass = 'text-amber-600 font-black';
                dueDateIcon = '🔔';
                dueDateText = t('in_days', { days: diffDays });
            } else if (diffDays <= 7) {
                dueDateClass = 'text-orange-600';
                dueDateIcon = '⏰';
                dueDateText = t('in_days', { days: diffDays });
            } else {
                dueDateText = check.due_date ? formatDateSimple(check.due_date) : t('not_specified');
            }
        } else {
            dueDateText = check.due_date ? formatDateSimple(check.due_date) : t('not_specified');
        }

        const amount = safeNum(check.amount || 0);

        // Construction de la carte
        container.innerHTML += `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all ${dueDateClass ? 'border-r-4 border-amber-400' : ''}">
            <div class="flex justify-between items-start mb-3">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                        <span class="px-2 py-1 rounded-full text-[10px] font-black ${typeClass}">
                            ${typeText}
                        </span>
                        <span class="px-2 py-1 rounded-full text-[10px] font-black ${directionClass}">
                            ${directionText}
                        </span>
                        <span class="px-2 py-1 rounded-full text-[10px] font-black ${statusClass}">
                            ${statusText}
                        </span>
                        <span class="text-[9px] text-slate-400">${t('reference_label')}: ${check.reference || t('no_reference')}</span>
                    </div>
                    
                    <h4 class="font-black text-slate-800 text-sm mb-2">${escapeHtml(clientName)}</h4>
                    
                    <div class="grid grid-cols-2 gap-2 mt-2 text-[9px]">
                        <div>
                            <span class="text-slate-400">${t('issue_date')}:</span>
                            <span class="font-bold text-slate-600 mr-1">${check.date ? formatDateSimple(check.date) : t('not_specified')}</span>
                        </div>
                        <div class="${dueDateClass}">
                            <span class="text-slate-400">${t('due_date_label')}:</span>
                            <span class="font-bold mr-1">${dueDateText} ${dueDateIcon}</span>
                        </div>
                    </div>
                    
                    ${check.debt_id ? `
                        <div class="mt-2 text-[9px]">
                            <span class="bg-slate-100 px-2 py-1 rounded-full text-slate-600">
                                ${check.debt_type === 'invoice' ? t('invoice') : t('expense')} #${check.debt_id}
                            </span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="text-left min-w-[120px]">
                    <p class="font-black text-slate-800 text-lg">${formatCurrency(amount)}</p>
                    
                    <div class="flex gap-2 mt-3 justify-end">
                        ${isPending ? `
                            <button onclick="confirmCashing('${check.id}')" 
                                    class="bg-emerald-100 text-emerald-600 px-3 py-1.5 rounded-lg text-xs font-black hover:bg-emerald-200 transition-all"
                                    title="${t('confirm_cashing_tooltip')}">
                                <i class="fas fa-check-circle ml-1"></i> ${t('cash_btn')}
                            </button>
                            <button onclick="confirmCancelCashing('${check.id}')" 
                                    class="bg-rose-100 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-black hover:bg-rose-200 transition-all"
                                    title="${t('cancel')}">
                                <i class="fas fa-times-circle ml-1"></i>
                            </button>
                        ` : ''}
                        
                        ${isPaid ? `
                            <button onclick="confirmCancelCashing('${check.id}')" 
                                    class="bg-amber-100 text-amber-600 px-3 py-1.5 rounded-lg text-xs font-black hover:bg-amber-200 transition-all"
                                    title="${t('cancel_cashing_tooltip')}">
                                <i class="fas fa-undo ml-1"></i>
                            </button>
                        ` : ''}
                        
                        ${isCancelled ? `
                            <span class="text-[9px] text-rose-500 font-bold px-2 py-1">${t('cancelled_badge')}</span>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>`;
    });
}

        function confirmCashing(id) {
            const check = allData.checks_promissory.find(c => c.id === id);
            if (!check) return;

            openConfirm({
                title: t('confirm_cashing'),
                msg: t('confirm_cashing_msg', { type: check.type }),
                iconClass: "fas fa-check-circle",
                colorClass: "bg-emerald-600",
                onConfirm: () => {
                    // تحديث الحالة محلياً
                    const index = allData.checks_promissory.findIndex(c => c.id === id);
                    if (index !== -1) {
                        allData.checks_promissory[index].status = 'paid';
                        allData.checks_promissory[index]._justActioned = true; // علامة للحفاظ على الظهور
                    }

                    renderChecksPromissory();
                    showToast(t('cashing_success'));

                    // إرسال للسيرفر
                    if (currentDbId) {
                        google.script.run
                            .withSuccessHandler(() => { })
                            .withFailureHandler((e) => console.error(e))
                            .updateCheckStatus(id, 'paid', currentDbId);
                    }
                }
            });
        }

        function confirmCancelCashing(id) {
            const check = allData.checks_promissory.find(c => c.id === id);
            if (!check) return;

            openConfirm({
                title: t('cancel_cashing'),
                msg: t('cancel_cashing_confirm', { type: check.type }),
                iconClass: "fas fa-undo-alt",
                colorClass: "bg-amber-600",
                onConfirm: () => {
                    cancelCashing(id);
                }
            });
        }

        function renderTreasury() {
            const container = document.getElementById('treasuryTransactions');
            if (!container) return;

            // الحصول على البيانات المفلترة حسب التاريخ (من فلاتر الخزينة)
            const yearVal = document.getElementById('treasuryYearFilter').value;
            const monthVal = document.getElementById('treasuryMonthFilter').value;
            const dayVal = document.getElementById('treasuryDayFilter').value;
            const accountVal = document.getElementById('treasuryAccountFilter').value;

            const filterDate = (arr) => {
                return (arr || []).filter(m => {
                    const date = m.date || '';
                    const parts = date.split('-');
                    const y = parts[0];
                    const m_ = parts[1];
                    const d = parts[2];
                    const matchesYear = !yearVal || y === yearVal;
                    const matchesMonth = !monthVal || m_ === monthVal;
                    const matchesDay = !dayVal || d === dayVal;
                    return matchesYear && matchesMonth && matchesDay;
                });
            };

            const fInvs = filterDate(allData.invoices);
            const fExps = filterDate(allData.expenses);
            const fPayments = filterDate(allData.payments);
            const fChecks = filterDate(allData.checks_promissory);
            const fTransfers = filterDate(allData.transfers);

            // حساب الأرصدة باستخدام الدوال الموحدة لضمان التطابق مع التقارير
            const cashBalance = calculateCashBalance(fInvs, fExps, fPayments, fTransfers);
            const bankBalance = calculateBankBalance(fInvs, fExps, fPayments, fChecks, fTransfers);

            // تحديث البطاقات
            document.getElementById('cashBalanceTreasury').innerText = formatCurrency(cashBalance);
            document.getElementById('bankBalanceTreasury').innerText = formatCurrency(bankBalance);
            document.getElementById('totalTreasuryBalance').innerText = formatCurrency(cashBalance + bankBalance);

            // تجميع كل التحركات للعرض
            let allMovements = [];
            
            // 1. إضافة المدفوعات
            fPayments.forEach(p => {
                const isCash = p.method === 'صندوق';
                const isBank = p.method === 'بنك' || p.method === 'تحويل بنكي' || p.method === 'شيك';
                const acc = isCash ? 'cash' : (isBank ? 'bank' : 'other');
                
                if (p.type === 'customer') { // وارد
                    allMovements.push({ ...p, mvType: 'in', account: acc });
                } else if (p.type === 'supplier') { // صادر
                    allMovements.push({ ...p, mvType: 'out', account: acc });
                }
            });

            // 2. إضافة المصاريف المباشرة (التي ليست في المدفوعات)
            fExps.forEach(e => {
                const isCash = e.method === 'صندوق';
                const isBank = e.method === 'بنك' || e.method === 'تحويل بنكي';
                if ((isCash || isBank) && safeNum(e.paid) > 0) {
                    // التحقق من أنها ليست مسجلة مسبقاً في المدفوعات
                    const inPayments = fPayments.some(p => p.debt_id === e.id && p.debt_type === 'expense');
                    if (!inPayments) {
                        allMovements.push({ 
                            ...e, 
                            amount: e.paid, 
                            client_name: e.category || t('expense_label'),
                            method: e.method,
                            mvType: 'out', 
                            account: isCash ? 'cash' : 'bank' 
                        });
                    }
                }
            });

            // 3. إضافة التحويلات
            fTransfers.forEach(tr => {
                allMovements.push({ 
                    ...tr, 
                    type: 'transfer', 
                    method: tr.from_account + '_to_' + tr.to_account, 
                    mvType: 'transfer',
                    account: 'both' 
                });
            });

            // تطبيق فلتر الحساب
            if (accountVal) {
                allMovements = allMovements.filter(m => m.account === accountVal || m.account === 'both');
            }

            // تطبيق فلتر البحث
            const searchVal = document.getElementById('treasurySearch').value.toLowerCase();
            if (searchVal) {
                allMovements = allMovements.filter(m => 
                    (m.client_name && m.client_name.toLowerCase().includes(searchVal)) || 
                    (m.description && translatePaymentDescription(m.description).toLowerCase().includes(searchVal)) ||
                    (m.id && m.id.toLowerCase().includes(searchVal))
                );
            }

            // ترتيب حسب التاريخ الأحدث
            allMovements.sort((a, b) => new Date(b.date) - new Date(a.date));

            // تحديث فلاتر التاريخ (إذا لم تكن ممتلئة)
            updateTreasuryDateFilters(allMovements);

            // العرض مع ليميت 10
            container.innerHTML = '';
            if (allMovements.length === 0) {
                container.innerHTML = `<div class="text-center p-8 bg-white rounded-2xl shadow-sm"><p class="text-slate-400 font-bold">${t('no_results_found')}</p></div>`;
                return;
            }

            const limit = 10;
            const itemsToShow = allMovements.slice(0, limit);

            itemsToShow.forEach(m => {
                let iconClass = '';
                let colorClass = '';
                let title = '';
                let subtitle = '';

                if (m.mvType === 'in') {
                    iconClass = 'fa-arrow-down';
                    colorClass = 'text-emerald-600 bg-emerald-50';
                    
                    let titleVal = m.client_name;
                    if (titleVal === 'زبون عام') {
                        titleVal = t('general_customer');
                    } else if (titleVal === 'مورد غير معروف') {
                        titleVal = t('unknown_supplier');
                    } else {
                        titleVal = titleVal || t('customer');
                    }
                    title = titleVal;
                    subtitle = `${t('received_dir')} - ${translatePaymentMethod(m.method)}`;
                } else if (m.mvType === 'out') {
                    iconClass = 'fa-arrow-up text-rose-600';
                    colorClass = 'bg-rose-50';
                    
                    let titleVal = m.client_name;
                    if (titleVal === 'زبون عام') {
                        titleVal = t('general_customer');
                    } else if (titleVal === 'مورد غير معروف') {
                        titleVal = t('unknown_supplier');
                    } else if (titleVal) {
                        titleVal = translateExpenseCategory(titleVal);
                    } else {
                        titleVal = t('supplier');
                    }
                    title = titleVal;
                    subtitle = `${t('given_dir')} - ${translatePaymentMethod(m.method)}`;
                } else {
                    iconClass = 'fa-exchange-alt';
                    colorClass = 'text-blue-600 bg-blue-50';
                    title = t('transfer_action');
                    subtitle = `${t(m.from_account === 'cash' ? 'cash_box' : 'bank')} → ${t(m.to_account === 'cash' ? 'cash_box' : 'bank')}`;
                }

                container.innerHTML += `
                    <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex justify-between items-center hover:shadow-md transition-all">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 ${colorClass} rounded-xl flex items-center justify-center">
                                <i class="fas ${iconClass}"></i>
                            </div>
                            <div>
                                <h4 class="font-black text-slate-800 text-sm">${title}</h4>
                                <p class="text-[10px] text-slate-400">${subtitle} • ${m.date}</p>
                                ${m.description ? `<p class="text-[9px] text-slate-500 mt-1 italic">${translatePaymentDescription(m.description)}</p>` : ''}
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="font-black text-sm ${m.mvType === 'in' ? 'text-emerald-600' : (m.mvType === 'out' ? 'text-rose-600' : 'text-blue-600')}">
                                ${m.mvType === 'out' ? '-' : (m.mvType === 'in' ? '+' : '')}${formatCurrency(m.amount)}
                            </p>
                            ${m.mvType === 'transfer' ? `
                                <button onclick="deleteTransferRecord('${m.id}')" class="text-rose-400 hover:text-rose-600 text-[10px] mt-1">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            });

            if (allMovements.length > limit) {
                container.innerHTML += `
                    <div class="text-center py-4">
                        <p class="text-slate-400 text-[10px] font-bold">${t('treasury_stats', { filtered: limit, total: allMovements.length })}</p>
                        <p class="text-slate-300 text-[9px] mt-1">${t('use_search_hint')}</p>
                    </div>
                `;
            }
        }

        function updateTreasuryDateFilters(movements) {
            const yearSelect = document.getElementById('treasuryYearFilter');
            const monthSelect = document.getElementById('treasuryMonthFilter');
            const daySelect = document.getElementById('treasuryDayFilter');

            if (!yearSelect || !monthSelect || !daySelect) return;

            // تحديث السنوات (الموجودة في البيانات)
            if (yearSelect.options.length <= 1) {
                const years = new Set();
                movements.forEach(m => {
                    const parts = (m.date || '').split('-');
                    if (parts[0]) years.add(parts[0]);
                });
                // إضافة السنة الحالية دائماً
                years.add(new Date().getFullYear().toString());
                [...years].sort().reverse().forEach(y => yearSelect.add(new Option(y, y)));
            }

            // تحديث الشهور (كل الشهور 1-12)
            if (monthSelect.options.length <= 1) {
                for (let i = 1; i <= 12; i++) {
                    const mVal = i.toString().padStart(2, '0');
                    monthSelect.add(new Option(mVal, mVal));
                }
            }

            // تحديث الأيام (1-31)
            if (daySelect.options.length <= 1) {
                for (let i = 1; i <= 31; i++) {
                    const dVal = i.toString().padStart(2, '0');
                    daySelect.add(new Option(dVal, dVal));
                }
            }
        }

        function openTransferModal() {
            document.getElementById('transferForm').reset();
            document.getElementById('trDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('trFrom').value = 'cash';
            document.getElementById('trTo').value = 'bank';
            openModal('transferModal');
        }

        function handleTrFromChange() {
            const fromVal = document.getElementById('trFrom').value;
            document.getElementById('trTo').value = (fromVal === 'cash') ? 'bank' : 'cash';
        }

        function handleTrToChange() {
            const toVal = document.getElementById('trTo').value;
            document.getElementById('trFrom').value = (toVal === 'cash') ? 'bank' : 'cash';
        }

        function handleTransferSubmit(e) {
            e.preventDefault();
            console.log("🚀 جاري معالجة عملية التحويل...");
            
            const from = document.getElementById('trFrom').value;
            const to = document.getElementById('trTo').value;
            const amount = Number(document.getElementById('trAmount').value);
            const date = document.getElementById('trDate').value;
            const description = document.getElementById('trDescription').value;

            if (from === to) {
                showToast(t('error_same_account') || "لا يمكن التحويل لنفس الحساب", 'error');
                return;
            }

            if (amount <= 0) {
                showToast(t('amount_gt_zero'), 'error');
                return;
            }

            // التحقق من توفر الرصيد الكافي للتحويل
            if (from === 'cash') {
                const currentCash = calculateCashBalance(allData.invoices, allData.expenses, allData.payments, allData.transfers);
                if (amount > currentCash) {
                    showToast(`${t('insufficient_balance') || "الرصيد غير كافٍ"} (${t('cash_box')}: ${formatCurrency(currentCash)})`, 'error');
                    return;
                }
            } else if (from === 'bank') {
                const currentBank = calculateBankBalance(allData.invoices, allData.expenses, allData.payments, allData.checks_promissory, allData.transfers);
                if (amount > currentBank) {
                    showToast(`${t('insufficient_balance') || "الرصيد غير كافٍ"} (${t('bank')}: ${formatCurrency(currentBank)})`, 'error');
                    return;
                }
            }

            const fromName = t(from === 'cash' ? 'cash_box' : 'bank');
            const toName = t(to === 'cash' ? 'cash_box' : 'bank');
            const formattedAmount = formatCurrency(amount);

            const msgText = t('confirm_transfer_msg', {
                amount: formattedAmount,
                from: fromName,
                to: toName
            });

            openConfirm({
                title: t('confirm_transfer'),
                msg: msgText,
                iconClass: "fas fa-exchange-alt",
                colorClass: "bg-blue-600",
                onConfirm: () => {
                    const transfer = {
                        id: 'TR-' + Date.now(),
                        date,
                        from_account: from,
                        to_account: to,
                        amount,
                        description: description || ''
                    };

                    // Close the transfer form modal and reset immediately
                    document.getElementById('transferForm').reset();
                    closeModal('transferModal');

                    setLoading(true);
                    google.script.run
                        .withSuccessHandler((res) => {
                            console.log("✅ تم حفظ التحويل في السيرفر:", res);
                            if (!allData.transfers) allData.transfers = [];
                            allData.transfers.push(transfer);
                            
                            // تحديث الواجهة
                            renderTreasury();
                            showToast(t('transfer_success'));
                            setLoading(false);
                        })
                        .withFailureHandler(err => {
                            console.error("❌ فشل التحويل:", err);
                            setLoading(false);
                            showToast(err.toString(), 'error');
                        })
                        .saveTransfer(transfer, currentDbId);
                }
            });
        }

        function deleteTransferRecord(id) {
            openConfirm({
                title: t('delete_confirm', { name: t('financial_transfer') }),
                msg: t('delete_msg'),
                iconClass: "fas fa-trash-alt",
                colorClass: "bg-rose-600",
                onConfirm: () => {
                    // مسح التحويل مباشرة محلياً في إنتظار المزامنة
                    allData.transfers = allData.transfers.filter(tr => tr.id !== id);
                    renderTreasury();
                    showToast(t('delete_success'));

                    // المزامنة مع السيرفر في الخلفية
                    if (currentDbId) {
                        google.script.run
                            .withSuccessHandler(() => {
                                console.log("✅ تم حذف التحويل من السيرفر بنجاح");
                            })
                            .withFailureHandler(err => {
                                console.error("❌ فشل حذف التحويل من السيرفر:", err);
                                showToast(err.toString(), 'error');
                            })
                            .deleteTransfer(id, currentDbId);
                    }
                }
            });
        }

        function cancelCashing(id) {
            const check = allData.checks_promissory.find(c => c.id === id);
            if (!check) return;
            if (check.status === 'cancelled') return; // Prevent double cancellation

            // 1. العثور على الدين المرتبط (فاتورة أو مصروف)
            if (check.debt_id && check.debt_type) {
                if (check.debt_type === 'invoice') {
                    const invoice = allData.invoices.find(i => 
                        String(i.id) === String(check.debt_id) || 
                        'INV-' + String(i.id) === String(check.debt_id) || 
                        String(i.id) === 'INV-' + String(check.debt_id)
                    );
                    if (invoice) {
                        // إعادة المبلغ للدين
                        invoice.paid = safeNum(invoice.paid) - safeNum(check.amount);
                        invoice.balance = safeNum(invoice.balance) + safeNum(check.amount);
                    }
                } else if (check.debt_type === 'expense') {
                    const expense = allData.expenses.find(e => String(e.id) === String(check.debt_id));
                    if (expense) {
                        // إعادة المبلغ للدين
                        expense.paid = safeNum(expense.paid) - safeNum(check.amount);
                        expense.balance = safeNum(expense.balance) + safeNum(check.amount);
                    }
                }
            }

            // 2. البحث عن الدفعة المرتبطة وإلغائها
            const payment = allData.payments.find(p =>
                p.debt_id === check.debt_id &&
                p.debt_type === check.debt_type &&
                p.reference === check.reference &&
                Math.abs(p.amount - check.amount) < 0.01
            );

            if (payment) {
                const paymentIndex = allData.payments.findIndex(p => p.id === payment.id);
                if (paymentIndex !== -1) {
                    allData.payments.splice(paymentIndex, 1);
                }
            }

            // 3. تحديث حالة الشيك/الكمبيالة إلى "ملغي"
            const checkIndex = allData.checks_promissory.findIndex(c => c.id === id);
            if (checkIndex !== -1) {
                allData.checks_promissory[checkIndex].status = 'cancelled';
                allData.checks_promissory[checkIndex]._justActioned = true; // علامة للحفاظ على الظهور
            }

            // 4. تحديث الواجهات
            renderChecksPromissory();

            if (!document.getElementById('page-invoices').classList.contains('hidden')) {
                renderInvoices(getFilteredData(allData.invoices));
            }
            if (!document.getElementById('page-expenses').classList.contains('hidden')) {
                renderExpenses(getFilteredData(allData.expenses));
            }
            if (!document.getElementById('page-payments').classList.contains('hidden')) {
                renderPayments();
            }
            if (!document.getElementById('page-clients').classList.contains('hidden')) {
                renderClients();
            }
            if (!document.getElementById('page-suppliers').classList.contains('hidden')) {
                renderSuppliers();
            }

            showToast(t('cancelling_success'));

            // 5. إرسال التحديثات للسيرفر
            if (currentDbId) {
                // تحديث حالة الشيك
                google.script.run
                    .withSuccessHandler(() => { })
                    .withFailureHandler((e) => console.error(e))
                    .updateCheckStatus(id, 'cancelled', currentDbId);

                // حذف الدفعة من السيرفر إذا وجدت
                if (payment) {
                    google.script.run
                        .withSuccessHandler(() => { })
                        .withFailureHandler((e) => console.error(e))
                        .deletePayment(payment.id, currentDbId);
                } else {
                    // تحديث الفاتورة/المصروف في السيرفر فقط إذا لم يتم حذف الدفعة
                    // لأن دالة deletePayment في السيرفر تقوم بتحديث الرصيد تلقائياً
                    if (check.debt_type === 'invoice') {
                        const invoice = allData.invoices.find(i => String(i.id) === String(check.debt_id));
                        if (invoice) {
                            google.script.run
                                .withSuccessHandler(() => { })
                                .withFailureHandler((e) => console.error(e))
                                .saveInvoice(invoice, true, currentDbId);
                        }
                    } else if (check.debt_type === 'expense') {
                        const expense = allData.expenses.find(e => String(e.id) === String(check.debt_id));
                        if (expense) {
                            google.script.run
                                .withSuccessHandler(() => { })
                                .withFailureHandler((e) => console.error(e))
                                .saveExpense(expense, true, currentDbId);
                        }
                    }
                }
            }
        }

        function searchChecks() {
            renderChecksPromissory();
        }

        function filterChecks() {
            renderChecksPromissory();
        }

        function fillFullAmount() {
            const originalBalance = safeNum(document.getElementById('settleOriginalBalance').value);
            document.getElementById('settleAmount').value = originalBalance;
        }

        function calculateBankBalance(filteredInvoices = null, filteredExpenses = null, filteredPayments = null, filteredChecks = null, filteredTransfers = null) {
            let bankBalance = 0;

            // استخدام البيانات المفلترة إذا تم توفيرها
            const checks = filteredChecks || [];
            const payments = filteredPayments || [];
            const invoices = filteredInvoices || [];
            const expenses = filteredExpenses || [];

            console.log('=== حساب الرصيد البنكي للفترة ===');
            console.log('عدد الشيكات:', checks.length);
            console.log('عدد المدفوعات:', payments.length);

            // 1. الشيكات والكمبيالات المدفوعة (وارد من الزبناء)
            const receivedChecks = checks.filter(c =>
                (c.type === 'شيك' || c.type === 'كمبيالة') &&
                c.status === 'paid' &&
                c.debt_type === 'invoice'
            );

            receivedChecks.forEach(c => {
                bankBalance += safeNum(c.amount);
                console.log(`شيك وارد: ${c.reference} - ${formatCurrency(c.amount)}`);
            });

            // 2. الشيكات والكمبيالات المدفوعة (صادر للموردين)
            const givenChecks = checks.filter(c =>
                (c.type === 'شيك' || c.type === 'كمبيالة') &&
                c.status === 'paid' &&
                c.debt_type === 'expense'
            );

            givenChecks.forEach(c => {
                bankBalance -= safeNum(c.amount);
                console.log(`شيك صادر: ${c.reference} - ${formatCurrency(c.amount)}`);
            });

            // 3. التحويلات البنكية من المدفوعات
            const bankTransfers = payments.filter(p =>
                p.method === 'تحويل بنكي'
            );

            bankTransfers.forEach(p => {
                if (p.type === 'customer') {
                    bankBalance += safeNum(p.amount);
                    console.log(`تحويل وارد: ${p.reference} - ${formatCurrency(p.amount)}`);
                } else if (p.type === 'supplier') {
                    bankBalance -= safeNum(p.amount);
                    console.log(`تحويل صادر: ${p.reference} - ${formatCurrency(p.amount)}`);
                }
            });

            // 4. الفواتير المدفوعة بالتحويل البنكي (غير مسجلة في المدفوعات)
            const invoiceTransfers = invoices.filter(i =>
                i.payment_method === 'تحويل بنكي' &&
                safeNum(i.paid) > 0 &&
                !payments.some(p =>
                    p.debt_id === i.id &&
                    p.method === 'تحويل بنكي'
                )
            );

            invoiceTransfers.forEach(i => {
                bankBalance += safeNum(i.paid);
                console.log(`فاتورة تحويل: ${i.id} - ${formatCurrency(i.paid)}`);
            });

            // 5. المصاريف المدفوعة بالتحويل البنكي (غير مسجلة في المدفوعات)
            const expenseTransfers = expenses.filter(e =>
                e.method === 'تحويل بنكي' &&
                safeNum(e.paid) > 0 &&
                !payments.some(p =>
                    p.debt_id === e.id &&
                    p.method === 'تحويل بنكي'
                )
            );

            expenseTransfers.forEach(e => {
                bankBalance -= safeNum(e.paid);
                console.log(`مصروف تحويل: ${e.id} - ${formatCurrency(e.paid)}`);
            });

            // 6. التحويلات (جديد)
            const fTransfers = filteredTransfers || getFilteredData(allData.transfers || []);
            fTransfers.forEach(tr => {
                const amount = safeNum(tr.amount);
                if (tr.from_account === 'bank') bankBalance -= amount;
                if (tr.to_account === 'bank') bankBalance += amount;
            });

            console.log('الرصيد البنكي النهائي:', formatCurrency(bankBalance));

            return bankBalance;
        }

        function calculateCashBalance(filteredInvoices = null, filteredExpenses = null, filteredPayments = null, filteredTransfers = null) {
            let cashBalance = 0;

            // استخدام البيانات المفلترة إذا تم توفيرها
            const payments = filteredPayments || [];
            const invoices = filteredInvoices || [];
            const expenses = filteredExpenses || [];

            console.log('=== حساب رصيد الصندوق للفترة ===');
            console.log('عدد المدفوعات:', payments.length);

            // 1. المدفوعات النقدية من الزبناء
            const cashReceived = payments.filter(p =>
                p.method === 'صندوق' &&
                p.type === 'customer'
            );

            cashReceived.forEach(p => {
                const amount = safeNum(p.amount);
                cashBalance += amount;
                console.log(`دفعة نقدية وارد: ${p.reference || 'بدون مرجع'} - ${formatCurrency(amount)}`);
            });

            // 2. المدفوعات النقدية للموردين
            const cashGiven = payments.filter(p =>
                p.method === 'صندوق' &&
                p.type === 'supplier'
            );

            cashGiven.forEach(p => {
                const amount = safeNum(p.amount);
                cashBalance -= amount;
                console.log(`دفعة نقدية صادر: ${p.reference || 'بدون مرجع'} - ${formatCurrency(amount)}`);
            });

            // 3. الفواتير المدفوعة نقداً (إذا لم تكن مسجلة في المدفوعات)
            const cashInvoices = invoices.filter(i =>
                i.payment_method === 'صندوق' &&
                safeNum(i.paid) > 0 &&
                !payments.some(p =>
                    p.debt_id === i.id &&
                    p.method === 'صندوق'
                )
            );

            cashInvoices.forEach(i => {
                const amount = safeNum(i.paid);
                cashBalance += amount;
                console.log(`فاتورة نقداً: ${i.id} - ${formatCurrency(amount)}`);
            });

            // 4. المصاريف المدفوعة نقداً (إذا لم تكن مسجلة في المدفوعات)
            const cashExpenses = expenses.filter(e =>
                e.method === 'صندوق' &&
                safeNum(e.paid) > 0 &&
                !payments.some(p =>
                    p.debt_id === e.id &&
                    p.method === 'صندوق'
                )
            );

            cashExpenses.forEach(e => {
                const amount = safeNum(e.paid);
                cashBalance -= amount;
                console.log(`مصروف نقداً: ${e.id} - ${formatCurrency(amount)}`);
            });

            // 5. التحويلات (جديد)
            const fTransfers = filteredTransfers || getFilteredData(allData.transfers || []);
            fTransfers.forEach(tr => {
                const amount = safeNum(tr.amount);
                if (tr.from_account === 'cash') cashBalance -= amount;
                if (tr.to_account === 'cash') cashBalance += amount;
            });

            return cashBalance;
        }

        function showChecksWithAlert() {
            showPage('checks-promissory');

            const statusFilter = document.getElementById('checkStatusFilter');
            const directionFilter = document.getElementById('checkDirectionFilter');

            if (statusFilter) statusFilter.value = 'pending';
            if (directionFilter) directionFilter.value = '';

            // تطبيق الفلتر
            if (typeof filterChecks === 'function') {
                filterChecks();
            }
        }