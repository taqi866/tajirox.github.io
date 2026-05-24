// =========================================================================
// TAJIROX - MODULE DE SUPPORT EN LIGNE (ONLINE CHAT & MESSAGING WIDGET)
// Powered by Vanilla JS & Tailwind CSS
// =========================================================================

// --- Configuration des Horaires de Travail ---
const WORKING_HOURS_START = 9;  // 09h00
const WORKING_HOURS_END = 20;    // 20h00

// --- État de session de discussion ---
let supportChatOpen = false;
let supportActiveConversationShop = null; // Pour le super_admin
let supportSyncInterval = null;

// --- Vérification des heures d'ouverture ---
function isSupportWorkingHours() {
    const now = new Date();
    const day = now.getDay(); // 0 = Dimanche, 1 = Lundi, ..., 6 = Samedi
    const hour = now.getHours();
    const mins = now.getMinutes();

    // Fermé le dimanche
    if (day === 0) return false;

    const timeVal = hour * 60 + mins;
    const startVal = WORKING_HOURS_START * 60;
    const endVal = WORKING_HOURS_END * 60;

    return timeVal >= startVal && timeVal < endVal;
}

// --- Initialiser le widget de support ---
function initSupportWidget() {
    if (!currentUser) return;

    // Le super_admin n'a pas de widget flottant, il utilise le tableau de bord d'administration
    if (currentUser.role === 'super_admin') {
        initAdminSupportTab();
        return;
    }

    // Éviter les injections doublons
    if (document.getElementById('supportBtn')) return;

    // 1. Injecter le bouton flottant (gauche pour l'arabe, droite pour le français)
    const alignClass = currentLang === 'fr' ? 'right-6' : 'left-6';
    const btn = document.createElement('button');
    btn.id = 'supportBtn';
    btn.onclick = toggleSupportChat;
    btn.className = `fixed bottom-6 ${alignClass} z-[200] w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all duration-300 hover:rotate-12 group border border-blue-400/20`;
    btn.innerHTML = `
        <span class="absolute -top-1 -right-1 flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSupportWorkingHours() ? 'bg-emerald-400' : 'bg-amber-400'}"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 ${isSupportWorkingHours() ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
        </span>
        <i class="fas fa-headset text-xl group-hover:scale-110 transition-transform"></i>
    `;
    document.body.appendChild(btn);

    // 2. Injecter la fenêtre de chat (gauche pour l'arabe, droite pour le français)
    const chatWindow = document.createElement('div');
    chatWindow.id = 'supportChatWindow';
    chatWindow.className = `fixed bottom-24 ${alignClass} z-[200] w-[350px] max-w-[calc(100vw-2rem)] h-[480px] bg-white rounded-[2rem] shadow-2xl border border-slate-100 flex flex-col hidden overflow-hidden transition-all duration-300 ease-out translate-y-4 opacity-0`;
    chatWindow.innerHTML = `
        <!-- Header -->
        <div class="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-lg">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                    <i class="fas fa-store-alt text-lg"></i>
                </div>
                <div>
                    <h4 class="font-black text-xs leading-none" data-i18n="support_title">Support en ligne</h4>
                    <span class="flex items-center gap-1.5 mt-1">
                        <span class="h-2 w-2 rounded-full ${isSupportWorkingHours() ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}"></span>
                        <span class="text-[9px] font-bold text-blue-100" id="supportStatusText">
                            ${isSupportWorkingHours() ? t('support_online') : t('support_offline')}
                        </span>
                    </span>
                </div>
            </div>
            <button onclick="toggleSupportChat()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                <i class="fas fa-times text-xs"></i>
            </button>
        </div>

        <!-- Working hours banner (offline warning) -->
        <div id="supportOfflineBanner" class="p-3 bg-amber-50 border-b border-amber-100 text-amber-800 text-[10px] font-bold leading-normal ${isSupportWorkingHours() ? 'hidden' : 'flex'} gap-2 items-start px-4">
            <i class="fas fa-exclamation-triangle mt-0.5 text-xs text-amber-500"></i>
            <span data-i18n="support_offline_alert">⚠️ Nous sommes hors horaires de travail. Vos messages sont conservés et nous vous répondrons dès que possible !</span>
        </div>

        <!-- Messages Container -->
        <div id="supportMessagesList" class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 scroll-smooth modal-scrollable-content">
            <!-- Messages injectés ici -->
        </div>

        <!-- Input Area -->
        <div class="p-3 bg-white border-t border-slate-100 flex gap-2 items-center">
            <input type="text" id="supportMessageInput" onkeydown="if(event.key==='Enter') sendUserCustomMessage()" 
                placeholder="Écrivez votre question ici..." data-i18n-placeholder="support_placeholder"
                class="flex-1 px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 text-xs">
            <button onclick="sendUserCustomMessage()" id="supportSendBtn"
                class="w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center shadow-md active:scale-95 transition-all flex-shrink-0">
                <i class="fas fa-paper-plane text-xs"></i>
            </button>
        </div>
    `;
    document.body.appendChild(chatWindow);

    // Initialiser les messages
    loadUserChatHistory();

    // Lancer la synchronisation périodique avec le super_admin et le serveur
    supportSyncInterval = setInterval(() => {
        loadUserChatHistory();
        syncUserChatWithServer();
    }, 2000);
}

// --- Détruire le widget lors de la déconnexion ---
function destroySupportWidget() {
    if (supportSyncInterval) {
        clearInterval(supportSyncInterval);
        supportSyncInterval = null;
    }
    const btn = document.getElementById('supportBtn');
    if (btn) btn.remove();
    const chat = document.getElementById('supportChatWindow');
    if (chat) chat.remove();
    supportChatOpen = false;
}

// --- Ouvrir/Fermer la fenêtre de chat ---
function toggleSupportChat() {
    const chat = document.getElementById('supportChatWindow');
    if (!chat) return;

    if (supportChatOpen) {
        // Fermer
        chat.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => chat.classList.add('hidden'), 200);
        supportChatOpen = false;
    } else {
        // Ouvrir
        chat.classList.remove('hidden');
        setTimeout(() => chat.classList.remove('translate-y-4', 'opacity-0'), 10);
        supportChatOpen = true;
        scrollToBottom('supportMessagesList');
    }
}

// --- Rendu des suggestions de questions (FAQ) ---
function renderUserSuggestions() {
    const suggPanel = document.getElementById('supportSuggestions');
    if (!suggPanel) return;

    const listFr = [
        { label: "📦 Ajouter un produit", q: "Comment ajouter un produit dans le stock ?" },
        { label: "🖨️ Créer une facture", q: "Comment créer et imprimer une facture ?" },
        { label: "💸 Suivre les dettes", q: "Comment gérer les dettes des clients ?" },
        { label: "🏦 Trésorerie & Banque", q: "Comment transférer des fonds dans la trésorerie ?" },
        { label: "💎 Tarifs d'Abonnement", q: "Quels sont les tarifs de l'abonnement ?" }
    ];

    const listAr = [
        { label: "📦 إضافة منتج", q: "كيف يمكنني إضافة منتج إلى المخزون؟" },
        { label: "🖨️ إنشاء فاتورة", q: "كيف يمكنني إنشاء وطباعة فاتورة؟" },
        { label: "💸 تتبع الديون", q: "كيف يمكنني تتبع ديون الزبائن؟" },
        { label: "🏦 تحويلات الخزينة", q: "كيف يمكنني تحويل الأموال في الخزينة؟" },
        { label: "💎 أسعار الاشتراك", q: "ما هي أسعار خطة الاشتراك؟" }
    ];

    const currentList = currentLang === 'ar' ? listAr : listFr;
    suggPanel.innerHTML = '';

    currentList.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'px-3 py-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-full font-bold text-[10px] text-slate-500 whitespace-nowrap border border-slate-100 transition-colors cursor-pointer active:scale-95';
        btn.textContent = item.label;
        btn.onclick = () => sendUserFAQMessage(item.q);
        suggPanel.appendChild(btn);
    });
}

// --- Charger et afficher l'historique du chat utilisateur ---
function loadUserChatHistory() {
    const list = document.getElementById('supportMessagesList');
    if (!list) return;

    const key = `tajirox_support_conversations`;
    let db = JSON.parse(localStorage.getItem(key)) || {};
    const shopId = currentUser?.shopName || 'DefaultShop';
    let thread = db[shopId] || [];

    // Si le thread est vide, on ajoute le message de bienvenue initial
    if (thread.length === 0) {
        thread.push({
            id: 'welcome',
            sender: 'system',
            text: t('support_welcome'),
            timestamp: new Date().toISOString()
        });
        db[shopId] = thread;
        localStorage.setItem(key, JSON.stringify(db));
    }

    // Nombre de messages actuellement affichés
    const currentCount = list.querySelectorAll('.chat-msg').length;
    if (currentCount === thread.length) return; // Aucun changement

    list.innerHTML = '';
    thread.forEach(msg => {
        const row = document.createElement('div');
        row.className = 'flex w-full chat-msg';

        if (msg.sender === 'user') {
            // Message utilisateur (à droite)
            row.classList.add('justify-end');
            row.innerHTML = `
                <div class="max-w-[75%] bg-blue-600 text-white rounded-[1.5rem] rounded-tr-none px-4 py-2.5 shadow-sm">
                    <p class="text-xs font-bold leading-relaxed break-words">${escapeHTML(msg.text)}</p>
                    <span class="text-[8px] text-blue-200 block text-right mt-1 font-semibold">${formatTime(msg.timestamp)}</span>
                </div>
            `;
        } else if (msg.sender === 'system' && msg.isSystemHoursWarning) {
            // Message d'avertissement d'heures de travail (centré)
            row.classList.add('justify-center');
            row.innerHTML = `
                <div class="max-w-[85%] bg-amber-50 text-amber-800 border border-amber-100 rounded-2xl px-4 py-2 text-center text-[9px] font-bold shadow-sm">
                    <i class="fas fa-clock mr-1 text-amber-500"></i> ${escapeHTML(msg.text)}
                </div>
            `;
        } else {
            // Message de l'admin système / chatbot (à gauche)
            row.classList.add('justify-start');
            const isWelcome = msg.id === 'welcome';
            row.innerHTML = `
                <div class="max-w-[75%] bg-white border border-slate-100 text-slate-800 rounded-[1.5rem] rounded-tl-none px-4 py-2.5 shadow-sm">
                    <span class="text-[9px] font-black text-indigo-600 block mb-0.5">${isWelcome ? 'Tajirox Bot' : t('support_title')}</span>
                    <p class="text-xs font-semibold leading-relaxed break-words whitespace-pre-wrap">${escapeHTML(msg.text)}</p>
                    <span class="text-[8px] text-slate-400 block mt-1 font-semibold">${formatTime(msg.timestamp)}</span>
                </div>
            `;
        }
        list.appendChild(row);
    });

    scrollToBottom('supportMessagesList');
}

// --- Envoyer une question de la FAQ ---
function sendUserFAQMessage(questionText) {
    appendUserMessage(questionText);
    
    // Déclencher une réponse automatique immédiate en fonction du mot-clé
    setTimeout(() => {
        const answer = getSmartBotAnswer(questionText);
        appendAdminReply(answer);
    }, 800);
}

// --- Envoyer une question personnalisée ---
function sendUserCustomMessage() {
    const input = document.getElementById('supportMessageInput');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    appendUserMessage(text);
}

// --- Ajouter le message utilisateur dans le stockage partagé ---
function appendUserMessage(text) {
    const key = `tajirox_support_conversations`;
    let db = JSON.parse(localStorage.getItem(key)) || {};
    const shopId = currentUser?.shopName || 'DefaultShop';
    let thread = db[shopId] || [];

    const msgId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const nowIso = new Date().toISOString();

    // Ajouter le message de l'utilisateur localement
    thread.push({
        id: msgId,
        sender: 'user',
        text: text,
        timestamp: nowIso
    });

    // RÈGLE CRITIQUE : Si envoyé HORS LIGNE (hors horaires), on injecte AUTOMATIQUEMENT le message système
    let isOffline = !isSupportWorkingHours();
    const sysId = 'sys_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    if (isOffline) {
        thread.push({
            id: sysId,
            sender: 'system',
            text: t('support_offline_sys_msg'),
            timestamp: nowIso,
            isSystemHoursWarning: true
        });
    }

    db[shopId] = thread;
    localStorage.setItem(key, JSON.stringify(db));
    loadUserChatHistory();

    // Persister sur le serveur Google Sheets en lui transmettant le même ID unique local
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(res => {
                if (res && res.success) {
                    console.log("Message de support synchronisé sur le serveur :", res.id);
                }
            })
            .saveSupportMessageOnServer(shopId, 'user', text, currentUser?.username || 'user', false, msgId);

        if (isOffline) {
            google.script.run.saveSupportMessageOnServer(shopId, 'system', t('support_offline_sys_msg'), currentUser?.username || 'user', true, sysId);
        }
    }
}

// --- Ajouter le message de l'admin (réponse) dans le stockage ---
function appendAdminReply(text) {
    const key = `tajirox_support_conversations`;
    let db = JSON.parse(localStorage.getItem(key)) || {};
    const shopId = currentUser?.shopName || 'DefaultShop';
    let thread = db[shopId] || [];

    thread.push({
        id: 'msg_' + Date.now(),
        sender: 'admin',
        text: text,
        timestamp: new Date().toISOString()
    });

    db[shopId] = thread;
    localStorage.setItem(key, JSON.stringify(db));
    loadUserChatHistory();
}

// --- Robot intelligent (Keyword Matching) ---
function getSmartBotAnswer(query) {
    const q = query.toLowerCase();
    
    // Dictionnaire français
    const qaFr = [
        {
            keys: ["produit", "stock", "ajouter", "article", "inventaire"],
            ans: "Pour ajouter un produit au stock :\n1. Allez dans le menu **Stock** (المخزون).\n2. Cliquez sur le bouton **+ Nouveau produit** (منتج جديد).\n3. Remplissez les informations (Code, Nom, Quantité, Prix d'achat et Prix de vente).\n4. Cliquez sur **Enregistrer**."
        },
        {
            keys: ["facture", "creer", "vente", "imprimer", "client"],
            ans: "Pour créer une facture :\n1. Allez dans le menu **Factures** (الفواتير).\n2. Cliquez sur **+ Facture de vente**.\n3. Utilisez la barre de recherche pour ajouter des articles au panier.\n4. Sélectionnez le client (ou laissez Client général).\n5. Saisissez le montant payé et le type de paiement (Espèces, Chèque, etc.).\n6. Cliquez sur **Sauvegarder la facture**.\n\n*Astuce* : Pour la imprimer directement sur votre ticket thermique, installez le plugin **QZ Tray**."
        },
        {
            keys: ["dette", "credit", "regler", "rembourser", "client", "fournisseur"],
            ans: "Pour suivre et régler les dettes :\n1. Allez dans **Clients** (الزبناء) ou **Fournisseurs** (الموردين).\n2. Le total des dettes en cours s'affiche immédiatement.\n3. Pour enregistrer un règlement, cliquez sur le bouton **Régler** (تسديد) à côté du nom de la personne.\n4. Entrez le montant versé et validez. Cela mettra automatiquement à jour votre trésorerie."
        },
        {
            keys: ["tresorerie", "caisse", "banque", "transfert", "liquide", "argent"],
            ans: "Le module Trésorerie (الخزينة) vous permet de :\n1. Suivre les fonds réels en **Caisse** et en **Banque**.\n2. Effectuer des virements internes en cliquant sur **Transfert financier**.\n3. Toute facture enregistrée avec encaissement ou dépense réglée met à jour vos soldes immédiatement."
        },
        {
            keys: ["tarif", "prix", "abonnement", "combien", "acheter", "activer", "payer"],
            ans: "L'abonnement annuel complet de Tajirox est de **1200 DH par an**.\nCe tarif inclut :\n- Tous les modules inclus en illimité (Stock, Factures, Trésorerie, Dettes, Rapports).\n- Support pour 2 comptes utilisateurs (Directeur + 1 Employé).\n- Mises à jour gratuites. Vous pouvez renouveler à tout moment via le menu **Mon abonnement**."
        },
        {
            keys: ["contact", "support", "humain", "telephone", "email", "mail", "whatsapp"],
            ans: "Pour joindre un conseiller technique :\n- **Email** : contact@tajirox.com\n- **WhatsApp** : +212 689-178241\n- Heures de support en direct : Lundi au Samedi, de 09:00 à 20:00."
        }
    ];

    // Dictionnaire arabe
    const qaAr = [
        {
            keys: ["منتج", "مخزون", "سلعة", "إضافة", "اضافة"],
            ans: "لإضافة منتج إلى المخزون:\n1. اذهب إلى قائمة **المخزون**.\n2. انقر على زر **+ منتج جديد**.\n3. املأ البيانات المطلوبة (كود المنتج، الاسم، الكمية الحالية، سعر الشراء، وسعر البيع).\n4. اضغط على **حفظ**."
        },
        {
            keys: ["فاتورة", "بيع", "انشاء", "فواتير", "زبون", "طباعة", "طباعه"],
            ans: "لإنشاء فاتورة جديدة:\n1. اذهب إلى قائمة **الفواتير**.\n2. انقر على زر **+ فاتورة بيع**.\n3. استخدم شريط البحث لإضافة المنتجات إلى السلة.\n4. اختر الزبون (أو اتركه زبون عام).\n5. أدخل المبلغ المدفوع وحدد طريقة الدفع (صندوق، شيك، إلخ).\n6. انقر على **حفظ الفاتورة** ويمكنك طباعتها مباشرة.\n\n*تلميح* : للطباعة المباشرة على طابعة الإيصالات الحرارية، تأكد من تثبيت وتشغيل برنامج **QZ Tray**."
        },
        {
            keys: ["دين", "ديون", "تسديد", "دفع", "كريديت", "زبون", "مورد"],
            ans: "لتتبع وتسديد الديون:\n1. اذهب إلى قائمة **الزبناء والموردين** ثم اختر **الزبناء** أو **الموردين**.\n2. ستظهر لك الديون المستحقة فوراً بجانب كل اسم.\n3. لتسجيل دفعة وتخفيض الدين، انقر على زر **تسديد** بجانب اسم الشخص.\n4. أدخل المبلغ وتاريخ السداد ثم اضغط على حفظ. سيتم تحديث الخزينة تلقائياً."
        },
        {
            keys: ["خزينة", "خزينه", "صندوق", "صندوق", "بنك", "تحويل", "سيولة", "مال"],
            ans: "تدبير الخزينة يتيح لك:\n1. الاطلاع على الأرصدة المالية الفعلية في **الصندوق** و**البنك**.\n2. تسجيل عمليات تحويل الأموال (مثال: من الصندوق إلى البنك) بالضغط على زر **تحويل**.\n3. فواتير البيع والمصاريف التي تسجلها تؤثر وتحدث أرصدة الخزينة تلقائياً."
        },
        {
            keys: ["سعر", "ثمن", "اشتراك", "اشتراكي", "تفعيل", "تجديد", "شراء"],
            ans: "الاشتراك السنوي في نظام Tajirox هو **1200 درهم سنوياً**.\nيتضمن هذا الاشتراك:\n- الوصول الكامل لجميع أقسام النظام (المخزون، الفواتير، الخزينة، الديون، التقارير).\n- دعم مستخدمين كحد أقصى (المدير + موظف واحد).\n- نسخ احتياطي ومزامنة البيانات. يمكنك طلب التجديد أو التفعيل من قائمة **اشتراكي**."
        },
        {
            keys: ["اتصال", "تواصل", "دعم", "هاتف", "رقم", "إيميل", "بريد", "واتساب", "مساعدة"],
            ans: "يمكنك التواصل مع الدعم الفني المباشر:\n- **البريد الإلكتروني**: contact@tajirox.com\n- **واتساب**: +212 689-178241\n- أوقات العمل والدعم المباشر: من الاثنين إلى السبت (09:00 - 20:00)."
        }
    ];

    const currentList = currentLang === 'ar' ? qaAr : qaFr;

    // Chercher la première correspondance
    for (let item of currentList) {
        if (item.keys.some(k => q.includes(k))) {
            return item.ans;
        }
    }
    return null; // Retourner null si aucune correspondance
}


// =========================================================================
//            LOGIQUE D'ADMINISTRATION DU SUPPORT (SUPER_ADMIN)
// =========================================================================

// --- Initialiser l'onglet Support dans le Dashboard Admin ---
function initAdminSupportTab() {
    // Si l'onglet est déjà rendu dans l'UI, on ne fait rien
    const supportTabContainer = document.getElementById('adminSupportTabContainer');
    if (supportTabContainer) return;

    // Rendre l'interface utilisateur des onglets sur admin-dashboard
    const dashboardPage = document.getElementById('page-admin-dashboard');
    if (!dashboardPage) return;

    // 1. Ajouter la barre d'onglets (Shops vs Support) au début du dashboard
    const titleHeader = dashboardPage.querySelector('h2');
    if (titleHeader) {
        const tabsDiv = document.createElement('div');
        tabsDiv.className = 'flex border-b border-slate-100 mb-6 gap-2';
        tabsDiv.innerHTML = `
            <button onclick="switchAdminTab('shops')" id="adminTabShopsBtn" 
                class="px-5 py-3 border-b-2 border-indigo-600 text-indigo-600 font-black text-xs transition-all flex items-center gap-2">
                <i class="fas fa-store"></i> <span data-i18n="support_tab_shops">${t('support_tab_shops')}</span>
            </button>
            <button onclick="switchAdminTab('support')" id="adminTabSupportBtn" 
                class="px-5 py-3 border-b-2 border-transparent text-slate-400 hover:text-slate-600 font-bold text-xs transition-all flex items-center gap-2 relative">
                <i class="fas fa-comments"></i> <span data-i18n="support_tab_chat">${t('support_tab_chat')}</span>
                <span id="adminSupportBadge" class="hidden absolute top-1 right-1 bg-rose-500 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-black">0</span>
            </button>
        `;
        titleHeader.after(tabsDiv);
    }

    // 2. Structurer la page pour avoir les deux conteneurs d'onglets
    const shopsTableContainer = dashboardPage.querySelector('.bg-white.p-5');
    if (shopsTableContainer) {
        shopsTableContainer.id = 'adminShopsTabContainer';
        
        // Créer le conteneur du support
        const supportContainer = document.createElement('div');
        supportContainer.id = 'adminSupportTabContainer';
        supportContainer.className = 'grid grid-cols-1 lg:grid-cols-3 gap-6 hidden';
        supportContainer.innerHTML = `
            <!-- Boîte de réception (Gauche) -->
            <div class="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col h-[500px]">
                <h3 class="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
                    <i class="fas fa-inbox text-indigo-600"></i> <span data-i18n="support_admin_title">${t('support_admin_title')}</span>
                </h3>
                <div id="adminInboxList" class="flex-1 overflow-y-auto space-y-2 modal-scrollable-content">
                    <!-- Conversations chargées ici -->
                </div>
            </div>

            <!-- Fenêtre de chat active (Droite) -->
            <div class="lg:col-span-2 bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col h-[500px]">
                <div id="adminActiveChatPlaceholder" class="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                    <i class="fas fa-comments text-5xl opacity-40"></i>
                    <p class="font-bold text-xs" data-i18n="support_no_tickets">${t('support_no_tickets')}</p>
                </div>

                <div id="adminActiveChatPanel" class="flex-1 flex flex-col h-full hidden overflow-hidden">
                    <!-- En-tête de conversation -->
                    <div class="pb-3 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h4 id="adminActiveChatTitle" class="font-black text-slate-800 text-xs">...</h4>
                            <span class="text-[9px] text-slate-400 font-semibold" id="adminActiveChatSubtitle">...</span>
                        </div>
                        <span id="adminActiveChatHoursWarning" class="hidden px-3 py-1 bg-amber-50 text-amber-800 border border-amber-100 rounded-full font-black text-[8px] animate-pulse">
                            ⚠️ Hors horaires de travail
                        </span>
                    </div>

                    <!-- Liste des messages -->
                    <div id="adminActiveChatMessages" class="flex-1 overflow-y-auto py-4 space-y-3 modal-scrollable-content bg-slate-50/30 rounded-2xl p-3 my-3">
                        <!-- Messages chargés ici -->
                    </div>

                    <!-- Champ de réponse -->
                    <div class="pt-3 border-t border-slate-100 flex gap-2 items-center">
                        <input type="text" id="adminReplyInput" onkeydown="if(event.key==='Enter') sendAdminSupportReply()" 
                            placeholder="اكتب ردك هنا..." data-i18n-placeholder="support_write_reply"
                            class="flex-1 px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 text-xs">
                        <button onclick="sendAdminSupportReply()"
                            class="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center shadow-md active:scale-95 transition-all flex-shrink-0">
                            <i class="fas fa-paper-plane text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        shopsTableContainer.after(supportContainer);
    }

    // Charger les conversations périodiquement pour le super_admin
    supportSyncInterval = setInterval(() => {
        loadAdminSupportInbox();
        syncAdminInboxWithServer();
    }, 2000);
}

// --- Basculer les onglets dans le Dashboard de l'administrateur ---
function switchAdminTab(tab) {
    const shopsBtn = document.getElementById('adminTabShopsBtn');
    const supportBtn = document.getElementById('adminTabSupportBtn');
    const shopsContainer = document.getElementById('adminShopsTabContainer');
    const supportContainer = document.getElementById('adminSupportTabContainer');

    if (!shopsBtn || !supportBtn || !shopsContainer || !supportContainer) return;

    if (tab === 'shops') {
        // Afficher Boutiques
        shopsBtn.className = 'px-5 py-3 border-b-2 border-indigo-600 text-indigo-600 font-black text-xs transition-all flex items-center gap-2';
        supportBtn.className = 'px-5 py-3 border-b-2 border-transparent text-slate-400 hover:text-slate-600 font-bold text-xs transition-all flex items-center gap-2 relative';
        shopsContainer.classList.remove('hidden');
        supportContainer.classList.add('hidden');
    } else {
        // Afficher Support
        supportBtn.className = 'px-5 py-3 border-b-2 border-indigo-600 text-indigo-600 font-black text-xs transition-all flex items-center gap-2 relative';
        shopsBtn.className = 'px-5 py-3 border-b-2 border-transparent text-slate-400 hover:text-slate-600 font-bold text-xs transition-all flex items-center gap-2';
        shopsContainer.classList.add('hidden');
        supportContainer.classList.remove('hidden');
        
        loadAdminSupportInbox();
    }
}

// --- Charger et afficher la boîte de réception d'administration ---
function loadAdminSupportInbox() {
    const inbox = document.getElementById('adminInboxList');
    if (!inbox) return;

    const key = `tajirox_support_conversations`;
    let db = JSON.parse(localStorage.getItem(key)) || {};
    const shops = Object.keys(db);

    let unrepliedCount = 0;
    
    // Trier les conversations par date du dernier message (décroissant)
    const sortedShops = [];
    shops.forEach(shopName => {
        const thread = db[shopName];
        if (thread.length > 0) {
            const lastMsg = thread[thread.length - 1];
            // Vérifier si le dernier message est en attente de réponse (envoyé par l'utilisateur et non répondu)
            const isUnreplied = lastMsg.sender === 'user';
            if (isUnreplied) unrepliedCount++;

            sortedShops.push({
                name: shopName,
                lastMsg: lastMsg,
                isUnreplied: isUnreplied
            });
        }
    });

    sortedShops.sort((a, b) => new Date(b.lastMsg.timestamp) - new Date(a.lastMsg.timestamp));

    // Mettre à jour le badge rouge sur l'onglet
    const badge = document.getElementById('adminSupportBadge');
    if (badge) {
        if (unrepliedCount > 0) {
            badge.innerText = unrepliedCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    // Si pas de conversations, afficher message vide
    if (sortedShops.length === 0) {
        inbox.innerHTML = `
            <div class="text-center py-8 text-slate-400 text-xs font-bold">
                <i class="fas fa-folder-open text-3xl opacity-40 mb-2 block"></i>
                ${t('support_no_tickets')}
            </div>
        `;
        return;
    }

    inbox.innerHTML = '';
    sortedShops.forEach(shop => {
        const div = document.createElement('div');
        const isActive = supportActiveConversationShop === shop.name;
        
        div.className = `p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1 active:scale-98 ${
            isActive 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm' 
                : shop.isUnreplied 
                    ? 'bg-rose-50/50 border-rose-100 text-slate-800' 
                    : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-800'
        }`;
        
        div.onclick = () => selectAdminActiveConversation(shop.name);

        const snippet = shop.lastMsg.text.length > 50 ? shop.lastMsg.text.substring(0, 50) + '...' : shop.lastMsg.text;

        div.innerHTML = `
            <div class="flex justify-between items-start">
                <span class="font-black text-xs flex-1 truncate">${escapeHTML(shop.name)}</span>
                <span class="text-[8px] font-bold text-slate-400 pl-2 whitespace-nowrap">${formatTime(shop.lastMsg.timestamp)}</span>
            </div>
            <p class="text-[10px] text-slate-500 font-semibold truncate mt-0.5">${escapeHTML(snippet)}</p>
            <div class="flex justify-between items-center mt-1.5">
                <span class="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-black truncate max-w-[120px]">
                    ${escapeHTML(shop.lastMsg.username || 'user')}
                </span>
                ${shop.isUnreplied 
                    ? '<span class="text-[7px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-black animate-pulse uppercase tracking-wider">En attente</span>' 
                    : '<span class="text-[7px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Répondu</span>'
                }
            </div>
        `;
        inbox.appendChild(div);
    });

    // Rafraîchir les messages de la conversation active si elle est ouverte
    if (supportActiveConversationShop) {
        renderAdminActiveChatMessages();
    }
}

// --- Sélectionner une conversation active par l'administrateur ---
function selectAdminActiveConversation(shopName) {
    supportActiveConversationShop = shopName;

    // Masquer le placeholder, afficher le chat panel
    document.getElementById('adminActiveChatPlaceholder').classList.add('hidden');
    document.getElementById('adminActiveChatPanel').classList.remove('hidden');

    // Mettre à jour l'en-tête
    document.getElementById('adminActiveChatTitle').innerText = shopName;
    document.getElementById('adminActiveChatSubtitle').innerText = t('support_ticket_from', { shop: shopName });

    // Mettre en évidence dans la liste
    loadAdminSupportInbox();
    renderAdminActiveChatMessages();
}

// --- Rendu des messages de la conversation sélectionnée dans l'espace admin ---
function renderAdminActiveChatMessages() {
    const container = document.getElementById('adminActiveChatMessages');
    const warningBadge = document.getElementById('adminActiveChatHoursWarning');
    if (!container) return;

    // Afficher l'avertissement d'horaires dans l'en-tête de l'admin
    if (warningBadge) {
        warningBadge.classList.toggle('hidden', isSupportWorkingHours());
    }

    const key = `tajirox_support_conversations`;
    let db = JSON.parse(localStorage.getItem(key)) || {};
    let thread = db[supportActiveConversationShop] || [];

    const currentCount = container.querySelectorAll('.chat-msg-admin').length;
    if (currentCount === thread.length) return; // Pas de nouveaux messages

    container.innerHTML = '';
    thread.forEach(msg => {
        const row = document.createElement('div');
        row.className = 'flex w-full chat-msg-admin';

        if (msg.sender === 'admin') {
            // Message admin (à droite)
            row.classList.add('justify-end');
            row.innerHTML = `
                <div class="max-w-[75%] bg-indigo-600 text-white rounded-[1.5rem] rounded-tr-none px-4 py-2.5 shadow-sm">
                    <p class="text-xs font-bold leading-relaxed break-words">${escapeHTML(msg.text)}</p>
                    <span class="text-[8px] text-indigo-200 block text-right mt-1 font-semibold">${formatTime(msg.timestamp)}</span>
                </div>
            `;
        } else if (msg.sender === 'system' && msg.isSystemHoursWarning) {
            // Message d'avertissement d'heures (centré)
            row.classList.add('justify-center');
            row.innerHTML = `
                <div class="max-w-[85%] bg-amber-50 text-amber-800 border border-amber-100 rounded-2xl px-4 py-2 text-center text-[9px] font-bold shadow-sm">
                    <i class="fas fa-clock mr-1 text-amber-500"></i> ${escapeHTML(msg.text)}
                </div>
            `;
        } else {
            // Message utilisateur (à gauche)
            row.classList.add('justify-start');
            row.innerHTML = `
                <div class="max-w-[75%] bg-white border border-slate-100 text-slate-800 rounded-[1.5rem] rounded-tl-none px-4 py-2.5 shadow-sm">
                    <span class="text-[9px] font-black text-slate-400 block mb-0.5">${escapeHTML(msg.username || 'Client')}</span>
                    <p class="text-xs font-semibold leading-relaxed break-words">${escapeHTML(msg.text)}</p>
                    <span class="text-[8px] text-slate-400 block mt-1 font-semibold">${formatTime(msg.timestamp)}</span>
                </div>
            `;
        }
        container.appendChild(row);
    });

    scrollToBottom('adminActiveChatMessages');
}

// --- Envoyer une réponse du support par le super_admin ---
function sendAdminSupportReply() {
    const input = document.getElementById('adminReplyInput');
    if (!input || !supportActiveConversationShop) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = '';

    const key = `tajirox_support_conversations`;
    let db = JSON.parse(localStorage.getItem(key)) || {};
    let thread = db[supportActiveConversationShop] || [];

    const msgId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const nowIso = new Date().toISOString();

    // 1. Ajouter la réponse de l'admin localement
    thread.push({
        id: msgId,
        sender: 'admin',
        text: text,
        timestamp: nowIso,
        username: 'super_admin'
    });

    // RÈGLE CRITIQUE : Si envoyé HORS LIGNE (hors horaires), on injecte AUTOMATIQUEMENT le message système
    let isOffline = !isSupportWorkingHours();
    const sysId = 'sys_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    if (isOffline) {
        thread.push({
            id: sysId,
            sender: 'system',
            text: t('support_offline_sys_msg'),
            timestamp: nowIso,
            isSystemHoursWarning: true
        });
    }

    db[supportActiveConversationShop] = thread;
    localStorage.setItem(key, JSON.stringify(db));
    loadAdminSupportInbox();

    // 2. Persister sur le serveur Google Sheets en lui transmettant le même ID unique local
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(res => {
                if (res && res.success) {
                    console.log("Réponse admin synchronisée sur le serveur :", res.id);
                }
            })
            .saveSupportMessageOnServer(supportActiveConversationShop, 'admin', text, 'super_admin', false, msgId);

        if (isOffline) {
            google.script.run.saveSupportMessageOnServer(supportActiveConversationShop, 'system', t('support_offline_sys_msg'), 'super_admin', true, sysId);
        }
    }
}


// =========================================================================
//            FONCTIONS HELPERS DU SYSTEME DE MESSAGERIE
// =========================================================================

function formatTime(isoString) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const hours = date.getHours().toString().padStart(2, '0');
        const mins = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${mins}`;
    } catch (e) {
        return '';
    }
}

function scrollToBottom(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 50);
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Exposer globalement pour les onclick dans les templates
window.toggleSupportChat = toggleSupportChat;
window.sendUserCustomMessage = sendUserCustomMessage;
window.switchAdminTab = switchAdminTab;
window.selectAdminActiveConversation = selectAdminActiveConversation;
window.sendAdminSupportReply = sendAdminSupportReply;

// --- Extension globale du système de traduction de l'application (updateUI) ---
const originalUpdateUI = window.updateUI || (typeof updateUI !== 'undefined' ? updateUI : null);
window.updateUI = function() {
    if (originalUpdateUI) {
        originalUpdateUI();
    }
    
    // Ajuster dynamiquement le positionnement selon la langue active (Français à droite, Arabe à gauche)
    const btn = document.getElementById('supportBtn');
    const win = document.getElementById('supportChatWindow');
    if (btn && win) {
        if (currentLang === 'fr') {
            btn.classList.remove('left-6');
            btn.classList.add('right-6');
            win.classList.remove('left-6');
            win.classList.add('right-6');
        } else {
            btn.classList.remove('right-6');
            btn.classList.add('left-6');
            win.classList.remove('right-6');
            win.classList.add('left-6');
        }
    }
    
    // Mettre à jour l'avertissement hors horaires si présent
    const offlineBanner = document.getElementById('supportOfflineBanner');
    if (offlineBanner && typeof t === 'function') {
        const textSpan = offlineBanner.querySelector('[data-i18n="support_offline_alert"]');
        if (textSpan) {
            textSpan.innerText = t('support_offline_alert');
        }
    }
    
    // Mettre à jour le texte du statut en ligne/hors ligne
    const statusText = document.getElementById('supportStatusText');
    if (statusText && typeof t === 'function') {
        statusText.innerText = isSupportWorkingHours() ? t('support_online') : t('support_offline');
    }
    
    // Mettre à jour le placeholder de saisie du message
    const inputField = document.getElementById('supportMessageInput');
    if (inputField && typeof t === 'function') {
        inputField.placeholder = t('support_placeholder');
    }
};

// ==================== FONCTIONS DE SYNCHRONISATION SERVEUR ====================

// --- Synchroniser les messages de la boutique courante avec le serveur ---
function syncUserChatWithServer() {
    if (!currentUser || currentUser.role === 'super_admin') return;
    const shopId = currentUser.shopName || 'DefaultShop';
    
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(serverMessages => {
                if (!serverMessages || serverMessages.length === 0) return;
                
                const key = `tajirox_support_conversations`;
                let db = JSON.parse(localStorage.getItem(key)) || {};
                let thread = db[shopId] || [];
                
                // Fusionner les messages du serveur sans doublons (vérification d'ID et tolérance heuristique)
                let updated = false;
                serverMessages.forEach(sMsg => {
                    const exists = thread.some(lMsg => {
                        if (lMsg.id === sMsg.id) return true;
                        
                        // Si même expéditeur, même texte et écart < 15 sec, c'est le même message : on aligne son ID local
                        const timeDiff = Math.abs(new Date(lMsg.timestamp) - new Date(sMsg.timestamp));
                        if (lMsg.sender === sMsg.sender && lMsg.text === sMsg.text && timeDiff < 15000) {
                            lMsg.id = sMsg.id;
                            return true;
                        }
                        return false;
                    });
                    
                    if (!exists) {
                        thread.push(sMsg);
                        updated = true;
                    }
                });
                
                if (updated) {
                    // Trier par timestamp
                    thread.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    db[shopId] = thread;
                    localStorage.setItem(key, JSON.stringify(db));
                    loadUserChatHistory();
                }
            })
            .getSupportMessagesFromServer(shopId);
    }
}

// --- Synchroniser la boîte de réception de l'administrateur avec le serveur ---
function syncAdminInboxWithServer() {
    if (!currentUser || currentUser.role !== 'super_admin') return;
    
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(serverMessages => {
                if (!serverMessages || serverMessages.length === 0) return;
                
                const key = `tajirox_support_conversations`;
                let db = JSON.parse(localStorage.getItem(key)) || {};
                
                // Regrouper les messages par boutique avec tolérance aux doublons
                let updated = false;
                serverMessages.forEach(sMsg => {
                    const shopId = sMsg.shopName;
                    if (!db[shopId]) {
                        db[shopId] = [];
                    }
                    const exists = db[shopId].some(lMsg => {
                        if (lMsg.id === sMsg.id) return true;
                        
                        const timeDiff = Math.abs(new Date(lMsg.timestamp) - new Date(sMsg.timestamp));
                        if (lMsg.sender === sMsg.sender && lMsg.text === sMsg.text && timeDiff < 15000) {
                            lMsg.id = sMsg.id;
                            return true;
                        }
                        return false;
                    });
                    if (!exists) {
                        db[shopId].push(sMsg);
                        updated = true;
                    }
                });
                
                if (updated) {
                    // Trier chaque conversation par timestamp
                    Object.keys(db).forEach(shopId => {
                        db[shopId].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    });
                    localStorage.setItem(key, JSON.stringify(db));
                    loadAdminSupportInbox();
                }
            })
            .getSupportMessagesFromServer('all');
    }
}

