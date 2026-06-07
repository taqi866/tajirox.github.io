document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize translation and UI text direction (RTL/LTR)
    if (typeof updateUI === 'function') {
        updateUI();
    }

    // 2. Initialize filter options (year, month, day dropdowns)
    if (typeof initFilterOptions === 'function') {
        initFilterOptions();
    }

    // 3. Check and initialize Biometric authentication button/UI
    if (typeof initBiometricUI === 'function') {
        initBiometricUI();
    }

    // 4. Auto-trigger biometric login if user is enrolled
    if (typeof handleBiometricLogin === 'function') {
        handleBiometricLogin(false);
    }

    // 5. Bind mobile menu button to open sidebar
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn && typeof openSidebarMobile === 'function') {
        mobileMenuBtn.addEventListener('click', openSidebarMobile);
    }
});
