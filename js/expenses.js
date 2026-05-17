        function translateExpenseCategory(cat) {
            if (!cat || typeof cat !== 'string') return cat;
            if (cat.includes('سلع')) return t('buy_goods') || cat;
            if (cat.includes('كراء')) return t('rent') || cat;
            if (cat.includes('كهرباء') || cat.includes('ماء')) return t('utilities') || cat;
            if (cat.includes('رواتب')) return t('salaries') || cat;
            if (cat.includes('أخرى')) return t('other_category') || t('other') || cat;
            return cat;
        }

        function toggleExpenseDueDateField() {
            const method = document.getElementById('expMethod').value;
            const dueDateField = document.getElementById('expDueDateField');
            const dueDateInput = document.getElementById('expDueDate');

            if (method === 'شيك' || method === 'كمبيالة') {
                dueDateField.classList.remove('hidden');

                // إذا كان حقل التاريخ فارغاً، نضع تاريخ افتراضي (بعد 30 يوم)
                if (!dueDateInput.value) {
                    const today = new Date();
                    const dueDate = new Date(today.setDate(today.getDate() + 30));
                    dueDateInput.value = dueDate.toISOString().split('T')[0];
                }
            } else {
                dueDateField.classList.add('hidden');
                // لا نفرغ التاريخ عند الإخفاء للحفاظ على القيمة إذا عاد المستخدم للشيك
                // dueDateInput.value = '';
            }
        }

        function updateExpenseCategoryTranslations() {
            const expCatSelect = document.getElementById('expCat');
            if (expCatSelect) {
                Array.from(expCatSelect.options).forEach(option => {
                    const i18nKey = option.getAttribute('data-i18n');
                    if (i18nKey && translations[currentLang][i18nKey]) {
                        option.textContent = translations[currentLang][i18nKey];
                    }
                });
            }
        }

        function fillExpenseAmountInPaid() {
            const amount = safeNum(document.getElementById('expAmount').value);
            document.getElementById('expPaid').value = amount;
            calcExpenseBalance();
        }

        function getExpenseStatus(balance) {
            balance = safeNum(balance);
            if (balance === 0) return t('safe_status');
            if (balance > 0) return t('debt');
            return t('paid');
        }

        function getExpenseStatusColor(balance) {
            balance = safeNum(balance);
            if (balance === 0) return 'text-emerald-600';
            if (balance > 0) return 'text-rose-600';
            return 'text-blue-600';
        }

        function getExpenseBorderColor(balance) {
            balance = safeNum(balance);
            if (balance === 0) return 'border-emerald-500';
            if (balance > 0) return 'border-rose-500';
            return 'border-blue-500';
        }

        function openExpenseModal() {
            document.getElementById('expId').value = '';
            document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('expDesc').value = '';
            document.getElementById('expCat').value = 'سلع';

            // إعادة تعيين حقل الاستحقاق
            const dueDateField = document.getElementById('expDueDateField');
            const dueDateInput = document.getElementById('expDueDate');
            dueDateField.classList.add('hidden');

            // تعيين تاريخ افتراضي للاستحقاق (سيتم استخدامه عند اختيار شيك)
            const today = new Date();
            const defaultDueDate = new Date(today.setDate(today.getDate() + 30));
            dueDateInput.value = defaultDueDate.toISOString().split('T')[0];

            // تعيين قائمة الموردين
            const supplierSelect = document.getElementById('expSupplierSelect');
            supplierSelect.innerHTML = `<option value="">${t('select_supplier')}</option>`;
            supplierSelect.value = '';

            // تعبئة قائمة الموردين
            const suppliers = allData.clients.filter(c => c.type === 'supplier');
            suppliers.forEach(supplier => {
                supplierSelect.innerHTML += `<option value="${supplier.id}">${supplier.name}</option>`;
            });

            document.getElementById('expInvoiceNumber').value = '';
            document.getElementById('expPaymentRef').value = '';
            document.getElementById('expAmount').value = '';
            document.getElementById('expPaid').value = '';
            document.getElementById('expBalance').value = '';
            document.getElementById('expMethod').value = 'صندوق';

            // تحديث الحقول بناءً على الفئة
            updateExpenseFields();

            openModal('expenseModal');
            document.getElementById('expDesc').focus();
        }

        function updateExpenseFields() {
            const category = document.getElementById('expCat').value;
            const supplierGroup = document.getElementById('expSupplierGroup');
            const invoiceNumberGroup = document.getElementById('expInvoiceNumberGroup');
            const paymentRefGroup = document.getElementById('expPaymentRefGroup');

            if (category === 'سلع') {
                supplierGroup.classList.remove('hidden');
                invoiceNumberGroup.classList.remove('hidden');
                paymentRefGroup.classList.remove('hidden');

                // جعل الحقول إلزامية
                document.getElementById('expSupplierSelect').required = true;
                document.getElementById('expInvoiceNumber').required = true;
            } else {
                supplierGroup.classList.add('hidden');
                invoiceNumberGroup.classList.add('hidden');
                paymentRefGroup.classList.add('hidden');

                // إلغاء الإلزامية
                document.getElementById('expSupplierSelect').required = false;
                document.getElementById('expInvoiceNumber').required = false;
            }
        }

        function calcExpenseBalance() {
            const total = safeNum(document.getElementById('expAmount').value);
            const paid = safeNum(document.getElementById('expPaid').value);
            document.getElementById('expBalance').value = (total - paid).toFixed(2);
        }

        function saveExpense() {
            const cat = document.getElementById('expCat').value;
            const suppSelect = document.getElementById('expSupplierSelect');
            const saveBtn = document.getElementById('saveExpenseBtn');

            if (cat === 'سلع' && (!suppSelect.value || !document.getElementById('expInvoiceNumber').value)) {
                return showToast(t('supplier_invoice_required'), 'error');
            }

            const dueDate = document.getElementById('expDueDate')?.value || null;

            // Récupérer le nom du fournisseur
            let supplierName = t('unknown');
            let supplierId = '';

            if (suppSelect.value) {
                const supplier = allData.clients.find(c => c.id == suppSelect.value);
                if (supplier) {
                    supplierName = supplier.name;
                    supplierId = supplier.id;
                }
            }

            const exp = {
                id: document.getElementById('expId').value || 'EXP-' + Date.now().toString().slice(-6),
                date: document.getElementById('expDate').value,
                category: cat,
                description: document.getElementById('expDesc').value,
                supplier: supplierName,
                supplier_id: supplierId,
                invoice_number: document.getElementById('expInvoiceNumber').value,
                payment_reference: document.getElementById('expPaymentRef').value,
                due_date: dueDate,
                amount: safeNum(document.getElementById('expAmount').value),
                paid: safeNum(document.getElementById('expPaid').value),
                balance: safeNum(document.getElementById('expBalance').value),
                method: document.getElementById('expMethod').value
            };

            if (!exp.amount) return showToast(t('enter_amount'), 'error');
            if (exp.amount < 0) return showToast('المبلغ يجب أن يكون أكبر من صفر', 'error');

            setBtnLoading(saveBtn, true, t('saving'));

            // ========== MISE À JOUR LOCALE OPTIMISTE ==========

            // 1. Vérifier si la dépense existe déjà
            const existingExpenseIndex = allData.expenses.findIndex(e => e.id === exp.id);

            // 2. Sauvegarder la dépense localement
            if (existingExpenseIndex !== -1) {
                // Modification d'une dépense existante
                allData.expenses[existingExpenseIndex] = exp;
                console.log('📝 Modification de la dépense existante:', exp.id);
            } else {
                // Nouvelle dépense
                allData.expenses.unshift(exp);
                console.log('🆕 Création d\'une nouvelle dépense:', exp.id);
            }

            // 3. [--- GESTION DES CHÈQUES - SOLUTION FINALE ---]
            let newCheckRec = null;
            if (exp.method === 'شيك' || exp.method === 'كمبيالة') {

                // ÉTAPE 1: Supprimer TOUS les anciens chèques associés à cette dépense
                if (allData.checks_promissory && allData.checks_promissory.length > 0) {
                    const avant = allData.checks_promissory.length;
                    allData.checks_promissory = allData.checks_promissory.filter(c =>
                        !(String(c.debt_id) === String(exp.id) && c.debt_type === 'expense')
                    );
                    const apres = allData.checks_promissory.length;
                    if (avant !== apres) {
                        console.log(`🗑️ Suppression de ${avant - apres} ancien(s) chèque(s) pour dépense ${exp.id}`);
                    }
                }

                // ÉTAPE 2: Créer un NOUVEAU chèque (UN SEUL) si un montant est payé
                if (exp.paid > 0) {
                    console.log('🆕 Création d\'un nouveau chèque pour dépense:', exp.id);
                    newCheckRec = {
                        id: 'CHK-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                        reference: exp.payment_reference || '',
                        type: exp.method,
                        amount: exp.paid,
                        date: exp.date,
                        due_date: exp.due_date || exp.date,
                        status: 'pending',
                        client_name: exp.supplier,
                        debt_id: exp.id,
                        debt_type: 'expense'
                    };

                    if (!allData.checks_promissory) allData.checks_promissory = [];
                    allData.checks_promissory.unshift(newCheckRec);
                }

            } else {
                // Si la méthode de paiement n'est pas chèque, supprimer tous les chèques associés
                if (allData.checks_promissory && allData.checks_promissory.length > 0) {
                    const avant = allData.checks_promissory.length;
                    allData.checks_promissory = allData.checks_promissory.filter(c =>
                        !(String(c.debt_id) === String(exp.id) && c.debt_type === 'expense')
                    );
                    const apres = allData.checks_promissory.length;
                    if (avant !== apres) {
                        console.log(`🗑️ Suppression des chèques (méthode non-chèque) pour dépense ${exp.id}`);
                    }
                }
            }

            // 4. Gestion des paiements
            if (exp.paid > 0) {
                // Supprimer les anciens paiements
                if (allData.payments && allData.payments.length > 0) {
                    allData.payments = allData.payments.filter(p =>
                        !(String(p.debt_id) === String(exp.id) && p.debt_type === 'expense')
                    );
                }

                // Créer un nouveau paiement
                const payRec = {
                    id: 'PAY-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                    date: exp.date,
                    type: 'supplier',
                    client_id: exp.supplier_id || '',
                    client_name: exp.supplier,
                    method: exp.method,
                    reference: exp.payment_reference || '',
                    amount: exp.paid,
                    description: 'دفعة أولية - مصروف: ' + (exp.description || exp.category),
                    debt_id: exp.id,
                    debt_type: 'expense',
                    created_at: new Date().toISOString().split('T')[0]
                };

                if (!allData.payments) allData.payments = [];
                allData.payments.unshift(payRec);
            }

            // 5. Mise à jour immédiate de l'interface
            renderExpenses(getFilteredData(allData.expenses));
            renderDashboard(getFilteredData(allData.invoices), getFilteredData(allData.expenses));

            if (!document.getElementById('page-checks-promissory').classList.contains('hidden')) {
                renderChecksPromissory();
            }

            if (!document.getElementById('page-payments').classList.contains('hidden')) {
                renderPayments();
            }

            if (!document.getElementById('page-suppliers').classList.contains('hidden')) {
                renderSuppliers();
            }

            // Mettre à jour les alertes
            checkDueDateAlerts();

            showToast('✅ تم حفظ المصروف محلياً', 'success');

            // ========== ENVOI AU SERVEUR EN ARRIÈRE-PLAN ==========
            google.script.run
                .withSuccessHandler(() => {
                    console.log('✅ Synchronisation serveur réussie pour dépense:', exp.id);
                })
                .withFailureHandler((e) => {
                    console.error('❌ Échec synchronisation serveur:', e);
                    showToast('⚠️ فشلت المزامنة مع السيرفر، سيتم إعادة المحاولة', 'warning');
                    setTimeout(() => refreshData(), 2000);
                })
                .saveExpense(exp, existingExpenseIndex !== -1, currentDbId);

            if (newCheckRec) {
                google.script.run
                    .withSuccessHandler(() => {
                        console.log('✅ Synchronisation serveur réussie pour chèque/traite de dépense:', newCheckRec.id);
                    })
                    .withFailureHandler((e) => {
                        console.error('❌ Échec synchronisation chèque/traite de dépense:', e);
                    })
                    .saveCheckPromissory(newCheckRec, currentDbId);
            }

            setTimeout(() => setBtnLoading(saveBtn, false), 1000);
            closeModal('expenseModal');
        }

        function renderExpenses(fExps) {
            const container = document.getElementById('expensesContainer');
            const noExpensesMessage = document.getElementById('noExpensesMessage');
            container.innerHTML = '';

            if (fExps.length === 0) {
                container.classList.add('hidden');
                if (noExpensesMessage) noExpensesMessage.classList.remove('hidden');
                container.innerHTML = '';
                return;
            } else {
                container.classList.remove('hidden');
                if (noExpensesMessage) noExpensesMessage.classList.add('hidden');
            }

            fExps.forEach(exp => {
                const isDebt = safeNum(exp.balance) > 0;
                const borderColor = getExpenseBorderColor(exp.balance);
                const statusText = getExpenseStatus(exp.balance);
                const statusColor = getExpenseStatusColor(exp.balance);

                container.innerHTML += `
                <div class="expense-card ${borderColor}">
                    <div class="card-header">
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="font-black text-slate-800 text-sm mb-1 truncate">${exp.description}</h4>
                                <div class="flex items-center gap-2">
                                    <span class="bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full text-[8px] font-black">${translateExpenseCategory(exp.category)}</span>
                                    <span class="text-[9px] text-slate-400">${exp.date}</span>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="font-black text-slate-800 text-sm">${formatCurrency(exp.amount)}</p>
                                <p class="text-[9px] ${statusColor} font-bold">
                                    ${statusText}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-body">
                        ${exp.supplier ? `
                            <div class="mb-3">
                                <p class="text-[9px] text-slate-400 font-bold mb-1">${t('supplier')}</p>
                                <p class="text-xs font-bold text-slate-700">${exp.supplier === 'مورد غير معروف' || exp.supplier === 'غير معروف' ? t('unknown_supplier') : (exp.supplier || t('unknown'))}</p>
                            </div>
                        ` : ''}
                        
                        ${exp.invoice_number ? `
                            <div class="mb-3">
                                <p class="text-[9px] text-slate-400 font-bold mb-1">${t('invoice_number')}</p>
                                <p class="text-xs font-bold text-blue-600">${exp.invoice_number}</p>
                            </div>
                        ` : ''}
                        
                        ${exp.payment_reference ? `
                            <div class="mb-3">
                                <p class="text-[9px] text-slate-400 font-bold mb-1">${t('payment_reference')}</p>
                                <p class="text-xs font-bold text-emerald-600">${exp.payment_reference}</p>
                            </div>
                        ` : ''}
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-[9px] text-slate-400 mb-1">${t('paid')}</p>
                                <p class="text-xs font-bold text-emerald-600">${formatCurrency(exp.paid || 0)}</p>
                            </div>
                            <div>
                                <p class="text-[9px] text-slate-400 mb-1">${t('balance')}</p>
                                <p class="text-xs font-bold ${isDebt ? 'text-rose-600' : 'text-emerald-600'}">
                                    ${formatCurrency(exp.balance || 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-footer">
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="text-[9px] text-slate-400 mb-1">${t('payment_method')}</p>
                                <p class="text-xs font-bold text-slate-700">${translatePaymentMethod(exp.method || 'صندوق')}</p>
                            </div>
                            
                            <div class="flex gap-2">
                                <button onclick="editExpense('${exp.id}')" 
                                        class="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-200 transition-all"
                                        title="تعديل">
                                    <i class="fas fa-edit text-xs"></i>
                                </button>
                                <button onclick="promptDeleteExpense('${exp.id}')" 
                                        class="w-8 h-8 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center hover:bg-rose-200 transition-all"
                                        title="حذف">
                                    <i class="fas fa-trash text-xs"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            });
        }

        function promptDeleteExpense(id) {
            openConfirm({
                title: t('delete_expense_title'),
                msg: t('delete_expense_msg'),
                iconClass: "fas fa-trash",
                colorClass: "bg-rose-600",
                onConfirm: () => {
                    // إغلاق نافذة التأكيد فوراً
                    closeConfirm();

                    // البحث عن المصروف قبل الحذف
                    const exp = allData.expenses.find(e => String(e.id) === String(id));
                    if (!exp) {
                        showToast('المصروف غير موجود', 'error');
                        return;
                    }

                    console.log('=== بداية حذف المصروف ===');
                    console.log('المصروف:', exp.id, exp.description);
                    console.log('عدد الشيكات قبل الحذف:', allData.checks_promissory?.length || 0);

                    // 1. حذف الشيكات والكمبيالات المرتبطة محلياً
                    if (allData.checks_promissory && allData.checks_promissory.length > 0) {
                        const remainingChecks = [];

                        for (let i = 0; i < allData.checks_promissory.length; i++) {
                            const check = allData.checks_promissory[i];

                            if (!(String(check.debt_id) === String(id) && check.debt_type === 'expense')) {
                                remainingChecks.push(check);
                            } else {
                                console.log('حذف شيك مرتبط:', check.id, check.reference, check.amount);
                            }
                        }

                        allData.checks_promissory = remainingChecks;
                        console.log('عدد الشيكات بعد الحذف:', allData.checks_promissory.length);
                    }

                    // 2. حذف الدفعات المرتبطة محلياً
                    if (allData.payments && allData.payments.length > 0) {
                        const remainingPayments = [];

                        for (let i = 0; i < allData.payments.length; i++) {
                            const payment = allData.payments[i];

                            if (!(String(payment.debt_id) === String(id) && payment.debt_type === 'expense')) {
                                remainingPayments.push(payment);
                            } else {
                                console.log('حذف دفعة مرتبطة:', payment.id, payment.amount);
                            }
                        }

                        allData.payments = remainingPayments;
                        console.log('عدد الدفعات بعد الحذف:', allData.payments.length);
                    }

                    // 3. حذف المصروف نفسه من المصفوفة المحلية
                    const expenseIndex = allData.expenses.findIndex(e => String(e.id) === String(id));
                    if (expenseIndex !== -1) {
                        allData.expenses.splice(expenseIndex, 1);
                        console.log('تم حذف المصروف من المصفوفة المحلية');
                    }

                    // 4. تحديث الواجهات فوراً
                    renderExpenses(getFilteredData(allData.expenses));
                    renderDashboard(getFilteredData(allData.invoices), getFilteredData(allData.expenses));

                    // تحديث صفحة الشيكات إذا كانت مفتوحة
                    if (!document.getElementById('page-checks-promissory').classList.contains('hidden')) {
                        renderChecksPromissory();
                    }

                    // تحديث صفحة الدفعات إذا كانت مفتوحة
                    if (!document.getElementById('page-payments').classList.contains('hidden')) {
                        renderPayments();
                    }

                    // تحديث صفحة الموردين إذا كانت مفتوحة
                    if (!document.getElementById('page-suppliers').classList.contains('hidden')) {
                        renderSuppliers();
                    }

                    // تحديث التنبيهات
                    checkDueDateAlerts();

                    console.log('=== نهاية حذف المصروف ===');
                    console.log('عدد الشيكات النهائي:', allData.checks_promissory?.length || 0);

                    showToast('✅ تم حذف المصروف وجميع البيانات المرتبطة محلياً', 'success');

                    // 5. إرسال للسيرفر في الخلفية
                    google.script.run
                        .withSuccessHandler((response) => {
                            if (response && response.success) {
                                console.log('✅ تمت المزامنة مع السيرفر بنجاح');
                            } else {
                                console.warn('⚠️ فشلت المزامنة مع السيرفر:', response);
                            }
                        })
                        .withFailureHandler((e) => {
                            console.error('خطأ في الاتصال بالسيرفر:', e);
                        })
                        .deleteExpense(id, currentDbId);
                }
            });
        }

        function deleteExpense(id, dbId) {
            const ss = getDb(dbId);
            const sheet = ss.getSheetByName("Expenses");
            const data = sheet.getDataRange().getValues();

            for (let i = 1; i < data.length; i++) {
                if (data[i][0] == id) {

                    // حذف الشيكات والكمبيالات المرتبطة بهذا المصروف
                    const checkSheet = ss.getSheetByName("ChecksPromissory");
                    if (checkSheet) {
                        const checkData = checkSheet.getDataRange().getValues();
                        for (let k = checkData.length - 1; k >= 1; k--) {
                            // حذف إذا كان debt_id يطابق id المصروف و debt_type هو 'expense'
                            if (checkData[k][8] == id && checkData[k][9] == 'expense') {
                                checkSheet.deleteRow(k + 1);
                            }
                        }
                    }

                    // حذف الدفعات المرتبطة بالمصروف
                    const paySheet = ss.getSheetByName("Payments");
                    const payData = paySheet.getDataRange().getValues();
                    for (let j = payData.length - 1; j >= 1; j--) {
                        if (payData[j][9] == id && payData[j][10] == 'expense') {
                            paySheet.deleteRow(j + 1);
                        }
                    }

                    // حذف المصروف نفسه
                    sheet.deleteRow(i + 1);

                    return { success: true };
                }
            }
            return { success: false };
        }

        function editExpense(id) {
            const exp = allData.expenses.find(e => e.id == id);
            if (!exp) return;

            // تعبئة الحقول الأساسية
            document.getElementById('expId').value = exp.id;
            document.getElementById('expDate').value = exp.date;
            document.getElementById('expCat').value = exp.category;
            document.getElementById('expDesc').value = exp.description;
            document.getElementById('expAmount').value = exp.amount;
            document.getElementById('expPaid').value = exp.paid || 0;
            document.getElementById('expMethod').value = exp.method || 'صندوق';
            document.getElementById('expPaymentRef').value = exp.payment_reference || '';

            // [--- إصلاح المشكل: تعبئة تاريخ الاستحقاق وإظهار الحقل ---]
            if (exp.due_date) {
                document.getElementById('expDueDate').value = exp.due_date;
            } else {
                // تعيين تاريخ افتراضي (بعد 30 يوم) إذا لم يكن موجوداً
                const today = new Date();
                const dueDate = new Date(today.setDate(today.getDate() + 30));
                document.getElementById('expDueDate').value = dueDate.toISOString().split('T')[0];
            }

            // إظهار حقل تاريخ الاستحقاق إذا كانت طريقة الدفع شيك أو كمبيالة
            const dueDateField = document.getElementById('expDueDateField');
            if (exp.method === 'شيك' || exp.method === 'كمبيالة') {
                dueDateField.classList.remove('hidden');
            } else {
                dueDateField.classList.add('hidden');
            }
            // [--- نهاية الإصلاح ---]

            // تعبئة حقول المورد ورقم الفاتورة
            if (exp.supplier_id) {
                document.getElementById('expSupplierSelect').value = exp.supplier_id;
            } else {
                document.getElementById('expSupplierSelect').value = '';
            }

            document.getElementById('expInvoiceNumber').value = exp.invoice_number || '';

            // تحديث الحقول بناءً على الفئة
            updateExpenseFields();

            // حساب الرصيد
            calcExpenseBalance();

            // فتح النموذج
            openModal('expenseModal');
        }

        function calculateExpensesByCategory(expenses) {
            const categories = {};

            expenses.forEach(exp => {
                const category = exp.category || 'أخرى';

                if (!categories[category]) {
                    categories[category] = {
                        total: 0,
                        count: 0,
                        paid: 0,
                        balance: 0,
                        items: []
                    };
                }

                const amount = safeNum(exp.amount);
                const paid = safeNum(exp.paid);
                const balance = safeNum(exp.balance);

                categories[category].total += amount;
                categories[category].paid += paid;
                categories[category].balance += balance;
                categories[category].count++;

                categories[category].items.push({
                    id: exp.id,
                    date: exp.date,
                    description: exp.description || t('no_description'),
                    amount: amount,
                    paid: paid,
                    balance: balance,
                    supplier: exp.supplier || t('unknown_supplier'),
                    invoice_number: exp.invoice_number || t('no_number'),
                    payment_reference: exp.payment_reference || ''
                });
            });

            return categories;
        }

        function renderExpensesByCategory(categories) {
            const container = document.getElementById('expensesByCategory');
            if (!container) return;

            container.innerHTML = '';

            // إظهار القسم إذا كان موجوداً
            const section = document.getElementById('expensesDetailSection');
            if (section) section.classList.remove('hidden');

            const categoryKeys = Object.keys(categories);

            if (categoryKeys.length === 0) {
                container.innerHTML = `
            <div class="text-center p-8 text-slate-400">
                <i class="fas fa-wallet text-3xl mb-4"></i>
                <p class="font-bold">${t('no_expenses')}</p>
            </div>
        `;
                return;
            }

            const totalExpenses = Object.values(categories).reduce((sum, cat) => sum + cat.total, 0);

            categoryKeys.forEach((category, index) => {
                const cat = categories[category];
                const percentage = totalExpenses > 0 ? Math.round((cat.total / totalExpenses) * 100) : 0;

                // ألوان مختلفة لكل فئة
                const colors = [
                    { bg: 'bg-rose-500', text: 'text-rose-600', border: 'border-rose-500' },
                    { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-500' },
                    { bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-500' },
                    { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-500' },
                    { bg: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-500' },
                    { bg: 'bg-cyan-500', text: 'text-cyan-600', border: 'border-cyan-500' }
                ];

                const color = colors[index % colors.length];

                container.innerHTML += `
            <div class="expense-category-summary ${color.border}">
                <div class="category-header" style="cursor: default;">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 ${color.bg} bg-opacity-20 rounded-xl flex items-center justify-center">
                            <i class="fas fa-tag ${color.text}"></i>
                        </div>
                        <div>
                            <h5 class="font-bold text-slate-800">${translateExpenseCategory(category)}</h5>
                            <p class="text-[9px] text-slate-400">${cat.count} ${t('expense_word') || 'Dépense'} | ${t('paid_word')}: ${formatCurrency(cat.paid)}</p>
                        </div>
                    </div>
                    <div class="text-left">
                        <p class="font-black text-slate-800">${formatCurrency(cat.total)}</p>
                        <div class="flex items-center gap-2 mt-1">
                            <div class="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div class="h-full ${color.bg} rounded-full" style="width: ${percentage}%"></div>
                            </div>
                            <span class="text-[8px] text-slate-500 font-black">${percentage}%</span>
                        </div>
                    </div>
                </div>
                
                <div id="category-${index}" class="category-details !hidden" style="display: none !important;">
                    ${cat.items.map(item => `
                        <div class="expense-item-detail">
                            <div>
                                <p class="font-bold text-xs text-slate-700">${item.description}</p>
                                <p class="text-[9px] text-slate-500">${item.date} • ${item.supplier}</p>
                                ${item.invoice_number && item.invoice_number !== t('no_number') ? `<p class="text-[8px] text-blue-600 font-bold">${t('invoice_label')}: ${item.invoice_number}</p>` : ''}
                                ${item.payment_reference ? `<p class="text-[8px] text-emerald-600 font-bold">${t('reference_label')}: ${item.payment_reference}</p>` : ''}
                            </div>
                            <div class="text-left">
                                <p class="font-black ${color.text}">${formatCurrency(item.amount)}</p>
                                <p class="text-[8px] text-slate-400">${t('paid_word')}: ${formatCurrency(item.paid)}</p>
                                ${item.balance > 0 ? `<p class="text-[8px] text-rose-500">${t('remaining_word')}: ${formatCurrency(item.balance)}</p>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
            });

            // إضافة ملخص المصاريف
            const totalPaid = Object.values(categories).reduce((sum, cat) => sum + cat.paid, 0);
            const totalBalance = Object.values(categories).reduce((sum, cat) => sum + cat.balance, 0);

            container.innerHTML += `
        <div class="bg-slate-900 p-4 rounded-2xl text-white mt-4">
            <div class="flex justify-between items-center mb-2">
                <div>
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">${t('total_expenses_label')}</p>
                    <h4 class="text-xl font-black text-emerald-400">${formatCurrency(totalExpenses)}</h4>
                </div>
                <div class="text-center">
                    <p class="text-[8px] text-slate-400 mb-1">${t('categories_count')}</p>
                    <p class="text-lg font-black">${categoryKeys.length}</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div class="bg-slate-800 p-2 rounded-lg text-center">
                    <p class="text-[8px] text-slate-400">${t('paid_word')}</p>
                    <p class="font-black text-emerald-400">${formatCurrency(totalPaid)}</p>
                </div>
                <div class="bg-slate-800 p-2 rounded-lg text-center">
                    <p class="text-[8px] text-slate-400">${t('remaining_word')}</p>
                    <p class="font-black text-amber-400">${formatCurrency(totalBalance)}</p>
                </div>
            </div>
        </div>
    `;
        }
