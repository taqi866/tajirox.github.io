        let isFirstLoad = true;

        function refreshData() {
            if (currentUser && currentUser.role === 'super_admin') {
                if (typeof loadAdminData === 'function') {
                    loadAdminData();
                }
                return;
            }
            setLoading(true);

            // محاولة التحميل الفوري من الكاش لسرعة استجابة فائقة (Instant Boot Cache)
            if (isFirstLoad && currentDbId && typeof getLocalCache === 'function') {
                getLocalCache(currentDbId).then(cache => {
                    if (cache && cache.allData) {
                        allData = cache.allData;
                        
                        ['inventory', 'invoices', 'expenses', 'users', 'clients', 'payments', 'consumptions', 'checks_promissory'].forEach(k => {
                            if (!allData[k]) allData[k] = [];
                        });

                        renderInventory();
                        checkDueDateAlerts();
                        renderAll();
                        calculateStockStats();
                        console.log("⚡ [Dexie.js] تم تحميل الواجهة فورياً من الكاش المحلي. جاري التحديث من السحابة في الخلفية...");
                    }
                }).catch(e => console.error("❌ خطأ تحميل كاش البدء:", e));
                isFirstLoad = false;
            }

            google.script.run
                .withSuccessHandler(data => {
                    try {
                        if (data && data.error) {
                            showToast(t('fetch_error') + ': ' + data.error, 'error');
                            if (!allData.inventory) allData = { inventory: [], invoices: [], expenses: [], users: [], clients: [], payments: [], consumptions: [], checks_promissory: [] };
                        } else {
                            allData = data || { inventory: [], invoices: [], expenses: [], users: [], clients: [], payments: [], consumptions: [], checks_promissory: [] };

                            // حفظ الكاش السحابي محلياً فور الاستجابة الناجحة
                            if (currentDbId && typeof saveLocalCache === 'function') {
                                saveLocalCache(currentDbId, allData, currentUser);
                            }

                            // ====== إضافة هذا الجزء: استعادة لون الفاتورة من الإعدادات ======
                            const colorInput = document.getElementById('settingInvoiceColor');
                            if (colorInput && colorInput.value && colorInput.value !== '#000000') {
                                // اللون موجود في الإعدادات، نستخدمه
                                if (currentUser) {
                                    currentUser.invoiceColor = colorInput.value;
                                }
                                localStorage.setItem('invoiceColor', colorInput.value);
                                console.log('✅ تم استعادة لون الفاتورة من الإعدادات:', colorInput.value);
                            }
                            else if (currentUser && currentUser.invoiceColor && currentUser.invoiceColor !== '#000000') {
                                // استعادة من currentUser
                                if (colorInput) colorInput.value = currentUser.invoiceColor;
                                localStorage.setItem('invoiceColor', currentUser.invoiceColor);
                                console.log('✅ تم استعادة لون الفاتورة من currentUser:', currentUser.invoiceColor);
                            }
                            else {
                                const savedColor = localStorage.getItem('invoiceColor');
                                if (savedColor && savedColor !== '#000000') {
                                    if (colorInput) colorInput.value = savedColor;
                                    if (currentUser) currentUser.invoiceColor = savedColor;
                                    console.log('✅ تم استعادة لون الفاتورة من localStorage:', savedColor);
                                }
                            }
                            // ====== نهاية الإضافة ======
                        }

                        ['inventory', 'invoices', 'expenses', 'users', 'clients', 'payments', 'consumptions', 'checks_promissory'].forEach(k => {
                            if (!allData[k]) allData[k] = [];
                        });

                        renderInventory();
                        checkDueDateAlerts();
                        renderAll();
                        calculateStockStats();
                    } catch (e) {
                        console.error('Error rendering data:', e);
                    } finally {
                        setLoading(false);
                    }
                })
                .withFailureHandler(err => {
                    setLoading(false);
                    
                    // التراجع للكاش المحلي في حالة فشل الشبكة أو وضع الأوفلاين
                    if (currentDbId && typeof getLocalCache === 'function') {
                        getLocalCache(currentDbId).then(cache => {
                            if (cache && cache.allData) {
                                allData = cache.allData;
                                showToast('⚠️ وضع الأوفلاين: تم تحميل أحدث نسخة مخزنة محلياً بنجاح', 'warning');
                                
                                ['inventory', 'invoices', 'expenses', 'users', 'clients', 'payments', 'consumptions', 'checks_promissory'].forEach(k => {
                                    if (!allData[k]) allData[k] = [];
                                });

                                renderInventory();
                                checkDueDateAlerts();
                                renderAll();
                                calculateStockStats();
                            } else {
                                showToast(t('connection_error'), 'error');
                            }
                        }).catch(e => {
                            console.error(e);
                            showToast(t('connection_error'), 'error');
                        });
                    } else {
                        showToast(t('connection_error'), 'error');
                    }
                })
                .getAllData(currentDbId);
        }

        function renderReports(fInvs, fExps) {
            console.log('=== تحديث التقارير مع الفلترة ===');
            console.log('الفلاتر الحالية:', filters);

            // الحصول على البيانات المفلترة للمدفوعات والشيكات والتحويلات
            const fPayments = getFilteredData(allData.payments || []);
            const fChecks = getFilteredData(allData.checks_promissory || []);
            const fTransfers = getFilteredData(allData.transfers || []);

            console.log('عدد الفواتير بعد الفلترة:', fInvs.length);
            console.log('عدد المصاريف بعد الفلترة:', fExps.length);
            console.log('عدد المدفوعات بعد الفلترة:', fPayments.length);
            console.log('عدد الشيكات بعد الفلترة:', fChecks.length);
            console.log('عدد التحويلات بعد الفلترة:', fTransfers.length);

            // 1. حساب إجمالي المبيعات (بعد الخصم)
            const salesTotal = fInvs.reduce((s, i) => s + (safeNum(i.total) - safeNum(i.discount)), 0);

            // 2. حساب ديون الزبناء (الباقي في الفواتير)
            const customerDebts = fInvs.reduce((s, i) => s + safeNum(i.balance), 0);

            // 3. حساب ديون الموردين (الباقي في المصاريف)
            const supplierDebts = fExps.reduce((s, i) => s + safeNum(i.balance), 0);

            // 4. حساب إجمالي المصاريف
            const expsTotal = fExps.reduce((s, i) => s + safeNum(i.amount), 0);

            // 5. حساب الرصيد البنكي (مع الفلترة)
            const bankBalance = calculateBankBalance(fInvs, fExps, fPayments, fChecks, fTransfers);

            // 6. حساب رصيد الصندوق (مع الفلترة)
            const cashBalance = calculateCashBalance(fInvs, fExps, fPayments, fTransfers);

            // 7. حساب قيمة المخزون
            const stockValues = calculateStockValues();

            // 8. حساب صافي الربح الفعلي
            const netProfit = salesTotal - expsTotal;

            // 9. حساب تفصيل المصاريف حسب الفئات
            const expensesByCategory = calculateExpensesByCategory(fExps);

            // عرض تفصيل المصاريف
            renderExpensesByCategory(expensesByCategory);

            // 10. حساب ملخص الزبائن والموردين
            const customerSummary = calculateCustomerSummary(fInvs);
            const supplierSummary = calculateSupplierSummary(fExps);

            // عرض الملخصات
            renderSummaries(customerSummary, supplierSummary);

            // 11. إنشاء نص الفترة
            const yearFilter = filters.year || '';
            const monthFilter = filters.month || '';

            let periodText = '';
            if (monthFilter && yearFilter) {
                const monthNames = [t('jan'), t('feb'), t('mar'), t('apr'), t('may'), t('jun'),
                t('jul'), t('aug'), t('sep'), t('oct'), t('nov'), t('dec')];
                periodText = ` (${monthNames[parseInt(monthFilter) - 1]} ${yearFilter})`;
            } else if (monthFilter) {
                const monthNames = [t('jan'), t('feb'), t('mar'), t('apr'), t('may'), t('jun'),
                t('jul'), t('aug'), t('sep'), t('oct'), t('nov'), t('dec')];
                periodText = ` (${t('month_word')} ${monthNames[parseInt(monthFilter) - 1]})`;
            } else if (yearFilter) {
                periodText = ` (${t('year_word')} ${yearFilter})`;
            }

            // 12. عرض التقرير الرئيسي
            document.getElementById('reportContainer').innerHTML = `
        <!-- القسم الأول: تحليل المبيعات والديون -->
        <div class="bg-slate-50 p-5 rounded-[2rem] space-y-3">
            <h4 class="font-black text-slate-400 text-[9px] uppercase tracking-widest mb-3">${t('sales_analysis_title')}${periodText}</h4>
            
            <div class="flex justify-between items-center font-bold p-2 hover:bg-white rounded-xl transition-all">
                <span>${t('total_invoices')}:</span>
                <span class="text-blue-600">${formatCurrency(salesTotal)}</span>
            </div>
            
            <div class="flex justify-between items-center font-bold p-3 bg-white rounded-2xl border-r-4 border-amber-500 shadow-sm text-xs">
                <span>${t('customer_debts_us')}:</span>
                <span class="text-amber-600 font-black">${formatCurrency(customerDebts)}</span>
            </div>
            
            <div class="flex justify-between items-center font-bold p-3 bg-white rounded-2xl border-r-4 border-rose-500 shadow-sm text-xs">
                <span>${t('supplier_debts_us')}:</span>
                <span class="text-rose-600 font-black">${formatCurrency(supplierDebts)}</span>
            </div>
        </div>
        
        <!-- القسم الثاني: الأرصدة المالية -->
        <div class="bg-slate-50 p-5 rounded-[2rem] space-y-3">
            <h4 class="font-black text-slate-400 text-[9px] uppercase tracking-widest mb-3">${t('financial_balances')}${periodText}</h4>
            
            <div class="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-[1.5rem] text-white shadow-lg">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-university text-2xl"></i>
                        <span class="font-bold text-sm">${t('bank_balance')}</span>
                    </div>
                    <span class="text-2xl font-black">${formatCurrency(bankBalance)}</span>
                </div>
                <p class="text-[8px] text-blue-100 mt-1">${t('checks_count')}: ${fChecks.filter(c => c.status === 'paid').length} | ${t('payments_count')}: ${fPayments.filter(p => p.method === 'تحويل بنكي').length}</p>
            </div>
            
            <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 rounded-[1.5rem] text-white shadow-lg">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-wallet text-2xl"></i>
                        <span class="font-bold text-sm">${t('cash_balance')}</span>
                    </div>
                    <span class="text-2xl font-black">${formatCurrency(cashBalance)}</span>
                </div>
                <p class="text-[8px] text-emerald-100 mt-1">${t('cash_payments_count')}: ${fPayments.filter(p => p.method === 'صندوق').length}</p>
            </div>
            
            <div class="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-[1.5rem] text-white shadow-lg">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-chart-pie text-2xl"></i>
                        <span class="font-bold text-sm">${t('total_liquidity')}</span>
                    </div>
                    <span class="text-2xl font-black">${formatCurrency(bankBalance + cashBalance)}</span>
                </div>
            </div>
        </div>
        
        <!-- القسم الثالث: تحليل الأرباح والمخزون -->
        <div class="bg-slate-50 p-5 rounded-[2rem] space-y-3">
            <h4 class="font-black text-slate-400 text-[9px] uppercase tracking-widest mb-3">${t('profit_stock_analysis')}${periodText}</h4>
            
            <div class="flex justify-between items-center font-black text-blue-600 p-2 hover:bg-white rounded-xl transition-all">
                <span>${t('total_sales_report')}:</span>
                <span>${formatCurrency(salesTotal)}</span>
            </div>
            
            <div class="flex justify-between items-center font-bold p-2 hover:bg-white rounded-xl transition-all">
                <span>${t('total_expenses_report')}:</span>
                <span class="text-rose-500">${formatCurrency(expsTotal)}</span>
            </div>
            
            <div class="bg-gradient-to-br from-blue-600 to-blue-700 p-4 rounded-[1.5rem] text-white shadow-lg mt-2 text-center hover:from-blue-700 hover:to-blue-800 transition-all">
                <p class="text-[8px] font-black uppercase tracking-widest text-blue-200 mb-1">${t('net_profit_actual')}</p>
                <h4 class="text-2xl font-black">${formatCurrency(netProfit)}</h4>
            </div>
        </div>
        
        <!-- القسم الرابع: قيمة المخزون -->
        <div class="bg-slate-50 p-5 rounded-[2rem] space-y-3">
            <h4 class="font-black text-slate-400 text-[9px] uppercase tracking-widest mb-3">${t('total_stock_value_title')}</h4>
            
            <div class="flex justify-between items-center font-bold p-3 bg-blue-50 rounded-2xl border-r-4 border-blue-500 shadow-sm text-xs">
                <span>${t('stock_value_sale')}:</span>
                <span class="text-blue-600 font-black">${formatCurrency(stockValues.atSale)}</span>
            </div>
            
            <div class="flex justify-between items-center font-bold p-3 bg-emerald-50 rounded-2xl border-r-4 border-emerald-500 shadow-sm text-xs">
                <span>${t('stock_value_buy')}:</span>
                <span class="text-emerald-600 font-black">${formatCurrency(stockValues.atPurchase)}</span>
            </div>
            
            <div class="flex justify-between items-center font-bold p-3 bg-purple-50 rounded-2xl border-r-4 border-purple-500 shadow-sm text-xs">
                <span>${t('potential_profit')}:</span>
                <span class="text-purple-600 font-black">${formatCurrency(stockValues.potentialProfit)}</span>
            </div>
            
            <div class="mt-3 text-center text-xs text-slate-500">
                <p>${t('products_count')}: <span class="font-black text-slate-700">${stockValues.productCount}</span></p>
            </div>
        </div>
    `;
        }

        function renderSummaries(customerSummary, supplierSummary) {
            const customerDiv = document.getElementById('customerSummary');
            const supplierDiv = document.getElementById('supplierSummary');
            const summaryDiv = document.getElementById('reportSummary');

            if (!customerDiv || !supplierDiv) return;

            customerDiv.innerHTML = '';
            supplierDiv.innerHTML = '';

            const hasCustomerData = Object.keys(customerSummary).length > 0;
            const hasSupplierData = Object.keys(supplierSummary).length > 0;

            if (hasCustomerData) {
                // ترتيب الزبائن حسب الدين (الأكبر أولاً)
                const sortedCustomers = Object.entries(customerSummary)
                    .sort((a, b) => b[1].balance - a[1].balance)
                    .slice(0, 10); // عرض أهم 10 فقط

                sortedCustomers.forEach(([customer, data]) => {
                    if (data.total > 0) {
                        customerDiv.innerHTML += `
                    <div class="flex justify-between items-center p-3 bg-white rounded-xl summary-card hover:shadow-md transition-all">
                        <div class="flex-1">
                            <p class="font-bold text-xs text-slate-800 truncate max-w-[120px]">${customer}</p>
                            <p class="text-[9px] text-slate-400">${data.count} ${t('invoice')}</p>
                        </div>
                        <div class="text-left">
                            <p class="text-emerald-600 text-xs font-black">${formatCurrency(data.paid)}</p>
                            <p class="text-rose-600 text-xs font-black">${formatCurrency(data.balance)}</p>
                        </div>
                    </div>
                `;
                    }
                });
            } else {
                customerDiv.innerHTML = `<p class="text-slate-400 text-center p-4 text-xs">${t('no_data')}</p>`;
            }

            if (hasSupplierData) {
                // ترتيب الموردين حسب الدين (الأكبر أولاً)
                const sortedSuppliers = Object.entries(supplierSummary)
                    .sort((a, b) => b[1].balance - a[1].balance)
                    .slice(0, 10); // عرض أهم 10 فقط

                sortedSuppliers.forEach(([supplier, data]) => {
                    if (data.total > 0) {
                        supplierDiv.innerHTML += `
                    <div class="flex justify-between items-center p-3 bg-white rounded-xl summary-card hover:shadow-md transition-all">
                        <div class="flex-1">
                            <p class="font-bold text-xs text-slate-800 truncate max-w-[120px]">${supplier}</p>
                            <p class="text-[9px] text-slate-400">${data.count} ${t('transaction_count')}</p>
                        </div>
                        <div class="text-left">
                            <p class="text-emerald-600 text-xs font-black">${formatCurrency(data.paid)}</p>
                            <p class="text-amber-600 text-xs font-black">${formatCurrency(data.balance)}</p>
                        </div>
                    </div>
                `;
                    }
                });
            } else {
                supplierDiv.innerHTML = `<p class="text-slate-400 text-center p-4 text-xs">${t('no_data')}</p>`;
            }

            if (summaryDiv) {
                if (hasCustomerData || hasSupplierData) {
                    summaryDiv.classList.remove('hidden');
                } else {
                    summaryDiv.classList.add('hidden');
                }
            }
        }

        function toggleCategoryDetails(categoryId) {
            const details = document.getElementById(categoryId);
            if (details) {
                details.classList.toggle('expanded');
            }
        }

        function loadDetailedReport() {
            const year = document.getElementById('reportYear')?.value || '';
            const month = document.getElementById('reportMonth')?.value || '';

            setLoading(true);

            google.script.run
                .withSuccessHandler(result => {
                    setLoading(false);
                    displayDetailedReport(result);
                })
                .withFailureHandler(error => {
                    setLoading(false);
                    showToast('حدث خطأ في تحميل التقرير', 'error');
                    console.error('Report Error:', error);
                })
                .getDetailedReport(year || null, month || null, currentDbId);
        }

        function displayDetailedReport(result) {
            if (!result) return;

            // حساب تفصيل المصاريف من النتائج
            const expensesByCategory = {};

            if (result.expenses && Array.isArray(result.expenses)) {
                result.expenses.forEach(exp => {
                    const category = exp.category || 'أخرى';

                    if (!expensesByCategory[category]) {
                        expensesByCategory[category] = {
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

                    expensesByCategory[category].total += amount;
                    expensesByCategory[category].paid += paid;
                    expensesByCategory[category].balance += balance;
                    expensesByCategory[category].count++;

                    expensesByCategory[category].items.push({
                        date: exp.date,
                        description: exp.description,
                        amount: amount,
                        paid: paid,
                        balance: balance,
                        supplier: exp.supplier || t('unknown'),
                        invoice_number: exp.invoice_number || t('no_number'),
                        payment_reference: exp.payment_reference || ''
                    });
                });
            }

            // عرض تفصيل المصاريف
            renderExpensesByCategory(expensesByCategory);

            // حساب الأرصدة
            const bankBalance = result.bankBalance || 0;
            const cashBalance = result.cashBalance || 0;

            // عرض التقرير الرئيسي
            document.getElementById('reportContainer').innerHTML = `
        <div class="bg-slate-50 p-5 rounded-[2rem] space-y-3">
            <h4 class="font-black text-slate-400 text-[9px] uppercase tracking-widest mb-3">${t('sales_analysis_title')}</h4>
            <div class="flex justify-between items-center font-bold p-2 hover:bg-white rounded-xl transition-all">
                <span>${t('total_invoices')}:</span>
                <span class="text-blue-600">${formatCurrency(result.totalSales || 0)}</span>
            </div>
            <div class="flex justify-between items-center font-bold p-2 hover:bg-white rounded-xl transition-all">
                <span>${t('total_expenses_report')}:</span>
                <span class="text-rose-600">${formatCurrency(result.totalExpenses || 0)}</span>
            </div>
            <div class="flex justify-between items-center font-bold p-3 bg-white rounded-2xl border-r-4 border-amber-500 shadow-sm text-xs">
                <span>${t('customer_debts_us')}:</span>
                <span class="text-amber-600 font-black">${formatCurrency(result.customerDebts || 0)}</span>
            </div>
            <div class="flex justify-between items-center font-bold p-3 bg-white rounded-2xl border-r-4 border-rose-500 shadow-sm text-xs">
                <span>${t('supplier_debts_us')}:</span>
                <span class="text-rose-600 font-black">${formatCurrency(result.supplierDebts || 0)}</span>
            </div>
        </div>
        
        <div class="bg-slate-50 p-5 rounded-[2rem] space-y-3">
            <h4 class="font-black text-slate-400 text-[9px] uppercase tracking-widest mb-3">الأرصدة المالية</h4>
            <div class="flex justify-between items-center font-bold p-3 bg-blue-50 rounded-2xl border-r-4 border-blue-500 shadow-sm text-xs">
                <span>${t('bank_balance')}:</span>
                <span class="text-blue-600 font-black">${formatCurrency(bankBalance)}</span>
            </div>
            <div class="flex justify-between items-center font-bold p-3 bg-emerald-50 rounded-2xl border-r-4 border-emerald-500 shadow-sm text-xs">
                <span>رصيد الصندوق:</span>
                <span class="text-emerald-600 font-black">${formatCurrency(cashBalance)}</span>
            </div>
        </div>
        
        <div class="bg-slate-50 p-5 rounded-[2rem] space-y-3">
            <h4 class="font-black text-slate-400 text-[9px] uppercase tracking-widest mb-3">${t('quick_summary')}</h4>
            <div class="text-center p-4">
                <p class="text-[8px] text-slate-400 uppercase font-black mb-1">${t('net_label')}</p>
                <h3 class="text-2xl font-black ${((result.totalSales || 0) - (result.totalExpenses || 0)) >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                    ${formatCurrency((result.totalSales || 0) - (result.totalExpenses || 0))}
                </h3>
            </div>
        </div>
    `;

            // إضافة قسم قيمة المخزون من النتائج
            if (result.totalStockValueAtSale !== undefined) {
                const stockValues = {
                    atSale: result.totalStockValueAtSale || 0,
                    atPurchase: result.totalStockValueAtPurchase || 0,
                    potentialProfit: result.totalPotentialProfit || 0
                };

                document.getElementById('reportContainer').innerHTML += `
            <div class="bg-slate-50 p-5 rounded-[2rem] space-y-3">
                <h4 class="font-black text-slate-400 text-[9px] uppercase tracking-widest mb-3">${t('total_stock_value_title')}</h4>
                
                <div class="flex justify-between items-center font-bold p-3 bg-blue-50 rounded-2xl border-r-4 border-blue-500 shadow-sm text-xs">
                    <span>${t('stock_value_sale')}:</span>
                    <span class="text-blue-600 font-black">${formatCurrency(stockValues.atSale)}</span>
                </div>
                
                <div class="flex justify-between items-center font-bold p-3 bg-emerald-50 rounded-2xl border-r-4 border-emerald-500 shadow-sm text-xs">
                    <span>${t('stock_value_buy')}:</span>
                    <span class="text-emerald-600 font-black">${formatCurrency(stockValues.atPurchase)}</span>
                </div>
                
                <div class="flex justify-between items-center font-bold p-3 bg-purple-50 rounded-2xl border-r-4 border-purple-500 shadow-sm text-xs">
                    <span>${t('potential_profit')}:</span>
                    <span class="text-purple-600 font-black">${formatCurrency(stockValues.potentialProfit)}</span>
                </div>
            </div>
        `;
            }

            // عرض ملخصات الزبائن والموردين
            const customerSummaryDiv = document.getElementById('customerSummary');
            const supplierSummaryDiv = document.getElementById('supplierSummary');

            if (customerSummaryDiv) {
                customerSummaryDiv.innerHTML = '';
                if (result.customerSummary && Object.keys(result.customerSummary).length > 0) {
                    Object.entries(result.customerSummary).forEach(([customer, data]) => {
                        if (data.total > 0) {
                            customerSummaryDiv.innerHTML += `
                        <div class="flex justify-between items-center p-3 bg-white rounded-xl summary-card hover:shadow-md transition-all">
                            <div>
                                <p class="font-bold text-xs text-slate-800 truncate max-w-[150px]">${customer}</p>
                                <p class="text-[9px] text-slate-400">${t('total')}: ${formatCurrency(data.total)}</p>
                            </div>
                            <div class="text-left">
                                <p class="text-emerald-600 text-xs font-black">${formatCurrency(data.paid || 0)}</p>
                                <p class="text-rose-600 text-xs font-black">${formatCurrency(data.balance || 0)}</p>
                            </div>
                        </div>
                    `;
                        }
                    });
                } else {
                    customerSummaryDiv.innerHTML = `<p class="text-slate-400 text-center p-4 text-xs">${t('no_data')}</p>`;
                }
            }

            if (supplierSummaryDiv) {
                supplierSummaryDiv.innerHTML = '';
                if (result.supplierSummary && Object.keys(result.supplierSummary).length > 0) {
                    Object.entries(result.supplierSummary).forEach(([supplier, data]) => {
                        if (data.total > 0) {
                            supplierSummaryDiv.innerHTML += `
                        <div class="flex justify-between items-center p-3 bg-white rounded-xl summary-card hover:shadow-md transition-all">
                            <div>
                                <p class="font-bold text-xs text-slate-800 truncate max-w-[150px]">${supplier}</p>
                                <p class="text-[9px] text-slate-400">${t('total')}: ${formatCurrency(data.total)}</p>
                                ${data.invoice_number ? `<p class="text-[9px] text-blue-600">${t('invoice')}: ${data.invoice_number}</p>` : ''}
                            </div>
                            <div class="text-left">
                                <p class="text-emerald-600 text-xs font-black">${formatCurrency(data.paid || 0)}</p>
                                <p class="text-amber-600 text-xs font-black">${formatCurrency(data.balance || 0)}</p>
                            </div>
                        </div>
                    `;
                        }
                    });
                } else {
                    supplierSummaryDiv.innerHTML = `<p class="text-slate-400 text-center p-4 text-xs">${t('no_data')}</p>`;
                }
            }

            const reportSummaryDiv = document.getElementById('reportSummary');
            if (reportSummaryDiv) {
                if ((result.customerSummary && Object.keys(result.customerSummary).length > 0) ||
                    (result.supplierSummary && Object.keys(result.supplierSummary).length > 0)) {
                    reportSummaryDiv.classList.remove('hidden');
                } else {
                    reportSummaryDiv.classList.add('hidden');
                }
            }
        }

        function renderMainChart(invs) {
            const ctx = document.getElementById('mainChart').getContext('2d');
            if (window.myChart) window.myChart.destroy();
            const data = Array(12).fill(0);
            invs.forEach(i => {
                const d = parseDate(i.date);
                if (!isNaN(d.getTime())) {
                    data[d.getMonth()] += (safeNum(i.total) - safeNum(i.discount));
                }
            });
            window.myChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [t('jan'), t('feb'), t('mar'), t('apr'), t('may'), t('jun'), t('jul'), t('aug'), t('sep'), t('oct'), t('nov'), t('dec')],
                    datasets: [{
                        label: t('sales'),
                        data: data,
                        borderColor: '#1e3a8a',
                        tension: 0.4,
                        fill: true,
                        backgroundColor: 'rgba(30, 58, 138, 0.05)',
                        borderWidth: 3,
                        pointBackgroundColor: '#1e3a8a',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 5
                    }]
                },
                options: {
                    animation: (typeof lowResourceMode !== 'undefined' && lowResourceMode) ? false : { duration: 1000 },
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            display: true,
                            grid: {
                                color: 'rgba(0,0,0,0.05)'
                            },
                            ticks: {
                                font: {
                                    family: 'Cairo',
                                    size: 10
                                }
                            }
                        },
                        x: {
                            ticks: {
                                font: {
                                    family: 'Cairo',
                                    size: 10,
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                color: 'rgba(0,0,0,0.05)'
                            }
                        }
                    }
                }
            });
        }