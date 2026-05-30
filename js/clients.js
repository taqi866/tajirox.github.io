        function translatePaymentMethod(method) {
            if (!method || typeof method !== 'string') return method;
            if (method === 'صندوق') return t('cash') || method;
            if (method === 'شيك') return t('check') || method;
            if (method.includes('تحويل')) return t('transfer') || method;
            if (method === 'كمبيالة') return t('promissory') || method;
            if (method === 'دين') return t('debt') || method;
            return method;
        }

        function toggleSettleDueDateField() {
            const method = document.getElementById('settlePaymentMethod').value;
            const dueDateField = document.getElementById('settleDueDateField');

            if (method === 'شيك' || method === 'كمبيالة') {
                dueDateField.classList.remove('hidden');
                // تعيين تاريخ افتراضي (بعد 30 يوم)
                const today = new Date();
                const dueDate = new Date(today.setDate(today.getDate() + 30));
                document.getElementById('settleDueDate').value = dueDate.toISOString().split('T')[0];
            } else {
                dueDateField.classList.add('hidden');
                document.getElementById('settleDueDate').value = '';
            }
        }

        function toggleSettleDueDateField() {
            const method = document.getElementById('settlePaymentMethod').value;
            const dueDateField = document.getElementById('settleDueDateField');

            if (method === 'شيك' || method === 'كمبيالة') {
                dueDateField.classList.remove('hidden');
                const today = new Date();
                const dueDate = new Date(today.setDate(today.getDate() + 30));
                document.getElementById('settleDueDate').value = dueDate.toISOString().split('T')[0];
            } else {
                dueDateField.classList.add('hidden');
                document.getElementById('settleDueDate').value = '';
            }
        }

        function openSettleDebtModal(type, id) {
            if (type === 'invoice') {
                const inv = allData.invoices.find(i => String(i.id) === String(id));
                if (!inv) return;

                document.getElementById('settleDebtId').value = inv.id;
                document.getElementById('settleDebtType').value = 'invoice';
                document.getElementById('settleOriginalBalance').value = inv.balance;
                document.getElementById('settleDebtCustomer').innerText = inv.customer;
                document.getElementById('settleDebtAmount').innerText = formatCurrency(inv.balance);
                document.getElementById('settleDebtDetails').innerHTML = `
                    ${t('invoice')} #${inv.id} • ${inv.date}<br>
                    ${inv.type || t('sale_word')} • ${inv.payment_method || t('cash_box')}
                    ${inv.payment_reference ? `<br>${t('payment_reference')}: ${inv.payment_reference}` : ''}
                `;

            } else if (type === 'expense') {
                const exp = allData.expenses.find(e => String(e.id) === String(id));
                if (!exp) return;

                document.getElementById('settleDebtId').value = exp.id;
                document.getElementById('settleDebtType').value = 'expense';
                document.getElementById('settleOriginalBalance').value = exp.balance;

                // الحصول على اسم المورد
                let supplierName = exp.supplier || t('unknown');
                if (exp.supplier_id && allData.clients) {
                    const supplier = allData.clients.find(c => c.id === exp.supplier_id);
                    if (supplier) {
                        supplierName = supplier.name;
                    }
                }

                document.getElementById('settleDebtCustomer').innerText = supplierName;
                document.getElementById('settleDebtAmount').innerText = formatCurrency(exp.balance);
                document.getElementById('settleDebtDetails').innerHTML = `
                    ${t('expense')} • ${exp.date}<br>
                    ${translateExpenseCategory(exp.category)} • ${translatePaymentMethod(exp.method || 'صندوق')}
                    ${exp.invoice_number ? `<br>${t('invoice')}: ${exp.invoice_number}` : ''}
                    ${exp.payment_reference ? `<br>${t('payment_reference')}: ${exp.payment_reference}` : ''}
                `;
            }

            // تعيين التاريخ الحالي
            document.getElementById('settleDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('settleAmount').value = '';
            document.getElementById('settlePaymentMethod').value = t('cash_box');
            document.getElementById('settlePaymentReference').value = '';

            openModal('settleDebtModal');
            closeModal('clientDebtsListModal'); // إغلاق قائمة الديون إذا كانت مفتوحة
            document.getElementById('settleAmount').focus();
        }

        function confirmSettleDebt() {
            const type = document.getElementById('settleDebtType').value;
            const id = document.getElementById('settleDebtId').value;
            const amt = safeNum(document.getElementById('settleAmount').value);
            const date = document.getElementById('settleDate').value;
            const method = document.getElementById('settlePaymentMethod').value;
            const ref = document.getElementById('settlePaymentReference').value.trim();
            const dueDate = document.getElementById('settleDueDate')?.value || null;
            const confirmBtn = document.getElementById('confirmSettleBtn');

            if (amt <= 0) return showToast(t('enter_valid_qty'), 'error');
            if (!date) return showToast(t('fill_fields_error'), 'error');

            // التحقق من وجود مرجع الأداء للشيكات والكمبيالات
            if ((method === 'شيك' || method === 'كمبيالة') && !ref) {
                return showToast(t('enter_ref_error'), 'error');
            }

            // التحقق من وجود تاريخ استحقاق للشيكات والكمبيالات
            if ((method === 'شيك' || method === 'كمبيالة') && !dueDate) {
                return showToast(t('enter_due_date_error'), 'error');
            }

            // 1. التحديث المحلي
            let clientName = '';
            let clientId = '';

            if (type === 'invoice') {
                const inv = allData.invoices.find(i => String(i.id) === String(id));
                if (inv) {
                    if (amt > safeNum(inv.balance)) return showToast(t('max_limit_reached'), 'error');

                    inv.paid = safeNum(inv.paid) + amt;
                    inv.balance = safeNum(inv.balance) - amt;

                    clientName = inv.customer;
                    clientId = inv.customer_id;
                }
            } else {
                const exp = allData.expenses.find(e => String(e.id) === String(id));
                if (exp) {
                    if (amt > safeNum(exp.balance)) return showToast(t('max_limit_reached'), 'error');

                    exp.paid = safeNum(exp.paid) + amt;
                    exp.balance = safeNum(exp.balance) - amt;

                    clientName = exp.supplier || exp.description;
                    clientId = exp.supplier_id;
                }
            }

            // إنشاء الدفعة
            const payRec = {
                id: 'PAY-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 1000),
                date: date,
                type: type === 'invoice' ? 'customer' : 'supplier',
                client_id: clientId || '',
                client_name: clientName,
                method: method,
                reference: ref,
                amount: amt,
                description: t('settle_btn'),
                debt_id: id,
                debt_type: type,
                created_at: new Date().toISOString().split('T')[0]
            };

            if (!allData.payments) allData.payments = [];
            allData.payments.unshift(payRec);

            // إضافة إلى سجل الشيكات والكمبيالات (إذا كانت طريقة الدفع شيك أو كمبيالة)
            if (method === 'شيك' || method === 'كمبيالة') {
                const checkRec = {
                    id: 'CHK-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                    reference: ref,
                    type: method,
                    amount: amt,
                    date: date,
                    due_date: dueDate,
                    status: 'pending',
                    client_name: clientName,
                    debt_id: id,
                    debt_type: type
                };

                if (!allData.checks_promissory) allData.checks_promissory = [];
                allData.checks_promissory.unshift(checkRec);

                // تحديث صفحة الشيكات إذا كانت مفتوحة
                if (!document.getElementById('page-checks-promissory').classList.contains('hidden')) {
                    renderChecksPromissory();
                }

                // تحديث التنبيهات
                checkDueDateAlerts();
            }

            // تحديث الواجهات
            setBtnLoading(confirmBtn, true, t('settling_word') + '...');

            if (!document.getElementById('page-payments').classList.contains('hidden')) renderPayments();
            if (!document.getElementById('page-invoices').classList.contains('hidden')) renderInvoices(getFilteredData(allData.invoices));
            if (!document.getElementById('page-expenses').classList.contains('hidden')) renderExpenses(getFilteredData(allData.expenses));
            if (!document.getElementById('page-clients').classList.contains('hidden')) renderClients();
            if (!document.getElementById('page-suppliers').classList.contains('hidden')) renderSuppliers();

            closeModal('settleDebtModal');
            setTimeout(() => setBtnLoading(confirmBtn, false), 500);
            showToast(t('settle_debt_local'), 'info');

            // إرسال للسيرفر
            google.script.run
                .withSuccessHandler(() => { })
                .withFailureHandler((e) => console.error(e))
                .savePaymentRecord(payRec, currentDbId);

            if (method === 'شيك' || method === 'كمبيالة') {
                const newCheck = allData.checks_promissory[0];
                if (newCheck) {
                    google.script.run
                        .withSuccessHandler(() => { })
                        .withFailureHandler((e) => console.error(e))
                        .saveCheckPromissory(newCheck, currentDbId);
                }
            }

            if (type === 'invoice') {
                const invoice = allData.invoices.find(i => String(i.id) === String(id));
                if (invoice) {
                    google.script.run
                        .withSuccessHandler(() => { })
                        .withFailureHandler((e) => console.error(e))
                        .saveInvoice(invoice, true, currentDbId);
                }
            } else {
                const expense = allData.expenses.find(e => String(e.id) === String(id));
                if (expense) {
                    google.script.run
                        .withSuccessHandler(() => { })
                        .withFailureHandler((e) => console.error(e))
                        .saveExpense(expense, true, currentDbId);
                }
            }
        }

        function openSettleAllDebtsModal() {
            if (!currentDebtClient || currentDebtClient.type !== 'customer') return;

            const debts = allData.invoices.filter(i => i.customer_id === currentDebtClient.id && safeNum(i.balance) > 0);
            const totalDebt = debts.reduce((sum, d) => sum + safeNum(d.balance), 0);

            document.getElementById('settleAllCustomerName').innerText = currentDebtClient.name;
            document.getElementById('settleAllTotalAmount').innerText = formatCurrency(totalDebt);
            document.getElementById('settleAllInvoicesCount').innerText = `${t('unpaid_invoices_count')}: ${debts.length}`;

            document.getElementById('settleAllDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('settleAllPaymentMethod').value = t('cash_box');
            document.getElementById('settleAllPaymentReference').value = '';
            document.getElementById('settleAllAmount').value = totalDebt;

            toggleSettleAllDueDateField();
            openModal('settleAllDebtsModal');
        }

        function toggleSettleAllDueDateField() {
            const method = document.getElementById('settleAllPaymentMethod').value;
            const dueDateField = document.getElementById('settleAllDueDateField');
            if (method === 'شيك' || method === 'كمبيالة') {
                dueDateField.classList.remove('hidden');
                const today = new Date();
                const dueDate = new Date(today.setDate(today.getDate() + 30));
                document.getElementById('settleAllDueDate').value = dueDate.toISOString().split('T')[0];
            } else {
                dueDateField.classList.add('hidden');
                document.getElementById('settleAllDueDate').value = '';
            }
        }

        function confirmSettleAllDebts() {
            if (!currentDebtClient) return;

            const date = document.getElementById('settleAllDate').value;
            const method = document.getElementById('settleAllPaymentMethod').value;
            const ref = document.getElementById('settleAllPaymentReference').value.trim();
            const dueDate = document.getElementById('settleAllDueDate')?.value || null;
            const confirmBtn = document.getElementById('confirmSettleAllBtn');

            if (!date) return showToast(t('fill_fields_error'), 'error');
            if ((method === 'شيك' || method === 'كمبيالة') && !ref) return showToast(t('enter_ref_error'), 'error');
            if ((method === 'شيك' || method === 'كمبيالة') && !dueDate) return showToast(t('enter_due_date_error'), 'error');

            const debts = allData.invoices.filter(i => i.customer_id === currentDebtClient.id && safeNum(i.balance) > 0);
            const totalAmount = safeNum(document.getElementById('settleAllAmount').value);

            if (debts.length === 0) return showToast(t('no_debts_to_settle'), 'error');

            setBtnLoading(confirmBtn, true, t('settling_word') + '...');
            const paymentId = 'PAY-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 1000);
            printConsolidatedDebtInvoice(debts, currentDebtClient.name, totalAmount, paymentId, date, method, ref);

            let paymentsToCreate = [];
            let checksToCreate = [];

            if (method === 'شيك' || method === 'كمبيالة') {
                checksToCreate.push({
                    id: 'CHK-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                    reference: ref, type: method, amount: totalAmount, date: date,
                    due_date: dueDate, status: 'pending', client_name: currentDebtClient.name,
                    debt_id: debts[0].id, debt_type: 'invoice'
                });
            }

            const updatedInvoices = [];
            debts.forEach((inv, index) => {
                const balance = safeNum(inv.balance);
                inv.paid = safeNum(inv.paid) + balance;
                inv.balance = 0;
                updatedInvoices.push(inv);

                paymentsToCreate.push({
                    id: paymentId + '-' + index, date: date, type: 'customer',
                    client_id: currentDebtClient.id, client_name: currentDebtClient.name,
                    method: method, reference: ref, amount: balance,
                    description: `${t('total_settlement')} - ${t('from_total')} ${formatCurrency(totalAmount)}`,
                    debt_id: inv.id, debt_type: 'invoice', created_at: new Date().toISOString().split('T')[0]
                });
            });

            if (!allData.payments) allData.payments = [];
            allData.payments.unshift(...paymentsToCreate);
            if (checksToCreate.length > 0) {
                if (!allData.checks_promissory) allData.checks_promissory = [];
                allData.checks_promissory.unshift(...checksToCreate);
            }

            if (!document.getElementById('page-payments').classList.contains('hidden')) renderPayments();
            if (!document.getElementById('page-invoices').classList.contains('hidden')) renderInvoices(getFilteredData(allData.invoices));
            if (!document.getElementById('page-clients').classList.contains('hidden')) renderClients();
            renderClientDebtsPage();

            closeModal('settleAllDebtsModal');
            setTimeout(() => setBtnLoading(confirmBtn, false), 500);
            showToast(t('settle_all_success'), 'success');

            google.script.run.withFailureHandler(e => console.error('خطأ في مزامنة التسديد الكلي:', e))
                .settleMultipleInvoices(updatedInvoices, paymentsToCreate, checksToCreate, currentDbId);
        }

        function calculateCustomerSummary(invoices) {
            const summary = {};

            invoices.forEach(inv => {
                const customer = inv.customer || t('general_customer');

                if (!summary[customer]) {
                    summary[customer] = {
                        total: 0,
                        paid: 0,
                        balance: 0,
                        count: 0
                    };
                }

                summary[customer].total += safeNum(inv.total);
                summary[customer].paid += safeNum(inv.paid);
                summary[customer].balance += safeNum(inv.balance);
                summary[customer].count++;
            });

            return summary;
        }

        function calculateSupplierSummary(expenses) {
            const summary = {};

            expenses.forEach(exp => {
                const supplier = exp.supplier || exp.description || t('unknown_supplier');

                if (!summary[supplier]) {
                    summary[supplier] = {
                        total: 0,
                        paid: 0,
                        balance: 0,
                        count: 0
                    };
                }

                summary[supplier].total += safeNum(exp.amount);
                summary[supplier].paid += safeNum(exp.paid);
                summary[supplier].balance += safeNum(exp.balance);
                summary[supplier].count++;
            });

            return summary;
        }

        function showClientPayments(id, name, type) {
            currentPaymentClient = { id, name, type };
            document.getElementById('paymentsPageSubtitle').innerText = name;

            // تصفير البحث والفلترة لضمان ظهور دفعات هذا العميل فقط بشكل صحيح
            document.getElementById('paymentSearch').value = '';
            document.getElementById('paymentTypeFilter').value = '';
            document.getElementById('paymentMethodFilter').value = '';

            // إخفاء فلتر نوع الدفعات لأنه معروف مسبقاً (زبون أو مورد)
            document.getElementById('paymentTypeFilter').parentElement.classList.add('hidden');

            // تصفية وعرض الدفوعات
            renderPayments();
            showPage('payments');
        }

        function goBackFromPayments() {
            if (currentPaymentClient && currentPaymentClient.type === 'supplier') {
                showPage('suppliers');
            } else {
                showPage('clients');
            }
            currentPaymentClient = null;
        }

        function showClientDebts(id, name, type) {
            currentDebtClient = { id, name, type };
            document.getElementById('debtsPageSubtitle').innerText = name;
            document.getElementById('debtsPageTitle').innerText = type === 'customer' ? t('customer_debts_title') : t('supplier_debts_us');

            renderClientDebtsPage();
            showPage('debts');
        }

        function renderClientDebtsPage() {
            const container = document.getElementById('debtsPageContainer');
            container.innerHTML = '';

            if (!currentDebtClient) return;

            let debts = [];
            let totalDebt = 0;
            if (currentDebtClient.type === 'customer') {
                debts = allData.invoices.filter(i => i.customer_id === currentDebtClient.id && safeNum(i.balance) > 0);
                debts.forEach(d => totalDebt += safeNum(d.balance));
            } else {
                debts = allData.expenses.filter(e => e.supplier_id === currentDebtClient.id && safeNum(e.balance) > 0);
                debts.forEach(d => totalDebt += safeNum(d.balance));
            }

            if (debts.length === 0) {
                container.innerHTML = `
                    <div class="text-center p-8 bg-white rounded-[2rem] shadow-sm">
                        <i class="fas fa-check-circle text-4xl text-emerald-200 mb-4"></i>
                        <p class="text-slate-400 font-bold">${t('no_debts')}</p>
                    </div>
                `;
            } else {
                debts.forEach(d => {
                    const debtId = d.id;
                    const date = d.date;
                    const amount = safeNum(d.balance);
                    const total = currentDebtClient.type === 'customer' ? safeNum(d.total) : safeNum(d.amount);

                    container.innerHTML += `
                        <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center hover:shadow-md transition-all">
                            <div>
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-black">
                                        ${currentDebtClient.type === 'customer' ? t('invoice') : t('expense')} #${debtId}
                                    </span>
                                    <span class="text-[10px] text-slate-400">${date}</span>
                                </div>
                                <p class="text-xs text-slate-500 font-bold">${t('total')}: ${formatCurrency(total)}</p>
                            </div>
                            <div class="text-left">
                                <p class="font-black text-rose-600 text-lg mb-1">${formatCurrency(amount)}</p>
                                <button onclick="openSettleDebtModal('${currentDebtClient.type === 'customer' ? 'invoice' : 'expense'}', '${debtId}')" 
                                        class="bg-emerald-100 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-emerald-200 transition-all shadow-sm">
                                    ${t('settle_btn')}
                                </button>
                            </div>
                        </div>
                    `;
                });
            }
        }

        function goBackFromDebts() {
            if (currentDebtClient && currentDebtClient.type === 'supplier') {
                showPage('suppliers');
            } else {
                showPage('clients');
            }
            currentDebtClient = null;
        }

        function openClientModal(type) {
            document.getElementById('clientId').value = '';
            document.getElementById('clientType').value = type;

            if (type === 'customer') {
                document.getElementById('clientModalTitle').innerText = t('add_customer_title');
            } else {
                document.getElementById('clientModalTitle').innerText = t('add_supplier_title');
            }

            document.getElementById('clientName').value = '';
            document.getElementById('clientPhone').value = '';
            document.getElementById('clientEmail').value = '';
            document.getElementById('clientIce').value = '';
            document.getElementById('clientAddress').value = '';
            document.getElementById('clientNotes').value = '';
            // تم إزالة حقول الرصيد الافتتاحي بناءً على طلبك

            openModal('clientModal');
            document.getElementById('clientName').focus();
        }

        function saveClient() {
            const type = document.getElementById('clientType').value;
            const client = {
                id: document.getElementById('clientId').value || 'CLI-' + Date.now().toString().slice(-6),
                type: type,
                name: document.getElementById('clientName').value.trim(),
                phone: document.getElementById('clientPhone').value,
                email: document.getElementById('clientEmail').value,
                ice: document.getElementById('clientIce').value.trim(),
                address: document.getElementById('clientAddress').value,
                notes: document.getElementById('clientNotes').value,
                created_at: new Date().toISOString().split('T')[0]
            };
            const saveBtn = document.getElementById('saveClientBtn');

            if (!client.name) return showToast(t('enter_name'), 'error');

            setBtnLoading(saveBtn, true, t('saving'));
            performOptimisticAction('clients', client, false,
                () => {
                    if (type === 'customer') renderClients(); else renderSuppliers();
                    updateClientLists();
                    setBtnLoading(saveBtn, false);
                },
                (runner) => runner.saveClient(client, !!document.getElementById('clientId').value, currentDbId)
            );
            setTimeout(() => setBtnLoading(saveBtn, false), 1000);
            closeModal('clientModal');
        }

        function editClient(id) {
            const client = allData.clients.find(c => c.id == id);
            if (!client) return;

            document.getElementById('clientId').value = client.id;
            document.getElementById('clientType').value = client.type;

            if (client.type === 'customer') {
                document.getElementById('clientModalTitle').innerText = t('edit') + ' ' + t('customer');
            } else {
                document.getElementById('clientModalTitle').innerText = t('edit') + ' ' + t('supplier');
            }

            document.getElementById('clientName').value = client.name || '';
            document.getElementById('clientPhone').value = client.phone || '';
            document.getElementById('clientEmail').value = client.email || '';
            document.getElementById('clientIce').value = client.ice || '';
            document.getElementById('clientAddress').value = client.address || '';
            document.getElementById('clientNotes').value = client.notes || '';

            openModal('clientModal');
        }

        function promptDeleteClient(id, name) {
            openConfirm({
                title: t('delete_client_title'),
                msg: t('delete_client_msg') + ` "${name}"?`,
                iconClass: "fas fa-trash", colorClass: "bg-rose-600",
                onConfirm: () => {
                    const c = allData.clients.find(x => x.id == id);
                    const type = c ? c.type : 'customer';

                    performOptimisticAction('clients', id, true,
                        () => {
                            if (type === 'customer') renderClients(); else renderSuppliers();
                            updateClientLists();
                        },
                        (runner) => runner.deleteClient(id, currentDbId)
                    );
                }
            });
        }

        function renderClients(filteredClients = null, limit = 10) {
            const container = document.getElementById('clientsContainer');
            const noClientsMessage = document.getElementById('noClientsMessage');

            if (!container) return;

            container.innerHTML = '';

            const clients = filteredClients || allData.clients.filter(c => c.type === 'customer');

            if (clients.length === 0) {
                container.classList.add('hidden');
                if (noClientsMessage) noClientsMessage.classList.remove('hidden');
                return;
            } else {
                container.classList.remove('hidden');
                if (noClientsMessage) noClientsMessage.classList.add('hidden');
            }

            const itemsToShow = clients.slice(0, limit);

            itemsToShow.forEach(client => {
                const totalDebt = calculateClientDebt(client.id);
                const hasDebt = totalDebt > 0;

                container.innerHTML += `
                <div class="customer-supplier-card customer-card">
                    <div class="card-header">
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="font-black text-slate-800 text-sm mb-1 truncate">${client.name}</h4>
                                <div class="flex items-center gap-2">
                                    <span class="text-[9px] text-slate-400">${client.phone || t('none')}</span>
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="debt-badge ${hasDebt ? 'debt-active' : 'debt-settled'}">
                                    ${hasDebt ? formatCurrency(totalDebt) : t('safe_status')}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-body">
                        <div class="mb-3">
                            <p class="text-[9px] text-slate-400 font-bold mb-1">${t('email_placeholder')}</p>
                            <p class="text-xs font-bold text-slate-700 truncate">${client.email || t('none')}</p>
                        </div>
                        
                        ${client.ice ? `
                        <div class="mb-3">
                            <p class="text-[9px] text-slate-400 font-bold mb-1">${t('ice_label')}</p>
                            <p class="text-xs font-bold text-slate-700 truncate">${client.ice}</p>
                        </div>
                        ` : ''}
                        
                        <div class="mb-3">
                            <p class="text-[9px] text-slate-400 font-bold mb-1">${t('address_label')}</p>
                            <p class="text-xs font-bold text-slate-700 truncate">${client.address || t('none')}</p>
                        </div>
                        
                        ${client.notes ? `
                            <div>
                                <p class="text-[9px] text-slate-400 font-bold mb-1">${t('notes_label')}</p>
                                <p class="text-xs text-slate-600 truncate">${client.notes}</p>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="card-footer">
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="text-[9px] text-slate-400 mb-1">${t('reg_date')}</p>
                                <p class="text-xs font-bold text-slate-700">${client.created_at || t('unknown')}</p>
                            </div>
                            
                            <div class="flex gap-2">
                                <button onclick="showClientPayments('${client.id}', '${client.name}', 'customer')" 
                                        class="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center hover:bg-purple-200 transition-all"
                                        title="${t('payments_log')}">
                                    <i class="fas fa-history text-xs"></i>
                                </button>
                                <button onclick="showClientDebts('${client.id}', '${client.name}', 'customer')" 
                                        class="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-200 transition-all"
                                        title="${t('view_debts')}">
                                    <i class="fas fa-file-invoice-dollar text-xs"></i>
                                </button>
                                <button onclick="editClient('${client.id}')" 
                                        class="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-200 transition-all"
                                        title="${t('edit')}">
                                    <i class="fas fa-edit text-xs"></i>
                                </button>
                                <button onclick="promptDeleteClient('${client.id}', '${client.name}')" 
                                        class="w-8 h-8 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center hover:bg-rose-200 transition-all"
                                        title="${t('delete')}">
                                    <i class="fas fa-trash text-xs"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            });

            if (clients.length > limit) {
                container.innerHTML += `
                <div class="col-span-full text-center py-4">
                    <p class="text-slate-400 text-xs font-bold mb-2">${t('search_results_stats', { filtered: limit, total: clients.length })}</p>
                    <p class="text-slate-300 text-[10px]">${t('use_search_hint')}</p>
                </div>`;
            }
        }

        function renderSuppliers(filteredSuppliers = null, limit = 10) {
            const container = document.getElementById('suppliersContainer');
            const noSuppliersMessage = document.getElementById('noSuppliersMessage');

            if (!container) return;

            container.innerHTML = '';

            const suppliers = filteredSuppliers || allData.clients.filter(c => c.type === 'supplier');

            if (suppliers.length === 0) {
                container.classList.add('hidden');
                if (noSuppliersMessage) noSuppliersMessage.classList.remove('hidden');
                return;
            } else {
                container.classList.remove('hidden');
                if (noSuppliersMessage) noSuppliersMessage.classList.add('hidden');
            }

            const itemsToShow = suppliers.slice(0, limit);

            itemsToShow.forEach(supplier => {
                const totalDebt = calculateSupplierDebt(supplier.id);
                const hasDebt = totalDebt > 0;

                container.innerHTML += `
                <div class="customer-supplier-card supplier-card">
                    <div class="card-header">
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="font-black text-slate-800 text-sm mb-1 truncate">${supplier.name}</h4>
                                <div class="flex items-center gap-2">
                                    <span class="text-[9px] text-slate-400">${supplier.phone || t('none')}</span>
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="debt-badge ${hasDebt ? 'debt-active' : 'debt-settled'}">
                                    ${hasDebt ? formatCurrency(totalDebt) : t('safe_status')}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-body">
                        <div class="mb-3">
                            <p class="text-[9px] text-slate-400 font-bold mb-1">${t('email_placeholder')}</p>
                            <p class="text-xs font-bold text-slate-700 truncate">${supplier.email || t('none')}</p>
                        </div>
                        
                        ${supplier.ice ? `
                        <div class="mb-3">
                            <p class="text-[9px] text-slate-400 font-bold mb-1">${t('ice_label')}</p>
                            <p class="text-xs font-bold text-slate-700 truncate">${supplier.ice}</p>
                        </div>
                        ` : ''}
                        
                        <div class="mb-3">
                            <p class="text-[9px] text-slate-400 font-bold mb-1">${t('address_label')}</p>
                            <p class="text-xs font-bold text-slate-700 truncate">${supplier.address || t('none')}</p>
                        </div>
                        
                        ${supplier.notes ? `
                            <div>
                                <p class="text-[9px] text-slate-400 font-bold mb-1">${t('notes_label')}</p>
                                <p class="text-xs text-slate-600 truncate">${supplier.notes}</p>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="card-footer">
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="text-[9px] text-slate-400 mb-1">${t('reg_date')}</p>
                                <p class="text-xs font-bold text-slate-700">${supplier.created_at || t('unknown')}</p>
                            </div>
                            
                            <div class="flex gap-2">
                                <button onclick="showClientPayments('${supplier.id}', '${supplier.name}', 'supplier')" 
                                        class="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center hover:bg-purple-200 transition-all"
                                        title="${t('payments_log')}">
                                    <i class="fas fa-history text-xs"></i>
                                </button>
                                <button onclick="showClientDebts('${supplier.id}', '${supplier.name}', 'supplier')" 
                                        class="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-200 transition-all"
                                        title="${t('view_debts')}">
                                    <i class="fas fa-file-invoice-dollar text-xs"></i>
                                </button>
                                <button onclick="editClient('${supplier.id}')" 
                                        class="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-200 transition-all"
                                        title="${t('edit')}">
                                    <i class="fas fa-edit text-xs"></i>
                                </button>
                                <button onclick="promptDeleteClient('${supplier.id}', '${supplier.name}')" 
                                        class="w-8 h-8 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center hover:bg-rose-200 transition-all"
                                        title="${t('delete')}">
                                    <i class="fas fa-trash text-xs"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            });

            if (suppliers.length > limit) {
                container.innerHTML += `
                <div class="col-span-full text-center py-4">
                    <p class="text-slate-400 text-xs font-bold mb-2">${t('search_results_stats', { filtered: limit, total: suppliers.length })}</p>
                    <p class="text-slate-300 text-[10px]">${t('use_search_hint')}</p>
                </div>`;
            }
        }

        function searchClients() {
            const searchTerm = document.getElementById('clientSearch').value.toLowerCase();
            const clients = allData.clients.filter(c => c.type === 'customer');
            const container = document.getElementById('clientsContainer');

            const filteredClients = clients.filter(client =>
                client.name.toLowerCase().includes(searchTerm) ||
                (client.phone && client.phone.includes(searchTerm)) ||
                (client.email && client.email.toLowerCase().includes(searchTerm))
            );

            if (filteredClients.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center p-8 bg-white rounded-[2rem] shadow-sm">
                        <i class="fas fa-search text-3xl text-slate-300 mb-3"></i>
                        <p class="text-slate-400 font-bold">${t('no_results_for', { term: searchTerm })}</p>
                    </div>
                `;
                return;
            }

            const limit = searchTerm.length > 0 ? 100 : 10;
            renderClients(filteredClients, limit);
        }

        function searchSuppliers() {
            const searchTerm = document.getElementById('supplierSearch').value.toLowerCase();
            const suppliers = allData.clients.filter(c => c.type === 'supplier');
            const container = document.getElementById('suppliersContainer');

            const filteredSuppliers = suppliers.filter(supplier =>
                supplier.name.toLowerCase().includes(searchTerm) ||
                (supplier.phone && supplier.phone.includes(searchTerm)) ||
                (supplier.email && supplier.email.toLowerCase().includes(searchTerm))
            );

            if (filteredSuppliers.length === 0) {
                container.innerHTML = `
            if (filteredSuppliers.length > limit) {
                container.innerHTML += `
                <div class="col-span-full text-center py-4">
                    <p class="text-slate-400 text-xs font-bold mb-2">${t('search_results_stats', { filtered: limit, total: filteredSuppliers.length })}</p>
                    ${searchTerm.length === 0 ? `<p class="text-slate-300 text-[10px]">${t('use_search_hint')}</p>` : ''}
                </div>`;
            }
        }

        function calculateClientDebt(clientId) {
            let totalDebt = 0;
            allData.invoices.forEach(invoice => {
                if (invoice.customer_id === clientId) {
                    totalDebt += safeNum(invoice.balance);
                }
            });

            return totalDebt;
        }

        function calculateSupplierDebt(supplierId) {
            let totalDebt = 0;
            allData.expenses.forEach(expense => {
                if (expense.supplier_id === supplierId) {
                    totalDebt += safeNum(expense.balance);
                }
            });

            return totalDebt;
        }

        function openSettleDebtForClient(clientId, clientName) {
            // البحث عن ديون الزبون
            const clientDebts = allData.invoices.filter(inv =>
                inv.customer_id === clientId && safeNum(inv.balance) > 0
            );

            if (clientDebts.length === 0) {
                showToast(t('no_client_debts'), 'info');
                return;
            }

            // فتح نموذج تسديد دين للفاتورة الأولى
            if (clientDebts.length > 0) {
                openSettleDebtModal('invoice', clientDebts[0].id);
            }
        }

        function openSettleDebtForSupplier(supplierId, supplierName) {
            // البحث عن ديون المورد
            const supplierDebts = allData.expenses.filter(exp =>
                exp.supplier_id === supplierId && safeNum(exp.balance) > 0
            );

            if (supplierDebts.length === 0) {
                showToast(t('no_supplier_debts'), 'info');
                return;
            }

            // فتح نموذج تسديد دين للمصروف الأول
            if (supplierDebts.length > 0) {
                openSettleDebtModal('expense', supplierDebts[0].id);
            }
        }

        function searchPayments() {
            const searchTerm = document.getElementById('paymentSearch').value.toLowerCase();
            const container = document.getElementById('paymentsContainer');
            const noPaymentsMessage = document.getElementById('noPaymentsMessage');

            if (!container) return;

            container.innerHTML = '';

            if (allData.payments.length === 0) {
                container.classList.add('hidden');
                if (noPaymentsMessage) noPaymentsMessage.classList.remove('hidden');
                return;
            } else {
                container.classList.remove('hidden');
                if (noPaymentsMessage) noPaymentsMessage.classList.add('hidden');
            }

            // تطبيق الفلترة
            let filteredPayments = allData.payments;

            // تصفية حسب الزبون الحالي إذا وجد
            if (currentPaymentClient) {
                filteredPayments = filteredPayments.filter(p => p.client_id == currentPaymentClient.id);
                // عند البحث داخل سجل عميل محدد، لا نبحث بالاسم لأنه موجود بالفعل
                // نركز البحث على المراجع والفواتير
            }

            const typeFilter = document.getElementById('paymentTypeFilter').value;
            const methodFilter = document.getElementById('paymentMethodFilter').value;

            if (typeFilter) {
                filteredPayments = filteredPayments.filter(p => p.type === typeFilter);
            }

            if (methodFilter) {
                filteredPayments = filteredPayments.filter(p => p.method === methodFilter);
            }

            if (searchTerm) {
                filteredPayments = filteredPayments.filter(payment => {
                    // الحصول على اسم الزبون/المورد (فقط إذا لم نكن في عرض خاص بعميل)
                    let clientName = '';
                    if (!currentPaymentClient) {
                        if (payment.client_id) {
                            const client = allData.clients.find(c => c.id === payment.client_id);
                            clientName = client ? client.name.toLowerCase() : '';
                        } else if (payment.client_name) {
                            clientName = payment.client_name.toLowerCase();
                        }
                    }

                    // البحث في رقم الفاتورة إذا كان الدفع مرتبطاً بفاتورة
                    let invoiceNumber = '';
                    if (payment.debt_type === 'invoice' && payment.debt_id) {
                        const invoice = allData.invoices.find(i => i.id === payment.debt_id);
                        if (invoice) {
                            invoiceNumber = invoice.id.toString().toLowerCase();
                        }
                    } else if (payment.debt_type === 'expense' && payment.debt_id) {
                        const expense = allData.expenses.find(e => e.id === payment.debt_id);
                        if (expense && expense.invoice_number) {
                            invoiceNumber = expense.invoice_number.toString().toLowerCase();
                        }
                    }

                    // البحث في معلومات الدفع
                    const paymentReference = payment.reference ? payment.reference.toLowerCase() : '';
                    const paymentDescription = payment.description ? translatePaymentDescription(payment.description).toLowerCase() : '';
                    const paymentMethod = payment.method ? payment.method.toLowerCase() : '';
                    const paymentId = payment.id ? payment.id.toLowerCase() : '';

                    // البحث الشامل في جميع الحقول
                    return (
                        (clientName && clientName.includes(searchTerm)) ||
                        invoiceNumber.includes(searchTerm) ||
                        paymentReference.includes(searchTerm) ||
                        paymentDescription.includes(searchTerm) ||
                        paymentMethod.includes(searchTerm) ||
                        paymentId.includes(searchTerm) ||
                        (payment.debt_id && payment.debt_id.toLowerCase().includes(searchTerm)) ||
                        // البحث باسم المنتج إذا كان موجوداً في الوصف
                        translatePaymentDescription(payment.description).toLowerCase().includes(searchTerm)
                    );
                });
            }

            if (filteredPayments.length === 0) {
                container.innerHTML = `
                    <div class="col-span-3 text-center p-8 bg-white rounded-[2rem] shadow-sm">
                        <i class="fas fa-search text-3xl text-slate-300 mb-3"></i>
                        <p class="text-slate-400 font-bold">${t('no_results_for', { term: searchTerm })}</p>
                    </div>
                `;
                return;
            }

            // عرض النتائج
            filteredPayments.forEach(payment => {
                const client = allData.clients.find(c => c.id === payment.client_id);
                const clientName = client ? client.name : payment.client_name || t('unknown');
                const isCustomer = payment.type === 'customer';

                // الحصول على معلومات الفاتورة أو المصروف
                let sourceInfo = '';
                let invoiceNumber = '';

                if (payment.debt_id && payment.debt_type === 'invoice') {
                    const invoice = allData.invoices.find(i => i.id === payment.debt_id);
                    if (invoice) {
                        sourceInfo = `${t('invoice')}: ${invoice.id}`;
                        invoiceNumber = invoice.id;
                    }
                } else if (payment.debt_id && payment.debt_type === 'expense') {
                    const expense = allData.expenses.find(e => e.id === payment.debt_id);
                    if (expense) {
                        sourceInfo = `${t('expense')}: ${expense.category}`;
                        invoiceNumber = expense.invoice_number || '';
                    }
                }

                let methodBadgeClass = '';
                switch (payment.method) {
                    case 'صندوق': methodBadgeClass = 'payment-cash'; break;
                    case 'شيك': methodBadgeClass = 'payment-check'; break;
                    case 'تحويل بنكي': methodBadgeClass = 'payment-transfer'; break;
                    case 'كمبيالة': methodBadgeClass = 'payment-promissory'; break;
                    default: methodBadgeClass = 'payment-credit';
                }

                container.innerHTML += `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h4 class="font-black text-slate-800 text-sm mb-1">${clientName}</h4>
                            <div class="flex items-center gap-2">
                                <span class="text-[9px] ${isCustomer ? 'text-blue-600' : 'text-emerald-600'} font-bold">
                                    ${isCustomer ? t('customer') : t('supplier')}
                                </span>
                                <span class="text-[9px] text-slate-400">${payment.date}</span>
                            </div>
                            ${sourceInfo ? `<p class="text-[9px] text-slate-600 mt-1">${sourceInfo}</p>` : ''}
                            ${invoiceNumber ? `<p class="text-[9px] text-blue-600 font-bold">${t('invoice_number')}: ${invoiceNumber}</p>` : ''}
                            ${payment.reference ? `<p class="text-[9px] text-emerald-600 font-bold">${t('reference_label')}: ${payment.reference}</p>` : ''}
                        </div>
                        <div class="text-left">
                            <p class="font-black ${isCustomer ? 'text-emerald-600' : 'text-amber-600'} text-sm">
                                ${formatCurrency(payment.amount)}
                            </p>
                            <span class="payment-badge ${methodBadgeClass}">
                                ${translatePaymentMethod(payment.method)}
                            </span>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <p class="text-[9px] text-slate-400 font-bold mb-1">${t('description_placeholder')}</p>
                        <p class="text-xs text-slate-600">${translatePaymentDescription(payment.description) || t('none')}</p>
                    </div>
                    
                    <div class="flex justify-between items-center">
                        <div class="text-[9px] text-slate-400">
                            ID: ${payment.id} • ${payment.created_at || t('unknown')}
                        </div>
                        <div class="flex gap-2">
                            <button onclick="editPayment('${payment.id}')" 
                                    class="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-200 transition-all"
                                    title="${t('edit')}">
                                <i class="fas fa-edit text-xs"></i>
                            </button>
                            <button onclick="promptDeletePayment('${payment.id}')" 
                                    class="w-8 h-8 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center hover:bg-rose-200 transition-all"
                                    title="${t('delete')}">
                                <i class="fas fa-trash text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
            });
        }

        function filterPayments() {
            searchPayments();
        }

        function renderPayments() {
            const container = document.getElementById('paymentsContainer');
            const noPaymentsMessage = document.getElementById('noPaymentsMessage');

            if (!container) return;

            // **الحفاظ على ترتيب الدفعات كما هو في الجدول**
            let paymentsToDisplay = [...allData.payments];

            // تصفية حسب الزبون الحالي إذا وجد
            if (currentPaymentClient) {
                paymentsToDisplay = paymentsToDisplay.filter(p => p.client_id == currentPaymentClient.id);
            } else {
                // إذا لم يتم تحديد زبون، لا نعرض شيئاً (لأن الصفحة أصبحت مخصصة)
                paymentsToDisplay = [];
            }

            if (paymentsToDisplay.length === 0) {
                container.classList.add('hidden');
                if (noPaymentsMessage) noPaymentsMessage.classList.remove('hidden');
                return;
            } else {
                container.classList.remove('hidden');
                if (noPaymentsMessage) noPaymentsMessage.classList.add('hidden');
            }

            container.innerHTML = '';

            // **عرض الدفعات بنفس الترتيب**
            paymentsToDisplay.forEach(payment => {
                const client = allData.clients.find(c => c.id === payment.client_id);
                const clientName = client ? client.name : payment.client_name || t('unknown');
                const isCustomer = payment.type === 'customer';

                // الحصول على معلومات الفاتورة أو المصروف
                let sourceInfo = '';
                let invoiceNumber = '';

                if (payment.debt_id && payment.debt_type === 'invoice') {
                    const invoice = allData.invoices.find(i => i.id === payment.debt_id);
                    if (invoice) {
                        sourceInfo = `${t('invoice')}: ${invoice.id}`;
                        invoiceNumber = invoice.id;
                    }
                } else if (payment.debt_id && payment.debt_type === 'expense') {
                    const expense = allData.expenses.find(e => e.id === payment.debt_id);
                    if (expense) {
                        sourceInfo = `${t('expense')}: ${expense.category}`;
                        invoiceNumber = expense.invoice_number || '';
                    }
                }

                let methodBadgeClass = '';
                switch (payment.method) {
                    case 'صندوق': methodBadgeClass = 'payment-cash'; break;
                    case 'شيك': methodBadgeClass = 'payment-check'; break;
                    case 'تحويل بنكي': methodBadgeClass = 'payment-transfer'; break;
                    case 'كمبيالة': methodBadgeClass = 'payment-promissory'; break;
                    default: methodBadgeClass = 'payment-credit';
                }

                container.innerHTML += `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-black text-slate-800 text-sm mb-1">${clientName}</h4>
                    <div class="flex items-center gap-2">
                        <span class="text-[9px] ${isCustomer ? 'text-blue-600' : 'text-emerald-600'} font-bold">
                            ${isCustomer ? t('customer') : t('supplier')}
                        </span>
                        <span class="text-[9px] text-slate-400">${payment.date}</span>
                    </div>
                    ${sourceInfo ? `<p class="text-[9px] text-slate-600 mt-1">${sourceInfo}</p>` : ''}
                    ${invoiceNumber ? `<p class="text-[9px] text-blue-600 font-bold">${t('invoice_number')}: ${invoiceNumber}</p>` : ''}
                    ${payment.reference ? `<p class="text-[9px] text-emerald-600 font-bold">${t('reference_label')}: ${payment.reference}</p>` : ''}
                </div>
                <div class="text-left">
                    <p class="font-black ${isCustomer ? 'text-emerald-600' : 'text-amber-600'} text-sm">
                        ${formatCurrency(payment.amount)}
                    </p>
                    <span class="payment-badge ${methodBadgeClass}">
                        ${translatePaymentMethod(payment.method)}
                    </span>
                </div>
            </div>
            
            <div class="mb-3">
                <p class="text-[9px] text-slate-400 font-bold mb-1">${t('description_placeholder')}</p>
                <p class="text-xs text-slate-600">${translatePaymentDescription(payment.description) || t('none')}</p>
            </div>
            
            <div class="flex justify-between items-center">
                <div class="text-[9px] text-slate-400">
                    ID: ${payment.id} • ${payment.created_at || t('unknown')}
                </div>
                <div class="flex gap-2">
                    <button onclick="editPayment('${payment.id}')" 
                            class="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-200 transition-all"
                            title="${t('edit')}">
                        <i class="fas fa-edit text-xs"></i>
                    </button>
                    <button onclick="promptDeletePayment('${payment.id}')" 
                            class="w-8 h-8 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center hover:bg-rose-200 transition-all"
                            title="${t('delete')}">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        </div>`;
            });
        }

        function editPayment(id) {
            const payment = allData.payments.find(p => p.id == id);
            if (!payment) {
                showToast(t('payment_not_found'), 'error');
                return;
            }

            // الحصول على الحد الأقصى للمبلغ بناءً على الدين المتبقي
            let maxAmount = safeNum(payment.amount);
            let remainingDebt = 0;
            let debtType = '';
            let debtDetails = '';
            let originalDebt = 0;

            if (payment.debt_type === 'invoice' && payment.debt_id) {
                const invoice = allData.invoices.find(i => String(i.id) === String(payment.debt_id));
                if (invoice) {
                    remainingDebt = safeNum(invoice.balance) + safeNum(payment.amount);
                    maxAmount = remainingDebt; // يمكن زيادة المبلغ حتى قيمة الدين الأصلي
                    originalDebt = safeNum(invoice.total);
                    debtType = t('invoice');
                    debtDetails = `${invoice.customer} - ${t('invoice')} #${invoice.id}`;
                }
            } else if (payment.debt_type === 'expense' && payment.debt_id) {
                const expense = allData.expenses.find(e => String(e.id) === String(payment.debt_id));
                if (expense) {
                    remainingDebt = safeNum(expense.balance) + safeNum(payment.amount);
                    maxAmount = remainingDebt; // يمكن زيادة المبلغ حتى قيمة الدين الأصلي
                    originalDebt = safeNum(expense.amount);
                    debtType = t('expense');
                    debtDetails = `${expense.supplier || t('supplier')} - ${expense.description}`;
                }
            }

            // **ملء نموذج تعديل الدفعة مع إضافة الحد الأقصى**
            document.getElementById('paymentEditId').value = payment.id;
            document.getElementById('paymentEditDate').value = payment.date;
            document.getElementById('paymentEditAmount').value = payment.amount;
            document.getElementById('paymentEditAmount').setAttribute('max', maxAmount); // تعيين الحد الأقصى
            document.getElementById('paymentEditAmount').setAttribute('min', '0'); // تعيين الحد الأدنى
            document.getElementById('paymentEditMethod').value = payment.method;
            document.getElementById('paymentEditReference').value = payment.reference || '';
            document.getElementById('paymentEditDescription').value = payment.description || '';

            // **تعبئة معلومات إضافية للعرض**
            document.getElementById('paymentEditCustomer').innerText = payment.client_name || t('unknown');
            document.getElementById('paymentEditType').innerText = payment.type === 'customer' ? t('customer_payment') : t('supplier_payment');

            // **إضافة تفاصيل الدين والحدود**
            let debtInfo = '';
            if (debtType) {
                debtInfo = `
                </div>
            </div>
        `;
            }

            document.getElementById('paymentEditDetails').innerHTML = debtInfo ||
                `<p class="text-sm text-slate-500">${t('debt_invoice_linked')}</p>`;

            // **تحديث نص المساعدة للمبلغ**
            const amountHint = document.getElementById('paymentMaxAmountHint');
            if (amountHint) {
                if (debtType) {
                    amountHint.innerHTML = `
                <span class="text-amber-600 font-bold">${t('max_limit', { amount: formatCurrency(maxAmount) })}</span>
                <br>
                <span class="text-slate-500">${t('increase_amount_hint')}</span>
            `;
                } else {
                    amountHint.innerHTML = `<span class="text-slate-500">${t('enter_new_amount')}</span>`;
                }
            }

            // **تحديث زر الحفظ**
            document.getElementById('editPaymentSaveBtn').innerHTML = `
        <i class="fas fa-save ml-1"></i> ${t('edit_payment_save')}
    `;

            // **إضافة مستمع لتغيير المبلغ للتحقق الفوري**
            const amountInput = document.getElementById('paymentEditAmount');
            amountInput.oninput = function () {
                const currentAmount = safeNum(this.value);
                const currentMax = safeNum(this.getAttribute('max') || 0);

                if (currentAmount > currentMax) {
                    this.classList.add('border-2', 'border-rose-500');
                    this.classList.remove('focus:ring-blue-500');
                    this.classList.add('focus:ring-rose-500');

                    if (amountHint) {
                        amountHint.innerHTML = `
                    <span class="text-rose-600 font-bold">❌ ${t('max_limit_reached')}!</span>
                    <br>
                    <span class="text-slate-500">${t('max_allowed_limit')}: ${formatCurrency(currentMax)}</span>
                `;
                    }
                } else if (currentAmount <= 0) {
                    this.classList.add('border-2', 'border-amber-500');
                    this.classList.remove('focus:ring-blue-500');
                    this.classList.add('focus:ring-amber-500');

                    if (amountHint) {
                        amountHint.innerHTML = `
                    <span class="text-amber-600 font-bold">⚠️ ${t('amount_must_be_positive')}</span>
                `;
                    }
                } else {
                    this.classList.remove('border-2', 'border-rose-500', 'border-amber-500');
                    this.classList.remove('focus:ring-rose-500', 'focus:ring-amber-500');
                    this.classList.add('focus:ring-blue-500');

                    if (amountHint) {
                        const difference = currentAmount - safeNum(payment.amount);
                        const differenceText = difference > 0 ?
                            `${t('increase_label')}: +${formatCurrency(difference)}` :
                            `${t('decrease_label')}: ${formatCurrency(difference)}`;

                        amountHint.innerHTML = `
                    <span class="${difference > 0 ? 'text-emerald-600' : 'text-amber-600'} font-bold">
                        ${differenceText}
                    </span>
                    ${debtType ? `<br><span class="text-slate-500">${t('original_amount_label')}: ${formatCurrency(safeNum(payment.amount))}</span>` : ''}
                `;
                    }
                }
            };

            // **فتح النموذج**
            openModal('paymentEditModal');

            // **تركيز على حقل المبلغ**
            setTimeout(() => {
                amountInput.focus();
                amountInput.select();
            }, 100);

            // **إشعار للمستخدم إذا كان هناك حدود**
            if (debtType) {
                setTimeout(() => {
                    showToast(t('payment_linked_update', { type: debtType }), 'info');
                }, 500);
            }
        }

        function promptDeletePayment(id) {
            // التحقق من الصلاحية
            if (currentUser.role !== 'admin') return showToast(t('delete_payment_perm_error'), 'error');

            openConfirm({
                title: t('delete_payment_title'),
                msg: t('delete_payment_msg'),
                iconClass: "fas fa-undo",
                colorClass: "bg-amber-600",
                onConfirm: () => {
                    // إغلاق نافذة التأكيد فوراً
                    closeConfirm();

                    // البحث عن الدفعة قبل الحذف
                    const paymentIndex = allData.payments.findIndex(p => p.id == id);
                    if (paymentIndex === -1) return;

                    const payment = allData.payments[paymentIndex];
                    const amount = safeNum(payment.amount);

                    // 1. عكس تأثير الدفعة على الدين الأصلي محلياً
                    if (payment.debt_id) {
                        if (payment.debt_type === 'invoice') {
                            const inv = allData.invoices.find(i => String(i.id) === String(payment.debt_id));
                            if (inv) {
                                inv.paid = safeNum(inv.paid) - amount;
                                inv.balance = safeNum(inv.balance) + amount;
                            }
                        } else if (payment.debt_type === 'expense') {
                            const exp = allData.expenses.find(e => String(e.id) === String(payment.debt_id));
                            if (exp) {
                                exp.paid = safeNum(exp.paid) - amount;
                                exp.balance = safeNum(exp.balance) + amount;
                            }
                        }
                    }

                    // 2. حذف الدفعة من القائمة المحلية
                    allData.payments.splice(paymentIndex, 1);

                    // 2.5 حذف الشيك المرتبط محلياً إن وجد
                    if (payment.method === 'شيك' || payment.method === 'كمبيالة') {
                        const checkIndex = allData.checks_promissory.findIndex(c =>
                            c.debt_id === payment.debt_id &&
                            c.debt_type === payment.debt_type &&
                            c.reference === payment.reference
                        );
                        if (checkIndex !== -1) {
                            allData.checks_promissory.splice(checkIndex, 1);
                        }
                    }

                    // 3. تحديث الواجهات فوراً
                    renderPayments();

                    if (!document.getElementById('page-invoices').classList.contains('hidden')) {
                        renderInvoices(getFilteredData(allData.invoices));
                    }
                    if (!document.getElementById('page-expenses').classList.contains('hidden')) {
                        renderExpenses(getFilteredData(allData.expenses));
                    }
                    if (!document.getElementById('page-clients').classList.contains('hidden')) {
                        renderClients();
                    }
                    if (!document.getElementById('page-suppliers').classList.contains('hidden')) {
                        renderSuppliers();
                    }
                    if (!document.getElementById('page-checks-promissory').classList.contains('hidden')) {
                        renderChecksPromissory();
                    }

                    showToast('تم حذف الدفعة محلياً', 'info');

                    // 4. إرسال للسيرفر في الخلفية
                    google.script.run
                        .withSuccessHandler(() => showToast('✅ تم حذف الدفعة من السيرفر'))
                        .withFailureHandler((e) => {
                            console.error(e);
                            showToast('❌ فشل الحذف من السيرفر، سيتم المزامنة لاحقاً', 'error');
                            refreshData(); // إعادة تحميل البيانات للتراجع عن التحديث المحلي في حالة الخطأ
                        })
                        .deletePayment(id, currentDbId);
                }
            });
        }

        function updateClientLists() {
            // تحديث قائمة الزبناء في نموذج الفاتورة
            const customerSelect = document.getElementById('iCustSelect');
            if (customerSelect) {
                customerSelect.innerHTML = `<option value="">${t('general_customer')}</option>`;
                const customers = allData.clients.filter(c => c.type === 'customer');
                customers.forEach(customer => {
                    customerSelect.innerHTML += `<option value="${customer.id}">${customer.name}</option>`;
                });
            }

            // تحديث قائمة الموردين في نموذج المصاريف
            const supplierSelect = document.getElementById('expSupplierSelect');
            if (supplierSelect) {
                supplierSelect.innerHTML = `<option value="">${t('select_supplier')}</option>`;
                const suppliers = allData.clients.filter(c => c.type === 'supplier');
                suppliers.forEach(supplier => {
                    supplierSelect.innerHTML += `<option value="${supplier.id}">${supplier.name}</option>`;
                });
            }

            // تحديث قائمة الزبناء في نموذج الخدمات
            const serviceCustomerSelect = document.getElementById('serviceCustomerSelect');
            if (serviceCustomerSelect) {
                serviceCustomerSelect.innerHTML = `<option value="">${t('general_customer')}</option>`;
                const customers = allData.clients.filter(c => c.type === 'customer');
                customers.forEach(customer => {
                    serviceCustomerSelect.innerHTML += `<option value="${customer.id}">${customer.name}</option>`;
                });
            }
        }

        function confirmEditPayment() {
            const paymentId = document.getElementById('paymentEditId').value;
            const paymentDate = document.getElementById('paymentEditDate').value;
            const paymentAmount = safeNum(document.getElementById('paymentEditAmount').value);
            const paymentMethod = document.getElementById('paymentEditMethod').value;
            const paymentReference = document.getElementById('paymentEditReference').value;
            const paymentDescription = document.getElementById('paymentEditDescription').value;
            const saveBtn = document.getElementById('editPaymentSaveBtn');

            if (paymentAmount <= 0) return showToast(t('enter_valid_qty'), 'error');
            if (!paymentDate) return showToast(t('fill_fields_error'), 'error');

            // --- التحديث المحلي (Optimistic Update) ---

            // 1. العثور على الدفعة الأصلية في البيانات المحلية
            const originalPayment = allData.payments.find(p => p.id == paymentId);
            if (!originalPayment) return;

            // العثور على الشيك المرتبط قبل التعديل
            let associatedCheck = null;
            if (originalPayment.method === 'شيك' || originalPayment.method === 'كمبيالة') {
                associatedCheck = allData.checks_promissory.find(c =>
                    c.debt_id === originalPayment.debt_id &&
                    c.debt_type === originalPayment.debt_type &&
                    c.reference === originalPayment.reference
                );
            }

            const oldMethod = originalPayment.method;

            // 2. حساب الفرق في المبلغ لتحديث الدين (الجديد - القديم)
            const oldAmount = safeNum(originalPayment.amount);
            const diff = paymentAmount - oldAmount;

            // 3. تحديث الفاتورة أو المصروف المرتبط محلياً (إذا تغير المبلغ)
            if (originalPayment.debt_id && diff !== 0) {
                if (originalPayment.debt_type === 'invoice') {
                    const inv = allData.invoices.find(i => String(i.id) === String(originalPayment.debt_id));
                    if (inv) {
                        // التحقق: هل التعديل سيجعل المدفوع بالسالب أو أكبر من الإجمالي؟ (اختياري، لكن جيد للدقة)
                        // هنا سنقوم بالتحديث المباشر للسرعة
                        inv.paid = safeNum(inv.paid) + diff;
                        inv.balance = safeNum(inv.balance) - diff;
                    }
                } else if (originalPayment.debt_type === 'expense') {
                    const exp = allData.expenses.find(e => String(e.id) === String(originalPayment.debt_id));
                    if (exp) {
                        exp.paid = safeNum(exp.paid) + diff;
                        exp.balance = safeNum(exp.balance) - diff;
                    }
                }
            }

            // 4. تحديث بيانات الدفعة نفسها في المصفوفة المحلية
            originalPayment.date = paymentDate;
            originalPayment.amount = paymentAmount;
            originalPayment.method = paymentMethod;
            originalPayment.reference = paymentReference;
            originalPayment.description = paymentDescription;

            // التعامل مع تحديثات الشيك محلياً
            let checkAction = 'none';
            let checkDataToSave = null;

            if ((oldMethod === 'شيك' || oldMethod === 'كمبيالة') && (paymentMethod === 'شيك' || paymentMethod === 'كمبيالة')) {
                if (associatedCheck) {
                    associatedCheck.amount = paymentAmount;
                    associatedCheck.reference = paymentReference;
                    associatedCheck.type = paymentMethod;
                    associatedCheck.date = paymentDate;
                    checkAction = 'update';
                    checkDataToSave = associatedCheck;
                } else {
                    checkAction = 'create';
                }
            } else if ((oldMethod === 'شيك' || oldMethod === 'كمبيالة') && (paymentMethod !== 'شيك' && paymentMethod !== 'كمبيالة')) {
                if (associatedCheck) {
                    const cIdx = allData.checks_promissory.findIndex(c => c.id === associatedCheck.id);
                    if (cIdx > -1) allData.checks_promissory.splice(cIdx, 1);
                    checkAction = 'delete';
                    checkDataToSave = { id: associatedCheck.id };
                }
            } else if ((oldMethod !== 'شيك' && oldMethod !== 'كمبيالة') && (paymentMethod === 'شيك' || paymentMethod === 'كمبيالة')) {
                checkAction = 'create';
            }

            if (checkAction === 'create') {
                const newCheckRec = {
                    id: 'CHK-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                    reference: paymentReference,
                    type: paymentMethod,
                    amount: paymentAmount,
                    date: paymentDate,
                    due_date: paymentDate,
                    status: 'pending',
                    client_name: originalPayment.client_name,
                    debt_id: originalPayment.debt_id,
                    debt_type: originalPayment.debt_type
                };
                if (!allData.checks_promissory) allData.checks_promissory = [];
                allData.checks_promissory.unshift(newCheckRec);
                checkDataToSave = newCheckRec;
            }

            // 5. تحديث الواجهات المتأثرة فوراً
            setBtnLoading(saveBtn, true, t('saving'));
            renderPayments(); // تحديث جدول الدفعات

            // تحديث جداول الفواتير والمصاريف إذا كانت مفتوحة
            if (!document.getElementById('page-invoices').classList.contains('hidden')) {
                renderInvoices(getFilteredData(allData.invoices));
            }
            if (!document.getElementById('page-expenses').classList.contains('hidden')) {
                renderExpenses(getFilteredData(allData.expenses));
            }
            if (!document.getElementById('page-checks-promissory').classList.contains('hidden')) {
                renderChecksPromissory();
            }

            closeModal('paymentEditModal');
            setTimeout(() => setBtnLoading(saveBtn, false), 500);
            showToast(t('edit_payment_local'), 'info');

            // --- الإرسال للسيرفر في الخلفية ---
            google.script.run
                .withSuccessHandler(() => showToast('تم التحديث في السيرفر بنجاح'))
                .withFailureHandler((e) => {
                    console.error(e);
                    showToast('خطأ في التحديث بالسيرفر', 'error');
                    // ملاحظة: في حالة الخطأ الحقيقي قد تحتاج لإعادة تحميل البيانات refreshData()
                })
                .updatePaymentAndCheck(paymentId, {
                    date: paymentDate,
                    amount: paymentAmount,
                    method: paymentMethod,
                    reference: paymentReference,
                    description: paymentDescription
                }, checkAction, checkDataToSave, currentDbId);
        }
