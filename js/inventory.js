        function exportChecksToExcel() {
            const checks = filterChecksData();

            if (checks.length === 0) {
                showToast(t('no_data'), 'error');
                return;
            }

            // تجهيز البيانات للتصدير
            const exportData = checks.map(check => ({
                [t('reference_label')]: check.reference || '',
                [t('type_label')]: check.type === 'كمبيالة' ? t('promissory_note_word') : t('check_word'),
                [t('received_dir') + '/' + t('given_dir')]: check.debt_type === 'invoice' ? t('received_dir') : t('given_dir'),
                [t('status')]: check.status === 'pending' ? t('pending') :
                    check.status === 'paid' ? t('paid') : t('cancelled'),
                [t('customer')]: check.client_name || '',
                [t('date')]: check.date || '',
                [t('due_date_label')]: check.due_date || '',
                [t('amount_label')]: safeNum(check.amount),
                [t('invoice_label') + '/' + t('expense_label')]: check.debt_type === 'invoice' ? t('invoice_label') : t('expense_label'),
                [t('reference_label') + ' ID']: check.debt_id || ''
            }));

            // إنشاء ورقة عمل
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);
            XLSX.utils.book_append_sheet(wb, ws, t('checks_promissory'));

            // تحميل الملف
            const fileName = `شيكات_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
            XLSX.writeFile(wb, fileName);

            showToast(t('status_updated') ? t('settle_all_success') : 'تم التصدير بنجاح', 'success');
        }

        function generateProductCode() {
            return Math.floor(100000 + Math.random() * 900000).toString();
        }

        function toggleBarcodeSettings() {
            const size = document.getElementById('settingBarcodeSize').value;
            const group = document.getElementById('settingBarcodeThermalGroup');
            if (size === 'Thermal' || size === 'ThermalContinuous') {
                group.classList.remove('hidden');
            } else {
                group.classList.add('hidden');
            }
        }

        function calculateStockStats() {
            stockStats = { zero: 0, low: 0, normal: 0 };

            allData.inventory.forEach(item => {
                const qty = safeNum(item.qty);
                if (qty === 0) {
                    stockStats.zero++;
                } else if (qty > 0 && qty < 10) {
                    stockStats.low++;
                } else if (qty >= 10) {
                    stockStats.normal++;
                }
            });

            // تحديث العداد
            if (document.getElementById('zeroCount')) {
                document.getElementById('zeroCount').textContent = stockStats.zero;
                document.getElementById('lowCount').textContent = stockStats.low;
                document.getElementById('normalCount').textContent = stockStats.normal;
            }

            // تحديث العدد الإجمالي للمنتجات
            if (document.getElementById('totalInventoryCountDisplay')) {
                document.getElementById('totalInventoryCountDisplay').textContent = allData.inventory.length;
            }
        }

        function searchInventory() {
            const searchInput = document.getElementById('inventorySearch');
            const clearBtn = document.getElementById('clearSearchBtn');
            const searchStats = document.getElementById('inventorySearchStats');
            const val = searchInput.value.trim();

            // إظهار أو إخفاء زر المسح
            if (val.length > 0) {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
                searchStats.classList.add('hidden');
            }

            // استخدام Debounce لمنع التعطل عند الكتابة السريعة
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                inventorySearchTerm = val.toLowerCase();
                applyInventorySearch();
            }, (typeof lowResourceMode !== 'undefined' && lowResourceMode) ? 750 : 300); // انتظار 300 ميلي ثانية بعد التوقف عن الكتابة
        }

        function applyInventorySearch() {
            // تطبيق البحث فقط إذا كان هناك نص بحث
            if (inventorySearchTerm.length > 0) {
                // تقسيم نص البحث بناءً على الفاصلة (,) لدعم البحث المتعدد
                const searchTerms = inventorySearchTerm.split(',').map(t => t.trim()).filter(t => t);

                currentFilteredInventory = allData.inventory.filter(item => {
                    const name = (item.name || '').toString().toLowerCase();
                    const id = (item.id || '').toString().toLowerCase();

                    // التحقق مما إذا كان العنصر يطابق أي من مصطلحات البحث
                    return searchTerms.some(term => name.includes(term) || id.includes(term));
                });
            } else {
                // إذا لم يكن هناك بحث، عرض جميع المنتجات
                currentFilteredInventory = allData.inventory;
            }

            // عرض إحصائيات البحث
            updateSearchStats();

            // إعادة عرض المخزون
            renderInventoryCards();
        }

        function updateSearchStats() {
            const searchStats = document.getElementById('inventorySearchStats');
            const totalProducts = allData.inventory.length;
            const filteredProducts = currentFilteredInventory.length;

            if (inventorySearchTerm.length > 0) {
                let statsText = t('search_results_stats', { filtered: filteredProducts, total: totalProducts });
                if (filteredProducts === 0) {
                    statsText += t('no_results_for', { term: inventorySearchTerm });
                } else {
                }
                searchStats.innerHTML = statsText;
                searchStats.classList.remove('hidden');
            } else {
                searchStats.classList.add('hidden');
            }
        }

        function clearInventorySearch() {
            document.getElementById('inventorySearch').value = '';
            inventorySearchTerm = '';
            document.getElementById('clearSearchBtn').classList.add('hidden');
            document.getElementById('inventorySearchStats').classList.add('hidden');
            applyInventorySearch();
        }

        function clearInventorySearchAndFilters() {
            clearInventorySearch();
            showAllProducts();
        }

        function filterInventory(filterType) {
            inventoryFilter = filterType;

            // تحديث أزرار الفلترة
            const filterButtons = ['showAllBtn', 'filterZeroBtn', 'filterLowBtn'];
            filterButtons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (!btn) return;

                btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
                btn.classList.add('bg-white', 'border-slate-300');

                // إعادة الألوان الأصلية
                if (btnId === 'filterZeroBtn') {
                    btn.classList.remove('text-rose-600', 'border-rose-300');
                    btn.classList.add('text-rose-600', 'border-rose-300');
                } else if (btnId === 'filterLowBtn') {
                    btn.classList.remove('text-orange-600', 'border-orange-300');
                    btn.classList.add('text-orange-600', 'border-orange-300');
                }
            });

            // إضافة النشط للزر المختار
            const activeBtn = document.getElementById(`filter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Btn`);
            if (activeBtn) {
                activeBtn.classList.remove('bg-white');
                activeBtn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');

                // إزالة الألوان المخصصة
                activeBtn.classList.remove('text-rose-600', 'border-rose-300');
                activeBtn.classList.remove('text-orange-600', 'border-orange-300');
            }

            // تطبيق الفلترة
            if (filterType === 'all') {
                showAllProducts();
            } else {
                // تطبيق الفلترة المطلوبة
                currentFilteredInventory = allData.inventory.filter(item => {
                    const qty = safeNum(item.qty);

                    switch (filterType) {
                        case 'zero':
                            return qty === 0;
                        case 'low':
                            return qty > 0 && qty < 10;
                        case 'critical': // فلتر جديد للتنبيهات (0 إلى 5)
                            return qty <= 2;
                        default:
                            return true;
                    }
                });

                renderInventoryCards();
            }
        }

        function showAllProducts() {
            // إعادة تعيين كل الفلاتر
            inventoryFilter = 'all';
            inventorySearchTerm = '';

            // إعادة تعيين حقول البحث
            document.getElementById('inventorySearch').value = '';
            document.getElementById('clearSearchBtn').classList.add('hidden');
            document.getElementById('inventorySearchStats').classList.add('hidden');

            // عرض جميع المنتجات
            currentFilteredInventory = allData.inventory;
            renderInventoryCards();

            // تحديث أزرار الفلترة
            const filterButtons = ['showAllBtn', 'filterZeroBtn', 'filterLowBtn'];
            filterButtons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
                    btn.classList.add('bg-white', 'border-slate-300');

                    // إعادة الألوان الأصلية
                    if (btnId === 'showAllBtn') {
                        btn.classList.add('text-blue-600', 'border-blue-300');
                    } else if (btnId === 'filterZeroBtn') {
                        btn.classList.add('text-rose-600', 'border-rose-300');
                    } else if (btnId === 'filterLowBtn') {
                        btn.classList.add('text-orange-600', 'border-orange-300');
                    }
                }
            });

            // تفعيل زر "عرض جميع المنتجات"
            const allBtn = document.getElementById('showAllBtn');
            if (allBtn) {
                allBtn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
                allBtn.classList.remove('bg-white', 'border-slate-300', 'text-blue-600');
            }
        }

        function handleExcelImport(event) {
            const file = event.target.files[0];
            if (!file) return;

            setLoading(true);
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                const items = jsonData.map(row => ({
                    id: String(row.id || row['معرف'] || generateProductCode()),
                    name: String(row.name || row['اسم المنتج'] || 'بدون اسم'),
                    purchase_price: safeNum(row.purchase_price || row['سعر الشراء']),
                    sale_price: safeNum(row.sale_price || row['سعر البيع']),
                    qty: safeNum(row.qty || row['الكمية']),
                    category: row.category || 'منتج',
                    unit_type: row.unit_type || row['الوحدة'] || 'وحدة'
                }));

                // تقسيم البيانات إلى حزم لتجنب توقف السيرفر
                const CHUNK_SIZE = 100; // 100 منتج في كل دفعة
                let processed = 0;

                function processNextChunk() {
                    if (processed >= items.length) {
                        showToast(t('import_success', { count: items.length }));
                        refreshData();
                        setLoading(false);
                        return;
                    }

                    const chunk = items.slice(processed, processed + CHUNK_SIZE);

                    google.script.run.withSuccessHandler((res) => {
                        if (res && res.success) {
                            processed += chunk.length;
                            showToast(t('import_progress', { processed: Math.min(processed, items.length), total: items.length }), 'info');
                            processNextChunk(); // الانتقال للدفعة التالية
                        } else {
                            showToast(t('import_error'), 'error');
                            setLoading(false);
                        }
                    }).withFailureHandler((err) => {
                        showToast(t('connection_error') + ': ' + err, 'error');
                        setLoading(false);
                    }).saveInventoryBatch(chunk, currentDbId);
                }

                processNextChunk();
                event.target.value = "";
            };
            reader.readAsArrayBuffer(file);
        }

                function processNextChunk() {
                    if (processed >= items.length) {
                        showToast(t('import_success', { count: items.length }));
                        refreshData();
                        setLoading(false);
                        return;
                    }

                    const chunk = items.slice(processed, processed + CHUNK_SIZE);

                    google.script.run.withSuccessHandler((res) => {
                        if (res && res.success) {
                            processed += chunk.length;
                            showToast(t('import_progress', { processed: Math.min(processed, items.length), total: items.length }), 'info');
                            processNextChunk(); // الانتقال للدفعة التالية
                        } else {
                            showToast(t('import_error'), 'error');
                            setLoading(false);
                        }
                    }).withFailureHandler((err) => {
                        showToast(t('connection_error') + ': ' + err, 'error');
                        setLoading(false);
                    }).saveInventoryBatch(chunk, currentDbId);
                }

        function downloadInventoryPDF() {
            if (!currentFilteredInventory || currentFilteredInventory.length === 0) {
                showToast(t('no_data_export'), 'error');
                return;
            }

            const shopName = currentUser?.shopName || 'المتجر';
            const date = new Date().toLocaleDateString('ar-MA');
            const isRtl = currentLang === 'ar';
            const dir = isRtl ? 'rtl' : 'ltr';
            const align = isRtl ? 'right' : 'left';

            const printWindow = window.open('', 'PRINT_INV_LIST', 'height=600,width=800');
            let html = `
                <html lang="${currentLang}" dir="${dir}">
                <head>
                    <meta charset="UTF-8">
                    <title>${t('inventory')} - ${new Date().toLocaleDateString()}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                        body { font-family: 'Cairo', sans-serif; padding: 20px; background: #fff; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; width: 100%; }
                        th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: ${align}; }
                        th { background-color: #f1f5f9; }
                        .text-center { text-align: center; }
                        .header { text-align: center; margin-bottom: 30px; }
                        @media print {
                            @page { size: A4; margin: 10mm; }
                            body { -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1 style="color: #2563eb; margin: 0;">${shopName}</h1>
                        <h2 style="margin: 5px 0;">${t('inventory')}</h2>
                        <p style="color: #666; margin: 0;">${new Date().toLocaleDateString()}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>${t('product_code_label')}</th>
                                <th>${t('product_col')}</th>
                                <th class="text-center">${t('qty_label')}</th>
                                <th class="text-center">${t('price_buy')}</th>
                                <th class="text-center">${t('price_sell')}</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            currentFilteredInventory.forEach(item => {
                html += `
                    <tr>
                        <td>${item.id}</td>
                        <td>${item.name}</td>
                        <td class="text-center" style="font-weight: bold;">${item.qty}</td>
                        <td class="text-center">${formatCurrency(item.purchase_price || 0)}</td>
                        <td class="text-center">${formatCurrency(item.sale_price || 0)}</td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                    <script>
                        window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 800); };
                    <\/script>
                </body>
                </html>
            `;

            printWindow.document.write(html);
            printWindow.document.close();
        }

        function printSingleBarcode(id, name, price) {
    openConfirm({
        title: t('print_barcode_title'),
        msg: t('print_barcode_msg') + `: ${name}`,
        iconClass: "fas fa-print",
        colorClass: "bg-slate-800",
        hasInput: true,
        onConfirm: (val) => {
            const copies = parseInt(val);
            if (!copies || copies <= 0) return showToast(t('invalid_number'), 'error');

            const shopLogo = currentUser?.shopLogo || '';
            const shopName = currentUser?.shopName || 'المتجر';

            // استخدام العرض والارتفاع من الإعدادات الحرارية
            const bWidth = parseInt(currentUser?.barcodeWidth || 80);
            const bHeight = parseInt(currentUser?.barcodeHeight || 30);
            const priceStr = (price && currentUser.showPriceOnBarcode !== false) ? formatCurrency(price) : '';

            const isContinuous = currentUser?.barcodeSize === 'ThermalContinuous';
            const pageSizeCSS = isContinuous 
                ? `@page { size: ${bWidth}mm auto; margin: 0; } body { width: ${bWidth}mm; height: auto; overflow: visible; }`
                : `@page { size: ${bWidth}mm ${bHeight}mm; margin: 0mm; } body { width: ${bWidth}mm; height: ${bHeight}mm; overflow: hidden; }`;

            const labelStyleCSS = isContinuous
                ? `width: ${bWidth}mm; height: ${bHeight}mm; max-height: ${bHeight}mm; padding: 1mm 2.5mm; margin: 0 0 4mm 0; box-sizing: border-box; overflow: hidden; page-break-inside: avoid; display: flex; align-items: center; justify-content: center;`
                : `width: ${bWidth}mm; height: ${bHeight}mm; max-height: ${bHeight}mm; padding: 1mm 2.5mm; margin: 0; box-sizing: border-box; overflow: hidden; page-break-after: always; page-break-inside: avoid; display: flex; align-items: center; justify-content: center;`;

            let labelsHTML = '';
            
            // توليد الباركودات بشكل منفصل (كل باركود في صفحة منفصلة)
            for (let i = 0; i < copies; i++) {
                labelsHTML += `
                    <div class="thermal-barcode-label" style="${labelStyleCSS}">
                        <div class="label-content">
                            <div class="shop-name-logo">
                                ${shopLogo ? `<img src="${shopLogo}">` : `<div>${shopName}</div>`}
                            </div>
                            <div class="product-name">${name}</div>
                            <div class="barcode-container">
                                <svg class="barcode-svg" id="barcode-single-${i}"></svg>
                            </div>
                            <div class="label-footer" ${priceStr ? '' : 'style="justify-content: center !important;"'}>
                                <span>${id}</span>
                                ${priceStr ? `<span>${priceStr}</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }

            const printWindow = window.open('', 'PRINT_SINGLE', 'height=600,width=800');
            
            printWindow.document.write(`
                <html>
                <head>
                    <title>طباعة ${copies} نسخ - ${name}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700&display=swap');
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body { 
                            font-family: 'Cairo', sans-serif; 
                            margin: 0; 
                            padding: 0; 
                            background: white;
                        }
                        ${pageSizeCSS}
                        .label-content {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: space-between;
                            width: 100%;
                            height: 100%;
                        }
                        .shop-name-logo {
                            max-height: 20%;
                            margin-bottom: 0.2mm;
                            text-align: center;
                        }
                        .shop-name-logo img {
                            max-height: 5mm;
                            max-width: 90%;
                            object-fit: contain;
                        }
                        .shop-name-logo div {
                            font-size: 2.5mm;
                            font-weight: bold;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            max-width: ${bWidth - 5}mm;
                        }
                        .product-name {
                            font-size: 2.8mm;
                            font-weight: 700;
                            line-height: 1.1;
                            text-align: center;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            width: 100%;
                            margin-bottom: 0.2mm;
                        }
                        .barcode-container {
                            width: 100%;
                            flex-grow: 1;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            min-height: 6mm;
                        }
                        .barcode-svg {
                            width: 100% !important;
                            height: auto !important;
                            max-height: 12mm;
                        }
                        .label-footer {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            width: 100%;
                            margin-top: 0.2mm;
                            font-size: 2.8mm;
                            font-weight: 700;
                            color: #000;
                        }
                        @media print {
                            body {
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            .thermal-barcode-label:last-child {
                                page-break-after: auto;
                                margin-bottom: 0 !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${labelsHTML}
                    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
                    <script>
                        for(let i=0; i<${copies}; i++) {
                            try {
                                JsBarcode("#barcode-single-" + i, "${id}", {
                                    format: "CODE128",
                                    width: 2,
                                    height: 50,
                                    displayValue: false,
                                    fontSize: 0,
                                    margin: 0
                                });
                            } catch(e) { console.error(e); }
                        }
                        window.onload = () => { 
                            setTimeout(() => { 
                                window.print(); 
                                window.onafterprint = function() { 
                                    window.close(); 
                                };
                            }, 800); 
                        };
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    });
}

        function printAllBarcodes() {
    const items = currentFilteredInventory.filter(i => i.category !== 'خدمة');

            if (!items || items.length === 0) return showToast(t('no_products_display'), 'error');

            openConfirm({
                title: t('print_barcode_title'),
                msg: t('print_barcode_all_msg') + ` (${items.length})`,
                iconClass: "fas fa-print",
                colorClass: "bg-slate-800",
                hasInput: true,
                onConfirm: (val) => {
                    const copies = parseInt(val);
                    if (!copies || copies <= 0) return showToast(t('invalid_number'), 'error');

                    const shopLogo = currentUser?.shopLogo || '';
                    const shopName = currentUser?.shopName || 'المتجر';

                    const bWidth = parseInt(currentUser?.barcodeWidth || 80);
                    const bHeight = parseInt(currentUser?.barcodeHeight || 30);

                    const isContinuous = currentUser?.barcodeSize === 'ThermalContinuous';
                    const pageSizeCSS = isContinuous 
                        ? `@page { size: ${bWidth}mm auto; margin: 0; } body { width: ${bWidth}mm; height: auto; overflow: visible; }`
                        : `@page { size: ${bWidth}mm ${bHeight}mm; margin: 0mm; } body { width: ${bWidth}mm; height: ${bHeight}mm; overflow: hidden; }`;

                    const labelStyleCSS = isContinuous
                        ? `width: ${bWidth}mm; height: ${bHeight}mm; max-height: ${bHeight}mm; padding: 1mm 2.5mm; margin: 0 0 4mm 0; box-sizing: border-box; overflow: hidden; page-break-inside: avoid; display: flex; align-items: center; justify-content: center;`
                        : `width: ${bWidth}mm; height: ${bHeight}mm; max-height: ${bHeight}mm; padding: 1mm 2.5mm; margin: 0; box-sizing: border-box; overflow: hidden; page-break-after: always; page-break-inside: avoid; display: flex; align-items: center; justify-content: center;`;

                    let labelsHTML = '';
                    let totalLabels = 0;

                    // توليد الباركودات لكل منتج حسب عدد النسخ
                    items.forEach(item => {
                        for (let c = 0; c < copies; c++) {
                            const itemPriceStr = (item.sale_price && currentUser.showPriceOnBarcode !== false) ? formatCurrency(item.sale_price) : '';
                            labelsHTML += `
                        <div class="thermal-barcode-label" style="${labelStyleCSS}">
                            <div class="label-content">
                                <div class="shop-name-logo">
                                    ${shopLogo ? `<img src="${shopLogo}">` : `<div>${shopName}</div>`}
                                </div>
                                <div class="product-name">${item.name}</div>
                                <div class="barcode-container">
                                    <svg class="barcode-svg" data-code="${item.id}"></svg>
                                </div>
                                <div class="label-footer" ${itemPriceStr ? '' : 'style="justify-content: center !important;"'}>
                                    <span>${item.id}</span>
                                    ${itemPriceStr ? `<span>${itemPriceStr}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                            totalLabels++;
                        }
                    });

                    const printWindow = window.open('', 'PRINT_ALL', 'height=600,width=800');

                    printWindow.document.write(`
                <html>
                <head>
                    <title>طباعة الباركودات - ${totalLabels} ملصق</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700&display=swap');
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body { 
                            font-family: 'Cairo', sans-serif; 
                            margin: 0; 
                            padding: 0; 
                            background: white;
                        }
                        ${pageSizeCSS}
                        .label-content {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: space-between;
                            width: 100%;
                            height: 100%;
                        }
                        .shop-name-logo {
                            max-height: 20%;
                            margin-bottom: 0.2mm;
                            text-align: center;
                        }
                        .shop-name-logo img {
                            max-height: 5mm;
                            max-width: 90%;
                            object-fit: contain;
                        }
                        .shop-name-logo div {
                            font-size: 2.5mm;
                            font-weight: bold;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            max-width: ${bWidth - 5}mm;
                        }
                        .product-name {
                            font-size: 2.8mm;
                            font-weight: 700;
                            line-height: 1.1;
                            text-align: center;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            width: 100%;
                            margin-bottom: 0.2mm;
                        }
                        .barcode-container {
                            width: 100%;
                            flex-grow: 1;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            min-height: 6mm;
                        }
                        .barcode-svg {
                            width: 100% !important;
                            height: auto !important;
                            max-height: 12mm;
                        }
                        .label-footer {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            width: 100%;
                            margin-top: 0.2mm;
                            font-size: 2.8mm;
                            font-weight: 700;
                            color: #000;
                        }
                        @media print {
                            body {
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            .thermal-barcode-label:last-child {
                                page-break-after: auto;
                                margin-bottom: 0 !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${labelsHTML}
                    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
                    <script>
                        const svgs = document.querySelectorAll(".barcode-svg");
                        svgs.forEach(svg => {
                            try {
                                JsBarcode(svg, svg.getAttribute("data-code"), {
                                    format: "CODE128",
                                    width: 2,
                                    height: 50,
                                    displayValue: false,
                                    fontSize: 0,
                                    margin: 0
                                });
                            } catch(e) { console.error(e); }
                        });
                        window.onload = () => { 
                            setTimeout(() => { 
                                window.print(); 
                                window.onafterprint = function() { 
                                    window.close(); 
                                };
                            }, 1000); 
                        };
                    <\/script>
                </body>
                </html>
            `);
                    printWindow.document.close();
                }
            });
        }

        function getStockClass(qty) {
            qty = safeNum(qty);
            if (qty === 0) return 'border-rose-500';
            if (qty < 10) return 'border-orange-500';
            return 'border-emerald-500';
        }

        function getStockBadgeClass(qty) {
            qty = safeNum(qty);
            if (qty === 0) return 'bg-rose-500 text-white';
            if (qty < 10) return 'bg-orange-500 text-white';
            return 'bg-emerald-500 text-white';
        }

        function getStatusText(qty) {
            qty = safeNum(qty);
            if (qty === 0) return t('unavailable');
            if (qty < 10) return t('limited');
            return t('available');
        }

        function getStatusColor(qty) {
            qty = safeNum(qty);
            if (qty === 0) return 'text-rose-600';
            if (qty < 10) return 'text-orange-600';
            return 'text-emerald-600';
        }

        function renderInventory() {
            // عرض جميع المنتجات عند فتح الصفحة
            showAllProducts();
        }

        function renderInventoryCards() {
            const container = document.getElementById('inventoryContainer');
            const noInventoryMessage = document.getElementById('noInventoryMessage');

            if (!container) return;

            container.innerHTML = '';

            // التحقق من وجود منتجات
            if (currentFilteredInventory.length === 0) {
                container.classList.add('hidden');
                if (noInventoryMessage) noInventoryMessage.classList.remove('hidden');
                return;
            } else {
                container.classList.remove('hidden');
                if (noInventoryMessage) noInventoryMessage.classList.add('hidden');
            }

            const isSearching = inventorySearchTerm.length > 0;
            const limit = isSearching ? 100 : 30;
            const itemsToShow = currentFilteredInventory.slice(0, limit);
            let cardsHTML = ''; // تجميع HTML لتحسين الأداء

            itemsToShow.forEach(item => {
                const qty = safeNum(item.qty);
                const stockClass = getStockClass(qty);
                const stockBadgeClass = getStockBadgeClass(qty);
                const statusText = getStatusText(qty);
                const statusColor = getStatusColor(qty);
                const unitLabel = item.unit_type === 'متر' ? t('meter') : t('unit');

                // --- التعديل هنا: تحديد أزرار الإدارة ---
                // أزرار التعديل والحذف تظهر فقط للمدير
                const adminButtons = currentUser.role === 'admin' ? `
            <button onclick="editInventoryItem('${item.id}')" 
                    class="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-200 transition-all"
                    title="${t('edit')}">
                <i class="fas fa-edit text-xs"></i>
            </button>
            <button onclick="promptDeleteInventory('${item.id}', '${item.name}')" 
                    class="w-8 h-8 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center hover:bg-rose-200 transition-all"
                    title="${t('delete')}">
                <i class="fas fa-trash text-xs"></i>
            </button>
        ` : ''; // إذا كان موظفاً، المتغير فارغ

                cardsHTML += `
        <div class="inventory-card ${stockClass}">
            <div class="card-header">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-black text-slate-800 text-sm mb-1 truncate">${item.name}</h4>
                        <div class="flex items-center gap-2">
                            <span class="text-[9px] text-slate-400">${t('product_code_label')}: ${item.id}</span>
                            ${item.category === 'خدمة' ?
                        `<span class="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-[7px]">${t('service')}</span>` :
                        `<span class="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[7px]">${t('product')}</span>`}
                        </div>
                    </div>
                    <span class="px-3 py-1.5 rounded-full text-[10px] font-black ${stockBadgeClass}">
                        ${qty} ${unitLabel}
                    </span>
                </div>
            </div>
            
            <div class="card-body">
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <p class="text-[9px] text-slate-400 font-bold mb-1">${t('price_buy')}</p>
                        <p class="font-black text-blue-600 text-sm">${formatCurrency(item.purchase_price || 0)}</p>
                    </div>
                    <div>
                        <p class="text-[9px] text-slate-400 font-bold mb-1">${t('price_sell')}</p>
                        <p class="font-black text-emerald-600 text-sm">${formatCurrency(item.sale_price)}</p>
                    </div>
                </div>
                <div class="flex justify-between items-center">
                    <div>
                        <p class="text-[9px] text-slate-400 font-bold mb-1">${t('status')}</p>
                        <p class="text-xs font-bold ${statusColor}">${statusText}</p>
                    </div>
                    ${item.purchase_price ? `
                        <div class="text-left">
                            <p class="text-[9px] text-slate-400 font-bold mb-1">${t('profit')}</p>
                            <p class="text-xs font-bold text-emerald-600">
                                ${formatCurrency((item.sale_price || 0) - (item.purchase_price || 0))}
                            </p>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="card-footer">
                <div class="flex gap-2 justify-end">
                    ${item.category !== 'خدمة' ? `
                        <button onclick="promptAddStock('${item.id}', '${item.name.replace(/'/g, "\\'")}')" 
                                class="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-200 transition-all"
                                title="${t('add')}">
                            <i class="fas fa-plus-circle text-xs"></i>
                        </button>
                        <button onclick="printSingleBarcode('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.sale_price})" 
                                class="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center hover:bg-slate-200 transition-all"
                                title="${t('print_barcode')}">
                            <i class="fas fa-barcode text-xs"></i>
                        </button>
                    ` : ''}
                    
                    ${adminButtons} </div>
            </div>
        </div>`;
            });

            container.innerHTML = cardsHTML; // تحديث الواجهة مرة واحدة فقط

            if (!isSearching && currentFilteredInventory.length > limit) {
                container.innerHTML += `
            <div class="col-span-full text-center py-4">
                <p class="text-slate-400 text-xs font-bold mb-2">${t('search_results_stats', { filtered: limit, total: currentFilteredInventory.length })}</p>
                <p class="text-slate-300 text-[10px]">${t('use_search_hint')}</p>
            </div>
        `;
            }
        }

        function promptAddStock(id, name) {
            openConfirm({
                title: t('add_stock_title'),
                msg: t('add_stock_msg') + `: ${name}`,
                iconClass: "fas fa-cart-plus",
                colorClass: "bg-emerald-600",
                hasInput: true,
                onConfirm: (val) => {
                    const qty = safeNum(val);
                    if (qty <= 0) return showToast(t('enter_valid_qty'), 'error');

                    // تحديث محلي فوري (Optimistic Update)
                    const itemIndex = allData.inventory.findIndex(i => i.id == id);
                    if (itemIndex !== -1) {
                        allData.inventory[itemIndex].qty = safeNum(allData.inventory[itemIndex].qty) + qty;
                        // تحديث العرض فوراً
                        if (inventoryFilter !== 'all') filterInventory(inventoryFilter);
                        else renderInventoryCards();
                        calculateStockStats();
                    }

                    setLoading(true);
                    google.script.run.withSuccessHandler(() => {
                        // لا داعي لإعادة تحميل البيانات بالكامل، التحديث المحلي تم
                        setLoading(false);
                        showToast(t('stock_updated'));
                    }).addStock(id, qty, currentDbId);
                }
            });
        }

        function openInventoryModal() {
            document.getElementById('invId').value = '';
            const newCode = generateProductCode();
            document.getElementById('invCode').value = newCode;
            document.getElementById('invCode').readOnly = false;
            document.getElementById('invName').value = '';
            document.getElementById('invPurchase').value = '';
            document.getElementById('invSale').value = '';
            document.getElementById('invQty').value = '';
            document.getElementById('invCategory').value = 'منتج';
            document.getElementById('invUnitType').value = 'وحدة';
            document.getElementById('qtyInputGroup').classList.remove('hidden');

            // إذا كان إعداد "إدخال سعر الشراء فقط" مفعلاً، نخفي حقل سعر البيع
            if (currentUser && currentUser.purchaseOnly) {
                document.getElementById('invSale').parentElement.style.display = 'none';
                document.getElementById('invSale').required = false;
            } else {
                document.getElementById('invSale').parentElement.style.display = 'block';
                document.getElementById('invSale').required = true;
            }

            openModal('inventoryModal');
            document.getElementById('invName').focus();
        }

        function saveInventory() {
            const itemId = document.getElementById('invId').value;
            const itemCode = document.getElementById('invCode').value.trim();

            const saveBtn = document.getElementById('saveInventoryBtn');
            if (!itemCode) return showToast(t('enter_product_code'), 'error');
            if (!itemId && allData.inventory.find(p => p.id === itemCode)) return showToast(t('code_exists'), 'error');

            let salePrice = safeNum(document.getElementById('invSale').value);
            const purchasePrice = safeNum(document.getElementById('invPurchase').value);

            // إذا كان إعداد "إدخال سعر الشراء فقط" مفعلاً، نجعل سعر البيع مساوياً لسعر الشراء
            if (currentUser && currentUser.purchaseOnly) {
                salePrice = purchasePrice;
            }

            const item = {
                id: itemCode,
                name: document.getElementById('invName').value.trim(),
                purchase_price: purchasePrice,
                sale_price: salePrice,
                qty: safeNum(document.getElementById('invQty').value),
                category: document.getElementById('invCategory').value,
                unit_type: document.getElementById('invUnitType').value
            };

            if (!item.name || !item.sale_price) return showToast(t('enter_name_price'), 'error');

            setBtnLoading(saveBtn, true, t('saving'));
            performOptimisticAction('inventory', item, false,
                () => { filterInventory(inventoryFilter); calculateStockStats(); setBtnLoading(saveBtn, false); },
                (runner) => runner.saveInventoryItem(item, currentDbId)
            );
            // إعادة الزر لحالته في حالة الخطأ أو التأخير الطويل (اختياري، هنا نعتمد على التحديث المتفائل)
            setTimeout(() => setBtnLoading(saveBtn, false), 1000);
            closeModal('inventoryModal');
        }

        function editInventoryItem(id) {
            const item = allData.inventory.find(i => i.id == id);
            if (!item) return;
            document.getElementById('invId').value = item.id;
            document.getElementById('invCode').value = item.id;
            document.getElementById('invCode').readOnly = true;
            document.getElementById('invName').value = item.name;
            document.getElementById('invPurchase').value = item.purchase_price || '';
            document.getElementById('invSale').value = item.sale_price;
            document.getElementById('invQty').value = item.qty;
            document.getElementById('invCategory').value = item.category || 'منتج';
            document.getElementById('invUnitType').value = item.unit_type || 'وحدة';

            // إذا كان إعداد "إدخال سعر الشراء فقط" مفعلاً، نخفي حقل سعر البيع حتى في التعديل
            if (currentUser && currentUser.purchaseOnly) {
                document.getElementById('invSale').parentElement.style.display = 'none';
                document.getElementById('invSale').required = false;
            } else {
                document.getElementById('invSale').parentElement.style.display = 'block';
                document.getElementById('invSale').required = true;
            }

            if (item.category === 'خدمة') {
                document.getElementById('qtyInputGroup').classList.add('hidden');
            } else {
                document.getElementById('qtyInputGroup').classList.remove('hidden');
            }
            openModal('inventoryModal');
        }

        function promptDeleteInventory(id, name) {
            openConfirm({
                title: t('delete_product_title'),
                msg: t('delete_product_confirm', { name: name }),
                iconClass: "fas fa-trash-alt",
                colorClass: "bg-rose-600",
                onConfirm: () => {
                    // إغلاق نافذة التأكيد فوراً
                    closeConfirm();

                    // حذف المنتج من المصفوفة المحلية
                    const index = allData.inventory.findIndex(i => i.id == id);
                    if (index !== -1) {
                        allData.inventory.splice(index, 1);

                        // تحديث العرض فوراً
                        filterInventory(inventoryFilter);
                        calculateStockStats();

                        showToast('تم حذف المنتج محلياً', 'info');
                    }

                    // إرسال للسيرفر في الخلفية
                    google.script.run
                        .withSuccessHandler(() => showToast('✅ تم حذف المنتج من السيرفر'))
                        .withFailureHandler((e) => {
                            console.error(e);
                            showToast('❌ فشل الحذف من السيرفر، سيتم المزامنة لاحقاً', 'error');
                            refreshData();
                        })
                        .deleteInventoryItem(id, currentDbId);
                }
            });
        }

        function searchProductForInvoice() {
            clearTimeout(invoiceSearchTimeout);
            invoiceSearchTimeout = setTimeout(() => {
                const searchTerm = document.getElementById('iItemSearch').value.trim().toLowerCase();
                const resultsContainer = document.getElementById('searchResults');

                if (!searchTerm) {
                    resultsContainer.classList.add('hidden');
                    return;
                }

                const filteredProducts = allData.inventory.filter(p => {
                    if (p.category === 'خدمة') return false;
                    const name = (p.name || '').toString().toLowerCase();
                    const id = (p.id || '').toString().toLowerCase();
                    return name.includes(searchTerm) || id.includes(searchTerm);
                });

                if (filteredProducts.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="text-center p-4 text-slate-400 text-xs">
                            <i class="fas fa-search mb-2"></i>
                            <p>${t('no_products_found')}</p>
                        </div>
                    `;
                    resultsContainer.classList.remove('hidden');
                    return;
                }

                let resultsHTML = '';
                filteredProducts.slice(0, 10).forEach(product => {
                    const availableQty = safeNum(product.qty);
                    const isAvailable = availableQty > 0;

                    resultsHTML += `
                        <div class="search-result-item p-3 bg-white rounded-lg mb-2 border border-slate-100 ${!isAvailable ? 'disabled' : ''}" 
                             onclick="${isAvailable ? `selectProductFromSearch('${product.id}')` : ''}">
                            <div class="flex justify-between items-center">
                                <div>
                                    <p class="font-bold text-xs text-slate-800">${product.name}</p>
                                    <div class="flex items-center gap-2 mt-1">
                                        <span class="text-[9px] text-blue-600 font-black">${formatCurrency(product.sale_price)}</span>
                                        <span class="text-[8px] text-slate-400">${t('product_code_label')}: ${product.id}</span>
                                    </div>
                                </div>
                                <div class="text-left">
                                    <span class="text-[9px] px-2 py-0.5 rounded-full ${isAvailable ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}">
                                        ${availableQty} ${t('available')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    `;
                });

                resultsContainer.innerHTML = resultsHTML;
                resultsContainer.classList.remove('hidden');
            }, (typeof lowResourceMode !== 'undefined' && lowResourceMode) ? 600 : 200);
        }

        function selectProductFromSearch(productId) {
            const product = allData.inventory.find(p => p.id == productId);
            if (!product) return;

            // تصحيح: التحقق من إعداد تخطي الكمية هنا أيضاً لضمان عمله عند النقر أو المسح
            if (currentUser && currentUser.scanSkipQty) {
                addDirectToCart(product);
                document.getElementById('searchResults').classList.add('hidden');
                document.getElementById('iItemSearch').value = '';
                return;
            }

            selectedProductForQty = product;

            document.getElementById('quantityProductName').innerText = product.name;
            document.getElementById('quantityProductInfo').innerText = `${t('price_col')}: ${formatCurrency(product.sale_price)} | ${t('product_code_label')}: ${product.id}`;
            document.getElementById('availableQty').innerText = safeNum(product.qty);
            document.getElementById('quantityInput').value = 1;
            document.getElementById('quantityInput').max = safeNum(product.qty);

            // إعداد حقل الكمية حسب نوع الوحدة
            if (product.unit_type === 'متر') {
                document.getElementById('quantityInput').step = '0.01';
                document.getElementById('quantityInput').value = '1.00';
            } else {
                document.getElementById('quantityInput').step = '1';
                document.getElementById('quantityInput').value = '1';
            }

            document.getElementById('searchResults').classList.add('hidden');
            document.getElementById('iItemSearch').value = '';

            openModal('quantityModal');
            document.getElementById('quantityInput').focus();
            document.getElementById('quantityInput').select();
        }

        function addProductWithQuantity() {
            if (!selectedProductForQty) return;

            const qty = safeNum(document.getElementById('quantityInput').value);
            const availableQty = safeNum(selectedProductForQty.qty);

            if (qty <= 0) {
                showToast(t('enter_valid_qty'), 'error');
                return;
            }

            if (qty > availableQty) {
                showToast(t('available_only', { qty: availableQty }), 'error');
                return;
            }

            const existing = cart.find(c => c.id === selectedProductForQty.id);
            if (existing) {
                if (existing.selectedQty + qty > availableQty) {
                    showToast(t('max_qty_error', { qty: availableQty }), 'error');
                    return;
                }
                existing.selectedQty += qty;
            } else {
                cart.push({
                    id: selectedProductForQty.id,
                    name: selectedProductForQty.name,
                    salePrice: safeNum(selectedProductForQty.sale_price),
                    selectedQty: qty,
                    category: selectedProductForQty.category || 'منتج',
                    unit_type: selectedProductForQty.unit_type || 'وحدة'
                });
            }

            renderCart();
            closeModal('quantityModal');
            selectedProductForQty = null;

            // إعادة التركيز إلى حقل البحث عن المنتجات لمسح منتج آخر فوراً
            setTimeout(() => {
                const searchInput = document.getElementById('iItemSearch');
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.focus();
                }
            }, 100);

            showToast(t('added_to_invoice'));
        }

        function downloadInvoicePDF() {
            const id = document.getElementById('printInvoiceId').value;
            const size = selectedPrintSize;
            const thermalWidth = document.getElementById('thermalWidth').value;

            const inv = allData.invoices.find(i => String(i.id) === String(id));
            if (!inv) return;

            closeModal('printOptionsModal');
            showToast(t('generating_pdf'), 'info');

            const element = document.createElement('div');
            const isThermal = size === 'Thermal';
            const width = isThermal ? `${thermalWidth}mm` : (size === 'A5' ? '148mm' : '210mm');
            const isRtl = currentLang === 'ar';
            const align = isRtl ? 'right' : 'left';

            const ticketHTML = generateTicketHTML(inv, size);

            element.innerHTML = `
                <div style="font-family: 'Cairo', sans-serif; color: #000; padding: 20px; background: white; width: ${width}; margin: 0 auto; direction: ${isRtl ? 'rtl' : 'ltr'};">
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
                        .header-section { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                        .shop-name { font-size: ${isThermal ? '16px' : '24px'}; font-weight: 900; margin: 0; }
                        .shop-details { font-size: ${isThermal ? '10px' : '12px'}; margin: 2px 0; }
                        .invoice-details { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: ${isThermal ? '10px' : '12px'}; border-bottom: 1px dashed #000; padding-bottom: 10px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: ${isThermal ? '10px' : '12px'}; }
                        th { background-color: #eee !important; border: 1px solid #000; padding: 5px; font-weight: bold; text-align: center; }
                        td { border: 1px solid #000; padding: 5px; text-align: center; }
                        .text-start { text-align: ${align} !important; }
                        .totals-section { display: flex; flex-direction: column; align-items: flex-end; font-size: ${isThermal ? '11px' : '13px'}; }
                        .total-row { display: flex; justify-content: space-between; width: ${isThermal ? '100%' : '50%'}; margin-bottom: 3px; }
                        .total-row.final { font-weight: 900; font-size: ${isThermal ? '14px' : '16px'}; border-top: 2px solid #000; padding-top: 5px; margin-top: 5px; }
                        .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px solid #000; padding-top: 10px; }
                    </style>
                    ${ticketHTML}
                </div>
            `;

            const opt = {
                margin: 0,
                filename: `Invoice-${inv.id}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: isThermal ? [parseFloat(thermalWidth), 200] : size.toLowerCase(), orientation: 'portrait' }
            };

            html2pdf().set(opt).from(element).save().catch(err => {
                console.error(err);
                showToast(t('error_generating_pdf'), 'error');
            });
        }

        function openConsumptionModal() {
            consumptionCart = [];
            document.getElementById('consAutoId').innerText = 'CONS-' + Date.now().toString().slice(-6);
            document.getElementById('cDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('cItemSearch').value = '';
            document.getElementById('consumptionSearchResults').innerHTML = '';
            document.getElementById('consumptionSearchResults').classList.add('hidden');
            renderConsumptionCart();
            openModal('consumptionModal');
            setTimeout(() => {
                const searchInput = document.getElementById('cItemSearch');
                if (searchInput) searchInput.focus();
            }, 100);
        }

        function searchProductForConsumption() {
            clearTimeout(consumptionSearchTimeout);
            consumptionSearchTimeout = setTimeout(() => {
                const searchTerm = document.getElementById('cItemSearch').value.trim().toLowerCase();
                const resultsContainer = document.getElementById('consumptionSearchResults');

                if (!searchTerm) {
                    resultsContainer.classList.add('hidden');
                    return;
                }

                const filteredProducts = allData.inventory.filter(p => {
                    if (p.category === 'خدمة') return false;
                    const name = (p.name || '').toString().toLowerCase();
                    const id = (p.id || '').toString().toLowerCase();
                    return name.includes(searchTerm) || id.includes(searchTerm);
                });

                if (filteredProducts.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="text-center p-4 text-slate-400 text-xs">
                            <i class="fas fa-search mb-2"></i>
                            <p>${t('no_products_found')}</p>
                        </div>
                    `;
                    resultsContainer.classList.remove('hidden');
                    return;
                }

                let resultsHTML = '';
                filteredProducts.slice(0, 10).forEach(product => {
                    const availableQty = safeNum(product.qty);
                    const isAvailable = availableQty > 0;

                    resultsHTML += `
                        <div class="search-result-item p-3 bg-white rounded-lg mb-2 border border-slate-100 ${!isAvailable ? 'disabled' : ''}" 
                             onclick="${isAvailable ? `selectProductForConsumptionFromSearch('${product.id}')` : ''}">
                            <div class="flex justify-between items-center">
                                <div>
                                    <p class="font-bold text-xs text-slate-800">${product.name}</p>
                                    <div class="flex items-center gap-2 mt-1">
                                        <span class="text-[9px] text-amber-600 font-black">${t('price_buy')}: ${formatCurrency(product.purchase_price || 0)}</span>
                                        <span class="text-[8px] text-slate-400">${t('product_code_label')}: ${product.id}</span>
                                    </div>
                                </div>
                                <div class="text-left">
                                    <span class="text-[9px] px-2 py-0.5 rounded-full ${isAvailable ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}">
                                        ${availableQty} ${t('available')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    `;
                });

                resultsContainer.innerHTML = resultsHTML;
                resultsContainer.classList.remove('hidden');
            }, (typeof lowResourceMode !== 'undefined' && lowResourceMode) ? 600 : 200);
        }

        function selectProductForConsumptionFromSearch(productId) {
            const product = allData.inventory.find(p => p.id == productId);
            if (!product) return;

            selectedProductForConsumption = product;

            // إضافة مباشرة إلى سلة الاستهلاك (نطلب الكمية)
            openConsumptionQuantityModal(product);
        }

        function openConsumptionQuantityModal(product) {
            document.getElementById('quantityProductName').innerText = product.name;
            document.getElementById('quantityProductInfo').innerText = `${t('price_buy')}: ${formatCurrency(product.purchase_price || 0)} | ${t('product_code_label')}: ${product.id}`;
            document.getElementById('availableQty').innerText = safeNum(product.qty);
            document.getElementById('quantityInput').value = 1;
            document.getElementById('quantityInput').max = safeNum(product.qty);

            // إعداد حقل الكمية حسب نوع الوحدة
            if (product.unit_type === 'متر') {
                document.getElementById('quantityInput').step = '0.01';
                document.getElementById('quantityInput').value = '1.00';
            } else {
                document.getElementById('quantityInput').step = '1';
                document.getElementById('quantityInput').value = '1';
            }

            document.getElementById('consumptionSearchResults').classList.add('hidden');
            document.getElementById('cItemSearch').value = '';

            openModal('quantityModal');
            document.getElementById('quantityInput').focus();
            document.getElementById('quantityInput').select();

            // تجاوز دالة addProductWithQuantity
            const addBtn = document.querySelector('#quantityModal button[onclick="addProductWithQuantity()"]');
            if (addBtn) {
                addBtn.onclick = addProductForConsumption;
            }
        }

        function addProductForConsumption() {
            if (!selectedProductForConsumption) return;

            const qty = safeNum(document.getElementById('quantityInput').value);
            const availableQty = safeNum(selectedProductForConsumption.qty);

            if (qty <= 0) {
                showToast(t('enter_valid_qty'), 'error');
                return;
            }

            if (qty > availableQty) {
                showToast(t('available_only', { qty: availableQty }), 'error');
                return;
            }

            const existing = consumptionCart.find(c => c.id === selectedProductForConsumption.id);
            if (existing) {
                if (existing.selectedQty + qty > availableQty) {
                    showToast(t('max_qty_error', { qty: availableQty }), 'error');
                    return;
                }
                existing.selectedQty += qty;
            } else {
                consumptionCart.push({
                    id: selectedProductForConsumption.id,
                    name: selectedProductForConsumption.name,
                    purchasePrice: safeNum(selectedProductForConsumption.purchase_price),
                    selectedQty: qty,
                    unit_type: selectedProductForConsumption.unit_type || 'وحدة'
                });
            }

            renderConsumptionCart();
            closeModal('quantityModal');
            selectedProductForConsumption = null;

            // إعادة التركيز إلى حقل البحث
            setTimeout(() => {
                const searchInput = document.getElementById('cItemSearch');
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.focus();
                }
            }, 100);

            showToast('تمت إضافة المنتج للاستهلاك');
        }

        function renderConsumptionCart() {
            const list = document.getElementById('cCart');
            let total = 0;
            list.innerHTML = '';

            if (consumptionCart.length === 0) {
                list.innerHTML = `
                    <li class="text-center p-4 text-slate-400 text-xs">
                        <i class="fas fa-shopping-cart mb-2 text-lg"></i>
                        <p>${t('cart_empty_hint')}</p>
                    </li>
                `;
            } else {
                consumptionCart.forEach((it, idx) => {
                    const sub = it.purchasePrice * it.selectedQty;
                    total += sub;

                    list.innerHTML += `<li class="flex justify-between items-center p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all">
                        <div>
                            <span class="font-bold text-xs text-slate-800">${it.name}</span>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-[9px] text-slate-500">${t('price_buy')}: ${formatCurrency(it.purchasePrice)} × ${it.selectedQty} ${it.unit_type === 'متر' ? t('meter') : t('unit')}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-amber-600 font-black text-xs">${formatCurrency(sub)}</span>
                            <button onclick="removeFromConsumptionCart(${idx})" class="text-rose-400 hover:text-rose-600 transition-colors">
                                <i class="fas fa-times-circle"></i>
                            </button>
                        </div>
                    </li>`;
                });
            }

            document.getElementById('cTotal').innerText = formatCurrency(total);
        }

        function removeFromConsumptionCart(index) {
            consumptionCart.splice(index, 1);
            renderConsumptionCart();
        }

        function confirmConsumption() {
            if (consumptionCart.length === 0) return showToast('سلة الاستهلاك فارغة', 'error');

            const total = consumptionCart.reduce((s, i) => s + (i.purchasePrice * i.selectedQty), 0);
            const saveBtn = document.getElementById('saveConsumptionBtn');

            const consumption = {
                id: document.getElementById('consAutoId').innerText.replace('CONS-', ''),
                date: document.getElementById('cDate').value,
                store: 'المخزون', // قيمة افتراضية
                notes: 'استهلاك داخلي', // قيمة افتراضية
                items: consumptionCart,
                total: total
            };

            setBtnLoading(saveBtn, true, 'جاري الحفظ...');
            performOptimisticAction('consumptions', consumption, false,
                () => {
                    // إنقاص المخزون محلياً فوراً
                    consumption.items.forEach(cItem => {
                        const p = allData.inventory.find(x => x.id === cItem.id);
                        if (p) p.qty = safeNum(p.qty) - cItem.selectedQty;
                    });
                    if (!document.getElementById('page-inventory').classList.contains('hidden')) renderInventoryCards();

                    setBtnLoading(saveBtn, false);
                    showToast('تم تسجيل الاستهلاك بنجاح');
                },
                (runner) => runner.saveConsumption(consumption, currentDbId)
            );
            setTimeout(() => setBtnLoading(saveBtn, false), 1000);
            closeModal('consumptionModal');
        }

        function calculateStockValues() {
            const values = {
                atSale: 0,
                atPurchase: 0,
                potentialProfit: 0,
                productCount: 0,
                serviceCount: 0
            };

            allData.inventory.forEach(item => {
                const qty = safeNum(item.qty);
                const salePrice = safeNum(item.sale_price);
                const purchasePrice = safeNum(item.purchase_price || 0);

                if (item.category === 'خدمة') {
                    values.serviceCount++;
                } else {
                    values.productCount++;
                    values.atSale += qty * salePrice;
                    values.atPurchase += qty * purchasePrice;
                    values.potentialProfit += qty * (salePrice - purchasePrice);
                }
            });

            return values;
        }