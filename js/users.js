        function openUserModal() {
            // التحقق من الصلاحية - فقط المدير يمكنه إضافة مستخدمين
            if (currentUser?.role !== 'admin') {
                showToast(t('only_admin_add_user'), 'error');
                return;
            }

            // التحقق من عدد المستخدمين
            if (allData.users.length >= 2) {
                showToast(t('max_users_error'), 'error');
                return;
            }

            document.getElementById('uName').value = '';
            document.getElementById('uEmail').value = '';
            document.getElementById('uPass').value = '';
            document.getElementById('uRole').value = 'staff';
            document.getElementById('userModalTitle').innerText = t('add_user_title');
            openModal('userModal');
            document.getElementById('uName').focus();
        }

        async function saveUser() {
            if (currentUser?.role !== 'admin') return;
            const rawPass = document.getElementById('uPass').value;
            const u = {
                username: document.getElementById('uName').value,
                email: document.getElementById('uEmail').value,
                password: rawPass ? await hashPassword(rawPass) : '',
                role: document.getElementById('uRole').value,
                id: 'U-' + Date.now()
            };
            const saveBtn = document.getElementById('saveUserBtn');
            if (!u.username || !u.password) return showToast(t('missing_data'), 'error');

            setBtnLoading(saveBtn, true, t('saving'));
            performOptimisticAction('users', u, false, () => { renderUsers(); setBtnLoading(saveBtn, false); }, (runner) => runner.addUser(u, currentDbId));
            setTimeout(() => setBtnLoading(saveBtn, false), 1000);
            closeModal('userModal');
        }

        function renderUsers() {
            const container = document.getElementById('usersList');
            const addUserButtonContainer = document.getElementById('addUserButtonContainer');
            const staffPermissionNotice = document.getElementById('staffPermissionNotice');

            // إعداد زر إضافة مستخدم حسب الصلاحية
            if (currentUser?.role === 'admin') {
                addUserButtonContainer.innerHTML = `
                    <button onclick="openUserModal()" class="bg-indigo-600 text-white px-5 py-2 rounded-xl font-black text-xs shadow-lg">+ ${t('add_user_title')}</button>
                `;
                staffPermissionNotice.classList.add('hidden');
            } else {
                addUserButtonContainer.innerHTML = '';
                staffPermissionNotice.classList.remove('hidden');
            }

            container.innerHTML = '';

            if (allData.users.length === 0) {
                container.innerHTML = `
                    <div class="col-span-3 text-center p-8 bg-white rounded-3xl shadow-sm">
                        <i class="fas fa-users text-3xl text-slate-300 mb-4"></i>
                        <p class="text-slate-400 font-bold">${t('no_data')}</p>
                    </div>
                `;
                return;
            }

            allData.users.forEach(u => {
                const isAdmin = u.role === 'admin';
                const isCurrentUser = currentUser?.id === u.id;

                container.innerHTML += `<div class="bg-white p-4 rounded-3xl shadow-sm flex items-center justify-between border-b-2 ${isAdmin ? 'border-indigo-500' : 'border-blue-500'}">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 ${isAdmin ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'} rounded-xl flex items-center justify-center text-lg">
                            <i class="fas ${isAdmin ? 'fa-user-tie' : 'fa-user'}"></i>
                        </div>
                        <div class="flex-1">
                            <p class="font-black text-slate-800 text-xs">${u.username}</p>
                            ${u.email ? `<p class="text-[8px] text-slate-400 truncate">${u.email}</p>` : ''}
                            <p class="text-[8px] text-slate-400 uppercase font-bold mt-1">${isAdmin ? t('system_admin') : t('staff_role')}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${isCurrentUser ? `<span class="text-[8px] text-slate-300 px-2">${t('you_label')}</span>` : ''}
                        ${currentUser?.id !== u.id && currentUser?.role === 'admin' ? `
                            <button onclick="promptDeleteUser('${u.id}', '${u.username}')" class="text-rose-300 hover:text-rose-600 transition-all" title="${t('remove_user')}">
                                <i class="fas fa-user-minus"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>`;
            });
        }

        function promptDeleteUser(id, name) {
            if (currentUser?.role !== 'admin') return;
            openConfirm({
                title: t('delete_user_title'), msg: t('delete_user_confirm', { name: name }), iconClass: "fas fa-user-times", colorClass: "bg-rose-600",
                onConfirm: () => {
                    performOptimisticAction('users', id, true, renderUsers, (runner) => runner.deleteUser(id, currentDbId));
                }
            });
        }