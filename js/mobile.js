/**
 * Tajirox Mobile UX/UI Enhancements
 * Dedicated script to manage Android & iOS specific interactions, splash screen, bottom navigation, and dynamic FAB
 */

(function () {
    'use strict';

    // 1. Device & screen size detection
    const isMobileDevice = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    };

    // 2. Initial Setup
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => {
            initMobileBottomNavScroll();
        });
    } else {
        // DOM is already loaded, initialize immediately
        initMobileBottomNavScroll();
    }

    // 4. Hook into the existing showPage system
    function hookNavigation() {
        if (typeof window.showPage === 'function') {
            const originalShowPage = window.showPage;
            
            window.showPage = function (p) {
                // Call original logic
                originalShowPage(p);
                
                // Trigger mobile nav adjustments
                if (isMobileDevice()) {
                    updateMobileBottomNav(p);
                    applyPageTransition(p);
                }
            };
        }
    }

    // Run hook setup as soon as scripts load (will execute after ui.js loads)
    setTimeout(hookNavigation, 200);

    // 5. Bottom Nav & FAB Update Logic
    function updateMobileBottomNav(activePage) {
        const bottomNav = document.getElementById('mobileBottomNav');
        const fab = document.getElementById('mobileFAB');
        if (!bottomNav) return;

        // Clear all active tabs
        bottomNav.querySelectorAll('.bottom-nav-item').forEach(btn => {
            btn.classList.remove('active-tab');
        });

        // Set active tab
        const tabMap = {
            'dashboard': 'bottomNavDashboard',
            'inventory': 'bottomNavInventory',
            'invoices': 'bottomNavInvoices',
            'expenses': 'bottomNavExpenses'
        };

        const activeBtnId = tabMap[activePage];
        if (activeBtnId) {
            const activeBtn = document.getElementById(activeBtnId);
            if (activeBtn) activeBtn.classList.add('active-tab');
        } else {
            // If active page is clients, treasury, settings, etc., show More as active
            const moreBtn = document.getElementById('bottomNavMore');
            if (moreBtn) moreBtn.classList.add('active-tab');
        }

        // Configure Dynamic FAB
        if (!fab) return;

        if (activePage === 'inventory') {
            fab.classList.remove('hidden');
            fab.innerHTML = '<i class="fas fa-plus animate-pulse"></i>';
            fab.onclick = function () {
                if (typeof openInventoryModal === 'function') {
                    openInventoryModal();
                }
            };
        } else if (activePage === 'invoices') {
            fab.classList.remove('hidden');
            fab.innerHTML = '<i class="fas fa-plus animate-pulse"></i>';
            fab.onclick = function () {
                if (typeof openInvoiceModal === 'function') {
                    openInvoiceModal();
                }
            };
        } else if (activePage === 'expenses') {
            fab.classList.remove('hidden');
            fab.innerHTML = '<i class="fas fa-plus animate-pulse"></i>';
            fab.onclick = function () {
                if (typeof openExpenseModal === 'function') {
                    openExpenseModal();
                }
            };
        } else {
            // Hide FAB for dashboard, settings, treasury, etc.
            fab.classList.add('hidden');
        }
    }

    // 6. Smooth scroll hide/show for bottom nav bar - DISABLED to prevent distraction
    function initMobileBottomNavScroll() {
        // Keep bottom navigation permanently visible for UX stability
    }

    // 7. Premium Page Transition Animations
    function applyPageTransition(pageId) {
        const page = document.getElementById('page-' + pageId);
        if (!page) return;

        // Apply slide-in / fade-in classes
        page.style.opacity = '0';
        page.style.transform = 'translateY(12px)';
        page.style.transition = 'none';

        // Force a reflow to trigger animation
        void page.offsetHeight;

        page.style.transition = 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        page.style.opacity = '1';
        page.style.transform = 'translateY(0)';
    }

    // 8. Mobile landing page side menu (Drawer) and views switcher
    window.openAuthDrawer = function() {
        const drawer = document.getElementById('authMobileDrawer');
        const backdrop = document.getElementById('authDrawerBackdrop');
        if (drawer) drawer.classList.remove('translate-x-full');
        if (backdrop) backdrop.classList.remove('hidden');
    };

    window.closeAuthDrawer = function() {
        const drawer = document.getElementById('authMobileDrawer');
        const backdrop = document.getElementById('authDrawerBackdrop');
        if (drawer) drawer.classList.add('translate-x-full');
        if (backdrop) backdrop.classList.add('hidden');
    };

    window.switchAuthTheme = function(theme) {
        const header = document.getElementById('mobileHeader');
        const menuBtn = document.getElementById('mobileHeaderMenuBtn');
        const langContainer = document.getElementById('mobileHeaderLangContainer');
        const arBtn = document.getElementById('mobileLangAr');
        const frBtn = document.getElementById('mobileLangFr');
        const divider = document.getElementById('mobileHeaderDivider');
        const logo = document.getElementById('mobileHeaderLogo');

        if (!header) return;

        const activeLang = document.documentElement.lang || 'ar';

        if (theme === 'blue') {
            // Theme Blue: transparent background, white text and borders, glassmorphic switcher
            header.className = "lg:hidden fixed top-0 left-0 right-0 py-3.5 px-6 flex justify-between items-center z-50 bg-transparent transition-all duration-300";
            
            if (menuBtn) {
                menuBtn.className = "w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all";
            }
            if (langContainer) {
                langContainer.className = "flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20 shadow-sm transition-all text-white";
            }
            if (divider) {
                divider.className = "text-white/20 text-[10px]";
            }
            if (arBtn && frBtn) {
                if (activeLang === 'ar') {
                    arBtn.className = "text-[10px] font-black text-amber-300 uppercase";
                    frBtn.className = "text-[10px] font-bold text-white/50 uppercase";
                } else {
                    frBtn.className = "text-[10px] font-black text-amber-300 uppercase";
                    arBtn.className = "text-[10px] font-bold text-white/50 uppercase";
                }
            }
        } else {
            // Theme Light: white backdrop with blur, dark text and icons, light borders
            header.className = "lg:hidden fixed top-0 left-0 right-0 bg-slate-50/80 backdrop-blur-md border-b border-slate-200/50 py-3.5 px-6 flex justify-between items-center z-50 transition-all duration-300";
            
            if (menuBtn) {
                menuBtn.className = "w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100/80 flex items-center justify-center text-slate-600 active:scale-95 transition-all";
            }
            if (langContainer) {
                langContainer.className = "flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm transition-all text-slate-400";
            }
            if (divider) {
                divider.className = "text-slate-200 text-[10px]";
            }
            if (arBtn && frBtn) {
                if (activeLang === 'ar') {
                    arBtn.className = "text-[10px] font-black text-blue-600 uppercase";
                    frBtn.className = "text-[10px] font-bold text-slate-400 uppercase";
                } else {
                    frBtn.className = "text-[10px] font-black text-blue-600 uppercase";
                    arBtn.className = "text-[10px] font-bold text-slate-400 uppercase";
                }
            }
        }
    };

    window.switchAuthView = function(viewName) {
        // Close the drawer
        window.closeAuthDrawer();

        const heroSection = document.getElementById('authHeroSection');
        const loginContainer = document.getElementById('loginFormContainer');

        if (viewName === 'welcome') {
            // Switch header to blue theme
            window.switchAuthTheme('blue');

            // Show welcome view (the blue hero section) and hide the login container
            if (heroSection) {
                heroSection.classList.remove('hidden');
                heroSection.classList.add('flex');
            }
            if (loginContainer) {
                loginContainer.classList.add('hidden');
                loginContainer.classList.remove('flex');
            }
        } else {
            // Switch header to light theme
            window.switchAuthTheme('light');

            // Hide welcome view and show the login container (which contains the selected view)
            if (heroSection) {
                heroSection.classList.add('hidden');
                heroSection.classList.remove('flex');
            }
            if (loginContainer) {
                loginContainer.classList.remove('hidden');
                loginContainer.classList.add('flex');
            }

            // Hide all sub-views in mobile card
            document.querySelectorAll('.auth-mobile-view').forEach(view => {
                view.classList.add('hidden');
            });

            // Show the selected view inside mobile card
            const targetViewMap = {
                'login': 'authViewLogin',
                'features': 'authViewFeatures',
                'pricing': 'authViewPricing'
            };
            const targetId = targetViewMap[viewName];
            if (targetId) {
                const targetView = document.getElementById(targetId);
                if (targetView) targetView.classList.remove('hidden');
            }
        }

        // Style the active link inside the drawer
        document.querySelectorAll('.auth-drawer-link').forEach(link => {
            link.classList.remove('text-blue-600', 'bg-blue-50/50', 'font-black');
            link.classList.add('text-slate-600', 'font-bold');
        });

        const activeLinkIdMap = {
            'welcome': 'btnAuthLinkWelcome',
            'login': 'btnAuthLinkLogin',
            'features': 'btnAuthLinkFeatures',
            'pricing': 'btnAuthLinkPricing'
        };
        const activeLinkId = activeLinkIdMap[viewName];
        if (activeLinkId) {
            const activeLink = document.getElementById(activeLinkId);
            if (activeLink) {
                activeLink.classList.remove('text-slate-600', 'font-bold');
                activeLink.classList.add('text-blue-600', 'bg-blue-50/50', 'font-black');
            }
        }
    };

})();
