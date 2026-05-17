        function getNextInvoiceId(type) {
            const currentYear = new Date().getFullYear();
            const targetType = type === 'خدمة' ? 'خدمة' : 'بيع';
            
            // Filter invoices by type
            const invoices = (allData && allData.invoices) ? allData.invoices.filter(inv => inv.type === targetType) : [];
            
            let maxCounter = 0;
            
            invoices.forEach(inv => {
                const idStr = String(inv.id); // e.g. "0012.2026"
                const parts = idStr.split('.');
                if (parts.length === 2) {
                    const counter = parseInt(parts[0], 10);
                    const year = parseInt(parts[1], 10);
                    if (!isNaN(counter) && year === currentYear) {
                        if (counter > maxCounter) {
                            maxCounter = counter;
                        }
                    }
                }
            });
            
            const nextCounter = maxCounter + 1;
            const paddedCounter = String(nextCounter).padStart(4, '0');
            return `${paddedCounter}.${currentYear}`;
        }

        function toggleDiscountType() {
            const btn = document.getElementById('discountTypeBtn');
            const input = document.getElementById('discountType');
            const discInput = document.getElementById('iDiscount');

            if (input.value === 'amount') {
                input.value = 'percent';
                btn.innerText = '%';
                btn.className = "bg-blue-100 text-blue-600 px-2 rounded-l-xl font-black text-xs border border-l border-y border-blue-200 hover:bg-blue-200 transition-all w-12";
                discInput.placeholder = "0%";
            } else {
                input.value = 'amount';
                btn.innerText = 'د.م';
                btn.className = "bg-amber-100 text-amber-600 px-2 rounded-l-xl font-black text-xs border border-l border-y border-amber-200 hover:bg-amber-200 transition-all w-12";
                discInput.placeholder = "0.00";
            }
            applyDiscount();
        }

        function getNetTotal() {
            const total = cart.reduce((s, i) => s + (i.salePrice * i.selectedQty), 0);
            const discountInput = safeNum(document.getElementById('iDiscount').value);
            const type = document.getElementById('discountType').value;

            let discountAmount = 0;
            if (type === 'percent') {
                discountAmount = total * (discountInput / 100);
            } else {
                discountAmount = discountInput;
            }

            return Math.max(0, total - discountAmount);
        }

        function applyDiscount() {
            const netTotal = getNetTotal();
            document.getElementById('iNetTotal').innerText = formatCurrency(netTotal);
            // تحديث المبلغ المدفوع تلقائياً ليطابق الصافي فقط عند إنشاء فاتورة جديدة
            if (!isEditingInvoice) {
                document.getElementById('iPaid').value = netTotal.toFixed(2);
            }
            calcInvoiceBalance();
        }

        function calcInvoiceBalance() {
            const netTotal = getNetTotal();
            const paymentMethod = document.getElementById('iMethod').value;
            let paid = safeNum(document.getElementById('iPaid').value);

            // إذا كانت طريقة الدفع هي "دين"، تأكد من أن المبلغ المدفوع هو 0
            if (paymentMethod === 'دين') {
                paid = 0;
                document.getElementById('iPaid').value = 0;
            }

            let balance = netTotal - paid;
            document.getElementById('iBalance').value = formatCurrency(balance);
        }

        function toggleDueDateField() {
            const method = document.getElementById('iMethod').value;
            const dueDateField = document.getElementById('dueDateField');

            if (method === 'شيك' || method === 'كمبيالة') {
                dueDateField.classList.remove('hidden');
                // تعيين تاريخ افتراضي (بعد 30 يوم)
                const today = new Date();
                const dueDate = new Date(today.setDate(today.getDate() + 30));
                document.getElementById('iDueDate').value = dueDate.toISOString().split('T')[0];
            } else {
                dueDateField.classList.add('hidden');
                document.getElementById('iDueDate').value = '';
            }
        }

        function toggleServiceDueDateField() {
            const method = document.getElementById('servicePaymentMethod').value;
            const dueDateField = document.getElementById('serviceDueDateField');

            if (method === 'شيك' || method === 'كمبيالة') {
                dueDateField.classList.remove('hidden');
                const today = new Date();
                const dueDate = new Date(today.setDate(today.getDate() + 30));
                document.getElementById('serviceDueDate').value = dueDate.toISOString().split('T')[0];
            } else {
                dueDateField.classList.add('hidden');
                document.getElementById('serviceDueDate').value = '';
            }
        }

        function toggleInvoiceSettings() {
            const size = document.getElementById('settingInvoiceSize').value;
            const group = document.getElementById('settingInvoiceThermalGroup');
            if (size === 'Thermal') {
                group.classList.remove('hidden');
            } else {
                group.classList.add('hidden');
            }
        }

        function fillTotalInPaid() {
            const netTotal = getNetTotal();
            document.getElementById('iPaid').value = netTotal.toFixed(2);
            calcInvoiceBalance();
        }

        function fillServiceAmountInPaid() {
            const amount = safeNum(document.getElementById('serviceAmount').value);
            document.getElementById('servicePaid').value = amount;
            calculateServiceBalance();
        }

        function addDirectToCart(product) {
            const existing = cart.find(c => c.id === product.id);
            const availableQty = safeNum(product.qty);

            if (existing) {
                if (existing.selectedQty + 1 > availableQty) {
                    showToast(t('max_qty_error', { qty: availableQty }), 'error');
                    return;
                }
                existing.selectedQty += 1;
            } else {
                cart.push({
                    id: product.id,
                    name: product.name,
                    salePrice: safeNum(product.sale_price),
                    selectedQty: 1,
                    category: product.category || 'منتج',
                    unit_type: product.unit_type || 'وحدة'
                });
            }
            renderCart();
            showToast(t('added_to_cart', { name: product.name }));
        }

        function openInvoiceModal() {
            cart = [];
            isEditingInvoice = false;
            document.getElementById('invoiceModalMainTitle').innerText = t('create_invoice_title');
            const invoiceNumber = getNextInvoiceId('بيع');
            document.getElementById('invAutoId').innerText = 'INV-' + invoiceNumber;
            document.getElementById('iDate').value = new Date().toISOString().split('T')[0];

            // إعادة تعيين حقل الاستحقاق
            document.getElementById('dueDateField')?.classList.add('hidden');
            document.getElementById('iDueDate').value = '';

            // تعيين قائمة الزبناء
            const customerSelect = document.getElementById('iCustSelect');
            const customerInput = document.getElementById('iCustInput');
            customerSelect.innerHTML = `<option value="">${t('general_customer')}</option>`;
            customerSelect.value = '';
            customerInput.value = '';
            customerInput.classList.add('hidden');

            // تعبئة قائمة الزبناء
            const customers = allData.clients.filter(c => c.type === 'customer');
            customers.forEach(client => {
                customerSelect.innerHTML += `<option value="${client.id}">${client.name}</option>`;
            });

            document.getElementById('iMethod').value = 'صندوق';
            document.getElementById('iPaymentReference').value = '';
            document.getElementById('iPaid').value = 0;
            document.getElementById('iBalance').value = 0;
            document.getElementById('iDiscount').value = '';
            document.getElementById('discountType').value = 'amount';
            document.getElementById('discountTypeBtn').innerText = 'د.م';
            document.getElementById('iItemSearch').value = '';
            document.getElementById('searchResults').innerHTML = '';
            document.getElementById('searchResults').classList.add('hidden');
            document.getElementById('iNetTotal').innerText = '0.00';
            renderCart();
            openModal('invoiceModal');
            setTimeout(() => {
                const searchInput = document.getElementById('iItemSearch');
                if (searchInput) searchInput.focus();
            }, 100);
        }

        function renderCart() {
            const list = document.getElementById('iCart');
            let total = 0;
            list.innerHTML = '';

            if (cart.length === 0) {
                list.innerHTML = `
                    <li class="text-center p-4 text-slate-400 text-xs">
                        <i class="fas fa-shopping-cart mb-2 text-lg"></i>
                        <p>${t('cart_empty_hint')}</p>
                    </li>
                `;
            } else {
                cart.forEach((it, idx) => {
                    const sub = it.salePrice * it.selectedQty;
                    total += sub;

                    list.innerHTML += `<li class="flex justify-between items-center p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all">
                        <div>
                            <span class="font-bold text-xs text-slate-800">${it.name}</span>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-[9px] text-slate-500">${formatCurrency(it.salePrice)} × ${it.selectedQty} ${it.unit_type === 'متر' ? t('meter') : t('unit')}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-blue-600 font-black text-xs">${formatCurrency(sub)}</span>
                            <button onclick="removeFromCart(${idx})" class="text-rose-400 hover:text-rose-600 transition-colors">
                                <i class="fas fa-times-circle"></i>
                            </button>
                        </div>
                    </li>`;
                });
            }

            document.getElementById('iTotal').innerText = formatCurrency(total);
            applyDiscount();
        }

        function removeFromCart(index) {
            cart.splice(index, 1);
            renderCart();
        }

        function confirmInvoice() {
            if (cart.length === 0) return showToast(t('invoice_empty'), 'error');

            const total = cart.reduce((s, i) => s + (i.salePrice * i.selectedQty), 0);
            const netTotal = getNetTotal();
            const inputDiscountAmount = total - netTotal;

            const paymentMethod = document.getElementById('iMethod').value;
            let paid = safeNum(document.getElementById('iPaid').value);
            const saveBtn = document.getElementById('saveInvoiceBtn');

            let balance;
            let finalDiscount = 0, discountType = '', cancelledRemainder = 0;

            // ========== التعديل هنا: معالجة حالة "دين" ==========
            if (paymentMethod === 'دين') {
                // إذا كانت طريقة الدفع هي "دين"، تأكد من أن المبلغ المدفوع هو 0 والباقي هو الإجمالي
                paid = 0;
                balance = netTotal;
                document.getElementById('iPaid').value = 0;
                document.getElementById('iBalance').value = formatCurrency(balance);
            } else {
                balance = netTotal - paid;
            }
            // ========== نهاية التعديل ==========

            finalDiscount = inputDiscountAmount;
            if (inputDiscountAmount > 0) {
                const discountInput = document.getElementById('iDiscount').value;
                const type = document.getElementById('discountType').value;
                discountType = type === 'percent' ? `${t('discount')} ${discountInput}%` : t('discount');
            }

            const custSelect = document.getElementById('iCustSelect');
            const custInput = document.getElementById('iCustInput');

            // Récupérer la date d'échéance
            const dueDate = document.getElementById('iDueDate')?.value || null;

            // Créer l'objet facture
            const inv = {
                id: document.getElementById('invAutoId').innerText.replace('INV-', ''),
                date: document.getElementById('iDate').value,
                customer: custSelect.value ? allData.clients.find(c => c.id == custSelect.value)?.name : (custInput.value.trim() || t('general_customer')),
                customer_id: custSelect.value || '',
                payment_method: paymentMethod,
                payment_reference: document.getElementById('iPaymentReference').value,
                due_date: dueDate,
                items: cart.map(item => ({ ...item })), // Copie pour éviter les références
                total: total,
                paid: paid,
                balance: balance,
                discount: finalDiscount,
                discount_type: discountType || 'خصم',
                cancelled_remainder: cancelledRemainder,
                type: 'بيع'
            };

            setBtnLoading(saveBtn, true, t('saving'));

            // ========== MISE À JOUR LOCALE OPTIMISTE ==========

            // 1. Vérifier si la facture existe déjà
            const existingInvoiceIndex = allData.invoices.findIndex(i => i.id === inv.id);

            // 2. Sauvegarder la facture localement
            if (existingInvoiceIndex !== -1) {
                allData.invoices[existingInvoiceIndex] = inv;
                console.log('📝 Modification de la facture existante:', inv.id);
            } else {
                allData.invoices.unshift(inv);
                console.log('🆕 Création d\'une nouvelle facture:', inv.id);
            }

            // 3. Mettre à jour le stock (pour les nouvelles factures uniquement)
            if (existingInvoiceIndex === -1 && inv.type === 'بيع') {
                inv.items.forEach(item => {
                    const product = allData.inventory.find(p => p.id === item.id);
                    if (product) {
                        const oldQty = safeNum(product.qty);
                        product.qty = oldQty - item.selectedQty;
                        console.log(`📦 Stock mis à jour: ${product.name} (${oldQty} → ${product.qty})`);
                    }
                });
            }

            // 4. Gestion des chèques (même logique que précédemment)
            let newCheck = null;
            if (inv.payment_method === 'شيك' || inv.payment_method === 'كمبيالة') {
                if (allData.checks_promissory && allData.checks_promissory.length > 0) {
                    const avant = allData.checks_promissory.length;
                    allData.checks_promissory = allData.checks_promissory.filter(c =>
                        !(String(c.debt_id) === String(inv.id) && c.debt_type === 'invoice')
                    );
                    const apres = allData.checks_promissory.length;
                    if (avant !== apres) {
                        console.log(`🗑️ Suppression de ${avant - apres} ancien(s) chèque(s) pour facture ${inv.id}`);
                    }
                }
                if (inv.paid > 0) {
                    console.log('🆕 Création d\'un nouveau chèque pour facture:', inv.id);
                    newCheck = {
                        id: 'CHK-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                        reference: inv.payment_reference || '',
                        type: inv.payment_method,
                        amount: inv.paid,
                        date: inv.date,
                        due_date: inv.due_date || inv.date,
                        status: 'pending',
                        client_name: inv.customer,
                        debt_id: inv.id,
                        debt_type: 'invoice'
                    };
                    if (!allData.checks_promissory) allData.checks_promissory = [];
                    allData.checks_promissory.unshift(newCheck);
                }
            } else {
                if (allData.checks_promissory && allData.checks_promissory.length > 0) {
                    const avant = allData.checks_promissory.length;
                    allData.checks_promissory = allData.checks_promissory.filter(c =>
                        !(String(c.debt_id) === String(inv.id) && c.debt_type === 'invoice')
                    );
                    const apres = allData.checks_promissory.length;
                    if (avant !== apres) {
                        console.log(`🗑️ Suppression des chèques (méthode non-chèque) pour facture ${inv.id}`);
                    }
                }
            }

            // 5. Gestion des paiements
            if (inv.paid > 0) {
                if (allData.payments && allData.payments.length > 0) {
                    allData.payments = allData.payments.filter(p =>
                        !(String(p.debt_id) === String(inv.id) && p.debt_type === 'invoice')
                    );
                }
                const payRec = {
                    id: 'PAY-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                    date: inv.date,
                    type: 'customer',
                    client_id: inv.customer_id || '',
                    client_name: inv.customer,
                    method: inv.payment_method,
                    reference: inv.payment_reference || '',
                    amount: inv.paid,
                    description: t('initial_payment_invoice', { id: inv.id }),
                    debt_id: inv.id,
                    debt_type: 'invoice',
                    created_at: new Date().toISOString().split('T')[0]
                };
                if (!allData.payments) allData.payments = [];
                allData.payments.unshift(payRec);
            }

            // 6. Mise à jour immédiate de l'interface
            renderInvoices(getFilteredData(allData.invoices));
            renderDashboard(getFilteredData(allData.invoices), getFilteredData(allData.expenses));

            if (!document.getElementById('page-inventory').classList.contains('hidden')) {
                renderInventoryCards();
                calculateStockStats();
            }
            if (!document.getElementById('page-checks-promissory').classList.contains('hidden')) {
                renderChecksPromissory();
            }
            if (!document.getElementById('page-payments').classList.contains('hidden')) {
                renderPayments();
            }
            if (!document.getElementById('page-clients').classList.contains('hidden')) {
                renderClients();
            }

            checkDueDateAlerts();
            checkLowStockAlert();

            showToast(t('invoice_saved_locally'), 'success');

            // Impression automatique si configurée
            if (currentUser && currentUser.invoiceSize === 'Thermal') {
                console.log('🖨️ Impression automatique avec QZ Tray pour facture:', inv.id);
                if (typeof qz !== 'undefined') {
                    autoPrintThermalInvoice(inv.id);
                } else {
                    console.warn('⚠️ QZ Tray non disponible, utilisation de la méthode standard');
                    setTimeout(() => {
                        generateAndPrintInvoice(inv.id, 'Thermal', currentUser.invoiceWidth || 80);
                    }, 500);
                }
            }

            // ========== ENVOI AU SERVEUR EN ARRIÈRE-PLAN ==========
            google.script.run
                .withSuccessHandler(() => {
                    console.log('✅ Synchronisation serveur réussie pour facture:', inv.id);
                })
                .withFailureHandler((e) => {
                    console.error('❌ Échec synchronisation serveur:', e);
                    showToast('⚠️ فشلت المزامنة مع السيرفر، سيتم إعادة المحاولة', 'warning');
                    setTimeout(() => refreshData(), 2000);
                })
                .saveInvoice(inv, existingInvoiceIndex !== -1, currentDbId);

            if (newCheck) {
                google.script.run
                    .withSuccessHandler(() => {
                        console.log('✅ Synchronisation serveur réussie pour chèque/traite de facture:', newCheck.id);
                    })
                    .withFailureHandler((e) => {
                        console.error('❌ Échec synchronisation chèque/traite de facture:', e);
                    })
                    .saveCheckPromissory(newCheck, currentDbId);
            }

            setTimeout(() => setBtnLoading(saveBtn, false), 1000);
            closeModal('invoiceModal');

            // Réinitialiser le panier
            cart = [];
        }

        function selectPrintSize(size) {
            selectedPrintSize = size;
            document.querySelectorAll('.print-size-btn').forEach(btn => {
                btn.classList.remove('bg-blue-50', 'border-blue-500', 'text-blue-600');
                btn.classList.add('border-slate-100');
            });
            document.getElementById('btn' + size).classList.add('bg-blue-50', 'border-blue-500', 'text-blue-600');
            document.getElementById('btn' + size).classList.remove('border-slate-100');

            if (size === 'Thermal') {
                document.getElementById('thermalOptions').classList.remove('hidden');
            } else {
                document.getElementById('thermalOptions').classList.add('hidden');
            }
        }

        function downloadInvoiceTicketLocal(id) {
            // الطباعة مباشرة بناءً على الإعدادات
            const size = currentUser?.invoiceSize || 'A4';
            const width = currentUser?.invoiceWidth || 80;
            generateAndPrintInvoice(id, size, width);
        }

        function confirmPrintInvoice() {
            const id = document.getElementById('printInvoiceId').value;
            const width = document.getElementById('thermalWidth').value;
            closeModal('printOptionsModal');
            generateAndPrintInvoice(id, selectedPrintSize, width);
        }

        function generateAndPrintInvoice(id, size, thermalWidth) {
            const inv = allData.invoices.find(i => String(i.id) === String(id));
            if (!inv) {
                showToast(t('invoice_not_found_local'), 'error');
                return;
            }

            const ticketHTML = generateTicketHTML(inv, size, thermalWidth);
            const printWindow = window.open('', '_blank');
            const isRtl = currentLang === 'ar';
            const dir = isRtl ? 'rtl' : 'ltr';
            const align = isRtl ? 'right' : 'left';

            const primaryColor = document.getElementById('settingInvoiceColor') ? document.getElementById('settingInvoiceColor').value : (currentUser?.invoiceColor || '#000000');

            let pageSizeCSS = '';
            let containerCSS = '';

            if (size === 'Thermal') {
                pageSizeCSS = `@page { size: ${thermalWidth}mm auto; margin: 0; } body { width: ${thermalWidth}mm; margin: 0; padding: 5px; }`;
                containerCSS = `width: 100%; padding: 2px; font-size: 12px;`;
            } else {
                pageSizeCSS = `@page { size: ${size} portrait; margin: 0; } body { margin: 0; padding: 0; background: white; }`;
                containerCSS = `width: 100%; padding: 40px; box-sizing: border-box; max-width: 800px; margin: auto;`;
            }

            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="${currentLang}" dir="${dir}">
                <head>
                    <meta charset="UTF-8">
                    <title>فاتورة #${inv.id}</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    :root {
        --primary-color: ${primaryColor};
    }
    ${pageSizeCSS}
    body { 
        font-family: 'Cairo', sans-serif; 
        color: #000;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    * { box-sizing: border-box; }
    .ticket-container {
        ${containerCSS}
        background: white;
    }
    .text-start { text-align: ${align} !important; }
    .text-center { text-align: center !important; }
    
    @media print {
        body { margin: 0; }
        .no-print { display: none; }
    }
</style>

                </head>
                <body>
                    <div class="ticket-container">
                        ${ticketHTML}
                    </div>
                    <script>
                        window.onload = function() {
                            setTimeout(() => {
                                window.print();
                                // Auto close after print dialog is closed (works in Chrome)
                                window.onafterprint = function() {
                                    window.close();
                                };
                            }, 500);
                        };
                    <\/script>
                </body>
                </html>
            `);

            printWindow.document.close();
        }

        function previewInvoiceDesign() {
            const design = document.getElementById('settingInvoiceDesign').value;
            const container = document.getElementById('designPreviewContainer');
            if (!container) return;

            // === التعديل هنا: الحصول على اللون الحالي من عنصر الإعدادات ===
            const currentColor = document.getElementById('settingInvoiceColor').value;

            // حفظ اللون الحالي في currentUser مؤقتاً للمعاينة
            const originalColor = currentUser?.invoiceColor;
            if (currentUser) {
                currentUser.invoiceColor = currentColor;
            }
            // === نهاية التعديل ===

            // Create dummy invoice data for preview
            const dummyInvoice = {
                id: '12345',
                date: new Date().toISOString().split('T')[0],
                customer: 'زبون افتراضي',
                payment_method: 'صندوق',
                items: [
                    { name: 'منتج افتراضي 1', selectedQty: 2, salePrice: 150 },
                    { name: 'منتج افتراضي 2', selectedQty: 1, salePrice: 300.50 },
                    { name: 'خدمة افتراضية', selectedQty: 1, salePrice: 500 }
                ],
                total: 1100.50,
                paid: 1000,
                balance: 100.50,
                discount: 0,
                type: 'بيع'
            };

            const previewHTML = generateTicketHTML(dummyInvoice, 'A4', 80, design);

            container.innerHTML = previewHTML;
            openModal('designPreviewModal');

            // === استعادة اللون الأصلي بعد المعاينة ===
            if (currentUser && originalColor) {
                currentUser.invoiceColor = originalColor;
            }
            // === نهاية الاستعادة ===
        }

        function generateTicketHTML(invoiceData, size, thermalWidth, forceDesign = null) {
            const shopName = currentUser?.shopName || t('shop_name_placeholder');
            const shopLogo = currentUser?.shopLogo || '';
            const shopAddress = currentUser?.shopAddress || '';
            const shopPhone = currentUser?.shopPhone || '';
            const footerMessage = currentUser?.invoiceFooter || t('thank_you_msg');

            // استدعاء الدالة للحصول على اللون الحالي
            const primaryColor = getCurrentInvoiceColor();

            const design = forceDesign || currentUser?.invoiceDesign || 'standard';

            const isRtl = currentLang === 'ar';
            const align = isRtl ? 'right' : 'left';

            let itemsHTML = '';
            let total = 0;

            try {
                const items = typeof invoiceData.items === 'string' ? JSON.parse(invoiceData.items) : invoiceData.items;

                if (invoiceData.type === 'خدمة' && items.length > 0) {
                    const serviceItem = items[0];
                    const serviceDescription = serviceItem.name || 'خدمة';
                    const sub = serviceItem.salePrice * (serviceItem.selectedQty || 1);
                    total = sub;

                    itemsHTML += `
                <tr>
                    <td class="text-start" style="white-space: pre-line; word-wrap: break-word; border: 1px solid #000000; padding: 8px;">
                        ${serviceDescription}
                    </td>
                    <td style="border: 1px solid #000000; padding: 8px; text-align: center;">${serviceItem.selectedQty || 1}</td>
                    <td style="border: 1px solid #000000; padding: 8px; text-align: center;">${formatCurrency(serviceItem.salePrice)}</td>
                    <td style="border: 1px solid #000000; padding: 8px; text-align: center;">${formatCurrency(sub)}</td>
                </tr>
            `;
                } else {
                    items.forEach(it => {
                        const sub = it.salePrice * it.selectedQty;
                        total += sub;

                        itemsHTML += `
                    <tr>
                        <td class="text-start" style="border: 1px solid #000000; padding: 8px;">${it.name}</td>
                        <td style="border: 1px solid #000000; padding: 8px; text-align: center;">${it.selectedQty}</td>
                        <td style="border: 1px solid #000000; padding: 8px; text-align: center;">${formatCurrency(it.salePrice)}</td>
                        <td style="border: 1px solid #000000; padding: 8px; text-align: center;">${formatCurrency(sub)}</td>
                    </tr>
                `;
                    });
                }
            } catch (e) {
                console.error('Error parsing items:', e);
                itemsHTML = `<tr><td colspan="4" style="border: 1px solid #000000; padding: 8px; text-align: center; color: #999;">خطأ في تحميل البيانات</td></tr>`;
            }

            let paid = safeNum(invoiceData.paid || 0);
            let balance = safeNum(invoiceData.balance || 0);
            const discount = safeNum(invoiceData.discount || 0);
            const cancelledRemainder = safeNum(invoiceData.cancelled_remainder || 0);
            const netTotal = total - discount;

            let paymentsHTML = '';
            if (invoiceData.type === 'خدمة') {
                const relatedPayments = allData.payments ? allData.payments.filter(p => String(p.debt_id) === String(invoiceData.id) && p.debt_type === 'invoice') : [];
                if (relatedPayments.length > 0) {
                    paid = relatedPayments.reduce((sum, p) => sum + safeNum(p.amount), 0);
                    balance = netTotal - paid;

                    paymentsHTML = `
                <div class="payments-section">
                    <div class="payments-title">${t('payments_log') || 'سجل الدفوعات'}</div>
                    <table class="payments-table">
                        <thead>
                            <tr>
                                <th style="border: 1px solid #000000; padding: 5px; text-align: center;">${t('date')}</th>
                                <th style="border: 1px solid #000000; padding: 5px; text-align: center;">${t('payment_method')}</th>
                                <th style="border: 1px solid #000000; padding: 5px; text-align: center;">${t('amount_label') || 'المبلغ'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${relatedPayments.sort((a, b) => new Date(a.date) - new Date(b.date)).map(p => `
                                <tr>
                                    <td style="border: 1px solid #000000; padding: 5px; text-align: center;">${p.date}</td>
                                    <td style="border: 1px solid #000000; padding: 5px; text-align: center;">${translatePaymentMethod(p.method)}</td>
                                    <td style="border: 1px solid #000000; padding: 5px; text-align: center; font-weight: bold;">${formatCurrency(p.amount)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
                }
            }

            let paymentMethodText = invoiceData.payment_method;
            const paymentMethodMap = {
                'صندوق': 'cash',
                'شيك': 'check',
                'تحويل بنكي': 'transfer',
                'كمبيالة': 'promissory',
                'دين': 'debt'
            };
            if (paymentMethodMap[invoiceData.payment_method]) {
                paymentMethodText = t(paymentMethodMap[invoiceData.payment_method]);
            }

            const isThermal = size === 'Thermal';

            let customCSS = `
        <style>
            :root { --main-color: ${primaryColor}; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: ${isThermal ? '10px' : '12px'}; }
            th, td { border: 1px solid #000000 !important; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px solid #000000; padding-top: 10px; }
            .payments-section { margin: 15px 0; }
            .payments-title { font-weight: bold; margin-bottom: 5px; font-size: ${isThermal ? '11px' : '13px'}; border-bottom: 1px solid #000000; padding-bottom: 3px; }
            .payments-table th, .payments-table td { border: 1px solid #000000 !important; padding: 3px; text-align: center; font-size: ${isThermal ? '9px' : '11px'}; }
            .payments-table th { background-color: #f5f5f5; }
        </style>
    `;

            if (isThermal) {
                customCSS += `
            <style>
                .header-section { text-align: center; border-bottom: 2px solid #000000; padding-bottom: 10px; margin-bottom: 10px; }
                .shop-name { font-size: 16px; font-weight: 900; margin: 0; color: #000000; }
                .shop-details { font-size: 10px; margin: 2px 0; }
                .invoice-details { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 10px; border-bottom: 1px solid #000000; padding-bottom: 5px; }
                th { border-bottom: 1px solid #000000; border-top: 1px solid #000000; padding: 5px 2px; font-weight: bold; text-align: center; background-color: #f5f5f5; }
                td { padding: 5px 2px; text-align: center; border-bottom: 1px solid #000000; }
                .totals-section { display: flex; flex-direction: column; align-items: flex-end; font-size: 11px; margin-top: 10px; border-top: 1px solid #000000; padding-top: 5px; }
                .total-row { display: flex; justify-content: space-between; width: 100%; margin-bottom: 3px; }
                .total-row.final { font-weight: 900; font-size: 14px; border-top: 2px solid #000000; padding-top: 5px; margin-top: 5px; color: #000000; }
            </style>
        `;

                return customCSS + `
            <div class="header-section">
                ${shopLogo ? `<img src="${shopLogo}" style="max-height: 50px; margin-bottom: 5px;">` : ''}
                <div class="shop-name">${shopName}</div>
                ${shopAddress ? `<div class="shop-details">${shopAddress}</div>` : ''}
                ${shopPhone ? `<div class="shop-details">${shopPhone}</div>` : ''}
            </div>
            <div class="invoice-details">
                <div style="text-align: ${isRtl ? 'right' : 'left'}">
                    <strong>${t('invoice')} #${invoiceData.id}</strong><br>
                    ${t('date')}: ${invoiceData.date}
                </div>
                <div style="text-align: ${isRtl ? 'left' : 'right'}">
                    <strong>${t('customer')}: ${invoiceData.customer || t('general_customer')}</strong><br>
                    ${t('payment_method')}: ${paymentMethodText}
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th class="text-start" width="40%">${t('product_col')}</th>
                        <th width="15%">${t('qty_label')}</th>
                        <th width="20%">${t('price_col')}</th>
                        <th width="25%">${t('total_label')}</th>
                    </tr>
                </thead>
                <tbody>${itemsHTML}</tbody>
            </table>
            ${paymentsHTML}
            <div class="totals-section">
                <div class="total-row"><span>${t('total')}:</span><span>${formatCurrency(total)}</span></div>
                ${discount > 0 ? `<div class="total-row"><span>${t('discount')}:</span><span>-${formatCurrency(discount)}</span></div>
                <div class="total-row"><span>${t('net_total_label')}:</span><span>${formatCurrency(netTotal)}</span></div>` : ''}
                <div class="total-row"><span>${t('paid')}:</span><span>${formatCurrency(paid)}</span></div>
                <div class="total-row final"><span>${t('balance')}:</span><span>${formatCurrency(balance)}</span></div>
            </div>
            <div class="footer">${footerMessage}</div>
        `;
            } else {
                let templateHTML = '';

                if (design === 'modern') {
                    customCSS += `
                <style>
                    .invoice-box { border: 1px solid #000000; border-radius: 10px; overflow: hidden; }
                    .header-section { display: flex; justify-content: space-between; align-items: center; background-color: var(--main-color); color: white; padding: 20px; }
                    .shop-name { font-size: 24px; font-weight: 900; margin: 0; }
                    .shop-details { font-size: 12px; margin-top: 5px; opacity: 0.9; }
                    .invoice-title { font-size: 28px; font-weight: 900; text-transform: uppercase; }
                    .info-section { display: flex; justify-content: space-between; padding: 20px; border-bottom: 1px solid #000000; }
                    .info-block { flex: 1; }
                    .info-label { font-size: 10px; color: #64748b; font-weight: bold; margin-bottom: 3px; text-transform: uppercase; }
                    .info-value { font-size: 13px; font-weight: bold; color: #1e293b; }
                    table { margin: 0; width: 100%; border-collapse: collapse; }
                    th { background-color: #f8fafc; font-weight: bold; padding: 12px 15px; text-align: center; border: 1px solid #000000; }
                    td { padding: 12px 15px; border: 1px solid #000000; text-align: center; color: #334155; }
                    .totals-wrapper { display: flex; justify-content: flex-end; padding: 20px; background-color: #f8fafc; }
                    .totals-section { width: 300px; }
                    .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: #475569; }
                    .total-row.final { font-weight: 900; font-size: 18px; color: var(--main-color); border-top: 2px solid #000000; padding-top: 10px; margin-top: 5px; }
                </style>
            `;
                    templateHTML = `
                <div class="invoice-box">
                    <div class="header-section">
                        <div>
                            ${shopLogo ? `<img src="${shopLogo}" style="max-height: 60px; background: white; padding: 5px; border-radius: 8px; margin-bottom: 10px;">` : ''}
                            <div class="shop-name">${shopName}</div>
                            <div class="shop-details">${shopAddress} ${shopPhone ? ' | ' + shopPhone : ''}</div>
                        </div>
                        <div class="invoice-title">${t('invoice')}</div>
                    </div>
                    <div class="info-section">
                        <div class="info-block">
                            <div class="info-label">${t('invoice')} #</div>
                            <div class="info-value">${invoiceData.id}</div>
                        </div>
                        <div class="info-block">
                            <div class="info-label">${t('date')}</div>
                            <div class="info-value">${invoiceData.date}</div>
                        </div>
                        <div class="info-block">
                            <div class="info-label">${t('customer')}</div>
                            <div class="info-value">${invoiceData.customer || t('general_customer')}</div>
                        </div>
                        <div class="info-block">
                            <div class="info-label">${t('payment_method')}</div>
                            <div class="info-value">${paymentMethodText}</div>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th class="text-start">${t('product_col')}</th>
                                <th>${t('qty_label')}</th>
                                <th>${t('price_col')}</th>
                                <th style="text-align: ${isRtl ? 'left' : 'right'}">${t('total_label')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                    </table>
                    ${paymentsHTML}
                    <div class="totals-wrapper">
                        <div class="totals-section">
                            <div class="total-row"><span>${t('total')}:</span><span>${formatCurrency(total)}</span></div>
                            ${discount > 0 ? `<div class="total-row"><span>${t('discount')}:</span><span>-${formatCurrency(discount)}</span></div>
                            <div class="total-row"><span>${t('net_total_label')}:</span><span style="font-weight:bold; color:#1e293b;">${formatCurrency(netTotal)}</span></div>` : ''}
                            <div class="total-row"><span>${t('paid')}:</span><span>${formatCurrency(paid)}</span></div>
                            <div class="total-row final"><span>${t('balance')}:</span><span>${formatCurrency(balance)}</span></div>
                        </div>
                    </div>
                </div>
                <div class="footer">${footerMessage}</div>
            `;
                } else if (design === 'elegant') {
                    customCSS += `
                <style>
                    .invoice-wrapper { padding: 20px; border: 1px solid #000000; }
                    .header-elegant { display: flex; flex-direction: column; align-items: center; border-bottom: 2px solid #000000; padding-bottom: 20px; margin-bottom: 20px; }
                    .shop-name { font-size: 26px; font-weight: bold; color: var(--main-color); margin-top: 10px; letter-spacing: 1px; }
                    .invoice-meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .meta-box { border: 1px solid #000000; padding: 15px; border-radius: 5px; width: 48%; }
                    .meta-box h4 { margin: 0 0 10px 0; color: var(--main-color); font-size: 14px; border-bottom: 1px solid #000000; padding-bottom: 5px; }
                    table th { border-top: 2px solid #000000; border-bottom: 2px solid #000000; padding: 10px; background: transparent; color: #333; }
                    table td { padding: 10px; border-bottom: 1px solid #000000; }
                    .totals-elegant { margin-top: 20px; border: 1px solid #000000; padding: 15px; border-radius: 5px; width: 40%; margin-left: auto; ${isRtl ? 'margin-right: auto; margin-left: 0;' : ''} }
                    .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
                    .total-row.final { font-weight: bold; font-size: 16px; color: var(--main-color); border-top: 1px solid #000000; padding-top: 10px; }
                </style>
            `;
                    templateHTML = `
                <div class="invoice-wrapper">
                    <div class="header-elegant">
                        ${shopLogo ? `<img src="${shopLogo}" style="max-height: 80px;">` : ''}
                        <div class="shop-name">${shopName}</div>
                        <div style="color: #666; font-size: 12px; margin-top: 5px;">${shopAddress}</div>
                        <div style="color: #666; font-size: 12px;">${shopPhone}</div>
                    </div>
                    <div class="invoice-meta">
                        <div class="meta-box">
                            <h4>${t('invoice')} / INVOICE</h4>
                            <div><strong>No:</strong> #${invoiceData.id}</div>
                            <div><strong>Date:</strong> ${invoiceData.date}</div>
                        </div>
                        <div class="meta-box">
                            <h4>${t('customer')} / CLIENT</h4>
                            <div><strong>Name:</strong> ${invoiceData.customer || t('general_customer')}</div>
                            <div><strong>Payment:</strong> ${paymentMethodText}</div>
                        </div>
                    </div>
                    <tr>
                        <thead>
                            <tr>
                                <th class="text-start">${t('product_col')}</th>
                                <th>${t('qty_label')}</th>
                                <th>${t('price_col')}</th>
                                <th style="text-align: ${isRtl ? 'left' : 'right'}">${t('total_label')}</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHTML}</tbody>
                    </table>
                    ${paymentsHTML}
                    <div class="totals-elegant">
                        <div class="total-row"><span>${t('total')}:</span><span>${formatCurrency(total)}</span></div>
                        ${discount > 0 ? `<div class="total-row"><span>${t('discount')}:</span><span>-${formatCurrency(discount)}</span></div>
                        <div class="total-row"><span>${t('net_total_label')}:</span><span>${formatCurrency(netTotal)}</span></div>` : ''}
                        <div class="total-row"><span>${t('paid')}:</span><span>${formatCurrency(paid)}</span></div>
                        <div class="total-row final"><span>${t('balance')}:</span><span>${formatCurrency(balance)}</span></div>
                    </div>
                    <div class="footer">${footerMessage}</div>
                </div>
            `;
                } else if (design === 'classic') {
                    customCSS += `
                <style>
                    .header-classic { display: flex; justify-content: space-between; border-bottom: 3px double #000000; padding-bottom: 10px; margin-bottom: 20px; }
                    .shop-name { font-size: 28px; font-weight: bold; margin: 0; font-family: serif; color: var(--main-color); }
                    .invoice-title-classic { font-size: 24px; letter-spacing: 2px; font-weight: bold; color: #555; }
                    .info-table { width: 100%; margin-bottom: 20px; }
                    .info-table td { border: none; padding: 2px 0; text-align: ${isRtl ? 'right' : 'left'}; }
                    .main-table th { border: 1px solid #000000; background: #eee; padding: 8px; color: #000; }
                    .main-table td { border: 1px solid #000000; padding: 8px; color: #000; }
                    .totals-table { width: 40%; float: ${isRtl ? 'left' : 'right'}; margin-top: 10px; border-collapse: collapse; }
                    .totals-table td { border: 1px solid #000000; padding: 5px 8px; font-size: 13px; }
                    .clear { clear: both; }
                </style>
            `;
                    templateHTML = `
                <div class="header-classic">
                    <div>
                        ${shopLogo ? `<img src="${shopLogo}" style="max-height: 60px; margin-bottom: 10px;"><br>` : ''}
                        <div class="shop-name">${shopName}</div>
                        <div style="font-size: 12px; margin-top: 5px;">${shopAddress}</div>
                        <div style="font-size: 12px;">${shopPhone}</div>
                    </div>
                    <div style="text-align: ${isRtl ? 'left' : 'right'};">
                        <div class="invoice-title-classic">${t('invoice')}</div>
                        <div style="font-size: 14px; margin-top: 5px;">#${invoiceData.id}</div>
                        <div style="font-size: 12px; margin-top: 5px;">${invoiceData.date}</div>
                    </div>
                </div>
                
                <table class="info-table">
                    <tr>
                        <td width="50%"><strong>${t('customer')}:</strong> ${invoiceData.customer || t('general_customer')}</td>
                        <td width="50%"><strong>${t('payment_method')}:</strong> ${paymentMethodText}</td>
                    </tr>
                </table>

                <table class="main-table">
                    <thead>
                        <tr>
                            <th class="text-start">${t('product_col')}</th>
                            <th>${t('qty_label')}</th>
                            <th>${t('price_col')}</th>
                            <th>${t('total_label')}</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHTML}</tbody>
                </table>
                
                ${paymentsHTML}
                
                <table class="totals-table">
                    <tr><td><strong>${t('total')}</strong></td><td style="text-align: ${isRtl ? 'left' : 'right'}">${formatCurrency(total)}</td></tr>
                    ${discount > 0 ? `
                    <tr><td><strong>${t('discount')}</strong></td><td style="text-align: ${isRtl ? 'left' : 'right'}">-${formatCurrency(discount)}</td></tr>
                    <tr><td><strong>${t('net_total_label')}</strong></td><td style="text-align: ${isRtl ? 'left' : 'right'}">${formatCurrency(netTotal)}</td></tr>
                    ` : ''}
                    <tr><td><strong>${t('paid')}</strong></td><td style="text-align: ${isRtl ? 'left' : 'right'}">${formatCurrency(paid)}</td></tr>
                    <tr><td><strong style="color: var(--main-color); font-size: 15px;">${t('balance')}</strong></td><td style="text-align: ${isRtl ? 'left' : 'right'}; color: var(--main-color); font-weight: bold; font-size: 15px;">${formatCurrency(balance)}</td></tr>
                </table>
                <div class="clear"></div>
                <div class="footer">${footerMessage}</div>
            `;
                } else if (design === 'professional') {
                    customCSS += `
                <style>
                    .invoice-wrapper { border-top: 5px solid #000000; }
                    .header-pro { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 0; margin-bottom: 20px; border-bottom: 1px solid #000000; }
                    .shop-info-pro { text-align: ${align}; }
                    .shop-name-pro { font-size: 22px; font-weight: bold; color: #111; margin: 0; }
                    .invoice-title-pro { font-size: 28px; font-weight: bold; color: #888; text-transform: uppercase; }
                    .meta-pro { display: flex; justify-content: space-between; margin-bottom: 30px; }
                    .bill-to { background: #f9f9f9; padding: 15px; border-radius: 5px; width: 48%; border: 1px solid #000000; }
                    .invoice-data { text-align: ${isRtl ? 'left' : 'right'}; width: 48%; border: 1px solid #000000; padding: 15px; border-radius: 5px; }
                    .invoice-data div { margin-bottom: 5px; }
                    table th { background: var(--main-color); color: white; padding: 12px; border: 1px solid #000000; }
                    table td { padding: 12px; border: 1px solid #000000; }
                    .totals-pro { float: ${isRtl ? 'left' : 'right'}; width: 40%; margin-top: 20px; border: 1px solid #000000; padding: 15px; border-radius: 5px; }
                    .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #000000; }
                    .total-row.final { font-size: 18px; font-weight: bold; color: var(--main-color); border-top: 2px solid #000000; border-bottom: none; padding-top: 10px; }
                </style>
            `;
                    templateHTML = `
                <div class="invoice-wrapper">
                    <div class="header-pro">
                        <div class="shop-info-pro">
                            ${shopLogo ? `<img src="${shopLogo}" style="max-height: 60px; margin-bottom: 10px;">` : ''}
                            <div class="shop-name-pro">${shopName}</div>
                            <div>${shopAddress}</div>
                            <div>${shopPhone}</div>
                        </div>
                        <div class="invoice-title-pro">${t('invoice')}</div>
                    </div>
                    <div class="meta-pro">
                        <div class="bill-to">
                            <h4 style="margin:0 0 10px 0; color: #555;">${t('customer')}</h4>
                            <strong>${invoiceData.customer || t('general_customer')}</strong>
                        </div>
                        <div class="invoice-data">
                            <div><strong>${t('invoice')} #:</strong> ${invoiceData.id}</div>
                            <div><strong>${t('date')}:</strong> ${invoiceData.date}</div>
                            <div><strong>${t('payment_method')}:</strong> ${paymentMethodText}</div>
                        </div>
                    </div>
                    <table><thead><tr><th class="text-start">${t('product_col')}</th><th>${t('qty_label')}</th><th>${t('price_col')}</th><th style="text-align: ${isRtl ? 'left' : 'right'}">${t('total_label')}</th></tr></thead><tbody>${itemsHTML}</tbody></table>
                    <div class="totals-pro">
                        <div class="total-row"><span>${t('total')}:</span><span>${formatCurrency(total)}</span></div>
                        ${discount > 0 ? `<div class="total-row"><span>${t('discount')}:</span><span>-${formatCurrency(discount)}</span></div>` : ''}
                        <div class="total-row"><span>${t('paid')}:</span><span>${formatCurrency(paid)}</span></div>
                        <div class="total-row final"><span>${t('balance')}:</span><span>${formatCurrency(balance)}</span></div>
                    </div>
                    <div style="clear:both;"></div>
                    <div class="footer">${footerMessage}</div>
                </div>
            `;
                } else if (design === 'creative') {
                    customCSS += `
                <style>
                    .invoice-creative { display: flex; border: 1px solid #000000; box-shadow: 0 0 10px rgba(0,0,0,0.05); }
                    .sidebar-creative { background: var(--main-color); color: white; padding: 30px; width: 200px; text-align: center; border-right: 1px solid #000000; }
                    .main-creative { padding: 30px; flex: 1; }
                    .shop-name-creative { font-size: 20px; font-weight: bold; margin-top: 10px; }
                    .meta-creative { margin-top: 30px; font-size: 12px; }
                    .meta-creative div { margin-bottom: 8px; }
                    .header-creative { margin-bottom: 30px; }
                    .header-creative h2 { font-size: 32px; margin: 0; color: #333; }
                    table th { background: #f9f9f9; padding: 10px; border: 1px solid #000000; }
                    table td { padding: 10px; border: 1px solid #000000; }
                    .totals-creative { float: ${isRtl ? 'left' : 'right'}; width: 50%; margin-top: 20px; background: #f9f9f9; padding: 15px; border-radius: 5px; border: 1px solid #000000; }
                    .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
                    .total-row.final { font-weight: bold; font-size: 18px; color: var(--main-color); border-top: 2px solid #000000; margin-top: 5px; padding-top: 5px; }
                </style>
            `;
                    templateHTML = `
                <div class="invoice-creative">
                    <div class="sidebar-creative">
                        ${shopLogo ? `<img src="${shopLogo}" style="max-height: 80px; background: white; border-radius: 50%; padding: 5px;">` : ''}
                        <div class="shop-name-creative">${shopName}</div>
                        <div class="meta-creative">
                            <div><strong>${t('invoice')} #:</strong> ${invoiceData.id}</div>
                            <div><strong>${t('date')}:</strong> ${invoiceData.date}</div>
                        </div>
                    </div>
                    <div class="main-creative">
                        <div class="header-creative">
                            <h2>${t('invoice')}</h2>
                            <div><strong>${t('customer')}:</strong> ${invoiceData.customer || t('general_customer')}</div>
                        </div>
                        <table><thead><tr><th class="text-start">${t('product_col')}</th><th>${t('qty_label')}</th><th>${t('price_col')}</th><th style="text-align: ${isRtl ? 'left' : 'right'}">${t('total_label')}</th></tr></thead><tbody>${itemsHTML}</tbody></table>
                        <div class="totals-creative">
                            <div class="total-row"><span>${t('total')}:</span><span>${formatCurrency(total)}</span></div>
                            ${discount > 0 ? `<div class="total-row"><span>${t('discount')}:</span><span>-${formatCurrency(discount)}</span></div>` : ''}
                            <div class="total-row"><span>${t('paid')}:</span><span>${formatCurrency(paid)}</span></div>
                            <div class="total-row final"><span>${t('balance')}:</span><span>${formatCurrency(balance)}</span></div>
                        </div>
                        <div style="clear:both;"></div>
                    </div>
                </div>
            `;
                } else if (design === 'minimalist') {
                    customCSS += `
                <style>
                    .header-minimalist { padding-bottom: 20px; margin-bottom: 40px; border-bottom: 1px solid #000000; }
                    .shop-name-minimalist { font-size: 16px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; }
                    .meta-minimalist { display: flex; justify-content: space-between; margin-bottom: 40px; font-size: 13px; }
                    table { border: none; border-collapse: collapse; }
                    table th { border-bottom: 1px solid #000000; border-top: 1px solid #000000; padding: 10px 0; text-align: ${align}; font-weight: bold; }
                    table td { padding: 10px 0; border-bottom: 1px solid #000000; }
                    .totals-minimalist { float: ${isRtl ? 'left' : 'right'}; width: 35%; margin-top: 20px; border: 1px solid #000000; padding: 15px; }
                    .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
                    .total-row.final { font-weight: bold; font-size: 16px; border-top: 1px solid #000000; }
                </style>
            `;
                    templateHTML = `
                <div>
                    <div class="header-minimalist">
                        <div class="shop-name-minimalist">${shopName}</div>
                    </div>
                    <div class="meta-minimalist">
                        <div><strong>${t('customer')}:</strong><br>${invoiceData.customer || t('general_customer')}</div>
                        <div style="text-align: ${isRtl ? 'left' : 'right'};"><strong>${t('invoice')} #:</strong> ${invoiceData.id}<br><strong>${t('date')}:</strong> ${invoiceData.date}</div>
                    </div>
                    <table><thead><tr><th class="text-start">${t('product_col')}</th><th>${t('qty_label')}</th><th>${t('price_col')}</th><th style="text-align: ${isRtl ? 'left' : 'right'}">${t('total_label')}</th></tr></thead><tbody>${itemsHTML}</tbody></table>
                    <div class="totals-minimalist">
                        <div class="total-row"><span>${t('total')}:</span><span>${formatCurrency(total)}</span></div>
                        <div class="total-row final"><span>${t('net_total_label')}:</span><span>${formatCurrency(netTotal)}</span></div>
                    </div>
                    <div style="clear:both;"></div>
                </div>
            `;
                } else {
                    customCSS += `
                <style>
                    .header-section { text-align: center; border-bottom: 2px solid #000000; padding-bottom: 15px; margin-bottom: 20px; }
                    .shop-name { font-size: 24px; font-weight: 900; margin: 0; color: #000000; }
                    .shop-details { font-size: 12px; margin: 5px 0; }
                    .invoice-details { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid #000000; padding-bottom: 15px; }
                    th { background-color: #f1f5f9; border: 1px solid #000000; padding: 10px; font-weight: bold; text-align: center; }
                    td { border: 1px solid #000000; padding: 10px; text-align: center; }
                    .totals-section { display: flex; flex-direction: column; align-items: flex-end; margin-top: 20px; font-size: 14px; }
                    .total-row { display: flex; justify-content: space-between; width: 40%; margin-bottom: 5px; }
                    .total-row.final { font-weight: 900; font-size: 18px; border-top: 2px solid #000000; padding-top: 10px; margin-top: 10px; color: #000000; }
                </style>
            `;
                    templateHTML = `
                <div class="header-section">
                    ${shopLogo ? `<img src="${shopLogo}" style="max-height: 80px; margin-bottom: 10px;">` : ''}
                    <div class="shop-name">${shopName}</div>
                    ${shopAddress ? `<div class="shop-details">${shopAddress}</div>` : ''}
                    ${shopPhone ? `<div class="shop-details">${shopPhone}</div>` : ''}
                </div>
                <div class="invoice-details">
                    <div style="text-align: ${isRtl ? 'right' : 'left'}">
                        <strong style="font-size: 16px; color: #000000;">${t('invoice')} #${invoiceData.id}</strong><br>
                        <span style="color: #64748b; margin-top: 5px; display: inline-block;">${t('date')}: ${invoiceData.date}</span>
                    </div>
                    <div style="text-align: ${isRtl ? 'left' : 'right'}">
                        <strong>${t('customer')}: ${invoiceData.customer || t('general_customer')}</strong><br>
                        <span style="color: #64748b; margin-top: 5px; display: inline-block;">${t('payment_method')}: ${paymentMethodText}</span>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th class="text-start">${t('product_col')}</th>
                            <th>${t('qty_label')}</th>
                            <th>${t('price_col')}</th>
                            <th style="text-align: ${isRtl ? 'left' : 'right'}">${t('total_label')}</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHTML}</tbody>
                </table>
                ${paymentsHTML}
                <div class="totals-section">
                    <div class="total-row"><span>${t('total')}:</span><span>${formatCurrency(total)}</span></div>
                    ${discount > 0 ? `<div class="total-row"><span>${t('discount')}:</span><span style="color: #ef4444;">-${formatCurrency(discount)}</span></div>
                    <div class="total-row"><span>${t('net_total_label')}:</span><span style="font-weight:bold;">${formatCurrency(netTotal)}</span></div>` : ''}
                    <div class="total-row"><span>${t('paid')}:</span><span style="color: #10b981;">${formatCurrency(paid)}</span></div>
                    <div class="total-row final"><span>${t('balance')}:</span><span>${formatCurrency(balance)}</span></div>
                </div>
                <div class="footer">${footerMessage}</div>
            `;
                }

                return customCSS + templateHTML;
            }
        }

        function renderInvoices(fInvs, q = '') {
            const container = document.getElementById('invoicesList');
            container.innerHTML = '';

            let filteredInvs = fInvs;
            if (q) {
                filteredInvs = fInvs.filter(inv => 
                    String(inv.id).toLowerCase().includes(q) || 
                    (inv.customer || '').toLowerCase().includes(q) ||
                    (inv.payment_reference || '').toLowerCase().includes(q) ||
                    (inv.type || '').toLowerCase().includes(q)
                );
            }

            if (filteredInvs.length === 0) {
                container.innerHTML = `
            <div class="text-center p-8 bg-white rounded-3xl shadow-sm">
                <i class="fas fa-file-invoice-dollar text-4xl text-slate-300 mb-4"></i>
                <p class="text-slate-400 font-bold">${q ? t('no_results_for', { term: q }) : t('no_invoices_current')}</p>
            </div>
        `;
                return;
            }

            const limit = q ? 100 : 30;
            const itemsToShow = filteredInvs.slice(0, limit);

            itemsToShow.forEach(inv => {
                const isDebt = safeNum(inv.balance) > 0;
                const hasDiscount = safeNum(inv.discount) > 0;
                const hasCancelledRemainder = safeNum(inv.cancelled_remainder) > 0;

                const invoiceType = inv.type === 'خدمة' ?
                    `<span class="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-[7px] me-2">${t('service')}</span>` :
                    `<span class="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[7px] me-2">${t('invoice')}</span>`;

                const discountBadge = hasDiscount ?
                    `<span class="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-[7px] me-2" title="${t('discount')}: ${formatCurrency(inv.discount)}">${t('discount')}</span>` : '';

                const cancelBadge = hasCancelledRemainder ?
                    `<span class="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full text-[7px] me-2" title="${t('cancel_remainder')}: ${formatCurrency(inv.cancelled_remainder)}">${t('cancel_remainder')}</span>` : '';

                // ترجمة طريقة الدفع
                let paymentMethodText = inv.payment_method;
                const pmMap = { 'صندوق': 'cash', 'شيك': 'check', 'تحويل بنكي': 'transfer', 'كمبيالة': 'promissory', 'دين': 'debt' };
                if (pmMap[inv.payment_method]) paymentMethodText = t(pmMap[inv.payment_method]);

                // ترجمة نوع الخصم
                let discountText = inv.discount_type;
                if (discountText) {
                    if (discountText.includes('خصم')) discountText = discountText.replace('خصم', t('discount'));
                    else if (discountText.includes('Discount')) discountText = discountText.replace('Discount', t('discount'));
                    else if (discountText.includes('Remise')) discountText = discountText.replace('Remise', t('discount'));
                }

                // --- التعديل هنا: تحديد الأزرار بناءً على الصلاحية ---
                // نعرض أزرار التعديل والحذف فقط إذا كان المستخدم "admin"
                const adminButtons = currentUser && currentUser.role === 'admin' ? `
            <button onclick="editInvoice('${inv.id}')" class="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-blue-500 hover:bg-slate-100 transition-all" title="${t('edit')}">
                <i class="fas fa-edit"></i>
            </button>
            <button onclick="promptDeleteInvoice('${inv.id}')" class="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-rose-500 hover:bg-slate-100 transition-all" title="${t('cancel')}">
                <i class="fas fa-undo"></i>
            </button>
        ` : ''; // إذا كان موظفاً، المتغير يكون فارغاً

                container.innerHTML += `<div class="bg-white p-4 rounded-3xl shadow-sm flex flex-wrap justify-between items-center gap-3 border-r-4 ${isDebt ? 'border-amber-400' : 'border-emerald-400'}">
            <div class="flex-1">
                <h4 class="font-black text-slate-800 text-xs mb-1 flex items-center flex-wrap gap-1">
                    ${invoiceType} ${discountBadge} ${cancelBadge} <span class="text-slate-400 font-bold">#${inv.id}</span>
                </h4>
                <p class="text-[9px] text-slate-400 font-bold">${t('customer')}: ${inv.customer}</p>
                <p class="text-[9px] text-slate-400">${inv.date} • ${paymentMethodText}</p>
                ${inv.payment_reference ? `<p class="text-[9px] text-blue-600 font-bold">${t('reference_label')}: ${inv.payment_reference}</p>` : ''}
                ${inv.discount_type ? `<p class="text-[9px] text-amber-600 font-bold">${discountText}: ${formatCurrency(inv.discount)}</p>` : ''}
            </div>
            <div class="flex gap-4">
                <div class="text-center">
                    <p class="text-[7px] text-slate-400 uppercase font-black">${t('total')}</p>
                    <p class="font-black text-blue-600 text-xs">${formatCurrency(inv.total)}</p>
                </div>
                <div class="text-center">
                    <p class="text-[7px] text-slate-400 uppercase font-black">${t('paid')}</p>
                    <p class="font-black text-emerald-600 text-xs">${formatCurrency(inv.paid)}</p>
                </div>
                <div class="text-center">
                    <p class="text-[7px] text-slate-400 uppercase font-black">${t('balance')}</p>
                    <p class="font-black ${isDebt ? 'text-rose-600' : 'text-slate-400'} text-xs">${formatCurrency(inv.balance)}</p>
                </div>
            </div>
            <div class="flex gap-1">
                <button onclick="downloadInvoiceTicketLocal('${inv.id}')" 
                        class="p-2 bg-blue-50 text-blue-400 rounded-lg hover:text-blue-600 hover:bg-blue-100 transition-all" 
                        title="${t('print')}">
                    <i class="fas fa-print"></i>
                </button>
                ${adminButtons} </div>
        </div>`;
            });

            if (!q && filteredInvs.length > limit) {
                container.innerHTML += `
                <div class="text-center py-4 bg-white rounded-3xl shadow-sm mt-2">
                    <p class="text-slate-400 text-xs font-bold mb-2">${t('search_results_stats', { filtered: limit, total: filteredInvs.length })}</p>
                    <p class="text-slate-300 text-[10px]">${t('use_search_hint')}</p>
                </div>`;
            }
        }

        function getCurrentInvoiceColor() {
            // الأولوية القصوى لعنصر الإعدادات في DOM
            const colorInput = document.getElementById('settingInvoiceColor');
            if (colorInput && colorInput.value) {
                return colorInput.value;
            }

            // الثاني: من currentUser
            if (currentUser && currentUser.invoiceColor) {
                return currentUser.invoiceColor;
            }

            // الثالث: من localStorage
            const savedColor = localStorage.getItem('invoiceColor');
            if (savedColor) {
                return savedColor;
            }

            // الافتراضي: أسود
            return '#000000';
        }

        function applyInvoiceColorToUI() {
            const colorInput = document.getElementById('settingInvoiceColor');
            if (!colorInput) return;

            let color = colorInput.value;

            // إذا كان اللون أسود أو غير محدد، نحاول استعادته من localStorage
            if (!color || color === '#000000') {
                const savedColor = localStorage.getItem('invoiceColor');
                if (savedColor && savedColor !== '#000000') {
                    color = savedColor;
                    colorInput.value = color;
                    if (currentUser) currentUser.invoiceColor = color;
                }
            }

            // تطبيق اللون على عناصر المعاينة إذا كانت موجودة
            const previewContainer = document.getElementById('designPreviewContainer');
            if (previewContainer && previewContainer.innerHTML) {
                // تحديث المعاينة إذا كانت مفتوحة
                const styleElements = previewContainer.querySelectorAll('style');
                styleElements.forEach(style => {
                    let css = style.innerHTML;
                    css = css.replace(/--main-color:\s*#[^;]+;/g, `--main-color: ${color};`);
                    style.innerHTML = css;
                });
            }

            console.log('🎨 لون الفاتورة الحالي:', color);
        }

        function promptDeleteInvoice(id) {
            openConfirm({
                title: t('cancel_invoice_title'),
                msg: t('cancel_invoice_msg'),
                iconClass: "fas fa-undo",
                colorClass: "bg-amber-600",
                onConfirm: () => {
                    // إغلاق نافذة التأكيد فوراً
                    closeConfirm();

                    // البحث عن الفاتورة قبل الحذف
                    const inv = allData.invoices.find(i => String(i.id) === String(id));
                    if (!inv) {
                        showToast('الفاتورة غير موجودة', 'error');
                        return;
                    }

                    console.log('=== بداية حذف الفاتورة ===');
                    console.log('الفاتورة:', inv.id, inv.type);
                    console.log('عدد الشيكات قبل الحذف:', allData.checks_promissory?.length || 0);

                    // 1. استرجاع المخزون محلياً إذا كانت فاتورة بيع
                    if (inv.type === 'بيع' && inv.items) {
                        try {
                            const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
                            items.forEach(item => {
                                const product = allData.inventory.find(x => String(x.id) === String(item.id));
                                if (product) {
                                    const oldQty = safeNum(product.qty);
                                    const newQty = oldQty + safeNum(item.selectedQty);
                                    product.qty = newQty;
                                    console.log(`تم استرجاع ${item.selectedQty} من ${product.name} (${oldQty} → ${newQty})`);
                                }
                            });
                        } catch (e) {
                            console.error('خطأ في استرجاع المخزون:', e);
                        }
                    }

                    // 2. حذف الشيكات والكمبيالات المرتبطة محلياً - الطريقة المضمونة
                    if (allData.checks_promissory && allData.checks_promissory.length > 0) {
                        // إنشاء مصفوفة جديدة تحتوي على الشيكات غير المرتبطة فقط
                        const remainingChecks = [];

                        for (let i = 0; i < allData.checks_promissory.length; i++) {
                            const check = allData.checks_promissory[i];

                            // إذا كان الشيك غير مرتبط بهذه الفاتورة، احتفظ به
                            if (!(String(check.debt_id) === String(id) && check.debt_type === 'invoice')) {
                                remainingChecks.push(check);
                                console.log('الاحتفاظ بشيك غير مرتبط:', check.id, check.reference);
                            } else {
                                console.log('حذف شيك مرتبط:', check.id, check.reference, check.amount);
                            }
                        }

                        // استبدال المصفوفة القديمة بالمصفوفة الجديدة
                        allData.checks_promissory = remainingChecks;

                        console.log('عدد الشيكات بعد الحذف:', allData.checks_promissory.length);
                    }

                    // 3. حذف الدفعات المرتبطة محلياً
                    if (allData.payments && allData.payments.length > 0) {
                        const remainingPayments = [];

                        for (let i = 0; i < allData.payments.length; i++) {
                            const payment = allData.payments[i];

                            if (!(String(payment.debt_id) === String(id) && payment.debt_type === 'invoice')) {
                                remainingPayments.push(payment);
                            } else {
                                console.log('حذف دفعة مرتبطة:', payment.id, payment.amount);
                            }
                        }

                        allData.payments = remainingPayments;
                        console.log('عدد الدفعات بعد الحذف:', allData.payments.length);
                    }

                    // 4. حذف الفاتورة نفسها من المصفوفة المحلية
                    const invoiceIndex = allData.invoices.findIndex(i => String(i.id) === String(id));
                    if (invoiceIndex !== -1) {
                        allData.invoices.splice(invoiceIndex, 1);
                        console.log('تم حذف الفاتورة من المصفوفة المحلية');
                    }

                    // 5. تحديث الواجهات فوراً
                    renderInvoices(getFilteredData(allData.invoices));
                    renderDashboard(getFilteredData(allData.invoices), getFilteredData(allData.expenses));

                    // تحديث صفحة الشيكات إذا كانت مفتوحة
                    if (!document.getElementById('page-checks-promissory').classList.contains('hidden')) {
                        renderChecksPromissory();
                    }

                    // تحديث صفحة الدفعات إذا كانت مفتوحة
                    if (!document.getElementById('page-payments').classList.contains('hidden')) {
                        renderPayments();
                    }

                    // تحديث صفحة المخزون إذا كانت مفتوحة
                    if (!document.getElementById('page-inventory').classList.contains('hidden')) {
                        renderInventoryCards();
                        calculateStockStats();
                    }

                    // تحديث التنبيهات
                    checkDueDateAlerts();
                    checkLowStockAlert();

                    console.log('=== نهاية حذف الفاتورة ===');
                    console.log('عدد الشيكات النهائي:', allData.checks_promissory?.length || 0);

                    showToast('✅ تم حذف الفاتورة وجميع البيانات المرتبطة محلياً', 'success');

                    // 6. إرسال للسيرفر في الخلفية
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
                        .deleteInvoice(id, currentDbId);
                }
            });
        }

        function editInvoice(id) {
            const inv = allData.invoices.find(i => String(i.id) === String(id));
            if (!inv) return;

            if (inv.type === 'خدمة') {
                openServiceModal(inv);
                return;
            }

            isEditingInvoice = true;
            cart = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;

            document.getElementById('invoiceModalMainTitle').innerText = t('edit') + " " + t('invoice');
            document.getElementById('invAutoId').innerText = 'INV-' + inv.id;
            document.getElementById('iDate').value = inv.date;

            // إظهار حقل الاستحقاق إذا كان موجوداً
            if (inv.payment_method === 'شيك' || inv.payment_method === 'كمبيالة') {
                document.getElementById('dueDateField').classList.remove('hidden');
                document.getElementById('iDueDate').value = inv.due_date || '';
            } else {
                document.getElementById('dueDateField').classList.add('hidden');
            }
            // تعيين الزبون
            const customerSelect = document.getElementById('iCustSelect');
            const customerInput = document.getElementById('iCustInput');
            customerSelect.value = inv.customer_id || '';
            if (inv.customer_id) {
                customerInput.classList.add('hidden');
            } else {
                customerInput.value = inv.customer;
                customerInput.classList.remove('hidden');
            }

            document.getElementById('iMethod').value = inv.payment_method;
            document.getElementById('iPaymentReference').value = inv.payment_reference || '';
            document.getElementById('iPaid').value = safeNum(inv.paid);
            document.getElementById('iDiscount').value = safeNum(inv.discount) || '';
            document.getElementById('discountType').value = 'amount'; // Default to amount in edit

            document.getElementById('iItemSearch').value = '';
            document.getElementById('searchResults').innerHTML = '';
            document.getElementById('searchResults').classList.add('hidden');

            applyDiscount(); // Recalculate net total
            renderCart();
            openModal('invoiceModal');
        }

        function deleteInvoice(id, dbId) {
            const ss = getDb(dbId);
            const sheet = ss.getSheetByName("Invoices");
            const data = sheet.getDataRange().getValues();

            for (let i = 1; i < data.length; i++) {
                if (data[i][0] == id) {
                    const type = data[i][13]; // Type column (14)
                    const itemsJson = data[i][6]; // Items column (7)
                    const paymentMethod = data[i][4]; // payment_method column (5)
                    const paymentRef = data[i][5]; // payment_reference column (6)

                    // استرجاع المخزون إذا كانت فاتورة بيع
                    if (type === 'بيع' && itemsJson) {
                        try {
                            const items = JSON.parse(itemsJson);
                            const invSheet = ss.getSheetByName("Inventory");
                            const invData = invSheet.getDataRange().getValues();

                            items.forEach(item => {
                                for (let j = 1; j < invData.length; j++) {
                                    if (invData[j][0] == item.id) {
                                        const currentQty = Number(invData[j][4]);
                                        invSheet.getRange(j + 1, 5).setValue(currentQty + Number(item.selectedQty));
                                        break;
                                    }
                                }
                            });
                        } catch (e) { }
                    }

                    // حذف الشيكات والكمبيالات المرتبطة بهذه الفاتورة
                    const checkSheet = ss.getSheetByName("ChecksPromissory");
                    if (checkSheet) {
                        const checkData = checkSheet.getDataRange().getValues();
                        for (let k = checkData.length - 1; k >= 1; k--) {
                            // حذف إذا كان debt_id يطابق id الفاتورة و debt_type هو 'invoice'
                            if (checkData[k][8] == id && checkData[k][9] == 'invoice') {
                                checkSheet.deleteRow(k + 1);
                            }
                        }
                    }

                    // حذف الدفعات المرتبطة بالفاتورة
                    const paySheet = ss.getSheetByName("Payments");
                    const payData = paySheet.getDataRange().getValues();
                    for (let j = payData.length - 1; j >= 1; j--) {
                        if (payData[j][9] == id && payData[j][10] == 'invoice') {
                            paySheet.deleteRow(j + 1);
                        }
                    }

                    // حذف الفاتورة نفسها
                    sheet.deleteRow(i + 1);

                    return { success: true };
                }
            }
            return { success: false };
        }

        function onServiceAmountChange() {
            const amount = document.getElementById('serviceAmount').value;
            document.getElementById('servicePaid').value = amount;
            calculateServiceBalance();
        }

        function openServiceModal(inv = null) {
            const customerSelect = document.getElementById('serviceCustomerSelect');
            const customerInput = document.getElementById('serviceCustomerInput');

            // إعادة تعيين القائمة
            customerSelect.innerHTML = `<option value="">${t('general_customer')}</option>`;
            const customers = allData.clients.filter(c => c.type === 'customer');
            customers.forEach(client => {
                customerSelect.innerHTML += `<option value="${client.id}">${client.name}</option>`;
            });

            if (inv) {
                document.getElementById('serviceId').value = inv.id;
                document.getElementById('serviceAutoId').innerText = 'SERV-' + inv.id;
                document.getElementById('serviceDate').value = inv.date;
                document.getElementById('serviceDescription').value = inv.description || (inv.items && inv.items[0] ? inv.items[0].name : '');

                let parsedItems = [];
                try {
                    parsedItems = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
                } catch (e) { }
                document.getElementById('serviceDescription').value = inv.description || (parsedItems.length > 0 ? parsedItems[0].name : '');

                document.getElementById('serviceAmount').value = inv.total;
                document.getElementById('servicePaid').value = inv.paid;
                document.getElementById('serviceBalance').value = inv.balance;
                document.getElementById('servicePaymentMethod').value = inv.payment_method;
                document.getElementById('servicePaymentReference').value = inv.payment_reference || '';

                // تفعيل حقل تاريخ الاستحقاق إذا كان موجوداً
                if (inv.due_date) {
                    document.getElementById('serviceDueDate').value = inv.due_date;
                }

                if (inv.customer_id) {
                    customerSelect.value = inv.customer_id;
                    customerInput.classList.add('hidden');
                } else {
                    customerSelect.value = "";
                    customerInput.value = inv.customer;
                    customerInput.classList.remove('hidden');
                }
                document.getElementById('saveServiceBtn').innerText = t('save_changes_btn');

                // استدعاء الدالة لتحديث ظهور حقل التاريخ حسب طريقة الدفع
                toggleServiceDueDateField();

            } else {
                const serviceNumber = getNextInvoiceId('خدمة');
                document.getElementById('serviceId').value = serviceNumber;
                document.getElementById('serviceAutoId').innerText = 'SERV-' + serviceNumber;
                document.getElementById('serviceDate').value = new Date().toISOString().split('T')[0];
                customerSelect.value = '';
                customerInput.value = '';
                customerInput.classList.add('hidden');

                document.getElementById('serviceDescription').value = '';
                document.getElementById('serviceAmount').value = '';
                document.getElementById('servicePaid').value = '';
                document.getElementById('serviceBalance').value = '';
                document.getElementById('servicePaymentMethod').value = 'صندوق';
                document.getElementById('servicePaymentReference').value = '';
                document.getElementById('serviceDueDate').value = '';
                document.getElementById('saveServiceBtn').innerText = t('save_invoice_btn');

                // استدعاء الدالة لتحديث ظهور حقل التاريخ (سيتم إخفاؤه لأن القيمة افتراضياً 'صندوق')
                toggleServiceDueDateField();
            }

            openModal('serviceModal');
            if (!inv) document.getElementById('serviceCustomerSelect').focus();
        }

        function calculateServiceBalance() {
            const amount = safeNum(document.getElementById('serviceAmount').value);
            const paid = safeNum(document.getElementById('servicePaid').value);
            document.getElementById('serviceBalance').value = (amount - paid).toFixed(2);
        }

        function saveServiceInvoice() {
            const customerSelect = document.getElementById('serviceCustomerSelect');
            const customerInput = document.getElementById('serviceCustomerInput');
            let customerName = '';
            let customerId = '';
            const saveBtn = document.getElementById('saveServiceBtn');

            if (customerSelect.value) {
                const customer = allData.clients.find(c => c.id === customerSelect.value);
                customerName = customer ? customer.name : t('general_customer');
                customerId = customerSelect.value;
            } else if (customerInput.value.trim()) {
                customerName = customerInput.value.trim();
            } else {
                customerName = t('general_customer');
            }

            const id = document.getElementById('serviceId').value;
            const isEditing = allData.invoices.some(i => String(i.id) === String(id));

            const serviceDescription = document.getElementById('serviceDescription').value.trim();
            const serviceAmount = safeNum(document.getElementById('serviceAmount').value);
            const paymentMethod = document.getElementById('servicePaymentMethod').value;
            const paymentReference = document.getElementById('servicePaymentReference').value.trim();
            const dueDate = document.getElementById('serviceDueDate')?.value || null;

            const serviceData = {
                id: id || 'SERV-' + Date.now().toString().slice(-6),
                date: document.getElementById('serviceDate').value,
                customer: customerName,
                customer_id: customerId,
                payment_method: paymentMethod,
                payment_reference: paymentReference,
                due_date: dueDate,
                items: [{
                    id: 'SERVICE-' + Date.now().toString().slice(-4),
                    name: serviceDescription || 'خدمة',
                    salePrice: serviceAmount,
                    selectedQty: 1,
                    category: 'خدمة'
                }],
                total: serviceAmount,
                paid: safeNum(document.getElementById('servicePaid').value),
                balance: safeNum(document.getElementById('serviceBalance').value),
                discount: 0,
                discount_type: '',
                cancelled_remainder: 0,
                type: 'خدمة'
            };

            if (!serviceDescription || !serviceAmount) {
                return showToast(t('fill_fields_error'), 'error');
            }

            let serviceCheckRec = null;

            setBtnLoading(saveBtn, true, t('saving'));
            performOptimisticAction('invoices', serviceData, false,
                () => {
                    setBtnLoading(saveBtn, false);
                    renderInvoices(getFilteredData(allData.invoices));
                    renderDashboard(getFilteredData(allData.invoices), getFilteredData(allData.expenses));

                    // إضافة الدفعة الأولية
                    // 1. تنظيف وإضافة الشيكات والكمبيالات
                    if (allData.checks_promissory && allData.checks_promissory.length > 0) {
                        allData.checks_promissory = allData.checks_promissory.filter(c =>
                            !(String(c.debt_id) === String(serviceData.id) && c.debt_type === 'invoice')
                        );
                    }
                    if ((serviceData.payment_method === 'شيك' || serviceData.payment_method === 'كمبيالة') && safeNum(serviceData.paid) > 0) {
                        serviceCheckRec = {
                            id: 'CHK-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                            reference: serviceData.payment_reference || '',
                            type: serviceData.payment_method,
                            amount: safeNum(serviceData.paid),
                            date: serviceData.date,
                            due_date: serviceData.due_date || serviceData.date,
                            status: 'pending',
                            client_name: serviceData.customer,
                            debt_id: serviceData.id,
                            debt_type: 'invoice'
                        };
                        if (!allData.checks_promissory) allData.checks_promissory = [];
                        allData.checks_promissory.unshift(serviceCheckRec);
                    }

                    // 2. تنظيف وإضافة الدفعات
                    if (allData.payments && allData.payments.length > 0) {
                        allData.payments = allData.payments.filter(p =>
                            !(String(p.debt_id) === String(serviceData.id) && p.debt_type === 'invoice')
                        );
                    }
                    if (safeNum(serviceData.paid) > 0) {
                        const payRec = {
                            id: 'PAY-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                            date: serviceData.date,
                            type: 'customer',
                            client_id: serviceData.customer_id,
                            client_name: serviceData.customer,
                            method: serviceData.payment_method,
                            reference: serviceData.payment_reference,
                            amount: safeNum(serviceData.paid),
                            description: t('initial_payment_invoice', { id: serviceData.id }),
                            debt_id: serviceData.id,
                            debt_type: 'invoice',
                            created_at: new Date().toISOString().split('T')[0]
                        };
                        if (!allData.payments) allData.payments = [];
                        allData.payments.unshift(payRec);
                        if (!document.getElementById('page-payments').classList.contains('hidden')) renderPayments();
                    }

                    // 3. تحديث الواجهات
                    renderInvoices(getFilteredData(allData.invoices));
                    renderDashboard(getFilteredData(allData.invoices), getFilteredData(allData.expenses));

                    if (!document.getElementById('page-payments').classList.contains('hidden')) renderPayments();
                    if (!document.getElementById('page-checks-promissory').classList.contains('hidden')) renderChecksPromissory();

                    // تحديث التنبيهات
                    checkDueDateAlerts();

                    // ========== إضافة الطباعة التلقائية لفاتورة الخدمة ==========
                    if (currentUser && currentUser.invoiceSize === 'Thermal') {
                        console.log('🖨️ تفعيل الطباعة التلقائية الحرارية لفاتورة الخدمة:', serviceData.id);
                        autoPrintThermalInvoice(serviceData.id);
                    }
                    // ========== نهاية الطباعة التلقائية ==========
                },
                (runner) => {
                    runner.saveInvoice(serviceData, isEditing, currentDbId);
                    if (serviceCheckRec) {
                        google.script.run
                            .withSuccessHandler(() => console.log('✅ Synchronisation chèque réussie pour facture service:', serviceData.id))
                            .withFailureHandler((e) => console.error('❌ Échec chèque service', e))
                            .saveCheckPromissory(serviceCheckRec, currentDbId);
                    }
                }
            );
            setTimeout(() => setBtnLoading(saveBtn, false), 1000);
            closeModal('serviceModal');
        }

        function printConsolidatedDebtInvoice(debts, customerName, totalPaid, paymentRef, date, method, checkRef) {
            const shopName = currentUser?.shopName || t('shop_name_placeholder');
            const shopLogo = currentUser?.shopLogo || '';
            const shopAddress = currentUser?.shopAddress || t('address_placeholder');
            const shopPhone = currentUser?.shopPhone || t('phone_placeholder');

            let itemsHTML = debts.map(inv => `
                <tr>
                    <td style="border: 1px solid #000; padding: 5px; text-align: right;">${t('invoice')} #${inv.id} (${inv.date})</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${formatCurrency(safeNum(inv.total))}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center; color: #ef4444;">${formatCurrency(safeNum(inv.balance))}</td>
                </tr>
            `).join('');

            const isRtl = currentLang === 'ar';
            const htmlContent = `
                <div style="font-family: 'Cairo', sans-serif; padding: 20px; width: 210mm; margin: 0 auto; direction: ${isRtl ? 'rtl' : 'ltr'};">
                    <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
                        ${shopLogo ? `<img src="${shopLogo}" style="max-height: 60px; margin-bottom: 5px;">` : ''}
                        <div style="font-size: 24px; font-weight: 900;">${shopName}</div>
                        <p style="font-size: 12px; margin: 2px 0;">${shopAddress}</p>
                        <p style="font-size: 12px; margin: 2px 0;">${shopPhone}</p>
                        <h2 style="margin: 10px 0 0 0;">${t('consolidated_debt_settlement_receipt')}</h2>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px;">
                        <div><strong>${t('receipt_number')}: ${paymentRef}</strong><br>${t('settlement_date')}: ${date}</div>
                        <div style="text-align: left;"><strong>${t('customer')}: ${customerName}</strong><br>${t('payment_method')}: ${method} ${checkRef ? `(${checkRef})` : ''}</div>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px;">
                        <thead><tr><th style="background-color: #eee; border: 1px solid #000; padding: 5px; width: 50%;">البيان</th><th style="background-color: #eee; border: 1px solid #000; padding: 5px; width: 25%;">إجمالي الفاتورة</th><th style="background-color: #eee; border: 1px solid #000; padding: 5px; width: 25%;">المبلغ المسدد</th></tr></thead>
                        <tbody>${itemsHTML}</tbody>
                    </table>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; margin-top: 20px;">
                        <div style="display: flex; justify-content: space-between; width: 50%; font-weight: 900; font-size: 18px; border-top: 2px solid #000; padding-top: 5px;"><span>إجمالي المسدد:</span><span style="color: #10b981;">${formatCurrency(totalPaid)}</span></div>
                        <div style="display: flex; justify-content: space-between; width: 50%; font-weight: 900; font-size: 14px; margin-top: 5px;"><span>الباقي في ذمة الزبون:</span><span>${formatCurrency(0)}</span></div>
                    </div>
                    <div style="text-align: center; margin-top: 40px; font-size: 12px; border-top: 1px solid #000; padding-top: 10px;"><p>تم تسديد جميع الفواتير المذكورة أعلاه. شكراً لتعاملكم معنا.</p></div>
                </div>`;

            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html><html><head><title>وصل تسديد ديون - ${customerName}</title>
                <style>@page { size: A4 portrait; margin: 0; } body { margin: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Cairo', sans-serif; }</style>
                </head><body>${htmlContent}
                <script>window.onload = function() { setTimeout(() => { window.print(); window.onafterprint = function() { window.close(); }; }, 500); };<\/script>
                </body></html>
            `);
            printWindow.document.close();
        }

        function downloadDetailedDebtsInvoice(clientId, clientName) {
            const debts = allData.invoices.filter(i => i.customer_id === clientId && safeNum(i.balance) > 0);
            if (debts.length === 0) {
                showToast(t('no_debts'), 'info');
                return;
            }

            const shopName = currentUser?.shopName || t('shop_name_placeholder');
            const shopLogo = currentUser?.shopLogo || '';
            const shopAddress = currentUser?.shopAddress || '';
            const shopPhone = currentUser?.shopPhone || '';
            const date = new Date().toLocaleDateString('ar-MA');
            let totalDebt = 0;
            let itemsHTML = '';

            debts.forEach(inv => {
                const balance = safeNum(inv.balance);
                totalDebt += balance;

                let invItems = [];
                try { invItems = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items; } catch (e) { }

                let itemRows = '';
                if (inv.type === 'خدمة') {
                    const serviceName = invItems[0]?.name || 'خدمة';
                    itemRows = `<tr>
                        <td colspan="2" style="border: 1px solid #e2e8f0; padding: 8px; font-size: 11px;">${serviceName}</td>
                        <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 11px;">-</td>
                        <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 11px;">-</td>
                    </tr>`;
                } else {
                    invItems.forEach(item => {
                        itemRows += `<tr>
                            <td colspan="2" style="border: 1px solid #e2e8f0; padding: 8px; color: #475569; font-size: 11px;">- ${item.name}</td>
                            <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; color: #475569; font-size: 11px;">${item.selectedQty}</td>
                            <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; color: #475569; font-size: 11px;">${formatCurrency(item.salePrice)}</td>
                        </tr>`;
                    });
                }

                itemsHTML += `
                    <tr style="background-color: #f8fafc; font-weight: bold;">
                        <td style="border: 1px solid #e2e8f0; padding: 10px; font-size: 13px;">فاتورة #${inv.id}</td>
                        <td style="border: 1px solid #e2e8f0; padding: 10px; text-align: center; font-size: 13px;">${inv.date}</td>
                        <td style="border: 1px solid #e2e8f0; padding: 10px; text-align: center; font-size: 13px;">الإجمالي: ${formatCurrency(inv.total)}</td>
                        <td style="border: 1px solid #e2e8f0; padding: 10px; text-align: center; color: #ef4444; font-size: 13px;">الباقي: ${formatCurrency(balance)}</td>
                    </tr>
                    <tr style="font-size: 10px; background-color: #fdfdfd;">
                        <th colspan="2" style="border: 1px solid #e2e8f0; padding: 5px; text-align: right;">المنتج / الخدمة</th>
                        <th style="border: 1px solid #e2e8f0; padding: 5px; text-align: center;">الكمية</th>
                        <th style="border: 1px solid #e2e8f0; padding: 5px; text-align: center;">السعر</th>
                    </tr>
                    ${itemRows}
                `;
            });

            const isRtl = currentLang === 'ar';
            const html = `<!DOCTYPE html><html lang="${currentLang}" dir="${isRtl ? 'rtl' : 'ltr'}"><head><meta charset="UTF-8"><title>كشف ديون مفصل - ${clientName}</title><style>
                        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
                        body { font-family: 'Cairo', sans-serif; padding: 20px; background: white; color: #0f172a; margin: 0; }
                        .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
                        .shop-name { font-size: 24px; font-weight: 900; color: #1e293b; margin: 0 0 5px 0; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
                        .total-section { display: flex; justify-content: space-between; border-top: 2px dashed #1e293b; padding-top: 15px; font-size: 18px; font-weight: 900; }
                        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                    </style></head><body>
                    <div class="header">
                        ${shopLogo ? `<img src="${shopLogo}" style="max-height: 60px; margin-bottom: 10px;">` : ''}
                        <h1 class="shop-name">${shopName}</h1>
                        <p style="margin: 2px 0; font-size: 12px; color: #64748b;">${shopAddress}</p>
                        <p style="margin: 2px 0; font-size: 12px; color: #64748b;">${shopPhone}</p>
                        <h2 style="margin: 20px 0 5px 0; color: #2563eb; border: 1px solid #cbd5e1; display: inline-block; padding: 5px 20px; border-radius: 10px; font-size: 12px;">كشف ديون مفصل</h2>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; background-color: #f1f5f9; padding: 10px; border-radius: 8px;">
                        <div><strong>الزبون:</strong> ${clientName}</div><div><strong>تاريخ الكشف:</strong> ${date}</div>
                    </div>
                    <table><tbody>${itemsHTML}</tbody></table>
                    <div class="total-section">
                        <span>إجمالي الديون المستحقة للتسديد:</span>
                        <span style="color: #ef4444; background: #fee2e2; padding: 5px 15px; border-radius: 8px;">${formatCurrency(totalDebt)}</span>
                    </div>
                    <div style="text-align: center; margin-top: 50px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                        <p>هذا الكشف يمثل الديون المستحقة حتى تاريخ إصداره. شكراً لتعاملكم معنا.</p>
                    </div>
                    <script>window.onload = () => { setTimeout(() => { window.print(); window.onafterprint = function(){ window.close(); }; }, 800); };<\/script>
                </body></html>`;
            const printWindow = window.open('', '_blank');
            printWindow.document.write(html);
            printWindow.document.close();
        }
