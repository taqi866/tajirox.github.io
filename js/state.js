        // --- Translation System ---

        let currentLang = localStorage.getItem('appLang') || 'ar';


        let allData = { inventory: [], invoices: [], expenses: [], users: [], clients: [], payments: [], consumptions: [], checks_promissory: [], transfers: [] };
        let currentUser = null;
        let currentDbId = null; // متغير لتخزين معرف قاعدة البيانات
        let cart = [];
        let consumptionCart = [];
        let filters = { year: new Date().getFullYear(), month: "", day: "" };
        let isEditingInvoice = false;
        let currentDebtsSection = 'customers';
        let selectedProductForQty = null;
        let selectedProductForConsumption = null;
        let currentPaymentClient = null; // لتخزين الزبون/المورد الحالي لعرض دفعاته
        let currentDebtClient = null; // لتخزين الزبون/المورد الحالي لعرض ديونه
        let inventoryFilter = 'all';
        let currentFilteredInventory = [];
        let stockStats = { zero: 0, low: 0, normal: 0 };
        let inventorySearchTerm = '';
        let searchTimeout = null;
        let invoiceSearchTimeout = null; // متغير للتحكم في تأخير البحث في الفاتورة
        let consumptionSearchTimeout = null;
        let qzConnecting = false;
        let qzConnected = false;
        let qzPrintQueue = []; // File d'attente d'impression
        // نظام إدارة الرصيد البنكي الفوري
        let bankBalanceListeners = [];

        // دالة لحساب الرصيد البنكي (مخزنة في الذاكرة)
        let cachedBankBalance = 0;


        function t(key) {
            return translations[currentLang][key] || key;
        }

        function t(key, params = {}) {
            let text = translations[currentLang][key] || key;
            Object.keys(params).forEach(k => {
                text = text.replace(`{${k}}`, params[k]);
            });
            return text;
        }

        function changeLanguage(lang) {
            currentLang = lang;
            localStorage.setItem('appLang', lang);
            updateUI();
        }

        function toggleLanguage() {
            changeLanguage(currentLang === 'ar' ? 'fr' : 'ar');
        }

        function toggleHeroFeatures() {
            const grid = document.getElementById('heroFeaturesGrid');
            const icon = document.getElementById('featuresBtnIcon');
            if (grid) {
                if (grid.classList.contains('hidden')) {
                    grid.classList.remove('hidden');
                    grid.classList.add('grid');
                    if (icon) icon.className = 'fas fa-chevron-up';
                } else {
                    grid.classList.add('hidden');
                    grid.classList.remove('grid');
                    if (icon) icon.className = 'fas fa-th';
                }
            }
        }

        function updateUI() {
            // Update HTML dir and lang
            document.documentElement.lang = currentLang;
            document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';

            // Update Header Button
            const headerBtn = document.getElementById('headerLangBtn');
            if (headerBtn) headerBtn.innerText = currentLang === 'ar' ? 'FR' : 'AR';

            // Update all data-i18n elements
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (translations[currentLang][key]) {
                    el.innerText = translations[currentLang][key];
                }
            });

            // Update placeholders
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (translations[currentLang][key]) {
                    el.placeholder = translations[currentLang][key];
                }
            });

            // Re-render dynamic content if data exists
            if (allData && allData.inventory) {
                renderAll();
            }
        }

        async function initQZTray() {
            if (qzConnected || qzConnecting) return;

            qzConnecting = true;
            console.log('🖨️ Tentative de connexion à QZ Tray...');

            try {
                // Vérifier si QZ Tray est installé et en cours d'exécution
                if (!qz.websocket.isActive()) {
                    await qz.api.setPromiseType(function promise(resolver) {
                        return new Promise(resolver);
                    });
                    await qz.api.setSha256Type(function sha256(data) {
                        return CryptoJS.SHA256(data).toString();
                    });

                    // Connexion à QZ Tray
                    await qz.websocket.connect().then(() => {
                        console.log('✅ Connecté à QZ Tray');
                        qzConnected = true;
                        qzConnecting = false;

                        // Traiter la file d'attente d'impression
                        processPrintQueue();

                        // Vérifier les imprimantes disponibles
                        return qz.printers.find();
                    }).then((printers) => {
                        console.log('🖨️ Imprimantes disponibles:', printers);

                        // Sauvegarder la liste des imprimantes
                        if (!currentUser) currentUser = {};
                        if (!currentUser.printers) currentUser.printers = printers;

                        // Sélectionner automatiquement une imprimante thermique
                        selectDefaultThermalPrinter(printers);

                        return printers;
                    }).catch((err) => {
                        console.error('❌ Erreur de connexion QZ Tray:', err);
                        qzConnected = false;
                        qzConnecting = false;
                    });
                }
            } catch (e) {
                console.error('❌ Erreur lors de l\'initialisation QZ Tray:', e);
                qzConnected = false;
                qzConnecting = false;
            }
        }

        function selectDefaultThermalPrinter(printers) {
            if (!printers || printers.length === 0) return;

            // Chercher des imprimantes avec des noms typiques pour imprimantes thermiques
            const thermalKeywords = ['thermal', 'thermique', 'pos', 'receipt', 'ticket', 'epson', 'star', 'bixolon'];

            let selectedPrinter = printers.find(p =>
                thermalKeywords.some(keyword => p.name.toLowerCase().includes(keyword))
            );

            // Si aucune imprimante thermique trouvée, prendre la première
            if (!selectedPrinter && printers.length > 0) {
                selectedPrinter = printers[0];
            }

            if (selectedPrinter) {
                if (!currentUser) currentUser = {};
                currentUser.defaultPrinter = selectedPrinter.name;
                console.log('🖨️ Imprimante par défaut sélectionnée:', selectedPrinter.name);
            }
        }

        function processPrintQueue() {
            if (!qzConnected || qzPrintQueue.length === 0) return;

            console.log('🖨️ Traitement de la file d\'attente:', qzPrintQueue.length, 'travaux');

            while (qzPrintQueue.length > 0) {
                const job = qzPrintQueue.shift();
                printWithQZTray(job.data, job.printerName, job.width);
            }
        }

        async function printWithQZTray(invoiceData, printerName, width = '80mm') {
            try {
                // Vérifier si QZ Tray est connecté
                if (!qzConnected) {
                    console.log('🖨️ QZ Tray non connecté, ajout à la file d\'attente');
                    qzPrintQueue.push({ data: invoiceData, printerName, width });
                    initQZTray(); // Tenter de se connecter
                    return;
                }

                // Générer le contenu ESC/POS
                const printData = generateESCPOSContent(invoiceData, width);

                // Configuration de l'impression
                const config = qz.configs.create(printerName);

                // Envoyer à l'imprimante
                await qz.print(config, printData);

                console.log('✅ Impression réussie sur:', printerName);
                showToast('✅ تمت الطباعة بنجاح', 'success');

            } catch (error) {
                console.error('❌ Erreur d\'impression:', error);

                // Afficher une erreur plus explicite
                if (error.message.includes('not connected')) {
                    showToast('⚠️ QZ Tray non connecté. Veuillez lancer QZ Tray', 'error');
                } else if (error.message.includes('printer not found')) {
                    showToast('⚠️ Imprimante non trouvée', 'error');
                } else {
                    showToast('❌ Erreur d\'impression: ' + error.message, 'error');
                }

                // Ajouter à la file d'attente pour réessayer
                qzPrintQueue.push({ data: invoiceData, printerName, width });
            }
        }

        function generateESCPOSContent(invoiceData, width) {
            const shopName = currentUser?.shopName || 'Magasin';
            const shopPhone = currentUser?.shopPhone || '';
            const shopAddress = currentUser?.shopAddress || '';

            // Largeur du ticket (caractères)
            const widthStr = width.toString();
            const lineWidth = widthStr.includes('80') ? 42 : 32; // 42 pour 80mm, 32 pour 58mm

            function center(text) {
                const padding = Math.max(0, Math.floor((lineWidth - text.length) / 2));
                return ' '.repeat(padding) + text;
            }

            function line(char = '-') {
                return char.repeat(lineWidth);
            }

            let content = '';

            // En-tête
            content += center(shopName) + '\n';
            if (shopAddress) content += center(shopAddress) + '\n';
            if (shopPhone) content += center('Tél: ' + shopPhone) + '\n';
            content += line() + '\n';
            content += center('FACTURE #' + invoiceData.id) + '\n';
            content += 'Date: ' + invoiceData.date + '\n';
            content += 'Client: ' + (invoiceData.customer || 'Client général') + '\n';
            content += line() + '\n';

            // Articles
            content += 'Article'.padEnd(20) + 'Qté'.padEnd(6) + 'Prix'.padEnd(8) + 'Total\n';
            content += line() + '\n';

            try {
                const items = typeof invoiceData.items === 'string' ? JSON.parse(invoiceData.items) : invoiceData.items;
                items.forEach(item => {
                    const name = item.name.substring(0, 18);
                    const qty = item.selectedQty.toString().padEnd(6);
                    const price = safeNum(item.salePrice).toFixed(2).padEnd(8);
                    const total = (safeNum(item.salePrice) * safeNum(item.selectedQty)).toFixed(2);
                    content += name.padEnd(20) + qty + price + total + '\n';
                });
            } catch (e) {
                console.error('Erreur parsing items:', e);
            }

            content += line() + '\n';

            // Totaux
            const total = safeNum(invoiceData.total || 0);
            let paid = safeNum(invoiceData.paid || 0);
            let balance = safeNum(invoiceData.balance || 0);
            const discount = safeNum(invoiceData.discount || 0);
            const netTotal = total - discount;

            let paymentsText = '';
            if (invoiceData.type === 'خدمة') {
                const relatedPayments = allData.payments ? allData.payments.filter(p => String(p.debt_id) === String(invoiceData.id) && p.debt_type === 'invoice') : [];
                if (relatedPayments.length > 0) {
                    paid = relatedPayments.reduce((sum, p) => sum + safeNum(p.amount), 0);
                    balance = netTotal - paid;

                    paymentsText += line('-') + '\n';
                    paymentsText += center(t('payments_log') || 'سجل الدفوعات') + '\n';
                    paymentsText += line('-') + '\n';

                    relatedPayments.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(p => {
                        paymentsText += (p.date || '') + ' | ' + (p.method || '') + ' | ' + safeNum(p.amount).toFixed(2) + '\n';
                    });
                    paymentsText += line('-') + '\n';
                }
            }

            content += 'Total:'.padEnd(20) + total.toFixed(2) + '\n';
            if (discount > 0) {
                content += 'Remise:'.padEnd(20) + '-' + discount.toFixed(2) + '\n';
                content += 'Net:'.padEnd(20) + netTotal.toFixed(2) + '\n';
            }
            content += paymentsText;
            content += 'Payé:'.padEnd(20) + paid.toFixed(2) + '\n';
            content += 'Reste:'.padEnd(20) + balance.toFixed(2) + '\n';

            content += line('=') + '\n';
            content += center('Merci de votre visite') + '\n';
            content += center('@Tajiroxapp 2026') + '\n';
            content += '\n\n\n'; // Avancer le papier

            return [{
                type: 'raw',
                data: content,
                options: { language: 'escpos' }
            }];
        }

            function center(text) {
                const padding = Math.max(0, Math.floor((lineWidth - text.length) / 2));
                return ' '.repeat(padding) + text;
            }

            function line(char = '-') {
                return char.repeat(lineWidth);
            }

        function autoPrintThermalInvoice(invoiceId) {
            // Vérifier les préférences utilisateur
            if (!currentUser) return;
            if (currentUser.invoiceSize !== 'Thermal') return;

            const invoice = allData.invoices.find(i => i.id == invoiceId);
            if (!invoice) {
                console.error('Facture non trouvée:', invoiceId);
                return;
            }

            console.log('🖨️ Impression automatique avec QZ Tray pour facture:', invoiceId);

            const thermalWidth = currentUser.invoiceWidth || 80;
            const printerName = currentUser.defaultPrinter || '';

            if (!printerName) {
                console.log('Aucune imprimante par défaut, recherche...');
                if (qzConnected) {
                    qz.printers.find().then(printers => {
                        selectDefaultThermalPrinter(printers);
                        if (currentUser.defaultPrinter) {
                            printWithQZTray(invoice, currentUser.defaultPrinter, thermalWidth + 'mm');
                        }
                    });
                } else {
                    initQZTray();
                    qzPrintQueue.push({ data: invoice, printerName: '', width: thermalWidth + 'mm' });
                }
            } else {
                printWithQZTray(invoice, printerName, thermalWidth + 'mm');
            }
        }

        function testQZTrayConnection() {
            initQZTray();
            setTimeout(() => {
                if (qzConnected) {
                    showToast('✅ QZ Tray connecté', 'success');
                } else {
                    showToast('❌ QZ Tray non connecté', 'error');
                }
            }, 2000);
        }

        function updateQZStatus() {
            const statusEl = document.getElementById('qzStatus');
            if (statusEl) {
                statusEl.innerText = qzConnected ? '✅ متصل' : '❌ غير متصل';
                statusEl.className = qzConnected ? 'text-sm font-bold text-emerald-600' : 'text-sm font-bold text-rose-600';
            }
        }

        function loadPrinters() {
            if (!qzConnected) {
                initQZTray();
                setTimeout(loadPrinters, 2000);
                return;
            }

            qz.printers.find().then(printers => {
                const select = document.getElementById('qzPrinterSelect');
                if (!select) return;

                select.innerHTML = '<option value="">-- Sélectionner une imprimante --</option>';
                printers.forEach(printer => {
                    const option = document.createElement('option');
                    option.value = printer.name;
                    option.textContent = printer.name;
                    if (currentUser.defaultPrinter === printer.name) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });

                select.onchange = (e) => {
                    if (currentUser) {
                        currentUser.defaultPrinter = e.target.value;
                        showToast('✅ Imprimante par défaut enregistrée', 'success');
                    }
                };
            });
        }

        function addQZTraySettingsToPage() {
            // Vérifier si la section existe déjà
            if (document.getElementById('qzTraySection')) return;

            const settingsDiv = document.querySelector('#page-settings .space-y-6');
            if (!settingsDiv) return;

            const qzSection = document.createElement('div');
            qzSection.id = 'qzTraySection';
            qzSection.className = 'mt-6 pt-6 border-t border-slate-100';
            qzSection.innerHTML = `
        <h3 class="font-black text-slate-700 mb-4">إعدادات QZ Tray (طباعة مباشرة)</h3>
        <div class="space-y-4">
            <div class="flex items-center gap-4">
                <button onclick="testQZTrayConnection()" 
                        class="bg-indigo-600 text-white px-5 py-3 rounded-xl font-black text-sm hover:bg-indigo-700 transition-all">
                    <i class="fas fa-plug ml-2"></i> اختبار الاتصال
                </button>
                <span id="qzStatus" class="text-sm font-bold text-slate-400">غير متصل</span>
            </div>
            <div>
                <label class="text-[9px] font-black text-slate-400 block mb-1 px-1 uppercase">
                    الطابعة الافتراضية
                </label>
                <select id="qzPrinterSelect" class="w-full p-3 bg-slate-50 rounded-xl border-none font-bold outline-none">
                    <option value="">-- جاري تحميل قائمة الطابعات --</option>
                </select>
                <button onclick="loadPrinters()" class="mt-2 text-blue-600 text-xs font-bold hover:underline">
                    <i class="fas fa-sync-alt ml-1"></i> تحديث قائمة الطابعات
                </button>
            </div>
            <p class="text-xs text-slate-500 mt-2">
                <i class="fas fa-info-circle ml-1"></i> 
                يجب تثبيت وتشغيل QZ Tray على هذا الجهاز. قم بتحميله من 
                <a href="https://qz.io/download/" target="_blank" class="text-blue-600 hover:underline">qz.io</a>
            </p>
        </div>
    `;

            settingsDiv.appendChild(qzSection);

            // Charger les imprimantes après un délai
            setTimeout(loadPrinters, 1000);
        }

        function showAutoPrintHint() {
            const selectedSize = document.getElementById('settingInvoiceSize').value;
            if (selectedSize === 'Thermal') {
                showToast('🖨️ تم تفعيل الطباعة التلقائية الحرارية بعد إنشاء الفاتورة', 'info');
            }
        }

        function autoPrintThermalInvoice(invoiceId) {
            // التحقق من إعدادات المستخدم
            if (!currentUser) return;

            // التحقق من أن حجم الطباعة المحدد هو Thermal
            if (currentUser.invoiceSize !== 'Thermal') {
                console.log('الطباعة التلقائية: غير مفعلة لأن حجم الطباعة ليس Thermal');
                return;
            }

            console.log('جاري الطباعة التلقائية للفاتورة الحرارية:', invoiceId);

            // الحصول على عرض الورق من الإعدادات
            const thermalWidth = currentUser.invoiceWidth || 80;

            // تأخير بسيط للسماح بحفظ البيانات بالكامل
            setTimeout(() => {
                generateAndPrintInvoice(invoiceId, 'Thermal', thermalWidth);
            }, 500);
        }
