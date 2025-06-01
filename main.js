 // Tách API cho từng mục đích
        const SHEETDB_API_USERS = "https://sheetdb.io/api/v1/2d6esuz0nyjax"; // Đăng ký, đăng nhập, quản lý user
        const SHEETDB_API_REQUESTS = "https://sheetdb.io/api/v1/wa0gp6y6p66el"; // Nạp/rút tiền
        const SHEETDB_API_CURRENT_GAME_BETS = "https://sheetdb.io/api/v1/hdoz8xdgtb14y"; // API cho cược hiện tại của game
        const ADMIN_USERNAMES = ["admin"];

        // ===== HASH UTILITY =====
        function hashString(str) {
            let hash = 0;
            if (str.length === 0) return hash;
            for (let i = 0; i < str.length; i++) {
                const chr = str.charCodeAt(i);
                hash = (hash << 5) - hash + chr;
                hash |= 0; // Convert to 32bit integer
            }
            return hash.toString();
        }

        // ====== CAPTCHA ======
        function generateCaptcha(prefix = '') {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let captcha = '';
            for (let i = 0; i < 5; i++) {
                captcha += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            const display = document.getElementById(prefix + 'captchaDisplay');
            if (display) display.textContent = captcha;
        }
        generateCaptcha(); // Initial captcha generation for login form

        // --- Event Listeners for form switching and logout ---
        document.getElementById('showRegisterLink').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById("loginForm").style.display = "none";
            document.getElementById("registerForm").style.display = "block";
            generateCaptcha('reg_');
        });

        document.getElementById('showLoginLink').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById("loginForm").style.display = "block";
            document.getElementById("registerForm").style.display = "none";
            generateCaptcha();
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('current_user');
            localStorage.removeItem('is_admin');
            document.getElementById("mainContent").style.display = "none";
            document.getElementById("loginForm").style.display = "block";
            // Optionally clear input fields on logout for security
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            document.getElementById('captcha').value = '';
            // Stop game intervals on logout
            if (tx_interval) clearInterval(tx_interval);
            if (tx_settleTimeout) clearTimeout(tx_settleTimeout);
            if (betSyncInterval) clearInterval(betSyncInterval);
        });

        // ======= REGISTER =======
        document.getElementById('registerBtn').addEventListener('click', async () => {
            const username = document.getElementById('reg_username').value.trim();
            const password = document.getElementById('reg_password').value;
            const password2 = document.getElementById('reg_password2').value;
            const captcha = document.getElementById('reg_captcha').value?.trim().toUpperCase();
            const captchaCode = document.getElementById('reg_captchaDisplay').textContent?.trim().toUpperCase();

            if (!username || !password || !password2 || !captcha) {
                showCustomAlert('Vui lòng nhập tên đăng nhập, mật khẩu, mã captcha!');
                return;
            }
            if (password !== password2) {
                showCustomAlert('Mật khẩu nhập lại chưa khớp!');
                return;
            }
            if (captcha !== captchaCode) {
                showCustomAlert('Mã captcha chưa đúng!');
                generateCaptcha('reg_');
                return;
            }

            // Kiểm tra trùng tài khoản
            try {
                const check = await fetch(`${SHEETDB_API_USERS}/search?username=${encodeURIComponent(username)}`);
                const users = await check.json();
                if (users && users.length > 0) {
                    showCustomAlert('Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác!');
                    return;
                }
            } catch (e) {
                console.error("Error checking username:", e);
                showCustomAlert('Lỗi kiểm tra tài khoản, thử lại sau!');
                return;
            }

            // Lấy IP
            let ip = "";
            try {
                const ipres = await fetch("https://api.ipify.org?format=json");
                const ipjson = await ipres.json();
                ip = ipjson.ip || "";
            } catch (e) {
                console.error("Error fetching IP:", e);
                ip = ""; // Default to empty string if IP fetch fails
            }

            try {
                const formData = new FormData();
                formData.append('data[username]', username);
                formData.append('data[passwordHash]', hashString(password));
                formData.append('data[balance]', 10000); // Initial balance
                formData.append('data[ip]', ip);

                const response = await fetch(SHEETDB_API_USERS, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    showCustomAlert('Đăng ký thành công, bạn có thể đăng nhập ngay!');
                    document.getElementById("loginForm").style.display = "block";
                    document.getElementById("registerForm").style.display = "none";
                    generateCaptcha();
                    // Clear registration fields
                    document.getElementById('reg_username').value = '';
                    document.getElementById('reg_password').value = '';
                    document.getElementById('reg_password2').value = '';
                    document.getElementById('reg_captcha').value = '';
                } else {
                    showCustomAlert('Lỗi đăng ký, thử lại sau!');
                }
            } catch (e) {
                console.error("Error during registration:", e);
                showCustomAlert('Lỗi kết nối, thử lại sau!');
            }
        });

        // ======= LOGIN =======
        document.getElementById('loginBtn').addEventListener('click', async () => {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const captcha = document.getElementById('captcha').value?.trim().toUpperCase();
            const captchaCode = document.getElementById('captchaDisplay').textContent?.trim().toUpperCase();

            if (!username || !password || !captcha) {
                showCustomAlert('Vui lòng điền đầy đủ thông tin đăng nhập!');
                return;
            }
            if (captcha !== captchaCode) {
                showCustomAlert('Mã captcha chưa đúng!');
                generateCaptcha();
                return;
            }

            try {
                const res = await fetch(`${SHEETDB_API_USERS}/search?username=${encodeURIComponent(username)}`);
                const users = await res.json();

                if (!users || users.length === 0) {
                    showCustomAlert('Tài khoản không tồn tại!');
                    return;
                }

                const user = users[0];
                if (user.passwordHash !== hashString(password)) {
                    showCustomAlert('Mật khẩu không đúng!');
                    return;
                }

                localStorage.setItem('current_user', username);
                localStorage.setItem('is_admin', ADMIN_USERNAMES.includes(username) ? '1' : '');

                document.getElementById('loginForm').style.display = 'none';
                document.getElementById('mainContent').style.display = 'block';

                await loadUserInfo(username); // Wait for user info to load before starting game
                if (ADMIN_USERNAMES.includes(username)) {
                    showAdminPanel();
                }
                startGame(); // Start the game only after successful login and info load
                // Clear login fields
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';
                document.getElementById('captcha').value = '';
            } catch (e) {
                console.error("Error during login:", e);
                showCustomAlert('Lỗi đăng nhập, thử lại sau!');
            }
        });

        // ===== USER INFO =====
        async function loadUserInfo(username) {
            try {
                const res = await fetch(`${SHEETDB_API_USERS}/search?username=${encodeURIComponent(username)}`);
                const users = await res.json();
                const user = users[0];
                document.getElementById('userBalance').textContent = parseInt(user.balance || 0).toLocaleString(); // Format balance
                document.getElementById('userNameDisplay').textContent = user.username;
                if (ADMIN_USERNAMES.includes(user.username)) {
                    document.getElementById('adminPanel').style.display = 'block';
                } else {
                    document.getElementById('adminPanel').style.display = 'none';
                }
            } catch (e) {
                console.error("Error loading user info:", e);
            }
        }

        // ===== ADMIN PANEL: Quản lý user và duyệt yêu cầu =====
        async function showAdminPanel() {
            document.getElementById('adminPanel').style.display = "block";
            // Danh sách user:
            try {
                const res = await fetch(SHEETDB_API_USERS);
                const users = await res.json();
                const list = document.getElementById('adminUserList');
                list.innerHTML = ''; // Clear previous list
                if (Array.isArray(users)) {
                    users.forEach(u => {
                        const li = document.createElement('li');
                        li.innerHTML = `
                            <b>${u.username}</b>
                            | Số dư: <b>${parseInt(u.balance || 0).toLocaleString()}</b>
                            | IP: <span style="color:blue">${u.ip || ""}</span>
                            <button onclick="deleteUser('${u.username}')">Xóa</button>
                        `;
                        list.appendChild(li);
                    });
                } else {
                    list.innerHTML = '<li>Không có người dùng nào.</li>';
                }
            } catch (e) {
                console.error("Error fetching user list for admin:", e);
                showCustomAlert('Lỗi tải danh sách người dùng.');
            }

            // Lấy danh sách yêu cầu nạp/rút
            let reqs = [];
            try {
                const reqres = await fetch(`${SHEETDB_API_REQUESTS}?sheet=requests`);
                reqs = await reqres.json();
            } catch (e) {
                console.error("Error fetching requests for admin:", e);
            }
            const reqList = document.getElementById('adminRequests');
            reqList.innerHTML = ''; // Clear previous list
            if (Array.isArray(reqs)) {
                reqs.filter(r => r.status === 'pending').forEach(r => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        ${r.username} - ${r.type === 'deposit' ? 'Nạp' : 'Rút'}: ${parseInt(r.amount).toLocaleString()}
                        <button onclick="approveRequest('${r.id}', '${r.username}', '${r.type}', ${r.amount})">Xác nhận</button>
                        <button onclick="rejectRequest('${r.id}')">Từ chối</button>
                    `;
                    reqList.appendChild(li);
                });
                if (reqList.innerHTML === '') {
                    reqList.innerHTML = '<li>Không có yêu cầu chờ xử lý.</li>';
                }
            } else {
                reqList.innerHTML = '<li>Lỗi tải yêu cầu.</li>';
            }
        }

        // Xóa user (admin)
        window.deleteUser = async function(username) {
            const confirmDelete = await showCustomConfirm(`Bạn chắc chắn muốn xóa user "${username}"?`);
            if (!confirmDelete) return;

            try {
                const res = await fetch(`${SHEETDB_API_USERS}/search?username=${encodeURIComponent(username)}`);
                const users = await res.json();
                if (!Array.isArray(users) || users.length === 0 || !users[0].id) {
                    showCustomAlert('Không tìm thấy user để xóa!');
                    return;
                }
                const id = users[0].id;
                const deleteRes = await fetch(`${SHEETDB_API_USERS}/id/${id}`, { method: 'DELETE' });
                if (deleteRes.ok) {
                    showCustomAlert('Đã xóa user');
                    showAdminPanel();
                } else {
                    showCustomAlert('Lỗi xóa user, thử lại sau!');
                }
            } catch (e) {
                console.error("Error deleting user:", e);
                showCustomAlert('Lỗi kết nối khi xóa user, thử lại sau!');
            }
        };

        // Custom Alert/Confirm Modals (instead of alert/confirm)
        function showCustomAlert(message) {
            const overlay = document.createElement('div');
            overlay.style = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7);
                display: flex; justify-content: center; align-items: center; z-index: 10000;
            `;
            const modal = document.createElement('div');
            modal.style = `
                background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.3);
                text-align: center; max-width: 300px; width: 90%;
            `;
            modal.innerHTML = `
                <p>${message}</p>
                <button style="background:#3498db; color:#fff; padding: 8px 15px; border-radius: 5px; border: none; cursor: pointer; margin-top: 15px;">OK</button>
            `;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            modal.querySelector('button').addEventListener('click', () => {
                overlay.remove();
            });
        }

        function showCustomConfirm(message) {
            return new Promise((resolve) => {
                const overlay = document.createElement('div');
                overlay.style = `
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7);
                    display: flex; justify-content: center; align-items: center; z-index: 10000;
                `;
                const modal = document.createElement('div');
                modal.style = `
                    background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.3);
                    text-align: center; max-width: 300px; width: 90%;
                `;
                modal.innerHTML = `
                    <p>${message}</p>
                    <button class="confirm-yes" style="background:#28a745; color:#fff; padding: 8px 15px; border-radius: 5px; border: none; cursor: pointer; margin-top: 15px; margin-right: 10px;">Có</button>
                    <button class="confirm-no" style="background:#e74c3c; color:#fff; padding: 8px 15px; border-radius: 5px; border: none; cursor: pointer; margin-top: 15px;">Không</button>
                `;
                overlay.appendChild(modal);
                document.body.appendChild(overlay);

                modal.querySelector('.confirm-yes').addEventListener('click', () => {
                    overlay.remove();
                    resolve(true);
                });
                modal.querySelector('.confirm-no').addEventListener('click', () => {
                    overlay.remove();
                    resolve(false);
                });
            });
        }


        // ====== ADMIN DUYỆT HOẶC TỪ CHỐI: PATCH + DELETE ======
        window.approveRequest = async function(id, username, type, amount) {
            try {
                const userRes = await fetch(`${SHEETDB_API_USERS}/search?username=${encodeURIComponent(username)}`);
                const users = await userRes.json();
                if (!Array.isArray(users) || users.length === 0) {
                    showCustomAlert('Không tìm thấy người dùng để cập nhật số dư!');
                    return;
                }
                const user = users[0];
                let newBalance = parseInt(user.balance || 0);

                if (type === 'deposit') newBalance += parseInt(amount);
                if (type === 'withdraw') newBalance -= parseInt(amount);

                // Update user balance
                await fetch(`${SHEETDB_API_USERS}/username/${encodeURIComponent(username)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ balance: newBalance })
                });

                // Update request status (optional, if you want to keep a record of approved requests)
                // If you want to delete the request directly after approval, you can skip this PATCH step.
                // For now, let's just delete it to clear the admin panel
                let deleted = false;
                for (let i = 0; i < 3; i++) { // Retry a few times in case of SheetDB latency
                    const del = await fetch(`${SHEETDB_API_REQUESTS}/id/${id}?sheet=requests`, {
                        method: 'DELETE'
                    });
                    if (del.ok) {
                        deleted = true;
                        break;
                    }
                    await new Promise(r => setTimeout(r, 400));
                }

                if (deleted) {
                    showCustomAlert('Đã xác nhận và xóa yêu cầu!');
                } else {
                    showCustomAlert('LỖI: Không xóa được yêu cầu khỏi SheetDB! Vui lòng xóa thủ công.');
                }
                showAdminPanel(); // Refresh admin panel
                if (localStorage.getItem('current_user') === username) { // Only update current user balance if it's the logged-in user
                    loadUserInfo(localStorage.getItem('current_user'));
                }
            } catch (e) {
                console.error("Error approving request:", e);
                showCustomAlert('Lỗi xác nhận yêu cầu, thử lại sau!');
            }
        };

        window.rejectRequest = async function(id) {
            try {
                // Update request status to rejected (optional, if you want to keep a record)
                // For now, let's just delete it
                let deleted = false;
                for (let i = 0; i < 3; i++) { // Retry a few times
                    const del = await fetch(`${SHEETDB_API_REQUESTS}/id/${id}?sheet=requests`, {
                        method: 'DELETE'
                    });
                    if (del.ok) {
                        deleted = true;
                        break;
                    }
                    await new Promise(r => setTimeout(r, 400));
                }

                if (deleted) {
                    showCustomAlert('Đã từ chối và xóa yêu cầu!');
                } else {
                    showCustomAlert('LỖI: Không xóa được yêu cầu khỏi SheetDB! Vui lòng xóa thủ công.');
                }
                showAdminPanel(); // Refresh admin panel
            } catch (e) {
                console.error("Error rejecting request:", e);
                showCustomAlert('Lỗi từ chối yêu cầu, thử lại sau!');
            }
        };

        function generateDepositCode(username, amount) {
            return (
                username +
                "-" +
                Date.now().toString().slice(-6) +
                "-" +
                (Math.floor(1000 + Math.random() * 9000)) +
                "-" +
                amount
            );
        }

        function showDepositInfo(amount) {
            const username = localStorage.getItem('current_user');
            const code = generateDepositCode(username, amount);
            const adminBankInfo = {
                bank: "MB Bank",
                account_number: "1234567890",
                account_name: "NGUYEN VAN ADMIN"
            };

            const overlayHtml = `
                <div class="deposit-guide-overlay" style="position:fixed;left:0;top:0;right:0;bottom:0;background:#0008;z-index:9999;display:flex;align-items:center;justify-content:center;">
                    <div style="background:#fff;color:#222;max-width:350px;border-radius:14px;padding:24px 20px;box-shadow:0 4px 22px #000a;position:relative;">
                        <h3 style="color:#e74c3c;text-align:center;">Hướng dẫn nạp tiền</h3>
                        <div><b>Ngân hàng nhận:</b> <span style="color:#1976d2">${adminBankInfo.bank}</span></div>
                        <div><b>Số tài khoản:</b> <span style="color:#1976d2">${adminBankInfo.account_number}</span></div>
                        <div><b>Chủ tài khoản:</b> <span style="color:#1976d2">${adminBankInfo.account_name}</span></div>
                        <div style="margin:10px 0 8px 0"><b>Số tiền cần chuyển:</b> <span style="color:#e67e22">${amount.toLocaleString()}</span> VNĐ</div>
                        <div style="margin-bottom:8px;"><b>Nội dung chuyển khoản:</b> <span style="color:#d32f2f;font-weight:bold;" id="depositCode">${code}</span></div>
                        <div style="font-size:0.98em;color:#555;margin-bottom:8px;">*Vui lòng chuyển khoản đúng nội dung để được cộng tiền tự động.</div>
                        <button id="closeDepositGuideBtn" style="margin-top:10px;padding:7px 18px;border-radius:5px;font-weight:bold;background:#e74c3c;color:#fff;border:none;float:right;">Đóng</button>
                        <button id="confirmDepositBtn" style="margin-top:10px;padding:7px 18px;border-radius:5px;font-weight:bold;background:#3498db;color:#fff;border:none;float:left;">Tôi đã chuyển</button>
                        <div style="clear:both"></div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', overlayHtml);

            document.getElementById('closeDepositGuideBtn').addEventListener('click', () => {
                document.querySelector('.deposit-guide-overlay').remove();
            });

            document.getElementById('confirmDepositBtn').addEventListener('click', async () => {
                const data = {
                    username: username,
                    type: 'deposit',
                    amount: amount,
                    status: 'pending',
                    bank_code: code
                };
                try {
                    const response = await fetch(`${SHEETDB_API_REQUESTS}?sheet=requests`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data })
                    });
                    if (response.ok) {
                        showCustomAlert('Đã gửi yêu cầu nạp tiền đến admin. Chờ xác nhận!');
                        document.querySelector('.deposit-guide-overlay').remove();
                    } else {
                        showCustomAlert('Lỗi gửi yêu cầu. Thử lại sau!');
                    }
                } catch (e) {
                    console.error("Error sending deposit request:", e);
                    showCustomAlert('Lỗi kết nối khi gửi yêu cầu. Thử lại sau!');
                }
            });
        }

        document.getElementById('depositBtn').addEventListener('click', () => {
            const amountInput = document.getElementById('depositAmount');
            const amount = parseInt(amountInput.value);
            if (isNaN(amount) || amount <= 0) {
                showCustomAlert("Nhập số tiền nạp hợp lệ!");
                return;
            }
            showDepositInfo(amount);
            amountInput.value = ''; // Clear input after showing info
        });

        document.getElementById('withdrawBtn').addEventListener('click', async () => {
            const amountInput = document.getElementById('withdrawAmount');
            const amount = parseInt(amountInput.value);
            if (isNaN(amount) || amount <= 0) {
                showCustomAlert("Nhập số tiền rút hợp lệ!");
                return;
            }
            const username = localStorage.getItem('current_user');
            // Fetch current user's balance to check if withdrawal is possible
            try {
                const userRes = await fetch(`${SHEETDB_API_USERS}/search?username=${encodeURIComponent(username)}`);
                const users = await userRes.json();
                if (!Array.isArray(users) || users.length === 0) {
                    showCustomAlert('Lỗi: Không tìm thấy thông tin người dùng.');
                    return;
                }
                const user = users[0];
                const currentBalance = parseInt(user.balance || 0);

                if (amount > currentBalance) {
                    showCustomAlert('Số dư của bạn không đủ để rút số tiền này!');
                    return;
                }

                const data = {
                    username: username,
                    type: 'withdraw',
                    amount: amount,
                    status: 'pending',
                    bank_code: ""
                };
                const response = await fetch(`${SHEETDB_API_REQUESTS}?sheet=requests`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data })
                });
                if (response.ok) {
                    showCustomAlert('Đã gửi yêu cầu rút tiền đến admin. Chờ xác nhận!');
                    amountInput.value = ''; // Clear input
                } else {
                    showCustomAlert('Lỗi gửi yêu cầu. Thử lại sau!');
                }
            } catch (e) {
                console.error("Error sending withdraw request:", e);
                showCustomAlert('Lỗi kết nối khi gửi yêu cầu. Thử lại sau!');
            }
        });

        const quickBetList = [
            { label: "1k", value: 1000 },
            { label: "10k", value: 10000 },
            { label: "100k", value: 100000 },
            { label: "500k", value: 500000 },
            { label: "5m", value: 5000000 },
            { label: "10m", value: 10000000 },
            { label: "50m", value: 50000000 },
        ];

        function renderQuickBetButtons() {
            const group = document.getElementById('quickBetGroup');
            group.innerHTML = ""; // Clear previous buttons
            quickBetList.forEach(item => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'quick-bet-btn';
                btn.textContent = item.label;
                btn.addEventListener('click', () => {
                    document.getElementById('betAmount').value = item.value;
                    document.querySelectorAll('.quick-bet-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                });
                group.appendChild(btn);
            });
        }
        // renderQuickBetButtons(); // This will be called by startGame or DOMContentLoaded

        let tx_timer = 30;
        let tx_interval = null;
        let tx_locked = false;
        let tx_settleTimeout = null;
        let betSyncInterval = null;

        let userBet = { side: null, amount: 0 }; // Store user's specific bet for the current round
        const tx_stats = []; // Game history stats
        const MAX_STATS = 20;

        // Function to fetch and update total bets from SheetDB
        async function updateCurrentBets() {
            try {
                if (SHEETDB_API_CURRENT_GAME_BETS === "https://sheetdb.io/api/v1/your_current_game_bets_api") {
                    console.warn("SHEETDB_API_CURRENT_GAME_BETS is not configured. Cannot fetch current bets.");
                    return;
                }
                const response = await fetch(`${SHEETDB_API_CURRENT_GAME_BETS}?sheet=bets`);
                const data = await response.json();
                let totalTai = 0;
                let totalXiu = 0;

                if (data && Array.isArray(data)) {
                    data.forEach(bet => {
                        const amount = parseInt(bet.amount);
                        if (!isNaN(amount)) {
                            if (bet.type === 'tai') {
                                totalTai += amount;
                            } else if (bet.type === 'xiu') {
                                totalXiu += amount;
                            }
                        }
                    });
                }
                document.getElementById('tx-total-tai').textContent = totalTai.toLocaleString();
                document.getElementById('tx-total-xiu').textContent = totalXiu.toLocaleString();
            } catch (e) {
                console.error("Error fetching current bets:", e);
            }
        }

        // Updates the visual display of game history circles
        function updateStatView(blinkSide = null) {
            const box = document.getElementById('tx-stat-list');
            if (!box) return; // Safeguard if element not found

            box.innerHTML = tx_stats.slice(-MAX_STATS).reverse().map(st =>
                `<span class="tx-circle ${st.result} ${blinkSide && blinkSide === st.result ? 'blink' : ''}">
                    ${st.result === 'tai' ? 'T' : 'X'}
                </span>`
            ).join('');
        }

        // Locks betting inputs
        function lockBettingTX() {
            tx_locked = true;
            document.getElementById('placeBetBtn').disabled = true;
            document.getElementById('betTai').disabled = true;
            document.getElementById('betXiu').disabled = true;
            document.getElementById('betAmount').disabled = true;
            document.querySelectorAll('.quick-bet-btn').forEach(b => b.disabled = true);
        }

        // Unlocks betting inputs
        function unlockBettingTX() {
            tx_locked = false;
            document.getElementById('placeBetBtn').disabled = false;
            // Re-enable/disable Tai/Xiu based on user's current bet choice (if any)
            if (userBet.side === 'tai') {
                document.getElementById('betTai').disabled = false;
                document.getElementById('betXiu').disabled = true;
                document.getElementById('betTai').classList.add('selected'); // Keep selected visual
                document.getElementById('betXiu').classList.remove('selected');
            } else if (userBet.side === 'xiu') {
                document.getElementById('betTai').disabled = true;
                document.getElementById('betXiu').disabled = false;
                document.getElementById('betXiu').classList.add('selected'); // Keep selected visual
                document.getElementById('betTai').classList.remove('selected');
            } else { // No bet placed yet, both sides are enabled
                document.getElementById('betTai').disabled = false;
                document.getElementById('betXiu').disabled = false;
                document.getElementById('betTai').classList.remove('selected');
                document.getElementById('betXiu').classList.remove('selected');
            }
            document.getElementById('betAmount').disabled = false;
            document.querySelectorAll('.quick-bet-btn').forEach(b => b.disabled = false);
        }

        // Resets client-side state and clears bets in SheetDB for the new round
        async function resetTXBets() {
            userBet = { side: null, amount: 0 }; // Reset user's personal bet for the new round
            setTXTotals(0, 0); // Reset client-side display to 0, actual totals are fetched from server
            document.getElementById('betTai').classList.remove('selected');
            document.getElementById('betXiu').classList.remove('selected');
            document.getElementById('betTai').disabled = false;
            document.getElementById('betXiu').disabled = false;
            document.querySelectorAll('.quick-bet-btn').forEach(b => b.classList.remove('selected'));

            // Clear all current bets in SheetDB for a new round
            try {
                if (SHEETDB_API_CURRENT_GAME_BETS !== "https://sheetdb.io/api/v1/your_current_game_bets_api") {
                    await fetch(`${SHEETDB_API_CURRENT_GAME_BETS}/all?sheet=bets`, { method: 'DELETE' });
                } else {
                    console.warn("SHEETDB_API_CURRENT_GAME_BETS is not configured. Cannot clear current bets in SheetDB.");
                }
            } catch (e) {
                console.error("Error clearing current game bets in SheetDB:", e);
            }
            updateCurrentBets(); // Re-fetch to ensure it's empty or updated
        }

        // Sets the displayed total amounts for Tai and Xiu
        function setTXTotals(taiAmount, xiuAmount) {
            document.getElementById('tx-total-tai').textContent = taiAmount.toLocaleString();
            document.getElementById('tx-total-xiu').textContent = xiuAmount.toLocaleString();
        }

        // Starts a new round of the Tai Xiu game
        async function startTXRound() {
            // Clear previous round's state
            if (tx_interval) clearInterval(tx_interval);
            if (tx_settleTimeout) clearTimeout(tx_settleTimeout);
            if (betSyncInterval) clearInterval(betSyncInterval);

            await resetTXBets(); // Clear bets and reset UI before starting a new round
            unlockBettingTX(); // Enable betting
            tx_timer = 30; // Reset timer
            document.getElementById('tx-timer-label').textContent = "Thời gian cược:";
            document.getElementById('countdown').textContent = tx_timer;

            // Reset dice display
            document.getElementById('dice1').textContent = '?';
            document.getElementById('dice2').textContent = '?';
            document.getElementById('dice3').textContent = '?';

            // Reset result box colors to default and remove blink
            const taiResultBox = document.querySelector('.result-box.tai');
            const xiuResultBox = document.querySelector('.result-box.xiu');
            if(taiResultBox) {
                taiResultBox.classList.remove('blink');
                taiResultBox.style.animation = '';
                taiResultBox.style.backgroundColor = '#d4edda';
                taiResultBox.style.color = '#155724';
            }
            if(xiuResultBox) {
                xiuResultBox.classList.remove('blink');
                xiuResultBox.style.animation = '';
                xiuResultBox.style.backgroundColor = '#f8d7da';
                xiuResultBox.style.color = '#721c24';
            }
            
            updateStatView(); // Ensure history view is clean

            // Start polling for bet updates from other users
            betSyncInterval = setInterval(updateCurrentBets, 1500); // Poll every 1.5 seconds

            tx_interval = setInterval(() => {
                tx_timer--;
                document.getElementById('countdown').textContent = tx_timer;
                if (tx_timer === 5) {
                    lockBettingTX(); // Lock betting with 5 seconds remaining
                    document.getElementById('tx-timer-label').textContent = "Khóa cược sau:";
                    if (betSyncInterval) clearInterval(betSyncInterval); // Stop polling when betting is locked
                }
                if (tx_timer <= 0) {
                    clearInterval(tx_interval);
                    rollTXDice(); // Time's up, roll the dice
                }
            }, 1000);
        }

        // Rolls the dice and displays animation
        function rollTXDice() {
            let dice = [0, 0, 0].map(() => Math.floor(Math.random() * 6) + 1);
            let rolls = 0;
            const diceBoxes = [
                document.getElementById('dice1'),
                document.getElementById('dice2'),
                document.getElementById('dice3')
            ];
            const rollAnim = setInterval(() => {
                diceBoxes.forEach(die => die.textContent = Math.floor(Math.random() * 6) + 1);
                rolls++;
                if (rolls > 15) { // Increased rolls for slightly longer animation
                    clearInterval(rollAnim);
                    // Use the pre-calculated dice values for the final display
                    diceBoxes.forEach((die, idx) => die.textContent = dice[idx]);
                    setTimeout(() => finishTXRound(dice), 700); // Small delay before finishing
                }
            }, 70);
        }

        // Processes the round results, updates balances, and logs history
        async function finishTXRound(dice) {
            const sum = dice.reduce((a, b) => a + b, 0);
            const result = sum > 10 ? 'tai' : 'xiu';

            const currentTotalTai = parseInt(document.getElementById('tx-total-tai').textContent.replace(/,/g, '') || 0);
            const currentTotalXiu = parseInt(document.getElementById('tx-total-xiu').textContent.replace(/,/g, '') || 0);

            tx_stats.push({ tai: currentTotalTai, xiu: currentTotalXiu, result: result });
            updateStatView(result); // Update history display with blinking

            // Reset previous blink and colors of result boxes
            const taiResultBox = document.querySelector('.result-box.tai');
            const xiuResultBox = document.querySelector('.result-box.xiu');
            
            if(taiResultBox) {
                taiResultBox.classList.remove('blink');
                taiResultBox.style.animation = '';
                taiResultBox.style.backgroundColor = '#d4edda';
                taiResultBox.style.color = '#155724';
            }
            if(xiuResultBox) {
                xiuResultBox.classList.remove('blink');
                xiuResultBox.style.animation = '';
                xiuResultBox.style.backgroundColor = '#f8d7da';
                xiuResultBox.style.color = '#721c24';
            }

            // Apply new colors and blink based on result ("White Xỉu, Black Tài")
            const blinkEl = document.querySelector(`.result-box.${result}`);
            if (blinkEl) {
                blinkEl.classList.add('blink');
                blinkEl.style.animation = "blink-tx 0.35s linear alternate infinite";
                if (result === 'tai') {
                    blinkEl.style.backgroundColor = '#111'; // Black for Tài
                    blinkEl.style.color = '#ffd600'; // Yellow text for Tài
                } else { // xiu
                    blinkEl.style.backgroundColor = '#fff'; // White for Xỉu
                    blinkEl.style.color = '#222'; // Dark text for Xỉu
                }
            }


            const username = localStorage.getItem('current_user');
            const betSide = userBet.side;
            const betAmount = userBet.amount;

            if (betSide && betAmount && username) { // Only process if user placed a bet
                try {
                    const res = await fetch(`${SHEETDB_API_USERS}/search?username=${encodeURIComponent(username)}`);
                    const users = await res.json();
                    if (!Array.isArray(users) || users.length === 0) {
                        console.error("User not found for balance update after game round.");
                        showCustomAlert("Lỗi: Không tìm thấy thông tin người dùng để cập nhật số dư.");
                        return;
                    }
                    const user = users[0];
                    let balance = parseInt(user.balance || 0);

                    if (betSide === result) {
                        balance += (betAmount * 2); // Double the bet amount if win
                        showCustomAlert(`Chúc mừng! Bạn thắng, tổng là ${sum}`);
                    } else {
                        // If the user lost, the bet amount was already deducted, so no change needed to balance here.
                        showCustomAlert(`Bạn thua, tổng là ${sum}`);
                    }

                    // Update user balance in SheetDB
                    await fetch(`${SHEETDB_API_USERS}/username/${encodeURIComponent(username)}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ balance: balance })
                    });
                    document.getElementById('userBalance').textContent = balance.toLocaleString(); // Update display

                    // Log bet history
                    const formData = new FormData();
                    formData.append('data[username]', username);
                    formData.append('data[betType]', betSide);
                    formData.append('data[betAmount]', betAmount);
                    formData.append('data[result]', result);
                    formData.append('data[win]', betSide === result ? 'win' : 'lose');
                    formData.append('data[sum]', sum);
                    formData.append('data[date]', new Date().toLocaleString("vi-VN"));
                    
                    await fetch(`${SHEETDB_API_USERS}?sheet=_history`, { method: 'POST', body: formData });
                    loadUserStats(); // Refresh user stats table
                } catch (e) {
                    console.error("Error processing bet results or logging history:", e);
                    showCustomAlert("Lỗi xử lý kết quả cược hoặc ghi lịch sử.");
                }
            } else if (username) {
                // If user didn't place a bet but is logged in, just update user stats and alert the sum.
                showCustomAlert(`Kết quả: tổng là ${sum}`);
                loadUserStats();
            }


            if (tx_settleTimeout) {
                clearTimeout(tx_settleTimeout);
            }

            tx_settleTimeout = setTimeout(async () => {
                if (blinkEl) { // Stop blinking after timeout
                    blinkEl.classList.remove('blink');
                    blinkEl.style.animation = "";
                    // Reset result box colors to default
                    taiResultBox.style.backgroundColor = '#d4edda';
                    taiResultBox.style.color = '#155724';
                    xiuResultBox.style.backgroundColor = '#f8d7da';
                    xiuResultBox.style.color = '#721c24';
                }
                updateStatView(); // Update view without blinking
                await resetTXBets(); // Ensure bets are cleared in SheetDB for the next round
                startTXRound(); // Start a new round
            }, 10000); // 10 seconds settlement time
        }

        // Event listener for betting on Tai
        document.getElementById('betTai').addEventListener('click', () => {
            if (tx_locked) return;
            if (userBet.side && userBet.side !== 'tai') {
                showCustomAlert("Bạn đã đặt cược vào Xỉu cho phiên này. Không thể đặt cược vào Tài.");
                return;
            }
            userBet.side = 'tai';
            document.getElementById('betTai').classList.add('selected');
            document.getElementById('betXiu').classList.remove('selected');
            document.getElementById('betTai').disabled = false;
            document.getElementById('betXiu').disabled = true;
        });

        // Event listener for betting on Xiu
        document.getElementById('betXiu').addEventListener('click', () => {
            if (tx_locked) return;
            if (userBet.side && userBet.side !== 'xiu') {
                showCustomAlert("Bạn đã đặt cược vào Tài cho phiên này. Không thể đặt cược vào Xỉu.");
                return;
            }
            userBet.side = 'xiu';
            document.getElementById('betXiu').classList.add('selected');
            document.getElementById('betTai').classList.remove('selected');
            document.getElementById('betTai').disabled = true;
            document.getElementById('betXiu').disabled = false;
        });

        // Event listener for placing the bet
        document.getElementById('placeBetBtn').addEventListener('click', async () => {
            if (tx_locked) {
                showCustomAlert("Cược đã khóa. Vui lòng chờ phiên mới.");
                return;
            }
            const username = localStorage.getItem('current_user');
            if (!username) {
                showCustomAlert('Vui lòng đăng nhập để đặt cược!');
                return;
            }

            try {
                const res = await fetch(`${SHEETDB_API_USERS}/search?username=${encodeURIComponent(username)}`);
                const users = await res.json();
                if (!Array.isArray(users) || users.length === 0) {
                    showCustomAlert('Lỗi: Không tìm thấy thông tin người dùng.');
                    return;
                }
                const user = users[0];
                let balance = parseInt(user.balance || 0);

                const betAmountInput = document.getElementById('betAmount');
                const betAmount = parseInt(betAmountInput.value);
                const betSide = userBet.side;

                if (!betSide) {
                    showCustomAlert('Vui lòng chọn Tài hoặc Xỉu!');
                    return;
                }
                if (isNaN(betAmount) || betAmount < 1000) {
                    showCustomAlert('Vui lòng nhập số tiền cược tối thiểu 1,000!');
                    return;
                }
                if (betAmount > balance) {
                    showCustomAlert('Không đủ số dư!');
                    return;
                }

                // Deduct from user's balance locally and update SheetDB
                balance -= betAmount;
                await fetch(`${SHEETDB_API_USERS}/username/${encodeURIComponent(username)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ balance: balance })
                });
                document.getElementById('userBalance').textContent = balance.toLocaleString(); // Update display

                // Record the bet in the current game bets SheetDB
                if (SHEETDB_API_CURRENT_GAME_BETS !== "https://sheetdb.io/api/v1/your_current_game_bets_api") {
                    const betData = new FormData();
                    betData.append('data[username]', username);
                    betData.append('data[type]', betSide);
                    betData.append('data[amount]', betAmount);
                    await fetch(`${SHEETDB_API_CURRENT_GAME_BETS}?sheet=bets`, {
                        method: 'POST',
                        body: betData
                    });
                } else {
                    console.warn("SHEETDB_API_CURRENT_GAME_BETS is not configured. Bet will not be recorded on server.");
                }

                userBet.amount = (userBet.amount || 0) + betAmount;
                userBet.side = betSide;

                // Immediately update client-side display with the new bet (this user's bet)
                if (betSide === 'tai') {
                    document.getElementById('tx-total-tai').textContent = (parseInt(document.getElementById('tx-total-tai').textContent.replace(/,/g, '')) + betAmount).toLocaleString();
                } else {
                    document.getElementById('tx-total-xiu').textContent = (parseInt(document.getElementById('tx-total-xiu').textContent.replace(/,/g, '')) + betAmount).toLocaleString();
                }

                showCustomAlert(`Bạn đã đặt ${betAmount.toLocaleString()} vào ${betSide === 'tai' ? 'Tài' : 'Xỉu'}`);
                document.querySelectorAll('.quick-bet-btn').forEach(b => b.classList.remove('selected'));

            } catch (e) {
                console.error("Error placing bet:", e);
                showCustomAlert('Lỗi đặt cược, thử lại sau!');
            }
        });

        document.getElementById('betAmount').addEventListener('input', () => {
            document.querySelectorAll('.quick-bet-btn').forEach(b => b.classList.remove('selected'));
        });

        // Loads and displays user's betting history
        async function loadUserStats() {
            const username = localStorage.getItem('current_user');
            if (!username) return;
            try {
                const res = await fetch(`${SHEETDB_API_USERS}/search?username=${encodeURIComponent(username)}&sheet=_history`);
                const data = await res.json();
                const tableBody = document.getElementById("userStatsTable")?.querySelector("tbody");
                if (!tableBody) return;

                tableBody.innerHTML = "";

                if (!data || !Array.isArray(data) || data.length === 0) {
                    tableBody.innerHTML = "<tr><td colspan='5'>Chưa có lịch sử</td></tr>";
                    return;
                }
                data.reverse().forEach(row => {
                    tableBody.innerHTML += `<tr>
                        <td>${row.date || 'N/A'}</td>
                        <td>${row.betType === "tai" ? "Tài" : "Xỉu"} - ${parseInt(row.betAmount || 0).toLocaleString()}</td>
                        <td>${row.result === "tai" ? "Tài" : "Xỉu"}</td>
                        <td>${row.sum || 'N/A'}</td>
                        <td>${row.win === "win" ? "<span style='color:green'>Thắng</span>" : "<span style='color:red'>Thua</span>"}</td>
                    </tr>`;
                });
            } catch (e) {
                console.error("Error loading user stats:", e);
                const tableBody = document.getElementById("userStatsTable")?.querySelector("tbody");
                if (tableBody) tableBody.innerHTML = "<tr><td colspan='5'>Lỗi tải lịch sử.</td></tr>";
            }
        }

        // Initializes game state and starts the first round
        function startGame() {
            // Ensure initial state for game elements
            document.getElementById('dice1').textContent = '?';
            document.getElementById('dice2').textContent = '?';
            document.getElementById('dice3').textContent = '?';
            
            // Reset result box colors to default
            const taiResultBox = document.querySelector('.result-box.tai');
            const xiuResultBox = document.querySelector('.result-box.xiu');
            if(taiResultBox) {
                taiResultBox.style.backgroundColor = '#d4edda';
                taiResultBox.style.color = '#155724';
            }
            if(xiuResultBox) {
                xiuResultBox.style.backgroundColor = '#f8d7da';
                xiuResultBox.style.color = '#721c24';
            }

            updateStatView(); // Clear any previous stats display and apply default colors

            renderQuickBetButtons(); // Render quick bet buttons
            loadUserStats(); // Load user's personal betting history
            startTXRound(); // Start the first game round
        }

        // Initial check for logged-in user on page load
        document.addEventListener('DOMContentLoaded', async () => {
            const currentUser = localStorage.getItem('current_user');
            if (currentUser) {
                document.getElementById('loginForm').style.display = 'none';
                document.getElementById('mainContent').style.display = 'block';
                await loadUserInfo(currentUser); // Ensure user info is loaded
                if (localStorage.getItem('is_admin') === '1') {
                    showAdminPanel();
                }
                startGame(); // Start game after DOM is loaded and user info is ready
            } else {
                document.getElementById('loginForm').style.display = 'block';
                document.getElementById('mainContent').style.display = 'none';
            }
        });