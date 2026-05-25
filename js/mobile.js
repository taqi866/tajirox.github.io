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
            initMobileSplash();
            initMobileBottomNavScroll();
        });
    } else {
        // DOM is already loaded, initialize immediately
        initMobileSplash();
        initMobileBottomNavScroll();
    }

    // 3. Splash Screen Logic
    function initMobileSplash() {
        const splash = document.getElementById('premiumSplash');
        if (!splash) return;

        if (isMobileDevice()) {
            // Show splash immediately for mobile
            splash.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Lock scrolling during splash

            const progressBar = document.getElementById('splashProgressBar');
            const progressText = document.getElementById('splashProgressText');
            
            let progress = 0;
            const duration = 2200; // 2.2 seconds total animation
            const intervalTime = 40;
            const steps = duration / intervalTime;
            const increment = 100 / steps;

            const timer = setInterval(() => {
                // Add minor random variation to progress increments to make it feel natural
                const randomVariation = (Math.random() - 0.5) * 2;
                progress += increment + randomVariation;

                if (progress >= 100) {
                    progress = 100;
                    clearInterval(timer);
                    progressBar.style.width = '100%';
                    progressText.innerText = '100%';

                    // Smooth fade out and zoom out
                    setTimeout(() => {
                        splash.style.opacity = '0';
                        splash.style.transform = 'scale(1.08)';
                        splash.style.filter = 'blur(10px)';
                        
                        setTimeout(() => {
                            splash.classList.add('hidden');
                            document.body.style.overflow = ''; // Unlock scrolling
                        }, 700);
                    }, 350);
                } else {
                    const roundedProgress = Math.min(100, Math.max(0, Math.round(progress)));
                    progressBar.style.width = `${roundedProgress}%`;
                    progressText.innerText = `${roundedProgress}%`;
                }
            }, intervalTime);
        } else {
            // Keep hidden on desktop
            splash.classList.add('hidden');
        }
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

    // 6. Smooth scroll hide/show for bottom nav bar
    let lastScrollY = window.scrollY;
    function initMobileBottomNavScroll() {
        const bottomNav = document.getElementById('mobileBottomNav');
        if (!bottomNav) return;

        window.addEventListener('scroll', () => {
            if (!isMobileDevice()) return;

            const currentScrollY = window.scrollY;
            
            // Only hide bottom nav if scrolled down significantly (threshold > 40px)
            if (currentScrollY > lastScrollY && currentScrollY > 80) {
                // Scrolling Down -> Hide bottom nav
                bottomNav.classList.add('nav-hidden');
            } else {
                // Scrolling Up -> Show bottom nav
                bottomNav.classList.remove('nav-hidden');
            }
            lastScrollY = currentScrollY;
        }, { passive: true });
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

})();
