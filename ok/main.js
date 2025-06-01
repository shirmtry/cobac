// =================== CONFIG API ====================
const API_BASE = "https://cobac.vercel.app/api"; // ĐỔI thành domain thật của bạn!
const API_USER = `${API_BASE}/user`;
const API_REQUEST = `${API_BASE}/request`;
const API_BET = `${API_BASE}/bet`;

const ADMIN_USERNAMES = ["admin"];

// =================== HASH UTILITY ==================
function hashString(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0;
    }
    return hash.toString();
}

// =================== CAPTCHA =======================
function generateCaptcha(prefix = '') {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let captcha = '';
    for (let i = 0; i < 5; i++) {
        captcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const display = document.getElementById(prefix + 'captchaDisplay');
    if (display) display.textContent = captcha;
}
generateCaptcha();

// =================== UI EVENT ======================
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
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('captcha').value = '';
    if (tx_interval) clearInterval(tx_interval);
    if (tx_settleTimeout) clearTimeout(tx_settleTimeout);
    if (betSyncInterval) clearInterval(betSyncInterval);
});

// =================== GAME STATE ====================
let tx_stats = [];
let MAX_STATS = 20;
let tx_interval = null;
let tx_settleTimeout = null;
let betSyncInterval = null;
let userBet = { side: null, amount: 0 };
let tx_locked = false;

// ========== ĐĂNG KÝ ==========
document.getElementById('registerBtn').addEventListener('click', async () => {
    const username = document.getElementById('reg_username').value.trim();
    const password = document.getElementById('reg_password').value;
    const password2 = document.getElementById('reg_password2').value;
    const captcha = document.getElementById('reg_captcha').value?.trim().toUpperCase();
    const captchaCode = document.getElementById('reg_captchaDisplay').textContent?.trim().toUpperCase();

    if (!username || !password || !password2 || !captcha) {
        showCustomAlert('Vui lòng nhập đầy đủ thông tin.');
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

    // Kiểm tra user đã tồn tại chưa
    try {
        const check = await fetch(`${API_USER}?username=${encodeURIComponent(username)}`);
        if (check.ok) {
            const user = await check.json();
            if (user && user.username) {
                showCustomAlert('Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác!');
                return;
            }
        }
    } catch (e) {}

    // Lấy IP đăng ký (tùy chọn)
    let ip = "";
    try {
        const ipres = await fetch("https://api.ipify.org?format=json");
        const ipjson = await ipres.json();
        ip = ipjson.ip || "";
    } catch (e) {
        ip = "";
    }

    try {
        const response = await fetch(API_USER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                passwordHash: hashString(password),
                ip
            })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            showCustomAlert('Đăng ký thành công, bạn đã được đăng nhập!');
            // Đăng nhập luôn
            localStorage.setItem('current_user', username);
            localStorage.setItem('is_admin', ADMIN_USERNAMES.includes(username) ? '1' : '');
            document.getElementById("registerForm").style.display = "none";
            document.getElementById("mainContent").style.display = "block";
            await loadUserInfo(username);
            if (ADMIN_USERNAMES.includes(username)) showAdminPanel();
            startGame();
            // Reset form
            document.getElementById('reg_username').value = '';
            document.getElementById('reg_password').value = '';
            document.getElementById('reg_password2').value = '';
            document.getElementById('reg_captcha').value = '';
        } else {
            showCustomAlert(data.error || 'Lỗi đăng ký, thử lại sau!');
        }
    } catch (e) {
        showCustomAlert('Lỗi kết nối, thử lại sau!');
    }
});

// ========== ĐĂNG NHẬP ==========
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
        const res = await fetch(`${API_USER}?username=${encodeURIComponent(username)}`);
        if (!res.ok) {
            showCustomAlert('Tài khoản không tồn tại!');
            return;
        }
        const user = await res.json();
        if (user.passwordHash !== hashString(password)) {
            showCustomAlert('Mật khẩu không đúng!');
            return;
        }

        // ==== CẬP NHẬT IP ĐĂNG NHẬP ====
        let ip = "";
        try {
            const ipres = await fetch("https://api.ipify.org?format=json");
            const ipjson = await ipres.json();
            ip = ipjson.ip || "";
        } catch (e) {
            ip = "";
        }
        try {
            await fetch(API_USER, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, ip })
            });
        } catch (e) {}

        localStorage.setItem('current_user', username);
        localStorage.setItem('is_admin', ADMIN_USERNAMES.includes(username) ? '1' : '');

        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';

        await loadUserInfo(username);
        if (ADMIN_USERNAMES.includes(username)) {
            showAdminPanel();
        }
        startGame();
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('captcha').value = '';
    } catch (e) {
        showCustomAlert('Lỗi đăng nhập, thử lại sau!');
    }
});

// ========== GAME FUNCTIONS (TÀI/XỈU) ===============

// Lấy tổng cược hiện tại
async function updateCurrentBets() {
    try {
        const response = await fetch(API_BET);
        const data = await response.json();
        let totalTai = 0;
        let totalXiu = 0;
        if (data && Array.isArray(data.bets)) {
            data.bets.forEach(bet => {
                // bet = [timestamp, username, side, amount]
                const amount = parseInt(bet[3]);
                if (!isNaN(amount)) {
                    if (bet[2] === 'tai') {
                        totalTai += amount;
                    } else if (bet[2] === 'xiu') {
                        totalXiu += amount;
                    }
                }
            });
        }
        document.getElementById('tx-total-tai').textContent = totalTai.toLocaleString();
        document.getElementById('tx-total-xiu').textContent = totalXiu.toLocaleString();
    } catch (e) {}
}

// Reset bets cho round mới
async function resetTXBets() {
    userBet = { side: null, amount: 0 };
    setTXTotals(0, 0);
    document.getElementById('betTai').classList.remove('selected');
    document.getElementById('betXiu').classList.remove('selected');
    document.getElementById('betTai').disabled = false;
    document.getElementById('betXiu').disabled = false;
    document.querySelectorAll('.quick-bet-btn').forEach(b => b.classList.remove('selected'));
    try {
        await fetch(API_BET, { method: 'DELETE' });
    } catch (e) {}
    updateCurrentBets();
}
function setTXTotals(taiAmount, xiuAmount) {
    document.getElementById('tx-total-tai').textContent = taiAmount.toLocaleString();
    document.getElementById('tx-total-xiu').textContent = xiuAmount.toLocaleString();
}
function updateStatView(blinkSide = null) {
    const box = document.getElementById('tx-stat-list');
    if (!box) return;
    box.innerHTML = tx_stats.slice(-MAX_STATS).reverse().map(st =>
        `<span class="tx-circle ${st.result} ${blinkSide && blinkSide === st.result ? 'blink' : ''}">
            ${st.result === 'tai' ? 'T' : 'X'}
        </span>`
    ).join('');
}
function lockBettingTX() {
    tx_locked = true;
    document.getElementById('placeBetBtn').disabled = true;
    document.getElementById('betTai').disabled = true;
    document.getElementById('betXiu').disabled = true;
    document.getElementById('betAmount').disabled = true;
    document.querySelectorAll('.quick-bet-btn').forEach(b => b.disabled = true);
}
function unlockBettingTX() {
    tx_locked = false;
    document.getElementById('placeBetBtn').disabled = false;
    if (userBet.side === 'tai') {
        document.getElementById('betTai').disabled = false;
        document.getElementById('betXiu').disabled = true;
        document.getElementById('betTai').classList.add('selected');
        document.getElementById('betXiu').classList.remove('selected');
    } else if (userBet.side === 'xiu') {
        document.getElementById('betTai').disabled = true;
        document.getElementById('betXiu').disabled = false;
        document.getElementById('betXiu').classList.add('selected');
        document.getElementById('betTai').classList.remove('selected');
    } else {
        document.getElementById('betTai').disabled = false;
        document.getElementById('betXiu').disabled = false;
        document.getElementById('betTai').classList.remove('selected');
        document.getElementById('betXiu').classList.remove('selected');
    }
    document.getElementById('betAmount').disabled = false;
    document.querySelectorAll('.quick-bet-btn').forEach(b => b.disabled = false);
}

// =================== GAME ROUND ====================
async function startTXRound() {
    if (tx_interval) clearInterval(tx_interval);
    if (tx_settleTimeout) clearTimeout(tx_settleTimeout);
    if (betSyncInterval) clearInterval(betSyncInterval);

    await resetTXBets();
    unlockBettingTX();
    let tx_timer = 30;
    document.getElementById('tx-timer-label').textContent = "Thời gian cược:";
    document.getElementById('countdown').textContent = tx_timer;

    document.getElementById('dice1').textContent = '?';
    document.getElementById('dice2').textContent = '?';
    document.getElementById('dice3').textContent = '?';

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
    updateStatView();

    betSyncInterval = setInterval(updateCurrentBets, 1500);

    tx_interval = setInterval(() => {
        tx_timer--;
        document.getElementById('countdown').textContent = tx_timer;
        if (tx_timer === 5) {
            lockBettingTX();
            document.getElementById('tx-timer-label').textContent = "Khóa cược sau:";
            if (betSyncInterval) clearInterval(betSyncInterval);
        }
        if (tx_timer <= 0) {
            clearInterval(tx_interval);
            rollTXDice();
        }
    }, 1000);
}

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
        if (rolls > 15) {
            clearInterval(rollAnim);
            diceBoxes.forEach((die, idx) => die.textContent = dice[idx]);
            setTimeout(() => finishTXRound(dice), 700);
        }
    }, 70);
}

async function finishTXRound(dice) {
    const sum = dice.reduce((a, b) => a + b, 0);
    const result = sum > 10 ? 'tai' : 'xiu';

    const currentTotalTai = parseInt(document.getElementById('tx-total-tai').textContent.replace(/,/g, '') || 0);
    const currentTotalXiu = parseInt(document.getElementById('tx-total-xiu').textContent.replace(/,/g, '') || 0);

    tx_stats.push({ tai: currentTotalTai, xiu: currentTotalXiu, result: result });
    updateStatView(result);

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
    const blinkEl = document.querySelector(`.result-box.${result}`);
    if (blinkEl) {
        blinkEl.classList.add('blink');
        blinkEl.style.animation = "blink-tx 0.35s linear alternate infinite";
        if (result === 'tai') {
            blinkEl.style.backgroundColor = '#111';
            blinkEl.style.color = '#ffd600';
        } else {
            blinkEl.style.backgroundColor = '#fff';
            blinkEl.style.color = '#222';
        }
    }

    const username = localStorage.getItem('current_user');
    const betSide = userBet.side;
    const betAmount = userBet.amount;
    if (betSide && betAmount && username) {
        try {
            const res = await fetch(`${API_USER}?username=${encodeURIComponent(username)}`);
            const user = await res.json();
            if (!user || !user.username) {
                showCustomAlert("Lỗi: Không tìm thấy thông tin người dùng để cập nhật số dư.");
                return;
            }
            let balance = parseInt(user.balance || 0);

            if (betSide === result) {
                balance += (betAmount * 2);
                showCustomAlert(`Chúc mừng! Bạn thắng, tổng là ${sum}`);
            } else {
                showCustomAlert(`Bạn thua, tổng là ${sum}`);
            }

            await fetch(API_USER, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, balance: balance })
            });
            document.getElementById('userBalance').textContent = balance.toLocaleString();

            // Log bet history (nếu bạn có API riêng lưu lịch sử thì gọi ở đây)
            // Nếu không có thì bỏ qua
        } catch (e) {
            showCustomAlert("Lỗi xử lý kết quả cược hoặc ghi lịch sử.");
        }
    } else if (username) {
        showCustomAlert(`Kết quả: tổng là ${sum}`);
    }

    if (tx_settleTimeout) {
        clearTimeout(tx_settleTimeout);
    }
    tx_settleTimeout = setTimeout(async () => {
        if (blinkEl) {
            blinkEl.classList.remove('blink');
            blinkEl.style.animation = "";
            taiResultBox.style.backgroundColor = '#d4edda';
            taiResultBox.style.color = '#155724';
            xiuResultBox.style.backgroundColor = '#f8d7da';
            xiuResultBox.style.color = '#721c24';
        }
        updateStatView();
        await resetTXBets();
        startTXRound();
    }, 10000);
}

// ========== ĐẶT CƯỢC ===============
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
        const res = await fetch(`${API_USER}?username=${encodeURIComponent(username)}`);
        const user = await res.json();
        if (!user || !user.username) {
            showCustomAlert('Lỗi: Không tìm thấy thông tin người dùng.');
            return;
        }
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

        // Trừ tiền user
        balance -= betAmount;
        await fetch(API_USER, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, balance: balance })
        });
        document.getElementById('userBalance').textContent = balance.toLocaleString();

        // Ghi cược lên server
        await fetch(API_BET, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, side: betSide, amount: betAmount })
        });

        userBet.amount = (userBet.amount || 0) + betAmount;
        userBet.side = betSide;

        if (betSide === 'tai') {
            document.getElementById('tx-total-tai').textContent =
                (parseInt(document.getElementById('tx-total-tai').textContent.replace(/,/g, '')) + betAmount).toLocaleString();
        } else {
            document.getElementById('tx-total-xiu').textContent =
                (parseInt(document.getElementById('tx-total-xiu').textContent.replace(/,/g, '')) + betAmount).toLocaleString();
        }

        showCustomAlert(`Bạn đã đặt ${betAmount.toLocaleString()} vào ${betSide === 'tai' ? 'Tài' : 'Xỉu'}`);
        document.querySelectorAll('.quick-bet-btn').forEach(b => b.classList.remove('selected'));

    } catch (e) {
        showCustomAlert('Lỗi đặt cược, thử lại sau!');
    }
});

document.getElementById('betAmount').addEventListener('input', () => {
    document.querySelectorAll('.quick-bet-btn').forEach(b => b.classList.remove('selected'));
});

// ========== KHỞI ĐỘNG GAME ==========
function startGame() {
    document.getElementById('dice1').textContent = '?';
    document.getElementById('dice2').textContent = '?';
    document.getElementById('dice3').textContent = '?';
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
    updateStatView();
    renderQuickBetButtons();
    startTXRound();
}

// ========== QUICK BET BUTTONS ==========
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
    group.innerHTML = "";
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

// ========== INIT ON LOAD ==========
document.addEventListener('DOMContentLoaded', async () => {
    const currentUser = localStorage.getItem('current_user');
    if (currentUser) {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        await loadUserInfo(currentUser);
        if (localStorage.getItem('is_admin') === '1') {
            showAdminPanel();
        }
        startGame();
    } else {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('mainContent').style.display = 'none';
    }
});

// ====== BỔ SUNG HÀM showCustomAlert, loadUserInfo, showAdminPanel ======
// Hàm hiển thị thông báo
function showCustomAlert(msg) {
    alert(msg); // Bạn có thể thay thế bằng modal đẹp hơn nếu muốn
}

// Hàm load thông tin user và cập nhật UI
async function loadUserInfo(username) {
    document.getElementById("userNameDisplay").textContent = username;
    try {
        const res = await fetch(`${API_USER}?username=${encodeURIComponent(username)}`);
        if (res.ok) {
            const user = await res.json();
            document.getElementById("userBalance").textContent = (user.balance || 0).toLocaleString();
        }
    } catch (e) {
        document.getElementById("userBalance").textContent = "0";
    }
}

// Hàm hiển thị panel admin nếu user là admin
function showAdminPanel() {
    document.getElementById("adminPanel").style.display = "block";
}
