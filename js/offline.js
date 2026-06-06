// ==========================================
// TAJIROX - BROWSER OFFLINE DATABASE MANAGER
// Powered by Dexie.js (IndexedDB Wrapper)
// ==========================================

// 1. تهيئة قاعدة البيانات المحلية
const localDb = new Dexie("TajiroxLocalDB");

// تعريف الجداول
localDb.version(1).stores({
    shopCache: "dbId, updatedAt" // dbId هو المفتاح الأساسي لتخزين كاش كل متجر على حدة
});

/**
 * حفظ كاش المتجر بالكامل محلياً
 * @param {string} dbId - معرف قاعدة بيانات المتجر
 * @param {object} allData - كائن البيانات الكامل (المخزون، الفواتير، المصاريف...)
 * @param {object} currentUser - كائن المستخدم الحالي
 */
async function saveLocalCache(dbId, allData, currentUser) {
    if (!dbId) return;
    try {
        await localDb.shopCache.put({
            dbId: dbId.toString().trim(),
            allData: JSON.parse(JSON.stringify(allData)), // استنساخ عميق لمنع المراجع النشطة
            currentUser: currentUser ? JSON.parse(JSON.stringify(currentUser)) : null,
            updatedAt: new Date().toISOString()
        });
        console.log(`💾 [Dexie.js] تم حفظ الكاش المحلي بنجاح للمتجر: ${dbId}`);
    } catch (e) {
        console.error("❌ [Dexie.js] خطأ أثناء حفظ الكاش المحلي:", e);
    }
}

/**
 * جلب كاش المتجر المخزن محلياً
 * @param {string} dbId - معرف قاعدة بيانات المتجر
 * @returns {promise<object|null>} كائن الكاش المخزن أو null في حال عدم وجوده
 */
async function getLocalCache(dbId) {
    if (!dbId) return null;
    try {
        const cache = await localDb.shopCache.get(dbId.toString().trim());
        if (cache) {
            console.log(`📖 [Dexie.js] تم استخراج الكاش المحلي للمتجر: ${dbId} (آخر تحديث: ${cache.updatedAt})`);
            return cache;
        }
        return null;
    } catch (e) {
        console.error("❌ [Dexie.js] خطأ أثناء جلب الكاش المحلي:", e);
        return null;
    }
}

/**
 * مسح كاش متجر محدد (عند تسجيل الخروج لدواعي الأمان والخصوصية)
 * @param {string} dbId - معرف قاعدة بيانات المتجر
 */
async function clearLocalCache(dbId) {
    if (!dbId) return;
    try {
        await localDb.shopCache.delete(dbId.toString().trim());
        console.log(`🧹 [Dexie.js] تم مسح الكاش المحلي بأمان للمتجر: ${dbId}`);
    } catch (e) {
        console.error("❌ [Dexie.js] خطأ أثناء مسح الكاش المحلي:", e);
    }
}

/**
 * مسح كافة قواعد البيانات المحلية والكاش تماماً
 */
async function clearAllLocalCaches() {
    try {
        await localDb.shopCache.clear();
        console.log("🧹 [Dexie.js] تم مسح جميع الكاشات المحلية لكافة المتاجر بنجاح");
    } catch (e) {
        console.error("❌ [Dexie.js] خطأ أثناء مسح كافة الكاشات:", e);
    }
}
